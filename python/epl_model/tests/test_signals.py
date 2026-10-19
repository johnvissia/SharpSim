"""Tests for signals.py"""

import pytest

from data_loader import generate_mock_matches
from dixon_coles import fit_model
from signals import (
    EDGE_STRONG,
    EDGE_VALUE,
    Signal,
    _brier,
    _log_loss_3way,
    _quarter_kelly,
    backtest,
    generate_signals,
    predict,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def model():
    df = generate_mock_matches(n_seasons=2, seed=42)
    return fit_model(df, xi=0.0065, max_iter=200)


# ─── Quarter-Kelly ────────────────────────────────────────────────────────────

class TestQuarterKelly:
    def test_positive_edge_returns_positive_stake(self):
        # 60% prob, 2.0 odds → edge > 0
        stake = _quarter_kelly(0.60, 2.0)
        assert stake > 0.0

    def test_zero_edge_returns_zero(self):
        # 50% prob, 2.0 odds → edge = 0
        stake = _quarter_kelly(0.50, 2.0)
        assert stake == pytest.approx(0.0)

    def test_negative_edge_clamped_to_zero(self):
        # 30% prob, 2.0 odds → kelly < 0
        stake = _quarter_kelly(0.30, 2.0)
        assert stake == 0.0

    def test_is_quarter_of_full_kelly(self):
        p, odds = 0.70, 2.50
        b = odds - 1.0
        full_kelly = (b * p - (1 - p)) / b
        expected_qk = max(0.0, 0.25 * full_kelly)
        assert _quarter_kelly(p, odds) == pytest.approx(expected_qk, rel=1e-6)

    def test_edge_cases(self):
        assert _quarter_kelly(0.0, 2.0) == 0.0   # zero probability
        assert _quarter_kelly(0.5, 1.0) == 0.0   # zero odds gain
        assert _quarter_kelly(0.5, 0.5) == 0.0   # odds < 1 — invalid


# ─── Generate Signals ─────────────────────────────────────────────────────────

class TestGenerateSignals:
    def test_no_signals_without_odds(self):
        sigs = generate_signals(0.50, 0.25, 0.25)
        assert sigs == []

    def test_no_bet_when_edge_below_threshold(self):
        # p=0.45, odds=2.0 → edge = 0.45*2 - 1 = -0.10 → NO_BET
        sigs = generate_signals(0.45, 0.28, 0.27, odds_home=2.0, odds_draw=3.6, odds_away=4.5)
        home_sigs = [s for s in sigs if s.outcome == "home"]
        assert len(home_sigs) == 1
        assert home_sigs[0].signal == Signal.NO_BET
        assert home_sigs[0].stake_pct == 0.0

    def test_value_signal_in_4_to_8_pct_range(self):
        # p=0.50, odds=2.12 → edge = 0.50*2.12 - 1 = 0.06 (6%) → VALUE
        sigs = generate_signals(0.50, 0.28, 0.22, odds_home=2.12, odds_draw=3.5, odds_away=5.0)
        home_sigs = [s for s in sigs if s.outcome == "home"]
        assert home_sigs[0].signal == Signal.VALUE
        assert EDGE_VALUE <= home_sigs[0].edge < EDGE_STRONG

    def test_strong_value_signal(self):
        # p=0.70, odds=3.0 → edge = 0.70*3.0 - 1 = 1.10 (110%) → STRONG_VALUE
        sigs = generate_signals(0.70, 0.20, 0.10, odds_home=3.0, odds_draw=5.0, odds_away=9.0)
        home_sigs = [s for s in sigs if s.outcome == "home"]
        assert home_sigs[0].signal == Signal.STRONG_VALUE
        assert home_sigs[0].edge >= EDGE_STRONG

    def test_fair_odds_equals_one_over_p(self):
        sigs = generate_signals(0.45, 0.30, 0.25, odds_home=2.5, odds_draw=3.5, odds_away=4.5)
        for s in sigs:
            assert abs(s.fair_odds - 1.0 / s.p_model) < 0.01

    def test_implied_prob_equals_one_over_odds(self):
        sigs = generate_signals(0.45, 0.30, 0.25, odds_home=2.5, odds_draw=3.5, odds_away=4.5)
        for s in sigs:
            assert abs(s.implied_prob - 1.0 / s.odds_bookmaker) < 1e-6

    def test_all_three_outcomes_returned(self):
        sigs = generate_signals(0.45, 0.30, 0.25, odds_home=2.5, odds_draw=3.5, odds_away=4.5)
        outcomes = {s.outcome for s in sigs}
        assert outcomes == {"home", "draw", "away"}

    def test_no_bet_has_zero_stake(self):
        sigs = generate_signals(0.33, 0.33, 0.34, odds_home=1.5, odds_draw=3.0, odds_away=5.0)
        for s in sigs:
            if s.signal == Signal.NO_BET:
                assert s.stake_pct == 0.0


# ─── Full Prediction ──────────────────────────────────────────────────────────

class TestPredict:
    def test_outcome_probs_sum_to_one(self, model):
        home, away = model.teams[0], model.teams[1]
        result = predict(model, home, away)
        total = result.p_home + result.p_draw + result.p_away
        assert abs(total - 1.0) < 1e-5

    def test_over_under_sum_to_one(self, model):
        home, away = model.teams[0], model.teams[1]
        result = predict(model, home, away)
        assert abs(result.p_over25 + result.p_under25 - 1.0) < 1e-5

    def test_lambda_positive(self, model):
        home, away = model.teams[0], model.teams[1]
        result = predict(model, home, away)
        assert result.lambda_home > 0
        assert result.lambda_away > 0

    def test_score_matrix_shape(self, model):
        home, away = model.teams[0], model.teams[1]
        result = predict(model, home, away, max_goals=5)
        assert len(result.score_matrix) == 6
        assert all(len(row) == 6 for row in result.score_matrix)

    def test_signals_generated_with_odds(self, model):
        home, away = model.teams[0], model.teams[1]
        result = predict(model, home, away, odds_home=2.5, odds_draw=3.3, odds_away=3.0)
        assert len(result.signals) == 3
        outcomes = {s.outcome for s in result.signals}
        assert outcomes == {"home", "draw", "away"}

    def test_no_signals_without_odds(self, model):
        home, away = model.teams[0], model.teams[1]
        result = predict(model, home, away)
        assert result.signals == []

    def test_most_likely_score_non_negative(self, model):
        home, away = model.teams[0], model.teams[1]
        result = predict(model, home, away)
        assert result.most_likely_home_goals >= 0
        assert result.most_likely_away_goals >= 0


# ─── Brier / Log Loss ─────────────────────────────────────────────────────────

class TestMetrics:
    def test_brier_perfect_prediction(self):
        assert _brier([1, 0, 1], [1.0, 0.0, 1.0]) == pytest.approx(0.0)

    def test_brier_worst_prediction(self):
        # Always predicts 0 for the true outcome
        assert _brier([1, 1, 1], [0.0, 0.0, 0.0]) == pytest.approx(1.0)

    def test_brier_range(self):
        import random
        rng = [random.random() for _ in range(100)]
        y = [1 if r > 0.5 else 0 for r in rng]
        assert 0.0 <= _brier(y, rng) <= 1.0

    def test_log_loss_perfect_prediction(self):
        y_true = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        y_pred = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
        ll = _log_loss_3way(y_true, y_pred)
        assert ll < 1e-6   # ≈ 0 (eps-clipped)

    def test_log_loss_uniform_prediction(self):
        # Predicting 1/3 each → log loss ≈ log(3) ≈ 1.099
        y_true = [[1, 0, 0]] * 100
        y_pred = [[1 / 3, 1 / 3, 1 / 3]] * 100
        import math
        ll = _log_loss_3way(y_true, y_pred)
        assert abs(ll - math.log(3)) < 0.01


@pytest.fixture(scope="module")
def bt_result():
    df = generate_mock_matches(n_seasons=3, seed=42)
    return backtest(df, xi=0.0065, min_train_matches=100, window_weeks=4)


# ─── Backtest ─────────────────────────────────────────────────────────────────

class TestBacktest:

    def test_n_matches_positive(self, bt_result):
        assert bt_result.n_matches > 0

    def test_brier_scores_in_range(self, bt_result):
        for attr in ("brier_home", "brier_draw", "brier_away", "brier_avg"):
            val = getattr(bt_result, attr)
            assert 0.0 <= val <= 1.0, f"{attr} = {val}"

    def test_log_loss_positive(self, bt_result):
        assert bt_result.log_loss > 0

    def test_win_rate_in_range(self, bt_result):
        if bt_result.total_bets > 0:
            assert 0.0 <= bt_result.win_rate <= 1.0

    def test_details_length_matches_n_matches(self, bt_result):
        assert len(bt_result.details) == bt_result.n_matches

    def test_detail_has_required_fields(self, bt_result):
        if bt_result.details:
            row = bt_result.details[0]
            for key in ("date", "home", "away", "actual", "true_out", "p_home", "p_draw", "p_away"):
                assert key in row, f"Missing key: {key}"

    def test_too_small_dataset_raises(self):
        df = generate_mock_matches(n_seasons=1)
        with pytest.raises(RuntimeError):
            backtest(df, min_train_matches=10000)  # impossible threshold
