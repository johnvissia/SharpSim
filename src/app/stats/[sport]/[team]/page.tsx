'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TeamTrendsView } from '@/components/dashboard/TeamTrendsView';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TeamStatsPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    // Decode URI-encoded parameters
    const sportName = params.sport ? decodeURIComponent(params.sport as string) : '';
    const teamName = params.team ? decodeURIComponent(params.team as string) : '';
    const teamId = searchParams.get('teamId');

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
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    {teamName}
                </h1>
            </header>
            <div className="max-w-4xl">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Last 10 Games Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <TeamTrendsView teamId={teamId} teamName={teamName} sport={sportName} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
