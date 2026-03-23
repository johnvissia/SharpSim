import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const snapshot = await db
            .collection('model_predictions')
            .orderBy('startTime', 'desc')
            .limit(50)
            .get();

        const predictions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ predictions });
    } catch (error: any) {
        console.error('[accuracy-data] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
