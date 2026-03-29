import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const home = searchParams.get('home');
  const away = searchParams.get('away');
  
  // TODO: Add MLB mathematical modeling here when ready

  return NextResponse.json({
    prediction: {
      gameId: `temp-${home}-${away}`,
      homeTeam: home,
      awayTeam: away,
      marketSpread: 0,
      projectedSpread: 0,
      zScore: 0.0,
      edge: 0.0,
      recommendedSide: home,
      confidence: 'No Data',
      expectedValue: 0,
      homeWinProb: 50.0,
      awayWinProb: 50.0,
      logicTrace: [
        'MLB logic has not yet been implemented.',
        'Architecture is ready for new model parameters.'
      ]
    }
  });
}
