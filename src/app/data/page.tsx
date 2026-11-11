'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { isUserAdmin } from '@/lib/admin';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Activity, 
  Zap, 
  Database, 
  Trophy, 
  BarChart3, 
  RefreshCw, 
  Play, 
  TrendingUp, 
  Loader2, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  Clock,
  Download,
  Shield,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface SportOperationResult {
  sport: string;
  action: 'rankings' | 'predictions';
  summary: string;
  time: string;
  topTeams?: Array<{ rank?: number; team: string; rating?: string | number }>;
  games?: Array<{ matchup?: string; homeTeam?: string; awayTeam?: string; projectedSpread?: number | string; signal?: string; betSignal?: string }>;
}

export default function DataPage() {
  const { user, isUserLoading } = useUser();
  const isAdmin = isUserAdmin(user?.uid);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activeResults, setActiveResults] = useState<Record<string, SportOperationResult>>({});
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const { toast } = useToast();

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">Admin Access Only</h1>
        <p className="text-sm text-slate-400">
          Data and model execution pipelines are restricted to system administrators. Model predictions and lines update automatically on schedule.
        </p>
        <Button asChild className="mt-4 bg-brand-500 hover:bg-brand-400">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const toggleExpand = (sport: string) => {
    setExpandedSport(prev => (prev === sport ? null : sport));
  };

  // NFL Actions
  const handleNFL = async (type: 'rankings' | 'predictions') => {
    const key = `nfl-${type}`;
    setLoadingAction(key);
    try {
      const res = await fetch('/api/run-nfl-engine', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'NFL execution failed');

      const result: SportOperationResult = {
        sport: 'NFL',
        action: type,
        summary: type === 'rankings'
          ? 'Recalibrated opponent-adjusted EPA, QB replacements & OL cluster injuries.'
          : `Simulated ${data.games?.length || 0} matchups (restricted to next 24 hours).`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        games: data.games
      };

      setActiveResults(prev => ({ ...prev, NFL: result }));
      setExpandedSport('NFL');
      toast({
        title: type === 'rankings' ? 'NFL Rankings Updated' : 'NFL Predictions Generated',
        description: result.summary,
      });
    } catch (err: any) {
      toast({ title: 'NFL Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  // EPL Actions
  const handleEPL = async (type: 'rankings' | 'predictions') => {
    const key = `epl-${type}`;
    setLoadingAction(key);
    try {
      const res = await fetch('/api/run-epl-engine', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'EPL execution failed');

      const result: SportOperationResult = {
        sport: 'EPL',
        action: type,
        summary: type === 'rankings'
          ? 'Updated club attack/defense ratings and Dixon-Coles parameters.'
          : `Calculated next 24-hour matchweek fixtures (${data.fixturesCalculated || 0} matches).`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        topTeams: data.topTeams?.map((t: any) => ({
          rank: t.rank,
          team: t.team,
          rating: `${t.attack} / ${t.defense}`
        })),
        games: data.fixtures?.map((f: any) => ({
          matchup: `${f.awayTeam} @ ${f.homeTeam}`,
          projectedSpread: f.projectedSpread !== undefined ? f.projectedSpread : `${f.predictedMargin} margin`,
          signal: f.betSignal
        }))
      };

      setActiveResults(prev => ({ ...prev, EPL: result }));
      setExpandedSport('EPL');
      toast({
        title: type === 'rankings' ? 'EPL Rankings Updated' : 'EPL Predictions Generated',
        description: result.summary,
      });
    } catch (err: any) {
      toast({ title: 'EPL Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  // UCL Actions
  const handleUCL = async (type: 'rankings' | 'predictions') => {
    const key = `ucl-${type}`;
    setLoadingAction(key);
    try {
      const res = await fetch('/api/run-ucl-engine', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'UCL execution failed');

      const result: SportOperationResult = {
        sport: 'UCL',
        action: type,
        summary: type === 'rankings'
          ? 'Updated club attack/defense ratings and UEFA coefficient parameters.'
          : `Calculated matchday fixtures (${data.fixturesCalculated || 0} matches).`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        topTeams: data.topTeams?.map((t: any) => ({
          rank: t.rank,
          team: t.team,
          rating: `${t.attack} / ${t.defense}`
        })),
        games: data.fixtures?.map((f: any) => ({
          matchup: `${f.awayTeam} @ ${f.homeTeam}`,
          projectedSpread: f.projectedSpread !== undefined ? f.projectedSpread : `${f.predictedMargin} margin`,
          signal: f.betSignal
        }))
      };

      setActiveResults(prev => ({ ...prev, UCL: result }));
      setExpandedSport('UCL');
      toast({
        title: type === 'rankings' ? 'UCL Rankings Updated' : 'UCL Predictions Generated',
        description: result.summary,
      });
    } catch (err: any) {
      toast({ title: 'UCL Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  // NBA Actions
  const handleNBA = async (type: 'rankings' | 'predictions') => {
    const key = `nba-${type}`;
    setLoadingAction(key);
    try {
      if (type === 'rankings') {
        await fetch('/api/sync-all-nba-teams', { method: 'POST' });
        const res = await fetch('/api/calculate-power-ratings', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'NBA calculation failed');

        const result: SportOperationResult = {
          sport: 'NBA',
          action: 'rankings',
          summary: 'True Power Ratings (TPR) and Pace solved for all 30 NBA teams.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          topTeams: data.topTeams?.map((t: any, i: number) => ({
            rank: i + 1,
            team: t.team,
            rating: t.tpr
          }))
        };
        setActiveResults(prev => ({ ...prev, NBA: result }));
      } else {
        const res = await fetch('/api/run-nba-engine', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'NBA simulation failed');

        const result: SportOperationResult = {
          sport: 'NBA',
          action: 'predictions',
          summary: `Simulated ${data.games?.length || 0} matchups (restricted to next 24 hours).`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          games: data.games?.map((g: any) => ({
            matchup: g.matchup || `${g.awayTeam} @ ${g.homeTeam}`,
            projectedSpread: g.projectedSpread !== undefined ? g.projectedSpread : g.marketSpread,
            signal: g.signal || g.betSignal || 'No Play'
          }))
        };
        setActiveResults(prev => ({ ...prev, NBA: result }));
      }
      setExpandedSport('NBA');
      toast({
        title: type === 'rankings' ? 'NBA Rankings Updated' : 'NBA Predictions Ready',
        description: 'Updated successfully and synced with Model page.',
      });
    } catch (err: any) {
      toast({ title: 'NBA Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  // MLB Actions
  const handleMLB = async (type: 'rankings' | 'predictions') => {
    const key = `mlb-${type}`;
    setLoadingAction(key);
    try {
      if (type === 'rankings') {
        await fetch('/api/sync-mlb-teams', { method: 'POST' });
        const res = await fetch('/api/calculate-mlb-ratings', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'MLB calculation failed');

        const result: SportOperationResult = {
          sport: 'MLB',
          action: 'rankings',
          summary: 'Pitcher FIP and bullpen rating composites updated for all 30 clubs.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          topTeams: data.topTeams?.map((t: any, i: number) => ({
            rank: i + 1,
            team: t.team,
            rating: t.rating
          }))
        };
        setActiveResults(prev => ({ ...prev, MLB: result }));
      } else {
        await fetch('/api/sync-accuracy');
        const result: SportOperationResult = {
          sport: 'MLB',
          action: 'predictions',
          summary: 'Projected runlines and moneyline fair values for games starting in the next 24 hours.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setActiveResults(prev => ({ ...prev, MLB: result }));
      }
      setExpandedSport('MLB');
      toast({
        title: type === 'rankings' ? 'MLB Rankings Updated' : 'MLB Predictions Ready',
        description: 'Operation complete.',
      });
    } catch (err: any) {
      toast({ title: 'MLB Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  // NCAAM Actions
  const handleNCAAM = async (type: 'rankings' | 'predictions') => {
    const key = `ncaam-${type}`;
    setLoadingAction(key);
    try {
      if (type === 'rankings') {
        await fetch('/api/sync-ncaam-teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch: 1 })
        });
        const res = await fetch('/api/calculate-ncaam-ratings', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'NCAAM calculation failed');

        const result: SportOperationResult = {
          sport: 'NCAAM',
          action: 'rankings',
          summary: 'Power 4 conference SRS and tempo ratings calculated.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          topTeams: data.topTeams?.map((t: any, i: number) => ({
            rank: i + 1,
            team: t.team,
            rating: t.rating
          }))
        };
        setActiveResults(prev => ({ ...prev, NCAAM: result }));
      } else {
        await fetch('/api/sync-accuracy');
        const result: SportOperationResult = {
          sport: 'NCAAM',
          action: 'predictions',
          summary: 'Generated point spreads for college basketball games within 24 hours.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setActiveResults(prev => ({ ...prev, NCAAM: result }));
      }
      setExpandedSport('NCAAM');
      toast({
        title: type === 'rankings' ? 'NCAAM Rankings Updated' : 'NCAAM Predictions Ready',
        description: 'Operation complete.',
      });
    } catch (err: any) {
      toast({ title: 'NCAAM Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Global Accuracy Settle
  const handleGlobalSync = async () => {
    setLoadingAction('global-sync');
    try {
      const res = await fetch('/api/sync-accuracy');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Global sync failed');

      toast({
        title: 'Settled Completed Games',
        description: `Graded ${data.graded?.length || 0} finished games and frozen ${data.snapshots?.length || 0} upcoming games.`,
      });
    } catch (err: any) {
      toast({ title: 'Sync Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const sportsRows = [
    {
      id: 'NFL',
      name: 'NFL Football',
      modelType: 'Opponent EPA & Monte Carlo',
      icon: Activity,
      status: 'Week 7 Active',
      statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      onRankings: () => handleNFL('rankings'),
      onPredictions: () => handleNFL('predictions'),
      rankingsLoading: loadingAction === 'nfl-rankings',
      predictionsLoading: loadingAction === 'nfl-predictions',
    },
    {
      id: 'UCL',
      name: 'UCL Champions League',
      modelType: 'Cross-League Dixon-Coles Poisson',
      icon: Trophy,
      status: 'Matchday Active',
      statusColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      onRankings: () => handleUCL('rankings'),
      onPredictions: () => handleUCL('predictions'),
      rankingsLoading: loadingAction === 'ucl-rankings',
      predictionsLoading: loadingAction === 'ucl-predictions',
    },
    {
      id: 'EPL',
      name: 'EPL Premier League',
      modelType: 'Dixon-Coles Bivariate Poisson',
      icon: Shield,
      status: 'Matchweek Active',
      statusColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      onRankings: () => handleEPL('rankings'),
      onPredictions: () => handleEPL('predictions'),
      rankingsLoading: loadingAction === 'epl-rankings',
      predictionsLoading: loadingAction === 'epl-predictions',
    },
    {
      id: 'NBA',
      name: 'NBA Basketball',
      modelType: 'True Power Rating (TPR)',
      icon: Zap,
      status: 'In-Season Active',
      statusColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      onRankings: () => handleNBA('rankings'),
      onPredictions: () => handleNBA('predictions'),
      rankingsLoading: loadingAction === 'nba-rankings',
      predictionsLoading: loadingAction === 'nba-predictions',
    },
    {
      id: 'MLB',
      name: 'MLB Baseball',
      modelType: 'Pitcher FIP / Pythagenpat',
      icon: Database,
      status: 'Daily Active',
      statusColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      onRankings: () => handleMLB('rankings'),
      onPredictions: () => handleMLB('predictions'),
      rankingsLoading: loadingAction === 'mlb-rankings',
      predictionsLoading: loadingAction === 'mlb-predictions',
    },
    {
      id: 'NCAAM',
      name: 'NCAAM Basketball',
      modelType: 'Power 4 SRS & Tempo',
      icon: BarChart3,
      status: 'Active Slate',
      statusColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      onRankings: () => handleNCAAM('rankings'),
      onPredictions: () => handleNCAAM('predictions'),
      rankingsLoading: loadingAction === 'ncaam-rankings',
      predictionsLoading: loadingAction === 'ncaam-predictions',
    },
  ];

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-indigo-400" />
            Model Operations
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Update rankings after each matchweek and forecast upcoming games.</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" /> Games only predicted within 24h of start
            </span>
          </p>
        </div>

        <Button
          onClick={handleGlobalSync}
          disabled={!!loadingAction}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-indigo-600/20 self-start sm:self-auto"
        >
          {loadingAction === 'global-sync' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Grade Completed Games
        </Button>
      </div>

      {/* Simplistic Clean Table Layout */}
      <Card className="bg-slate-900/60 border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Sport</th>
                <th className="py-3 px-4 hidden md:table-cell">Model Engine</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {sportsRows.map((row) => {
                const res = activeResults[row.id];
                const isExpanded = expandedSport === row.id;

                return (
                  <tr key={row.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <row.icon className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="font-bold text-sm text-white">{row.name}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-xs hidden md:table-cell">
                      {row.modelType}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${row.statusColor}`}>
                          {row.status}
                        </span>
                        {res && (
                          <button
                            onClick={() => toggleExpand(row.id)}
                            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 underline decoration-dotted"
                          >
                            <span>{res.action === 'rankings' ? 'Rankings' : 'Predictions'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={row.onRankings}
                          disabled={!!loadingAction}
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold gap-1"
                        >
                          {row.rankingsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3 text-indigo-400" />}
                          Update Rankings
                        </Button>

                        <Button
                          onClick={row.onPredictions}
                          disabled={!!loadingAction}
                          size="sm"
                          className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1 shadow-sm"
                        >
                          {row.predictionsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          Run (24h)
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quick Details Drawer if user clicks into a result */}
      {expandedSport && activeResults[expandedSport] && (
        <Card className="bg-slate-900/80 border-slate-800 text-xs shadow-lg animate-in fade-in-50 duration-200">
          <CardHeader className="py-3 px-4 border-b border-slate-800/80 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-sm font-bold text-white">
                {expandedSport} {activeResults[expandedSport].action === 'rankings' ? 'Power Rankings' : '24-Hour Match Projections'}
              </CardTitle>
              <span className="text-[11px] text-slate-400 font-mono">
                Updated {activeResults[expandedSport].time}
              </span>
            </div>
            <button
              onClick={() => setExpandedSport(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            <p className="text-slate-400 text-xs">{activeResults[expandedSport].summary}</p>

            {/* Top Teams Leaderboard Preview */}
            {activeResults[expandedSport].topTeams && activeResults[expandedSport].topTeams!.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono">
                {activeResults[expandedSport].topTeams!.slice(0, 5).map((t, i) => (
                  <div key={i} className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-500">#{t.rank || i + 1}</div>
                    <div className="font-bold text-slate-200 text-xs font-sans truncate">{t.team}</div>
                    <div className="text-indigo-400 text-xs font-bold mt-0.5">{t.rating}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Games Preview */}
            {activeResults[expandedSport].games && activeResults[expandedSport].games!.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {activeResults[expandedSport].games!.slice(0, 4).map((g, i) => (
                  <div key={i} className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200 text-xs">
                        {g.matchup || `${g.awayTeam} @ ${g.homeTeam}`}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Proj: {g.projectedSpread}
                      </div>
                    </div>
                    {g.signal && (
                      <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                        {g.signal}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compact Props Utility Bar */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <span className="text-slate-400 font-medium">Player Props Market Lines:</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              toast({ title: 'Syncing NBA Props', description: 'Fetching lines...' });
              await fetch('/api/sync-player-props?sport=nba', { method: 'POST' });
              toast({ title: 'NBA Props Synced', description: 'Ready.' });
            }}
            className="h-7 text-xs text-slate-300 hover:text-white border border-slate-800"
          >
            <Download className="w-3 h-3 mr-1" /> Sync NBA Props
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              toast({ title: 'Syncing MLB Props', description: 'Fetching lines...' });
              await fetch('/api/sync-player-props?sport=mlb', { method: 'POST' });
              toast({ title: 'MLB Props Synced', description: 'Ready.' });
            }}
            className="h-7 text-xs text-slate-300 hover:text-white border border-slate-800"
          >
            <Download className="w-3 h-3 mr-1" /> Sync MLB Props
          </Button>
        </div>
      </div>
    </div>
  );
}
