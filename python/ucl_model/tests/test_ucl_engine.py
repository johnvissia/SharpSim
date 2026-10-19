"""Tests for UCL model engine and signals"""

import numpy as np
import pytest

from data_loader import UCL_CLUBS_DATA, UCL_TEAMS, generate_mock_ucl_matches
from signals import backtest_ucl, generate_ucl_signals, predict_ucl
from ucl_engine import UCLModel, fit_ucl_model


@pytest.fixture(scope="module")
def ucl_model() -> UCLModel:
    df = generate_mock_ucl_matches(n_seasons=2, seed=42)
    return fit_ucl_model(df, xi=0.0065, max_iter=200)


def test_ucl_teams_present(ucl_model):
    assert len(ucl_model.teams) >= 30
    assert "Real Madrid" in ucl_model.teams
    assert "Manchester City" in ucl_model.teams
    assert "Bayern Munich" in ucl_model.teams


def test_identifiability(ucl_model):
    total_attack = sum(ucl_model.attack.values())
    assert abs(total_attack) < 1e-5


def test_home_advantage_neutral_venue(ucl_model):
    h, a = "Real Madrid", "Manchester City"
    lam_home, mu_away = ucl_model.expected_goals(h, a, neutral=False)
    lam_neutral, mu_neutral = ucl_model.expected_goals(h, a, neutral=True)
    # Neutral venue should have strictly lower expected goals for home team than home fixture
    assert lam_neutral < lam_home


def test_score_matrix_sum(ucl_model):
    mat = ucl_model.score_matrix("Bayern Munich", "Arsenal")
    assert abs(mat.sum() - 1.0) < 1e-5


def test_btts_sum_to_one(ucl_model):
    p_yes, p_no = ucl_model.btts_prob("Paris Saint-Germain", "Liverpool")
    assert abs(p_yes + p_no - 1.0) < 1e-5


def test_outcome_probs_sum(ucl_model):
    ph, pd, pa = ucl_model.outcome_probs("Barcelona", "Inter Milan")
    assert abs(ph + pd + pa - 1.0) < 1e-5


def test_predict_ucl_with_signals(ucl_model):
    res = predict_ucl(
        ucl_model,
        "Real Madrid",
        "Juventus",
        odds_home=1.85,
        odds_draw=3.70,
        odds_away=4.20,
    )
    assert res.home_team == "Real Madrid"
    assert len(res.signals) == 3
    assert res.lambda_home > 0
    assert res.lambda_away > 0


def test_ucl_backtest():
    df = generate_mock_ucl_matches(n_seasons=2, seed=42)
    bt = backtest_ucl(df, min_train_matches=80, window_weeks=6)
    assert bt.n_matches > 0
    assert 0.0 <= bt.brier_avg <= 1.0
    assert bt.log_loss > 0
