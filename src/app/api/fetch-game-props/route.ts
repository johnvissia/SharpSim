// src/app/api/fetch-game-props/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { resilientGetCollection, batchSetRestDocs } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let eventId = searchParams.get('eventId') || '';
    const sport = (searchParams.get('sport') || 'NBA').toUpperCase();
    const homeTeam = (searchParams.get('homeTeam') || '').toLowerCase();
    const awayTeam = (searchParams.get('awayTeam') || '').toLowerCase();
    const forceRefresh = searchParams.get('force') === 'true';

    // NHL player props are TBD (Coming Soon)
    if (sport === 'NHL') {
      return NextResponse.json({
        success: true,
        tbd: true,
        props: [],
        message: 'NHL player props and projections are TBD and coming soon.'
      });
    }

    // 1. FAST CACHE CHECK: Query Firestore pre-synced props first (0 Odds API cost)
    if (!forceRefresh) {
      try {
        const cachedProps = await resilientGetCollection<any>('player_props');
        const matched = cachedProps.filter(p => {
          if (eventId && p.gameId === eventId) return true;
          if (p.matchup && (homeTeam || awayTeam)) {
            const m = (p.matchup || '').toLowerCase();
            const homePart = homeTeam ? homeTeam.split(' ').pop() : '';
            const awayPart = awayTeam ? awayTeam.split(' ').pop() : '';
            return (homePart && m.includes(homePart)) || (awayPart && m.includes(awayPart));
          }
          return false;
        });

        if (matched.length > 0) {
          console.log(`⚡ Serving ${matched.length} player props directly from Firestore cache (0 API quota used)`);
          return NextResponse.json({
            success: true,
            props: matched,
            count: matched.length,
            source: 'cache'
          });
        }
      } catch (cacheErr: any) {
        console.warn('Firestore player_props cache check skipped:', cacheErr.message);
      }
    }
    
    const API_KEY = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: 'Missing Odds API Key' }, { status: 500 });
    }

    const sportKey = sport === 'NBA' ? 'basketball_nba' : sport === 'MLB' ? 'baseball_mlb' : 'americanfootball_nfl';

    // If eventId is missing, empty, or numeric (e.g. ESPN ID 401909977), resolve to Odds API event ID
    if (!eventId || /^\d+$/.test(eventId)) {
      if (homeTeam || awayTeam) {
        try {
          const eventsRes = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${API_KEY}`, { cache: 'no-store' });
          if (eventsRes.ok) {
            const events = await eventsRes.json();
            const matched = events.find((e: any) => {
              const eHome = (e.home_team || '').toLowerCase();
              const eAway = (e.away_team || '').toLowerCase();
              const homeMatch = homeTeam && (eHome.includes(homeTeam) || homeTeam.includes(eHome) || eHome.split(' ').pop() === homeTeam.split(' ').pop());
              const awayMatch = awayTeam && (eAway.includes(awayTeam) || awayTeam.includes(eAway) || eAway.split(' ').pop() === awayTeam.split(' ').pop());
              return homeMatch || awayMatch;
            });
            if (matched) {
              eventId = matched.id;
              console.log(`Matched ESPN/Name query to Odds API event: ${eventId} (${matched.away_team} @ ${matched.home_team})`);
            }
          }
        } catch (matchErr: any) {
          console.warn('Failed to resolve event by team name:', matchErr.message);
        }
      }
    }

    if (!eventId || /^\d+$/.test(eventId)) {
      return NextResponse.json({ 
        success: true, 
        props: [], 
        message: 'Player props are not currently listed or have not been released for this matchup.' 
      });
    }

    console.log(`🎯 Fetching player props from Odds API for event: ${eventId} (${sportKey})`);

    // The Odds API endpoint for player props
    const markets = [
      'player_points',
      'player_rebounds', 
      'player_assists',
      'player_threes',
      'player_blocks',
      'player_steals',
      'player_turnovers',
      'player_points_rebounds_assists',
      'player_points_rebounds',
      'player_points_assists',
      'player_rebounds_assists'
    ].join(',');

    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;

    console.log('📡 Calling Odds API for props...');

    const response = await fetch(url, {
      cache: 'no-store'
    });

    if (response.status === 404) {
      return NextResponse.json({
        success: true,
        props: [],
        message: 'No player props available for this event.'
      });
    }

    if (!response.ok) {
      throw new Error(`Odds API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Check remaining requests in response headers
    const remaining = response.headers.get('x-requests-remaining');
    const used = response.headers.get('x-requests-used');
    console.log(`📊 API Usage: ${used} used, ${remaining} remaining`);

    if (!data.bookmakers || data.bookmakers.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No bookmakers found for this game',
        props: [],
        apiUsage: { used, remaining }
      });
    }

    // Parse player props from bookmakers
    const playerPropsMap = new Map();

    for (const bookmaker of data.bookmakers) {
      if (!bookmaker.markets) continue;

      for (const market of bookmaker.markets) {
        const marketType = market.key;

        for (const outcome of market.outcomes) {
          const playerName = outcome.description;
          const line = outcome.point;
          const price = outcome.price; // American odds

          if (!playerName || line === undefined) continue;

          const propKey = `${playerName}_${marketType}_${line}`;

          if (!playerPropsMap.has(propKey)) {
            playerPropsMap.set(propKey, {
              playerId: playerName.replace(/\s+/g, '_'),
              playerName: playerName,
              market: marketType.replace('player_', ''),
              line: line,
              overOdds: null,
              underOdds: null,
            });
          }

          const prop = playerPropsMap.get(propKey);

          // Determine if this is over or under
          if (outcome.name === 'Over') {
            prop.overOdds = price;
          } else if (outcome.name === 'Under') {
            prop.underOdds = price;
          }
        }
      }
    }

    // Filter to only complete props (have both over and under)
    const props = Array.from(playerPropsMap.values()).filter(
      prop => prop.overOdds !== null && prop.underOdds !== null
    );

    console.log(`✅ Parsed ${props.length} player props`);

    // Cache newly fetched props into Firestore player_props for instant 0-cost retrieval
    if (props.length > 0) {
      const docsToSave = props.map(p => ({
        id: `${eventId}_${p.playerId}_${p.market}`,
        data: {
          ...p,
          gameId: eventId,
          sport: sport,
          matchup: (awayTeam && homeTeam) ? `${awayTeam} @ ${homeTeam}` : '',
          updatedAt: new Date().toISOString()
        }
      }));
      batchSetRestDocs('player_props', docsToSave).catch(e => console.warn('Cache write to player_props failed:', e.message));
    }

    return NextResponse.json({
      success: true,
      props,
      count: props.length,
      apiUsage: {
        used: used,
        remaining: remaining
      }
    });

  } catch (error: any) {
    console.error("❌ Error fetching props:", error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}