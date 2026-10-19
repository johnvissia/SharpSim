"""
signals.py
----------
Betting signal generation, Quarter-Kelly staking, and walk-forward backtesting.

Signal tiers (by edge = p_model * odds - 1):
    NO_BET       : edge <  4%
    VALUE        : edge in [4%, 8%)
    STRONG_VALUE : edge >= 8%

Quarter-Kelly stake:
    stake_pct = max(0, 0.25 * ((odds - 1) * p - (1 - p)) / (odds - 1))
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import numpy as np
import pandas as pd

from dixon_coles import DixonColesModel, fit_model

logger = logging.getLogger(__name__)


# ─── Signal Enum ──────────────────────────────────────────────────────────────

class Signal(str, Enum):
    NO_BET       = "NO_BET"
    VALUE        = "VALUE"
    STRONG_VALUE = "STRONG_VALUE"


EDGE_VALUE  = 0.04   # 4%
EDGE_STRONG = 0.08   # 8%


# ─── Dataclasses ──────────────────────────────────────────────────────────────

@dataclass
class BetSignal:
    """Betting recommendation for one outcome of a fixture."""
    outcome:         str     # "home" | "draw" | "away"
    signal:          Signal
    p_model:         float   # model's probability for this outcome
    odds_bookmaker:  float   # market decimal odds
    fair_odds:       float   # 1 / p_model
    edge:            float   # (p_model * odds) - 1
    stake_pct:       float   # fraction of bankroll (Quarter-Kelly)
    implied_prob:    float   # 1 / odds_bookmaker


@dataclass
class PredictionResult:
    """Full prediction output for a fixture."""
    home_team:               str
    away_team:               str
    lambda_home:             float
    lambda_away:             float
    p_home:                  float
    p_draw:                  float
    p_away:                  float
    p_over25:                float
    p_under25:               float
    most_likely_home_goals:  int
    most_likely_away_goals:  int
    score_matrix:            list[list[float]]
    signals:                 list[BetSignal]


@dataclass
class BacktestResult:
    """Aggregate metrics from a walk-forward backtest."""
    n_matches:        int
    brier_home:       float
    brier_draw:       float
    brier_away:       float
    brier_avg:        float
    log_loss:         float
    roi_home:         float
    roi_draw:         float
    roi_away:         float
    roi_overall:      float
    total_bets:       int
    winning_bets:     int
    win_rate:         float
    details:          list[dict]


# ─── Quarter-Kelly ────────────────────────────────────────────────────────────

def _quarter_kelly(p: float, odds: float) -> float:
    """
    Quarter-Kelly criterion stake fraction.

    stake_pct = max(0, 0.25 * ((odds - 1) * p - (1 - p)) / (odds - 1))

    Returns 0 if the bet has negative expected value.
    """
    b = odds - 1.0
    if b <= 0.0 or p <= 0.0:
        return 0.0
    kelly_full = (b * p - (1.0 - p)) / b
    return float(max(0.0, 0.25 * kelly_full))


# ─── Signal Generation ────────────────────────────────────────────────────────

def generate_signals(
    p_home: float,
    p_draw: float,
    p_away: float,
    odds_home: Optional[float] = None,
    odds_draw: Optional[float] = None,
    odds_away: Optional[float] = None,
) -> list[BetSignal]:
    """
    Generate BetSignal objects for each outcome where market odds are provided.

    Args:
        p_home, p_draw, p_away: Model probabilities for the three outcomes.
        odds_home, odds_draw, odds_away: Decimal market odds (optional).

    Returns:
        List of BetSignal (one per outcome with valid odds). Always returns all
        three signals (including NO_BET ones) when odds are supplied.
    """
    outcomes = [
        ("home", p_home, odds_home),
        ("draw", p_draw, odds_draw),
        ("away", p_away, odds_away),
    ]
    results: list[BetSignal] = []

    for name, p, odds in outcomes:
        if odds is None or odds <= 1.0 or p <= 0.0:
            continue

        fair    = 1.0 / p
        edge    = (p * odds) - 1.0
        implied = 1.0 / odds

        if edge < EDGE_VALUE:
            sig = Signal.NO_BET
        elif edge < EDGE_STRONG:
            sig = Signal.VALUE
        else:
            sig = Signal.STRONG_VALUE

        stake = _quarter_kelly(p, odds) if sig != Signal.NO_BET else 0.0

        results.append(
            BetSignal(
                outcome=name,
                signal=sig,
                p_model=round(p, 6),
                odds_bookmaker=odds,
                fair_odds=round(fair, 3),
                edge=round(edge, 6),
                stake_pct=round(stake, 6),
                implied_prob=round(implied, 6),
            )
        )

    return results


# ─── Full Prediction ──────────────────────────────────────────────────────────

def predict(
    model: DixonColesModel,
    home: str,
    away: str,
    odds_home: Optional[float] = None,
    odds_draw: Optional[float] = None,
    odds_away: Optional[float] = None,
    max_goals: int = 5,
) -> PredictionResult:
    """
    Generate a complete match prediction, optionally with betting signals.

    Args:
        model:      Fitted DixonColesModel.
        home, away: Team names (must be in model.teams).
        odds_*:     Optional decimal bookmaker odds for signal generation.
        max_goals:  Score matrix dimension (default 5 → 6×6 matrix).

    Returns:
        PredictionResult with xG, probabilities, score matrix, and signals.
    """
    lam, mu           = model.expected_goals(home, away)
    p_home, p_draw, p_away = model.outcome_probs(home, away)
    p_over, p_under   = model.over_under_prob(home, away)
    ml_h, ml_a        = model.most_likely_score(home, away)
    mat               = model.score_matrix(home, away, max_goals=max_goals)

    signals = generate_signals(
        p_home, p_draw, p_away,
        odds_home, odds_draw, odds_away,
    )

    return PredictionResult(
        home_team=home,
        away_team=away,
        lambda_home=round(lam, 4),
        lambda_away=round(mu, 4),
        p_home=round(p_home, 6),
        p_draw=round(p_draw, 6),
        p_away=round(p_away, 6),
        p_over25=round(p_over, 6),
        p_under25=round(p_under, 6),
        most_likely_home_goals=ml_h,
        most_likely_away_goals=ml_a,
        score_matrix=[[round(v, 6) for v in row] for row in mat.tolist()],
        signals=signals,
    )


# ─── Walk-Forward Backtester ──────────────────────────────────────────────────

def _brier(y_true: list[int], y_pred: list[float]) -> float:
    """Binary Brier score: mean((y_true - y_pred)^2)."""
    yt = np.array(y_true, dtype=float)
    yp = np.array(y_pred, dtype=float)
    return float(np.mean((yt - yp) ** 2))


def _log_loss_3way(
    y_true: list[list[int]],
    y_pred: list[list[float]],
    eps: float = 1e-12,
) -> float:
    """
    Multiclass log loss for 3-way outcomes (home/draw/away).
    y_true: [[1,0,0], [0,1,0], ...]
    y_pred: [[p_h, p_d, p_a], ...]
    """
    yt = np.array(y_true, dtype=float)
    yp = np.clip(np.array(y_pred, dtype=float), eps, 1.0)
    yp = yp / yp.sum(axis=1, keepdims=True)   # renormalize
    return float(-np.mean(np.sum(yt * np.log(yp), axis=1)))


def backtest(
    df: pd.DataFrame,
    xi: float = 0.0065,
    min_train_matches: int = 200,
    edge_threshold: float = EDGE_VALUE,
    window_weeks: int = 4,
) -> BacktestResult:
    """
    Walk-forward chronological backtest of the Dixon-Coles model.

    Algorithm:
        1. Sort matches by date.
        2. Find the first date where we have >= min_train_matches prior matches.
        3. Fit the model on all matches before that date.
        4. Predict the next `window_weeks` worth of fixtures.
        5. Roll forward and repeat.

    Metrics:
        • Brier Score (per outcome + average)
        • Log Loss (3-way multiclass)
        • Simulated ROI using Quarter-Kelly staking vs. B365 closing odds

    Args:
        df:                 Historical match DataFrame.
        xi:                 Time-decay rate for model fitting.
        min_train_matches:  Minimum training set size before first prediction.
        edge_threshold:     Minimum edge to place a simulated bet.
        window_weeks:       Rolling window size in weeks.

    Returns:
        BacktestResult with all aggregate metrics and per-match detail.
    """
    df = (
        df.dropna(subset=["date", "home_team", "away_team", "fthg", "ftag"])
        .copy()
    )
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    # ── Rolling windows ───────────────────────────────────────────────────────
    step = pd.Timedelta(weeks=window_weeks)

    # Find the first cut-off date where we have enough training data
    all_dates = df["date"].sort_values().unique()
    if len(df) <= min_train_matches:
        raise RuntimeError(
            f"Dataset ({len(df)} matches) too small for backtest "
            f"(min_train_matches={min_train_matches})."
        )

    first_cut = df.iloc[min_train_matches]["date"]
    current   = first_cut

    # ── Accumulation buffers ──────────────────────────────────────────────────
    y_true_home, y_pred_home = [], []
    y_true_draw, y_pred_draw = [], []
    y_true_away, y_pred_away = [], []
    y_true_3way, y_pred_3way = [], []

    # Bankroll simulation
    bankroll  = {"home": 1000.0, "draw": 1000.0, "away": 1000.0}
    profits   = {"home": 0.0,    "draw": 0.0,    "away": 0.0}
    staked    = {"home": 0.0,    "draw": 0.0,    "away": 0.0}
    total_bets   = 0
    winning_bets = 0
    details: list[dict] = []

    while current < df["date"].max():
        train = df[df["date"] <  current]
        test  = df[(df["date"] >= current) & (df["date"] < current + step)]
        current += step

        if len(train) < min_train_matches or test.empty:
            continue

        # Fit model on this training window
        try:
            m = fit_model(train, xi=xi, max_iter=300)
        except Exception as exc:
            logger.warning("Backtest fit failed at %s: %s", current, exc)
            continue

        for _, row in test.iterrows():
            home = str(row["home_team"])
            away = str(row["away_team"])
            if home not in m.teams or away not in m.teams:
                continue

            fthg = int(row["fthg"])
            ftag = int(row["ftag"])

            if fthg > ftag:
                true_out = "home"
            elif fthg == ftag:
                true_out = "draw"
            else:
                true_out = "away"

            odds_h = row.get("b365h", None) if pd.notna(row.get("b365h")) else None
            odds_d = row.get("b365d", None) if pd.notna(row.get("b365d")) else None
            odds_a = row.get("b365a", None) if pd.notna(row.get("b365a")) else None

            try:
                res = predict(m, home, away, odds_h, odds_d, odds_a)
            except Exception:
                continue

            # Calibration metrics
            y_true_home.append(1 if true_out == "home" else 0)
            y_true_draw.append(1 if true_out == "draw" else 0)
            y_true_away.append(1 if true_out == "away" else 0)
            y_pred_home.append(res.p_home)
            y_pred_draw.append(res.p_draw)
            y_pred_away.append(res.p_away)
            y_true_3way.append([
                1 if true_out == "home" else 0,
                1 if true_out == "draw" else 0,
                1 if true_out == "away" else 0,
            ])
            y_pred_3way.append([res.p_home, res.p_draw, res.p_away])

            # Betting simulation
            signal_map = {s.outcome: s for s in res.signals}
            bet_detail: list[dict] = []
            for out_name in ("home", "draw", "away"):
                sig = signal_map.get(out_name)
                if sig is None or sig.signal == Signal.NO_BET:
                    continue
                if sig.edge < edge_threshold:
                    continue

                amt = bankroll[out_name] * sig.stake_pct
                if amt < 0.50:
                    continue

                staked[out_name] += amt
                total_bets += 1
                won = out_name == true_out
                if won:
                    profit = amt * (sig.odds_bookmaker - 1.0)
                    bankroll[out_name] += profit
                    winning_bets += 1
                else:
                    profit = -amt
                    bankroll[out_name] += profit
                profits[out_name] += profit

                bet_detail.append({
                    "outcome":  out_name,
                    "signal":   sig.signal.value,
                    "edge":     round(sig.edge, 4),
                    "stake":    round(amt, 2),
                    "profit":   round(profit, 2),
                    "won":      won,
                })

            details.append({
                "date":       str(row["date"].date()),
                "home":       home,
                "away":       away,
                "actual":     f"{fthg}-{ftag}",
                "true_out":   true_out,
                "p_home":     round(res.p_home, 4),
                "p_draw":     round(res.p_draw, 4),
                "p_away":     round(res.p_away, 4),
                "bets":       bet_detail,
            })

    if not y_true_home:
        raise RuntimeError(
            "No predictions generated. Dataset may be too small or min_train_matches too high."
        )

    bh   = _brier(y_true_home, y_pred_home)
    bd   = _brier(y_true_draw, y_pred_draw)
    ba   = _brier(y_true_away, y_pred_away)
    bavg = (bh + bd + ba) / 3.0
    ll   = _log_loss_3way(y_true_3way, y_pred_3way)

    def _roi(p: float, s: float) -> float:
        return round(p / s, 4) if s > 1e-9 else 0.0

    total_profit = sum(profits.values())
    total_staked = sum(staked.values())

    return BacktestResult(
        n_matches=len(details),
        brier_home=round(bh, 6),
        brier_draw=round(bd, 6),
        brier_away=round(ba, 6),
        brier_avg=round(bavg, 6),
        log_loss=round(ll, 6),
        roi_home=_roi(profits["home"], staked["home"]),
        roi_draw=_roi(profits["draw"], staked["draw"]),
        roi_away=_roi(profits["away"], staked["away"]),
        roi_overall=_roi(total_profit, total_staked),
        total_bets=total_bets,
        winning_bets=winning_bets,
        win_rate=round(winning_bets / total_bets, 4) if total_bets > 0 else 0.0,
        details=details,
    )
