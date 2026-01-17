'use client';

import { collection, doc, getDocs, query, where, writeBatch, Firestore, User, increment } from 'firebase/firestore';
import type { CompletedGame, UserBet } from './types';

const gradeMoneyline = (bet: UserBet, game: CompletedGame): 'won' | 'lost' => {
  const isHomePick = bet.pick === game.homeTeam;
  const isAwayPick = bet.pick === game.awayTeam;
  
  if (isHomePick && game.homeScore > game.awayScore) return 'won';
  if (isAwayPick && game.awayScore > game.homeScore) return 'won';
  
  // Also check for ties in sports where that is possible (e.g., soccer)
  // This simple example assumes no ties for moneyline.
  
  return 'lost';
};

const gradeTotal = (bet: UserBet, game: CompletedGame): 'won' | 'lost' | 'push' => {
    const totalPoints = game.homeScore + game.awayScore;
    const [pickType, pointsStr] = bet.pick.split(' ');
    const points = parseFloat(pointsStr);

    if (totalPoints === points) return 'push';
    if (pickType.toLowerCase() === 'over' && totalPoints > points) return 'won';
    if (pickType.toLowerCase() === 'under' && totalPoints < points) return 'won';

    return 'lost';
};

const gradeSpread = (bet: UserBet, game: CompletedGame): 'won' | 'lost' | 'push' => {
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
 * Grades all pending bets for a given user against a set of completed games.
 * @param firestore The Firestore instance.
 * @param user The authenticated user object.
 */
export async function gradeUserBets(firestore: Firestore, user: User) {
  // 1. Get all completed games from the last 3 days from our database
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

  // 3. Use a write batch to perform all database updates atomically
  const batch = writeBatch(firestore);
  let totalWinnings = 0;
  let gradedCount = 0;

  pendingBetsSnapshot.forEach(betDoc => {
    const bet = betDoc.data() as UserBet;
    const game = completedGames.get(bet.gameId);

    // Only grade if the corresponding game has finished and its score is in our DB
    if (!game) {
      return; 
    }

    let newStatus: UserBet['status'] = 'lost';
    
    switch (bet.betType) {
        case 'moneyline':
            newStatus = gradeMoneyline(bet, game);
            break;
        case 'total':
            newStatus = gradeTotal(bet, game);
            break;
        case 'spread':
            newStatus = gradeSpread(bet, game);
            break;
        default:
             console.warn(`Grading for bet type "${bet.betType}" is not implemented.`);
             return; // Skip this bet
    }
    
    // Stage the update for the bet document
    batch.update(betDoc.ref, { status: newStatus });
    gradedCount++;

    // If the user won, add the winnings to a running total
    if (newStatus === 'won') {
      // The stake is already "spent", so we add the stake back plus the profit
      totalWinnings += bet.stake + bet.potentialWinnings;
    } else if (newStatus === 'push') {
        // If it's a push, just return the original stake
        totalWinnings += bet.stake;
    }
  });

  // 4. If there were any payouts, stage the update for the user's balance
  if (totalWinnings > 0) {
    const userRef = doc(firestore, 'users', user.uid);
    batch.update(userRef, { balance: increment(totalWinnings) });
  }

  // 5. Commit all the updates to Firestore
  if (gradedCount > 0) {
    await batch.commit();
    console.log(`Graded ${gradedCount} bets. Total payout applied: ${totalWinnings.toFixed(2)} coins.`);
  } else {
    console.log("Found pending bets, but no matching completed games to grade them against yet.")
  }
}
