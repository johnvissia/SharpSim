import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const doc = await db.collection('nba_team_stats').doc('SAC').get();
        return NextResponse.json(doc.data()?.injuries || { message: "No injuries found" });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
