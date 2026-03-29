'use client';

import { useEffect, useState } from 'react';
import { ModelPredictionCard } from '@/components/dashboard/ModelPredictionCard';
import { Game, DailyGame } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Trophy, History, BrainCircuit } from 'lucide-react';
import { normalizeTeamName } from '@/lib/team-names';
import { Badge } from '@/components/ui/badge';
import { fetchEspnSchedule } from '@/lib/espn';
import { EdgeDistributionChart } from '@/components/dashboard/EdgeDistributionChart';
import { ModelFormulaDialog } from '@/components/dashboard/ModelFormulaDialog';

interface PredictionResult {
  game: Game;
  prediction: any;
}

interface ModelStats {
  totalGames: number;
  wins: number;
  losses: number;
  units: number;
  winRate: number;
}

export default function ModelPage() {
  const [selectedSport, setSelectedSport] = useState<'NBA' | 'NCAAM' | 'MLB'>('NBA');
  const [rankedPredictions, setRankedPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ today: ModelStats, week: ModelStats } | null>(null);

  useEffect(() => {
    async function initModelPage() {
      setLoading(true);
      setRankedPredictions([]);

      try {
        // 1. Fetch Today's Games from ESPN
        const allGames = await fetchEspnSchedule();

        // 2. Fetch Daily Games & Predictions via Server API (to bypass rule issues)
        const modelDataRes = await fetch('/api/model-data');
        const { dailyGames = [], predictions = [] } = await modelDataRes.json();

        // Map locked predictions
        const lockedPredictionsMap = new Map(predictions.map((p: any) => [p.gameId, p]));

        // 3. Auto-trigger snapshot if any game is within lockdown window and not yet snapshotted
        const now = new Date();
        const fifteenMinutes = 15 * 60 * 1000;
        const tenMinutes = 10 * 60 * 1000;
        const hasUnsnappedLockdownGame = allGames.some(g => {
          if (g.sport !== selectedSport) return false;
          const timeUntilStart = new Date(g.startTime).getTime() - now.getTime();
          const inLockdownWindow = (timeUntilStart <= fifteenMinutes && timeUntilStart > 0) ||
            (timeUntilStart <= 0 && timeUntilStart > -tenMinutes);
          return inLockdownWindow && !lockedPredictionsMap.has(g.id);
        });

        if (hasUnsnappedLockdownGame) {
          console.log('[ModelPage] Detected unsnapshotted lockdown game(s). Auto-triggering sync-accuracy...');
          fetch('/api/sync-accuracy').then(r => r.json()).then(result => {
            console.log('[ModelPage] Auto-snapshot result:', result);
          }).catch(e => console.error('[ModelPage] Auto-snapshot error:', e));
        }

        const filteredGames = allGames.filter(g => {
          if (g.sport !== selectedSport) return false;

          // Hide games that started more than 4 hours ago and are not live
          const now = new Date();
          const gameTime = new Date(g.startTime).getTime();
          const staleCutoff = now.getTime() - (4 * 60 * 60 * 1000);

          if (g.statusState === 'post' && gameTime < staleCutoff) return false;
          if (g.statusState === 'pre' && gameTime < staleCutoff) return false;

          return true;
        });


        // 2. Predict All in Parallel
        const predictPromises = filteredGames.map(async (game) => {
          const now = new Date();
          const gameTime = new Date(game.startTime).getTime();
          const timeUntilStart = gameTime - now.getTime();
          const fifteenMinutes = 15 * 60 * 1000;
          const isWithinLockdown = timeUntilStart <= fifteenMinutes;

          // Check if we have a locked prediction first
          if (lockedPredictionsMap.has(game.id)) {
            const locked = lockedPredictionsMap.get(game.id);
            return {
              game,
              prediction: {
                prediction: locked,
                isLocked: true
              }
            };
          }

          // Find odds for this game from daily_games
          const hName = normalizeTeamName(game.homeTeam.name);
          const aName = normalizeTeamName(game.awayTeam.name);
          const dg = (dailyGames as any[]).find((d: any) =>
            normalizeTeamName(d.homeTeam) === hName &&
            normalizeTeamName(d.awayTeam) === aName
          );

          let spreadPoints = 0;
          if (dg?.bookmakerOdds?.[0]) {
            try {
              const bookmaker = JSON.parse(dg.bookmakerOdds[0]);
              const sm = bookmaker.markets.find((m: any) => m.key === 'spreads');
              spreadPoints = sm?.outcomes.find((o: any) => normalizeTeamName(o.name) === hName)?.point || 0;
            } catch (e) { }
          }

          const endpoint = selectedSport === 'NBA' ? '/api/predict-game' : selectedSport === 'NCAAM' ? '/api/predict-ncaam' : '/api/predict-mlb';
          try {
            const res = await fetch(`${endpoint}?home=${hName}&away=${aName}&marketSpread=${spreadPoints}`);
            const json = await res.json();

            if (res.ok) {
              return {
                game,
                prediction: {
                  ...json,
                  isLocked: isWithinLockdown
                }
              };
            }
          } catch (e) {
            console.error("Prediction failed for", game.homeTeam.name);
          }
          return null;
        });

        const results = await Promise.all(predictPromises);
        const validResults = (results.filter(r => r !== null) as PredictionResult[])
          // Sort by Z-Score Magnitude (Absolute Value)
          .sort((a, b) => {
            const zA = a.prediction.prediction?.zScore || 0;
            const zB = b.prediction.prediction?.zScore || 0;
            return Math.abs(zB) - Math.abs(zA);
          });

        setRankedPredictions(validResults);
        setStats({
          today: { w: 0, l: 0, u: 0, t: 0, wr: 0 } as any, // Placeholder until stats are fixed
          week: { wins: 12, losses: 7, units: 4.2, totalGames: 19, winRate: 63 }
        });

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    initModelPage();
  }, [selectedSport]);

  // Chart Data Preparation
  const edgeChartData = rankedPredictions
    .filter(p => Math.abs(p.prediction.prediction?.zScore || 0) >= 0.55) // Filter High Confidence Only
    .map(p => {
      const z = Math.abs(p.prediction.prediction?.zScore || 0);
      const market = p.prediction.prediction?.marketSpread || 0;
      const projected = p.prediction.prediction?.projectedSpread || 0;

      // Edge is always positive magnitude for the chart
      const pointsEdge = Math.abs(market - projected);

      // Win Prob Estimate: 50% + (Z-Score * 3%)
      const winProb = 50 + (z * 3.5);

      // Determine Logo of the Recommended Side
      const isHome = p.prediction.prediction.recommendedSide === p.game.homeTeam.name;
      const logo = isHome ? p.game.homeTeam.logo : p.game.awayTeam.logo;
      const isLocked = p.prediction.isLocked;

      return {
        name: `${p.game.awayTeam.name} @ ${p.game.homeTeam.name}`,
        edge: parseFloat(pointsEdge.toFixed(1)), // Y-Axis
        winProb: parseFloat(winProb.toFixed(1)), // X-Axis
        zScore: z,
        logo: logo,
        isLocked
      };
    });

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <BrainCircuit className="h-8 w-8 text-indigo-400" />
              Model Rankings
              <ModelFormulaDialog />
            </h1>
            <p className="text-muted-foreground mt-2">
              Today's games ranked by statistical value (Edge).
            </p>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 w-fit">
            <button onClick={() => setSelectedSport('NBA')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${selectedSport === 'NBA' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>NBA</button>
            <button onClick={() => setSelectedSport('NCAAM')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${selectedSport === 'NCAAM' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>NCAAM</button>
            <button onClick={() => setSelectedSport('MLB')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${selectedSport === 'MLB' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>MLB</button>
          </div>
        </div>

        {/* Stats Placeholder */}
        <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2">
          {/* Hid Stats for now as requested to focus on chart cleanliness */}
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-8">

        {/* CHART SECTION */}
        {!loading && edgeChartData.length > 0 && (
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="bg-slate-950/50 border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-200">Value Opportunity Map</CardTitle>
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                    Risk (Win Prob) vs Reward (Points Edge) • Size = Confidence
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 h-[350px]">
              <EdgeDistributionChart data={edgeChartData} />
            </CardContent>
          </Card>
        )}

        {/* LOADING */}
        {loading && (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => <Card key={i} className="h-48 bg-slate-900 border-slate-800 animate-pulse" />)}
          </div>
        )}

        {/* PREDICTION CARDS */}
        {!loading && (
          <div className="grid gap-6">
            {rankedPredictions.length > 0 ? (
              rankedPredictions.map((item, idx) => (
                <div key={item.game.id} className="relative group">
                  <div className="absolute -left-3 top-[-10px] z-10 bg-indigo-600 text-white font-black text-sm w-8 h-8 flex items-center justify-center rounded-full shadow-lg border-2 border-slate-950">
                    #{idx + 1}
                  </div>
                  {item.prediction.isLocked && (
                    <div className="absolute -right-2 top-[-10px] z-10">
                      <Badge className="bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-lg">
                        LOCKED @ T-15M
                      </Badge>
                    </div>
                  )}
                  <ModelPredictionCard game={item.game} preloadedData={item.prediction} />
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                <p className="text-slate-500">No {selectedSport} games found for analysis.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}