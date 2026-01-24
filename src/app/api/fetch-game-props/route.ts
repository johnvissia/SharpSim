// src/app/api/fetch-game-props/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');
    
    if (!eventId) {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 });
    }

    console.log(`🎯 Fetching player props for event: ${eventId}`);

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

    const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${eventId}/odds?apiKey=${process.env.NEXT_PUBLIC_ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;

    console.log('📡 Calling Odds API...');

    const response = await fetch(url, {
      cache: 'no-store'
    });

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