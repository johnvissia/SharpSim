"""
signals.py (UCL Model)
----------------------
Betting signal generation, Quarter-Kelly staking, and walk-forward backtesting
for UEFA Champions League matches.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import numpy as np
import pandas as pd

from ucl_engine import UCLModel, fit_ucl_model

logger = logging.getLogger(__name__)


class Signal(str, Enum):
    NO_BET       = "NO_BET"
    VALUE        = "VALUE"
    STRONG_VALUE = "STRONG_VALUE"


EDGE_VALUE  = 0.04
EDGE_STRONG = 0.08


@dataclass
class BetSignal:
    outcome:        str     # "home" | "draw" | "away" | "over25" | "under25" | "btts_yes"
    signal:         Signal
    p_model:        float
    odds_bookmaker: float
    fair_odds:      float
    edge:           float
    stake_pct:      float
    implied_prob:   float


@dataclass
class UCLPredictionResult:
    home_team:              str
    away_team:              str
    lambda_home:            float
    lambda_away:            float
    p_home:                 float
    p_draw:                 float
    p_away:                 float
    p_over25:               float
    p_under25:              float
    p_btts_yes:             float
    p_btts_no:              float
    most_likely_home_goals: int
    most_likely_away_goals: int
    score_matrix:           list[list[float]]
    signals:                list[BetSignal]
    is_neutral:             bool = False


@dataclass
class UCLBacktestResult:
    n_matches:    int
    brier_avg:    float
    log_loss:     float
    roi_overall:  float
    total_bets:   int
    winning_bets: int
    win_rate:     float
    details:      list[dict]


def _quarter_kelly(p: float, odds: float) -> float:
    b = odds - 1.0
    if b <= 0.0 or p <= 0.0:
        return 0.0
    kelly = (b * p - (1.0 - p)) / b
    return float(max(0.0, 0.25 * kelly))


def generate_ucl_signals(
    p_home: float,
    p_draw: float,
    p_away: float,
    odds_home: Optional[float] = None,
    odds_draw: Optional[float] = None,
    odds_away: Optional[float] = None,
) -> list[BetSignal]:
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


def predict_ucl(
    model: UCLModel,
    home: str,
    away: str,
    odds_home: Optional[float] = None,
    odds_draw: Optional[float] = None,
    odds_away: Optional[float] = None,
    neutral: bool = False,
    max_goals: int = 5,
) -> UCLPredictionResult:
    lam, mu = model.expected_goals(home, away, neutral=neutral)
    p_h, p_d, p_a = model.outcome_probs(home, away, neutral=neutral)
    p_over, p_under = model.over_under_prob(home, away, line=2.5, neutral=neutral)
    p_btts, p_no_btts = model.btts_prob(home, away, neutral=neutral)
    ml_h, ml_a = model.most_likely_score(home, away, neutral=neutral)
    mat = model.score_matrix(home, away, max_goals=max_goals, neutral=neutral)

    signals = generate_ucl_signals(p_h, p_d, p_a, odds_home, odds_draw, odds_away)

    return UCLPredictionResult(
        home_team=home,
        away_team=away,
        lambda_home=round(lam, 4),
        lambda_away=round(mu, 4),
        p_home=round(p_h, 6),
        p_draw=round(p_d, 6),
        p_away=round(p_a, 6),
        p_over25=round(p_over, 6),
        p_under25=round(p_under, 6),
        p_btts_yes=round(p_btts, 6),
        p_btts_no=round(p_no_btts, 6),
        most_likely_home_goals=ml_h,
        most_likely_away_goals=ml_a,
        score_matrix=[[round(v, 6) for v in row] for row in mat.tolist()],
        signals=signals,
        is_neutral=neutral,
    )


def backtest_ucl(
    df: pd.DataFrame,
    xi: float = 0.0065,
    min_train_matches: int = 120,
    edge_threshold: float = EDGE_VALUE,
    window_weeks: int = 4,
) -> UCLBacktestResult:
    df = df.dropna(subset=["date", "home_team", "away_team", "fthg", "ftag"]).copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    if len(df) <= min_train_matches:
        raise RuntimeError(f"Dataset too small ({len(df)} matches) for UCL backtest.")

    step = pd.Timedelta(weeks=window_weeks)
    first_cut = df.iloc[min_train_matches]["date"]
    current = first_cut

    y_true_3way, y_pred_3way = [], []
    y_true_h, y_pred_h = [], []
    y_true_d, y_pred_d = [], []
    y_true_a, y_pred_a = [], []

    bankroll = 1000.0
    total_staked = 0.0
    total_profit = 0.0
    total_bets = 0
    winning_bets = 0
    details = []

    while current < df["date"].max():
        train = df[df["date"] < current]
        test = df[(df["date"] >= current) & (df["date"] < current + step)]
        current += step

        if len(train) < min_train_matches or test.empty:
            continue

        try:
            m = fit_ucl_model(train, xi=xi, max_iter=250)
        except Exception:
            continue

        for _, row in test.iterrows():
            h, a = str(row["home_team"]), str(row["away_team"])
            if h not in m.teams or a not in m.teams:
                continue

            fthg, ftag = int(row["fthg"]), int(row["ftag"])
            true_out = "home" if fthg > ftag else "draw" if fthg == ftag else "away"
            odds_h = row.get("b365h") if pd.notna(row.get("b365h")) else None
            odds_d = row.get("b365d") if pd.notna(row.get("b365d")) else None
            odds_a = row.get("b365a") if pd.notna(row.get("b365a")) else None
            is_n = bool(row.get("neutral_venue", 0))

            try:
                res = predict_ucl(m, h, a, odds_h, odds_d, odds_a, neutral=is_n)
            except Exception:
                continue

            y_true_h.append(1 if true_out == "home" else 0)
            y_true_d.append(1 if true_out == "draw" else 0)
            y_true_a.append(1 if true_out == "away" else 0)
            y_pred_h.append(res.p_home)
            y_pred_d.append(res.p_draw)
            y_pred_a.append(res.p_away)
            y_true_3way.append([1 if true_out == "home" else 0, 1 if true_out == "draw" else 0, 1 if true_out == "away" else 0])
            y_pred_3way.append([res.p_home, res.p_draw, res.p_away])

            # Betting simulation
            for sig in res.signals:
                if sig.signal != Signal.NO_BET and sig.edge >= edge_threshold:
                    stake = bankroll * sig.stake_pct
                    if stake >= 1.0:
                        total_staked += stake
                        total_bets += 1
                        won = sig.outcome == true_out
                        if won:
                            profit = stake * (sig.odds_bookmaker - 1.0)
                            winning_bets += 1
                        else:
                            profit = -stake
                        bankroll += profit
                        total_profit += profit

            details.append({
                "date": str(row["date"].date()),
                "home": h, "away": a, "actual": f"{fthg}-{ftag}",
                "p_home": round(res.p_home, 4), "p_draw": round(res.p_draw, 4), "p_away": round(res.p_away, 4),
            })

    if not y_true_h:
        raise RuntimeError("No predictions generated during UCL backtest.")

    bh = float(np.mean((np.array(y_true_h) - np.array(y_pred_h)) ** 2))
    bd = float(np.mean((np.array(y_true_d) - np.array(y_pred_d)) ** 2))
    ba = float(np.mean((np.array(y_true_a) - np.array(y_pred_a)) ** 2))
    bavg = (bh + bd + ba) / 3.0

    yp = np.clip(np.array(y_pred_3way), 1e-12, 1.0)
    yp = yp / yp.sum(axis=1, keepdims=True)
    ll = float(-np.mean(np.sum(np.array(y_true_3way) * np.log(yp), axis=1)))

    roi = round(total_profit / total_staked, 4) if total_staked > 0 else 0.0

    return UCLBacktestResult(
        n_matches=len(details),
        brier_avg=round(bavg, 6),
        log_loss=round(ll, 6),
        roi_overall=roi,
        total_bets=total_bets,
        winning_bets=winning_bets,
        win_rate=round(winning_bets / total_bets, 4) if total_bets > 0 else 0.0,
        details=details,
    )
