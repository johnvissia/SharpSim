import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getRestCollectionDocs } from '@/lib/firestore-rest';
import { DailyGame } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        let dailyGames: any[] = [];
        let predictions: any[] = [];

        try {
            if (db) {
                const dailySnapshot = await db.collection('daily_games').get();
                dailyGames = dailySnapshot.docs.map(d => d.data() as DailyGame);

                const predictionsSnapshot = await db.collection('model_predictions').get();
                predictions = predictionsSnapshot.docs.map(d => d.data());
            } else {
                throw new Error('Admin db not initialized');
            }
        } catch (dbErr) {
            // Admin SDK unavailable or unauthenticated on local dev, use resilient REST API fallback
            console.warn('[model-data] Falling back to Firestore REST API');
            const [dg, pred] = await Promise.all([
                getRestCollectionDocs<DailyGame>('daily_games', 300).catch(() => []),
                getRestCollectionDocs('model_predictions', 300).catch(() => [])
            ]);
            dailyGames = dg;
            predictions = pred;
        }

        return NextResponse.json({
            dailyGames,
            predictions
        });
    } catch (error: any) {
        console.error('Error fetching model data:', error);
        return NextResponse.json({ dailyGames: [], predictions: [], error: error.message }, { status: 200 });
    }
}
