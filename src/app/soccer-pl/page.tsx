'use client';

import { useEffect, useState } from 'react';
import { Game } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BrainCircuit, Shield, TrendingUp, Flame, ChevronDown, Sparkles, Target, Percent } from 'lucide-react';
import { fetchEspnSchedule } from '@/lib/espn';
import { computeSoccerMatchInsights } from '@/lib/soccer-insights';

interface SoccerPrediction {
  homeTeam: string;
  awayTeam: string;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  predictedMargin: number;
  modelPick: string | null;
  winProbHome: number;
  winProbAway: number;
  drawProb: number;
  betSignal: 'ELITE VALUE' | 'STRONG VALUE' | 'PLAYABLE' | 'No Play';
  confidence: string;
  zScore: number;
  marketLine: number | null;
}

interface PredictionResult {
  game: Game;
  prediction: SoccerPrediction | null;
  isLoading: boolean;
  error: string | null;
}

const signalColors: Record<string, string> = {
  'ELITE VALUE': 'text-green-400 bg-green-950/40 border-green-500/50',
  'STRONG VALUE': 'text-brand-400 bg-brand-950/40 border-brand-500/50',
  'PLAYABLE': 'text-yellow-400 bg-yellow-950/40 border-yellow-500/50',
  'No Play': 'text-slate-400 bg-slate-900 border-slate-700',
};

function SoccerPredictionCard({ game, prediction, isLoading, error }: PredictionResult) {
  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-800 h-72 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </Card>
    );
  }

  if (error || !prediction) {
    return (
      <Card className="bg-red-950/20 border-red-900/50 p-4 flex items-center justify-center h-32">
        <span className="text-red-400 text-sm">Unavailable: {error ?? 'No prediction data'}</span>
      </Card>
    );
  }

  const activeColor = signalColors[prediction.betSignal] ?? signalColors['No Play'];
  const isDraw = prediction.modelPick === 'Draw';
  const isHomePick = !isDraw && prediction.modelPick === game.homeTeam?.name;
  const pickLogo = isDraw ? null : (isHomePick ? game.homeTeam?.logo : game.awayTeam?.logo);

  let startTime = '';
  try {
    startTime = new Date(game.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    startTime = game.startTime;
  }

  const zScoreDisplay = (prediction.zScore !== undefined && prediction.zScore !== null && !isNaN(prediction.zScore))
    ? prediction.zScore.toFixed(2)
    : '0.00';
  const awayGoalsDisplay = (prediction.predictedAwayGoals !== undefined && !isNaN(prediction.predictedAwayGoals))
    ? prediction.predictedAwayGoals.toFixed(1)
    : '0.0';
  const homeGoalsDisplay = (prediction.predictedHomeGoals !== undefined && !isNaN(prediction.predictedHomeGoals))
    ? prediction.predictedHomeGoals.toFixed(1)
    : '0.0';

  const [isExpanded, setIsExpanded] = useState(false);

  const winAway = Number(prediction.winProbAway ?? 0);
  const drawProb = Number(prediction.drawProb ?? 0);
  const winHome = Number(prediction.winProbHome ?? 0);

  const homeGoals = Number(prediction.predictedHomeGoals ?? 1.2);
  const awayGoals = Number(prediction.predictedAwayGoals ?? 1.0);

  const insights = computeSoccerMatchInsights(
    game.homeTeam?.name || 'Home',
    game.awayTeam?.name || 'Away',
    homeGoals,
    awayGoals,
    winHome,
    winAway,
    drawProb
  );

  return (
    <Card 
      onClick={() => setIsExpanded(prev => !prev)}
      className="overflow-hidden border-slate-800 bg-slate-900 transition-all duration-200 hover:border-slate-700/90 hover:shadow-xl hover:shadow-purple-950/20 cursor-pointer select-none"
    >
      {/* Header */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
        <div className="flex flex-col gap-0.5">
          <div className="text-xs font-bold uppercase tracking-wider text-white">
            {game.awayTeam?.name || 'Away'} @ {game.homeTeam?.name || 'Home'}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-purple-400" />
            Premier League
            <span className="text-slate-700">•</span>
            {game.statusState === 'in'
              ? <span className="text-red-400 font-bold animate-pulse">{game.statusDetail || 'LIVE'}</span>
              : game.statusState === 'post'
              ? <span className="text-slate-500">{game.statusDetail || 'FT'}</span>
              : startTime}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prediction.betSignal && prediction.betSignal !== 'No Play' && (
            <Badge variant="outline" className={`${prediction.betSignal.includes('ELITE') ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30'} text-[10px] font-bold uppercase py-0 px-2`}>
              {prediction.betSignal}
            </Badge>
          )}
          <div className="text-slate-500 hover:text-slate-300">
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-purple-400' : ''}`} />
          </div>
        </div>
      </div>

      <CardContent className="p-5 flex flex-col gap-5">
        {/* Model Pick Box */}
        <div className={`p-4 rounded-xl border ${activeColor} relative overflow-hidden`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[10px] uppercase opacity-80 font-bold mb-1">Model Pick</div>
              <div className="flex items-center gap-3">
                {pickLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pickLogo} alt={prediction.modelPick || 'Pick'} className="w-10 h-10 object-contain drop-shadow-lg" />
                )}
                <div className="text-2xl font-black text-white">
                  {prediction.modelPick ?? 'No Play'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase opacity-80 font-bold mb-1">Z-Score</div>
              <div className="text-3xl font-black text-white">
                {zScoreDisplay}
              </div>
            </div>
          </div>
        </div>

        {/* Projected Scoreline */}
        <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4">
          <div className="text-[10px] text-slate-500 uppercase font-black mb-3 tracking-wider">Projected Scoreline</div>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              {game.awayTeam?.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.awayTeam.logo} alt={game.awayTeam?.name || 'Away'} className="w-8 h-8 object-contain mx-auto mb-1" />
              )}
              <div className="text-xs text-slate-400 truncate">{game.awayTeam?.name || 'Away'}</div>
              <div className="text-3xl font-black text-white mt-1">{awayGoalsDisplay}</div>
            </div>
            <div className="px-4 text-slate-600 font-black text-sm">–</div>
            <div className="text-center flex-1">
              {game.homeTeam?.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.homeTeam.logo} alt={game.homeTeam?.name || 'Home'} className="w-8 h-8 object-contain mx-auto mb-1" />
              )}
              <div className="text-xs text-slate-400 truncate">{game.homeTeam?.name || 'Home'}</div>
              <div className="text-3xl font-black text-white mt-1">{homeGoalsDisplay}</div>
            </div>
          </div>
        </div>

        {/* Win Probability Bar */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-black mb-2 tracking-wider">Outcome Probability</div>
          <div className="flex h-6 rounded-lg overflow-hidden text-[10px] font-black bg-slate-950 border border-slate-800">
            <div
              className="bg-indigo-600 flex items-center justify-center text-white transition-all cursor-default"
              style={{ width: `${Math.max(winAway, 2)}%` }}
              title={`${game.awayTeam?.name || 'Away'}: ${winAway}%`}
            >
              {winAway >= 10 ? `${winAway.toFixed(0)}%` : ''}
            </div>
            <div
              className="bg-slate-700 flex items-center justify-center text-slate-200 transition-all cursor-default"
              style={{ width: `${Math.max(drawProb, 2)}%` }}
              title={`Draw: ${drawProb}%`}
            >
              {drawProb >= 8 ? `${drawProb.toFixed(0)}%` : ''}
            </div>
            <div
              className="bg-purple-600 flex items-center justify-center text-white transition-all cursor-default"
              style={{ width: `${Math.max(winHome, 2)}%` }}
              title={`${game.homeTeam?.name || 'Home'}: ${winHome}%`}
            >
              {winHome >= 8 ? `${winHome.toFixed(0)}%` : ''}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 pt-1 text-[11px] font-bold">
            <div className="flex items-center gap-1.5 min-w-0" title={game.awayTeam?.name}>
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-slate-300 truncate">{game.awayTeam?.name || 'Away'}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 min-w-0" title="Draw">
              <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
              <span className="text-slate-400">Draw</span>
            </div>
            <div className="flex items-center justify-end gap-1.5 min-w-0" title={game.homeTeam?.name}>
              <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
              <span className="text-slate-300 truncate text-right">{game.homeTeam?.name || 'Home'}</span>
            </div>
          </div>
        </div>

        {/* Live / Final Score */}
        {(game.statusState === 'in' || game.statusState === 'post') && game.liveScore && (
          <div className={`flex items-center justify-center gap-4 ${game.statusState === 'in' ? 'bg-red-950/20 border-red-500/20' : 'bg-slate-950/50 border-slate-800'} border rounded-lg p-3`}>
            {game.statusState === 'in' && <Flame className="w-4 h-4 text-red-400 animate-pulse" />}
            <span className="text-white font-black text-xl">
              {game.liveScore.away} – {game.liveScore.home}
            </span>
            <span className={`text-xs font-bold ${game.statusState === 'in' ? 'text-red-400' : 'text-slate-400'}`}>
              {game.statusDetail || (game.statusState === 'post' ? 'Full Time' : 'Live')}
            </span>
          </div>
        )}

        {/* Interactive Click-to-Expand Insights Trigger */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-300 font-medium">
                {isExpanded ? 'Match Insights & Sharp Props' : 'Click card for BTTS & Sharp Insights'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${insights.profile.badgeColor}`}>
                {insights.profile.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[11px] font-medium">{isExpanded ? 'Hide' : 'View'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-purple-400' : ''}`} />
            </div>
          </div>

          {/* Expanded Insights Drawer */}
          {isExpanded && (
            <div className="mt-3.5 space-y-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* 1. Both Teams to Score (BTTS) */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800/90 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                      Both Teams To Score (BTTS)
                    </span>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded border ${insights.btts.badgeColor}`}>
                    {insights.btts.recommendation}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {insights.btts.reasoning}
                </p>
                <div className="space-y-1 pt-0.5">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-emerald-400">Yes: {insights.btts.probYes}%</span>
                    <span className="text-slate-400">No: {insights.btts.probNo}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${insights.btts.probYes}%` }} />
                    <div className="bg-slate-700 h-full transition-all" style={{ width: `${insights.btts.probNo}%` }} />
                  </div>
                </div>
              </div>

              {/* 2. Totals Market (Over / Under 2.5 & 3.5) */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800/90 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                      Totals Market (O/U 2.5 & 3.5)
                    </span>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded border ${insights.totals.badgeColor}`}>
                    {insights.totals.recommendation}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {insights.totals.reasoning}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium">Total Exp Goals</div>
                    <div className="text-sm font-black text-white">{insights.totals.totalExpectedGoals}</div>
                  </div>
                  <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium">Over 2.5 Prob</div>
                    <div className="text-sm font-black text-emerald-400">{insights.totals.over25Prob}%</div>
                  </div>
                  <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium">Under 2.5 Prob</div>
                    <div className="text-sm font-black text-blue-400">{insights.totals.under25Prob}%</div>
                  </div>
                </div>
              </div>

              {/* 3. Top Projected Exact Scorelines */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800/90 p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                    Top Projected Exact Scorelines
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {insights.topScores.map((score, i) => (
                    <div key={i} className="bg-slate-900/90 rounded-lg p-2 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">#{i + 1} Likely</div>
                      <div className="text-sm font-black text-white font-mono mt-0.5">
                        {score.awayScore} – {score.homeScore}
                      </div>
                      <div className="text-[10px] font-bold text-purple-300 mt-0.5">
                        {score.prob}% Prob
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Secondary Sharp Angle & Defensive Props */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800/90 p-3.5 flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Secondary Angle: {insights.marketAngle.type}
                    </span>
                  </div>
                  <div className="text-xs font-extrabold text-white">
                    {insights.marketAngle.pick}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    {insights.marketAngle.reasoning}
                  </p>
                </div>
                <div className="text-right shrink-0 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Clean Sheet %</div>
                  <div className="text-xs font-bold text-slate-200 mt-0.5">
                    {game.homeTeam?.name ? `${insights.profile.homeCleanSheetProb}% (Home)` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {game.awayTeam?.name ? `${insights.profile.awayCleanSheetProb}% (Away)` : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PremierLeaguePage() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGames() {
      setLoading(true);
      setPredictions([]);

      try {
        const allGames = await fetchEspnSchedule();
        const now = Date.now();

        const eplGames = allGames.filter(g => {
          if (g.sport !== 'EPL') return false;
          const gTime = new Date(g.startTime).getTime();
          const hoursAway = (gTime - now) / (3600 * 1000);
          // Show live games, recently completed within 12h, or upcoming in next 48h
          if (g.statusState === 'in') return true;
          if (g.statusState === 'post') return hoursAway > -12;
          return hoursAway >= -12 && hoursAway <= 48;
        });

        if (eplGames.length === 0) {
          setPredictions([]);
          setLoading(false);
          return;
        }

        const initial: PredictionResult[] = eplGames.map(game => ({
          game,
          prediction: null,
          isLoading: true,
          error: null,
        }));
        setPredictions(initial);

        const results = await Promise.all(
          eplGames.map(async (game): Promise<PredictionResult> => {
            try {
              const res = await fetch(
                `/api/predict-soccer?home=${encodeURIComponent(game.homeTeam.name)}&away=${encodeURIComponent(game.awayTeam.name)}&league=EPL`
              );
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Prediction failed');
              return { game, prediction: json as SoccerPrediction, isLoading: false, error: null };
            } catch (e: any) {
              return { game, prediction: null, isLoading: false, error: e.message };
            }
          })
        );

        results.sort((a, b) => Math.abs(b.prediction?.zScore ?? 0) - Math.abs(a.prediction?.zScore ?? 0));
        setPredictions(results);
      } catch (e) {
        console.error('[soccer-pl] Load error:', e);
      } finally {
        setLoading(false);
      }
    }

    loadGames();
  }, []);

  return (
    <div className="container mx-auto p-4 md:p-8 relative">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <BrainCircuit className="h-7 w-7 text-purple-400" />
                Premier League Model
              </h1>
              <p className="text-muted-foreground mt-0.5">
                Today's EPL fixtures ranked by statistical edge and goal projection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className="border-purple-500/40 text-purple-400 bg-purple-950/30 text-[10px] font-bold uppercase tracking-wider">
              English Premier League
            </Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <TrendingUp className="w-3 h-3 mr-1" />
              Poisson Goal Model
            </Badge>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="h-72 bg-slate-900 border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
            <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-300 font-bold text-base">No Premier League fixtures today or tomorrow.</p>
            <p className="text-slate-500 text-xs mt-1.5 max-w-sm mx-auto">
              Upcoming Matchweek fixtures will appear as kickoff approaches (within 24–48 hours).
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {predictions.map((item, idx) => (
              <div key={item.game.id} className="relative group">
                {!item.isLoading && item.prediction && (
                  <div className="absolute -left-3 top-[-10px] z-10 bg-purple-600 text-white font-black text-sm w-8 h-8 flex items-center justify-center rounded-full shadow-lg border-2 border-slate-950">
                    #{idx + 1}
                  </div>
                )}
                <SoccerPredictionCard {...item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
