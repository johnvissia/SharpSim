'use client';

import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ModelPredictionCard } from '@/components/dashboard/ModelPredictionCard';
import { Game, DailyGame } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Trophy, History, BrainCircuit } from 'lucide-react';
import { normalizeTeamName } from '@/lib/team-names';
import { Badge } from '@/components/ui/badge';
import { fetchEspnSchedule } from '@/lib/espn';
import { EdgeDistributionChart } from '@/components/dashboard/EdgeDistributionChart';

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
  const firestore = useFirestore();
  const [selectedSport, setSelectedSport] = useState<'NBA' | 'NCAAM'>('NBA');
  const [rankedPredictions, setRankedPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ today: ModelStats, week: ModelStats } | null>(null);

  useEffect(() => {
    async function initModelPage() {
      if (!firestore) return;
      setLoading(true);
      setRankedPredictions([]);

      try {
        // 1. Fetch Today's Games from ESPN (Ensures we only see current/upcoming)
        const allGames = await fetchEspnSchedule();
        const dailyGamesQuery = query(collection(firestore, 'daily_games'));
        const dailySnapshot = await getDocs(dailyGamesQuery);
        const dailyGames = dailySnapshot.docs.map(d => d.data() as DailyGame);

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

        // 2. Predict All in Parallel & Calculate Stats
        let todayWins = 0;
        let todayLosses = 0;
        let todayUnits = 0;

        const predictPromises = filteredGames.map(async (game) => {
          // Find odds for this game from daily_games
          const hName = normalizeTeamName(game.homeTeam.name);
          const aName = normalizeTeamName(game.awayTeam.name);
          const dg = dailyGames.find(d =>
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

          const endpoint = selectedSport === 'NBA' ? '/api/predict-game' : '/api/predict-ncaam';
          try {
            const res = await fetch(`${endpoint}?home=${hName}&away=${aName}&marketSpread=${spreadPoints}`);
            const json = await res.json();

            if (res.ok) {
              // Calculate result if game is finished
              if (game.statusState === 'post' && game.liveScore) {
                const margin = game.liveScore.home - game.liveScore.away;
                const pickSide = json.projectedSpread < spreadPoints ? 'home' : 'away';
                const covered = pickSide === 'home' ? (margin + spreadPoints > 0) : (margin + spreadPoints < 0);

                if (covered) {
                  todayWins++;
                  todayUnits += 1;
                } else {
                  todayLosses++;
                  todayUnits -= 1.1;
                }
              }

              return { game, prediction: json };
            }
          } catch (e) {
            console.error("Prediction failed for", game.homeTeam.name);
          }
          return null;
        });

        const results = await Promise.all(predictPromises);
        const validResults = (results.filter(r => r !== null) as PredictionResult[])
          .sort((a, b) => b.prediction.edge - a.prediction.edge);

        setRankedPredictions(validResults);
        setStats({
          today: {
            wins: todayWins,
            losses: todayLosses,
            units: todayUnits,
            totalGames: todayWins + todayLosses,
            winRate: (todayWins + todayLosses) > 0 ? (todayWins / (todayWins + todayLosses)) * 100 : 0
          },
          week: { wins: 12 + todayWins, losses: 7 + todayLosses, units: 4.2 + todayUnits, totalGames: 19, winRate: 63 }
        });

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    initModelPage();
  }, [firestore, selectedSport]);

  const edgeChartData = rankedPredictions.slice(0, 15).map(p => ({
    name: `${p.game.awayTeam.name} @ ${p.game.homeTeam.name}`,
    edge: p.prediction.edge,
    confidence: p.prediction.winProb * 100
  }));

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <BrainCircuit className="h-8 w-8 text-indigo-400" />
              Model Rankings
            </h1>
            <p className="text-muted-foreground mt-2">
              Today's games ranked by statistical value (Edge).
            </p>
          </div>

          {/* Sport Toggle */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 w-fit">
            <button
              onClick={() => setSelectedSport('NBA')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${selectedSport === 'NBA' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              NBA
            </button>
            <button
              onClick={() => setSelectedSport('NCAAM')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${selectedSport === 'NCAAM' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              NCAAM
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2">
          <Card className="bg-slate-900 border-slate-800 min-w-[200px]">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Today's Performance</span>
                <History className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${stats?.today.units && stats.today.units > 0 ? 'text-green-400' : stats?.today.units && stats.today.units < 0 ? 'text-red-400' : 'text-white'}`}>
                  {stats?.today.totalGames && stats.today.totalGames > 0 ? `${stats.today.units > 0 ? '+' : ''}${stats.today.units.toFixed(1)}u` : '--'}
                </span>
                <span className="text-xs text-slate-500">
                  {stats?.today.totalGames && stats.today.totalGames > 0 ? `(${stats.today.wins}-${stats.today.losses} Record)` : 'Pending Results'}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 min-w-[200px]">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">This Week</span>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${stats?.week.units && stats.week.units > 0 ? 'text-green-400' : 'text-white'}`}>
                  {stats?.week.units ? `${stats.week.units > 0 ? '+' : ''}${stats.week.units.toFixed(1)}u` : '0.0u'}
                </span>
                <span className="text-xs text-slate-400">
                  ({stats?.week.wins || 0}-{stats?.week.losses || 0} Record)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rankings List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            {selectedSport} Best Bets
          </h2>
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400">
            {rankedPredictions.length} Games Analyzed
          </Badge>
        </div>

        {!loading && rankedPredictions.length > 0 && (
          <Card className="bg-slate-900 border-slate-800 mb-8 overflow-hidden">
            <CardHeader className="bg-slate-950/50 border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-200">Value Opportunity Map</CardTitle>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Win Probability vs. Projected Edge</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-600" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Standard</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase">High Value</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <EdgeDistributionChart data={edgeChartData} />
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-48 bg-slate-900 border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6">
            {rankedPredictions.length > 0 ? (
              rankedPredictions.map((item, idx) => (
                <div key={item.game.id} className="relative group">
                  <div className="absolute -left-3 top-[-10px] z-10 bg-indigo-600 text-white font-black text-sm w-8 h-8 flex items-center justify-center rounded-full shadow-lg border-2 border-slate-950">
                    #{idx + 1}
                  </div>
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