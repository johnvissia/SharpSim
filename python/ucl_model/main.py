"""
main.py (UCL Model)
-------------------
FastAPI REST API for UEFA Champions League match prediction engine.

Port: 8001 (default)
"""

import logging
import sys
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from data_loader import load_ucl_data, normalize_ucl_team_name
from signals import (
    UCLBacktestResult,
    UCLPredictionResult,
    backtest_ucl,
    predict_ucl,
)
from ucl_engine import UCLModel, fit_ucl_model

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

_model: Optional[UCLModel] = None
_match_df = None


def _get_model() -> UCLModel:
    if _model is None:
        raise HTTPException(status_code=503, detail="UCL Model not yet initialized.")
    return _model


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model, _match_df
    logger.info("🏆 UCL Engine starting — loading data...")
    _match_df = load_ucl_data()
    logger.info("📊 Fitting Cross-League Bivariate Poisson model on %d UCL fixtures...", len(_match_df))
    _model = fit_ucl_model(_match_df)
    logger.info("✅ UCL Model ready — %d clubs | converged=%s", len(_model.teams), _model.converged)
    yield
    logger.info("🛑 UCL Engine shutting down.")


app = FastAPI(
    title="UEFA Champions League Prediction Engine",
    description="Cross-League Bivariate Poisson & Dixon-Coles model for UCL matches.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class UCLTeamSchema(BaseModel):
    team:        str
    league:      str
    country:     str
    attack:      float
    defense:     float
    attack_exp:  float
    defense_exp: float


class UCLTeamListResponse(BaseModel):
    teams:             list[UCLTeamSchema]
    home_advantage:    float
    rho:               float
    n_matches_trained: int
    converged:         bool


class BetSignalSchema(BaseModel):
    outcome:        str
    signal:         str
    p_model:        float
    implied_prob:   float
    odds_bookmaker: float
    fair_odds:      float
    edge:           float
    stake_pct:      float


class UCLPredictionResponse(BaseModel):
    home_team:         str
    away_team:         str
    lambda_home:       float = Field(..., description="Projected home goals")
    lambda_away:       float = Field(..., description="Projected away goals")
    p_home:            float
    p_draw:            float
    p_away:            float
    p_over25:          float
    p_under25:         float
    p_btts_yes:        float = Field(..., description="P(Both Teams Score - Yes)")
    p_btts_no:         float = Field(..., description="P(Both Teams Score - No)")
    most_likely_score: str
    is_neutral_venue:  bool
    score_matrix:      list[list[float]]
    signals:           list[BetSignalSchema]


class BacktestRequest(BaseModel):
    xi:                float = Field(0.0065, ge=0.001, le=0.05)
    min_train_matches: int   = Field(100, ge=50, le=500)
    edge_threshold:    float = Field(0.04, ge=0.01, le=0.25)
    window_weeks:      int   = Field(4, ge=1, le=16)


class BacktestResponse(BaseModel):
    n_matches:    int
    brier_avg:    float
    log_loss:     float
    roi_overall:  float
    total_bets:   int
    winning_bets: int
    win_rate:     float
    details:      list[dict]


@app.get("/", response_model=HealthResponse, tags=["Health"])
def health_check():
    return HealthResponse(status="ok", service="UCL Prediction Engine", version="1.0.0")


@app.get("/api/v1/ucl/info", tags=["Model"])
def model_info():
    m = _get_model()
    return {
        "status":         "ready",
        "competition":    "UEFA Champions League",
        "n_teams":        len(m.teams),
        "n_matches":      m.n_matches,
        "converged":      m.converged,
        "home_advantage": round(m.home_advantage, 4),
        "rho":            round(m.rho, 4),
        "xi":             round(m.xi, 4),
    }


@app.get("/api/v1/ucl/teams", response_model=UCLTeamListResponse, tags=["Teams"])
def get_teams():
    m = _get_model()
    df = m.team_ratings()
    teams = [
        UCLTeamSchema(
            team=row["team"],
            league=row["league"],
            country=row["country"],
            attack=row["attack"],
            defense=row["defense"],
            attack_exp=row["attack_exp"],
            defense_exp=row["defense_exp"],
        )
        for _, row in df.iterrows()
    ]
    return UCLTeamListResponse(
        teams=teams,
        home_advantage=round(m.home_advantage, 4),
        rho=round(m.rho, 4),
        n_matches_trained=m.n_matches,
        converged=m.converged,
    )


@app.get("/api/v1/ucl/predict", response_model=UCLPredictionResponse, tags=["Prediction"])
def predict_match(
    home: str = Query(..., description="Home team name (e.g. 'Real Madrid')"),
    away: str = Query(..., description="Away team name (e.g. 'Manchester City')"),
    neutral: bool = Query(False, description="Set true for neutral venues (e.g. UCL Final)"),
    odds_h: Optional[float] = Query(None, ge=1.01, le=100.0),
    odds_d: Optional[float] = Query(None, ge=1.01, le=100.0),
    odds_a: Optional[float] = Query(None, ge=1.01, le=100.0),
):
    m = _get_model()
    team_map = {t.lower(): t for t in m.teams}
    h_norm = normalize_ucl_team_name(home)
    a_norm = normalize_ucl_team_name(away)
    h_res = team_map.get(h_norm.lower().strip())
    a_res = team_map.get(a_norm.lower().strip())

    if not h_res:
        raise HTTPException(status_code=404, detail=f"Home club '{home}' (normalized '{h_norm}') not found in UCL model.")
    if not a_res:
        raise HTTPException(status_code=404, detail=f"Away club '{away}' (normalized '{a_norm}') not found in UCL model.")
    if h_res == a_res:
        raise HTTPException(status_code=400, detail="Home and away clubs cannot be identical.")

    res: UCLPredictionResult = predict_ucl(
        m, h_res, a_res, odds_home=odds_h, odds_draw=odds_d, odds_away=odds_a, neutral=neutral
    )

    signals_out = [
        BetSignalSchema(
            outcome=s.outcome,
            signal=s.signal.value,
            p_model=s.p_model,
            implied_prob=s.implied_prob,
            odds_bookmaker=s.odds_bookmaker,
            fair_odds=s.fair_odds,
            edge=s.edge,
            stake_pct=s.stake_pct,
        )
        for s in res.signals
    ]

    return UCLPredictionResponse(
        home_team=res.home_team,
        away_team=res.away_team,
        lambda_home=res.lambda_home,
        lambda_away=res.lambda_away,
        p_home=res.p_home,
        p_draw=res.p_draw,
        p_away=res.p_away,
        p_over25=res.p_over25,
        p_under25=res.p_under25,
        p_btts_yes=res.p_btts_yes,
        p_btts_no=res.p_btts_no,
        most_likely_score=f"{res.most_likely_home_goals}-{res.most_likely_away_goals}",
        is_neutral_venue=res.is_neutral,
        score_matrix=res.score_matrix,
        signals=signals_out,
    )


@app.post("/api/v1/ucl/backtest", response_model=BacktestResponse, tags=["Backtest"])
def run_backtest(body: BacktestRequest):
    global _match_df
    if _match_df is None or len(_match_df) == 0:
        raise HTTPException(status_code=503, detail="UCL match data not available.")

    res: UCLBacktestResult = backtest_ucl(
        _match_df,
        xi=body.xi,
        min_train_matches=body.min_train_matches,
        edge_threshold=body.edge_threshold,
        window_weeks=body.window_weeks,
    )

    return BacktestResponse(
        n_matches=res.n_matches,
        brier_avg=res.brier_avg,
        log_loss=res.log_loss,
        roi_overall=res.roi_overall,
        total_bets=res.total_bets,
        winning_bets=res.winning_bets,
        win_rate=res.win_rate,
        details=res.details,
    )


@app.post("/api/v1/ucl/refresh", tags=["Admin"])
def refresh_model(background_tasks: BackgroundTasks):
    def _do():
        global _model, _match_df
        _match_df = load_ucl_data(force_refresh=True)
        _model = fit_ucl_model(_match_df)
    background_tasks.add_task(_do)
    return {"status": "scheduled", "message": "UCL data and model refresh triggered."}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)
