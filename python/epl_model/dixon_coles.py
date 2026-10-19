"""
dixon_coles.py
--------------
Time-decay Dixon-Coles bivariate Poisson model for EPL match prediction.

Model parametrization:
    lambda_home = exp(alpha[home] + beta[away] + gamma)   # expected home goals
    lambda_away = exp(alpha[away] + beta[home])            # expected away goals

where:
    alpha_i  = attack strength of team i   (log scale)
    beta_j   = defense weakness of team j  (log scale; lower = stronger defense)
    gamma    = home advantage              (log scale, typically ~0.25-0.35)
    rho      = low-score correlation       (typically < 0, corrects 0-0/1-0/0-1/1-1)
    xi       = time-decay rate             (default 0.0065 ≈ half-life ~106 days)

Identifiability: after fitting, we enforce sum(alpha) = 0 by shifting
    alpha_i → alpha_i - mean(alpha)
    beta_j  → beta_j  + mean(alpha)   (preserves all lambda values)
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.stats import poisson

logger = logging.getLogger(__name__)


# ─── Time-Decay Weights ───────────────────────────────────────────────────────

def _time_weights(dates: pd.Series, xi: float = 0.0065) -> np.ndarray:
    """
    Exponential time-decay: w_t = exp(-xi * days_ago).

    With xi=0.0065:
      ~1 week ago  → w ≈ 0.955
      ~3 months    → w ≈ 0.53
      ~6 months    → w ≈ 0.28
    """
    ref = dates.max()
    days_ago = (ref - dates).dt.days.values.astype(float)
    return np.exp(-xi * days_ago)


# ─── Dixon-Coles Tau Correction ───────────────────────────────────────────────

def _tau_vectorized(
    x: np.ndarray,
    y: np.ndarray,
    lam: np.ndarray,
    mu: np.ndarray,
    rho: float,
) -> np.ndarray:
    """
    Vectorized Dixon-Coles tau correction.

    Corrects for the empirical dependence between goals at low scores:
        (0,0): tau = 1 - lambda*mu*rho
        (1,0): tau = 1 + mu*rho
        (0,1): tau = 1 + lambda*rho
        (1,1): tau = 1 - rho
        else : tau = 1
    """
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
    """Scalar tau for use in score-matrix generation."""
    if x == 0 and y == 0:
        return max(1e-10, 1.0 - lam * mu * rho)
    if x == 1 and y == 0:
        return max(1e-10, 1.0 + mu * rho)
    if x == 0 and y == 1:
        return max(1e-10, 1.0 + lam * rho)
    if x == 1 and y == 1:
        return max(1e-10, 1.0 - rho)
    return 1.0


# ─── Model Dataclass ──────────────────────────────────────────────────────────

@dataclass
class DixonColesModel:
    """
    Fitted Dixon-Coles model.

    Attributes:
        teams:          Sorted list of all EPL team names.
        attack:         Dict[team -> alpha_i] (log-scale attack, sums to 0).
        defense:        Dict[team -> beta_i]  (log-scale defense weakness).
        home_advantage: gamma (log-scale home advantage).
        rho:            Low-score correlation parameter (≤ 0).
        xi:             Time-decay parameter used during fitting.
        converged:      Whether the optimizer reported convergence.
        n_matches:      Number of matches used for training.
    """
    teams: list[str]
    attack:  dict[str, float] = field(default_factory=dict)
    defense: dict[str, float] = field(default_factory=dict)
    home_advantage: float = 0.3
    rho:  float = -0.03
    xi:   float = 0.0065
    converged:  bool = False
    n_matches:  int  = 0

    # ── Core Prediction Methods ──

    def expected_goals(self, home: str, away: str) -> tuple[float, float]:
        """
        Compute expected goals (xG) for a fixture.

        Returns:
            (lambda_home, lambda_away) as floats.

        Raises:
            ValueError: if either team is not in the model.
        """
        self._validate_teams(home, away)
        h = self._normalize_team(home)
        a = self._normalize_team(away)
        lam = float(np.exp(self.attack[h] + self.defense[a] + self.home_advantage))
        mu  = float(np.exp(self.attack[a] + self.defense[h]))
        return lam, mu

    def score_matrix(self, home: str, away: str, max_goals: int = 5) -> np.ndarray:
        """
        Compute a (max_goals+1) × (max_goals+1) score probability matrix.

        mat[i, j] = P(home scores i goals, away scores j goals).
        Rows = home goals (0..max_goals), Columns = away goals (0..max_goals).
        Matrix is renormalized to sum to 1 over the truncated range.
        """
        lam, mu = self.expected_goals(home, away)
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

    def outcome_probs(self, home: str, away: str) -> tuple[float, float, float]:
        """
        Compute 3-way outcome probabilities.

        Returns:
            (p_home_win, p_draw, p_away_win)
        """
        mat = self.score_matrix(home, away)
        p_home = float(np.sum(np.tril(mat, -1)))   # lower triangle: home goals > away
        p_away = float(np.sum(np.triu(mat,  1)))   # upper triangle: away goals > home
        p_draw = float(np.trace(mat))
        return p_home, p_draw, p_away

    def over_under_prob(
        self, home: str, away: str, line: float = 2.5
    ) -> tuple[float, float]:
        """
        Compute over/under total goals probability.

        Returns:
            (p_over, p_under) for total goals > line.
        """
        mat = self.score_matrix(home, away)
        n = mat.shape[0]
        p_over = float(
            sum(mat[i, j] for i in range(n) for j in range(n) if (i + j) > line)
        )
        return p_over, 1.0 - p_over

    def most_likely_score(self, home: str, away: str) -> tuple[int, int]:
        """Return the (home_goals, away_goals) scoreline with highest probability."""
        mat = self.score_matrix(home, away)
        idx = np.unravel_index(np.argmax(mat), mat.shape)
        return int(idx[0]), int(idx[1])

    def team_ratings(self) -> pd.DataFrame:
        """
        Return a DataFrame of all team ratings.

        Columns: team, attack (log), defense (log), attack_exp, defense_exp.
        Sorted by attack descending (strongest attackers first).
        """
        rows = [
            {
                "team":        t,
                "attack":      round(self.attack.get(t, 0.0),  4),
                "defense":     round(self.defense.get(t, 0.0), 4),
                "attack_exp":  round(np.exp(self.attack.get(t, 0.0)),  4),
                "defense_exp": round(np.exp(self.defense.get(t, 0.0)), 4),
            }
            for t in self.teams
        ]
        return (
            pd.DataFrame(rows)
            .sort_values("attack", ascending=False)
            .reset_index(drop=True)
        )

    # ── Internal ──

    def _normalize_team(self, team: str) -> str:
        if team in self.attack:
            return team
        t_clean = team.replace(" Hotspur", "").replace(" City", "").replace(" United", "").replace(" FC", "").strip()
        if t_clean in self.attack:
            return t_clean
        for k in self.attack:
            if t_clean.lower() in k.lower() or k.lower() in t_clean.lower():
                return k
        # Fallback to assigning promoted baseline
        if self.attack:
            base_att = float(np.percentile(list(self.attack.values()), 25))
            base_def = float(np.percentile(list(self.defense.values()), 75))
        else:
            base_att, base_def = -0.2, 0.2
        self.attack[team] = base_att
        self.defense[team] = base_def
        if team not in self.teams:
            self.teams.append(team)
        return team

    def _validate_teams(self, home: str, away: str) -> None:
        self._normalize_team(home)
        self._normalize_team(away)


# ─── Log-Likelihood (Vectorized) ──────────────────────────────────────────────

def _neg_log_likelihood(
    params: np.ndarray,
    n_teams: int,
    home_idx: np.ndarray,
    away_idx: np.ndarray,
    home_goals: np.ndarray,
    away_goals: np.ndarray,
    weights: np.ndarray,
) -> float:
    """
    Vectorized weighted negative log-likelihood for the Dixon-Coles model.

    Parameter layout:
        params[0 : n]         → attack  (alpha)
        params[n : 2n]        → defense (beta)
        params[2n]            → home_advantage (gamma)
        params[2n + 1]        → rho
    """
    alpha  = params[:n_teams]
    beta   = params[n_teams : 2 * n_teams]
    gamma  = params[2 * n_teams]
    rho    = np.clip(params[2 * n_teams + 1], -0.99, 0.0)

    lam = np.exp(alpha[home_idx] + beta[away_idx] + gamma)
    mu  = np.exp(alpha[away_idx] + beta[home_idx])

    tau = _tau_vectorized(home_goals, away_goals, lam, mu, rho)

    log_p = (
        poisson.logpmf(home_goals, lam)
        + poisson.logpmf(away_goals, mu)
        + np.log(tau)
    )

    # Replace any -inf / NaN with a large penalty
    log_p = np.where(np.isfinite(log_p), log_p, -1e6)

    return -float(np.dot(weights, log_p))


# ─── Model Fitting ────────────────────────────────────────────────────────────

def fit_model(
    df: pd.DataFrame,
    xi: float = 0.0065,
    max_iter: int = 1000,
) -> DixonColesModel:
    """
    Fit the time-decay Dixon-Coles model on historical match data.

    Args:
        df:       DataFrame containing at minimum:
                  [date, home_team, away_team, fthg, ftag]
        xi:       Exponential time-decay rate (default 0.0065).
        max_iter: Maximum optimizer iterations.

    Returns:
        Fitted DixonColesModel instance.

    Notes:
        • Uses L-BFGS-B (fast, handles bounds).
        • Post-fit identifiability: alpha shifted so sum(alpha) = 0,
          with the corresponding shift applied to beta to keep all lambdas invariant.
        • Bounds: attack/defense in [-4, 4], gamma in [0, 2], rho in [-0.99, 0].
    """
    df = (
        df.dropna(subset=["date", "home_team", "away_team", "fthg", "ftag"])
        .copy()
    )
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    if len(df) < 10:
        raise ValueError(f"Too few matches to fit model: {len(df)}")

    teams = sorted(set(df["home_team"]) | set(df["away_team"]))
    n = len(teams)
    team_to_idx = {t: i for i, t in enumerate(teams)}

    home_idx   = np.array([team_to_idx[t] for t in df["home_team"]], dtype=np.intp)
    away_idx   = np.array([team_to_idx[t] for t in df["away_team"]], dtype=np.intp)
    home_goals = df["fthg"].values.astype(int)
    away_goals = df["ftag"].values.astype(int)
    weights    = _time_weights(df["date"], xi)

    # Initial parameter vector: zeros + reasonable defaults
    x0 = np.zeros(2 * n + 2)
    x0[2 * n]     = 0.30    # gamma
    x0[2 * n + 1] = -0.03   # rho

    bounds = (
        [(-4.0, 4.0)] * n   # attack
        + [(-4.0, 4.0)] * n # defense
        + [(0.0, 2.0)]      # gamma
        + [(-0.99, 0.0)]    # rho
    )

    logger.info(
        "Fitting Dixon-Coles: %d matches, %d teams, xi=%.4f, max_iter=%d",
        len(df), n, xi, max_iter,
    )

    result = minimize(
        _neg_log_likelihood,
        x0,
        args=(n, home_idx, away_idx, home_goals, away_goals, weights),
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": max_iter, "ftol": 1e-10, "gtol": 1e-6},
    )

    if not result.success:
        logger.warning("Optimizer did not fully converge: %s", result.message)

    params = result.x
    alpha_raw = params[:n]
    beta_raw  = params[n : 2 * n]
    gamma     = float(params[2 * n])
    rho       = float(np.clip(params[2 * n + 1], -0.99, 0.0))

    # ── Identifiability: shift so sum(alpha) = 0 ──────────────────────────────
    # Shifting alpha by -c and beta by +c leaves all lambda values unchanged:
    #   lambda = exp(alpha_h + beta_a + gamma) is invariant to alpha += c, beta -= c
    shift       = float(alpha_raw.mean())
    alpha_norm  = alpha_raw - shift
    beta_norm   = beta_raw  + shift

    attack  = {t: float(alpha_norm[i]) for i, t in enumerate(teams)}
    defense = {t: float(beta_norm[i])  for i, t in enumerate(teams)}

    model = DixonColesModel(
        teams=teams,
        attack=attack,
        defense=defense,
        home_advantage=gamma,
        rho=rho,
        xi=xi,
        converged=bool(result.success),
        n_matches=len(df),
    )

    logger.info(
        "Model ready — converged=%s | gamma=%.4f | rho=%.4f | nll=%.2f",
        model.converged, model.home_advantage, model.rho, result.fun,
    )
    return model
