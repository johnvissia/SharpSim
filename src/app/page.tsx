'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { fetchAndSaveDailyData } from '@/lib/api';
import { gradeUserBets } from '@/lib/bet-grading';
import { getSports } from '@/lib/mock-data';
import type { Sport, SystemStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Loader } from 'lucide-react';
import { sportKeyMapping } from '@/lib/sports';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function DashboardPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState('All');
  const [loadingSports, setLoadingSports] = useState(true);
  const [isFetchingManually, setIsFetchingManually] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const systemStatusRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'system', 'status') : null),
    [firestore]
  );
  const { data: systemStatus, isLoading: isStatusLoading } =
    useDoc<SystemStatus>(systemStatusRef);

  // Effect for fetching the static list of available sports for the dropdown
  useEffect(() => {
    const fetchSportsData = async () => {
      setLoadingSports(true);
      const sportsData = await getSports();
      setSports(sportsData);
      setLoadingSports(false);
    };
    fetchSportsData();
  }, []);

  // Effect for the "First Visitor of the Day" automation protocol
  useEffect(() => {
    // Wait for all dependencies to be ready before checking
    if (isStatusLoading || !firestore || !user || !systemStatusRef) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const lastUpdated = systemStatus?.last_updated_date;

    // If data is already updated for today, do nothing.
    if (lastUpdated === today) {
      console.log('Daily data is already up to date for', today);
      return;
    }

    // --- Trigger daily data fetch and bet grading ---
    const runDailySync = async () => {
      console.log(
        'New day detected or first sync. Running daily protocol...'
      );
      setIsAutoSyncing(true);
      toast({
        title: 'Performing Daily Sync...',
        description:
          'Fetching latest odds, scores, and settling yesterdays bets.',
      });

      try {
        // Step 1: Fetch new data
        await fetchAndSaveDailyData(firestore, 'upcoming');
        
        // Step 2: Grade yesterday's bets
        toast({ title: 'Syncing complete. Now grading bets...' });
        await gradeUserBets(firestore, user);

        // Step 3: On complete success, update the status document
        setDocumentNonBlocking(
          systemStatusRef,
          { last_updated_date: today },
          { merge: true }
        );
        toast({
          title: 'Daily Protocol Complete!',
          description: 'Odds are fresh and bets are settled.',
        });
      } catch (error: any) {
        console.error('Failed during automatic daily protocol:', error);
        toast({
          variant: 'destructive',
          title: 'Auto-Sync Failed',
          description:
            error.message ||
            'Could not run daily protocol. It will be retried on next page load.',
        });
      } finally {
        setIsAutoSyncing(false);
      }
    };

    runDailySync();
  }, [systemStatus, isStatusLoading, firestore, user, systemStatusRef, toast]);

  const handleManualFetch = async (sportName: string) => {
    if (!firestore || !user) return;
    setIsFetchingManually(true);
    toast({
      title: 'Syncing Data...',
      description: 'Fetching latest odds and scores.',
    });
    try {
      const sportKey =
        sportName === 'All' || sportName === 'upcoming'
          ? 'upcoming'
          : sportKeyMapping[sportName];
      if (!sportKey) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Sport '${sportName}' is not supported by the API.`,
        });
        setIsFetchingManually(false);
        return;
      }
      await fetchAndSaveDailyData(firestore, sportKey);
      toast({
        title: 'Sync Complete!',
        description: 'Odds and scores have been updated.',
      });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error.message || 'Could not fetch data from The Odds API.',
      });
    }
    setIsFetchingManually(false);
  };

  const showLoadingSpinner = isStatusLoading || isAutoSyncing || isUserLoading;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Today's Games
          </h1>
          <p className="text-muted-foreground">
            {selectedSport === 'All'
              ? 'All upcoming games'
              : `Upcoming ${selectedSport} games`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loadingSports ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <Select
              onValueChange={setSelectedSport}
              defaultValue={selectedSport}
              disabled={showLoadingSpinner}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Select a sport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Sports</SelectItem>
                {sports.map((sport) => (
                  <SelectItem key={sport.id} value={sport.name}>
                    {sport.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={() => handleManualFetch(selectedSport)}
            disabled={
              isFetchingManually || showLoadingSpinner
            }
          >
            {isFetchingManually || isAutoSyncing ? (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isAutoSyncing ? 'Auto-Sync...' : isFetchingManually ? 'Syncing...' : 'Sync Data'}
          </Button>
        </div>
      </header>

      {showLoadingSpinner ? (
        <div className="flex flex-col items-center justify-center gap-4 text-center h-64">
          <Loader className="h-12 w-12 animate-spin text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            {isUserLoading ? 'Authenticating...' : 'Loading Daily Lines...'}
          </h2>
          <p className="text-muted-foreground">
            {isUserLoading 
              ? 'Preparing your session...' 
              : 'This happens once per day to ensure all data is fresh.'}
          </p>
        </div>
      ) : (
        <GameFeed selectedSport={selectedSport} />
      )}
    </div>
  );
}
