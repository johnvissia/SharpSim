// src/app/api/calculate-power-ratings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  applyBayesianShrinkage,
  calculateDecayWeight,
  calculateAdjustedMargin,
  getRecencyWeight,
} from '@/lib/math-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes

// ============================================================================
// GLOBAL CONSTANTS (UPDATED WITH IMPROVEMENTS)
// ============================================================================
const HCA_BASE = 1.8;  // UPDATED: Lowered base HCA for dynamic calculation
const HCA_NET = 1.8;   // UPDATED: Base value, will be adjusted dynamically
const STD_DEV = 11.0;
const INJURY_DAMPING = 0.75;
// WEIGHT_SEASON and WEIGHT_RECENCY are now DYNAMIC - see getRecencyWeight()
const SRS_CONVERGENCE_THRESHOLD = 0.01;
const MAX_ITERATIONS = 100;
const BAYESIAN_PADDING_GAMES = 10; // For early-season stabilization

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
  injuries?: any[]; // Added to support stored injuries from Firestore
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
  teamHCA: number;
}

// ============================================================================
// PHASE 1: DATA NORMALIZATION (PACE & EFFICIENCY)
// ============================================================================

/**
 * Calculate game possessions using the primary formula
 * P = 0.5 × ((Tm_FGA + 0.4·Tm_FTA - 1.07·(Tm_ORB/(Tm_ORB + Opp_DRB))·(Tm_FGA - Tm_FG) + Tm_TOV) + (Opp_FGA + ...))
 */
function calculatePossessions(box: BoxScore): number {
  const teamRebounds = box.ORB + box.oppDRB;
  const orbFactor = teamRebounds === 0 ? 0 : box.ORB / teamRebounds;
  const teamPoss = box.FGA + 0.4 * box.FTA - 1.07 * orbFactor * (box.FGA - box.FG) + box.TOV;

  const oppRebounds = box.oppORB + box.teamDRB;
  const oppOrbFactor = oppRebounds === 0 ? 0 : box.oppORB / oppRebounds;
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
 * Calculate Raw Net Rating with Soft Cap for Blowouts
 * NR_raw = 100 × (CappedPointsDiff) / Possessions
 */
function calculateRawNetRating(pointsScored: number, pointsAllowed: number, possessions: number): number {
  const diff = pointsScored - pointsAllowed;
  const cappedDiff = calculateAdjustedMargin(diff); // Apply soft cap at 25 points
  return 100 * (cappedDiff) / possessions;
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
  teams.forEach(team => teamMap.set(team.abbreviation, team));

  let iteration = 0;
  let maxChange = Infinity;

  while (maxChange > SRS_CONVERGENCE_THRESHOLD && iteration < MAX_ITERATIONS) {
    iteration++;
    maxChange = 0;

    const updates: { team: TeamWithRating; newSRS: number }[] = [];

    teams.forEach(team => {
      let totalOpponentRating = 0;
      let opponentCount = 0;

      (team.games || []).forEach(game => {
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
      // Apply Bayesian shrinkage to stabilize early-season ratings
      const shrunkSRS = applyBayesianShrinkage(
        newSRS,
        team.games.length,
        0, // League average net rating
        BAYESIAN_PADDING_GAMES
      );
      team.srsRating = shrunkSRS;
    });
  }

  return maxChange;
}

// ============================================================================
// PHASE 3: CONTEXTUAL ADJUSTMENTS
// ============================================================================

/**
 * Calculate recency rating with EXPONENTIAL DECAY and SOFT MARGIN CAP
 * Uses exponential decay for smoother weighting and logarithmic blowout dampening
 * R_recent = Σ(NR_adj_i · exp(-λ·i)) / Σ(exp(-λ·i))
 */
function calculateRecencyRating(netRatings: number[], games: GameData[]): number {
  const last10Games = games.slice(-10);
  const last10Ratings = netRatings.slice(-10);

  let weightedSum = 0;
  let totalWeight = 0;

  last10Ratings.forEach((nr, idx) => {
    const game = last10Games[idx];

    // Use exponential decay instead of linear weights
    const gamesAgo = last10Ratings.length - 1 - idx;
    const decayWeight = calculateDecayWeight(gamesAgo);

    // Apply soft margin cap to the net rating itself
    const adjustedMargin = calculateAdjustedMargin(game.margin);

    // Recalculate net rating with adjusted margin
    // This is an approximation - we're adjusting the margin component
    const marginDiff = adjustedMargin - game.margin;
    const adjustedNR = nr + marginDiff; // Approximate adjustment

    weightedSum += adjustedNR * decayWeight;
    totalWeight += decayWeight;
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
    const status = injury.status?.toUpperCase() || '';
    if (
      (status.includes('OUT') || status.includes('INJURED') || status.includes('DOUBTFUL') || status.includes('QUESTIONABLE')) &&
      injury.bpm && injury.mpg
    ) {
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

/**
 * Calculate team-specific Home Court Advantage
 * HCA_team = Home Net Rating - Away Net Rating
 * Clamped between 0.5 and 3.5 points
 */
function calculateTeamSpecificHCA(games: GameData[]): number {
  const homeGames = games.filter(g => g.isHome);
  const awayGames = games.filter(g => !g.isHome);

  if (homeGames.length < 3 || awayGames.length < 3) {
    return HCA_NET; // Default if insufficient data
  }

  // Calculate average margin at home vs away
  const homeMargin = homeGames.reduce((sum, g) => sum + g.margin, 0) / homeGames.length;
  const awayMargin = awayGames.reduce((sum, g) => sum + g.margin, 0) / awayGames.length;

  const teamHCA = homeMargin - awayMargin;

  // Clamp between 0.5 and 3.5
  return Math.max(0.5, Math.min(3.5, teamHCA));
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

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    // Auth check (if CRON_SECRET is configured)
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

      (team.games || []).forEach(game => {
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

      // Calculate team-specific HCA
      const teamHCA = calculateTeamSpecificHCA(team.games);

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
        teamHCA,
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

    // Fetch injury data from Firestore (already loaded in step 1)
    console.log('🏥 Using stored injury data from Firestore...');
    const injuryData: Map<string, PlayerInjury[]> = new Map();

    teams.forEach(team => {
      if (team.injuries && team.injuries.length > 0) {
        // Map stored injuries to calculation format
        // Note: Tank01 doesnt give BPM directly, we might need a lookup or default
        // For now, we will use a naive approach: if status is OUT/Injured, treat as significant if we can match a name
        // Or updated approach: The new service stores them. We need to map them to BPM if possible.
        // Wait, the previous code relied on ESPN BPM. Tank01 doesn't have it.
        // We need a way to estimate impact.
        // For now, let's just log them and maybe use a default high impact for known stars if possible, or just count them.

        // Actually, the new service stores them in 'injuries' field.
        // We will filter for 'active' vs 'out'.

        const outPlayers = team.injuries.filter(inj => {
          if (!inj.status || !inj.description) return false;

          const status = inj.status.toLowerCase();
          const desc = inj.description.toLowerCase();

          const isOut = status.includes('out') || status.includes('injured') || status.includes('doubtful') || status.includes('questionable');

          // ONLY include Season-Ending or long-term injuries in the Base Model Ratings
          const isSeasonEnding = desc.includes('surgery') || desc.includes('season') || desc.includes('achilles') || desc.includes('acl') || desc.includes('torn');

          return isOut && isSeasonEnding;
        }).map(inj => {
          // Adjust impact based on probability of playing
          let statusFactor = 1.0;
          if (inj.status.toLowerCase().includes('questionable')) statusFactor = 0.5;
          if (inj.status.toLowerCase().includes('doubtful')) statusFactor = 0.9;

          return {
            name: inj.name,
            status: inj.status,
            bpm: 2.0 * statusFactor, // Simplified bpm * status factor
            mpg: 30.0 // Default MPG
          };
        });

        if (outPlayers.length > 0) {
          injuryData.set(team.teamName, outPlayers);
        }
      }
    });

    console.log(`✅ Loaded injuries for ${injuryData.size} teams from Firestore`);

    // Apply contextual adjustments (First Pass: raw values)
    teamsWithNetRatings.forEach(team => {
      // Recency rating with exponential decay and soft margin cap
      team.recencyRating = calculateRecencyRating(team.netRatings, team.games);

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
    });

    // ── VARIANCE NORMALIZATION FOR RECENCY ──
    // Recency has a much wider variance than SRS. We scale Recency into the SRS distribution.
    const srsValues = teamsWithNetRatings.map(t => t.srsRating);
    const recValues = teamsWithNetRatings.map(t => t.recencyRating);
    
    const srsMean = srsValues.reduce((sum, val) => sum + val, 0) / srsValues.length;
    const recMean = recValues.reduce((sum, val) => sum + val, 0) / recValues.length;
    
    const srsStd = Math.sqrt(srsValues.reduce((sq, val) => sq + Math.pow(val - srsMean, 2), 0) / srsValues.length);
    const recStd = Math.sqrt(recValues.reduce((sq, val) => sq + Math.pow(val - recMean, 2), 0) / recValues.length);

    const W_SRS = 0.70;
    const W_REC = 0.30;

    // Second Pass: Normalize, Blend, and Finalize
    teamsWithNetRatings.forEach(team => {
      // Normalize recency to match SRS variance
      const zRecency = recStd > 0 ? (team.recencyRating - recMean) / recStd : 0;
      const normalizedRecency = srsMean + (zRecency * srsStd);

      // Assign normalized value so it is displayed sensibly in the UI
      team.recencyRating = normalizedRecency;

      // Static blended rating
      team.blendedRating = (team.srsRating * W_SRS) + (normalizedRecency * W_REC);
      
      // Negative Base Constraint
      if (team.srsRating < 0 && team.blendedRating > team.srsRating) {
         // Caps the maximum points a sub-zero team can gain from a hot streak at +1.5
         team.blendedRating = Math.min(team.blendedRating, team.srsRating + 1.5);
      }

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
          homeCourtAdvantage: team.teamHCA,
          calculatedAt: new Date().toISOString(),
        }
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
      topTeams: sortedTeams.slice(0, 10).map(t => ({
        team: t.teamName,
        abbreviation: t.abbreviation,
        logo: `https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${t.abbreviation}.png`,
        tpr: t.finalTPR.toFixed(2),
        srs: t.srsRating.toFixed(2),
        recency: t.recencyRating.toFixed(2),
        blended: t.blendedRating.toFixed(2),
        injuries: t.injuryAdjustment.toFixed(2),
        rest: t.restAdjustment.toFixed(2),
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