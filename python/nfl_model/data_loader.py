"""
data_loader.py
--------------
NFL Data Loader for SharpSim NFL Predictive Simulation Model.
Handles:
- Loading team baselines, opponent-adjusted rolling EPA per play splits,
  Success Rates, and QB/OL depth chart rankings.
- Fetching matchups and live consensus lines from The Odds API.
- Fetching schedule, kickoff times, and venue metadata from ESPN.
- Ingesting official NFL injury reports from ESPN public API.
- Fetching live weather/wind forecasts via Open-Meteo for outdoor venues.
"""

import json
import logging
import math
import os
import urllib.request
import urllib.parse
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

ODDS_API_KEY = os.environ.get("ODDS_API_KEY") or os.environ.get("NEXT_PUBLIC_ODDS_API_KEY", "")

# Standard 32 NFL Teams with Canonical Names and Abbreviations
NFL_TEAM_ABBR_TO_NAME: Dict[str, str] = {
    "ARI": "Arizona Cardinals",
    "ATL": "Atlanta Falcons",
    "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills",
    "CAR": "Carolina Panthers",
    "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals",
    "CLE": "Cleveland Browns",
    "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos",
    "DET": "Detroit Lions",
    "GB":  "Green Bay Packers",
    "HOU": "Houston Texans",
    "IND": "Indianapolis Colts",
    "JAX": "Jacksonville Jaguars",
    "KC":  "Kansas City Chiefs",
    "LV":  "Las Vegas Raiders",
    "LAC": "Los Angeles Chargers",
    "LAR": "Los Angeles Rams",
    "MIA": "Miami Dolphins",
    "MIN": "Minnesota Vikings",
    "NE":  "New England Patriots",
    "NO":  "New Orleans Saints",
    "NYG": "New York Giants",
    "NYJ": "New York Jets",
    "PHI": "Philadelphia Eagles",
    "PIT": "Pittsburgh Steelers",
    "SF":  "San Francisco 49ers",
    "SEA": "Seattle Seahawks",
    "TB":  "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans",
    "WAS": "Washington Commanders",
}

NFL_NAME_TO_ABBR: Dict[str, str] = {name: abbr for abbr, name in NFL_TEAM_ABBR_TO_NAME.items()}

# Common aliases and ESPN quirks
NFL_ALIASES: Dict[str, str] = {
    "ARIZONA": "ARI",
    "ATLANTA": "ATL",
    "BALTIMORE": "BAL",
    "BUFFALO": "BUF",
    "CAROLINA": "CAR",
    "CHICAGO": "CHI",
    "CINCINNATI": "CIN",
    "CLEVELAND": "CLE",
    "DALLAS": "DAL",
    "DENVER": "DEN",
    "DETROIT": "DET",
    "GREEN BAY": "GB",
    "HOUSTON": "HOU",
    "INDIANAPOLIS": "IND",
    "JACKSONVILLE": "JAX",
    "KANSAS CITY": "KC",
    "LAS VEGAS": "LV",
    "LA CHARGERS": "LAC",
    "LOS ANGELES CHARGERS": "LAC",
    "LA RAMS": "LAR",
    "LOS ANGELES RAMS": "LAR",
    "MIAMI": "MIA",
    "MINNESOTA": "MIN",
    "NEW ENGLAND": "NE",
    "NEW ORLEANS": "NO",
    "NY GIANTS": "NYG",
    "NEW YORK GIANTS": "NYG",
    "NY JETS": "NYJ",
    "NEW YORK JETS": "NYJ",
    "PHILADELPHIA": "PHI",
    "PITTSBURGH": "PIT",
    "SAN FRANCISCO": "SF",
    "SEATTLE": "SEA",
    "TAMPA BAY": "TB",
    "TENNESSEE": "TEN",
    "WASHINGTON": "WAS",
    "WSH": "WAS",
    # Mascot-only
    "CARDINALS": "ARI",
    "FALCONS": "ATL",
    "RAVENS": "BAL",
    "BILLS": "BUF",
    "PANTHERS": "CAR",
    "BEARS": "CHI",
    "BENGALS": "CIN",
    "BROWNS": "CLE",
    "COWBOYS": "DAL",
    "BRONCOS": "DEN",
    "LIONS": "DET",
    "PACKERS": "GB",
    "TEXANS": "HOU",
    "COLTS": "IND",
    "JAGUARS": "JAX",
    "CHIEFS": "KC",
    "RAIDERS": "LV",
    "CHARGERS": "LAC",
    "RAMS": "LAR",
    "DOLPHINS": "MIA",
    "VIKINGS": "MIN",
    "PATRIOTS": "NE",
    "SAINTS": "NO",
    "GIANTS": "NYG",
    "JETS": "NYJ",
    "EAGLES": "PHI",
    "STEELERS": "PIT",
    "49ERS": "SF",
    "NINERS": "SF",
    "SEAHAWKS": "SEA",
    "BUCCANEERS": "TB",
    "BUCS": "TB",
    "TITANS": "TEN",
    "COMMANDERS": "WAS",
}


def canonical_abbr(raw: str) -> str:
    """Resolve team name, alias, or abbreviation to canonical 2-3 char code."""
    if not raw:
        return ""
    upper = raw.strip().upper()
    if upper in NFL_TEAM_ABBR_TO_NAME:
        return upper
    if upper in NFL_ALIASES:
        return NFL_ALIASES[upper]
    # Check if inside full name
    for name, abbr in NFL_NAME_TO_ABBR.items():
        if upper == name.upper():
            return abbr
    return ""


def canonical_name(raw: str) -> str:
    """Resolve any team representation to full display name (e.g. 'Detroit Lions')."""
    abbr = canonical_abbr(raw)
    return NFL_TEAM_ABBR_TO_NAME.get(abbr, raw)


@dataclass
class StadiumInfo:
    name: str
    city: str
    state: str
    is_dome: bool
    surface: str  # 'grass' | 'turf'
    elevation_m: float
    latitude: float
    longitude: float
    timezone_offset_hours: int  # relative to ET: ET=0, CT=-1, MT=-2, PT=-3


@dataclass
class QBDepthChart:
    starter_name: str
    starter_tier: int  # 1: Elite, 2: Pro Bowl, 3: Average, 4: Bridge/Low
    starter_rating: float  # Points above replacement
    backup_name: str
    backup_rating: float
    downgrade_points: float  # Starter - Backup spread downgrade penalty


@dataclass
class TeamBaseline:
    abbr: str
    name: str
    stadium: StadiumInfo
    qb: QBDepthChart
    pass_off_epa: float       # Opponent-adjusted rolling EPA/pass play
    rush_off_epa: float       # Opponent-adjusted rolling EPA/rush play
    pass_def_epa: float       # Opponent-adjusted rolling EPA/pass play allowed (negative is good)
    rush_def_epa: float       # Opponent-adjusted rolling EPA/rush play allowed (negative is good)
    success_rate: float       # Offensive success rate (0.38 - 0.52)
    neutral_pass_rate: float  # Pass play rate in neutral game scripts (0.48 - 0.64)
    pace_sec_per_play: float  # Neutral situational seconds per play (25.5 - 29.5)


# Baseline 32 NFL Teams with opponent-adjusted rolling EPA splits and depth charts
NFL_BASELINES: Dict[str, TeamBaseline] = {
    "ARI": TeamBaseline(
        abbr="ARI", name="Arizona Cardinals",
        stadium=StadiumInfo("State Farm Stadium", "Glendale", "AZ", True, "grass", 351, 33.5276, -112.2626, -3),
        qb=QBDepthChart("Kyler Murray", 3, 3.8, "Clayton Tune", 0.0, 3.8),
        pass_off_epa=0.06, rush_off_epa=0.04, pass_def_epa=0.09, rush_def_epa=0.02,
        success_rate=0.442, neutral_pass_rate=0.54, pace_sec_per_play=27.2
    ),
    "ATL": TeamBaseline(
        abbr="ATL", name="Atlanta Falcons",
        stadium=StadiumInfo("Mercedes-Benz Stadium", "Atlanta", "GA", True, "turf", 320, 33.7554, -84.4008, 0),
        qb=QBDepthChart("Kirk Cousins", 3, 3.9, "Michael Penix Jr.", 0.8, 3.1),
        pass_off_epa=0.09, rush_off_epa=-0.01, pass_def_epa=0.05, rush_def_epa=0.01,
        success_rate=0.450, neutral_pass_rate=0.57, pace_sec_per_play=27.6
    ),
    "BAL": TeamBaseline(
        abbr="BAL", name="Baltimore Ravens",
        stadium=StadiumInfo("M&T Bank Stadium", "Baltimore", "MD", False, "grass", 10, 39.2780, -76.6227, 0),
        qb=QBDepthChart("Lamar Jackson", 1, 7.2, "Josh Johnson", 0.0, 7.2),
        pass_off_epa=0.22, rush_off_epa=0.14, pass_def_epa=0.04, rush_def_epa=-0.15,
        success_rate=0.505, neutral_pass_rate=0.49, pace_sec_per_play=28.5
    ),
    "BUF": TeamBaseline(
        abbr="BUF", name="Buffalo Bills",
        stadium=StadiumInfo("Highmark Stadium", "Orchard Park", "NY", False, "turf", 250, 42.7738, -78.7870, 0),
        qb=QBDepthChart("Josh Allen", 1, 7.4, "Mitchell Trubisky", 0.2, 7.2),
        pass_off_epa=0.20, rush_off_epa=0.08, pass_def_epa=-0.02, rush_def_epa=0.01,
        success_rate=0.492, neutral_pass_rate=0.55, pace_sec_per_play=27.1
    ),
    "CAR": TeamBaseline(
        abbr="CAR", name="Carolina Panthers",
        stadium=StadiumInfo("Bank of America Stadium", "Charlotte", "NC", False, "turf", 220, 35.2258, -80.8528, 0),
        qb=QBDepthChart("Andy Dalton", 4, 2.2, "Bryce Young", 0.4, 1.8),
        pass_off_epa=-0.12, rush_off_epa=-0.06, pass_def_epa=0.16, rush_def_epa=0.11,
        success_rate=0.388, neutral_pass_rate=0.58, pace_sec_per_play=26.8
    ),
    "CHI": TeamBaseline(
        abbr="CHI", name="Chicago Bears",
        stadium=StadiumInfo("Soldier Field", "Chicago", "IL", False, "grass", 181, 41.8623, -87.6167, -1),
        qb=QBDepthChart("Caleb Williams", 3, 3.5, "Tyson Bagent", 0.5, 3.0),
        pass_off_epa=0.02, rush_off_epa=-0.04, pass_def_epa=-0.09, rush_def_epa=-0.03,
        success_rate=0.435, neutral_pass_rate=0.56, pace_sec_per_play=27.0
    ),
    "CIN": TeamBaseline(
        abbr="CIN", name="Cincinnati Bengals",
        stadium=StadiumInfo("Paycor Stadium", "Cincinnati", "OH", False, "turf", 152, 39.0955, -84.5161, 0),
        qb=QBDepthChart("Joe Burrow", 1, 6.8, "Jake Browning", 1.2, 5.6),
        pass_off_epa=0.18, rush_off_epa=0.01, pass_def_epa=0.08, rush_def_epa=0.04,
        success_rate=0.478, neutral_pass_rate=0.62, pace_sec_per_play=26.4
    ),
    "CLE": TeamBaseline(
        abbr="CLE", name="Cleveland Browns",
        stadium=StadiumInfo("Huntington Bank Field", "Cleveland", "OH", False, "grass", 189, 41.5061, -81.6995, 0),
        qb=QBDepthChart("Deshaun Watson", 4, 2.1, "Jameis Winston", 1.8, 0.5),
        pass_off_epa=-0.16, rush_off_epa=-0.08, pass_def_epa=0.02, rush_def_epa=-0.04,
        success_rate=0.392, neutral_pass_rate=0.59, pace_sec_per_play=26.2
    ),
    "DAL": TeamBaseline(
        abbr="DAL", name="Dallas Cowboys",
        stadium=StadiumInfo("AT&T Stadium", "Arlington", "TX", True, "turf", 180, 32.7473, -97.0945, -1),
        qb=QBDepthChart("Dak Prescott", 2, 5.4, "Cooper Rush", 1.0, 4.4),
        pass_off_epa=0.08, rush_off_epa=-0.09, pass_def_epa=0.06, rush_def_epa=0.08,
        success_rate=0.440, neutral_pass_rate=0.63, pace_sec_per_play=25.8
    ),
    "DEN": TeamBaseline(
        abbr="DEN", name="Denver Broncos",
        stadium=StadiumInfo("Empower Field at Mile High", "Denver", "CO", False, "grass", 1609, 39.7439, -105.0201, -2),
        qb=QBDepthChart("Bo Nix", 4, 2.6, "Jarrett Stidham", 0.8, 1.8),
        pass_off_epa=-0.04, rush_off_epa=-0.02, pass_def_epa=-0.12, rush_def_epa=-0.06,
        success_rate=0.428, neutral_pass_rate=0.55, pace_sec_per_play=27.5
    ),
    "DET": TeamBaseline(
        abbr="DET", name="Detroit Lions",
        stadium=StadiumInfo("Ford Field", "Detroit", "MI", True, "turf", 183, 42.3400, -83.0456, 0),
        qb=QBDepthChart("Jared Goff", 2, 5.8, "Hendon Hooker", 0.4, 5.4),
        pass_off_epa=0.24, rush_off_epa=0.12, pass_def_epa=-0.04, rush_def_epa=-0.10,
        success_rate=0.518, neutral_pass_rate=0.51, pace_sec_per_play=27.9
    ),
    "GB": TeamBaseline(
        abbr="GB", name="Green Bay Packers",
        stadium=StadiumInfo("Lambeau Field", "Green Bay", "WI", False, "grass", 195, 44.5013, -88.0622, -1),
        qb=QBDepthChart("Jordan Love", 2, 5.2, "Malik Willis", 1.5, 3.7),
        pass_off_epa=0.16, rush_off_epa=0.08, pass_def_epa=0.00, rush_def_epa=-0.02,
        success_rate=0.475, neutral_pass_rate=0.53, pace_sec_per_play=27.3
    ),
    "HOU": TeamBaseline(
        abbr="HOU", name="Houston Texans",
        stadium=StadiumInfo("NRG Stadium", "Houston", "TX", True, "turf", 16, 29.6847, -95.4107, -1),
        qb=QBDepthChart("C.J. Stroud", 2, 5.7, "Davis Mills", 1.0, 4.7),
        pass_off_epa=0.14, rush_off_epa=-0.02, pass_def_epa=-0.08, rush_def_epa=-0.05,
        success_rate=0.468, neutral_pass_rate=0.58, pace_sec_per_play=27.0
    ),
    "IND": TeamBaseline(
        abbr="IND", name="Indianapolis Colts",
        stadium=StadiumInfo("Lucas Oil Stadium", "Indianapolis", "IN", True, "turf", 216, 39.7601, -86.1639, 0),
        qb=QBDepthChart("Anthony Richardson", 3, 3.6, "Joe Flacco", 2.8, 0.8),
        pass_off_epa=0.04, rush_off_epa=0.06, pass_def_epa=0.07, rush_def_epa=0.05,
        success_rate=0.445, neutral_pass_rate=0.52, pace_sec_per_play=25.5
    ),
    "JAX": TeamBaseline(
        abbr="JAX", name="Jacksonville Jaguars",
        stadium=StadiumInfo("EverBank Stadium", "Jacksonville", "FL", False, "grass", 3, 30.3239, -81.6373, 0),
        qb=QBDepthChart("Trevor Lawrence", 3, 4.2, "Mac Jones", 1.2, 3.0),
        pass_off_epa=0.05, rush_off_epa=0.01, pass_def_epa=0.14, rush_def_epa=0.02,
        success_rate=0.440, neutral_pass_rate=0.59, pace_sec_per_play=26.5
    ),
    "KC": TeamBaseline(
        abbr="KC", name="Kansas City Chiefs",
        stadium=StadiumInfo("GEHA Field at Arrowhead Stadium", "Kansas City", "MO", False, "grass", 264, 39.0489, -94.4839, -1),
        qb=QBDepthChart("Patrick Mahomes", 1, 7.5, "Carson Wentz", 1.0, 6.5),
        pass_off_epa=0.19, rush_off_epa=0.03, pass_def_epa=-0.10, rush_def_epa=-0.11,
        success_rate=0.498, neutral_pass_rate=0.60, pace_sec_per_play=28.0
    ),
    "LV": TeamBaseline(
        abbr="LV", name="Las Vegas Raiders",
        stadium=StadiumInfo("Allegiant Stadium", "Las Vegas", "NV", True, "grass", 610, 36.0909, -115.1833, -3),
        qb=QBDepthChart("Aidan O'Connell", 4, 2.2, "Gardner Minshew", 2.0, 0.5),
        pass_off_epa=-0.08, rush_off_epa=-0.11, pass_def_epa=0.05, rush_def_epa=0.03,
        success_rate=0.410, neutral_pass_rate=0.59, pace_sec_per_play=27.4
    ),
    "LAC": TeamBaseline(
        abbr="LAC", name="Los Angeles Chargers",
        stadium=StadiumInfo("SoFi Stadium", "Inglewood", "CA", True, "turf", 38, 33.9535, -118.3392, -3),
        qb=QBDepthChart("Justin Herbert", 2, 5.6, "Easton Stick", 0.2, 5.4),
        pass_off_epa=0.06, rush_off_epa=0.04, pass_def_epa=-0.11, rush_def_epa=-0.07,
        success_rate=0.448, neutral_pass_rate=0.48, pace_sec_per_play=29.1
    ),
    "LAR": TeamBaseline(
        abbr="LAR", name="Los Angeles Rams",
        stadium=StadiumInfo("SoFi Stadium", "Inglewood", "CA", True, "turf", 38, 33.9535, -118.3392, -3),
        qb=QBDepthChart("Matthew Stafford", 2, 4.8, "Jimmy Garoppolo", 2.0, 2.8),
        pass_off_epa=0.09, rush_off_epa=0.02, pass_def_epa=0.12, rush_def_epa=0.06,
        success_rate=0.455, neutral_pass_rate=0.57, pace_sec_per_play=27.2
    ),
    "MIA": TeamBaseline(
        abbr="MIA", name="Miami Dolphins",
        stadium=StadiumInfo("Hard Rock Stadium", "Miami Gardens", "FL", False, "grass", 3, 25.9580, -80.2389, 0),
        qb=QBDepthChart("Tua Tagovailoa", 2, 4.9, "Tyler Huntley", 1.5, 3.4),
        pass_off_epa=0.02, rush_off_epa=0.01, pass_def_epa=-0.03, rush_def_epa=0.02,
        success_rate=0.432, neutral_pass_rate=0.58, pace_sec_per_play=27.0
    ),
    "MIN": TeamBaseline(
        abbr="MIN", name="Minnesota Vikings",
        stadium=StadiumInfo("U.S. Bank Stadium", "Minneapolis", "MN", True, "turf", 255, 44.9737, -93.2575, -1),
        qb=QBDepthChart("Sam Darnold", 3, 4.2, "Nick Mullens", 1.8, 2.4),
        pass_off_epa=0.15, rush_off_epa=0.03, pass_def_epa=-0.15, rush_def_epa=-0.08,
        success_rate=0.480, neutral_pass_rate=0.54, pace_sec_per_play=27.8
    ),
    "NE": TeamBaseline(
        abbr="NE", name="New England Patriots",
        stadium=StadiumInfo("Gillette Stadium", "Foxborough", "MA", False, "turf", 80, 42.0909, -71.2643, 0),
        qb=QBDepthChart("Drake Maye", 4, 2.5, "Jacoby Brissett", 1.8, 0.7),
        pass_off_epa=-0.11, rush_off_epa=-0.04, pass_def_epa=0.04, rush_def_epa=0.03,
        success_rate=0.402, neutral_pass_rate=0.53, pace_sec_per_play=28.2
    ),
    "NO": TeamBaseline(
        abbr="NO", name="New Orleans Saints",
        stadium=StadiumInfo("Caesars Superdome", "New Orleans", "LA", True, "turf", 1, 29.9511, -90.0812, -1),
        qb=QBDepthChart("Derek Carr", 3, 3.7, "Spencer Rattler", 1.0, 2.7),
        pass_off_epa=0.08, rush_off_epa=0.03, pass_def_epa=0.06, rush_def_epa=0.04,
        success_rate=0.446, neutral_pass_rate=0.53, pace_sec_per_play=27.4
    ),
    "NYG": TeamBaseline(
        abbr="NYG", name="New York Giants",
        stadium=StadiumInfo("MetLife Stadium", "East Rutherford", "NJ", False, "turf", 2, 40.8128, -74.0742, 0),
        qb=QBDepthChart("Daniel Jones", 4, 2.8, "Drew Lock", 1.2, 1.6),
        pass_off_epa=-0.06, rush_off_epa=-0.05, pass_def_epa=0.02, rush_def_epa=0.01,
        success_rate=0.418, neutral_pass_rate=0.60, pace_sec_per_play=26.6
    ),
    "NYJ": TeamBaseline(
        abbr="NYJ", name="New York Jets",
        stadium=StadiumInfo("MetLife Stadium", "East Rutherford", "NJ", False, "turf", 2, 40.8128, -74.0742, 0),
        qb=QBDepthChart("Aaron Rodgers", 2, 4.8, "Tyrod Taylor", 1.8, 3.0),
        pass_off_epa=0.08, rush_off_epa=-0.04, pass_def_epa=-0.09, rush_def_epa=0.00,
        success_rate=0.452, neutral_pass_rate=0.61, pace_sec_per_play=27.1
    ),
    "PHI": TeamBaseline(
        abbr="PHI", name="Philadelphia Eagles",
        stadium=StadiumInfo("Lincoln Financial Field", "Philadelphia", "PA", False, "grass", 6, 39.9008, -75.1675, 0),
        qb=QBDepthChart("Jalen Hurts", 2, 5.5, "Kenny Pickett", 1.0, 4.5),
        pass_off_epa=0.12, rush_off_epa=0.10, pass_def_epa=0.01, rush_def_epa=-0.04,
        success_rate=0.485, neutral_pass_rate=0.51, pace_sec_per_play=28.1
    ),
    "PIT": TeamBaseline(
        abbr="PIT", name="Pittsburgh Steelers",
        stadium=StadiumInfo("Acrisure Stadium", "Pittsburgh", "PA", False, "grass", 220, 40.4468, -80.0158, 0),
        qb=QBDepthChart("Russell Wilson", 3, 3.5, "Justin Fields", 3.2, 0.6),
        pass_off_epa=0.01, rush_off_epa=0.03, pass_def_epa=-0.10, rush_def_epa=-0.08,
        success_rate=0.438, neutral_pass_rate=0.49, pace_sec_per_play=28.7
    ),
    "SF": TeamBaseline(
        abbr="SF", name="San Francisco 49ers",
        stadium=StadiumInfo("Levi's Stadium", "Santa Clara", "CA", False, "grass", 14, 37.4033, -121.9694, -3),
        qb=QBDepthChart("Brock Purdy", 2, 5.6, "Brandon Allen", 0.5, 5.1),
        pass_off_epa=0.21, rush_off_epa=0.09, pass_def_epa=0.02, rush_def_epa=-0.03,
        success_rate=0.496, neutral_pass_rate=0.53, pace_sec_per_play=28.4
    ),
    "SEA": TeamBaseline(
        abbr="SEA", name="Seattle Seahawks",
        stadium=StadiumInfo("Lumen Field", "Seattle", "WA", False, "turf", 6, 47.5952, -122.3316, -3),
        qb=QBDepthChart("Geno Smith", 3, 4.4, "Sam Howell", 1.5, 2.9),
        pass_off_epa=0.11, rush_off_epa=-0.03, pass_def_epa=0.03, rush_def_epa=0.04,
        success_rate=0.452, neutral_pass_rate=0.64, pace_sec_per_play=25.9
    ),
    "TB": TeamBaseline(
        abbr="TB", name="Tampa Bay Buccaneers",
        stadium=StadiumInfo("Raymond James Stadium", "Tampa", "FL", False, "grass", 6, 27.9759, -82.5033, 0),
        qb=QBDepthChart("Baker Mayfield", 3, 4.5, "Kyle Trask", 0.5, 4.0),
        pass_off_epa=0.16, rush_off_epa=0.05, pass_def_epa=0.07, rush_def_epa=-0.01,
        success_rate=0.472, neutral_pass_rate=0.57, pace_sec_per_play=26.9
    ),
    "TEN": TeamBaseline(
        abbr="TEN", name="Tennessee Titans",
        stadium=StadiumInfo("Nissan Stadium", "Nashville", "TN", False, "turf", 135, 36.1665, -86.7713, -1),
        qb=QBDepthChart("Will Levis", 4, 2.3, "Mason Rudolph", 1.8, 0.5),
        pass_off_epa=-0.10, rush_off_epa=0.02, pass_def_epa=-0.04, rush_def_epa=-0.05,
        success_rate=0.420, neutral_pass_rate=0.54, pace_sec_per_play=27.8
    ),
    "WAS": TeamBaseline(
        abbr="WAS", name="Washington Commanders",
        stadium=StadiumInfo("Northwest Stadium", "Landover", "MD", False, "grass", 60, 38.9076, -76.8645, 0),
        qb=QBDepthChart("Jayden Daniels", 2, 5.4, "Marcus Mariota", 1.5, 3.9),
        pass_off_epa=0.22, rush_off_epa=0.11, pass_def_epa=0.08, rush_def_epa=0.05,
        success_rate=0.508, neutral_pass_rate=0.52, pace_sec_per_play=27.0
    ),
}


@dataclass
class MatchupInjuryContext:
    starter_qb_out: bool = False
    starter_qb_questionable: bool = False
    starter_qb_name: str = ""
    qb_downgrade: float = 0.0
    missing_ol_starters: int = 0
    ol_penalty: float = 0.0
    key_defensive_injuries: List[str] = field(default_factory=list)
    defensive_penalty: float = 0.0
    injury_descriptions: List[str] = field(default_factory=list)


@dataclass
class MatchupWeatherContext:
    venue_name: str
    is_dome: bool
    temperature_f: float = 65.0
    wind_mph: float = 5.0
    wind_depressed_pass: float = 0.0  # % reduction in pass efficiency
    wind_depressed_total: float = 0.0 # point reduction on game total
    elevation_m: float = 0.0
    is_high_altitude: bool = False


@dataclass
class NFLMatchupData:
    game_id: str
    home_abbr: str
    away_abbr: str
    home_team: str
    away_team: str
    start_time: str
    week: int
    is_short_rest: bool
    travel_timezone_diff: int
    is_international: bool
    market_spread: float        # Consensus spread (e.g. -2.5 for home fav)
    market_total: float         # Consensus total (e.g. 43.5)
    market_moneyline_home: int  # American odds (e.g. -135)
    market_moneyline_away: int  # American odds (e.g. +115)
    spread_home_odds: int       # American odds on home spread (-110)
    spread_away_odds: int       # American odds on away spread (-110)
    total_over_odds: int        # American odds on Over (-110)
    total_under_odds: int       # American odds on Under (-110)
    weather: MatchupWeatherContext
    home_injuries: MatchupInjuryContext
    away_injuries: MatchupInjuryContext
    bookmakers_count: int = 0


def fetch_espn_injuries() -> Dict[str, List[Dict[str, Any]]]:
    """Fetch live NFL injury reports from ESPN public API."""
    url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
        team_injuries: Dict[str, List[Dict[str, Any]]] = {}
        for item in data.get("injuries", []):
            raw_name = item.get("displayName", "")
            abbr = canonical_abbr(raw_name)
            if not abbr:
                continue
            inj_list = []
            for inj in item.get("injuries", []):
                athlete = inj.get("athlete", {})
                pos = athlete.get("position", {}).get("abbreviation", "")
                name = athlete.get("displayName", "")
                status = inj.get("status", "")
                desc = inj.get("shortComment", "") or inj.get("longComment", "")
                inj_list.append({
                    "name": name,
                    "position": pos,
                    "status": status,
                    "description": desc
                })
            team_injuries[abbr] = inj_list
        logger.info(f"Loaded ESPN injuries for {len(team_injuries)} NFL teams.")
        return team_injuries
    except Exception as e:
        logger.warning(f"Failed to fetch ESPN injuries: {e}. Using empty injury maps.")
        return {}


def parse_team_injuries(abbr: str, raw_injuries: List[Dict[str, Any]], baseline: TeamBaseline) -> MatchupInjuryContext:
    """Analyze raw injury list and compute QB downgrade and OL cluster penalties."""
    ctx = MatchupInjuryContext(starter_qb_name=baseline.qb.starter_name)
    if not raw_injuries:
        return ctx

    ol_count = 0
    for inj in raw_injuries:
        name = inj.get("name", "").strip()
        pos = inj.get("position", "").upper().strip()
        status = inj.get("status", "").lower()
        desc = inj.get("description", "")

        is_out = any(s in status for s in ["out", "injured reserve", "ir", "doubtful"])
        is_q = "questionable" in status

        if not (is_out or is_q):
            continue

        # Check Starting QB
        if name.lower() in baseline.qb.starter_name.lower() or baseline.qb.starter_name.lower() in name.lower() or pos == "QB":
            if name.lower() in baseline.qb.starter_name.lower():
                if is_out:
                    ctx.starter_qb_out = True
                    ctx.qb_downgrade = baseline.qb.downgrade_points
                    ctx.injury_descriptions.append(f"Starting QB {name} is OUT (-{ctx.qb_downgrade:.1f} pts)")
                elif is_q:
                    ctx.starter_qb_questionable = True
                    # 50% discount for questionable
                    ctx.qb_downgrade = baseline.qb.downgrade_points * 0.40
                    ctx.injury_descriptions.append(f"Starting QB {name} is Questionable (-{ctx.qb_downgrade:.1f} pts)")

        # Check Offensive Line (T, OT, G, OG, C)
        if pos in ["T", "OT", "LT", "RT", "G", "OG", "LG", "RG", "C"]:
            if is_out:
                ol_count += 1
                ctx.injury_descriptions.append(f"OL {name} ({pos}) OUT")
            elif is_q:
                ol_count += 0.5

        # Check Key Defensive Impact
        if pos in ["DE", "DT", "EDGE", "LB", "CB", "S"] and is_out:
            ctx.key_defensive_injuries.append(f"{name} ({pos})")

    ctx.missing_ol_starters = int(ol_count)
    # Offensive Line cluster injury rule:
    # 1 missing starter: -0.50 pts
    # 2 missing starters: -1.25 pts
    # 3+ missing starters: -2.25 pts
    if ol_count >= 3.0:
        ctx.ol_penalty = 2.25
        ctx.injury_descriptions.append(f"Severe OL cluster injury: {ol_count:.0f} linemen missing (-2.25 pts)")
    elif ol_count >= 2.0:
        ctx.ol_penalty = 1.25
        ctx.injury_descriptions.append(f"Moderate OL cluster injury: {ol_count:.0f} linemen missing (-1.25 pts)")
    elif ol_count >= 1.0:
        ctx.ol_penalty = 0.50
        ctx.injury_descriptions.append(f"OL starter out (-0.50 pts)")

    # Key defensive absences: -0.3 pts per key starter (capped at 1.5)
    if ctx.key_defensive_injuries:
        def_penalty = min(1.5, len(ctx.key_defensive_injuries) * 0.35)
        ctx.defensive_penalty = def_penalty
        ctx.injury_descriptions.append(f"{len(ctx.key_defensive_injuries)} defensive starters OUT (+{def_penalty:.1f} pts allowed)")

    return ctx


def fetch_stadium_weather(stadium: StadiumInfo) -> Tuple[float, float]:
    """
    Fetch live wind speed (mph) and temperature (°F) using Open-Meteo for outdoor venues.
    Returns (temperature_f, wind_mph).
    """
    if stadium.is_dome:
        return (70.0, 0.0)
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={stadium.latitude:.4f}&longitude={stadium.longitude:.4f}&"
            f"current=temperature_2m,wind_speed_10m&wind_speed_unit=mph&temperature_unit=fahrenheit"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "SharpSim/1.0"})
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode("utf-8"))
        curr = data.get("current", {})
        temp = float(curr.get("temperature_2m", 65.0))
        wind = float(curr.get("wind_speed_10m", 6.0))
        return (temp, wind)
    except Exception:
        # Default mild outdoor conditions if weather API unavailable
        return (62.0, 7.0)


def build_weather_context(stadium: StadiumInfo) -> MatchupWeatherContext:
    """Build weather and atmospheric context including wind degradation rules."""
    temp, wind = fetch_stadium_weather(stadium)
    is_high_alt = stadium.elevation_m >= 1200.0  # Denver elevation

    wind_dep_pass = 0.0
    wind_dep_total = 0.0

    # Environmental Rule: Wind >= 15 mph depresses passing volume and total points
    if not stadium.is_dome and wind >= 14.5:
        wind_excess = wind - 14.0
        # Passing efficiency degraded 2.5% per mph over 14 (max 35%)
        wind_dep_pass = min(0.35, wind_excess * 0.025)
        # Total points depressed by 0.22 points per mph over 14
        wind_dep_total = round(wind_excess * 0.22, 2)

    return MatchupWeatherContext(
        venue_name=stadium.name,
        is_dome=stadium.is_dome,
        temperature_f=round(temp, 1),
        wind_mph=round(wind, 1),
        wind_depressed_pass=wind_dep_pass,
        wind_depressed_total=wind_dep_total,
        elevation_m=stadium.elevation_m,
        is_high_altitude=is_high_alt
    )


def fetch_odds_api_nfl() -> List[Dict[str, Any]]:
    """Fetch live NFL odds from The Odds API."""
    if not ODDS_API_KEY:
        return []
    url = f"https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey={ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read().decode("utf-8"))
        logger.info(f"Loaded {len(data)} NFL fixtures from The Odds API.")
        return data
    except Exception as e:
        logger.warning(f"The Odds API NFL fetch error: {e}")
        return []


def fetch_espn_nfl_scoreboard() -> List[Dict[str, Any]]:
    """Fetch live NFL scoreboard from ESPN."""
    url = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
        events = data.get("events", [])
        logger.info(f"Loaded {len(events)} NFL events from ESPN scoreboard.")
        return events
    except Exception as e:
        logger.warning(f"ESPN NFL scoreboard fetch error: {e}")
        return []


def load_nfl_matchups() -> List[NFLMatchupData]:
    """
    Ingest upcoming NFL matchups combining:
    1. ESPN Schedule and venue metadata
    2. The Odds API consensus lines (Spreads, Totals, Moneylines)
    3. ESPN live injuries (QBs, OL, Defense)
    4. Open-Meteo stadium weather forecasts
    """
    espn_events = fetch_espn_nfl_scoreboard()
    odds_data = fetch_odds_api_nfl()
    injuries_map = fetch_espn_injuries()

    # Index Odds API games by (canonical_home, canonical_away)
    odds_lookup: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for g in odds_data:
        h_abbr = canonical_abbr(g.get("home_team", ""))
        a_abbr = canonical_abbr(g.get("away_team", ""))
        if h_abbr and a_abbr:
            odds_lookup[(h_abbr, a_abbr)] = g

    matchups: List[NFLMatchupData] = []

    for event in espn_events:
        comp = event.get("competitions", [{}])[0]
        home_comp = next((c for c in comp.get("competitors", []) if c.get("homeAway") == "home"), None)
        away_comp = next((c for c in comp.get("competitors", []) if c.get("homeAway") == "away"), None)
        if not home_comp or not away_comp:
            continue

        home_raw = home_comp.get("team", {}).get("displayName", "")
        away_raw = away_comp.get("team", {}).get("displayName", "")
        home_abbr = canonical_abbr(home_raw)
        away_abbr = canonical_abbr(away_raw)

        if not home_abbr or not away_abbr or home_abbr not in NFL_BASELINES or away_abbr not in NFL_BASELINES:
            continue

        home_baseline = NFL_BASELINES[home_abbr]
        away_baseline = NFL_BASELINES[away_abbr]

        start_time = event.get("date", datetime.now(timezone.utc).isoformat())
        game_id = event.get("id", f"{away_abbr}@{home_abbr}")
        venue = comp.get("venue", {})
        venue_city = venue.get("address", {}).get("city", "")
        is_international = venue_city in ["London", "Munich", "Frankfurt", "São Paulo", "Mexico City"]

        # Parse Situational variables
        # Day of week: Thursday = short rest
        try:
            dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            is_short_rest = (dt.weekday() == 3)  # Thursday is 3
        except Exception:
            is_short_rest = False

        travel_tz = abs(home_baseline.stadium.timezone_offset_hours - away_baseline.stadium.timezone_offset_hours)

        # Weather context
        weather = build_weather_context(home_baseline.stadium)

        # Injury context
        home_inj = parse_team_injuries(home_abbr, injuries_map.get(home_abbr, []), home_baseline)
        away_inj = parse_team_injuries(away_abbr, injuries_map.get(away_abbr, []), away_baseline)

        # Match consensus odds
        odds_item = odds_lookup.get((home_abbr, away_abbr))
        market_spread = 0.0
        market_total = 44.0
        market_ml_home = -110
        market_ml_away = -110
        spread_h_odds = -110
        spread_a_odds = -110
        tot_over_odds = -110
        tot_under_odds = -110
        bk_count = 0

        if odds_item and odds_item.get("bookmakers"):
            bk_list = odds_item["bookmakers"]
            bk_count = len(bk_list)

            # Gather consensus averages across bookmakers
            spread_points: List[float] = []
            totals_points: List[float] = []
            mls_home: List[int] = []
            mls_away: List[int] = []

            for bk in bk_list:
                for mkt in bk.get("markets", []):
                    mkey = mkt.get("key")
                    outcomes = mkt.get("outcomes", [])
                    if mkey == "spreads":
                        h_out = next((o for o in outcomes if canonical_abbr(o.get("name", "")) == home_abbr), None)
                        if h_out and "point" in h_out:
                            spread_points.append(float(h_out["point"]))
                    elif mkey == "totals":
                        over_out = next((o for o in outcomes if o.get("name") == "Over"), None)
                        if over_out and "point" in over_out:
                            totals_points.append(float(over_out["point"]))
                    elif mkey == "h2h":
                        h_out = next((o for o in outcomes if canonical_abbr(o.get("name", "")) == home_abbr), None)
                        a_out = next((o for o in outcomes if canonical_abbr(o.get("name", "")) == away_abbr), None)
                        if h_out and "price" in h_out:
                            mls_home.append(int(h_out["price"]))
                        if a_out and "price" in a_out:
                            mls_away.append(int(a_out["price"]))

            if spread_points:
                market_spread = round(sum(spread_points) / len(spread_points) * 2) / 2  # round to half point
            if totals_points:
                market_total = round(sum(totals_points) / len(totals_points) * 2) / 2
            if mls_home:
                market_ml_home = int(sum(mls_home) / len(mls_home))
            if mls_away:
                market_ml_away = int(sum(mls_away) / len(mls_away))

        matchups.append(NFLMatchupData(
            game_id=game_id,
            home_abbr=home_abbr,
            away_abbr=away_abbr,
            home_team=home_baseline.name,
            away_team=away_baseline.name,
            start_time=start_time,
            week=event.get("season", {}).get("week", 7),
            is_short_rest=is_short_rest,
            travel_timezone_diff=travel_tz,
            is_international=is_international,
            market_spread=market_spread,
            market_total=market_total,
            market_moneyline_home=market_ml_home,
            market_moneyline_away=market_ml_away,
            spread_home_odds=spread_h_odds,
            spread_away_odds=spread_a_odds,
            total_over_odds=tot_over_odds,
            total_under_odds=tot_under_odds,
            weather=weather,
            home_injuries=home_inj,
            away_injuries=away_inj,
            bookmakers_count=bk_count
        ))

    logger.info(f"Constructed {len(matchups)} validated NFL matchup datasets.")
    return matchups
