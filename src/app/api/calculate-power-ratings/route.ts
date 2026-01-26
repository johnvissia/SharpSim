// src/app/api/calculate-power-ratings/route.ts
import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

// ============================================================================
// GLOBAL CONSTANTS (UPDATED WITH IMPROVEMENTS)
// ============================================================================
const HCA_PTS = 2.3;  // UPDATED: Modern NBA travel reduced HCA
const HCA_NET = 2.3;  // UPDATED: From 2.5 to 2.3
const STD_DEV = 11.0;
const INJURY_DAMPING = 0.75;
const WEIGHT_SEASON = 0.70;
const WEIGHT_RECENCY = 0.30;
const SRS_CONVERGENCE_THRESHOLD = 0.01;
const MAX_ITERATIONS = 100;

// TIERED REPLACEMENT SYSTEM (accounts for player quality)
const REPLACEMENT_BPM_STAR = 0;    // Star players replaced by decent backups
const REPLACEMENT_BPM_STARTER = -2.0;  // Starters replaced by average backups
const REPLACEMENT_BPM_BENCH = -4.0;    // Bench players replaced by deep bench

// EXPANDED REST PENALTIES
const REST_B2B_HOME = -0.5;           // Back-to-back at home
const REST_B2B_AWAY = -1.5;           // Back-to-back away
const REST_3_IN_4 = -2.0;             // 3rd game in 4 nights
const REST_4_IN_5 = -4.0;             // 4th game in 5 nights (death schedule)

// BET SIZING LIMITS
const MAX_BET_SIZE = 0.05;            // Hard cap: 5% of bankroll maximum
const RECOMMENDED_MAX_BET = 0.03;     // Recommended: 3% max for safety

// BLOWOUT THRESHOLD
const BLOWOUT_MARGIN = 20;            // Games with 20+ point margins are dampened
const BLOWOUT_WEIGHT = 0.5;           // Reduce weight by 50% for blowouts

// ============================================================================
// INTERFACES
// ============================================================================
interface BoxScore {
  FGA: number;
  FTA: number;
  TOV: number;
  ORB: number;
  FG: number;
  oppDRB: number;
  oppFGA: number;
  oppFTA: number;
  oppTOV: number;
  oppORB: number;
  oppFG: number;
  teamDRB: number;
}

interface GameData {
  gameNumber: number;
  date: string;
  isHome: boolean;
  opponent: string;
  result: 'W' | 'L';
  teamScore: number;
  opponentScore: number;
  margin: number;
  adjustedMargin: number;
  boxScore?: BoxScore;
  daysRest?: number;
  isBackToBack?: boolean;
  gamesInLast4Days?: number;  // For 3-in-4 and 4-in-5 detection
  gamesInLast5Days?: number;
}

interface TeamStats {
  teamName: string;
  abbreviation: string;
  games: GameData[];
  summary: {
    totalGames: number;
    wins: number;
    losses: number;
    avgAdjustedMargin: number;
    homeMOV: number;
    awayMOV: number;
    homeAwayDelta: number;
    rollingMOV: number;
    sos?: number;
    scheduleAdjustedMOV?: number;
    avgPace?: number;
  };
}

interface PlayerInjury {
  name: string;
  status: string;
  bpm?: number;
  mpg?: number;
}

interface TeamWithRating extends TeamStats {
  netRatings: number[];
  avgNetRating: number;
  srsRating: number;
  recencyRating: number;
  blendedRating: number;
  injuryAdjustment: number;
  restAdjustment: number;
  finalTPR: number;
  injuries: PlayerInjury[];
  avgPace: number;
}

// ============================================================================
// PHASE 1: DATA NORMALIZATION (PACE & EFFICIENCY)
// ============================================================================

/**
 * Calculate game possessions using the primary formula
 * P = 0.5 × ((Tm_FGA + 0.4·Tm_FTA - 1.07·(Tm_ORB/(Tm_ORB + Opp_DRB))·(Tm_FGA - Tm_FG) + Tm_TOV) + (Opp_FGA + ...))
 */
function calculatePossessions(box: BoxScore): number {
  const orbFactor = box.ORB / (box.ORB + box.oppDRB);
  const teamPoss = box.FGA + 0.4 * box.FTA - 1.07 * orbFactor * (box.FGA - box.FG) + box.TOV;
  
  const oppOrbFactor = box.oppORB / (box.oppORB + box.teamDRB);
  const oppPoss = box.oppFGA + 0.4 * box.oppFTA - 1.07 * oppOrbFactor * (box.oppFGA - box.oppFG) + box.oppTOV;
  
  return 0.5 * (teamPoss + oppPoss);
}

/**
 * Fallback possession calculation when detailed stats unavailable
 * P = FGA + 0.44 × FTA + TOV
 */
function calculatePossessionsFallback(box: Partial<BoxScore>): number {
  if (!box.FGA || !box.FTA || !box.TOV) {
    return 100; // NBA average if no data
  }
  return box.FGA + 0.44 * box.FTA + box.TOV;
}

/**
 * Calculate Raw Net Rating
 * NR_raw = 100 × (PointsScored - PointsAllowed) / Possessions
 */
function calculateRawNetRating(pointsScored: number, pointsAllowed: number, possessions: number): number {
  return 100 * (pointsScored - pointsAllowed) / possessions;
}

/**
 * Apply location adjustment to normalize to neutral court
 * Home: NR_adj = NR_raw - HCA_NET
 * Away: NR_adj = NR_raw + HCA_NET
 */
function adjustForLocation(rawNetRating: number, isHome: boolean): number {
  return isHome ? rawNetRating - HCA_NET : rawNetRating + HCA_NET;
}

// ============================================================================
// PHASE 2: CORE TEAM STRENGTH (RECURSIVE SRS)
// ============================================================================

function calculateSRS(teams: TeamWithRating[]): number {
  const teamMap = new Map<string, TeamWithRating>();
  teams.forEach(team => teamMap.set(team.teamName, team));

  let iteration = 0;
  let maxChange = Infinity;

  while (maxChange > SRS_CONVERGENCE_THRESHOLD && iteration < MAX_ITERATIONS) {
    iteration++;
    maxChange = 0;

    const updates: { team: TeamWithRating; newSRS: number }[] = [];

    teams.forEach(team => {
      let totalOpponentRating = 0;
      let opponentCount = 0;

      team.games.forEach(game => {
        const opponent = teamMap.get(game.opponent);
        if (opponent) {
          totalOpponentRating += opponent.srsRating;
          opponentCount++;
        }
      });

      const avgOpponentRating = opponentCount > 0 ? totalOpponentRating / opponentCount : 0;
      const newSRS = team.avgNetRating + avgOpponentRating;

      updates.push({ team, newSRS });

      const change = Math.abs(newSRS - team.srsRating);
      if (change > maxChange) {
        maxChange = change;
      }
    });

    updates.forEach(({ team, newSRS }) => {
      team.srsRating = newSRS;
    });
  }

  return maxChange;
}

// ============================================================================
// PHASE 3: CONTEXTUAL ADJUSTMENTS
// ============================================================================

/**
 * Calculate recency rating with BLOWOUT DAMPENING
 * Games with 20+ point margins are weighted at 50% to avoid garbage time
 * R_recent = Σ(NR_adj_i · W_i · BlowoutWeight_i) / Σ(W_i · BlowoutWeight_i)
 * Weights: 1.0 → 0.1
 */
function calculateRecencyRating(netRatings: number[], games: GameData[]): number {
  const last10Games = games.slice(-10);
  const last10Ratings = netRatings.slice(-10);
  const weights = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  last10Ratings.forEach((nr, idx) => {
    const game = last10Games[idx];
    const baseWeight = weights[last10Ratings.length - 1 - idx] || 0.1;
    
    // Apply blowout dampening
    const isBlowout = Math.abs(game.margin) > BLOWOUT_MARGIN;
    const blowoutWeight = isBlowout ? BLOWOUT_WEIGHT : 1.0;
    
    const finalWeight = baseWeight * blowoutWeight;
    
    weightedSum += nr * finalWeight;
    totalWeight += finalWeight;
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate injury adjustment with TIERED REPLACEMENT SYSTEM
 * Stars (BPM > 5): Replaced by decent backups (BPM = 0)
 * Starters (0 ≤ BPM ≤ 5): Replaced by average backups (BPM = -2)
 * Bench (BPM < 0): Replaced by deep bench (BPM = -4)
 * 
 * Adj_injury = Σ((BPM_player - REPLACEMENT_BPM_tier) × MPG_player/48) × INJURY_DAMPING
 */
function calculateInjuryAdjustment(injuries: PlayerInjury[]): number {
  let adjustment = 0;
  
  injuries.forEach(injury => {
    if (injury.status.toUpperCase() === 'OUT' && injury.bpm && injury.mpg) {
      // Determine replacement tier based on player quality
      let replacementBPM: number;
      
      if (injury.bpm > 5) {
        replacementBPM = REPLACEMENT_BPM_STAR;  // Stars get decent backups
      } else if (injury.bpm >= 0) {
        replacementBPM = REPLACEMENT_BPM_STARTER;  // Starters get average backups
      } else {
        replacementBPM = REPLACEMENT_BPM_BENCH;  // Bench gets deep bench
      }
      
      const impact = (injury.bpm - replacementBPM) * (injury.mpg / 48);
      adjustment += impact;
    }
  });
  
  return adjustment * INJURY_DAMPING;
}

/**
 * Calculate rest adjustment with EXPANDED SCHEDULE RULES
 * - Back-to-back at home: -0.5
 * - Back-to-back away: -1.5
 * - 3rd game in 4 nights: -2.0
 * - 4th game in 5 nights: -4.0 (death schedule)
 */
function calculateRestAdjustment(game: GameData): number {
  // Check for death schedule first (most severe)
  if (game.gamesInLast5Days && game.gamesInLast5Days >= 4) {
    return REST_4_IN_5;
  }
  
  // Check for 3 in 4 nights
  if (game.gamesInLast4Days && game.gamesInLast4Days >= 3) {
    return REST_3_IN_4;
  }
  
  // Check for back-to-back
  if (game.isBackToBack || game.daysRest === 0) {
    return game.isHome ? REST_B2B_HOME : REST_B2B_AWAY;
  }
  
  return 0;
}

/**
 * Calculate average pace for a team
 */
function calculateAveragePace(games: GameData[]): number {
  let totalPace = 0;
  let count = 0;
  
  games.forEach(game => {
    if (game.boxScore) {
      const possessions = calculatePossessions(game.boxScore);
      totalPace += possessions;
      count++;
    }
  });
  
  return count > 0 ? totalPace / count : 100; // Default to 100 if no data
}

// ============================================================================
// PHASE 4: GAME PREDICTION
// ============================================================================

/**
 * Predict pace for a matchup
 * P_pred = (AvgPace_Home + AvgPace_Away) / 2
 */
function predictPace(homePace: number, awayPace: number): number {
  return (homePace + awayPace) / 2;
}

/**
 * Calculate projected spread
 * Gap_net = TPR_Home - TPR_Away + HCA_NET
 * Spread_proj = (Gap_net / 100) × P_pred
 */
function calculateProjectedSpread(homeTPR: number, awayTPR: number, predictedPace: number): number {
  const gapNet = homeTPR - awayTPR + HCA_NET;
  return (gapNet / 100) * predictedPace;
}

// ============================================================================
// PHASE 5: ATS PROBABILITY
// ============================================================================

/**
 * Calculate probability of covering the spread
 * Z = (Spread_proj - Spread_market) / STD_DEV
 * Prob_cover = CDF(Z)
 */
function calculateCoverProbability(projectedSpread: number, marketSpread: number): number {
  const z = (projectedSpread - marketSpread) / STD_DEV;
  return normalCDF(z);
}

/**
 * Standard normal CDF approximation
 */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

// ============================================================================
// PHASE 6: MARKET EXECUTION
// ============================================================================

/**
 * Convert American odds to implied probability
 */
function americanOddsToImpliedProb(odds: number): number {
  if (odds < 0) {
    return -odds / (-odds + 100);
  } else {
    return 100 / (odds + 100);
  }
}

/**
 * Calculate edge
 * Edge = Prob_cover - Prob_market
 */
function calculateEdge(coverProb: number, marketProb: number): number {
  return coverProb - marketProb;
}

/**
 * Calculate stake using Quarter Kelly with HARD CAP
 * Stake% = ((DecimalOdds - 1) · Prob_cover - (1 - Prob_cover)) / (DecimalOdds - 1) × 0.25
 * 
 * HARD LIMITS:
 * - Never exceed 5% of bankroll (MAX_BET_SIZE)
 * - Recommended max is 3% for safety
 */
function calculateKellyStake(coverProb: number, decimalOdds: number, useConservative: boolean = true): number {
  const numerator = (decimalOdds - 1) * coverProb - (1 - coverProb);
  const denominator = decimalOdds - 1;
  const fullKelly = numerator / denominator;
  const quarterKelly = fullKelly * 0.25;
  
  // Apply hard cap
  const maxBet = useConservative ? RECOMMENDED_MAX_BET : MAX_BET_SIZE;
  
  return Math.max(0, Math.min(quarterKelly, maxBet));
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

export async function POST() {
  try {
    console.log('🔢 Starting Complete Power Ratings Calculation...');

    // Step 1: Fetch all teams from Firestore
    console.log('📥 Fetching teams from Firestore...');
    const teamsSnapshot = await db.collection('nba_team_stats').get();
    
    if (teamsSnapshot.empty) {
      throw new Error('No team data found. Please run "Sync All Teams" first.');
    }

    const teams: TeamStats[] = teamsSnapshot.docs.map(doc => doc.data() as TeamStats);
    console.log(`✅ Loaded ${teams.length} teams`);

    // ========================================================================
    // PHASE 1: DATA NORMALIZATION
    // ========================================================================
    console.log('\n📊 PHASE 1: Calculating Net Ratings with Possessions...');
    
    const teamsWithNetRatings: TeamWithRating[] = teams.map(team => {
      const netRatings: number[] = [];
      
      team.games.forEach(game => {
        // Calculate possessions (use fallback if boxScore missing)
        const possessions = game.boxScore 
          ? calculatePossessions(game.boxScore)
          : calculatePossessionsFallback(game.boxScore || {});
        
        // Calculate raw net rating
        const rawNetRating = calculateRawNetRating(
          game.teamScore, 
          game.opponentScore, 
          possessions
        );
        
        // Apply location adjustment
        const adjustedNetRating = adjustForLocation(rawNetRating, game.isHome);
        
        netRatings.push(adjustedNetRating);
      });

      const avgNetRating = netRatings.length > 0
        ? netRatings.reduce((sum, nr) => sum + nr, 0) / netRatings.length
        : 0;

      // Calculate average pace
      const avgPace = calculateAveragePace(team.games);

      return {
        ...team,
        netRatings,
        avgNetRating,
        srsRating: avgNetRating,
        recencyRating: 0,
        blendedRating: 0,
        injuryAdjustment: 0,
        restAdjustment: 0,
        finalTPR: 0,
        injuries: [],
        avgPace,
      };
    });

    console.log('✅ Net Ratings calculated with possession estimates');

    // ========================================================================
    // PHASE 2: RECURSIVE SRS CALCULATION
    // ========================================================================
    console.log('\n🔄 PHASE 2: Running Recursive SRS Algorithm...');
    
    const convergence = calculateSRS(teamsWithNetRatings);
    console.log(`✅ SRS converged (max change: ${convergence.toFixed(6)})`);

    // ========================================================================
    // PHASE 3: CONTEXTUAL ADJUSTMENTS
    // ========================================================================
    console.log('\n🎯 PHASE 3: Calculating Contextual Adjustments...');
    
    // Fetch injury data from ESPN
    console.log('🏥 Fetching injury data from ESPN...');
    const injuryData: Map<string, PlayerInjury[]> = new Map();
    
    try {
      const injuryResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?enable=injuries');
      
      if (injuryResponse.ok) {
        const data = await injuryResponse.json();
        
        data.sports?.[0]?.leagues?.[0]?.teams?.forEach((teamData: any) => {
          const team = teamData.team;
          const injuries = team.injuries || [];
          
          const outPlayers: PlayerInjury[] = injuries
            .filter((inj: any) => inj.status?.toUpperCase() === 'OUT')
            .map((inj: any) => ({
              name: inj.athlete?.displayName || 'Unknown',
              status: inj.status,
              bpm: inj.bpm,
              mpg: inj.mpg,
            }));
          
          if (outPlayers.length > 0) {
            injuryData.set(team.displayName, outPlayers);
          }
        });
        
        console.log(`✅ Fetched injuries for ${injuryData.size} teams`);
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch injury data, continuing without it');
    }

    // Apply contextual adjustments
    teamsWithNetRatings.forEach(team => {
      // Recency rating with blowout dampening
      team.recencyRating = calculateRecencyRating(team.netRatings, team.games);
      
      // Blended rating
      team.blendedRating = (team.srsRating * WEIGHT_SEASON) + (team.recencyRating * WEIGHT_RECENCY);
      
      // Injury adjustment with tiered replacement system
      const teamInjuries = injuryData.get(team.teamName) || [];
      team.injuries = teamInjuries;
      team.injuryAdjustment = calculateInjuryAdjustment(teamInjuries);
      
      // Rest adjustment (will be calculated per-game when predicting)
      // For now, calculate average rest penalty across recent games
      const recentGames = team.games.slice(-10);
      let avgRestPenalty = 0;
      recentGames.forEach(game => {
        avgRestPenalty += calculateRestAdjustment(game);
      });
      team.restAdjustment = recentGames.length > 0 ? avgRestPenalty / recentGames.length : 0;
      
      // Final TPR (baseline)
      team.finalTPR = team.blendedRating - team.injuryAdjustment + team.restAdjustment;
    });

    console.log('✅ Contextual adjustments complete');

    // ========================================================================
    // SAVE RESULTS TO FIRESTORE
    // ========================================================================
    console.log('\n💾 Saving Power Ratings to Firestore...');
    
    const batch = db.batch();

    teamsWithNetRatings.forEach(team => {
      const teamRef = db.collection('nba_team_stats').doc(team.abbreviation);
      batch.update(teamRef, {
        'powerRatings': {
          avgNetRating: team.avgNetRating,
          srsRating: team.srsRating,
          recencyRating: team.recencyRating,
          blendedRating: team.blendedRating,
          injuryAdjustment: team.injuryAdjustment,
          baselineTPR: team.finalTPR,
          avgPace: team.avgPace,
          calculatedAt: new Date().toISOString(),
        },
        'injuries': team.injuries,
      });
    });

    await batch.commit();
    console.log('✅ Power Ratings saved to Firestore');

    // ========================================================================
    // RETURN RESULTS
    // ========================================================================
    const sortedTeams = [...teamsWithNetRatings].sort((a, b) => b.finalTPR - a.finalTPR);

    return NextResponse.json({
      success: true,
      message: `Calculated power ratings for ${teams.length} teams`,
      convergence: convergence,
      injuriesFound: injuryData.size,
      topTeams: sortedTeams.slice(0, 5).map(t => ({
        team: t.teamName,
        tpr: t.finalTPR.toFixed(2),
        srs: t.srsRating.toFixed(2),
        recency: t.recencyRating.toFixed(2),
        blended: t.blendedRating.toFixed(2),
        injuries: t.injuryAdjustment.toFixed(2),
        pace: t.avgPace.toFixed(1),
      })),
      bottomTeams: sortedTeams.slice(-5).map(t => ({
        team: t.teamName,
        tpr: t.finalTPR.toFixed(2),
        srs: t.srsRating.toFixed(2),
        recency: t.recencyRating.toFixed(2),
        blended: t.blendedRating.toFixed(2),
        injuries: t.injuryAdjustment.toFixed(2),
        pace: t.avgPace.toFixed(1),
      })),
    });

  } catch (error: any) {
    console.error('❌ Calculation error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}