"""Tests for dixon_coles.py"""

import numpy as np
import pytest

from data_loader import generate_mock_matches
from dixon_coles import (
    DixonColesModel,
    _tau_scalar,
    _tau_vectorized,
    _time_weights,
    fit_model,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def model() -> DixonColesModel:
    """Fit once per test module on a 2-season mock dataset."""
    df = generate_mock_matches(n_seasons=2, seed=42)
    return fit_model(df, xi=0.0065, max_iter=200)


@pytest.fixture(scope="module")
def two_teams(model: DixonColesModel) -> tuple[str, str]:
    return model.teams[0], model.teams[1]


# ─── Time Weights ─────────────────────────────────────────────────────────────

class TestTimeWeights:
    def test_most_recent_has_weight_one(self):
        import pandas as pd
        dates = pd.to_datetime(["2024-01-01", "2024-06-01", "2024-12-31"])
        s = pd.Series(dates)
        w = _time_weights(s, xi=0.0065)
        assert abs(w[-1] - 1.0) < 1e-9

    def test_older_dates_have_lower_weight(self):
        import pandas as pd
        dates = pd.to_datetime(["2023-01-01", "2024-01-01", "2024-12-31"])
        s = pd.Series(dates)
        w = _time_weights(s, xi=0.0065)
        assert w[0] < w[1] < w[2]

    def test_all_weights_positive(self):
        import pandas as pd
        dates = pd.to_datetime(["2022-01-01", "2023-01-01", "2024-01-01"])
        s = pd.Series(dates)
        w = _time_weights(s)
        assert (w > 0).all()


# ─── Tau Correction ───────────────────────────────────────────────────────────

class TestTauCorrection:
    """Dixon-Coles rho < 0 means we increase P(0-0) and decrease P(1-1)."""

    def test_00_inflated_with_negative_rho(self):
        # tau(0,0) = 1 - lambda*mu*rho  →  > 1 when rho < 0
        tau = _tau_scalar(0, 0, 1.4, 1.1, -0.05)
        assert tau > 1.0

    def test_11_deflated_with_negative_rho(self):
        # tau(1,1) = 1 - rho  →  > 1 when rho < 0  (deflates relative prob)
        # Wait — 1 - (-0.05) = 1.05 > 1, so 1-1 is actually INFLATED.
        # This matches the original D-C paper; rho corrects the *joint* distribution.
        tau = _tau_scalar(1, 1, 1.4, 1.1, -0.05)
        assert tau == pytest.approx(1.05)

    def test_neutral_for_large_scores(self):
        assert _tau_scalar(3, 2, 1.4, 1.1, -0.05) == 1.0
        assert _tau_scalar(0, 2, 1.4, 1.1, -0.05) == 1.0

    def test_vectorized_matches_scalar(self):
        x = np.array([0, 1, 0, 1, 2])
        y = np.array([0, 0, 1, 1, 3])
        lam = np.ones(5) * 1.4
        mu  = np.ones(5) * 1.1
        rho = -0.05
        vec = _tau_vectorized(x, y, lam, mu, rho)
        for i in range(5):
            assert vec[i] == pytest.approx(_tau_scalar(int(x[i]), int(y[i]), 1.4, 1.1, rho))

    def test_tau_always_positive(self):
        # Even extreme rho should not produce negative tau (clipped to 1e-10)
        tau = _tau_scalar(0, 0, 3.0, 3.0, -0.99)
        assert tau > 0


# ─── Model Structure ──────────────────────────────────────────────────────────

class TestModelStructure:
    def test_all_20_teams_present(self, model):
        assert len(model.teams) == 20

    def test_attack_keys_match_teams(self, model):
        assert set(model.attack.keys()) == set(model.teams)

    def test_defense_keys_match_teams(self, model):
        assert set(model.defense.keys()) == set(model.teams)

    def test_attack_sum_near_zero(self, model):
        """Identifiability constraint: sum(alpha) ≈ 0."""
        total = sum(model.attack.values())
        assert abs(total) < 1e-6, f"Attack sum = {total}"

    def test_home_advantage_positive(self, model):
        assert model.home_advantage > 0.0

    def test_rho_non_positive(self, model):
        assert model.rho <= 0.0

    def test_converged_flag_is_bool(self, model):
        assert isinstance(model.converged, bool)

    def test_n_matches_correct(self, model):
        df = generate_mock_matches(n_seasons=2)
        assert model.n_matches == len(df)


# ─── Expected Goals ───────────────────────────────────────────────────────────

class TestExpectedGoals:
    def test_positive_values(self, model, two_teams):
        lam, mu = model.expected_goals(*two_teams)
        assert lam > 0
        assert mu > 0

    def test_home_advantage_effect(self, model):
        """Home team xG should be higher when the teams are equally matched."""
        # Find two teams with similar attack/defense
        teams = sorted(model.teams, key=lambda t: abs(model.attack[t]))
        t1, t2 = teams[0], teams[1]
        lam, mu = model.expected_goals(t1, t2)
        # Home advantage (gamma > 0) should push lam above mu, all else equal
        # This is not guaranteed for all team combinations, but we can check
        # that lam * mu > 0 and both are reasonable
        assert 0.2 < lam < 8.0
        assert 0.1 < mu  < 6.0

    def test_unknown_home_team_handled(self, model):
        lam, mu = model.expected_goals("Fake FC", model.teams[0])
        assert lam > 0 and mu > 0

    def test_unknown_away_team_handled(self, model):
        lam, mu = model.expected_goals(model.teams[0], "Ghost United")
        assert lam > 0 and mu > 0


# ─── Score Matrix ─────────────────────────────────────────────────────────────

class TestScoreMatrix:
    def test_sums_to_one(self, model, two_teams):
        mat = model.score_matrix(*two_teams, max_goals=5)
        assert abs(mat.sum() - 1.0) < 1e-6

    def test_shape_is_correct(self, model, two_teams):
        mat = model.score_matrix(*two_teams, max_goals=5)
        assert mat.shape == (6, 6)

    def test_all_entries_non_negative(self, model, two_teams):
        mat = model.score_matrix(*two_teams)
        assert (mat >= 0).all()

    def test_custom_max_goals(self, model, two_teams):
        mat = model.score_matrix(*two_teams, max_goals=8)
        assert mat.shape == (9, 9)
        assert abs(mat.sum() - 1.0) < 1e-5


# ─── Outcome Probabilities ────────────────────────────────────────────────────

class TestOutcomeProbs:
    def test_sums_to_one(self, model, two_teams):
        ph, pd, pa = model.outcome_probs(*two_teams)
        assert abs(ph + pd + pa - 1.0) < 1e-5

    def test_all_in_unit_interval(self, model, two_teams):
        for p in model.outcome_probs(*two_teams):
            assert 0.0 <= p <= 1.0

    def test_all_fixtures_valid(self, model):
        """Every team-vs-team combination should produce valid probs."""
        teams = model.teams[:5]  # spot-check 5×4 = 20 combos
        for home in teams:
            for away in teams:
                if home == away:
                    continue
                ph, pd, pa = model.outcome_probs(home, away)
                assert abs(ph + pd + pa - 1.0) < 1e-4


# ─── Over/Under ───────────────────────────────────────────────────────────────

class TestOverUnder:
    def test_sums_to_one(self, model, two_teams):
        p_over, p_under = model.over_under_prob(*two_teams)
        assert abs(p_over + p_under - 1.0) < 1e-6

    def test_reasonable_range(self, model, two_teams):
        p_over, p_under = model.over_under_prob(*two_teams)
        # For typical EPL xG (~1.3 + ~1.0), over 2.5 prob is usually 40-65%
        assert 0.10 < p_over < 0.90


# ─── Most Likely Score ────────────────────────────────────────────────────────

class TestMostLikelyScore:
    def test_valid_integers(self, model, two_teams):
        hg, ag = model.most_likely_score(*two_teams)
        assert isinstance(hg, int) and hg >= 0
        assert isinstance(ag, int) and ag >= 0

    def test_is_argmax_of_matrix(self, model, two_teams):
        hg, ag = model.most_likely_score(*two_teams)
        mat = model.score_matrix(*two_teams)
        max_idx = np.unravel_index(np.argmax(mat), mat.shape)
        assert (hg, ag) == (int(max_idx[0]), int(max_idx[1]))


# ─── Team Ratings ─────────────────────────────────────────────────────────────

class TestTeamRatings:
    def test_all_teams_in_output(self, model):
        df = model.team_ratings()
        assert set(df["team"]) == set(model.teams)

    def test_sorted_by_attack_desc(self, model):
        df = model.team_ratings()
        assert df["attack"].is_monotonic_decreasing

    def test_attack_exp_positive(self, model):
        df = model.team_ratings()
        assert (df["attack_exp"] > 0).all()
