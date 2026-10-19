"""
data_loader.py (UCL Model)
--------------------------
Handles loading, caching, and standardizing UEFA Champions League match data
and UEFA club strength ratings.

Schema:
    date, home_team, away_team, fthg, ftag, home_league, away_league,
    b365h, b365d, b365a, season, stage, neutral_venue
"""

import logging
import sqlite3
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "ucl_matches.db"

# ─── UEFA League Quality Coefficients ──────────────────────────────────────────
# UEFA Country 5-year coefficient normalized strength factor
LEAGUE_COEFFICIENTS: dict[str, float] = {
    "Premier League": 1.00,
    "La Liga":        0.96,
    "Serie A":        0.93,
    "Bundesliga":     0.93,
    "Ligue 1":        0.85,
    "Liga Portugal":  0.78,
    "Eredivisie":     0.76,
    "Belgian Pro":    0.72,
    "Scottish Prem":  0.65,
    "Rest of Europe": 0.60,
}

# ─── Top 36 Modern UCL Clubs & Associated League / Baseline Elo ───────────────
UCL_CLUBS_DATA: dict[str, dict] = {
    "Real Madrid":          {"league": "La Liga",        "base_elo": 1980, "country": "Spain"},
    "Manchester City":      {"league": "Premier League", "base_elo": 2020, "country": "England"},
    "Bayern Munich":        {"league": "Bundesliga",     "base_elo": 1940, "country": "Germany"},
    "Arsenal":              {"league": "Premier League", "base_elo": 1930, "country": "England"},
    "Liverpool":            {"league": "Premier League", "base_elo": 1945, "country": "England"},
    "Barcelona":            {"league": "La Liga",        "base_elo": 1910, "country": "Spain"},
    "Inter Milan":          {"league": "Serie A",        "base_elo": 1925, "country": "Italy"},
    "Paris Saint-Germain":  {"league": "Ligue 1",        "base_elo": 1895, "country": "France"},
    "Bayer Leverkusen":     {"league": "Bundesliga",     "base_elo": 1910, "country": "Germany"},
    "Atletico Madrid":      {"league": "La Liga",        "base_elo": 1885, "country": "Spain"},
    "Borussia Dortmund":    {"league": "Bundesliga",     "base_elo": 1870, "country": "Germany"},
    "Juventus":             {"league": "Serie A",        "base_elo": 1860, "country": "Italy"},
    "AC Milan":             {"league": "Serie A",        "base_elo": 1850, "country": "Italy"},
    "Atalanta":             {"league": "Serie A",        "base_elo": 1845, "country": "Italy"},
    "Sporting CP":          {"league": "Liga Portugal",  "base_elo": 1840, "country": "Portugal"},
    "Aston Villa":          {"league": "Premier League", "base_elo": 1835, "country": "England"},
    "RB Leipzig":           {"league": "Bundesliga",     "base_elo": 1830, "country": "Germany"},
    "Benfica":              {"league": "Liga Portugal",  "base_elo": 1820, "country": "Portugal"},
    "Monaco":               {"league": "Ligue 1",        "base_elo": 1810, "country": "France"},
    "PSV Eindhoven":        {"league": "Eredivisie",     "base_elo": 1805, "country": "Netherlands"},
    "Feyenoord":            {"league": "Eredivisie",     "base_elo": 1785, "country": "Netherlands"},
    "Lille":                {"league": "Ligue 1",        "base_elo": 1780, "country": "France"},
    "Stuttgart":            {"league": "Bundesliga",     "base_elo": 1775, "country": "Germany"},
    "Bologna":              {"league": "Serie A",        "base_elo": 1770, "country": "Italy"},
    "Girona":               {"league": "La Liga",        "base_elo": 1765, "country": "Spain"},
    "Club Brugge":          {"league": "Belgian Pro",    "base_elo": 1750, "country": "Belgium"},
    "Celtic":               {"league": "Scottish Prem",  "base_elo": 1740, "country": "Scotland"},
    "Shakhtar Donetsk":     {"league": "Rest of Europe", "base_elo": 1730, "country": "Ukraine"},
    "Dinamo Zagreb":        {"league": "Rest of Europe", "base_elo": 1720, "country": "Croatia"},
    "Salzburg":             {"league": "Rest of Europe", "base_elo": 1715, "country": "Austria"},
    "Sparta Prague":        {"league": "Rest of Europe", "base_elo": 1710, "country": "Czechia"},
    "Red Star Belgrade":    {"league": "Rest of Europe", "base_elo": 1700, "country": "Serbia"},
    "Sturm Graz":           {"league": "Rest of Europe", "base_elo": 1690, "country": "Austria"},
    "Brest":                {"league": "Ligue 1",        "base_elo": 1725, "country": "France"},
    "Young Boys":           {"league": "Rest of Europe", "base_elo": 1680, "country": "Switzerland"},
    "Slovan Bratislava":    {"league": "Rest of Europe", "base_elo": 1650, "country": "Slovakia"},
    "Como":                 {"league": "Serie A",        "base_elo": 1720, "country": "Italy"},
    "LASK Linz":            {"league": "Rest of Europe", "base_elo": 1690, "country": "Austria"},
    "AS Roma":              {"league": "Serie A",        "base_elo": 1820, "country": "Italy"},
    "Fenerbahce":           {"league": "Rest of Europe", "base_elo": 1750, "country": "Turkey"},
    "Bodo/Glimt":           {"league": "Rest of Europe", "base_elo": 1720, "country": "Norway"},
    "FC Porto":             {"league": "Liga Portugal",  "base_elo": 1820, "country": "Portugal"},
    "Real Betis":           {"league": "La Liga",        "base_elo": 1790, "country": "Spain"},
    "AEK Athens":           {"league": "Rest of Europe", "base_elo": 1680, "country": "Greece"},
}

UCL_TEAMS: list[str] = sorted(list(UCL_CLUBS_DATA.keys()))

UCL_ALIASES: dict[str, str] = {
    "feyenoord rotterdam": "Feyenoord",
    "vfb stuttgart": "Stuttgart",
    "vfb stuttgart 1893": "Stuttgart",
    "roma": "AS Roma",
    "as roma": "AS Roma",
    "porto": "FC Porto",
    "fc porto": "FC Porto",
    "bodø/glimt": "Bodo/Glimt",
    "bodo/glimt": "Bodo/Glimt",
    "bodo glimt": "Bodo/Glimt",
    "fenerbahçe": "Fenerbahce",
    "fenerbahce": "Fenerbahce",
    "paris sg": "Paris Saint-Germain",
    "psg": "Paris Saint-Germain",
    "paris saint germain": "Paris Saint-Germain",
    "man city": "Manchester City",
    "manchester city fc": "Manchester City",
    "dortmund": "Borussia Dortmund",
    "bvb": "Borussia Dortmund",
    "atletico": "Atletico Madrid",
    "atlético madrid": "Atletico Madrid",
    "inter": "Inter Milan",
    "internazionale": "Inter Milan",
    "leverkusen": "Bayer Leverkusen",
    "leipzig": "RB Leipzig",
    "sporting": "Sporting CP",
    "sporting lisbon": "Sporting CP",
    "villa": "Aston Villa",
    "lask": "LASK Linz",
    "lask linz": "LASK Linz",
    "shakhtar": "Shakhtar Donetsk",
    "slovan": "Slovan Bratislava",
    "betis": "Real Betis",
    "real betis balompie": "Real Betis",
    "como 1907": "Como",
}


def normalize_ucl_team_name(name: str) -> str:
    cleaned = name.lower().strip()
    if cleaned in UCL_ALIASES:
        return UCL_ALIASES[cleaned]
    for k, v in UCL_ALIASES.items():
        if k in cleaned:
            return v
    for team in UCL_TEAMS:
        if team.lower() == cleaned or team.lower() in cleaned or cleaned in team.lower():
            return team
    return name.strip()



# ─── Mock Generator ───────────────────────────────────────────────────────────

def generate_mock_ucl_matches(n_seasons: int = 3, seed: int = 42) -> pd.DataFrame:
    """
    Generate realistic multi-season Champions League match history.
    Simulates the modern Swiss-stage / League Phase (8 matchweeks) + knockouts.
    """
    rng = np.random.default_rng(seed)
    records: list[dict] = []
    teams = UCL_TEAMS

    for season_idx in range(n_seasons):
        season_year = 2022 + season_idx
        season_label = f"{season_year}-{str(season_year + 1)[-2:]}"
        season_start = date(season_year, 9, 15)

        # 8 matchdays of League Phase: 18 fixtures each matchday (36 teams)
        for md in range(8):
            md_date = season_start + timedelta(days=md * 14)
            order = rng.permutation(len(teams))
            for i in range(18):
                h_idx = order[i * 2]
                a_idx = order[i * 2 + 1]
                home = teams[h_idx]
                away = teams[a_idx]

                h_data = UCL_CLUBS_DATA[home]
                a_data = UCL_CLUBS_DATA[away]

                # Elo difference
                elo_diff = h_data["base_elo"] - a_data["base_elo"]
                h_coeff = LEAGUE_COEFFICIENTS.get(h_data["league"], 0.7)
                a_coeff = LEAGUE_COEFFICIENTS.get(a_data["league"], 0.7)

                # Expected goals incorporating home advantage and cross-league coefficient
                lam = np.exp(0.20 + (elo_diff / 500.0) + (h_coeff - a_coeff) * 0.4 + 0.28)
                mu  = np.exp(0.05 - (elo_diff / 500.0) + (a_coeff - h_coeff) * 0.4)
                lam = max(0.4, min(lam, 4.5))
                mu  = max(0.2, min(mu,  3.5))

                fthg = int(rng.poisson(lam))
                ftag = int(rng.poisson(mu))

                # Synthetic odds
                p_h = max(0.15, min(0.75, 1.0 / (1.0 + 10 ** (-elo_diff / 400.0)) * 0.90 + 0.08))
                p_d = max(0.18, 0.28 - abs(elo_diff) / 3000.0)
                p_a = max(0.10, 1.0 - p_h - p_d)
                overround = 1.05
                b365h = round(overround / p_h, 2)
                b365d = round(overround / p_d, 2)
                b365a = round(overround / p_a, 2)

                records.append({
                    "date":          md_date.isoformat(),
                    "home_team":     home,
                    "away_team":     away,
                    "fthg":          fthg,
                    "ftag":          ftag,
                    "home_league":   h_data["league"],
                    "away_league":   a_data["league"],
                    "b365h":         b365h,
                    "b365d":         b365d,
                    "b365a":         b365a,
                    "season":        season_label,
                    "stage":         "league_phase",
                    "neutral_venue": 0,
                })

        # Knockout Rounds (R16, QF, SF, Final)
        ko_date = season_start + timedelta(days=8 * 14 + 30)
        top_teams = sorted(teams, key=lambda t: UCL_CLUBS_DATA[t]["base_elo"], reverse=True)[:16]
        for round_name, n_ties in [("R16", 8), ("QF", 4), ("SF", 2)]:
            ko_date += timedelta(days=21)
            rng.shuffle(top_teams)
            for tie in range(n_ties):
                h, a = top_teams[tie * 2], top_teams[tie * 2 + 1]
                # Leg 1
                records.append({
                    "date":          ko_date.isoformat(),
                    "home_team":     h, "away_team": a,
                    "fthg":          int(rng.poisson(1.5)), "ftag": int(rng.poisson(1.2)),
                    "home_league":   UCL_CLUBS_DATA[h]["league"], "away_league": UCL_CLUBS_DATA[a]["league"],
                    "b365h":         2.10, "b365d": 3.40, "b365a": 3.60,
                    "season":        season_label, "stage": round_name, "neutral_venue": 0,
                })
                # Leg 2
                records.append({
                    "date":          (ko_date + timedelta(days=14)).isoformat(),
                    "home_team":     a, "away_team": h,
                    "fthg":          int(rng.poisson(1.6)), "ftag": int(rng.poisson(1.1)),
                    "home_league":   UCL_CLUBS_DATA[a]["league"], "away_league": UCL_CLUBS_DATA[h]["league"],
                    "b365h":         2.05, "b365d": 3.45, "b365a": 3.70,
                    "season":        season_label, "stage": round_name, "neutral_venue": 0,
                })

        # Final (Neutral Venue)
        final_date = ko_date + timedelta(days=35)
        records.append({
            "date":          final_date.isoformat(),
            "home_team":     top_teams[0], "away_team": top_teams[1],
            "fthg":          int(rng.poisson(1.4)), "ftag": int(rng.poisson(1.3)),
            "home_league":   UCL_CLUBS_DATA[top_teams[0]]["league"],
            "away_league":   UCL_CLUBS_DATA[top_teams[1]]["league"],
            "b365h":         2.30, "b365d": 3.30, "b365a": 3.20,
            "season":        season_label, "stage": "Final", "neutral_venue": 1,
        })

    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date").reset_index(drop=True)


# ─── SQLite Cache ─────────────────────────────────────────────────────────────

def _init_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ucl_matches (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            date          TEXT    NOT NULL,
            season        TEXT,
            stage         TEXT,
            home_team     TEXT    NOT NULL,
            away_team     TEXT    NOT NULL,
            home_league   TEXT,
            away_league   TEXT,
            fthg          INTEGER NOT NULL,
            ftag          INTEGER NOT NULL,
            b365h         REAL,
            b365d         REAL,
            b365a         REAL,
            neutral_venue INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_ucl_match
        ON ucl_matches(date, home_team, away_team)
    """)
    conn.commit()
    return conn


def _load_from_db(conn: sqlite3.Connection) -> pd.DataFrame:
    df = pd.read_sql("SELECT * FROM ucl_matches ORDER BY date ASC", conn)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
    return df


def _save_to_db(conn: sqlite3.Connection, df: pd.DataFrame) -> None:
    persist_cols = [
        "date", "season", "stage", "home_team", "away_team",
        "home_league", "away_league", "fthg", "ftag",
        "b365h", "b365d", "b365a", "neutral_venue",
    ]
    sub = df[[c for c in persist_cols if c in df.columns]].copy()
    sub["date"] = sub["date"].astype(str)

    for _, row in sub.iterrows():
        placeholders = ", ".join(["?"] * len(row))
        cols = ", ".join(row.index)
        conn.execute(
            f"INSERT OR IGNORE INTO ucl_matches ({cols}) VALUES ({placeholders})",
            tuple(row),
        )
    conn.commit()


# ─── Public API ───────────────────────────────────────────────────────────────

def load_ucl_data(use_cache: bool = True, force_refresh: bool = False) -> pd.DataFrame:
    """Load UCL historical match dataset, preferring SQLite cache with mock fallback."""
    conn = _init_db(DB_PATH)

    if use_cache and not force_refresh:
        cached = _load_from_db(conn)
        if not cached.empty:
            conn.close()
            return cached

    # Populate with baseline mock if empty
    mock_df = generate_mock_ucl_matches(n_seasons=3)
    try:
        _save_to_db(conn, mock_df)
    except Exception as exc:
        logger.warning("DB save warning: %s", exc)
    conn.close()
    return mock_df


def get_ucl_teams(df: Optional[pd.DataFrame] = None) -> list[str]:
    """Return list of known UCL clubs."""
    if df is not None and not df.empty:
        return sorted(set(df["home_team"]) | set(df["away_team"]))
    return UCL_TEAMS
