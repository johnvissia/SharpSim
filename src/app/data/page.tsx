'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Download, Loader2, TrendingUp, TrendingDown, Activity, Heart, Battery, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const NBA_TEAMS = [
  'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets',
  'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
  'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
  'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat',
  'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
  'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns',
  'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors',
  'Utah Jazz', 'Washington Wizards',
];

export default function DataPage() {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scraperData, setScraperData] = useState<any>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllResults, setSyncAllResults] = useState<any>(null);
  const [calculatingRatings, setCalculatingRatings] = useState(false);
  const [ratingsResults, setRatingsResults] = useState<any>(null);
  const { toast } = useToast();

  const handleScrape = async () => {
    if (!selectedTeam) {
      toast({
        title: 'Select a Team',
        description: 'Please choose a team to scrape data for.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setScraperData(null);
    setSyncAllResults(null);

    try {
      const response = await fetch(`/api/scrape-team-games?team=${encodeURIComponent(selectedTeam)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape data');
      }

      setScraperData(data);
      toast({
        title: 'Data Scraped!',
        description: `Successfully fetched ${data.summary.totalGames} games for ${selectedTeam}`,
      });
    } catch (error: any) {
      toast({
        title: 'Scraping Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const PAUSE_BETWEEN_BATCHES_MS = 35_000;

  async function syncRequest(body?: { batch?: number }): Promise<any> {
    const response = await fetch('/api/sync-all-nba-teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        'Server returned an error page instead of data. Basketball Reference may be blocking requests. Use smaller batches and try again.'
      );
    }
    if (!response.ok) {
      throw new Error(data.error || 'Sync failed');
    }
    return data;
  }

  const handleSyncBatch = async (batch: 1 | 2 | 3) => {
    setSyncingAll(true);
    setScraperData(null);
    setSyncAllResults(null);
    setRatingsResults(null);
    try {
      const label = batch === 1 ? '1–10' : batch === 2 ? '11–20' : '21–30';
      toast({
        title: `Syncing batch ${batch}`,
        description: `Teams ${label}… This may take a few minutes.`,
      });
      const data = await syncRequest({ batch });
      setSyncAllResults(data);
      toast({
        title: 'Batch complete',
        description: `Synced ${data.successCount} of ${data.totalTeams} teams (${label})`,
      });
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setScraperData(null);
    setSyncAllResults(null);
    setRatingsResults(null);
    try {
      toast({
        title: 'Syncing all (3 batches)',
        description: 'Batch 1/3… Avoids timeouts and rate limits.',
      });
      let accSuccess = 0;
      let accFailed: string[] = [];
      let data: any = await syncRequest({ batch: 1 });
      accSuccess += data.successCount ?? 0;
      accFailed = [...accFailed, ...(data.failedTeams ?? [])];
      setSyncAllResults({ ...data, totalTeams: 30, successCount: accSuccess, failedCount: accFailed.length, failedTeams: accFailed, batchLabel: '1–30 (batch 1 done)' });
      toast({ title: 'Batch 1 done', description: 'Waiting 35s before batch 2…' });
      await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_BATCHES_MS));
      data = await syncRequest({ batch: 2 });
      accSuccess += data.successCount ?? 0;
      accFailed = [...accFailed, ...(data.failedTeams ?? [])];
      setSyncAllResults({ ...data, totalTeams: 30, successCount: accSuccess, failedCount: accFailed.length, failedTeams: accFailed, batchLabel: '1–30 (batches 1–2 done)' });
      toast({ title: 'Batch 2 done', description: 'Waiting 35s before batch 3…' });
      await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_BATCHES_MS));
      data = await syncRequest({ batch: 3 });
      accSuccess += data.successCount ?? 0;
      accFailed = [...accFailed, ...(data.failedTeams ?? [])];
      setSyncAllResults({ ...data, totalTeams: 30, successCount: accSuccess, failedCount: accFailed.length, failedTeams: accFailed, scheduleAnalysisComplete: true, savedToFirestore: true, batchLabel: '1–30 (all batches)' });
      toast({
        title: 'All batches complete',
        description: `Synced ${accSuccess}/30 teams across 3 batches.`,
      });
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleCalculateRatings = async () => {
    setCalculatingRatings(true);
    setRatingsResults(null);

    try {
      toast({
        title: 'Calculating',
        description: 'Running SRS algorithm and calculating power ratings...',
      });

      const response = await fetch('/api/calculate-power-ratings', {
        method: 'POST',
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate ratings');
      }

      setRatingsResults(data);
      toast({
        title: 'Calculation Complete!',
        description: `Power ratings calculated successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Calculation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCalculatingRatings(false);
    }
  };

  // Helper function to get fatigue badge for a game
  const getFatigueBadge = (game: any) => {
    if (game.gamesInLast5Days >= 4) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          4 in 5
        </Badge>
      );
    }
    if (game.gamesInLast4Days >= 3) {
      return (
        <Badge className="text-xs bg-orange-600 hover:bg-orange-700">
          3 in 4
        </Badge>
      );
    }
    if (game.isBackToBack) {
      return (
        <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500">
          B2B
        </Badge>
      );
    }
    return null;
  };

  const TeamRatingCard = ({ team, rank, isTop }: any) => {
    const tprValue = parseFloat(team.tpr);
    const injuryValue = parseFloat(team.injuries);
    const hasInjuries = injuryValue > 0.1;

    return (
      <div className={`p-4 rounded-lg border-2 ${
        isTop 
          ? 'bg-gradient-to-br from-green-950/40 to-green-900/20 border-green-500/50' 
          : 'bg-gradient-to-br from-red-950/40 to-red-900/20 border-red-500/50'
      }`}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${isTop ? 'text-green-400' : 'text-red-400'}`}>
              #{rank}
            </span>
            <div>
              <h4 className="font-bold text-white">{team.team}</h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={tprValue > 5 ? "default" : tprValue > 0 ? "secondary" : "destructive"}>
                  TPR: {team.tpr}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Pace: {team.pace}
                </Badge>
              </div>
            </div>
          </div>
          {hasInjuries && (
            <div className="flex items-center gap-1 text-orange-400">
              <Heart className="h-4 w-4" />
              <span className="text-xs">-{team.injuries}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-black/20 p-2 rounded">
            <div className="text-muted-foreground mb-1">SRS</div>
            <div className="font-bold text-blue-400">{team.srs}</div>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <div className="text-muted-foreground mb-1">Recency</div>
            <div className="font-bold text-purple-400">{team.recency}</div>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <div className="text-muted-foreground mb-1">Blended</div>
            <div className="font-bold text-cyan-400">{team.blended}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Team Power</span>
            <span>{tprValue > 0 ? '+' : ''}{tprValue.toFixed(1)}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${isTop ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ 
                width: `${Math.min(Math.abs(tprValue) * 5, 100)}%`,
                marginLeft: tprValue < 0 ? 'auto' : '0'
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <LineChart className="h-8 w-8 text-primary" />
          Data Hub
        </h1>
        <p className="text-muted-foreground">
          NBA betting model with SRS ratings, injury tracking, schedule fatigue, and blowout dampening
        </p>
      </header>

      <div className="grid gap-8">
        {/* Sync All Teams Section */}
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>🏀 Sync NBA Teams</CardTitle>
            <CardDescription>
              Scrape game data from Basketball Reference. Use <strong>batches</strong> to avoid timeouts and blocking — each batch runs ~3–4 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {syncingAll && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing… {syncAllResults?.successCount != null ? `${syncAllResults.successCount}/30` : ''}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={() => handleSyncBatch(1)}
                disabled={syncingAll || loading}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Batch 1 (1–10)
              </Button>
              <Button
                onClick={() => handleSyncBatch(2)}
                disabled={syncingAll || loading}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Batch 2 (11–20)
              </Button>
              <Button
                onClick={() => handleSyncBatch(3)}
                disabled={syncingAll || loading}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Batch 3 (21–30)
              </Button>
              <Button
                onClick={handleSyncAll}
                disabled={syncingAll || loading}
                size="lg"
                className="w-full sm:col-span-2"
              >
                <Download className="mr-2 h-4 w-4" />
                Sync All (3 batches)
              </Button>
            </div>

            {syncAllResults && (
              <div className="mt-6 space-y-4">
                <div className="bg-slate-900 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">📊 Sync Results</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Teams</p>
                      <p className="text-2xl font-bold">{syncAllResults.totalTeams}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Successful</p>
                      <p className="text-2xl font-bold text-green-500">{syncAllResults.successCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Failed</p>
                      <p className="text-2xl font-bold text-red-500">{syncAllResults.failedCount}</p>
                    </div>
                  </div>

                  {syncAllResults.failedTeams && syncAllResults.failedTeams.length > 0 && (
                    <div className="mt-4 bg-red-950/30 border border-red-500/50 rounded p-3">
                      <p className="text-sm font-semibold text-red-400 mb-1">Failed teams:</p>
                      <p className="text-sm text-red-300">{syncAllResults.failedTeams.join(', ')}</p>
                    </div>
                  )}

                  {syncAllResults.scheduleAnalysisComplete && (
                    <div className="mt-4 bg-green-950/30 border border-green-500/50 rounded p-3">
                      <p className="text-sm text-green-400">✅ Schedule fatigue analysis complete for all teams</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Power Ratings Calculator */}
        <Card className="border-green-500/50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  ⚡ Complete Power Ratings System
                  <Badge variant="outline" className="ml-2">Updated Model</Badge>
                </CardTitle>
                <CardDescription className="mt-2">
                  Phase 1-3: Net Rating → SRS → Injuries + Blowout Dampening + Schedule Fatigue
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                Model Improvements
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ HCA reduced to 2.3 pts (modern NBA)</li>
                <li>✅ Blowout dampening (20+ margin = 50% weight)</li>
                <li>✅ Tiered injury replacements (Star/Starter/Bench)</li>
                <li>✅ Expanded rest penalties (B2B, 3-in-4, 4-in-5)</li>
                <li>✅ Bet sizing capped at 3-5% max</li>
                <li>✅ Schedule fatigue tracking</li>
              </ul>
            </div>

            <Button 
              onClick={handleCalculateRatings} 
              disabled={calculatingRatings || syncingAll} 
              size="lg"
              className="w-full"
              variant="default"
            >
              {calculatingRatings ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Calculating Power Ratings...
                </>
              ) : (
                <>
                  ⚡ Calculate Power Ratings
                </>
              )}
            </Button>

            {ratingsResults && (
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Calculation Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-black/20 p-4 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Teams</p>
                      <p className="text-2xl font-bold">{ratingsResults.message?.match(/\d+/)?.[0]}</p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">SRS Iterations</p>
                      <p className="text-2xl font-bold text-blue-500">{ratingsResults.iterations}</p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Convergence</p>
                      <p className="text-2xl font-bold text-green-500">{ratingsResults.convergence?.toFixed(6)}</p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Injuries Tracked</p>
                      <p className="text-2xl font-bold text-orange-500">{ratingsResults.injuriesFound || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <h4 className="font-bold text-lg">Top 5 Teams</h4>
                    </div>
                    <div className="space-y-3">
                      {ratingsResults.topTeams?.map((team: any, idx: number) => (
                        <TeamRatingCard key={idx} team={team} rank={idx + 1} isTop={true} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                      <h4 className="font-bold text-lg">Bottom 5 Teams</h4>
                    </div>
                    <div className="space-y-3">
                      {ratingsResults.bottomTeams?.map((team: any, idx: number) => (
                        <TeamRatingCard 
                          key={idx} 
                          team={team} 
                          rank={30 - (4 - idx)} 
                          isTop={false} 
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-950/20 border border-blue-500/30 rounded-lg p-6">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-400" />
                    Understanding the Ratings
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-blue-400 mb-1">TPR (Team Power Rating)</p>
                      <p className="text-muted-foreground">
                        Final rating after all adjustments. Positive = above average.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-400 mb-1">SRS (Simple Rating System)</p>
                      <p className="text-muted-foreground">
                        Season-long strength adjusted for opponent quality (70% weight).
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-purple-400 mb-1">Recency Rating</p>
                      <p className="text-muted-foreground">
                        Last 10 games with blowout dampening (30% weight).
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-cyan-400 mb-1">Blended Rating</p>
                      <p className="text-muted-foreground">
                        70% SRS + 30% Recent form = base strength.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-orange-400 mb-1">Injury Penalty</p>
                      <p className="text-muted-foreground">
                        Tiered system: Stars hurt more than bench players.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-yellow-400 mb-1">Pace</p>
                      <p className="text-muted-foreground">
                        Possessions per game. Affects final point spread.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Single Team Test Scraper */}
        <Card>
          <CardHeader>
            <CardTitle>Basketball Reference Scraper (Single Team Test)</CardTitle>
            <CardDescription>
              Test the scraper with schedule fatigue analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Select Team</label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {NBA_TEAMS.map(team => (
                      <SelectItem key={team} value={team}>
                        {team}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleScrape} disabled={loading || !selectedTeam} size="lg">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    Scrape Data
                  </>
                )}
              </Button>
            </div>

            {scraperData && (
              <div className="mt-6 space-y-6">
                {/* Team Summary */}
                <div className="bg-slate-900 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">📊 Team Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Record</p>
                      <p className="text-2xl font-bold">
                        {scraperData.summary.wins}-{scraperData.summary.losses}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Margin</p>
                      <p className="text-2xl font-bold text-primary">
                        {scraperData.summary.avgAdjustedMargin > 0 ? '+' : ''}
                        {scraperData.summary.avgAdjustedMargin.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Home MOV</p>
                      <p className="text-2xl font-bold text-green-500">
                        {scraperData.summary.homeMOV > 0 ? '+' : ''}
                        {scraperData.summary.homeMOV.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Away MOV</p>
                      <p className="text-2xl font-bold text-orange-500">
                        {scraperData.summary.awayMOV > 0 ? '+' : ''}
                        {scraperData.summary.awayMOV.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Schedule Fatigue Analysis */}
                {scraperData.scheduleStats && (
                  <div className="bg-slate-900 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Battery className="h-5 w-5 text-orange-500" />
                      Schedule Fatigue Analysis
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-black/20 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-2 w-2 bg-yellow-500 rounded-full" />
                          <p className="text-xs text-muted-foreground">Back-to-Backs</p>
                        </div>
                        <p className="text-2xl font-bold text-yellow-500">
                          {scraperData.scheduleStats.backToBackGames}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          -0.5 to -1.5 pts
                        </p>
                      </div>

                      <div className="bg-black/20 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-2 w-2 bg-orange-500 rounded-full" />
                          <p className="text-xs text-muted-foreground">3 in 4 Nights</p>
                        </div>
                        <p className="text-2xl font-bold text-orange-500">
                          {scraperData.scheduleStats.threeInFourGames}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          -2.0 pts penalty
                        </p>
                      </div>

                      <div className="bg-black/20 p-4 rounded-lg border border-red-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <p className="text-xs text-muted-foreground">Death Schedule</p>
                        </div>
                        <p className="text-2xl font-bold text-red-500">
                          {scraperData.scheduleStats.deathScheduleGames}
                        </p>
                        <p className="text-xs text-red-400 mt-1 font-semibold">
                          -4.0 pts penalty!
                        </p>
                      </div>

                      <div className="bg-black/20 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-blue-500" />
                          <p className="text-xs text-muted-foreground">Avg Days Rest</p>
                        </div>
                        <p className="text-2xl font-bold text-blue-500">
                          {scraperData.scheduleStats.avgDaysRest.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {scraperData.scheduleStats.avgDaysRest >= 2 ? 'Well-rested' : 'Fatigued'}
                        </p>
                      </div>
                    </div>

                    {scraperData.scheduleStats.deathScheduleGames > 0 && (
                      <div className="mt-4 bg-red-950/30 border border-red-500/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          <p className="font-semibold text-red-400">Death Schedule Alert!</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          This team has played <span className="text-red-400 font-bold">{scraperData.scheduleStats.deathScheduleGames}</span> games 
                          on brutal "4 in 5 nights" schedules. These are prime fade opportunities with -4.0 point penalties.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Recent Games with Fatigue Badges */}
                <div className="bg-slate-900 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">🏀 Recent Games (Last 10)</h3>
                  <div className="space-y-2">
                    {scraperData.games.slice(-10).reverse().map((game: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg flex justify-between items-center ${
                          game.result === 'W' ? 'bg-green-900/20' : 'bg-red-900/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-bold text-lg ${
                            game.result === 'W' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {game.result}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {game.isHome ? 'vs' : '@'}
                          </span>
                          <span className="font-semibold">{game.opponent}</span>
                          {getFatigueBadge(game)}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm">
                            {game.teamScore}-{game.opponentScore}
                          </span>
                          <span className={`font-bold ${
                            game.margin > 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {game.margin > 0 ? '+' : ''}{game.margin}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
