import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const snapshot = await db
            .collection('model_predictions')
            .orderBy('startTime', 'desc')
            .limit(200)
            .get();

        const predictions = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter((p: any) => p.sport === 'NBA')
            .slice(0, 50);

        return NextResponse.json({ predictions });
    } catch (error: any) {
        console.error('[accuracy-data] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
