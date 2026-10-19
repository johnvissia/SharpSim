"""
signals.py
----------
Expected Value (+EV) Signal Generation & Quarter-Kelly Staking for NFL.
Implements:
- EV = (P_win * Decimal_Payout) - (1 - P_win)
- Exact push adjustments on key numbers
- Rigorous key-numbers variance filtering:
    Only flags a selection as actionable if EV >= +2.5% AND the edge possesses
    sufficient margin equity across discrete key numbers.
- Signal tiers:
    ELITE VALUE  : EV >= +6.0%
    STRONG VALUE : EV in [+4.0%, +6.0%)
    PLAYABLE     : EV in [+2.5%, +4.0%)
    No Play      : EV < +2.5%
- Quarter-Kelly staking sizing
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional
from simulation import SimulationSummary


class BetSignalTier(str, Enum):
    ELITE_VALUE = "ELITE VALUE"
    STRONG_VALUE = "STRONG VALUE"
    PLAYABLE = "PLAYABLE"
    NO_PLAY = "No Play"


@dataclass
class MarketBetSignal:
    market_type: str         # "spread" | "moneyline" | "total"
    selection: str           # e.g. "Detroit Lions -2.5" or "Over 43.5"
    team_or_side: str        # e.g. "Detroit Lions", "Over"
    market_line: float       # -2.5 or 43.5
    projected_line: float    # -5.4 or 46.2
    edge_points: float       # Projected vs Market point difference
    american_odds: int       # e.g. -110
    decimal_odds: float      # e.g. 1.909
    p_win: float             # Model win probability
    p_push: float            # Model push probability
    p_loss: float            # Model loss probability
    ev_percent: float        # Expected Value in % (e.g. +4.8%)
    is_actionable: bool      # EV >= +2.5% and passes key number test
    signal_tier: BetSignalTier
    quarter_kelly_pct: float # Suggested bankroll stake %
    rationale: str


@dataclass
class MatchupPredictionReport:
    game_id: str
    matchup: str
    home_team: str
    away_team: str
    start_time: str
    week: int
    projected_home_score: float
    projected_away_score: float
    projected_spread: float
    market_spread: float
    spread_edge_points: float
    projected_total: float
    market_total: float
    total_edge_points: float
    home_win_prob: float
    away_win_prob: float
    recommended_side: Optional[str]
    primary_bet_signal: BetSignalTier
    z_score: float
    best_bet: Optional[MarketBetSignal]
    all_signals: List[MarketBetSignal] = field(default_factory=list)


def american_to_decimal(american: int) -> float:
    """Convert American odds to decimal payout multiplier."""
    if american > 0:
        return 1.0 + (american / 100.0)
    elif american < 0:
        return 1.0 + (100.0 / abs(american))
    return 1.9091  # Default -110 if 0


def calculate_ev(p_win: float, p_loss: float, decimal_odds: float) -> float:
    """
    Calculate Expected Value (+EV) accounting for push:
    EV = P_win * (Decimal_Odds - 1) - P_loss * 1.0
    If no push (p_loss = 1 - p_win), matches: (P_win * b) - (1 - P_win).
    """
    net_payout = decimal_odds - 1.0
    return (p_win * net_payout) - (p_loss * 1.0)


def calculate_quarter_kelly(ev: float, decimal_odds: float) -> float:
    """
    Quarter-Kelly criterion stake fraction:
    f* = EV / b
    quarter_kelly = 0.25 * f*
    Capped at 5.0% of bankroll.
    """
    if ev <= 0:
        return 0.0
    b = decimal_odds - 1.0
    if b <= 0:
        return 0.0
    full_kelly = ev / b
    qk = max(0.0, min(0.05, 0.25 * full_kelly))
    return round(qk * 100, 2)  # Return as percentage (e.g. 1.25%)


def evaluate_betting_signals(
    sim: SimulationSummary,
    game_id: str,
    start_time: str,
    week: int,
    spread_h_odds: int = -110,
    spread_a_odds: int = -110,
    total_o_odds: int = -110,
    total_u_odds: int = -110,
    ml_h_odds: int = -135,
    ml_a_odds: int = 115,
) -> MatchupPredictionReport:
    """
    Evaluate all betting markets (Spread, Total, Moneyline) for a matchup,
    enforcing key numbers threshold and +EV mandates.
    """
    signals: List[MarketBetSignal] = []

    # 1. EVALUATE SPREAD BETS
    dec_h_spread = american_to_decimal(spread_h_odds)
    dec_a_spread = american_to_decimal(spread_a_odds)

    # Home Spread
    ev_h_spread = calculate_ev(sim.p_home_cover, sim.p_away_cover, dec_h_spread)
    # Away Spread
    ev_a_spread = calculate_ev(sim.p_away_cover, sim.p_home_cover, dec_a_spread)

    # Spread points edge (MarketSpread - ProjectedSpread)
    # e.g. Market +3.5, Projected -1.5 -> edge +5.0 in home direction
    h_spread_edge = sim.market_spread - sim.projected_spread
    a_spread_edge = -h_spread_edge

    # Key Numbers Awareness check:
    # An edge between -4.5 and -5.5 spans only dead numbers (5), whereas an edge
    # crossing 3.0 or 7.0 captures immense probability density (15.4% on 3, 9.3% on 7).
    # Require greater margin equity to cross primary key numbers.
    def is_spread_edge_valid(edge_pts: float, ev: float, p_win: float) -> bool:
        if ev < 0.025:
            return False
        # If edge does not cross key numbers and is small (< 1.5 pts), filter as empty variance
        if abs(edge_pts) < 1.4 and not sim.edge_crosses_primary_key:
            return False
        return True

    # Build Home Spread Signal
    h_sign_tier = BetSignalTier.NO_PLAY
    h_actionable = is_spread_edge_valid(h_spread_edge, ev_h_spread, sim.p_home_cover)
    if h_actionable:
        if ev_h_spread >= 0.060:
            h_sign_tier = BetSignalTier.ELITE_VALUE
        elif ev_h_spread >= 0.040:
            h_sign_tier = BetSignalTier.STRONG_VALUE
        else:
            h_sign_tier = BetSignalTier.PLAYABLE

    h_spread_str = f"+{sim.market_spread}" if sim.market_spread > 0 else (f"{sim.market_spread}" if sim.market_spread < 0 else "PK")
    signals.append(MarketBetSignal(
        market_type="spread",
        selection=f"{sim.home_team} {h_spread_str}",
        team_or_side=sim.home_team,
        market_line=sim.market_spread,
        projected_line=sim.projected_spread,
        edge_points=round(h_spread_edge, 2),
        american_odds=spread_h_odds,
        decimal_odds=round(dec_h_spread, 3),
        p_win=sim.p_home_cover,
        p_push=sim.p_spread_push,
        p_loss=sim.p_away_cover,
        ev_percent=round(ev_h_spread * 100, 2),
        is_actionable=h_actionable,
        signal_tier=h_sign_tier,
        quarter_kelly_pct=calculate_quarter_kelly(ev_h_spread, dec_h_spread),
        rationale=(
            f"Model projects {sim.projected_spread:+.1f} vs market {sim.market_spread:+.1f} "
            f"({h_spread_edge:+.1f} pt edge). P(Cover)={sim.p_home_cover*100:.1f}%, EV={ev_h_spread*100:+.1f}%."
            + (" Crosses Key Number 3/7." if sim.edge_crosses_primary_key and h_spread_edge > 0 else "")
        )
    ))

    # Build Away Spread Signal
    a_sign_tier = BetSignalTier.NO_PLAY
    a_actionable = is_spread_edge_valid(a_spread_edge, ev_a_spread, sim.p_away_cover)
    if a_actionable:
        if ev_a_spread >= 0.060:
            a_sign_tier = BetSignalTier.ELITE_VALUE
        elif ev_a_spread >= 0.040:
            a_sign_tier = BetSignalTier.STRONG_VALUE
        else:
            a_sign_tier = BetSignalTier.PLAYABLE

    a_line_inv = -sim.market_spread
    a_spread_str = f"+{a_line_inv}" if a_line_inv > 0 else (f"{a_line_inv}" if a_line_inv < 0 else "PK")
    signals.append(MarketBetSignal(
        market_type="spread",
        selection=f"{sim.away_team} {a_spread_str}",
        team_or_side=sim.away_team,
        market_line=a_line_inv,
        projected_line=-sim.projected_spread,
        edge_points=round(a_spread_edge, 2),
        american_odds=spread_a_odds,
        decimal_odds=round(dec_a_spread, 3),
        p_win=sim.p_away_cover,
        p_push=sim.p_spread_push,
        p_loss=sim.p_home_cover,
        ev_percent=round(ev_a_spread * 100, 2),
        is_actionable=a_actionable,
        signal_tier=a_sign_tier,
        quarter_kelly_pct=calculate_quarter_kelly(ev_a_spread, dec_a_spread),
        rationale=(
            f"Model projects {-sim.projected_spread:+.1f} vs market {a_line_inv:+.1f} "
            f"({a_spread_edge:+.1f} pt edge). P(Cover)={sim.p_away_cover*100:.1f}%, EV={ev_a_spread*100:+.1f}%."
            + (" Crosses Key Number 3/7." if sim.edge_crosses_primary_key and a_spread_edge > 0 else "")
        )
    ))

    # 2. EVALUATE TOTALS BETS (Over / Under)
    dec_over = american_to_decimal(total_o_odds)
    dec_under = american_to_decimal(total_u_odds)

    ev_over = calculate_ev(sim.p_over, sim.p_under, dec_over)
    ev_under = calculate_ev(sim.p_under, sim.p_over, dec_under)
    total_edge_over = sim.mean_total - sim.market_total
    total_edge_under = -total_edge_over

    # Over Signal
    over_tier = BetSignalTier.NO_PLAY
    over_actionable = (ev_over >= 0.025) and (abs(total_edge_over) >= 1.5)
    if over_actionable:
        if ev_over >= 0.060:
            over_tier = BetSignalTier.ELITE_VALUE
        elif ev_over >= 0.040:
            over_tier = BetSignalTier.STRONG_VALUE
        else:
            over_tier = BetSignalTier.PLAYABLE

    signals.append(MarketBetSignal(
        market_type="total",
        selection=f"Over {sim.market_total}",
        team_or_side="Over",
        market_line=sim.market_total,
        projected_line=sim.mean_total,
        edge_points=round(total_edge_over, 2),
        american_odds=total_o_odds,
        decimal_odds=round(dec_over, 3),
        p_win=sim.p_over,
        p_push=sim.p_total_push,
        p_loss=sim.p_under,
        ev_percent=round(ev_over * 100, 2),
        is_actionable=over_actionable,
        signal_tier=over_tier,
        quarter_kelly_pct=calculate_quarter_kelly(ev_over, dec_over),
        rationale=f"Model projects {sim.mean_total:.1f} total pts vs market {sim.market_total:.1f}. EV={ev_over*100:+.1f}%."
    ))

    # Under Signal
    under_tier = BetSignalTier.NO_PLAY
    under_actionable = (ev_under >= 0.025) and (abs(total_edge_under) >= 1.5)
    if under_actionable:
        if ev_under >= 0.060:
            under_tier = BetSignalTier.ELITE_VALUE
        elif ev_under >= 0.040:
            under_tier = BetSignalTier.STRONG_VALUE
        else:
            under_tier = BetSignalTier.PLAYABLE

    signals.append(MarketBetSignal(
        market_type="total",
        selection=f"Under {sim.market_total}",
        team_or_side="Under",
        market_line=sim.market_total,
        projected_line=sim.mean_total,
        edge_points=round(total_edge_under, 2),
        american_odds=total_u_odds,
        decimal_odds=round(dec_under, 3),
        p_win=sim.p_under,
        p_push=sim.p_total_push,
        p_loss=sim.p_over,
        ev_percent=round(ev_under * 100, 2),
        is_actionable=under_actionable,
        signal_tier=under_tier,
        quarter_kelly_pct=calculate_quarter_kelly(ev_under, dec_under),
        rationale=f"Model projects {sim.mean_total:.1f} total pts vs market {sim.market_total:.1f}. EV={ev_under*100:+.1f}%."
    ))

    # 3. EVALUATE MONEYLINE BETS
    dec_ml_h = american_to_decimal(ml_h_odds)
    dec_ml_a = american_to_decimal(ml_a_odds)
    ev_ml_h = calculate_ev(sim.p_home_win, sim.p_away_win + sim.p_tie_regulation, dec_ml_h)
    ev_ml_a = calculate_ev(sim.p_away_win, sim.p_home_win + sim.p_tie_regulation, dec_ml_a)

    if ev_ml_h >= 0.025:
        signals.append(MarketBetSignal(
            market_type="moneyline",
            selection=f"{sim.home_team} ML ({ml_h_odds:+d})",
            team_or_side=sim.home_team,
            market_line=float(ml_h_odds),
            projected_line=round(sim.p_home_win * 100, 1),
            edge_points=round((sim.p_home_win - (1.0 / dec_ml_h)) * 100, 1),
            american_odds=ml_h_odds,
            decimal_odds=round(dec_ml_h, 3),
            p_win=sim.p_home_win,
            p_push=sim.p_tie_regulation,
            p_loss=sim.p_away_win,
            ev_percent=round(ev_ml_h * 100, 2),
            is_actionable=True,
            signal_tier=BetSignalTier.ELITE_VALUE if ev_ml_h >= 0.06 else (BetSignalTier.STRONG_VALUE if ev_ml_h >= 0.04 else BetSignalTier.PLAYABLE),
            quarter_kelly_pct=calculate_quarter_kelly(ev_ml_h, dec_ml_h),
            rationale=f"Model win prob {sim.p_home_win*100:.1f}% vs implied {100/dec_ml_h:.1f}%. EV={ev_ml_h*100:+.1f}%."
        ))

    if ev_ml_a >= 0.025:
        signals.append(MarketBetSignal(
            market_type="moneyline",
            selection=f"{sim.away_team} ML ({ml_a_odds:+d})",
            team_or_side=sim.away_team,
            market_line=float(ml_a_odds),
            projected_line=round(sim.p_away_win * 100, 1),
            edge_points=round((sim.p_away_win - (1.0 / dec_ml_a)) * 100, 1),
            american_odds=ml_a_odds,
            decimal_odds=round(dec_ml_a, 3),
            p_win=sim.p_away_win,
            p_push=sim.p_tie_regulation,
            p_loss=sim.p_home_win,
            ev_percent=round(ev_ml_a * 100, 2),
            is_actionable=True,
            signal_tier=BetSignalTier.ELITE_VALUE if ev_ml_a >= 0.06 else (BetSignalTier.STRONG_VALUE if ev_ml_a >= 0.04 else BetSignalTier.PLAYABLE),
            quarter_kelly_pct=calculate_quarter_kelly(ev_ml_a, dec_ml_a),
            rationale=f"Model win prob {sim.p_away_win*100:.1f}% vs implied {100/dec_ml_a:.1f}%. EV={ev_ml_a*100:+.1f}%."
        ))

    # Determine Best Overall Bet and Primary Side Recommendation
    actionable_signals = [s for s in signals if s.is_actionable]
    actionable_signals.sort(key=lambda s: s.ev_percent, reverse=True)
    best_bet = actionable_signals[0] if actionable_signals else None

    # Z-Score of the Spread Edge (NFL margin std dev ≈ 13.8)
    nfl_spread_sd = 13.8
    z_score = round(abs(h_spread_edge) / nfl_spread_sd, 3)

    # Primary recommended side and signal tier for SharpSim dashboard
    rec_side: Optional[str] = None
    top_tier = BetSignalTier.NO_PLAY

    if h_spread_edge > 0 and h_actionable:
        rec_side = sim.home_team
        top_tier = h_sign_tier
    elif a_spread_edge > 0 and a_actionable:
        rec_side = sim.away_team
        top_tier = a_sign_tier
    elif best_bet and best_bet.market_type == "spread":
        rec_side = best_bet.team_or_side
        top_tier = best_bet.signal_tier
    else:
        # Fallback to model lean if spread margin is noticeable
        if h_spread_edge >= 1.5:
            rec_side = sim.home_team
        elif a_spread_edge >= 1.5:
            rec_side = sim.away_team
        else:
            rec_side = None

    return MatchupPredictionReport(
        game_id=game_id,
        matchup=sim.matchup,
        home_team=sim.home_team,
        away_team=sim.away_team,
        start_time=start_time,
        week=week,
        projected_home_score=sim.mean_home_score,
        projected_away_score=sim.mean_away_score,
        projected_spread=sim.projected_spread,
        market_spread=sim.market_spread,
        spread_edge_points=round(h_spread_edge, 2),
        projected_total=sim.mean_total,
        market_total=sim.market_total,
        total_edge_points=round(total_edge_over, 2),
        home_win_prob=sim.p_home_win,
        away_win_prob=sim.p_away_win,
        recommended_side=rec_side,
        primary_bet_signal=top_tier,
        z_score=z_score,
        best_bet=best_bet,
        all_signals=signals
    )
