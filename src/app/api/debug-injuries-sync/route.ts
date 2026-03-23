import { NextResponse } from 'next/server';
import { updateAllTeamInjuries } from '@/lib/services/nba-injuries';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const count = await updateAllTeamInjuries();
        return NextResponse.json({ success: true, count });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
