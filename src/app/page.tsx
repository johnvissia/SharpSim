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
import { useFirestore, useUser } from '@/firebase';
import { fetchAndSaveDailyData } from '@/lib/api';
import { getSports } from '@/lib/mock-data';
import type { Sport } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';
import { sportKeyMapping } from '@/lib/sports';


export default function DashboardPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState('All');
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const sportsData = await getSports();
      setSports(sportsData);

      // Initial data fetch for all sports on page load, but only if user is logged in.
      if (firestore && user) {
        await handleFetchData('upcoming');
      }
      setLoading(false);
    };

    // Only run this logic once the initial user authentication check is complete.
    if (!isUserLoading) {
      fetchInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, user, isUserLoading]); // Re-run if firestore instance or user becomes available

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
        if (error.message?.includes('API Key for The Odds API is missing')) {
            toast({
                variant: 'destructive',
                title: 'API Key Missing',
                description: 'Please add your Odds API key to the .env file and restart the server.',
            });
        } else {
            toast({ variant: 'destructive', title: 'Sync Failed', description: error.message || 'Could not fetch data from The Odds API.' });
        }
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
            <Button onClick={() => handleFetchData(selectedSport)} disabled={isFetching || !firestore || !user}>
                <Download className="mr-2 h-4 w-4" />
                {isFetching ? 'Syncing...' : 'Sync Data'}
            </Button>
        </div>
      </header>

      <GameFeed selectedSport={selectedSport} />
    </div>
  );
}
