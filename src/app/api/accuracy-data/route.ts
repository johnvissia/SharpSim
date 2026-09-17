import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sportParam = searchParams.get('sport');

        const limitParam = parseInt(searchParams.get('limit') || '500', 10);

        const snapshot = await db
            .collection('model_predictions')
            .orderBy('startTime', 'desc')
            .limit(limitParam)
            .get();

        let predictions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (sportParam && sportParam !== 'ALL') {
            predictions = predictions.filter((p: any) => p.sport?.toUpperCase() === sportParam.toUpperCase());
        }

        return NextResponse.json({ predictions });
    } catch (error: any) {
        console.error('[accuracy-data] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
