"""
test_nfl_engine.py
------------------
Comprehensive unit tests for the SharpSim NFL Predictive Simulation Model.
Validates:
1. Team name & abbreviation resolution (e.g. 'DET' -> 'Detroit Lions')
2. Opponent-adjusted EPA handicapping & QB downgrade calculations
3. Situational context (short rest, travel, altitude, indoor/outdoor)
4. Environmental wind degradation (>= 15 mph rules)
5. Monte Carlo simulation mechanics and key numbers clustering (3, 7, 6, 10)
6. Expected Value (+EV) calculation & Quarter-Kelly staking
"""

import sys
import os
import pytest
import numpy as np

current_dir = os.path.dirname(os.path.abspath(__file__))
model_dir = os.path.dirname(current_dir)
if model_dir not in sys.path:
    sys.path.insert(0, model_dir)

# Clean out any shadowed modules from other models (e.g. epl_model)
for mod in ["data_loader", "handicapper", "simulation", "signals"]:
    if mod in sys.modules:
        del sys.modules[mod]

from data_loader import (
    NFL_BASELINES,
    NFL_TEAM_ABBR_TO_NAME,
    canonical_abbr,
    canonical_name,
    build_weather_context,
    parse_team_injuries,
    MatchupInjuryContext,
    MatchupWeatherContext,
    NFLMatchupData,
)
from handicapper import NFLHandicapper, MatchupHandicapResult
from simulation import NFLMonteCarloEngine, KEY_NUMBERS
from signals import (
    calculate_ev,
    calculate_quarter_kelly,
    american_to_decimal,
    evaluate_betting_signals,
    BetSignalTier,
)


def test_canonical_team_mappings():
    """Verify team naming conventions and abbreviations align with project standards."""
    assert canonical_abbr("DET") == "DET"
    assert canonical_abbr("Detroit Lions") == "DET"
    assert canonical_abbr("Lions") == "DET"
    assert canonical_name("DET") == "Detroit Lions"

    assert canonical_abbr("KC") == "KC"
    assert canonical_abbr("Kansas City Chiefs") == "KC"
    assert canonical_abbr("Chiefs") == "KC"
    assert canonical_name("KC") == "Kansas City Chiefs"

    assert canonical_abbr("SF") == "SF"
    assert canonical_abbr("San Francisco 49ers") == "SF"
    assert canonical_abbr("Niners") == "SF"

    assert len(NFL_BASELINES) == 32


def test_qb_downgrade_penalty():
    """Verify strict QB downgrade rules (-3.0 to -7.5 pts depending on Tier)."""
    kc = NFL_BASELINES["KC"]
    assert kc.qb.starter_tier == 1
    assert kc.qb.downgrade_points >= 6.0  # Mahomes Tier 1 downgrade

    det = NFL_BASELINES["DET"]
    assert det.qb.starter_tier == 2
    assert 4.5 <= det.qb.downgrade_points <= 6.0  # Goff Tier 2 downgrade

    mock_injuries = [
        {"name": "Patrick Mahomes", "position": "QB", "status": "Out", "description": "High ankle sprain"}
    ]
    parsed = parse_team_injuries("KC", mock_injuries, kc)
    assert parsed.starter_qb_out is True
    assert parsed.qb_downgrade >= 6.0


def test_offensive_line_cluster_injuries():
    """Verify offensive line cluster injury adjustments."""
    det = NFL_BASELINES["DET"]
    # 3 missing offensive linemen
    mock_ol_injuries = [
        {"name": "Penei Sewell", "position": "OT", "status": "Out", "description": "Ankle"},
        {"name": "Taylor Decker", "position": "T", "status": "Out", "description": "Shoulder"},
        {"name": "Frank Ragnow", "position": "C", "status": "Out", "description": "Pectoral"}
    ]
    parsed = parse_team_injuries("DET", mock_ol_injuries, det)
    assert parsed.missing_ol_starters == 3
    assert parsed.ol_penalty == 2.25


def test_wind_degradation_rules():
    """Verify wind >= 15 mph depresses passing volume and total points."""
    stadium = NFL_BASELINES["CLE"].stadium  # Cleveland outdoor stadium
    weather_calm = MatchupWeatherContext(
        venue_name="Huntington Bank Field",
        is_dome=False,
        wind_mph=8.0,
        wind_depressed_pass=0.0,
        wind_depressed_total=0.0
    )
    weather_high_wind = MatchupWeatherContext(
        venue_name="Huntington Bank Field",
        is_dome=False,
        wind_mph=24.0,
        wind_depressed_pass=min(0.35, (24.0 - 14.0) * 0.025),
        wind_depressed_total=round((24.0 - 14.0) * 0.22, 2)
    )

    assert weather_high_wind.wind_depressed_pass > 0.15
    assert weather_high_wind.wind_depressed_total >= 2.0

    matchup_calm = NFLMatchupData(
        game_id="BAL@CLE",
        home_abbr="CLE", away_abbr="BAL",
        home_team="Cleveland Browns", away_team="Baltimore Ravens",
        start_time="2026-10-18T17:00:00Z", week=7,
        is_short_rest=False, travel_timezone_diff=0, is_international=False,
        market_spread=3.0, market_total=40.0,
        market_moneyline_home=140, market_moneyline_away=-165,
        spread_home_odds=-110, spread_away_odds=-110,
        total_over_odds=-110, total_under_odds=-110,
        weather=weather_calm,
        home_injuries=MatchupInjuryContext(), away_injuries=MatchupInjuryContext()
    )
    matchup_wind = NFLMatchupData(
        game_id="BAL@CLE",
        home_abbr="CLE", away_abbr="BAL",
        home_team="Cleveland Browns", away_team="Baltimore Ravens",
        start_time="2026-10-18T17:00:00Z", week=7,
        is_short_rest=False, travel_timezone_diff=0, is_international=False,
        market_spread=3.0, market_total=40.0,
        market_moneyline_home=140, market_moneyline_away=-165,
        spread_home_odds=-110, spread_away_odds=-110,
        total_over_odds=-110, total_under_odds=-110,
        weather=weather_high_wind,
        home_injuries=MatchupInjuryContext(), away_injuries=MatchupInjuryContext()
    )

    h_calm = NFLHandicapper.handicap_matchup(matchup_calm)
    h_wind = NFLHandicapper.handicap_matchup(matchup_wind)

    # Wind must depress projected total
    assert h_wind.projected_total < h_calm.projected_total
    assert h_wind.weather_points_delta >= 2.0


def test_situational_short_rest_and_travel():
    """Verify Thursday short rest and travel adjustments."""
    weather = MatchupWeatherContext("Lumen Field", False, 60.0, 5.0)
    normal_matchup = NFLMatchupData(
        game_id="LAR@SEA", home_abbr="SEA", away_abbr="LAR",
        home_team="Seattle Seahawks", away_team="Los Angeles Rams",
        start_time="2026-10-18T20:00:00Z", week=7,
        is_short_rest=False, travel_timezone_diff=0, is_international=False,
        market_spread=-2.5, market_total=47.0,
        market_moneyline_home=-135, market_moneyline_away=115,
        spread_home_odds=-110, spread_away_odds=-110,
        total_over_odds=-110, total_under_odds=-110,
        weather=weather,
        home_injuries=MatchupInjuryContext(), away_injuries=MatchupInjuryContext()
    )
    short_rest_matchup = NFLMatchupData(
        game_id="LAR@SEA", home_abbr="SEA", away_abbr="LAR",
        home_team="Seattle Seahawks", away_team="Los Angeles Rams",
        start_time="2026-10-15T20:15:00Z", week=7,
        is_short_rest=True, travel_timezone_diff=0, is_international=False,
        market_spread=-2.5, market_total=47.0,
        market_moneyline_home=-135, market_moneyline_away=115,
        spread_home_odds=-110, spread_away_odds=-110,
        total_over_odds=-110, total_under_odds=-110,
        weather=weather,
        home_injuries=MatchupInjuryContext(), away_injuries=MatchupInjuryContext()
    )

    h_norm = NFLHandicapper.handicap_matchup(normal_matchup)
    h_short = NFLHandicapper.handicap_matchup(short_rest_matchup)

    # Short rest increases home field advantage
    assert h_short.hca_points > h_norm.hca_points


def test_monte_carlo_discrete_scoring_and_key_numbers():
    """Verify Monte Carlo simulation correctly samples discrete scores and key numbers."""
    engine = NFLMonteCarloEngine(n_simulations=5000, random_seed=99)
    weather = MatchupWeatherContext("Ford Field", True, 72.0, 0.0)
    matchup = NFLMatchupData(
        game_id="MIN@DET", home_abbr="DET", away_abbr="MIN",
        home_team="Detroit Lions", away_team="Minnesota Vikings",
        start_time="2026-10-18T17:00:00Z", week=7,
        is_short_rest=False, travel_timezone_diff=1, is_international=False,
        market_spread=-3.0, market_total=48.5,
        market_moneyline_home=-160, market_moneyline_away=135,
        spread_home_odds=-110, spread_away_odds=-110,
        total_over_odds=-110, total_under_odds=-110,
        weather=weather,
        home_injuries=MatchupInjuryContext(), away_injuries=MatchupInjuryContext()
    )
    handicap = NFLHandicapper.handicap_matchup(matchup)
    sim = engine.simulate_matchup(handicap, market_spread=-3.0, market_total=48.5)

    # Key numbers frequencies should be positive and prominent on 3 and 7
    assert sim.key_number_shares[3] > 0.05
    assert sim.key_number_shares[7] > 0.03
    assert sim.p_home_cover + sim.p_away_cover + sim.p_spread_push == pytest.approx(1.0, abs=1e-3)
    assert sim.p_spread_push > 0.025  # Push on -3.0 should be significant in NFL


def test_ev_and_quarter_kelly():
    """Verify EV = (P_win * Decimal_Payout) - (1 - P_win) and Kelly sizing."""
    # Fair coin toss at +100 (decimal 2.0) has 0% EV
    assert calculate_ev(p_win=0.50, p_loss=0.50, decimal_odds=2.0) == pytest.approx(0.0)

    # 55% win rate at -110 (decimal 1.9091)
    # Net payout = 0.9091, Loss = 0.45
    # EV = 0.55 * 0.9091 - 0.45 = 0.5000 - 0.45 = +0.05 (+5.0% EV)
    ev = calculate_ev(p_win=0.55, p_loss=0.45, decimal_odds=1.9091)
    assert ev == pytest.approx(0.05, abs=1e-3)

    # Kelly sizing:
    # Full Kelly = EV / b = 0.05 / 0.9091 = 0.055
    # Quarter Kelly = 0.25 * 0.055 = ~1.375%
    qk = calculate_quarter_kelly(ev, 1.9091)
    assert 1.2 <= qk <= 1.5


def test_actionable_bet_threshold():
    """Verify only bets with EV >= +2.5% and proper margin equity are flagged as actionable."""
    engine = NFLMonteCarloEngine(n_simulations=3000, random_seed=12)
    weather = MatchupWeatherContext("Arrowhead", False, 65.0, 5.0)
    matchup = NFLMatchupData(
        game_id="LAC@KC", home_abbr="KC", away_abbr="LAC",
        home_team="Kansas City Chiefs", away_team="Los Angeles Chargers",
        start_time="2026-10-18T20:25:00Z", week=7,
        is_short_rest=False, travel_timezone_diff=2, is_international=False,
        market_spread=-7.5, market_total=41.5,
        market_moneyline_home=-350, market_moneyline_away=280,
        spread_home_odds=-110, spread_away_odds=-110,
        total_over_odds=-110, total_under_odds=-110,
        weather=weather,
        home_injuries=MatchupInjuryContext(), away_injuries=MatchupInjuryContext()
    )
    handicap = NFLHandicapper.handicap_matchup(matchup)
    sim = engine.simulate_matchup(handicap, market_spread=-7.5, market_total=41.5)
    report = evaluate_betting_signals(sim, matchup.game_id, matchup.start_time, matchup.week)

    for sig in report.all_signals:
        if sig.is_actionable:
            assert sig.ev_percent >= 2.5
            assert sig.signal_tier in [BetSignalTier.ELITE_VALUE, BetSignalTier.STRONG_VALUE, BetSignalTier.PLAYABLE]
        else:
            assert sig.signal_tier == BetSignalTier.NO_PLAY or sig.ev_percent < 2.5
