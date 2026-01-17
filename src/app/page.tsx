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
import { getSports } from '@/lib/mock-data';
import type { Sport } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSports = async () => {
      const sportsData = await getSports();
      setSports(sportsData);
      setLoading(false);
    };
    fetchSports();
  }, []);

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
      </header>

      <GameFeed selectedSport={selectedSport} />
    </div>
  );
}
