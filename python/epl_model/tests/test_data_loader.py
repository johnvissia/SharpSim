"""Tests for data_loader.py"""

import pandas as pd
import pytest

from data_loader import (
    EPL_TEAMS_2024,
    _standardize,
    generate_mock_matches,
    get_team_list,
)


# ─── Mock Dataset ─────────────────────────────────────────────────────────────

class TestMockDataset:
    def test_shape_one_season(self):
        df = generate_mock_matches(n_seasons=1)
        # 38 gameweeks × 10 fixtures = 380
        assert len(df) == 380

    def test_shape_two_seasons(self):
        df = generate_mock_matches(n_seasons=2)
        assert len(df) == 760

    def test_required_columns_present(self):
        df = generate_mock_matches(n_seasons=1)
        required = ["date", "home_team", "away_team", "fthg", "ftag"]
        for col in required:
            assert col in df.columns, f"Missing column: {col}"

    def test_goals_non_negative(self):
        df = generate_mock_matches(n_seasons=2)
        assert (df["fthg"] >= 0).all()
        assert (df["ftag"] >= 0).all()

    def test_dates_sorted_ascending(self):
        df = generate_mock_matches(n_seasons=2)
        assert df["date"].is_monotonic_increasing

    def test_no_self_matches(self):
        df = generate_mock_matches(n_seasons=1)
        assert (df["home_team"] != df["away_team"]).all()

    def test_exactly_20_teams(self):
        df = generate_mock_matches(n_seasons=1)
        teams = get_team_list(df)
        assert len(teams) == 20

    def test_all_epl_teams_present(self):
        df = generate_mock_matches(n_seasons=1)
        teams = set(get_team_list(df))
        for t in EPL_TEAMS_2024:
            assert t in teams, f"Missing team: {t}"

    def test_odds_positive(self):
        df = generate_mock_matches(n_seasons=1)
        for col in ["b365h", "b365d", "b365a"]:
            assert (df[col] > 1.0).all(), f"Odds column {col} has invalid values"

    def test_season_label_present(self):
        df = generate_mock_matches(n_seasons=2)
        assert "season" in df.columns
        assert df["season"].nunique() == 2

    def test_reproducible_with_seed(self):
        df1 = generate_mock_matches(n_seasons=1, seed=0)
        df2 = generate_mock_matches(n_seasons=1, seed=0)
        pd.testing.assert_frame_equal(df1, df2)

    def test_different_seeds_produce_different_data(self):
        df1 = generate_mock_matches(n_seasons=1, seed=0)
        df2 = generate_mock_matches(n_seasons=1, seed=99)
        assert not df1["fthg"].equals(df2["fthg"])


# ─── Standardize ──────────────────────────────────────────────────────────────

class TestStandardize:
    def _raw_df(self):
        return pd.DataFrame({
            "Date":     ["01/08/2023", "05/08/2023"],
            "HomeTeam": ["Arsenal",    "Chelsea"],
            "AwayTeam": ["Chelsea",    "Arsenal"],
            "FTHG":     [2,            1],
            "FTAG":     [1,            1],
            "HS":       [12,           8],
            "AS":       [6,            11],
            "HST":      [5,            3],
            "AST":      [2,            4],
            "B365H":    [1.90,         2.80],
            "B365D":    [3.50,         3.30],
            "B365A":    [4.20,         2.50],
        })

    def test_column_renaming(self):
        std = _standardize(self._raw_df(), "2023-24")
        assert "home_team" in std.columns
        assert "fthg" in std.columns
        assert "b365h" in std.columns

    def test_date_parsed(self):
        std = _standardize(self._raw_df(), "2023-24")
        assert pd.api.types.is_datetime64_any_dtype(std["date"])

    def test_season_column_added(self):
        std = _standardize(self._raw_df(), "2023-24")
        assert (std["season"] == "2023-24").all()

    def test_goals_are_int(self):
        std = _standardize(self._raw_df(), "2023-24")
        assert std["fthg"].dtype == int
        assert std["ftag"].dtype == int


# ─── get_team_list ────────────────────────────────────────────────────────────

class TestGetTeamList:
    def test_sorted(self):
        df = generate_mock_matches(n_seasons=1)
        teams = get_team_list(df)
        assert teams == sorted(teams)

    def test_includes_home_and_away(self):
        df = pd.DataFrame({
            "home_team": ["Arsenal", "Chelsea"],
            "away_team": ["Liverpool", "Arsenal"],
        })
        teams = get_team_list(df)
        assert set(teams) == {"Arsenal", "Chelsea", "Liverpool"}
