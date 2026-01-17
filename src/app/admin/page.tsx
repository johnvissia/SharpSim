'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { TeamRanking } from '@/lib/types';
import { Shield, UploadCloud } from 'lucide-react';

const placeholderJson = JSON.stringify(
  [
    { "teamName": "Georgia Bulldogs", "rank": 1 },
    { "teamName": "Michigan Wolverines", "rank": 2 },
    { "teamName": "Ohio State Buckeyes", "rank": 3 },
  ],
  null,
  2
);

export default function AdminPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState(placeholderJson);
  const [loading, setLoading] = useState(false);

  const handleUpdateRankings = async () => {
    setLoading(true);
    let rankings: TeamRanking[];

    try {
      rankings = JSON.parse(jsonInput);
      if (!Array.isArray(rankings) || rankings.some(r => typeof r.teamName !== 'string' || typeof r.rank !== 'number')) {
        throw new Error('Invalid JSON format. Must be an array of {teamName: string, rank: number}.');
      }
    } catch (error: any) {
      toast({
        title: 'Invalid JSON',
        description: error.message || 'Please check the format of your JSON input.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    try {
      const batch = writeBatch(firestore);
      const rankingsRef = collection(firestore, 'rankings');
      
      rankings.forEach(ranking => {
        const docRef = doc(rankingsRef, ranking.teamName);
        batch.set(docRef, { teamName: ranking.teamName, rank: ranking.rank });
      });

      await batch.commit();

      toast({
        title: 'Rankings Updated!',
        description: `${rankings.length} teams have been updated in the database.`,
      });
    } catch (error: any) {
      console.error('Failed to update rankings:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not write rankings to Firestore. Check console for errors.',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage system-wide application data.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Update Team Rankings</CardTitle>
          <CardDescription>
            Paste a JSON array of ranked teams to update the Top 25. The document ID in Firestore will be the team's full name.
            This will overwrite any existing rankings for the teams provided.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={15}
            placeholder='[{"teamName": "Team A", "rank": 1}, ...]'
            className="font-mono text-sm"
          />
          <Button onClick={handleUpdateRankings} disabled={loading} size="lg">
            <UploadCloud className="mr-2 h-5 w-5" />
            {loading ? 'Updating...' : 'Update Rankings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
