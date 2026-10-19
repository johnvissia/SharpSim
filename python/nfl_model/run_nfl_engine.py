"""
run_nfl_engine.py
-----------------
Autonomous execution and validation runner for the SharpSim NFL Predictive Simulation Model.
Performs:
1. Matchup ingestion from ESPN and The Odds API.
2. Opponent-adjusted EPA handicapping, personnel (QB/OL) downgrades, and weather calculations.
3. 25,000-iteration discrete Monte Carlo simulations capturing NFL key numbers.
4. +EV betting signal calculations with Quarter-Kelly sizing.
5. Direct ingestion into Firestore collections:
   - `model_predictions`: Standardized SharpSim accuracy and model projection schema.
   - `daily_games`: Standardized odds and game registry.
6. JSON artifact generation in `python/nfl_model/data/nfl_projections.json`.
7. Diagnostic terminal report comparing model projections against opening consensus lines.
"""

import json
import logging
import os
import sys
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List

# Ensure current directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_loader import (
    NFL_BASELINES,
    load_nfl_matchups,
    NFLMatchupData,
    canonical_abbr,
    canonical_name,
)
from handicapper import NFLHandicapper
from simulation import NFLMonteCarloEngine
from signals import evaluate_betting_signals, BetSignalTier

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_nfl_engine")

FIREBASE_API_KEY = os.environ.get("NEXT_PUBLIC_FIREBASE_API_KEY", "AIzaSyCsZFIQYt7yAUpRKM1-KZB0dg36_0WBSQE")
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "studio-5044041186-4b498")


def get_firebase_auth_token() -> str:
    """Obtain anonymous Firebase ID token for REST writes."""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_API_KEY}"
    req = urllib.request.Request(
        url,
        data=json.dumps({"returnSecureToken": True}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    token = data.get("idToken")
    if not token:
        raise RuntimeError("Failed to obtain Firebase auth token")
    return token


def to_firestore_fields(obj: Any) -> Dict[str, Any]:
    """Convert Python dict into Firestore REST JSON typed fields schema."""
    fields: Dict[str, Any] = {}
    for k, v in obj.items():
        if v is None:
            fields[k] = {"nullValue": None}
        elif isinstance(v, bool):
            fields[k] = {"booleanValue": v}
        elif isinstance(v, int):
            fields[k] = {"integerValue": str(v)}
        elif isinstance(v, float):
            fields[k] = {"doubleValue": float(v)}
        elif isinstance(v, str):
            fields[k] = {"stringValue": v}
        elif isinstance(v, list):
            fields[k] = {"arrayValue": {"values": [to_firestore_fields({"_": item})["_"] for item in v]}}
        elif isinstance(v, dict):
            fields[k] = {"mapValue": {"fields": to_firestore_fields(v)}}
        else:
            fields[k] = {"stringValue": str(v)}
    return fields


def fetch_existing_predictions(auth_token: str) -> Dict[str, Dict[str, Any]]:
    """Fetch existing model_predictions from Firestore to detect frozen/locked predictions."""
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/model_predictions?key={FIREBASE_API_KEY}&pageSize=300"
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {auth_token}"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        docs = {}
        for d in data.get("documents", []):
            doc_id = d.get("name", "").split("/")[-1]
            fields = d.get("fields", {})
            parsed: Dict[str, Any] = {}
            for k, fv in fields.items():
                if "stringValue" in fv:
                    parsed[k] = fv["stringValue"]
                elif "booleanValue" in fv:
                    parsed[k] = fv["booleanValue"]
                elif "integerValue" in fv:
                    parsed[k] = int(fv["integerValue"])
                elif "doubleValue" in fv:
                    parsed[k] = float(fv["doubleValue"])
            docs[doc_id] = parsed
        return docs
    except Exception as e:
        logger.warning(f"Could not load existing predictions from Firestore: {e}")
        return {}


def save_firestore_doc(collection: str, doc_id: str, doc_data: Dict[str, Any], auth_token: str):
    """Write document to Firestore via REST API."""
    fields = to_firestore_fields(doc_data)
    encoded_id = urllib.parse.quote(doc_id, safe="")
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/{collection}/{encoded_id}?key={FIREBASE_API_KEY}"
    req = urllib.request.Request(
        url,
        data=json.dumps({"fields": fields}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        },
        method="PATCH"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    force_lock = "--lock" in sys.argv or "--freeze" in sys.argv
    print("=" * 88)
    print(f" [NFL] SHARPSIM QUANTITATIVE SIMULATION & FAIR LINE GENERATOR {'[LOCKDOWN MODE]' if force_lock else ''}")
    print("=" * 88)

    # 1. Ingest Data
    logger.info("📡 Ingesting live NFL schedule, consensus lines, injuries, and weather...")
    matchups = load_nfl_matchups()
    if not matchups:
        logger.error("No NFL matchups loaded. Exiting.")
        return

    print(f"\n✅ Ingested {len(matchups)} NFL matchups for analysis.")

    # 2. Authenticate with Firestore & Fetch Existing Snapshots
    auth_token = None
    existing_predictions: Dict[str, Dict[str, Any]] = {}
    try:
        auth_token = get_firebase_auth_token()
        logger.info("🔑 Authenticated with Firebase Auth successfully.")
        existing_predictions = fetch_existing_predictions(auth_token)
        logger.info(f"📋 Found {len(existing_predictions)} total predictions in Firestore.")
    except Exception as e:
        logger.warning(f"Firebase auth failed: {e}. Outputting locally only.")

    # 3. Execute Monte Carlo Simulation Engine
    logger.info("⚙️ Initializing 25,000-iteration Monte Carlo discrete scoring engine...")
    engine = NFLMonteCarloEngine(n_simulations=25000, random_seed=2026)

    diagnostics: List[Dict[str, Any]] = []
    firestore_predictions: List[Dict[str, Any]] = []
    daily_games_docs: List[Dict[str, Any]] = []

    print("\n" + "-" * 110)
    print(f"{'MATCHUP':<34} | {'MKT SPREAD':<11} | {'PROJ SPREAD':<12} | {'MKT TOT':<8} | {'PROJ TOT':<9} | {'WIN PROB (H/A)':<15} | {'STATUS':<15}")
    print("-" * 110)

    for m in matchups:
        start_dt = datetime.fromisoformat(m.start_time.replace("Z", "+00:00"))
        time_until_start = (start_dt - datetime.now(timezone.utc)).total_seconds()
        is_lockdown = (time_until_start <= 15 * 60) or force_lock

        existing = existing_predictions.get(m.game_id)
        is_already_locked = bool(existing and (existing.get("isFrozen") is True or existing.get("status") == "graded"))

        # STRICT RULE: games should only be predicted if it is within 24 hours before start time
        if time_until_start > 24 * 3600 and not is_already_locked:
            continue

        # A. Handicap
        handicap = NFLHandicapper.handicap_matchup(m)

        # B. Monte Carlo Simulation
        sim = engine.simulate_matchup(handicap, m.market_spread, m.market_total)

        # C. Betting Signal & +EV Evaluation
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

        # Format display
        mkt_spread_str = f"{m.market_spread:+.1f}" if m.market_spread != 0 else "PK"
        proj_spread_str = f"{report.projected_spread:+.1f}"
        win_prob_str = f"{report.home_win_prob*100:.0f}% / {report.away_win_prob*100:.0f}%"
        sig_str = f"{report.primary_bet_signal.value}"
        if report.best_bet and report.best_bet.is_actionable:
            sig_str = f"{report.best_bet.signal_tier.value} ({report.best_bet.ev_percent:+.1f}%)"

        status_display = "🔒 LOCKED" if is_already_locked else ("🔒 LOCKING" if is_lockdown else sig_str)
        print(f"{m.away_team[:15]} @ {m.home_team[:15]:<15} | {mkt_spread_str:<11} | {proj_spread_str:<12} | {m.market_total:<8.1f} | {report.projected_total:<9.1f} | {win_prob_str:<15} | {status_display:<15}")

        # If already locked, do NOT overwrite the official snapshot in Firestore
        if is_already_locked:
            logger.info(f"🔒 [LOCKOUT ENFORCED] {m.away_team} @ {m.home_team} is already FROZEN. Preserving official snapshot.")
            continue

        is_frozen = is_lockdown
        frozen_at = datetime.now(timezone.utc).isoformat() if is_frozen else None

        # SharpSim Firestore Schema for model_predictions
        pred_doc = {
            "gameId": m.game_id,
            "sport": "NFL",
            "homeTeam": m.home_team,
            "awayTeam": m.away_team,
            "homeAbbr": m.home_abbr,
            "awayAbbr": m.away_abbr,
            "startTime": m.start_time,
            "snapshotTime": datetime.now(timezone.utc).isoformat(),
            "marketSpread": m.market_spread,
            "spreadSource": "Consensus",
            "projectedSpread": report.projected_spread,
            "spreadEdge": report.spread_edge_points,
            "marketTotal": m.market_total,
            "projectedTotal": report.projected_total,
            "totalEdge": report.total_edge_points,
            "zScore": report.z_score,
            "betSignal": report.primary_bet_signal.value,
            "recommendedSide": report.recommended_side or m.home_team,
            "confidence": "High" if report.primary_bet_signal in [BetSignalTier.ELITE_VALUE, BetSignalTier.STRONG_VALUE] else ("Moderate" if report.primary_bet_signal == BetSignalTier.PLAYABLE else "Low"),
            "status": "pending",
            "isFrozen": is_frozen,
            "frozenAt": frozen_at,
            "actualScore": None,
            "actualSpread": None,
            "correct": None,
            "predictedHomeScore": report.projected_home_score,
            "predictedAwayScore": report.projected_away_score,
            "winProbHome": round(report.home_win_prob * 100, 1),
            "winProbAway": round(report.away_win_prob * 100, 1),
            "pHomeCover": round(sim.p_home_cover * 100, 1),
            "pAwayCover": round(sim.p_away_cover * 100, 1),
            "pSpreadPush": round(sim.p_spread_push * 100, 1),
            "pOver": round(sim.p_over * 100, 1),
            "pUnder": round(sim.p_under * 100, 1),
            "bestBetSelection": report.best_bet.selection if report.best_bet else "No Play",
            "bestBetEV": report.best_bet.ev_percent if report.best_bet else 0.0,
            "quarterKellyPct": report.best_bet.quarter_kelly_pct if report.best_bet else 0.0,
            "weatherVenue": m.weather.venue_name,
            "weatherWindMph": m.weather.wind_mph,
            "weatherIsDome": m.weather.is_dome,
        }
        firestore_predictions.append(pred_doc)

        # Standard daily_games record
        # Mock bookmaker JSON matching Odds API format
        bookmaker_obj = {
            "key": "consensus",
            "title": "Consensus",
            "markets": [
                {
                    "key": "spreads",
                    "outcomes": [
                        {"name": m.home_team, "point": m.market_spread, "price": m.spread_home_odds},
                        {"name": m.away_team, "point": -m.market_spread, "price": m.spread_away_odds}
                    ]
                },
                {
                    "key": "totals",
                    "outcomes": [
                        {"name": "Over", "point": m.market_total, "price": m.total_over_odds},
                        {"name": "Under", "point": m.market_total, "price": m.total_under_odds}
                    ]
                },
                {
                    "key": "h2h",
                    "outcomes": [
                        {"name": m.home_team, "price": m.market_moneyline_home},
                        {"name": m.away_team, "price": m.market_moneyline_away}
                    ]
                }
            ]
        }
        daily_doc = {
            "id": m.game_id,
            "sportKey": "americanfootball_nfl",
            "commenceTime": m.start_time,
            "homeTeam": m.home_team,
            "awayTeam": m.away_team,
            "bookmakerOdds": [json.dumps(bookmaker_obj)],
        }
        daily_games_docs.append(daily_doc)

        # Record diagnostic report entry
        diagnostics.append({
            "game_id": m.game_id,
            "matchup": m.away_team + " @ " + m.home_team,
            "home_team": m.home_team,
            "away_team": m.away_team,
            "start_time": m.start_time,
            "week": m.week,
            "consensus_spread": m.market_spread,
            "projected_spread": report.projected_spread,
            "spread_edge": report.spread_edge_points,
            "consensus_total": m.market_total,
            "projected_total": report.projected_total,
            "total_edge": report.total_edge_points,
            "home_win_prob": round(report.home_win_prob * 100, 1),
            "away_win_prob": round(report.away_win_prob * 100, 1),
            "primary_signal": report.primary_bet_signal.value,
            "recommended_side": report.recommended_side,
            "best_bet": {
                "selection": report.best_bet.selection if report.best_bet else None,
                "market_type": report.best_bet.market_type if report.best_bet else None,
                "ev_percent": report.best_bet.ev_percent if report.best_bet else None,
                "quarter_kelly": report.best_bet.quarter_kelly_pct if report.best_bet else None,
                "signal_tier": report.best_bet.signal_tier.value if report.best_bet else None,
                "rationale": report.best_bet.rationale if report.best_bet else None,
            } if report.best_bet else None,
            "all_signals": [
                {
                    "selection": s.selection,
                    "market": s.market_type,
                    "ev": s.ev_percent,
                    "p_win": round(s.p_win * 100, 1),
                    "signal": s.signal_tier.value,
                    "actionable": s.is_actionable,
                }
                for s in report.all_signals
            ],
            "key_number_shares": sim.key_number_shares,
            "edge_crosses_primary_key": sim.edge_crosses_primary_key,
            "components": {
                "home_epa_pts": handicap.home.projected_offensive_points,
                "away_epa_pts": handicap.away.projected_offensive_points,
                "hca_pts": handicap.hca_points,
                "situational_hca_breakdown": handicap.situational_breakdown,
                "weather_points_deduction": handicap.weather_points_delta,
                "home_injuries": m.home_injuries.injury_descriptions,
                "away_injuries": m.away_injuries.injury_descriptions,
            }
        })

    print("-" * 110)

    # 4. Save to Firestore
    if auth_token:
        logger.info("💾 Persisting predictions to Firestore collection 'model_predictions'...")
        saved_count = 0
        for p in firestore_predictions:
            try:
                save_firestore_doc("model_predictions", p["gameId"], p, auth_token)
                saved_count += 1
            except Exception as e:
                logger.warning(f"Failed to save {p['gameId']} to model_predictions: {e}")
        logger.info(f"✅ Successfully wrote {saved_count} predictions to 'model_predictions'.")

        logger.info("💾 Persisting daily odds to Firestore collection 'daily_games'...")
        dg_count = 0
        for d in daily_games_docs:
            try:
                save_firestore_doc("daily_games", d["id"], d, auth_token)
                dg_count += 1
            except Exception as e:
                logger.warning(f"Failed to save {d['id']} to daily_games: {e}")
        logger.info(f"✅ Successfully wrote {dg_count} fixtures to 'daily_games'.")

    # 5. Save local JSON artifact
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "nfl_projections.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "sport": "NFL",
                "simulations_per_game": 25000,
                "total_games": len(diagnostics),
                "games": diagnostics,
            },
            f,
            indent=2
        )
    logger.info(f"📁 Saved JSON projections report to {out_path}")

    # Summary of actionable bets
    actionable_bets = [d for d in diagnostics if d.get("best_bet") and d["best_bet"].get("signal_tier") != "No Play"]
    print(f"\n🎯 ACTIONABLE +EV BETS IDENTIFIED: {len(actionable_bets)}")
    for ab in actionable_bets:
        bb = ab["best_bet"]
        print(f"  ⭐ {bb['selection']:<25} | EV: {bb['ev_percent']:+.2f}% | Quarter-Kelly: {bb['quarter_kelly']:.2f}% | Tier: {bb['signal_tier']}")
        print(f"     Analysis: {bb['rationale']}")

    print("\n🏁 NFL Engine Execution Complete.")


if __name__ == "__main__":
    main()
