'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BetTicket } from '@/components/bets/bet-ticket';
import type { UserBet, SportName } from '@/lib/types';
import { ArrowLeft, Users } from 'lucide-react';

// Function to extract team name from a pick string
function getTeamFromPick(pick: string, betType: UserBet['betType']): string | null {
    if (betType === 'total') return null;
    if (betType === 'moneyline') return pick;
    if (betType === 'spread') {
        const lastSpaceIndex = pick.lastIndexOf(' ');
        if (lastSpaceIndex === -1) return pick; // Should not happen
        return pick.substring(0, lastSpaceIndex).trim();
    }
    return null;
}

export default function SportStatsPage() {
    const params = useParams();
    const sportName = decodeURIComponent(params.sport as string) as SportName;
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const betsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'bets');
    }, [user, firestore]);

    const { data: allBets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);
    const loading = isUserLoading || isLoadingBets;

    const sportBets = useMemo(() => {
        if (!allBets) return [];
        // Include straight bets for the sport, and parlays that have at least one leg for the sport.
        return allBets.filter(bet => {
            if (bet.betType !== 'parlay') {
                return bet.sport === sportName;
            }
            if (bet.betType === 'parlay' && bet.legs) {
                return bet.legs.some(leg => leg.sport === sportName);
            }
            return false;
        });
    }, [allBets, sportName]);

    const sportRecord = useMemo(() => {
        let wins = 0;
        let losses = 0;
        let pushes = 0;

        for (const bet of sportBets) {
            if (bet.betType === 'parlay' && bet.legs) {
                for (const leg of bet.legs) {
                    if (leg.sport === sportName) {
                        if (leg.status === 'won') wins++;
                        if (leg.status === 'lost') losses++;
                        if (leg.status === 'push') pushes++;
                    }
                }
            } else { // Straight bet
                if (bet.status === 'won') wins++;
                if (bet.status === 'lost') losses++;
                if (bet.status === 'push') pushes++;
            }
        }
        const total = wins + losses;
        const winPct = total > 0 ? (wins / total) * 100 : 0;
        return { wins, losses, pushes, winPct: winPct.toFixed(1) };
    }, [sportBets, sportName]);


    const mostBetOnTeams = useMemo(() => {
        const teamCounts: Record<string, number> = {};

        for (const bet of sportBets) {
            if (bet.betType === 'parlay' && bet.legs) {
                for (const leg of bet.legs) {
                    // Only count legs that match the current sport page
                    if (leg.sport === sportName) {
                        const team = getTeamFromPick(leg.pick, leg.betType);
                        if (team) {
                            teamCounts[team] = (teamCounts[team] || 0) + 1;
                        }
                    }
                }
            } else { // Straight bet
                 const team = getTeamFromPick(bet.pick, bet.betType);
                 if (team) {
                    teamCounts[team] = (teamCounts[team] || 0) + 1;
                 }
            }
        }
        
        return Object.entries(teamCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

    }, [sportBets, sportName]);

    if (loading) {
        return (
            <div className="p-4 md:p-8">
                 <Skeleton className="h-10 w-64 mb-8" />
                 <Skeleton className="h-32 w-full mb-8" />
                 <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                 </div>
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8">
            <header className="mb-8 space-y-4">
                <Button asChild variant="outline" size="sm" className="w-fit">
                    <Link href="/stats">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Stats
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    {sportName} Betting Stats ({sportRecord.wins}-{sportRecord.losses})
                </h1>
            </header>

            <div className="grid gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <Users className="h-5 w-5 text-primary" /> Most Bet On Teams
                        </CardTitle>
                        <CardDescription>Your favorite teams to wager on in {sportName}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {mostBetOnTeams.length > 0 ? (
                            <ul className="space-y-2">
                                {mostBetOnTeams.map(([team, count], index) => (
                                    <li key={team} className="flex items-center justify-between text-sm">
                                        <span className="font-semibold">{index + 1}. {team}</span>
                                        <span className="text-muted-foreground">{count} {count > 1 ? 'bets' : 'bet'}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground text-center">No team betting data available for this sport yet.</p>
                        )}
                    </CardContent>
                </Card>

                <div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-4">
                        Bet History for {sportName}
                    </h2>
                     <div className="space-y-6">
                        {sportBets.length > 0 ? (
                             sportBets
                                .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
                                .map(bet => <BetTicket key={bet.id} bet={bet} />)
                        ) : (
                             <Card>
                                <CardContent className="p-6 text-center text-muted-foreground">
                                    You haven't placed any bets on {sportName} yet.
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
