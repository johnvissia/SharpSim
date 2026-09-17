import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const ITERATIONS = 10;
const LAMBDA_LONG = Math.log(2) / 60; // 60-day half-life
const LAMBDA_SHORT = Math.log(2) / 12; // 12-day half-life
const SOS_WEIGHT = 0.75;
const SOS_CAP = 0.02;

interface TeamGame {
  gameId: string;
  date: string;
  isHome: boolean;
  opponent: string;
  runs: number;
  runsAllowed: number;
  bsrFor: number;
  bsrAgainst: number;
}

interface TeamDoc {
  teamName: string;
  abbreviation: string;
  logo: string;
  games: TeamGame[];
  summary: {
    wins: number;
    losses: number;
    avgAdjustedMargin: number;
  };
  or?: number;
  dr?: number;
  srsRating?: number;
  expectedWinPct?: number;
}

interface TeamCalcTrace {
  team: string;
  abbreviation: string;
  record: string;
  totalGames: number;
  effectiveGames: string;
  weightedRS: string;
  weightedRA: string;
  avgRSPerGame: string;
  avgRAPerGame: string;
  pythagExponent: string;
  expectedWinPct: string;
  avgOpponentExpWin: string;
  rawSosAdj: string;
  cappedSosAdj: string;
  ratingBeforeShift: string;
  leagueShift: string;
  finalRating: string;
  offenseRating: string;
  defenseRating: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      throw new Error('Firestore database is not initialized');
    }

    console.log('[MLB Ratings] Fetching teams from Firestore...');
    const snapshot = await db.collection('mlb_team_stats').get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'No MLB team data found. Please run Data Sync first.'
      }, { status: 400 });
    }

    const teams: TeamDoc[] = snapshot.docs.map(doc => {
      const data = doc.data();
      const abbrev = data.abbreviation || doc.id || 'UNK';
      return {
        ...data,
        teamName: data.teamName || abbrev,
        abbreviation: abbrev,
        games: Array.isArray(data.games) ? data.games : [],
        summary: data.summary || { wins: 0, losses: 0, avgAdjustedMargin: 0 }
      } as TeamDoc;
    });

    const teamMap = new Map<string, TeamDoc>();
    teams.forEach(t => {
      t.or = 1.0;
      t.dr = 1.0;
      t.srsRating = 0.500;
      t.expectedWinPct = 0.500;
      teamMap.set(t.abbreviation, t);
    });

    // ─── STEP 1: Find most recent game date (anchor for decay) ───
    let latestTime = 0;
    teams.forEach(team => {
      (team.games || []).forEach(g => {
        const time = new Date(g.date).getTime();
        if (time > latestTime) latestTime = time;
      });
    });
    if (latestTime === 0) latestTime = Date.now();
    const latestDateStr = new Date(latestTime).toISOString().split('T')[0];
    console.log(`\n[STEP 1] Anchor date for decay: ${latestDateStr}`);
    console.log(`  LAMBDA_LONG  = ln(2)/60 = ${LAMBDA_LONG.toFixed(6)} (60-day half-life)`);
    console.log(`  LAMBDA_SHORT = ln(2)/12 = ${LAMBDA_SHORT.toFixed(6)} (12-day half-life)`);
    console.log(`  Weight(t) = 0.6 * e^(-${LAMBDA_LONG.toFixed(4)}*t) + 0.4 * e^(-${LAMBDA_SHORT.toFixed(4)}*t)`);

    // ─── STEP 2: Calculate double decay weights ───
    const gameWeightsMap = new Map<string, number>();
    teams.forEach(team => {
      (team.games || []).forEach(g => {
        const gameTime = new Date(g.date).getTime();
        const tDays = Math.max(0, (latestTime - gameTime) / (1000 * 60 * 60 * 24));
        const weight = 0.6 * Math.exp(-LAMBDA_LONG * tDays) + 0.4 * Math.exp(-LAMBDA_SHORT * tDays);
        gameWeightsMap.set(`${team.abbreviation}-${g.gameId}`, weight);
      });
    });

    console.log(`\n[STEP 2] Calculated decay weights for all ${teams.length} teams' games.`);
    // Print a sample: first 3 games of first team with games
    const sampleTeam = teams.find(t => t.games && t.games.length > 0) || teams[0];
    if (sampleTeam && sampleTeam.games && sampleTeam.games.length > 0) {
      console.log(`  Sample weights for ${sampleTeam.abbreviation}:`);
      sampleTeam.games.slice(0, 3).forEach(g => {
        const tDays = Math.max(0, (latestTime - new Date(g.date).getTime()) / (1000 * 60 * 60 * 24));
        const w = gameWeightsMap.get(`${sampleTeam.abbreviation}-${g.gameId}`) || 0;
        console.log(`    ${g.date} (${tDays.toFixed(0)} days ago): weight = ${w.toFixed(4)}`);
      });
    }

    // ─── STEP 3: Calculate weighted BaseRuns & Pythagpat win expectancy ───
    console.log(`\n[STEP 3] Calculating weighted BaseRuns and Pythagpat ExpWin% for each team...`);
    console.log(`  Formula: avgRS = sum(weight_i * BsR_For_i) / sum(weight_i)`);
    console.log(`  Formula: avgRA = sum(weight_i * BsR_Against_i) / sum(weight_i)`);
    console.log(`  Formula: exponent = (avgRS + avgRA) ^ 0.287`);
    console.log(`  Formula: ExpWin = WRS^x / (WRS^x + WRA^x)\n`);

    const rawTeamStats = teams.map(team => {
      let rawWeightedRS = 0;
      let rawWeightedRA = 0;
      let sumWeights = 0;

      (team.games || []).forEach(g => {
        const weight = gameWeightsMap.get(`${team.abbreviation}-${g.gameId}`) || 1.0;
        rawWeightedRS += weight * (g.bsrFor || 0);
        rawWeightedRA += weight * (g.bsrAgainst || 0);
        sumWeights += weight;
      });

      const avgRS = sumWeights > 0 ? rawWeightedRS / sumWeights : 4.5;
      const avgRA = sumWeights > 0 ? rawWeightedRA / sumWeights : 4.5;
      const xExponent = (avgRS + avgRA) > 0 ? Math.pow(avgRS + avgRA, 0.287) : 1.83;

      const num = Math.pow(rawWeightedRS, xExponent);
      const den = num + Math.pow(rawWeightedRA, xExponent);
      const expectedWinPct = den > 0 ? num / den : 0.500;

      console.log(`  ${(team.abbreviation || '').padEnd(4)} | Games: ${(team.games || []).length} | G_eff: ${sumWeights.toFixed(2)} | WRS: ${rawWeightedRS.toFixed(2)} | WRA: ${rawWeightedRA.toFixed(2)} | avgRS/G: ${avgRS.toFixed(3)} | avgRA/G: ${avgRA.toFixed(3)} | exp: ${xExponent.toFixed(3)} | ExpWin: ${expectedWinPct.toFixed(3)}`);

      return {
        abbrev: team.abbreviation,
        expectedWinPct,
        rawWeightedRS,
        rawWeightedRA,
        sumWeights
      };
    });

    // Verify total RS == total RA across the league
    const totalRS = rawTeamStats.reduce((s, t) => s + t.rawWeightedRS, 0);
    const totalRA = rawTeamStats.reduce((s, t) => s + t.rawWeightedRA, 0);
    console.log(`\n  [Check 2] League Total WRS: ${totalRS.toFixed(2)} | League Total WRA: ${totalRA.toFixed(2)} | Diff: ${(totalRS - totalRA).toFixed(2)}`);

    // Save unadjusted expectedWinPct as baseline
    rawTeamStats.forEach(s => {
      const team = teamMap.get(s.abbrev);
      if (team) {
        team.expectedWinPct = s.expectedWinPct;
        team.srsRating = s.expectedWinPct;
      }
    });

    // Check 1 on raw expectancies
    const rawLeagueAvgExpWin = rawTeamStats.length > 0
      ? rawTeamStats.reduce((s, t) => s + t.expectedWinPct, 0) / rawTeamStats.length
      : 0.500;
    console.log(`  [Check 1] League Average Raw ExpWin: ${rawLeagueAvgExpWin.toFixed(4)} (should be ~0.500)\n`);

    // ─── STEP 4: Calculate SOS adjustment ───
    console.log(`[STEP 4] Calculating Strength of Schedule (SOS) adjustment...`);
    console.log(`  Formula: avgOppExpWin = sum(weight_i * opp_ExpWin_i) / sum(weight_i)`);
    console.log(`  Formula: rawSOS = ${SOS_WEIGHT} * (avgOppExpWin - 0.500)`);
    console.log(`  Formula: cappedSOS = clamp(rawSOS, -${SOS_CAP}, +${SOS_CAP})`);
    console.log(`  Formula: ratingBeforeShift = expectedWinPct + cappedSOS\n`);

    const sosAdjustments = new Map<string, { avgOpponentExpWin: number; rawSosAdj: number; sosAdjustment: number }>();

    teams.forEach(team => {
      let weightedOppExpWinSum = 0;
      let opponentWeightSum = 0;

      (team.games || []).forEach(g => {
        const weight = gameWeightsMap.get(`${team.abbreviation}-${g.gameId}`) || 1.0;
        const opponent = teamMap.get(g.opponent);
        if (opponent) {
          weightedOppExpWinSum += weight * (opponent.expectedWinPct || 0.500);
          opponentWeightSum += weight;
        }
      });

      const avgOpponentExpWin = opponentWeightSum > 0 ? weightedOppExpWinSum / opponentWeightSum : 0.500;
      const rawSosAdj = SOS_WEIGHT * (avgOpponentExpWin - 0.500);
      const sosAdjustment = Math.max(-SOS_CAP, Math.min(SOS_CAP, rawSosAdj));

      sosAdjustments.set(team.abbreviation, {
        avgOpponentExpWin,
        rawSosAdj,
        sosAdjustment
      });

      console.log(`  ${(team.abbreviation || '').padEnd(4)} | avgOppExpWin: ${avgOpponentExpWin.toFixed(3)} | rawSOS: ${rawSosAdj >= 0 ? '+' : ''}${rawSosAdj.toFixed(4)} | cappedSOS: ${sosAdjustment >= 0 ? '+' : ''}${sosAdjustment.toFixed(4)} | rating: ${((team.expectedWinPct || 0.500) + sosAdjustment).toFixed(3)}`);
    });

    // ─── STEP 5: Apply SOS + Compute OR/DR ───
    console.log(`\n[STEP 5] Applying SOS adjustments and computing OR/DR...`);
    console.log(`  Formula: OR = avgRS / 4.5   (>1.0 = above avg offense)`);
    console.log(`  Formula: DR = 4.5 / avgRA   (>1.0 = above avg defense)\n`);

    teams.forEach(team => {
      const sosInfo = sosAdjustments.get(team.abbreviation) || { avgOpponentExpWin: 0.500, rawSosAdj: 0, sosAdjustment: 0 };
      team.srsRating = (team.expectedWinPct || 0.500) + sosInfo.sosAdjustment;

      let weightedRS = 0;
      let weightedRA = 0;
      let sumWeights = 0;
      (team.games || []).forEach(g => {
        const weight = gameWeightsMap.get(`${team.abbreviation}-${g.gameId}`) || 1.0;
        weightedRS += weight * (g.bsrFor || 0);
        weightedRA += weight * (g.bsrAgainst || 0);
        sumWeights += weight;
      });

      const avgRS = sumWeights > 0 ? weightedRS / sumWeights : 4.5;
      const avgRA = sumWeights > 0 ? weightedRA / sumWeights : 4.5;
      team.or = avgRS / 4.5;
      team.dr = 4.5 / avgRA;

      console.log(`  ${(team.abbreviation || '').padEnd(4)} | ExpWin: ${(team.expectedWinPct || 0.500).toFixed(3)} + SOS: ${sosInfo.sosAdjustment >= 0 ? '+' : ''}${sosInfo.sosAdjustment.toFixed(4)} = ${team.srsRating.toFixed(3)} | OR: ${team.or.toFixed(3)} | DR: ${team.dr.toFixed(3)}`);
    });

    // ─── STEP 6: Normalize league average to exactly 0.500 ───
    const rawAvgExpWin = teams.length > 0 ? teams.reduce((sum, t) => sum + (t.srsRating || 0.500), 0) / teams.length : 0.500;
    const shiftOffset = 0.500 - rawAvgExpWin;

    console.log(`\n[STEP 6] Normalizing league average to exactly 0.500...`);
    console.log(`  League avg before shift: ${rawAvgExpWin.toFixed(4)}`);
    console.log(`  Shift offset: ${shiftOffset >= 0 ? '+' : ''}${shiftOffset.toFixed(4)}`);

    // Build full trace for all teams BEFORE shift
    const calcTraces: TeamCalcTrace[] = [];

    teams.forEach(t => {
      const ratingBeforeShift = t.srsRating || 0.500;
      t.srsRating = Math.min(0.999, Math.max(0.001, ratingBeforeShift + shiftOffset));

      const sosInfo = sosAdjustments.get(t.abbreviation) || { avgOpponentExpWin: 0.500, rawSosAdj: 0, sosAdjustment: 0 };
      const raw = rawTeamStats.find(r => r.abbrev === t.abbreviation) || {
        abbrev: t.abbreviation,
        expectedWinPct: 0.500,
        rawWeightedRS: 0,
        rawWeightedRA: 0,
        sumWeights: 0
      };

      calcTraces.push({
        team: t.teamName || t.abbreviation,
        abbreviation: t.abbreviation,
        record: `${t.summary?.wins ?? 0}-${t.summary?.losses ?? 0}`,
        totalGames: (t.games || []).length,
        effectiveGames: raw.sumWeights.toFixed(2),
        weightedRS: raw.rawWeightedRS.toFixed(2),
        weightedRA: raw.rawWeightedRA.toFixed(2),
        avgRSPerGame: (raw.sumWeights > 0 ? raw.rawWeightedRS / raw.sumWeights : 0).toFixed(3),
        avgRAPerGame: (raw.sumWeights > 0 ? raw.rawWeightedRA / raw.sumWeights : 0).toFixed(3),
        pythagExponent: ((raw.sumWeights > 0 ? Math.pow((raw.rawWeightedRS + raw.rawWeightedRA) / raw.sumWeights, 0.287) : 1.83)).toFixed(3),
        expectedWinPct: raw.expectedWinPct.toFixed(3),
        avgOpponentExpWin: sosInfo.avgOpponentExpWin.toFixed(3),
        rawSosAdj: `${sosInfo.rawSosAdj >= 0 ? '+' : ''}${sosInfo.rawSosAdj.toFixed(4)}`,
        cappedSosAdj: `${sosInfo.sosAdjustment >= 0 ? '+' : ''}${sosInfo.sosAdjustment.toFixed(4)}`,
        ratingBeforeShift: ratingBeforeShift.toFixed(3),
        leagueShift: `${shiftOffset >= 0 ? '+' : ''}${shiftOffset.toFixed(4)}`,
        finalRating: (t.srsRating || 0.500).toFixed(3),
        offenseRating: (t.or || 1.0).toFixed(3),
        defenseRating: (t.dr || 1.0).toFixed(3),
      });
    });

    const shiftedAvgExpWin = teams.length > 0 ? teams.reduce((sum, t) => sum + (t.srsRating || 0.500), 0) / teams.length : 0.500;
    console.log(`  League avg after shift:  ${shiftedAvgExpWin.toFixed(4)}`);

    // Print final table
    console.log(`\n[FINAL RANKINGS] All 30 teams sorted by final rating:\n`);
    const sortedTraces = [...calcTraces].sort((a, b) => parseFloat(b.finalRating) - parseFloat(a.finalRating));
    sortedTraces.forEach((t, i) => {
      console.log(`  #${(i + 1).toString().padStart(2)} ${(t.abbreviation || '').padEnd(4)} ${(t.record || '').padEnd(6)} | ExpWin: ${t.expectedWinPct} | avgOpp: ${t.avgOpponentExpWin} | SOS: ${t.cappedSosAdj} | shift: ${t.leagueShift} | FINAL: ${t.finalRating} | OR: ${t.offenseRating} DR: ${t.defenseRating}`);
    });

    console.log('\n[MLB Ratings] Saving final ratings to Firestore...');

    // Sort by win expectancy descending
    const sortedTeams = [...teams].sort((a, b) => (b.srsRating || 0.500) - (a.srsRating || 0.500));

    // Save results to Firestore
    const batch = db.batch();
    sortedTeams.forEach((team) => {
      const ref = db.collection('mlb_team_stats').doc(team.abbreviation);
      batch.set(ref, {
        powerRatings: {
          blendedRating: team.srsRating || 0.500,
          srs: team.srsRating || 0.500,
          or: team.or || 1.0,
          dr: team.dr || 1.0
        }
      }, { merge: true });
    });
    await batch.commit();

    // Helper to format team for frontend output
    const formatTeamForDashboard = (t: TeamDoc) => ({
      team: t.teamName || t.abbreviation,
      abbreviation: t.abbreviation,
      logo: t.logo || '',
      rating: (t.srsRating || 0.500).toFixed(3),
      srs: (t.srsRating || 0.500).toFixed(3),
      wins: t.summary?.wins ?? 0,
      losses: t.summary?.losses ?? 0,
      avgMargin: `Off: ${(t.or || 1.0).toFixed(2)} | Def: ${(t.dr || 1.0).toFixed(2)}`
    });

    const topTeams = sortedTeams.slice(0, 10).map(formatTeamForDashboard);
    const bottomTeams = sortedTeams.slice(-10).reverse().map(formatTeamForDashboard);

    return NextResponse.json({
      success: true,
      message: "MLB Run-Differential SRS calculation complete.",
      iterations: ITERATIONS,
      constants: {
        LAMBDA_LONG: LAMBDA_LONG.toFixed(6),
        LAMBDA_SHORT: LAMBDA_SHORT.toFixed(6),
        SOS_WEIGHT,
        SOS_CAP,
        leagueShiftOffset: shiftOffset.toFixed(4),
        leagueAvgAfterShift: shiftedAvgExpWin.toFixed(4),
        anchorDate: latestDateStr
      },
      allTeamCalculations: sortedTraces,
      topTeams,
      bottomTeams
    });

  } catch (error: any) {
    console.error('Error calculating MLB ratings:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: "Failed to calculate MLB ratings"
    }, { status: 500 });
  }
}
