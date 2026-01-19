'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { TeamRanking } from '@/lib/types';
import { Shield, UploadCloud, ShieldCheck } from 'lucide-react';

const placeholderJson = JSON.stringify(
  [
    { "teamName": "Georgia Bulldogs", "rank": 1 },
    { "teamName": "Michigan Wolverines", "rank": 2 },
    { "teamName": "Ohio State Buckeyes", "rank": 3 },
  ],
  null,
  2
);

const customRankings = [
    { "team": "Arizona Wildcats", "rank": 1, "conference": "Big 12" },
    { "team": "Iowa State Cyclones", "rank": 2, "conference": "Big 12" },
    { "team": "UConn Huskies", "rank": 3, "conference": "Big East" },
    { "team": "Michigan Wolverines", "rank": 4, "conference": "Big 10" },
    { "team": "Purdue Boilermakers", "rank": 5, "conference": "Big 10" },
    { "team": "Duke Blue Devils", "rank": 6, "conference": "ACC" },
    { "team": "Houston Cougars", "rank": 7, "conference": "Big 12" },
    { "team": "Nebraska Cornhuskers", "rank": 8, "conference": "Big 10" },
    { "team": "Gonzaga Bulldogs", "rank": 9, "conference": "WCC" },
    { "team": "Vanderbilt Commodores", "rank": 10, "conference": "SEC" },
    { "team": "BYU Cougars", "rank": 11, "conference": "Big 12" },
    { "team": "Michigan State Spartans", "rank": 12, "conference": "Big 10" },
    { "team": "Illinois Fighting Illini", "rank": 13, "conference": "Big 10" },
    { "team": "North Carolina Tar Heels", "rank": 14, "conference": "ACC" },
    { "team": "Texas Tech Red Raiders", "rank": 15, "conference": "Big 12" },
    { "team": "Virginia Cavaliers", "rank": 16, "conference": "ACC" },
    { "team": "Arkansas Razorbacks", "rank": 17, "conference": "SEC" },
    { "team": "Alabama Crimson Tide", "rank": 18, "conference": "SEC" },
    { "team": "Florida Gators", "rank": 19, "conference": "SEC" },
    { "team": "Louisville Cardinals", "rank": 20, "conference": "ACC" },
    { "team": "Georgia Bulldogs", "rank": 21, "conference": "SEC" },
    { "team": "Clemson Tigers", "rank": 22, "conference": "ACC" },
    { "team": "Utah State Aggies", "rank": 23, "conference": "MWC" },
    { "team": "Tennessee Volunteers", "rank": 24, "conference": "SEC" },
    { "team": "Seton Hall Pirates", "rank": 25, "conference": "Big East" }
];

export default function AdminPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState(placeholderJson);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleUpdateRankings = async () => {
    if (!firestore) return;
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
        batch.set(docRef, { teamName: ranking.teamName, rank: ranking.rank, conference: 'N/A' }); // Add default conference
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
  
  const handleSeedRankings = async () => {
    if (!firestore) return;
    setSeeding(true);
    try {
        const batch = writeBatch(firestore);
        const rankingsRef = collection(firestore, 'rankings');

        customRankings.forEach(ranking => {
            const docRef = doc(rankingsRef, ranking.team);
            batch.set(docRef, { teamName: ranking.team, rank: ranking.rank, conference: ranking.conference });
        });

        await batch.commit();

        toast({
            title: 'Custom Rankings Seeded!',
            description: `${customRankings.length} teams have been seeded into the database.`,
        });
    } catch (error: any) {
        console.error('Failed to seed rankings:', error);
        toast({
            title: 'Seeding Failed',
            description: 'Could not write custom rankings to Firestore. Check console for errors.',
            variant: 'destructive',
        });
    }
    setSeeding(false);
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

    <div className="grid gap-8">
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

        <Card>
            <CardHeader>
                <CardTitle>Seed Custom "Top 25" Rankings</CardTitle>
                <CardDescription>
                    This is a temporary button to seed the specific Top 25 list for the current simulation.
                    This will overwrite any teams with matching names.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleSeedRankings} disabled={seeding} size="lg" variant="secondary">
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    {seeding ? 'Seeding...' : 'Seed Custom Rankings'}
                </Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
