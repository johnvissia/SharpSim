import { NextResponse } from 'next/server';
import { updateAllTeamInjuries } from '@/lib/services/nba-injuries';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes for processing 30 teams

export async function POST() {
    try {
        const count = await updateAllTeamInjuries();
        return NextResponse.json({ success: true, message: `Updated injuries for ${count} teams` });
    } catch (error) {
        console.error('Error updating injuries:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
