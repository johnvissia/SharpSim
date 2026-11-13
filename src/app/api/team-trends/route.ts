import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getEspnSportPath(sport?: string) {
  const s = (sport || '').toUpperCase().trim();
  switch (s) {
    case 'NBA': return 'basketball/nba';
    case 'NCAAM': return 'basketball/mens-college-basketball';
    case 'MLB': return 'baseball/mlb';
    case 'NFL': return 'football/nfl';
    case 'NHL': return 'hockey/nhl';
    case 'EPL': return 'soccer/eng.1';
    case 'MLS': return 'soccer/usa.1';
    default: return 'basketball/nba';
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let teamId = searchParams.get('teamId') || '';
    const teamName = searchParams.get('teamName') || '';
    const sport = (searchParams.get('sport') || 'NBA').toUpperCase();
    const sportPath = getEspnSportPath(sport);

    // If teamId is missing, resolve from ESPN teams list by teamName
    if (!teamId && teamName) {
      try {
        const teamsRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams`);
        if (teamsRes.ok) {
          const data = await teamsRes.json();
          const teams = data.sports?.[0]?.leagues?.[0]?.teams || [];
          const matched = teams.find((t: any) => {
            const name = (t.team?.displayName || '').toLowerCase();
            const q = teamName.toLowerCase();
            return name.includes(q) || q.includes(name) || (name.split(' ').pop() === q.split(' ').pop());
          });
          if (matched) {
            teamId = matched.team?.id;
          }
        }
      } catch (e) {
        console.warn('Failed to resolve team by name:', e);
      }
    }

    if (!teamId) {
      return NextResponse.json({ error: 'teamId or teamName required' }, { status: 400 });
    }

    // Fetch team schedule
    const schedUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${teamId}/schedule`;
    const schedRes = await fetch(schedUrl, { next: { revalidate: 1800 } });

    if (!schedRes.ok) {
      return NextResponse.json({ success: false, games: [], message: 'Could not load schedule' }, { status: 200 });
    }

    const schedData = await schedRes.json();
    const allEvents = schedData.events || [];
    
    // Filter completed games and take the last 10
    const completedEvents = allEvents.filter((e: any) => e.competitions?.[0]?.status?.type?.completed);
    const recentEvents = completedEvents.slice(-10);

    // Fetch pre-game closing odds from ESPN pickcenter for each game in parallel
    const games = await Promise.all(
      recentEvents.map(async (event: any) => {
        const comp = event.competitions?.[0];
        const teamComp = comp?.competitors?.find((c: any) => c.id === teamId || (c.team?.id === teamId));
        const oppComp = comp?.competitors?.find((c: any) => c.id !== teamId && (c.team?.id !== teamId));

        const isHome = teamComp?.homeAway === 'home';
        const teamScore = Number(teamComp?.score?.value || 0);
        const oppScore = Number(oppComp?.score?.value || 0);
        const actualMargin = teamScore - oppScore;
        const isWin = actualMargin > 0;

        const dateStr = event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const oppAbbr = oppComp?.team?.abbreviation || oppComp?.team?.displayName || 'OPP';
        const oppName = oppComp?.team?.displayName || oppAbbr;
        const oppLogo = oppComp?.team?.logos?.[0]?.href || oppComp?.team?.logo || '';

        let spread = 0;
        let spreadDetails = '';
        let hasSpread = false;

        try {
          const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${event.id}`, { next: { revalidate: 86400 } });
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            const pickcenter = sumData.pickcenter?.[0];
            if (pickcenter) {
              hasSpread = true;
              spreadDetails = pickcenter.details || '';
              const homeOdds = pickcenter.homeTeamOdds;
              const isFavorite = isHome ? homeOdds?.favorite : !homeOdds?.favorite;
              const rawSpread = Math.abs(Number(pickcenter.spread) || 0);
              spread = isFavorite ? -rawSpread : rawSpread;
            }
          }
        } catch (sumErr) {
          // silently ignore individual game odds fetch failures
        }

        const coverMargin = hasSpread ? actualMargin + spread : 0;
        const isCovered = hasSpread ? coverMargin > 0 : false;
        const isPush = hasSpread ? coverMargin === 0 : false;

        return {
          id: event.id,
          date: dateStr,
          rawDate: event.date,
          opponent: (isHome ? 'vs ' : '@ ') + oppAbbr,
          opponentFullName: oppName,
          opponentLogo: oppLogo,
          isHome,
          teamScore,
          oppScore,
          scoreString: `${teamScore}-${oppScore}`,
          result: isWin ? 'W' : 'L',
          actualMargin,
          hasSpread,
          spread,
          spreadDetails,
          coverMargin: Number(coverMargin.toFixed(1)),
          atsResult: !hasSpread ? 'N/A' : isPush ? 'PUSH' : isCovered ? 'COVER' : 'NO COVER',
          isCovered,
          isPush
        };
      })
    );

    return NextResponse.json({
      success: true,
      teamId,
      teamName: schedData.team?.displayName || teamName,
      games // chronological order
    });
  } catch (error: any) {
    console.error('Error fetching team trends:', error);
    return NextResponse.json({ success: false, games: [], error: error.message }, { status: 500 });
  }
}
