'use client';

import { collection, doc, getDocs, query, where, writeBatch, Firestore, User, increment } from 'firebase/firestore';
import type { CompletedGame, UserBet, ParlayLeg } from './types';

// Helper to extract team name from a pick.
function getTeamFromPick(pick: string, betType: UserBet['betType']): string | null {
    if (betType === 'total' || betType === 'player_prop') return null;
    if (betType === 'moneyline') return pick;
    if (betType === 'spread') {
        const lastSpaceIndex = pick.lastIndexOf(' ');
        if (lastSpaceIndex === -1) return pick; // Fallback for weirdly formatted picks
        return pick.substring(0, lastSpaceIndex).trim();
    }
    return null;
}

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
export const calculateLegResult = (leg: Pick<ParlayLeg, 'pick' | 'betType'>, game: CompletedGame): 'won' | 'lost' | 'push' => {
  switch (leg.betType) {
    case 'moneyline':
      return gradeMoneyline({ pick: leg.pick }, game);
    case 'spread':
      return gradeSpread({ pick: leg.pick }, game);
    case 'total':
      return gradeTotal({ pick: leg.pick }, game);
    case 'player_prop':
        // For now, player props are not auto-graded. This can be expanded.
        return 'pending' as any; // Should not happen if we only grade completed games
    default:
      console.warn(`Grading for leg bet type "${leg.betType}" is not implemented.`);
      return 'lost';
  }
};


/**
 * Grades all pending bets for a given user against a set of completed games.
 * This is a pure function that returns a list of required updates.
 * @param pendingBets The user's bets that have a 'pending' status.
 * @param completedGamesMap A Map of completed game data, with game ID as the key.
 * @returns An object with an array of bet updates and the total payout to be applied.
 */
export function gradeUserBets(
  pendingBets: UserBet[],
  completedGamesMap: Map<string, CompletedGame>
): { updates: { betId: string, payload: Partial<UserBet> }[]; totalPayout: number } {
  
  if (!pendingBets || pendingBets.length === 0 || completedGamesMap.size === 0) {
    return { updates: [], totalPayout: 0 };
  }

  const updates: { betId: string, payload: Partial<UserBet> }[] = [];
  let totalPayout = 0;

  const completedGames: CompletedGame[] = Array.from(completedGamesMap.values());

  for (const bet of pendingBets) {
    // Only process bets that are actually pending
    if (bet.status !== 'pending') {
        continue;
    }

    const legsToProcess: ParlayLeg[] = bet.legs ? bet.legs : [
        {
            gameId: bet.gameId,
            matchup: bet.matchup || 'N/A',
            commenceTime: bet.commenceTime || new Date(0).toISOString(),
            pick: bet.pick,
            betType: bet.betType as Exclude<UserBet['betType'], 'parlay' | 'player_prop'>,
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
        if (leg.status !== 'pending') {
            if (leg.status === 'lost') hasLostLeg = true;
            if (leg.status === 'push') pushCount++;
            return leg;
        }

        // --- ROBUST GAME FINDER ---
        // 1. Try to find the game by its ID first for efficiency.
        let game: CompletedGame | undefined = completedGamesMap.get(leg.gameId);
        
        // 2. If not found by ID, fall back to searching by team name.
        if (!game) {
            const teamNameInPick = getTeamFromPick(leg.pick, leg.betType);
            if (teamNameInPick) {
                // Find game where this team is either home or away.
                // This is less efficient but robust against ID changes.
                game = completedGames.find(g => 
                    g.homeTeam === teamNameInPick || g.awayTeam === teamNameInPick
                );
            }
        }

        // If game is still not found or not completed, it remains pending.
        if (!game) {
            isFinalized = false;
            return leg;
        }
        
        // --- Grade the leg ---
        betChanged = true;
        const newLegStatus = calculateLegResult(leg, game);

        if (newLegStatus === 'lost') hasLostLeg = true;
        if (newLegStatus === 'push') pushCount++;
        
        return { ...leg, status: newLegStatus };
    });

    // If any leg is still pending, the whole ticket is not finalized yet.
    // However, we might still want to update the individual leg statuses.
    if (!isFinalized) {
        if (bet.betType === 'parlay' && betChanged) {
            updates.push({
                betId: bet.id,
                payload: { legs: updatedLegs },
            });
        }
        continue;
    }

    // --- Determine Final Ticket Status ---
    let finalStatus: UserBet['status'];
    if (hasLostLeg) {
        finalStatus = 'lost';
    } else if (pushCount === updatedLegs.length) {
        finalStatus = 'push';
    } else {
        finalStatus = 'won';
    }

    // If the status changed, prepare the update.
    if (bet.status !== finalStatus || betChanged) {
      const payload: Partial<UserBet> = { status: finalStatus };
      if (bet.betType === 'parlay') {
          payload.legs = updatedLegs;
      }
      updates.push({ betId: bet.id, payload });

      // Calculate payout on status finalization
      if (finalStatus === 'won') {
          totalPayout += bet.potentialWinnings;
      } else if (finalStatus === 'push') {
          totalPayout += bet.stake;
      }
    }
  }

  return { updates, totalPayout };
}
