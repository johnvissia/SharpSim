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

// GLOBAL CONSTANTS
const HCA_NET = 2.5; // Home Court Advantage in Net Rating points
const SRS_CONVERGENCE_THRESHOLD = 0.01; // Iteration stops when changes < 0.01
const MAX_ITERATIONS = 100; // Safety limit
const WEIGHT_SEASON = 0.70; // Weight for SRS
const WEIGHT_RECENCY = 0.30; // Weight for last 10 games
const REPLACEMENT_BPM = -2.0; // Replacement player value
const REST_PENALTY_AWAY = -2.5; // Back-to-back away
const REST_PENALTY_HOME = -1.5; // Back-to-back home

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
  };
}

interface TeamWithRating extends TeamStats {
  netRatings: number[]; // Array of adjusted net ratings for each game
  avgNetRating: number; // Average net rating
  srsRating: number; // Final SRS rating after recursion
  recencyRating: number; // Weighted last 10 games
  blendedRating: number; // 70% SRS + 30% Recency
  injuryAdjustment: number; // Injury penalty
  restAdjustment: number; // Rest penalty
  finalTPR: number; // Final Team Power Rating
}

export async function POST() {
  try {
    console.log('🔢 Starting Power Ratings Calculation...');

    // Step 1: Fetch all teams from Firestore
    console.log('📥 Fetching teams from Firestore...');
    const teamsSnapshot = await db.collection('nba_team_stats').get();
    
    if (teamsSnapshot.empty) {
      throw new Error('No team data found. Please run "Sync All Teams" first.');
    }

    const teams: TeamStats[] = teamsSnapshot.docs.map(doc => doc.data() as TeamStats);
    console.log(`✅ Loaded ${teams.length} teams`);

    // PHASE 1: DATA NORMALIZATION
    console.log('\n📊 PHASE 1: Calculating Net Ratings...');
    
    const teamsWithNetRatings: TeamWithRating[] = teams.map(team => {
      const netRatings: number[] = [];
      
      team.games.forEach(game => {
        // Simplified possession estimate (we don't have detailed stats)
        // Using: Points Scored ≈ possessions used
        // For now, we'll use the margin-based approach since we have complete scores
        
        // Calculate raw net rating (point differential per 100 possessions)
        // Estimate possessions as ~100 per game (NBA average)
        const estimatedPossessions = 100;
        const rawNetRating = ((game.teamScore - game.opponentScore) / estimatedPossessions) * 100;
        
        // Location adjustment
        const adjustedNetRating = game.isHome 
          ? rawNetRating - HCA_NET 
          : rawNetRating + HCA_NET;
        
        netRatings.push(adjustedNetRating);
      });

      const avgNetRating = netRatings.length > 0
        ? netRatings.reduce((sum, nr) => sum + nr, 0) / netRatings.length
        : 0;

      return {
        ...team,
        netRatings,
        avgNetRating,
        srsRating: avgNetRating, // Initialize SRS with average net rating
      };
    });

    console.log('✅ Net Ratings calculated for all teams');

    // PHASE 2: RECURSIVE SRS CALCULATION
    console.log('\n🔄 PHASE 2: Running Recursive SRS Algorithm...');
    
    // Create a map for quick lookup
    const teamMap = new Map<string, TeamWithRating>();
    teamsWithNetRatings.forEach(team => {
      teamMap.set(team.teamName, team);
    });

    let iteration = 0;
    let maxChange = Infinity;

    while (maxChange > SRS_CONVERGENCE_THRESHOLD && iteration < MAX_ITERATIONS) {
      iteration++;
      maxChange = 0;

      // For each team, calculate new SRS based on opponent ratings
      const updates: { team: TeamWithRating; newSRS: number }[] = [];

      teamsWithNetRatings.forEach(team => {
        let totalOpponentRating = 0;
        let opponentCount = 0;

        // Sum up current SRS ratings of all opponents
        team.games.forEach(game => {
          const opponent = teamMap.get(game.opponent);
          if (opponent) {
            totalOpponentRating += opponent.srsRating;
            opponentCount++;
          }
        });

        const avgOpponentRating = opponentCount > 0 
          ? totalOpponentRating / opponentCount 
          : 0;

        // SRS = Own Net Rating + Average Opponent Rating
        const newSRS = team.avgNetRating + avgOpponentRating;

        updates.push({ team, newSRS });

        // Track maximum change for convergence check
        const change = Math.abs(newSRS - team.srsRating);
        if (change > maxChange) {
          maxChange = change;
        }
      });

      // Apply all updates
      updates.forEach(({ team, newSRS }) => {
        team.srsRating = newSRS;
      });

      if (iteration % 10 === 0) {
        console.log(`  Iteration ${iteration}: Max change = ${maxChange.toFixed(4)}`);
      }
    }

    console.log(`✅ SRS converged after ${iteration} iterations (max change: ${maxChange.toFixed(6)})`);

    // PHASE 3: CONTEXTUAL ADJUSTMENTS
    console.log('\n🎯 PHASE 3: Calculating Contextual Adjustments...');
    
    // Calculate Recency Rating for each team
    teamsWithNetRatings.forEach(team => {
      // Get last 10 games
      const last10NetRatings = team.netRatings.slice(-10);
      
      // Weights: 1.0, 0.9, 0.8, ..., 0.1 (for most recent to least recent)
      const weights = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
      const sumWeights = 5.5; // Pre-calculated sum of weights
      
      let weightedSum = 0;
      last10NetRatings.forEach((nr, idx) => {
        const weight = weights[last10NetRatings.length - 1 - idx] || 0.1;
        weightedSum += nr * weight;
      });
      
      team.recencyRating = last10NetRatings.length > 0 
        ? weightedSum / sumWeights 
        : team.avgNetRating;
      
      // Blended Rating
      team.blendedRating = (team.srsRating * WEIGHT_SEASON) + (team.recencyRating * WEIGHT_RECENCY);
      
      // Initialize injury and rest adjustments (will be set per game)
      team.injuryAdjustment = 0;
      team.restAdjustment = 0;
      
      // Final TPR (baseline - will be adjusted per game for injuries/rest)
      team.finalTPR = team.blendedRating;
    });

    console.log('✅ Recency and Blended Ratings calculated');

    // Fetch injury data from ESPN
    console.log('\n🏥 Fetching injury data from ESPN...');
    let injuryData: Map<string, any[]> = new Map();
    
    try {
      // ESPN injury API endpoint
      const injuryResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?enable=injuries');
      
      if (injuryResponse.ok) {
        const data = await injuryResponse.json();
        
        // Parse injury data
        data.sports?.[0]?.leagues?.[0]?.teams?.forEach((teamData: any) => {
          const team = teamData.team;
          const injuries = team.injuries || [];
          
          const outPlayers = injuries.filter((inj: any) => 
            inj.status?.toUpperCase() === 'OUT' || 
            inj.status?.toUpperCase() === 'DOUBTFUL'
          );
          
          if (outPlayers.length > 0) {
            injuryData.set(team.displayName, outPlayers);
          }
        });
        
        console.log(`✅ Fetched injuries for ${injuryData.size} teams`);
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch injury data, continuing without it');
    }

    // Save results to Firestore
    console.log('\n💾 Saving Power Ratings to Firestore...');
    
    const batch = db.batch();

    teamsWithNetRatings.forEach(team => {
      const teamRef = db.collection('nba_team_stats').doc(team.abbreviation);
      batch.update(teamRef, {
        'powerRatings.avgNetRating': team.avgNetRating,
        'powerRatings.srsRating': team.srsRating,
        'powerRatings.recencyRating': team.recencyRating,
        'powerRatings.blendedRating': team.blendedRating,
        'powerRatings.baselineTPR': team.finalTPR,
        'powerRatings.calculatedAt': new Date().toISOString(),
      });
    });

    await batch.commit();
    console.log('✅ Power Ratings saved to Firestore');

    // Sort teams by TPR for display
    const sortedTeams = [...teamsWithNetRatings].sort((a, b) => b.finalTPR - a.finalTPR);

    return NextResponse.json({
      success: true,
      message: `Calculated power ratings for ${teams.length} teams`,
      iterations: iteration,
      convergence: maxChange,
      injuriesFound: injuryData.size,
      topTeams: sortedTeams.slice(0, 5).map(t => ({
        team: t.teamName,
        tpr: t.finalTPR.toFixed(2),
        srs: t.srsRating.toFixed(2),
        recency: t.recencyRating.toFixed(2),
        blended: t.blendedRating.toFixed(2),
      })),
      bottomTeams: sortedTeams.slice(-5).map(t => ({
        team: t.teamName,
        tpr: t.finalTPR.toFixed(2),
        srs: t.srsRating.toFixed(2),
        recency: t.recencyRating.toFixed(2),
        blended: t.blendedRating.toFixed(2),
      })),
    });

  } catch (error: any) {
    console.error('❌ Calculation error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}