import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const athleteId = searchParams.get('athleteId');
    const sport = (searchParams.get('sport') || 'NBA').toUpperCase();

    if (!athleteId) {
      return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
    }

    const sportPath = sport === 'NBA' 
      ? 'basketball/nba' 
      : sport === 'NFL' 
        ? 'football/nfl' 
        : sport === 'MLB' 
          ? 'baseball/mlb' 
          : 'basketball/nba';

    const url = `https://site.web.api.espn.com/apis/common/v3/sports/${sportPath}/athletes/${athleteId}/gamelog`;
    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return NextResponse.json({ success: false, games: [], message: 'No gamelog data found' }, { status: 200 });
    }

    const data = await res.json();
    const statNames: string[] = data.names || [];
    const ptsIdx = statNames.indexOf('points');
    const rebIdx = statNames.indexOf('totalRebounds');
    const astIdx = statNames.indexOf('assists');
    const stlIdx = statNames.indexOf('steals');
    const blkIdx = statNames.indexOf('blocks');
    const toIdx = statNames.indexOf('turnovers');
    const threesIdx = statNames.findIndex(n => n.includes('threePointFieldGoalsMade'));

    // Return up to 10 most recent games so frontend can toggle 5 vs 10 games
    const recent = data.seasonTypes?.[0]?.categories?.[0]?.events?.slice(0, 10) || [];
    
    const games = recent.map((e: any) => {
      const ev = data.events?.[e.eventId] || {};
      const opp = ev.opponent?.abbreviation || 'OPP';
      const date = ev.gameDate 
        ? new Date(ev.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
        : '';
      const stats = e.stats || [];

      const points = Number(stats[ptsIdx]) || 0;
      const rebounds = Number(stats[rebIdx]) || 0;
      const assists = Number(stats[astIdx]) || 0;
      const steals = Number(stats[stlIdx]) || 0;
      const blocks = Number(stats[blkIdx]) || 0;
      const turnovers = Number(stats[toIdx]) || 0;
      const threes = Number(stats[threesIdx]?.split('-')?.[0]) || 0;

      return {
        date,
        opponent: (ev.atVs === 'vs' ? 'vs ' : '@ ') + opp,
        result: ev.gameResult || '',
        score: ev.score || '',
        points,
        rebounds,
        assists,
        threes,
        steals,
        blocks,
        turnovers,
        points_rebounds_assists: points + rebounds + assists,
        points_rebounds: points + rebounds,
        points_assists: points + assists,
        rebounds_assists: rebounds + assists,
        steals_blocks: steals + blocks
      };
    });

    return NextResponse.json({
      success: true,
      athleteId,
      games: games.reverse() // Chronological order (oldest to newest) for a natural left-to-right bar chart
    });
  } catch (error: any) {
    console.error('Error fetching athlete gamelog:', error);
    return NextResponse.json({ success: false, games: [], error: error.message }, { status: 200 });
  }
}
