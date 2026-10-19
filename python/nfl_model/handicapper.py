"""
handicapper.py
--------------
NFL Situational Handicapper & Efficiency Adjustment Engine.
Calculates:
- Opponent-adjusted rolling EPA per play matchup ratings (Pass Off, Rush Off, Pass Def, Rush Def)
- Strict Quarterback replacement downgrades (-3.0 to -7.5 pts depending on Tier)
- Severe Offensive Line cluster injury penalties
- Dynamic Home Field Advantage factoring short rest (Thursday games), cross-country travel,
  international neutral sites, and Denver altitude
- Environmental weather degradation (wind >= 15 mph depressing passing efficiency and game totals)
"""

from dataclasses import dataclass
from typing import Any, Dict, Tuple
from data_loader import NFL_BASELINES, MatchupInjuryContext, MatchupWeatherContext, NFLMatchupData, TeamBaseline

LEAGUE_AVG_PASS_EPA = 0.05
LEAGUE_AVG_RUSH_EPA = -0.02
LEAGUE_AVG_SUCCESS_RATE = 0.445
LEAGUE_AVG_POINTS_PER_TEAM = 21.8
LEAGUE_AVG_PLAYS_PER_GAME = 63.5
BASE_HOME_FIELD_ADVANTAGE = 1.65


@dataclass
class TeamAdjustedRating:
    abbr: str
    name: str
    net_epa_per_play: float
    effective_success_rate: float
    qb_adjustment: float
    ol_injury_penalty: float
    defensive_penalty: float
    total_personnel_delta: float
    projected_plays: float
    projected_offensive_points: float


@dataclass
class MatchupHandicapResult:
    home: TeamAdjustedRating
    away: TeamAdjustedRating
    hca_points: float
    situational_breakdown: Dict[str, float]
    weather_points_delta: float
    handicapped_home_points: float
    handicapped_away_points: float
    projected_margin: float      # Positive = Home favorite margin (e.g. +3.5)
    projected_spread: float      # SharpSim convention: Negative = Home favorite (e.g. -3.5)
    projected_total: float       # Handicapped game total
    pace_plays_total: float


class NFLHandicapper:
    """Rigorous NFL handicapper implementing efficiency metrics and situational rules."""

    @staticmethod
    def calculate_team_matchup_epa(
        off: TeamBaseline,
        opp_def: TeamBaseline,
        weather: MatchupWeatherContext
    ) -> Tuple[float, float, float]:
        """
        Calculate matchup Pass EPA, Rush EPA, and Blended EPA per play.
        Applies wind degradation if wind >= 15 mph.
        """
        # Matchup Pass EPA: Offense + Opponent Def allowed - League Average
        raw_pass_epa = off.pass_off_epa + opp_def.pass_def_epa - LEAGUE_AVG_PASS_EPA
        # Matchup Rush EPA: Offense + Opponent Def allowed - League Average
        raw_rush_epa = off.rush_off_epa + opp_def.rush_def_epa - LEAGUE_AVG_RUSH_EPA

        # Environmental wind depression on passing volume & efficiency
        if weather.wind_depressed_pass > 0:
            raw_pass_epa -= (weather.wind_depressed_pass * 0.28)

        # Blend according to neutral pass rate
        pass_weight = off.neutral_pass_rate
        # In windy conditions, teams shift rush rate up
        if weather.wind_depressed_pass > 0:
            pass_weight = max(0.38, pass_weight - 0.08)

        blended_epa = (pass_weight * raw_pass_epa) + ((1.0 - pass_weight) * raw_rush_epa)
        return raw_pass_epa, raw_rush_epa, blended_epa

    @classmethod
    def handicap_matchup(cls, matchup: NFLMatchupData) -> MatchupHandicapResult:
        """Handicap a single NFL matchup applying all personnel and situational rules."""
        home_base = NFL_BASELINES[matchup.home_abbr]
        away_base = NFL_BASELINES[matchup.away_abbr]

        # 1. EPA per play matchup calculations
        _, _, home_blended_epa = cls.calculate_team_matchup_epa(home_base, away_base, matchup.weather)
        _, _, away_blended_epa = cls.calculate_team_matchup_epa(away_base, home_base, matchup.weather)

        # 2. Personnel & Injury Adjustments (Strict QB Tier & OL Cluster Rules)
        # Home personnel
        home_qb_delta = -matchup.home_injuries.qb_downgrade
        home_ol_delta = -matchup.home_injuries.ol_penalty
        home_def_delta = matchup.away_injuries.defensive_penalty # Away def injuries help home off
        home_personnel_delta = home_qb_delta + home_ol_delta + home_def_delta

        # Away personnel
        away_qb_delta = -matchup.away_injuries.qb_downgrade
        away_ol_delta = -matchup.away_injuries.ol_penalty
        away_def_delta = matchup.home_injuries.defensive_penalty # Home def injuries help away off
        away_personnel_delta = away_qb_delta + away_ol_delta + away_def_delta

        # 3. Dynamic Home Field Advantage (HCA)
        hca = BASE_HOME_FIELD_ADVANTAGE
        sit_breakdown: Dict[str, float] = {"base_hca": BASE_HOME_FIELD_ADVANTAGE}

        # International venue (London/Germany): Neutral site
        if matchup.is_international:
            hca = 0.5  # Nominal designated home team advantage
            sit_breakdown["international_site"] = -1.15
        else:
            # Short Rest (Thursday Night Football)
            # Visiting teams on short rest suffer preparation and recovery penalty (-1.25 pts)
            if matchup.is_short_rest:
                hca += 1.25
                sit_breakdown["short_rest_road_penalty"] = 1.25

            # Cross-Country Travel Disparity (Timezone shift >= 2 hours)
            if matchup.travel_timezone_diff >= 2:
                travel_penalty = 0.75 if matchup.travel_timezone_diff == 2 else 1.10
                hca += travel_penalty
                sit_breakdown["travel_timezone_penalty"] = travel_penalty

            # Altitude Conditioning (Denver Mile High: 1609m)
            if home_base.stadium.elevation_m >= 1500 and away_base.stadium.elevation_m < 800:
                hca += 1.20
                sit_breakdown["altitude_advantage"] = 1.20

            # Dome team playing outdoors in cold/wind penalty
            if away_base.stadium.is_dome and not home_base.stadium.is_dome and (matchup.weather.wind_mph >= 12 or matchup.weather.temperature_f <= 40):
                hca += 1.15
                sit_breakdown["dome_outdoors_cold_penalty"] = 1.15

        # 4. Success Rate & Drive Conversion Scaling
        home_eff_sr = home_base.success_rate + (home_blended_epa * 0.18)
        away_eff_sr = away_base.success_rate + (away_blended_epa * 0.18)

        # 5. Pace & Possession Estimations
        # Pace influenced by seconds per play
        avg_pace = (home_base.pace_sec_per_play + away_base.pace_sec_per_play) / 2.0
        # Faster pace = more plays (League avg ~27.2s = 63.5 plays)
        pace_multiplier = 27.2 / avg_pace
        proj_plays_home = LEAGUE_AVG_PLAYS_PER_GAME * pace_multiplier
        proj_plays_away = LEAGUE_AVG_PLAYS_PER_GAME * pace_multiplier

        # 6. Baseline Points Calculations from Efficiency & Personnel
        # Each +0.10 EPA per play over 63 plays ≈ +6.35 points
        home_raw_pts = LEAGUE_AVG_POINTS_PER_TEAM + (home_blended_epa * proj_plays_home) + home_personnel_delta
        away_raw_pts = LEAGUE_AVG_POINTS_PER_TEAM + (away_blended_epa * proj_plays_away) + away_personnel_delta

        # Apply HCA (split: half added to home, half subtracted from away)
        home_pts_with_hca = home_raw_pts + (hca * 0.55)
        away_pts_with_hca = away_raw_pts - (hca * 0.45)

        # Apply Weather Wind Deduction to Totals
        weather_pts_delta = 0.0
        if matchup.weather.wind_depressed_total > 0:
            weather_pts_delta = matchup.weather.wind_depressed_total
            home_pts_with_hca -= (weather_pts_delta / 2.0)
            away_pts_with_hca -= (weather_pts_delta / 2.0)

        # Ensure realistic scoring floor
        home_final_pts = max(9.0, home_pts_with_hca)
        away_final_pts = max(9.0, away_pts_with_hca)

        projected_margin = home_final_pts - away_final_pts
        # SharpSim convention: Negative spread means Home Favorite (e.g. -3.5)
        projected_spread = -projected_margin
        projected_total = home_final_pts + away_final_pts

        return MatchupHandicapResult(
            home=TeamAdjustedRating(
                abbr=matchup.home_abbr,
                name=matchup.home_team,
                net_epa_per_play=round(home_blended_epa, 4),
                effective_success_rate=round(home_eff_sr, 4),
                qb_adjustment=round(home_qb_delta, 2),
                ol_injury_penalty=round(home_ol_delta, 2),
                defensive_penalty=round(home_def_delta, 2),
                total_personnel_delta=round(home_personnel_delta, 2),
                projected_plays=round(proj_plays_home, 1),
                projected_offensive_points=round(home_final_pts, 2),
            ),
            away=TeamAdjustedRating(
                abbr=matchup.away_abbr,
                name=matchup.away_team,
                net_epa_per_play=round(away_blended_epa, 4),
                effective_success_rate=round(away_eff_sr, 4),
                qb_adjustment=round(away_qb_delta, 2),
                ol_injury_penalty=round(away_ol_delta, 2),
                defensive_penalty=round(away_def_delta, 2),
                total_personnel_delta=round(away_personnel_delta, 2),
                projected_plays=round(proj_plays_away, 1),
                projected_offensive_points=round(away_final_pts, 2),
            ),
            hca_points=round(hca, 2),
            situational_breakdown=sit_breakdown,
            weather_points_delta=round(weather_pts_delta, 2),
            handicapped_home_points=round(home_final_pts, 2),
            handicapped_away_points=round(away_final_pts, 2),
            projected_margin=round(projected_margin, 2),
            projected_spread=round(projected_spread, 2),
            projected_total=round(projected_total, 2),
            pace_plays_total=round(proj_plays_home + proj_plays_away, 1),
        )
