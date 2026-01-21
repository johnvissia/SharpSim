'use client';

import { collection, doc, getDocs, query, where, writeBatch, Firestore, User, increment } from 'firebase/firestore';
import type { CompletedGame, UserBet, ParlayLeg } from './types';

const gradeMoneyline = (bet: Pick<UserBet, 'pick'>, game: CompletedGame): 'won' | 'lost' => {
  const isHomePick = bet.pick === game.homeTeam;
  const isAwayPick = bet.pick === game.awayTeam;
  
  if (isHomePick && game.homeScore > game.awayScore) return 'won';
  if (isAwayPick && game.awayScore > game.homeScore) return 'won';
  
  // Tie is a loss for moneyline
  return 'lost';
};

const gradeTotal = (bet: Pick<UserBet, 'pick'>, game: CompletedGame): 'won' | 'lost' | 'push' => {
    const totalPoints = game.homeScore + game.awayScore;
    const [pickType, pointsStr] = bet.pick.split(' ');
    const points = parseFloat(pointsStr);

    if (totalPoints === points) return 'push';
    if (pickType.toLowerCase() === 'over' && totalPoints > points) return 'won';
    if (pickType.toLowerCase() === 'under' && totalPoints < points) return 'won';

    return 'lost';
};

const gradeSpread = (bet: Pick<UserBet, 'pick'>, game: CompletedGame): 'won' | 'lost' | 'push' => {
  const lastSpaceIndex = bet.pick.lastIndexOf(' ');
  const teamName = bet.pick.substring(0, lastSpaceIndex).trim();
  const points = parseFloat(bet.pick.substring(lastSpaceIndex + 1));

  let cover = 0;
  if (teamName === game.homeTeam) {
      cover = game.homeScore - game.awayScore;
  } else if (teamName === game.awayTeam) {
      cover = game.awayScore - game.homeScore;
  } else {
      console.warn(`Picked team "${teamName}" does not match teams in game ${game.id}.`);
      return 'lost'; // Picked team doesn't match game
  }

  if (cover + points > 0) return 'won';
  if (cover + points < 0) return 'lost';
  return 'push';
};

/**
 * A helper function that calculates the result of a single bet or leg.
 * @param leg The bet leg to grade.
 * @param game The completed game data.
 * @returns The result of the leg ('won', 'lost', or 'push').
 */
const calculateLegResult = (leg: Pick<ParlayLeg, 'pick' | 'betType'>, game: CompletedGame): 'won' | 'lost' | 'push' => {
  switch (leg.betType) {
    case 'moneyline':
      return gradeMoneyline({ pick: leg.pick }, game);
    case 'spread':
      return gradeSpread({ pick: leg.pick }, game);
    case 'total':
      return gradeTotal({ pick: leg.pick }, game);
    default:
      console.warn(`Grading for leg bet type "${leg.betType}" is not implemented.`);
      return 'lost';
  }
};


/**
 * Grades all pending bets for a given user against a set of completed games.
 * @param firestore The Firestore instance.
 * @param user The authenticated user object.
 */
export async function gradeUserBets(firestore: Firestore, user: User) {
  // 1. Get all completed games from our database
  const completedGamesSnapshot = await getDocs(collection(firestore, 'completed_games'));
  const completedGames = new Map<string, CompletedGame>();
  completedGamesSnapshot.forEach(doc => {
    const game = doc.data() as CompletedGame;
    completedGames.set(game.id, game);
  });
  
  if (completedGames.size === 0) {
    console.log("No completed games found in Firestore to grade bets against.");
    return;
  }

  // 2. Get the current user's pending bets
  const betsRef = collection(firestore, 'users', user.uid, 'bets');
  const q = query(betsRef, where('status', '==', 'pending'));
  const pendingBetsSnapshot = await getDocs(q);

  if (pendingBetsSnapshot.empty) {
    console.log("No pending bets to grade for this user.");
    return;
  }

  const batch = writeBatch(firestore);
  let totalPayout = 0;
  let gradedCount = 0;

  pendingBetsSnapshot.forEach(betDoc => {
    const bet = betDoc.data() as UserBet;
    
    // Create a unified list of legs to process for both single bets and parlays
    const legsToProcess: ParlayLeg[] = bet.legs ? bet.legs : [
        {
            gameId: bet.gameId,
            matchup: bet.matchup || 'N/A',
            commenceTime: bet.commenceTime || new Date(0).toISOString(),
            pick: bet.pick,
            betType: bet.betType as Exclude<UserBet['betType'], 'parlay'>,
            odds: bet.odds,
            status: bet.status,
            sport: bet.sport,
        }
    ];

    let isFinalized = true;
    let hasLostLeg = false;
    let pushCount = 0;
    let betChanged = false;

    const updatedLegs = legsToProcess.map(leg => {
        // If leg is already settled, just account for its status
        if (leg.status !== 'pending') {
            if (leg.status === 'lost') hasLostLeg = true;
            if (leg.status === 'push') pushCount++;
            return leg;
        }

        // Find the completed game for the current leg
        const game = completedGames.get(leg.gameId);

        // If game isn't completed yet, the whole bet remains pending
        if (!game) {
            isFinalized = false;
            return leg;
        }

        // Game is completed, so grade the leg
        const newLegStatus = calculateLegResult(leg, game);
        betChanged = true; // A leg's status has changed from pending

        if (newLegStatus === 'lost') hasLostLeg = true;
        if (newLegStatus === 'push') pushCount++;
        
        return { ...leg, status: newLegStatus };
    });

    // If the bet isn't fully finalized (some legs are still pending)
    if (!isFinalized) {
        // For parlays, if any leg was updated, we update the legs array to show progress
        if (bet.betType === 'parlay' && betChanged) {
            batch.update(betDoc.ref, { legs: updatedLegs });
        }
        return; // Move to the next bet
    }

    // If we reach here, all games in the bet have finished. We can set a final status.
    let finalStatus: UserBet['status'];
    if (hasLostLeg) {
        finalStatus = 'lost';
    } else if (pushCount === updatedLegs.length) {
        finalStatus = 'push'; // All legs were pushes
    } else {
        finalStatus = 'won'; // No losses, and at least one win
    }

    // Prepare update payload
    const updatePayload: { status: UserBet['status'], legs?: ParlayLeg[] } = { status: finalStatus };
    if (bet.betType === 'parlay') {
        updatePayload.legs = updatedLegs;
    }
    
    batch.update(betDoc.ref, updatePayload);
    gradedCount++;
    
    // Calculate payout
    if (finalStatus === 'won') {
        // For simulation, we pay out the full amount even if there are pushes.
        // A real app would recalculate odds.
        totalPayout += bet.potentialWinnings;
    } else if (finalStatus === 'push') {
        totalPayout += bet.stake; // Return the original stake
    }
  });

  // Apply balance update if there are any payouts
  if (totalPayout > 0) {
    const userRef = doc(firestore, 'users', user.uid);
    batch.update(userRef, { balance: increment(totalPayout) });
  }

  // Commit all the changes to Firestore if anything was graded
  if (gradedCount > 0) {
    await batch.commit();
    console.log(`Graded ${gradedCount} bets. Total payout applied: ${totalPayout.toFixed(2)} coins.`);
  } else if (pendingBetsSnapshot.size > 0) {
    console.log("Found pending bets, but their games may not be completed yet or leg statuses were already updated.")
  }
}
