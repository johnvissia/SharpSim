'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TeamTrendsView } from '@/components/dashboard/TeamTrendsView';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function TeamStatsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { user } = useUser();
    const firestore = useFirestore();
    const [isUpdating, setIsUpdating] = useState(false);

    // Decode URI-encoded parameters
    const sportName = params.sport ? decodeURIComponent(params.sport as string) : '';
    const teamName = params.team ? decodeURIComponent(params.team as string) : '';
    const teamId = searchParams.get('teamId');

    const userProfileRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const favoriteTeams = userProfile?.favoriteTeams || [];
    const isFavorite = favoriteTeams.includes(teamName);

    const handleToggleFavorite = async () => {
        if (!userProfileRef) return;
        setIsUpdating(true);
        try {
            await updateDoc(userProfileRef, {
                favoriteTeams: isFavorite ? arrayRemove(teamName) : arrayUnion(teamName)
            });
        } catch (error) {
            console.error("Failed to update favorites", error);
        } finally {
            setIsUpdating(false);
        }
    };


    if (!teamId || !sportName || !teamName) {
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl font-bold tracking-tight text-destructive">Error</h1>
                <p className="text-muted-foreground">Team information is missing or invalid.</p>
                 <Button asChild variant="outline" size="sm" className="w-fit mt-4">
                    <Link href="/stats">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Stats
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <header className="mb-8 space-y-4">
                <Button asChild variant="outline" size="sm" className="w-fit">
                     <Link href={`/stats/${sportName}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to {sportName} Stats
                    </Link>
                </Button>
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        {teamName}
                    </h1>
                     <Button variant="ghost" size="icon" onClick={handleToggleFavorite} disabled={isUpdating}>
                        <Heart className={cn(
                            "h-7 w-7 transition-all", 
                            isFavorite ? 'text-red-500 fill-red-500' : 'text-muted-foreground hover:text-red-400'
                        )} />
                    </Button>
                </div>
            </header>
            <div>
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Last 10 Games Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <TeamTrendsView teamId={teamId} teamName={teamName} sport={sportName} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
