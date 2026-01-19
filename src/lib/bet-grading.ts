'use client';

import { collection, doc, getDocs, query, where, writeBatch, Firestore, User, increment } from 'firebase/firestore';
import type { CompletedGame, UserBet } from './types';

const gradeMoneyline = (bet: Pick<UserBet, 'pick'>, game: CompletedGame): 'won' | 'lost' => {
  const isHomePick = bet.pick === game.homeTeam;
  const isAwayPick = bet.pick === game.awayTeam;
  
  if (isHomePick && game.homeScore > game.awayScore) return 'won';
  if (isAwayPick && game.awayScore > game.homeScore) return 'won';
  
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
    
    // --- PARLAY GRADING LOGIC ---
    if (bet.betType === 'parlay' && bet.legs) {
        let overallParlayStatus: UserBet['status'] = 'won'; // Assume won until a loss is found
        let activePushLegs = 0;

        const updatedLegs = bet.legs.map(leg => {
            const game = completedGames.get(leg.gameId);
            if (!game) {
                overallParlayStatus = 'pending';
                return leg;
            }

            let legStatus: UserBet['status'] = 'lost';
            const legAsBetForGrading = { pick: leg.pick };

            switch(leg.betType) {
                case 'moneyline':
                    legStatus = gradeMoneyline(legAsBetForGrading, game);
                    break;
                case 'total':
                    legStatus = gradeTotal(legAsBetForGrading, game);
                    break;
                case 'spread':
                    legStatus = gradeSpread(legAsBetForGrading, game);
                    break;
            }

            if (legStatus === 'lost') {
                overallParlayStatus = 'lost';
            }
            if (legStatus === 'push') {
                activePushLegs++;
            }

            return { ...leg, status: legStatus };
        });

        if (updatedLegs.some(leg => leg.status === 'pending')) {
            overallParlayStatus = 'pending';
        }

        if (overallParlayStatus === 'pending') {
            return;
        }

        if (activePushLegs === bet.legs.length) {
            overallParlayStatus = 'push';
        }

        batch.update(betDoc.ref, { status: overallParlayStatus, legs: updatedLegs });
        gradedCount++;
        
        if (overallParlayStatus === 'won') {
            // TODO: In a real app, recalculate odds if there were pushes. For now, pay out full amount.
            totalPayout += bet.potentialWinnings;
        } else if (overallParlayStatus === 'push') {
            totalPayout += bet.stake;
        }
        
        return; // Done with this parlay, move to the next bet
    }

    // --- SINGLE BET GRADING LOGIC (existing) ---
    const game = completedGames.get(bet.gameId);

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
    
    batch.update(betDoc.ref, { status: newStatus });
    gradedCount++;

    if (newStatus === 'won') {
      totalPayout += bet.potentialWinnings;
    } else if (newStatus === 'push') {
        totalPayout += bet.stake;
    }
  });

  if (totalPayout > 0) {
    const userRef = doc(firestore, 'users', user.uid);
    batch.update(userRef, { balance: increment(totalPayout) });
  }

  if (gradedCount > 0) {
    await batch.commit();
    console.log(`Graded ${gradedCount} bets. Total payout applied: ${totalPayout.toFixed(2)} coins.`);
  } else {
    console.log("Found pending bets, but no matching completed games to grade them against yet.")
  }
}
