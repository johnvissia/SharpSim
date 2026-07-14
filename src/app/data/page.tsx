'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Download, Loader2, Zap, Activity, ShieldCheck, Database, BarChart3, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Image from 'next/image';

export default function DataPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const { toast } = useToast();

  const handleAction = async (endpoint: string, actionKey: string, successTitle: string, body?: any) => {
    setLoading(actionKey);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Action failed');

      setResults(prev => ({ ...prev, [actionKey]: data }));
      toast({
        title: successTitle,
        description: 'Successfully completed operation.',
      });
    } catch (error: any) {
      toast({
        title: 'Operation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleSyncNBA = async () => {
    setLoading('sync-nba');
    let totalSynced = 0;
    try {
      toast({ title: 'Syncing NBA', description: 'Starting 3-batch sync process... (~45s)' });

      for (let b = 1; b <= 3; b++) {
        const res = await fetch('/api/sync-all-nba-teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch: b })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Batch ${b} failed`);

        totalSynced += data.successCount || 0;
        setResults(prev => ({
          ...prev,
          'sync-nba': { ...data, successCount: totalSynced, totalTeams: 30 }
        }));

        if (b < 3) await new Promise(r => setTimeout(r, 10000));
      }

      toast({ title: 'NBA Sync Complete', description: `All ${totalSynced} teams synced successfully.` });

      // After games are synced, update injuries automatically
      toast({ title: 'Updating Injuries', description: 'Fetching latest NBA injury report...' });
      await fetch('/api/update-injuries', { method: 'POST' });
      toast({ title: 'Injuries Updated', description: 'Latest injury data is now applied.' });
    } catch (error: any) {
      toast({ title: 'NBA Sync Failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleSyncNCAAM = async () => {
    setLoading('sync-ncaam');
    let totalSynced = 0;
    try {
      // 7 batches of 10 teams (69 total)
      const TOTAL_BATCHES = 7;
      toast({ title: 'Syncing NCAAM', description: `Starting ${TOTAL_BATCHES}-batch sync... (~90s)` });

      for (let b = 1; b <= TOTAL_BATCHES; b++) {
        const res = await fetch('/api/sync-ncaam-teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch: b })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Batch ${b} failed`);

        totalSynced += data.successCount || 0;
        setResults(prev => ({
          ...prev,
          'sync-ncaam': { ...data, successCount: totalSynced, totalTeams: data.totalTeams || 69 }
        }));

        // Safety pause between batches
        if (b < TOTAL_BATCHES) await new Promise(r => setTimeout(r, 5000));
      }

      toast({ title: 'NCAAM Sync Complete', description: `Successfully synced ${totalSynced} teams.` });
    } catch (error: any) {
      toast({ title: 'NCAAM Sync Failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleSyncMLB = async () => {
    setLoading('sync-mlb');
    try {
      toast({ title: 'Syncing MLB', description: `Initializing MLB Team Data...` });
      const res = await fetch('/api/sync-mlb-teams', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Sync failed`);
      
      setResults(prev => ({ ...prev, 'sync-mlb': { ...data, successCount: 30, totalTeams: 30 } }));
      toast({ title: 'MLB Sync Complete', description: `Ready for mathematical modeling.` });
    } catch (error: any) {
      toast({ title: 'MLB Sync Failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleSyncProps = async (sport: 'NBA' | 'MLB') => {
    const loadingKey = sport === 'NBA' ? 'sync-props-nba' : 'sync-props-mlb';
    setLoading(loadingKey);
    try {
      toast({ title: `Syncing ${sport} Props`, description: `Fetching ${sport} player props from Odds API...` });
      const res = await fetch(`/api/sync-player-props?sport=${sport.toLowerCase()}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${sport} Prop sync failed`);

      setResults(prev => ({ ...prev, [loadingKey]: data }));
      toast({ title: `${sport} Prop Sync Complete`, description: `Successfully synced ${data.count} ${sport} player props.` });
    } catch (error: any) {
      toast({ title: `${sport} Prop Sync Failed`, description: error.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const AdminCard = ({
    title,
    description,
    icon: Icon,
    sport,
    onSync,
    onCalculate,
    syncLoading,
    calcLoading,
    result
  }: any) => (
    <Card className="border-slate-800 bg-slate-900/50 overflow-hidden">
      <CardHeader className="bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Icon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Step 1: Data Sync</h4>
            <p className="text-xs text-slate-500 mb-2">Fetch latest game scores and team stats from ESPN.</p>
            <Button
              onClick={onSync}
              disabled={!!loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12"
            >
              {syncLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Database className="mr-2 h-5 w-5" />}
              Sync {sport} Data
            </Button>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t border-slate-800">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Step 2: Model Calculation</h4>
            <p className="text-xs text-slate-500 mb-2">Run iterative SRS algorithm and update power ratings.</p>
            <Button
              onClick={onCalculate}
              disabled={!!loading}
              variant="outline"
              className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 font-bold h-12"
            >
              {calcLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
              Calculate {sport} Ratings
            </Button>
          </div>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span className="text-xs font-bold text-slate-300">Process Status</span>
              </div>
              {result.topTeams && (
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Top 10 Preview</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Teams Processed</p>
                <p className="text-lg font-black text-white">
                  {result.successCount ?? result.synced?.length ?? result.topTeams?.length ?? '...'}
                  {result.totalTeams ? <span className="text-xs text-slate-500 font-medium"> / {result.totalTeams}</span> : ''}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Latest Detail</p>
                <p className="text-lg font-black text-indigo-400">
                  {result.iterations ? `${result.iterations} iter` : (result.batch ? `Batch ${result.batch}` : 'Done')}
                </p>
              </div>
            </div>

            {result.topTeams && (
              <div className="pt-4 border-t border-slate-800/50">
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  <TooltipProvider>
                    {result.topTeams.map((team: any, i: number) => (
                      <Tooltip key={team.abbreviation || i}>
                        <TooltipTrigger asChild>
                          <div className="relative group cursor-help">
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center z-10 border border-slate-900 shadow-lg">
                              <span className="text-[8px] font-black text-white">{i + 1}</span>
                            </div>
                            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center p-1.5 border border-slate-800 group-hover:border-indigo-500/50 transition-colors">
                              <img
                                src={team.logo}
                                alt={team.team}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png';
                                }}
                              />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-slate-900 border-slate-800 text-slate-200">
                          <div className="text-xs font-bold">{team.team}</div>
                          <div className="text-[10px] text-indigo-400 font-mono">Rating: {team.tpr || team.rating}</div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-bold">
                      {sport === 'NBA' ? (
                        <tr>
                          <th className="px-3 py-2">Team</th>
                          <th className="px-2 py-2 text-right">TPR</th>
                          <th className="px-2 py-2 text-right">SRS</th>
                          <th className="px-2 py-2 text-right">Recent</th>
                          <th className="px-2 py-2 text-right">Inj</th>
                          <th className="px-2 py-2 text-right">Rest</th>
                          <th className="px-2 py-2 text-right">Pace</th>
                        </tr>
                      ) : sport === 'MLB' ? (
                        <tr>
                          <th className="px-3 py-2">Team</th>
                          <th className="px-2 py-2 text-right">Rating</th>
                          <th className="px-2 py-2 text-right">SRS</th>
                          <th className="px-2 py-2 text-right">Wins</th>
                          <th className="px-2 py-2 text-right">Losses</th>
                          <th className="px-2 py-2 text-right">Avg Margin</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-3 py-2">Team</th>
                          <th className="px-2 py-2 text-right">Blended</th>
                          <th className="px-2 py-2 text-right">SRS</th>
                          <th className="px-2 py-2 text-right">Recent</th>
                          <th className="px-2 py-2 text-right">ORB%</th>
                          <th className="px-2 py-2 text-right">DRB%</th>
                          <th className="px-2 py-2 text-right">Pace</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {result.topTeams.map((team: any) => (
                        <tr key={team.abbreviation} className="hover:bg-indigo-500/5 transition-colors">
                          <td className="px-3 py-2 font-bold text-slate-200 flex items-center gap-2">
                            <span className="w-4 text-slate-500">{team.abbreviation}</span>
                            <span className="truncate max-w-[80px]">{team.team}</span>
                          </td>
                          {sport === 'NBA' ? (
                            <>
                              <td className="px-2 py-2 text-right font-black text-indigo-400">{team.tpr}</td>
                              <td className="px-2 py-2 text-right text-slate-400">{team.srs}</td>
                              <td className="px-2 py-2 text-right text-slate-400">{team.recency}</td>
                              <td className={`px-2 py-2 text-right ${parseFloat(team.injuries) < 0 ? 'text-red-400' : 'text-slate-500'}`}>{team.injuries}</td>
                              <td className={`px-2 py-2 text-right ${parseFloat(team.rest) < 0 ? 'text-amber-400' : 'text-slate-500'}`}>{team.rest}</td>
                              <td className="px-2 py-2 text-right text-slate-500">{team.pace}</td>
                            </>
                          ) : sport === 'MLB' ? (
                            <>
                              <td className="px-2 py-2 text-right font-black text-indigo-400">{team.rating}</td>
                              <td className="px-2 py-2 text-right text-slate-400">{team.srs}</td>
                              <td className="px-2 py-2 text-right text-slate-400">{team.wins}</td>
                              <td className="px-2 py-2 text-right text-slate-400">{team.losses}</td>
                              <td className="px-2 py-2 text-right text-slate-500">{team.avgMargin}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-2 py-2 text-right font-black text-indigo-400">{team.rating}</td>
                              <td className="px-2 py-2 text-right text-slate-400">{team.srs}</td>
                              <td className="px-2 py-2 text-right text-slate-400">{team.recency}</td>
                              <td className="px-2 py-2 text-right text-slate-500">{team.orb}%</td>
                              <td className="px-2 py-2 text-right text-slate-500">{team.drb}%</td>
                              <td className="px-2 py-2 text-right text-slate-500">{team.pace}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-10 w-10 text-indigo-500" />
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
            Model Administration
          </h1>
        </div>
        <p className="text-slate-400 max-w-2xl font-medium">
          Control center for the betting model. Sync live data from ESPN and trigger power rating recalculations to keep projections accurate.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AdminCard
          title="NBA Model"
          description="Season-long SRS with injury & rest adjustments."
          icon={Activity}
          sport="NBA"
          onSync={handleSyncNBA}
          onCalculate={() => handleAction('/api/calculate-power-ratings', 'calc-nba', 'NBA Ratings Calculated')}
          syncLoading={loading === 'sync-nba'}
          calcLoading={loading === 'calc-nba'}
          result={results['calc-nba'] || results['sync-nba']}
        />

        <AdminCard
          title="NCAAM Model"
          description="Power 4 balanced SRS with pace & reb adjustments."
          icon={Zap}
          sport="NCAAM"
          onSync={handleSyncNCAAM}
          onCalculate={() => handleAction('/api/calculate-ncaam-ratings', 'calc-ncaam', 'NCAAM Ratings Calculated')}
          syncLoading={loading === 'sync-ncaam'}
          calcLoading={loading === 'calc-ncaam'}
          result={results['calc-ncaam'] || results['sync-ncaam']}
        />

        <AdminCard
          title="MLB Model"
          description="Architecture ready for custom baseball projection math."
          icon={Database}
          sport="MLB"
          onSync={handleSyncMLB}
          onCalculate={() => handleAction('/api/calculate-mlb-ratings', 'calc-mlb', 'MLB Ratings Calculated')}
          syncLoading={loading === 'sync-mlb'}
          calcLoading={loading === 'calc-mlb'}
          result={results['calc-mlb'] || results['sync-mlb']}
        />

        <Card className="border-indigo-500/30 bg-indigo-950/10 md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <BarChart3 className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <CardTitle>Player Prop Engine</CardTitle>
                <CardDescription>Market lines for NBA player points and MLB props (Strikeouts, Hits, etc.)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="space-y-1">
                <h4 className="font-bold text-white uppercase italic tracking-tight">NBA Player Props</h4>
                <p className="text-xs text-slate-400">Fetch Points totals lines.</p>
                {results['sync-props-nba'] && (
                  <Badge variant="outline" className="mt-1 bg-green-500/10 text-green-400 border-green-500/20">
                    ✓ {results['sync-props-nba'].count} NBA Props Synced
                  </Badge>
                )}
              </div>
              <Button
                onClick={() => handleSyncProps('NBA')}
                disabled={!!loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black"
              >
                {loading === 'sync-props-nba' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Sync NBA
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="space-y-1">
                <h4 className="font-bold text-white uppercase italic tracking-tight">MLB Player Props</h4>
                <p className="text-xs text-slate-400">Fetch Strikeouts, Hits, Home Runs, etc.</p>
                {results['sync-props-mlb'] && (
                  <Badge variant="outline" className="mt-1 bg-green-500/10 text-green-400 border-green-500/20">
                    ✓ {results['sync-props-mlb'].count} MLB Props Synced
                  </Badge>
                )}
              </div>
              <Button
                onClick={() => handleSyncProps('MLB')}
                disabled={!!loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black"
              >
                {loading === 'sync-props-mlb' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Sync MLB
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="pt-8 border-t border-slate-800">
        <div className="bg-amber-950/20 border border-amber-900/50 p-6 rounded-2xl flex gap-4 items-start">
          <ShieldCheck className="h-6 w-6 text-amber-500 mt-1" />
          <div>
            <h4 className="font-bold text-amber-400 mb-1 tracking-tight uppercase">Operational Safety</h4>
            <p className="text-sm text-amber-200/60 leading-relaxed">
              Calculations are performed in the background. NBA sync uses batching to avoid ESPN rate limits.
              Syncing Power 4 NCAAM teams can take up to 2 minutes depending on game volume.
              Ensure ratings are recalculated <span className="text-amber-400 font-bold">after every sync</span> for maximum projection accuracy.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
