'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NBA_TEAMS = [
  'Atlanta Hawks',
  'Boston Celtics',
  'Brooklyn Nets',
  'Charlotte Hornets',
  'Chicago Bulls',
  'Cleveland Cavaliers',
  'Dallas Mavericks',
  'Denver Nuggets',
  'Detroit Pistons',
  'Golden State Warriors',
  'Houston Rockets',
  'Indiana Pacers',
  'LA Clippers',
  'Los Angeles Lakers',
  'Memphis Grizzlies',
  'Miami Heat',
  'Milwaukee Bucks',
  'Minnesota Timberwolves',
  'New Orleans Pelicans',
  'New York Knicks',
  'Oklahoma City Thunder',
  'Orlando Magic',
  'Philadelphia 76ers',
  'Phoenix Suns',
  'Portland Trail Blazers',
  'Sacramento Kings',
  'San Antonio Spurs',
  'Toronto Raptors',
  'Utah Jazz',
  'Washington Wizards',
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

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setScraperData(null);
    setSyncAllResults(null);
    setRatingsResults(null);

    try {
      toast({
        title: 'Starting Sync',
        description: 'Scraping all 30 NBA teams... This will take ~1 minute.',
      });

      const response = await fetch('/api/sync-all-nba-teams', {
        method: 'POST',
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync teams');
      }

      setSyncAllResults(data);
      toast({
        title: 'Sync Complete!',
        description: `Successfully synced ${data.successCount} of ${data.totalTeams} teams`,
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
        description: `SRS converged after ${data.iterations} iterations`,
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

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <LineChart className="h-8 w-8 text-primary" />
          Data Hub
        </h1>
        <p className="text-muted-foreground">
          Analyze scraped data to build your betting edge.
        </p>
      </header>

      <div className="grid gap-8">
        {/* Sync All Teams Section */}
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>🏀 Sync All NBA Teams</CardTitle>
            <CardDescription>
              Scrape game data for all 30 NBA teams at once. Takes ~60 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleSyncAll} 
              disabled={syncingAll || loading} 
              size="lg"
              className="w-full"
            >
              {syncingAll ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Syncing All Teams... ({syncAllResults?.successCount || 0}/30)
                </>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" />
                  Sync All 30 Teams
                </>
              )}
            </Button>

            {/* Sync Results */}
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
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">Failed teams:</p>
                      <p className="text-sm text-red-400">{syncAllResults.failedTeams.join(', ')}</p>
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
            <CardTitle>⚡ Calculate Power Ratings (SRS)</CardTitle>
            <CardDescription>
              Run Phase 1 & 2: Net Rating normalization and recursive SRS algorithm
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  Calculating SRS...
                </>
              ) : (
                <>
                  ⚡ Calculate Power Ratings
                </>
              )}
            </Button>

            {/* Ratings Results */}
            {ratingsResults && (
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">📊 SRS Calculation Results</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Teams Processed</p>
                      <p className="text-2xl font-bold">{ratingsResults.message?.match(/\d+/)?.[0]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Iterations</p>
                      <p className="text-2xl font-bold text-blue-500">{ratingsResults.iterations}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Convergence</p>
                      <p className="text-2xl font-bold text-green-500">{ratingsResults.convergence?.toFixed(4)}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Top Teams */}
                    <div>
                      <h4 className="font-bold text-green-500 mb-2">🏆 Top 5 Teams</h4>
                      <div className="space-y-2">
                        {ratingsResults.topTeams?.map((team: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-green-900/20 p-2 rounded">
                            <span className="text-sm">{idx + 1}. {team.team}</span>
                            <span className="font-bold text-green-400">+{team.srsRating}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Teams */}
                    <div>
                      <h4 className="font-bold text-red-500 mb-2">📉 Bottom 5 Teams</h4>
                      <div className="space-y-2">
                        {ratingsResults.bottomTeams?.map((team: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-red-900/20 p-2 rounded">
                            <span className="text-sm">{team.team}</span>
                            <span className="font-bold text-red-400">{team.srsRating}</span>
                          </div>
                        ))}
                      </div>
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
            <CardTitle>Basketball Reference Scraper</CardTitle>
            <CardDescription>
              Test the scraper to fetch game-by-game data and calculate advanced metrics
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

            {/* Display Results */}
            {scraperData && (
              <div className="mt-6 space-y-6">
                {/* Summary Stats */}
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
                      <p className="text-xs text-muted-foreground">Avg Adjusted Margin</p>
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
                    <div>
                      <p className="text-xs text-muted-foreground">Home/Away Delta</p>
                      <p className="text-2xl font-bold">
                        {scraperData.summary.homeAwayDelta > 0 ? '+' : ''}
                        {scraperData.summary.homeAwayDelta.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rolling MOV (L10)</p>
                      <p className="text-2xl font-bold text-blue-500">
                        {scraperData.summary.rollingMOV > 0 ? '+' : ''}
                        {scraperData.summary.rollingMOV.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Games */}
                <div className="bg-slate-900 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">🏀 Recent Games (Last 10)</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
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
                          <span className="text-xs text-muted-foreground">
                            Adj: {game.adjustedMargin > 0 ? '+' : ''}{game.adjustedMargin.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw JSON (for debugging) */}
                <details className="bg-slate-900 rounded-lg p-6">
                  <summary className="cursor-pointer font-bold mb-2">
                    🔍 View Raw JSON Data
                  </summary>
                  <pre className="text-xs bg-slate-950 p-4 rounded overflow-x-auto mt-4">
                    {JSON.stringify(scraperData, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coming Soon Section */}
        <Card>
          <CardHeader>
            <CardTitle>Power Ratings Calculator</CardTitle>
            <CardDescription>
              Coming next: Calculate team power ratings using the formulas and predict game spreads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Once we verify the scraper works, we'll build the power ratings system and integrate it into game predictions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}