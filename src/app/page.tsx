'use client';

import { useState, useEffect } from 'react';
import { GameFeed } from '@/components/dashboard/game-feed';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { fetchAndSaveDailyData } from '@/lib/api';
import { getSports } from '@/lib/mock-data';
import type { Sport } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';

// Map sport names from mock data to API keys for The Odds API
const sportKeyMapping: { [key: string]: string } = {
    'NBA': 'basketball_nba',
    'NFL': 'americanfootball_nfl',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'Soccer': 'soccer_epl', // Example, can be other leagues
    'WNBA': 'basketball_wnba',
    'NCAAF': 'americanfootball_ncaaf',
    'NCAAM': 'basketball_ncaab',
    // No direct mapping for NCAAW in Odds API free tier
};


export default function DashboardPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState('All');
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const sportsData = await getSports();
      setSports(sportsData);

      // Initial data fetch for all sports on page load
      if (firestore) {
        handleFetchData('upcoming');
      }

      setLoading(false);
    };
    fetchInitialData();
  }, [firestore]); // Re-run if firestore instance becomes available

  const handleFetchData = async (sportName: string) => {
      setIsFetching(true);
      toast({ title: 'Syncing Data...', description: 'Fetching latest odds and scores.' });
      try {
        const sportKey = sportName === 'All' || sportName === 'upcoming' ? 'upcoming' : sportKeyMapping[sportName];
        if (!sportKey) {
            toast({ variant: 'destructive', title: 'Error', description: `Sport '${sportName}' is not supported by the API.` });
            setIsFetching(false);
            return;
        }
        await fetchAndSaveDailyData(firestore, sportKey);
        toast({ title: 'Sync Complete!', description: 'Odds and scores have been updated.' });
      } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Sync Failed', description: error.message || 'Could not fetch data from The Odds API.' });
      }
      setIsFetching(false);
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Today's Games
          </h1>
          <p className="text-muted-foreground">
            {selectedSport === 'All' ? 'All upcoming games' : `Upcoming ${selectedSport} games`}
          </p>
        </div>
        <div className="flex items-center gap-2">
            {loading ? (
                <Skeleton className="h-10 w-48" />
            ) : (
                <Select onValueChange={setSelectedSport} defaultValue={selectedSport}>
                    <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Select a sport" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Sports</SelectItem>
                        {sports.map(sport => (
                            <SelectItem key={sport.id} value={sport.name}>
                                {sport.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <Button onClick={() => handleFetchData(selectedSport)} disabled={isFetching || !firestore}>
                <Download className="mr-2 h-4 w-4" />
                {isFetching ? 'Syncing...' : 'Sync Data'}
            </Button>
        </div>
      </header>

      <GameFeed selectedSport={selectedSport} />
    </div>
  );
}
