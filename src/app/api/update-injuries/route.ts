import { NextRequest, NextResponse } from 'next/server';
import { syncAllInjuriesFromESPN } from '@/lib/services/espn-injuries';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes for processing 30 teams

export async function POST(request: NextRequest) {
    try {
        // Auth check (if CRON_SECRET is configured)
        const authHeader = request.headers.get('Authorization');
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { nbaCount, mlbCount } = await syncAllInjuriesFromESPN();
        return NextResponse.json({ success: true, message: `Updated injuries for ${nbaCount} NBA teams and ${mlbCount} MLB teams` });
    } catch (error) {
        console.error('Error updating injuries:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        // Auth check (if CRON_SECRET is configured)
        const authHeader = request.headers.get('Authorization');
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { nbaCount, mlbCount } = await syncAllInjuriesFromESPN();
        return NextResponse.json({ success: true, message: `Updated injuries for ${nbaCount} NBA teams and ${mlbCount} MLB teams` });
    } catch (error) {
        console.error('Error updating injuries:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
