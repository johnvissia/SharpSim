import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { DailyGame } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const sport = request.nextUrl.searchParams.get('sport') || 'NBA';

        // 1. Fetch Daily Games from Firestore
        const dailySnapshot = await db.collection('daily_games').get();
        const dailyGames = dailySnapshot.docs.map(d => d.data() as DailyGame);

        // 2. Fetch Model Predictions (Historical/Locked)
        const predictionsSnapshot = await db.collection('model_predictions').get();
        const predictions = predictionsSnapshot.docs.map(d => d.data());

        return NextResponse.json({
            dailyGames,
            predictions
        });
    } catch (error: any) {
        console.error('Error fetching model data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
