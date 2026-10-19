"""
data_loader.py
--------------
Handles fetching, caching, and standardizing EPL match data from football-data.co.uk.
Falls back to a mock dataset if the download fails and the cache is empty.

Schema (standardized):
    date, home_team, away_team, fthg, ftag, hs, as_, hst, ast, b365h, b365d, b365a, season
"""

import io
import logging
import sqlite3
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import requests

logger = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "epl_matches.db"

SEASON_URLS: dict[str, str] = {
    "2019-20": "https://www.football-data.co.uk/mmz4281/1920/E0.csv",
    "2020-21": "https://www.football-data.co.uk/mmz4281/2021/E0.csv",
    "2021-22": "https://www.football-data.co.uk/mmz4281/2122/E0.csv",
    "2022-23": "https://www.football-data.co.uk/mmz4281/2223/E0.csv",
    "2023-24": "https://www.football-data.co.uk/mmz4281/2324/E0.csv",
    "2024-25": "https://www.football-data.co.uk/mmz4281/2425/E0.csv",
}

# Mapping from football-data.co.uk column names → our schema
COL_MAP: dict[str, str] = {
    "Date":     "date",
    "HomeTeam": "home_team",
    "AwayTeam": "away_team",
    "FTHG":     "fthg",
    "FTAG":     "ftag",
    "HS":       "hs",
    "AS":       "as_",
    "HST":      "hst",
    "AST":      "ast",
    "B365H":    "b365h",
    "B365D":    "b365d",
    "B365A":    "b365a",
}

CRITICAL_COLS = ["date", "home_team", "away_team", "fthg", "ftag"]

# ─── Mock Dataset ─────────────────────────────────────────────────────────────

EPL_TEAMS_2024: list[str] = [
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
    "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich Town",
    "Leicester City", "Liverpool", "Manchester City", "Manchester United",
    "Newcastle United", "Nottingham Forest", "Southampton", "Tottenham",
    "West Ham United", "Wolverhampton",
]


def generate_mock_matches(n_seasons: int = 3, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic EPL match history for offline testing.

    Produces realistic Poisson-distributed goals and correlated odds.
    Each season has 38 matchweeks × 10 fixtures = 380 matches.
    """
    rng = np.random.default_rng(seed)
    teams = EPL_TEAMS_2024
    records: list[dict] = []

    # Assign latent attack/defense strengths per team so ratings are stable
    true_attack  = rng.normal(0.0, 0.4, size=len(teams))
    true_defense = rng.normal(0.0, 0.3, size=len(teams))
    home_advantage = 0.3

    for season_idx in range(n_seasons):
        season_year = 2022 + season_idx
        season_label = f"{season_year}-{str(season_year + 1)[-2:]}"
        season_start = date(season_year, 8, 6)

        for gw in range(38):
            match_date = season_start + timedelta(days=gw * 7)
            order = rng.permutation(len(teams))

            for pair in range(10):
                hi = order[pair * 2]
                ai = order[pair * 2 + 1]
                home, away = teams[hi], teams[ai]

                lam = np.exp(true_attack[hi] + true_defense[ai] + home_advantage)
                mu  = np.exp(true_attack[ai] + true_defense[hi])
                lam = max(0.5, min(lam, 4.0))
                mu  = max(0.3, min(mu,  3.0))

                fthg = int(rng.poisson(lam))
                ftag = int(rng.poisson(mu))

                hs  = int(rng.integers(5, 20))
                as_ = int(rng.integers(3, 16))
                hst = int(min(hs,  rng.integers(2, 9)))
                ast = int(min(as_, rng.integers(1, 7)))

                # Synthetic odds: implied prob + 5% overround, some noise
                p_h = float(np.exp(-lam) * (1 - np.exp(-mu)))  # rough proxy
                p_h = max(0.2, min(p_h, 0.7))
                p_d = 0.27 + rng.uniform(-0.04, 0.04)
                p_a = max(0.05, 1.0 - p_h - p_d)
                marg = 1.05
                b365h = round(marg / p_h, 2)
                b365d = round(marg / p_d, 2)
                b365a = round(marg / p_a, 2)

                records.append({
                    "date":      match_date.isoformat(),
                    "home_team": home,
                    "away_team": away,
                    "fthg":      fthg,
                    "ftag":      ftag,
                    "hs":        hs,
                    "as_":       as_,
                    "hst":       hst,
                    "ast":       ast,
                    "b365h":     b365h,
                    "b365d":     b365d,
                    "b365a":     b365a,
                    "season":    season_label,
                })

    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date").reset_index(drop=True)


# ─── Download & Parsing ───────────────────────────────────────────────────────

def _fetch_season_csv(url: str, timeout: int = 20) -> Optional[pd.DataFrame]:
    """Download a season CSV from football-data.co.uk. Returns None on failure."""
    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        resp = requests.get(url, timeout=timeout, headers={"User-Agent": "EPLModel/1.0"}, verify=False)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), encoding="latin-1")
        return df if not df.empty else None
    except Exception as exc:
        logger.warning("Download failed for %s: %s", url, exc)
        return None


def _standardize(df: pd.DataFrame, season: str) -> pd.DataFrame:
    """Rename columns to schema, coerce types, drop incomplete rows."""
    df = df.rename(columns={k: v for k, v in COL_MAP.items() if k in df.columns})
    available = [c for c in COL_MAP.values() if c in df.columns]
    df = df[available].copy()
    df["season"] = season
    df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")
    df = df.dropna(subset=CRITICAL_COLS)
    df["fthg"] = pd.to_numeric(df["fthg"], errors="coerce").fillna(0).astype(int)
    df["ftag"] = pd.to_numeric(df["ftag"], errors="coerce").fillna(0).astype(int)
    for col in ["b365h", "b365d", "b365a", "hs", "as_", "hst", "ast"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


# ─── SQLite Cache ─────────────────────────────────────────────────────────────

def _init_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            date      TEXT    NOT NULL,
            season    TEXT,
            home_team TEXT    NOT NULL,
            away_team TEXT    NOT NULL,
            fthg      INTEGER NOT NULL,
            ftag      INTEGER NOT NULL,
            hs        REAL,
            as_       REAL,
            hst       REAL,
            ast       REAL,
            b365h     REAL,
            b365d     REAL,
            b365a     REAL
        )
    """)
    conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_match
        ON matches(date, home_team, away_team)
    """)
    conn.commit()
    return conn


def _load_from_db(conn: sqlite3.Connection) -> pd.DataFrame:
    df = pd.read_sql("SELECT * FROM matches ORDER BY date ASC", conn)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
    return df


def _save_to_db(conn: sqlite3.Connection, df: pd.DataFrame) -> None:
    persist_cols = [
        "date", "season", "home_team", "away_team",
        "fthg", "ftag", "hs", "as_", "hst", "ast",
        "b365h", "b365d", "b365a",
    ]
    sub = df[[c for c in persist_cols if c in df.columns]].copy()
    sub["date"] = sub["date"].astype(str)

    # INSERT OR IGNORE to respect the UNIQUE constraint
    for _, row in sub.iterrows():
        placeholders = ", ".join(["?"] * len(row))
        cols = ", ".join(row.index)
        conn.execute(
            f"INSERT OR IGNORE INTO matches ({cols}) VALUES ({placeholders})",
            tuple(row),
        )
    conn.commit()
    logger.info("Saved %d rows to DB (duplicates skipped).", len(sub))


# ─── Public API ───────────────────────────────────────────────────────────────

def load_match_data(
    use_cache: bool = True,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """
    Load EPL match data, preferring the local SQLite cache.

    Fallback chain:
      1. SQLite cache (if use_cache=True and not force_refresh)
      2. Live download from football-data.co.uk
      3. SQLite cache (stale but non-empty)
      4. Built-in mock dataset

    Returns:
        pd.DataFrame with standardized schema, sorted by date ascending.
    """
    conn = _init_db(DB_PATH)

    # 1. Return from cache if fresh enough
    if use_cache and not force_refresh:
        cached = _load_from_db(conn)
        if not cached.empty:
            logger.info("Using SQLite cache: %d matches loaded.", len(cached))
            conn.close()
            return cached

    # 2. Attempt live download
    frames: list[pd.DataFrame] = []
    for season, url in SEASON_URLS.items():
        raw = _fetch_season_csv(url)
        if raw is not None:
            std = _standardize(raw, season)
            if not std.empty:
                frames.append(std)
                logger.info("Season %s: %d matches downloaded.", season, len(std))

    if frames:
        df = pd.concat(frames, ignore_index=True).sort_values("date").reset_index(drop=True)
        try:
            _save_to_db(conn, df)
        except Exception as exc:
            logger.warning("DB save failed: %s", exc)
        conn.close()
        return df

    # 3. Download failed — try stale cache
    cached = _load_from_db(conn)
    conn.close()
    if not cached.empty:
        logger.warning("Download failed; serving stale cache (%d matches).", len(cached))
        return cached

    # 4. Ultimate fallback: mock data
    logger.warning("No data available; generating mock dataset.")
    return generate_mock_matches(n_seasons=3)


def get_team_list(df: pd.DataFrame) -> list[str]:
    """Return sorted list of all unique team names in the dataset."""
    return sorted(set(df["home_team"].tolist()) | set(df["away_team"].tolist()))
