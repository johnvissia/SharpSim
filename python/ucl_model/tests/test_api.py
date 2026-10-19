"""API integration tests for UCL model"""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

import main as ucl_main
from data_loader import generate_mock_ucl_matches
from ucl_engine import fit_ucl_model


@pytest.fixture(scope="module")
def client():
    df = generate_mock_ucl_matches(n_seasons=2, seed=42)
    model = fit_ucl_model(df, xi=0.0065, max_iter=150)

    with (
        patch("main.load_ucl_data", return_value=df),
        patch("main.fit_ucl_model", return_value=model),
    ):
        with TestClient(ucl_main.app) as c:
            yield c


def test_health(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_teams_endpoint(client):
    resp = client.get("/api/v1/ucl/teams")
    assert resp.status_code == 200
    teams = resp.json()["teams"]
    assert len(teams) >= 30
    names = [t["team"] for t in teams]
    assert "Real Madrid" in names


def test_predict_endpoint(client):
    resp = client.get(
        "/api/v1/ucl/predict",
        params={
            "home": "Real Madrid",
            "away": "Manchester City",
            "odds_h": 2.40,
            "odds_d": 3.40,
            "odds_a": 2.80,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["home_team"] == "Real Madrid"
    assert data["away_team"] == "Manchester City"
    assert "lambda_home" in data
    assert "p_btts_yes" in data
    assert len(data["signals"]) == 3


def test_predict_case_insensitive(client):
    resp = client.get(
        "/api/v1/ucl/predict",
        params={"home": "bayern munich", "away": "arsenal"},
    )
    assert resp.status_code == 200
    assert resp.json()["home_team"] == "Bayern Munich"


def test_predict_neutral_venue(client):
    resp = client.get(
        "/api/v1/ucl/predict",
        params={"home": "Real Madrid", "away": "Borussia Dortmund", "neutral": True},
    )
    assert resp.status_code == 200
    assert resp.json()["is_neutral_venue"] is True
