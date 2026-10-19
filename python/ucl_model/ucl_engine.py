"""
ucl_engine.py
-------------
Time-decay Cross-League Dixon-Coles Bivariate Poisson Model for UEFA Champions League.

Model Formulation:
    lambda_home = exp(alpha[home] + beta[away] + gamma * (1 - is_neutral) + (kappa[home_lg] - kappa[away_lg]))
    lambda_away = exp(alpha[away] + beta[home] + (kappa[away_lg] - kappa[home_lg]))

Where:
    alpha_i   = Club attack power (log scale)
    beta_j    = Club defense weakness (log scale; lower is better)
    gamma     = European home advantage (log scale, ~0.24 - 0.32)
    kappa_l   = Domestic league quality coefficient (log scale)
    rho       = Low-score bivariate correlation parameter
    xi        = Time-decay factor (default: 0.0065)
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.stats import poisson

from data_loader import LEAGUE_COEFFICIENTS, UCL_CLUBS_DATA

logger = logging.getLogger(__name__)


def _time_weights(dates: pd.Series, xi: float = 0.0065) -> np.ndarray:
    ref = dates.max()
    days_ago = (ref - dates).dt.days.values.astype(float)
    return np.exp(-xi * days_ago)


def _tau_vectorized(
    x: np.ndarray,
    y: np.ndarray,
    lam: np.ndarray,
    mu: np.ndarray,
    rho: float,
) -> np.ndarray:
    tau = np.ones(len(x))
    m00 = (x == 0) & (y == 0)
    m10 = (x == 1) & (y == 0)
    m01 = (x == 0) & (y == 1)
    m11 = (x == 1) & (y == 1)
    tau[m00] = 1.0 - lam[m00] * mu[m00] * rho
    tau[m10] = 1.0 + mu[m10] * rho
    tau[m01] = 1.0 + lam[m01] * rho
    tau[m11] = 1.0 - rho
    return np.clip(tau, 1e-10, None)


def _tau_scalar(x: int, y: int, lam: float, mu: float, rho: float) -> float:
    if x == 0 and y == 0:
        return max(1e-10, 1.0 - lam * mu * rho)
    if x == 1 and y == 0:
        return max(1e-10, 1.0 + mu * rho)
    if x == 0 and y == 1:
        return max(1e-10, 1.0 + lam * rho)
    if x == 1 and y == 1:
        return max(1e-10, 1.0 - rho)
    return 1.0


@dataclass
class UCLModel:
    teams: list[str]
    attack: dict[str, float] = field(default_factory=dict)
    defense: dict[str, float] = field(default_factory=dict)
    home_advantage: float = 0.28
    rho: float = -0.04
    xi: float = 0.0065
    converged: bool = False
    n_matches: int = 0

    def expected_goals(
        self, home: str, away: str, neutral: bool = False
    ) -> tuple[float, float]:
        self._validate_teams(home, away)

        # League coefficients (defaults to Rest of Europe if not explicitly listed)
        h_lg = UCL_CLUBS_DATA.get(home, {}).get("league", "Rest of Europe")
        a_lg = UCL_CLUBS_DATA.get(away, {}).get("league", "Rest of Europe")
        h_coeff = LEAGUE_COEFFICIENTS.get(h_lg, 0.60)
        a_coeff = LEAGUE_COEFFICIENTS.get(a_lg, 0.60)
        league_diff = (h_coeff - a_coeff) * 0.35

        gamma = 0.0 if neutral else self.home_advantage

        lam = float(np.exp(self.attack[home] + self.defense[away] + gamma + league_diff))
        mu  = float(np.exp(self.attack[away] + self.defense[home] - league_diff))

        # Clamp to realistic soccer expectations
        lam = max(0.2, min(lam, 7.0))
        mu  = max(0.2, min(mu,  7.0))
        return lam, mu

    def score_matrix(
        self, home: str, away: str, max_goals: int = 5, neutral: bool = False
    ) -> np.ndarray:
        lam, mu = self.expected_goals(home, away, neutral=neutral)
        n = max_goals + 1
        mat = np.zeros((n, n))
        for i in range(n):
            for j in range(n):
                p = poisson.pmf(i, lam) * poisson.pmf(j, mu)
                p *= _tau_scalar(i, j, lam, mu, self.rho)
                mat[i, j] = max(0.0, p)
        total = mat.sum()
        if total > 0:
            mat /= total
        return mat

    def outcome_probs(
        self, home: str, away: str, neutral: bool = False
    ) -> tuple[float, float, float]:
        mat = self.score_matrix(home, away, neutral=neutral)
        p_home = float(np.sum(np.tril(mat, -1)))
        p_away = float(np.sum(np.triu(mat, 1)))
        p_draw = float(np.trace(mat))
        return p_home, p_draw, p_away

    def over_under_prob(
        self, home: str, away: str, line: float = 2.5, neutral: bool = False
    ) -> tuple[float, float]:
        mat = self.score_matrix(home, away, neutral=neutral)
        n = mat.shape[0]
        p_over = float(
            sum(mat[i, j] for i in range(n) for j in range(n) if (i + j) > line)
        )
        return p_over, 1.0 - p_over

    def btts_prob(
        self, home: str, away: str, neutral: bool = False
    ) -> tuple[float, float]:
        """Both Teams to Score (BTTS) probability: (Yes, No)."""
        mat = self.score_matrix(home, away, neutral=neutral)
        # P(BTTS Yes) = 1 - P(home=0) - P(away=0) + P(0,0)
        p_home_zero = float(mat[0, :].sum())
        p_away_zero = float(mat[:, 0].sum())
        p_zero_zero = float(mat[0, 0])
        p_btts_yes = float(max(0.0, min(1.0, 1.0 - (p_home_zero + p_away_zero - p_zero_zero))))
        return p_btts_yes, 1.0 - p_btts_yes

    def most_likely_score(
        self, home: str, away: str, neutral: bool = False
    ) -> tuple[int, int]:
        mat = self.score_matrix(home, away, neutral=neutral)
        idx = np.unravel_index(np.argmax(mat), mat.shape)
        return int(idx[0]), int(idx[1])

    def team_ratings(self) -> pd.DataFrame:
        rows = [
            {
                "team":        t,
                "league":      UCL_CLUBS_DATA.get(t, {}).get("league", "Other"),
                "country":     UCL_CLUBS_DATA.get(t, {}).get("country", "Europe"),
                "attack":      round(self.attack.get(t, 0.0), 4),
                "defense":     round(self.defense.get(t, 0.0), 4),
                "attack_exp":  round(np.exp(self.attack.get(t, 0.0)), 4),
                "defense_exp": round(np.exp(self.defense.get(t, 0.0)), 4),
            }
            for t in self.teams
        ]
        return (
            pd.DataFrame(rows)
            .sort_values("attack", ascending=False)
            .reset_index(drop=True)
        )

    def _validate_teams(self, home: str, away: str) -> None:
        for t in (home, away):
            if t not in self.attack:
                lg = UCL_CLUBS_DATA.get(t, {}).get("league", "Rest of Europe")
                coeff = LEAGUE_COEFFICIENTS.get(lg, 0.60)
                self.attack[t] = float((coeff - 0.75) * 0.4)
                self.defense[t] = float(-(coeff - 0.75) * 0.3)
                if t not in self.teams:
                    self.teams.append(t)


# ─── Likelihood & Optimization ────────────────────────────────────────────────

def _neg_log_likelihood(
    params: np.ndarray,
    n_teams: int,
    home_idx: np.ndarray,
    away_idx: np.ndarray,
    home_goals: np.ndarray,
    away_goals: np.ndarray,
    league_diffs: np.ndarray,
    is_neutral: np.ndarray,
    weights: np.ndarray,
) -> float:
    alpha = params[:n_teams]
    beta  = params[n_teams : 2 * n_teams]
    gamma = params[2 * n_teams]
    rho   = np.clip(params[2 * n_teams + 1], -0.99, 0.0)

    # Home advantage applies only to non-neutral fixtures
    h_adv = gamma * (1.0 - is_neutral)
    lam = np.exp(alpha[home_idx] + beta[away_idx] + h_adv + league_diffs)
    mu  = np.exp(alpha[away_idx] + beta[home_idx] - league_diffs)

    tau = _tau_vectorized(home_goals, away_goals, lam, mu, rho)

    log_p = (
        poisson.logpmf(home_goals, lam)
        + poisson.logpmf(away_goals, mu)
        + np.log(tau)
    )
    log_p = np.where(np.isfinite(log_p), log_p, -1e6)
    return -float(np.dot(weights, log_p))


def fit_ucl_model(
    df: pd.DataFrame,
    xi: float = 0.0065,
    max_iter: int = 1000,
) -> UCLModel:
    df = df.dropna(subset=["date", "home_team", "away_team", "fthg", "ftag"]).copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    teams = sorted(set(df["home_team"]) | set(df["away_team"]))
    n = len(teams)
    team_to_idx = {t: i for i, t in enumerate(teams)}

    home_idx   = np.array([team_to_idx[t] for t in df["home_team"]], dtype=np.intp)
    away_idx   = np.array([team_to_idx[t] for t in df["away_team"]], dtype=np.intp)
    home_goals = df["fthg"].values.astype(int)
    away_goals = df["ftag"].values.astype(int)
    is_neutral = df.get("neutral_venue", pd.Series(0, index=df.index)).values.astype(float)
    weights    = _time_weights(df["date"], xi)

    # Precompute league differential adjustments
    league_diffs = np.zeros(len(df))
    for idx, row in df.iterrows():
        h_lg = row.get("home_league") or UCL_CLUBS_DATA.get(row["home_team"], {}).get("league", "Rest of Europe")
        a_lg = row.get("away_league") or UCL_CLUBS_DATA.get(row["away_team"], {}).get("league", "Rest of Europe")
        h_c = LEAGUE_COEFFICIENTS.get(h_lg, 0.60)
        a_c = LEAGUE_COEFFICIENTS.get(a_lg, 0.60)
        league_diffs[idx] = (h_c - a_c) * 0.35

    x0 = np.zeros(2 * n + 2)
    x0[2 * n]     = 0.28   # gamma
    x0[2 * n + 1] = -0.04  # rho

    bounds = (
        [(-4.0, 4.0)] * n
        + [(-4.0, 4.0)] * n
        + [(0.0, 2.0)]
        + [(-0.99, 0.0)]
    )

    result = minimize(
        _neg_log_likelihood,
        x0,
        args=(n, home_idx, away_idx, home_goals, away_goals, league_diffs, is_neutral, weights),
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": max_iter, "ftol": 1e-10, "gtol": 1e-6},
    )

    params = result.x
    alpha_raw = params[:n]
    beta_raw  = params[n : 2 * n]
    gamma     = float(params[2 * n])
    rho       = float(np.clip(params[2 * n + 1], -0.99, 0.0))

    # Identifiability shift so sum(alpha) = 0
    shift      = float(alpha_raw.mean())
    alpha_norm = alpha_raw - shift
    beta_norm  = beta_raw  + shift

    attack  = {t: float(alpha_norm[i]) for i, t in enumerate(teams)}
    defense = {t: float(beta_norm[i])  for i, t in enumerate(teams)}

    return UCLModel(
        teams=teams,
        attack=attack,
        defense=defense,
        home_advantage=gamma,
        rho=rho,
        xi=xi,
        converged=bool(result.success),
        n_matches=len(df),
    )
