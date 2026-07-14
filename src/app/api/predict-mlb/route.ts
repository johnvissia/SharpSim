import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { normalizeTeamName } from '@/lib/team-names';
import { fetchEspnSchedule } from '@/lib/espn';

export const dynamic = 'force-dynamic';

const LEAGUE_AVERAGE_RUNS = 4.5;
const LOGISTIC_K = 12.0;
const HOME_FIELD_BOOST = 0.018; // Step 4: homeBoost = +0.018 rating

const mlbTeamToAbbreviation: Record<string, string> = {
  'Arizona Diamondbacks': 'ARI',
  'Atlanta Braves': 'ATL',
  'Baltimore Orioles': 'BAL',
  'Boston Red Sox': 'BOS',
  'Chicago Cubs': 'CHC',
  'Chicago White Sox': 'CHW',
  'Cincinnati Reds': 'CIN',
  'Cleveland Guardians': 'CLE',
  'Colorado Rockies': 'COL',
  'Detroit Tigers': 'DET',
  'Houston Astros': 'HOU',
  'Kansas City Royals': 'KC',
  'Los Angeles Angels': 'LAA',
  'Los Angeles Dodgers': 'LAD',
  'Miami Marlins': 'MIA',
  'Milwaukee Brewers': 'MIL',
  'Minnesota Twins': 'MIN',
  'New York Mets': 'NYM',
  'New York Yankees': 'NYY',
  'Oakland Athletics': 'OAK',
  'Philadelphia Phillies': 'PHI',
  'Pittsburgh Pirates': 'PIT',
  'San Diego Padres': 'SD',
  'San Francisco Giants': 'SF',
  'Seattle Mariners': 'SEA',
  'St. Louis Cardinals': 'STL',
  'Tampa Bay Rays': 'TB',
  'Texas Rangers': 'TEX',
  'Toronto Blue Jays': 'TOR',
  'Washington Nationals': 'WSH',
};

async function getTeamStats(name: string) {
  if (!db) return null;

  const normalized = normalizeTeamName(name);
  const abbrev = mlbTeamToAbbreviation[normalized] || name.toUpperCase();

  let doc = await db.collection('mlb_team_stats').doc(abbrev).get();
  if (doc.exists) return doc.data();

  const snapshot = await db.collection('mlb_team_stats').where('teamName', '==', normalized).limit(1).get();
  if (!snapshot.empty) return snapshot.docs[0].data();

  return null;
}

// Pitcher Rating: lower SP is better. 4.20 runs is standard league baseline.
async function getPitcherRating(pitcherName: string): Promise<{ sp: number; fip: number; xfip: number; siera: number; name: string } | null> {
  try {
    const searchRes = await fetch(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(pitcherName)}&sportIds=1`, { cache: 'no-store' });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const person = searchData.people?.[0];
    if (!person) return null;

    const statsRes = await fetch(`https://statsapi.mlb.com/api/v1/people/${person.id}/stats?stats=season&group=pitching`, { cache: 'no-store' });
    if (!statsRes.ok) return null;
    const statsData = await statsRes.json();
    const stat = statsData.stats?.[0]?.splits?.[0]?.stat;
    if (!stat) return null;

    const HR = stat.homeRuns || 0;
    const BB = stat.baseOnBalls || 0;
    const HBP = stat.hitByPitch || 0;
    const SO = stat.strikeOuts || 0;
    const IP = stat.inningsPitched ? parseFloat(stat.inningsPitched) : 0;
    const ERA = stat.era ? parseFloat(stat.era) : 4.2;
    const airOuts = stat.airOuts || 0;

    if (IP === 0) return null;

    // FIP Formula: (13*HR + 3*(BB+HBP) - 2*SO)/IP + 3.2
    const fip = (13 * HR + 3 * (BB + HBP) - 2 * SO) / IP + 3.2;

    // xFIP Formula
    const flyBalls = airOuts * 0.4;
    const expectedHR = flyBalls > 0 ? flyBalls * 0.105 : 1.0;
    const xfip = (13 * expectedHR + 3 * (BB + HBP) - 2 * SO) / IP + 3.2;

    // SIERA Formula
    const siera = 1.69 * fip - 0.69 * ERA;

    const Stuff = 100; // default average
    const sp = 0.4 * fip + 0.3 * xfip + 0.2 * siera + 0.1 * (4.2 * (200 - Stuff) / 100);

    return { sp, fip, xfip, siera, name: person.fullName };
  } catch (e) {
    console.error(`Error fetching starting pitcher stats for ${pitcherName}:`, e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const home = searchParams.get('home') || '';
    const away = searchParams.get('away') || '';
    const marketSpreadStr = searchParams.get('marketSpread');
    const hasMarketSpread = marketSpreadStr !== null && marketSpreadStr !== 'null' && marketSpreadStr !== '';
    const marketSpread = hasMarketSpread ? parseFloat(marketSpreadStr || '0') : 0;

    if (!home || !away) {
      return NextResponse.json({ error: 'Missing home or away team name' }, { status: 400 });
    }

    const homeStats = await getTeamStats(home);
    const awayStats = await getTeamStats(away);

    if (!homeStats || !awayStats) {
      return NextResponse.json({
        prediction: {
          gameId: `temp-${home}-${away}`,
          homeTeam: home,
          awayTeam: away,
          marketSpread: hasMarketSpread ? marketSpread : 0,
          projectedSpread: 0,
          zScore: 0.0,
          edge: 0.0,
          recommendedSide: home,
          betSignal: 'No Play',
          confidence: 'No Data',
          expectedValue: 0,
          homeWinProb: 50.0,
          awayWinProb: 50.0,
          logicTrace: [
            'Failed to resolve ratings. Please run data sync and ratings calculation first.'
          ]
        }
      });
    }

    // Resolve starting pitchers from today's schedule dynamically
    let homePitcherName = '';
    let awayPitcherName = '';
    try {
      const schedule = await fetchEspnSchedule();
      const match = schedule.find(g => 
        g.sport === 'MLB' &&
        (normalizeTeamName(g.homeTeam.name) === normalizeTeamName(home) || 
         normalizeTeamName(g.awayTeam.name) === normalizeTeamName(away))
      );
      if (match) {
        homePitcherName = match.homeTeam.startingPitcher?.name || '';
        awayPitcherName = match.awayTeam.startingPitcher?.name || '';
      }
    } catch (e) {
      console.warn('Failed to resolve starting pitchers from ESPN scoreboard.');
    }

    // Step 1: Keep the current ratings (0.500 centered SRS, OR, DR)
    const homeRating = homeStats.powerRatings?.blendedRating || 0.500;
    const awayRating = awayStats.powerRatings?.blendedRating || 0.500;
    const homeOR = homeStats.powerRatings?.or || 1.0;
    const homeDR = homeStats.powerRatings?.dr || 1.0;
    const awayOR = awayStats.powerRatings?.or || 1.0;
    const awayDR = awayStats.powerRatings?.dr || 1.0;

    // Step 2: Create matchup strength
    const ratingDiff = homeRating - awayRating;

    // Step 3 & 4: Convert rating diff to win probability + Add home field boost
    // adjustedDiff = ratingDiff + homeField
    let adjustedDiff = ratingDiff + HOME_FIELD_BOOST;

    // Step 5: Include starting pitchers
    // Pitcher rating boost: (4.2 - SP) * 0.025 (matches Skubal = +0.030, Cole = +0.025, replacement = 0)
    let homePitcherBoost = 0;
    let awayPitcherBoost = 0;
    let homePitcherInfo = null;
    let awayPitcherInfo = null;

    if (homePitcherName) {
      homePitcherInfo = await getPitcherRating(homePitcherName);
      if (homePitcherInfo) {
        homePitcherBoost = (4.2 - homePitcherInfo.sp) * 0.025;
      }
    }

    if (awayPitcherName) {
      awayPitcherInfo = await getPitcherRating(awayPitcherName);
      if (awayPitcherInfo) {
        awayPitcherBoost = (4.2 - awayPitcherInfo.sp) * 0.025;
      }
    }

    const pitcherDiff = homePitcherBoost - awayPitcherBoost;
    adjustedDiff += pitcherDiff;

    // Step 3 (Logistic Win Probability based on Rating Gap)
    // P(home) = 1 / (1 + exp(-k * adjustedDiff))
    const logisticHomeWinProb = 1 / (1 + Math.exp(-LOGISTIC_K * adjustedDiff));

    // Step 6: Predict runs (Projected Scores)
    // Expected Runs = LeagueRuns * Offense / Defense
    let expectedRunsHome = LEAGUE_AVERAGE_RUNS * homeOR / awayDR;
    let expectedRunsAway = LEAGUE_AVERAGE_RUNS * awayOR / homeDR;

    // Adjust expected runs by starting pitcher quality on the run scale (1.0 SP diff = ~0.6 runs)
    const homePitcherRunAdjustment = homePitcherInfo ? (4.2 - homePitcherInfo.sp) * 0.6 : 0;
    const awayPitcherRunAdjustment = awayPitcherInfo ? (4.2 - awayPitcherInfo.sp) * 0.6 : 0;

    expectedRunsHome = Math.max(1.0, expectedRunsHome + awayPitcherRunAdjustment);
    expectedRunsAway = Math.max(1.0, expectedRunsAway + homePitcherRunAdjustment);

    // Step 7: Convert runs into win % (Pythagorean runs-distribution model)
    const pythagExp = Math.pow(expectedRunsHome + expectedRunsAway, 0.287);
    const pythagHomeWinProb = Math.pow(expectedRunsHome, pythagExp) / (Math.pow(expectedRunsHome, pythagExp) + Math.pow(expectedRunsAway, pythagExp));

    // Blended/Final win probability: using Pythagorean win expectancy as the primary predictor
    // because it ties win expectancy directly to predicted scoring.
    const homeWinProb = pythagHomeWinProb * 100;
    const awayWinProb = (1 - pythagHomeWinProb) * 100;

    // Expected run differential
    const expectedRunDiff = expectedRunsHome - expectedRunsAway;

    // Projected spread (Favorite perspective)
    const projectedSpread = -expectedRunDiff;

    // Edge and Bet Signal
    const edge = hasMarketSpread ? marketSpread - projectedSpread : 0;
    const zScore = hasMarketSpread ? edge / 4.0 : 0;

    let betSignal = 'No Play';
    const absZ = Math.abs(zScore);
    if (hasMarketSpread) {
      if (absZ >= 1.0) betSignal = 'ELITE VALUE';
      else if (absZ >= 0.75) betSignal = 'STRONG VALUE';
      else if (absZ >= 0.55) betSignal = 'PLAYABLE';
    }

    const recommendedSide = zScore > 0 ? home : away;

    const logicTrace = [
      `Step 1: Keep ratings: Home ${home} [Rating: ${homeRating.toFixed(3)}, Off: ${homeOR.toFixed(2)}, Def: ${homeDR.toFixed(2)}] | Away ${away} [Rating: ${awayRating.toFixed(3)}, Off: ${awayOR.toFixed(2)}, Def: ${awayDR.toFixed(2)}]`,
      `Step 2: Matchup strength rating diff: ${ratingDiff.toFixed(3)}`,
      `Step 4: Added home field boost: +${HOME_FIELD_BOOST.toFixed(3)} rating`,
      homePitcherInfo ? `Step 5: Home pitcher ${homePitcherInfo.name} rating: ${homePitcherInfo.sp.toFixed(2)} (Boost: +${homePitcherBoost.toFixed(3)} rating)` : 'Step 5: No home starting pitcher stats loaded.',
      awayPitcherInfo ? `Step 5: Away pitcher ${awayPitcherInfo.name} rating: ${awayPitcherInfo.sp.toFixed(2)} (Boost: +${awayPitcherBoost.toFixed(3)} rating)` : 'Step 5: No away starting pitcher stats loaded.',
      `Step 5: Final Adjusted rating diff: ${adjustedDiff.toFixed(3)}`,
      `Step 3: Logistic win probability (k=12): ${(logisticHomeWinProb * 100).toFixed(1)}%`,
      `Step 6: Predicted runs: ${home} ${expectedRunsHome.toFixed(2)} | ${away} ${expectedRunsAway.toFixed(2)} (Exp run diff: ${expectedRunDiff.toFixed(2)})`,
      `Step 7: Pythagorean Win expectancy (exp: ${pythagExp.toFixed(3)}): Home ${(pythagHomeWinProb * 100).toFixed(1)}% | Away ${(100 - pythagHomeWinProb * 100).toFixed(1)}%`,
      hasMarketSpread
        ? `Market spread: ${marketSpread > 0 ? '+' : ''}${marketSpread.toFixed(1)}. Difference edge: ${edge > 0 ? '+' : ''}${edge.toFixed(2)} runs.`
        : 'No market spread provided.',
      hasMarketSpread ? `Z-Score: ${zScore.toFixed(2)} (${betSignal})` : 'Bet signal requires a market spread.'
    ];

    return NextResponse.json({
      prediction: {
        gameId: `temp-${home}-${away}`,
        homeTeam: home,
        awayTeam: away,
        marketSpread: hasMarketSpread ? marketSpread : 0,
        projectedSpread: parseFloat(projectedSpread.toFixed(2)),
        zScore: parseFloat(zScore.toFixed(2)),
        edge: parseFloat(edge.toFixed(2)),
        recommendedSide: (hasMarketSpread && absZ >= 0.55) ? recommendedSide : null,
        betSignal,
        confidence: hasMarketSpread ? Math.min(absZ * 25, 99).toFixed(0) + '%' : '0%',
        expectedValue: 0,
        homeWinProb: parseFloat(homeWinProb.toFixed(1)),
        awayWinProb: parseFloat(awayWinProb.toFixed(1)),
        expectedScore: {
          home: parseFloat(expectedRunsHome.toFixed(1)),
          away: parseFloat(expectedRunsAway.toFixed(1))
        },
        logicTrace
      }
    });

  } catch (error: any) {
    console.error('Error generating MLB prediction:', error);
    return NextResponse.json({
      error: error.message,
      message: 'Failed to generate MLB prediction'
    }, { status: 500 });
  }
}
