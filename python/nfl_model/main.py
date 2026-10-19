"""
main.py
-------
FastAPI REST API for the NFL Predictive Simulation Model (SharpSim).
Runs on port 8002.

Endpoints:
  GET  /health
  GET  /api/v1/nfl/teams
  GET  /api/v1/nfl/schedule
  GET  /api/v1/nfl/predict?home=...&away=...&marketSpread=...&marketTotal=...
  POST /api/v1/nfl/simulate
  GET  /api/v1/nfl/projections

Usage:
  python python/nfl_model/main.py
  # or
  uvicorn main:app --host 0.0.0.0 --port 8002 --reload
"""

import logging
import sys
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from data_loader import (
    NFL_BASELINES,
    NFL_TEAM_ABBR_TO_NAME,
    canonical_abbr,
    canonical_name,
    load_nfl_matchups,
    build_weather_context,
    MatchupInjuryContext,
    NFLMatchupData,
)
from handicapper import NFLHandicapper, MatchupHandicapResult
from simulation import NFLMonteCarloEngine, SimulationSummary
from signals import (
    evaluate_betting_signals,
    MatchupPredictionReport,
    MarketBetSignal,
    BetSignalTier,
)

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# Global instances
_mc_engine: Optional[NFLMonteCarloEngine] = None
_cached_matchups: List[NFLMatchupData] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _mc_engine, _cached_matchups
    logger.info("⚡ Initializing SharpSim NFL Monte Carlo Prediction Engine...")
    _mc_engine = NFLMonteCarloEngine(n_simulations=25000, random_seed=42)
    try:
        _cached_matchups = load_nfl_matchups()
        logger.info("✅ Pre-loaded %d NFL matchups with consensus lines and injuries.", len(_cached_matchups))
    except Exception as e:
        logger.warning("Could not pre-load matchups on startup: %s", e)
    yield
    logger.info("🛑 Shutting down NFL engine.")


app = FastAPI(
    title="SharpSim NFL Predictive Simulation Engine",
    description="Production-grade NFL Monte Carlo simulation engine with opponent-adjusted EPA, QB/OL adjustments, key-numbers awareness, and +EV signal generation.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "sport": "NFL",
        "engine": "Monte Carlo 25k discrete possession simulator",
        "teams_loaded": len(NFL_BASELINES),
        "cached_fixtures": len(_cached_matchups),
    }


@app.get("/api/v1/nfl/teams")
def get_nfl_teams():
    """Return all 32 NFL teams with stadium info, depth charts, and EPA baselines."""
    teams_out = []
    for abbr, base in NFL_BASELINES.items():
        teams_out.append({
            "abbreviation": abbr,
            "name": base.name,
            "stadium": {
                "name": base.stadium.name,
                "city": base.stadium.city,
                "state": base.stadium.state,
                "is_dome": base.stadium.is_dome,
                "surface": base.stadium.surface,
                "elevation_m": base.stadium.elevation_m,
            },
            "starting_qb": {
                "name": base.qb.starter_name,
                "tier": base.qb.starter_tier,
                "rating": base.qb.starter_rating,
                "backup_name": base.qb.backup_name,
                "downgrade_penalty": base.qb.downgrade_points,
            },
            "epa_baselines": {
                "pass_off_epa": base.pass_off_epa,
                "rush_off_epa": base.rush_off_epa,
                "pass_def_epa": base.pass_def_epa,
                "rush_def_epa": base.rush_def_epa,
                "success_rate": base.success_rate,
                "neutral_pass_rate": base.neutral_pass_rate,
                "pace_sec_per_play": base.pace_sec_per_play,
            }
        })
    return {"count": len(teams_out), "teams": teams_out}


@app.get("/api/v1/nfl/schedule")
def get_nfl_schedule():
    """Return current scheduled matchups with market odds and weather conditions."""
    global _cached_matchups
    if not _cached_matchups:
        _cached_matchups = load_nfl_matchups()
    return {"count": len(_cached_matchups), "matchups": _cached_matchups}


@app.get("/api/v1/nfl/predict")
def predict_nfl_game(
    home: str = Query(..., description="Home team name or abbreviation (e.g. 'DET' or 'Detroit Lions')"),
    away: str = Query(..., description="Away team name or abbreviation (e.g. 'KC' or 'Kansas City Chiefs')"),
    marketSpread: Optional[float] = Query(None, description="Consensus home spread (e.g. -2.5)"),
    marketTotal: Optional[float] = Query(None, description="Consensus total (e.g. 43.5)"),
    windMph: Optional[float] = Query(None, description="Wind speed in mph override"),
    homeQBOut: bool = Query(False, description="Simulate home starting QB ruled out"),
    awayQBOut: bool = Query(False, description="Simulate away starting QB ruled out"),
    homeMissingOL: int = Query(0, description="Number of missing offensive line starters for home"),
    awayMissingOL: int = Query(0, description="Number of missing offensive line starters for away"),
):
    """
    Run full 25,000 Monte Carlo simulation for a specific NFL matchup.
    Returns handicap breakdown, key numbers diagnostic, +EV signals, and recommended side.
    """
    home_abbr = canonical_abbr(home)
    away_abbr = canonical_abbr(away)

    if not home_abbr or home_abbr not in NFL_BASELINES:
        raise HTTPException(status_code=400, detail=f"Unrecognized home team: '{home}'")
    if not away_abbr or away_abbr not in NFL_BASELINES:
        raise HTTPException(status_code=400, detail=f"Unrecognized away team: '{away}'")

    home_base = NFL_BASELINES[home_abbr]
    away_base = NFL_BASELINES[away_abbr]

    # Look up cached matchup if available for live lines
    live_matchup = next((m for m in _cached_matchups if m.home_abbr == home_abbr and m.away_abbr == away_abbr), None)

    m_spread = marketSpread if marketSpread is not None else (live_matchup.market_spread if live_matchup else 0.0)
    m_total = marketTotal if marketTotal is not None else (live_matchup.market_total if live_matchup else 44.0)
    start_time = live_matchup.start_time if live_matchup else "2026-10-18T17:00:00Z"
    game_id = live_matchup.game_id if live_matchup else f"{away_abbr}@{home_abbr}"
    week = live_matchup.week if live_matchup else 7

    # Weather
    weather = build_weather_context(home_base.stadium)
    if windMph is not None:
        weather.wind_mph = windMph
        if not weather.is_dome and windMph >= 14.5:
            weather.wind_depressed_pass = min(0.35, (windMph - 14.0) * 0.025)
            weather.wind_depressed_total = round((windMph - 14.0) * 0.22, 2)
        else:
            weather.wind_depressed_pass = 0.0
            weather.wind_depressed_total = 0.0

    # Injuries
    home_inj = live_matchup.home_injuries if (live_matchup and not homeQBOut and homeMissingOL == 0) else MatchupInjuryContext()
    away_inj = live_matchup.away_injuries if (live_matchup and not awayQBOut and awayMissingOL == 0) else MatchupInjuryContext()

    if homeQBOut:
        home_inj.starter_qb_out = True
        home_inj.qb_downgrade = home_base.qb.downgrade_points
        home_inj.injury_descriptions.append(f"Starting QB {home_base.qb.starter_name} OUT (-{home_inj.qb_downgrade:.1f} pts)")
    if awayQBOut:
        away_inj.starter_qb_out = True
        away_inj.qb_downgrade = away_base.qb.downgrade_points
        away_inj.injury_descriptions.append(f"Starting QB {away_base.qb.starter_name} OUT (-{away_inj.qb_downgrade:.1f} pts)")

    if homeMissingOL > 0:
        home_inj.missing_ol_starters = homeMissingOL
        home_inj.ol_penalty = 2.25 if homeMissingOL >= 3 else (1.25 if homeMissingOL == 2 else 0.5)
    if awayMissingOL > 0:
        away_inj.missing_ol_starters = awayMissingOL
        away_inj.ol_penalty = 2.25 if awayMissingOL >= 3 else (1.25 if awayMissingOL == 2 else 0.5)

    matchup_data = NFLMatchupData(
        game_id=game_id,
        home_abbr=home_abbr,
        away_abbr=away_abbr,
        home_team=home_base.name,
        away_team=away_base.name,
        start_time=start_time,
        week=week,
        is_short_rest=live_matchup.is_short_rest if live_matchup else False,
        travel_timezone_diff=abs(home_base.stadium.timezone_offset_hours - away_base.stadium.timezone_offset_hours),
        is_international=live_matchup.is_international if live_matchup else False,
        market_spread=m_spread,
        market_total=m_total,
        market_moneyline_home=live_matchup.market_moneyline_home if live_matchup else -110,
        market_moneyline_away=live_matchup.market_moneyline_away if live_matchup else -110,
        spread_home_odds=live_matchup.spread_home_odds if live_matchup else -110,
        spread_away_odds=live_matchup.spread_away_odds if live_matchup else -110,
        total_over_odds=live_matchup.total_over_odds if live_matchup else -110,
        total_under_odds=live_matchup.total_under_odds if live_matchup else -110,
        weather=weather,
        home_injuries=home_inj,
        away_injuries=away_inj,
    )

    # 1. Handicapping
    handicap = NFLHandicapper.handicap_matchup(matchup_data)

    # 2. Monte Carlo Simulation
    engine = _mc_engine or NFLMonteCarloEngine(n_simulations=25000)
    sim = engine.simulate_matchup(handicap, m_spread, m_total)

    # 3. +EV Signals
    report = evaluate_betting_signals(
        sim=sim,
        game_id=game_id,
        start_time=start_time,
        week=week,
        spread_h_odds=matchup_data.spread_home_odds,
        spread_a_odds=matchup_data.spread_away_odds,
        total_o_odds=matchup_data.total_over_odds,
        total_u_odds=matchup_data.total_under_odds,
        ml_h_odds=matchup_data.market_moneyline_home,
        ml_a_odds=matchup_data.market_moneyline_away,
    )

    # Return standard SharpSim schema with rich analytics
    return {
        "matchup": f"{home_base.name} vs {away_base.name}",
        "prediction": {
            "projectedSpread": report.projected_spread,
            "marketSpread": report.market_spread,
            "zScore": report.z_score,
            "betSignal": report.primary_bet_signal.value,
            "recommendedSide": report.recommended_side,
            "confidence": "High" if report.primary_bet_signal in [BetSignalTier.ELITE_VALUE, BetSignalTier.STRONG_VALUE] else ("Moderate" if report.primary_bet_signal == BetSignalTier.PLAYABLE else "Low"),
            "projectedTotal": report.projected_total,
            "marketTotal": report.market_total,
            "homeWinProb": round(report.home_win_prob * 100, 1),
            "awayWinProb": round(report.away_win_prob * 100, 1),
            "projectedScore": f"{report.projected_away_score:.1f} - {report.projected_home_score:.1f}",
        },
        "components": {
            "home": {
                "baseRating": round(home_base.pass_off_epa * 30 + home_base.rush_off_epa * 20, 2),
                "injuryPenalty": round(handicap.home.total_personnel_delta, 2),
                "finalTPR": round(handicap.home.projected_offensive_points, 2),
                "passOffEPA": home_base.pass_off_epa,
                "rushOffEPA": home_base.rush_off_epa,
                "successRate": round(handicap.home.effective_success_rate * 100, 1),
            },
            "away": {
                "baseRating": round(away_base.pass_off_epa * 30 + away_base.rush_off_epa * 20, 2),
                "injuryPenalty": round(handicap.away.total_personnel_delta, 2),
                "finalTPR": round(handicap.away.projected_offensive_points, 2),
                "passOffEPA": away_base.pass_off_epa,
                "rushOffEPA": away_base.rush_off_epa,
                "successRate": round(handicap.away.effective_success_rate * 100, 1),
            },
            "hca": {
                "total": handicap.hca_points,
                "breakdown": handicap.situational_breakdown,
            },
            "weather": {
                "venue": weather.venue_name,
                "isDome": weather.is_dome,
                "windMph": weather.wind_mph,
                "temperatureF": weather.temperature_f,
                "totalPointsDeduction": handicap.weather_points_delta,
            }
        },
        "injuries": {
            "home": [{"name": d, "status": "Out", "impact": "High"} for d in home_inj.injury_descriptions] or [{"name": "None", "status": "Healthy", "impact": "Neutral"}],
            "away": [{"name": d, "status": "Out", "impact": "High"} for d in away_inj.injury_descriptions] or [{"name": "None", "status": "Healthy", "impact": "Neutral"}],
        },
        "simulation": {
            "iterations": sim.n_simulations,
            "keyNumberShares": sim.key_number_shares,
            "edgeCrossesPrimaryKey": sim.edge_crosses_primary_key,
            "pHomeCover": round(sim.p_home_cover * 100, 1),
            "pAwayCover": round(sim.p_away_cover * 100, 1),
            "pSpreadPush": round(sim.p_spread_push * 100, 1),
            "pOver": round(sim.p_over * 100, 1),
            "pUnder": round(sim.p_under * 100, 1),
        },
        "bestBet": {
            "selection": report.best_bet.selection if report.best_bet else "No Play",
            "marketType": report.best_bet.market_type if report.best_bet else None,
            "ev": f"{report.best_bet.ev_percent:+.2f}%" if report.best_bet else "0.0%",
            "quarterKelly": f"{report.best_bet.quarter_kelly_pct:.2f}%" if report.best_bet else "0.0%",
            "signal": report.best_bet.signal_tier.value if report.best_bet else "No Play",
            "rationale": report.best_bet.rationale if report.best_bet else "Insufficient margin equity or negative EV.",
        } if report.best_bet else None,
        "allSignals": [
            {
                "selection": s.selection,
                "marketType": s.market_type,
                "ev": f"{s.ev_percent:+.2f}%",
                "pWin": f"{s.p_win*100:.1f}%",
                "signal": s.signal_tier.value,
                "actionable": s.is_actionable,
                "quarterKelly": f"{s.quarter_kelly_pct:.2f}%",
                "rationale": s.rationale,
            }
            for s in report.all_signals
        ],
    }


@app.get("/api/v1/nfl/projections")
def get_all_nfl_projections():
    """Run full simulations for all upcoming NFL matchups and return ranked +EV opportunities."""
    global _cached_matchups
    if not _cached_matchups:
        _cached_matchups = load_nfl_matchups()

    results = []
    engine = _mc_engine or NFLMonteCarloEngine(n_simulations=25000)

    for m in _cached_matchups:
        handicap = NFLHandicapper.handicap_matchup(m)
        sim = engine.simulate_matchup(handicap, m.market_spread, m.market_total)
        report = evaluate_betting_signals(
            sim=sim,
            game_id=m.game_id,
            start_time=m.start_time,
            week=m.week,
            spread_h_odds=m.spread_home_odds,
            spread_a_odds=m.spread_away_odds,
            total_o_odds=m.total_over_odds,
            total_u_odds=m.total_under_odds,
            ml_h_odds=m.market_moneyline_home,
            ml_a_odds=m.market_moneyline_away,
        )
        results.append({
            "gameId": m.game_id,
            "matchup": m.away_team + " @ " + m.home_team,
            "homeTeam": m.home_team,
            "awayTeam": m.away_team,
            "homeAbbr": m.home_abbr,
            "awayAbbr": m.away_abbr,
            "startTime": m.start_time,
            "week": m.week,
            "marketSpread": m.market_spread,
            "projectedSpread": report.projected_spread,
            "spreadEdge": report.spread_edge_points,
            "marketTotal": m.market_total,
            "projectedTotal": report.projected_total,
            "totalEdge": report.total_edge_points,
            "projectedScore": f"{report.projected_away_score:.1f} - {report.projected_home_score:.1f}",
            "homeWinProb": round(report.home_win_prob * 100, 1),
            "awayWinProb": round(report.away_win_prob * 100, 1),
            "betSignal": report.primary_bet_signal.value,
            "recommendedSide": report.recommended_side,
            "zScore": report.z_score,
            "bestBet": {
                "selection": report.best_bet.selection,
                "ev": f"{report.best_bet.ev_percent:+.2f}%",
                "quarterKelly": f"{report.best_bet.quarter_kelly_pct:.2f}%",
                "signal": report.best_bet.signal_tier.value,
                "rationale": report.best_bet.rationale,
            } if report.best_bet else None,
            "allSignals": [
                {
                    "selection": s.selection,
                    "market": s.market_type,
                    "ev": s.ev_percent,
                    "pWin": round(s.p_win * 100, 1),
                    "signal": s.signal_tier.value,
                    "actionable": s.is_actionable,
                }
                for s in report.all_signals
            ],
            "weather": {
                "venue": m.weather.venue_name,
                "windMph": m.weather.wind_mph,
                "tempF": m.weather.temperature_f,
                "isDome": m.weather.is_dome,
            }
        })

    # Sort by absolute Z-Score descending
    results.sort(key=lambda r: abs(r["zScore"]), reverse=True)
    return {"totalGames": len(results), "projections": results}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=False)
