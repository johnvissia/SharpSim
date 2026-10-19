"""Tests for the FastAPI endpoints in main.py"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import main as main_module
from data_loader import generate_mock_matches
from dixon_coles import fit_model


# ─── Module-scoped client ─────────────────────────────────────────────────────
# We patch load_match_data and fit_model so the lifespan startup
# uses mock data instead of attempting a live download.

@pytest.fixture(scope="module")
def client():
    df    = generate_mock_matches(n_seasons=2, seed=42)
    model = fit_model(df, xi=0.0065, max_iter=150)

    with (
        patch("main.load_match_data", return_value=df),
        patch("main.fit_model",       return_value=model),
    ):
        with TestClient(main_module.app) as c:
            yield c


# ─── Health ───────────────────────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_status_ok(self, client):
        resp = client.get("/")
        assert resp.json()["status"] == "ok"

    def test_version_present(self, client):
        resp = client.get("/")
        assert "version" in resp.json()


# ─── Model Info ───────────────────────────────────────────────────────────────

class TestModelInfo:
    def test_status_ready(self, client):
        resp = client.get("/api/v1/epl/info")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ready"

    def test_twenty_teams(self, client):
        resp = client.get("/api/v1/epl/info")
        assert resp.json()["n_teams"] == 20

    def test_n_matches_positive(self, client):
        resp = client.get("/api/v1/epl/info")
        assert resp.json()["n_matches"] > 0

    def test_home_advantage_positive(self, client):
        resp = client.get("/api/v1/epl/info")
        assert resp.json()["home_advantage"] > 0


# ─── Teams ────────────────────────────────────────────────────────────────────

class TestTeamsEndpoint:
    def test_returns_20_teams(self, client):
        resp = client.get("/api/v1/epl/teams")
        assert resp.status_code == 200
        assert len(resp.json()["teams"]) == 20

    def test_required_team_fields(self, client):
        resp = client.get("/api/v1/epl/teams")
        team = resp.json()["teams"][0]
        for field in ("team", "attack", "defense", "attack_exp", "defense_exp"):
            assert field in team

    def test_attack_exp_positive(self, client):
        resp = client.get("/api/v1/epl/teams")
        for team in resp.json()["teams"]:
            assert team["attack_exp"] > 0

    def test_home_advantage_in_response(self, client):
        resp = client.get("/api/v1/epl/teams")
        assert "home_advantage" in resp.json()


# ─── Predict ──────────────────────────────────────────────────────────────────

class TestPredictEndpoint:
    def test_basic_prediction(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Arsenal", "away": "Chelsea"})
        assert resp.status_code == 200

    def test_probs_sum_to_one(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Arsenal", "away": "Chelsea"})
        d = resp.json()
        total = d["p_home"] + d["p_draw"] + d["p_away"]
        assert abs(total - 1.0) < 0.001

    def test_over_under_sum_to_one(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Arsenal", "away": "Chelsea"})
        d = resp.json()
        assert abs(d["p_over25"] + d["p_under25"] - 1.0) < 0.001

    def test_xg_positive(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Arsenal", "away": "Chelsea"})
        d = resp.json()
        assert d["lambda_home"] > 0
        assert d["lambda_away"] > 0

    def test_score_matrix_6x6(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Arsenal", "away": "Chelsea"})
        mat = resp.json()["score_matrix"]
        assert len(mat) == 6
        assert all(len(row) == 6 for row in mat)

    def test_most_likely_score_format(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Arsenal", "away": "Chelsea"})
        score = resp.json()["most_likely_score"]
        parts = score.split("-")
        assert len(parts) == 2
        assert all(p.isdigit() for p in parts)

    def test_signals_returned_with_odds(self, client):
        resp = client.get(
            "/api/v1/epl/predict",
            params={"home": "Arsenal", "away": "Chelsea", "odds_h": 2.1, "odds_d": 3.4, "odds_a": 3.6},
        )
        sigs = resp.json()["signals"]
        assert len(sigs) == 3
        outcomes = {s["outcome"] for s in sigs}
        assert outcomes == {"home", "draw", "away"}

    def test_signal_fields_present(self, client):
        resp = client.get(
            "/api/v1/epl/predict",
            params={"home": "Arsenal", "away": "Chelsea", "odds_h": 2.1, "odds_d": 3.4, "odds_a": 3.6},
        )
        sig = resp.json()["signals"][0]
        for field in ("outcome", "signal", "label", "p_model", "edge", "stake_pct", "fair_odds"):
            assert field in sig

    def test_no_signals_without_odds(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Arsenal", "away": "Chelsea"})
        assert resp.json()["signals"] == []

    def test_case_insensitive_team_name(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "arsenal", "away": "CHELSEA"})
        assert resp.status_code == 200
        assert resp.json()["home_team"] == "Arsenal"

    def test_unknown_home_team_returns_404(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Fake FC", "away": "Arsenal"})
        assert resp.status_code == 404

    def test_unknown_away_team_returns_404(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Arsenal", "away": "Ghost Utd"})
        assert resp.status_code == 404

    def test_same_team_returns_400(self, client):
        resp = client.get("/api/v1/epl/predict", params={"home": "Arsenal", "away": "Arsenal"})
        assert resp.status_code == 400

    def test_missing_home_returns_422(self, client):
        resp = client.get("/api/v1/epl/predict", params={"away": "Arsenal"})
        assert resp.status_code == 422

    def test_invalid_odds_too_low_returns_422(self, client):
        resp = client.get(
            "/api/v1/epl/predict",
            params={"home": "Arsenal", "away": "Chelsea", "odds_h": 0.5},
        )
        assert resp.status_code == 422


# ─── Backtest ─────────────────────────────────────────────────────────────────

class TestBacktestEndpoint:
    def test_basic_backtest(self, client):
        resp = client.post(
            "/api/v1/epl/backtest",
            json={"xi": 0.0065, "min_train_matches": 100, "edge_threshold": 0.04, "window_weeks": 4},
        )
        assert resp.status_code == 200

    def test_response_fields_present(self, client):
        resp = client.post(
            "/api/v1/epl/backtest",
            json={"min_train_matches": 100, "window_weeks": 4},
        )
        d = resp.json()
        for field in ("n_matches", "brier_avg", "log_loss", "roi_overall", "total_bets", "win_rate"):
            assert field in d

    def test_brier_in_valid_range(self, client):
        resp = client.post(
            "/api/v1/epl/backtest",
            json={"min_train_matches": 100, "window_weeks": 4},
        )
        assert 0.0 <= resp.json()["brier_avg"] <= 1.0

    def test_log_loss_positive(self, client):
        resp = client.post(
            "/api/v1/epl/backtest",
            json={"min_train_matches": 100, "window_weeks": 4},
        )
        assert resp.json()["log_loss"] > 0

    def test_invalid_xi_returns_422(self, client):
        resp = client.post("/api/v1/epl/backtest", json={"xi": 99.0})
        assert resp.status_code == 422


# ─── Refresh ──────────────────────────────────────────────────────────────────

class TestRefreshEndpoint:
    def test_returns_200(self, client):
        resp = client.post("/api/v1/epl/refresh")
        assert resp.status_code == 200

    def test_status_scheduled(self, client):
        resp = client.post("/api/v1/epl/refresh")
        assert resp.json()["status"] == "scheduled"
