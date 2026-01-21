'use client';

import type { CompletedGame, UserBet, ParlayLeg } from './types';

/**
 * Extracts a number (integer or float, positive or negative) from a string.
 * @param str The string to parse.
 * @returns The extracted number, or null if not found.
 */
const extractNumber = (str: string | undefined): number | null => {
    if (!str) return null;
    // This regex finds the last number in the string, which is usually the line.
    const match = str.match(/[-+]?\d*\.?\d+/g);
    if (!match) return null;
    return parseFloat(match[match.length - 1]);
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
  
  for (const bet of pendingBets) {
    // We only process pending bets from the query, but as a safeguard:
    if (bet.status !== 'pending') {
        continue;
    }

    const legsToProcess: ParlayLeg[] = bet.legs ? bet.legs : [
        // Create a synthetic leg for single bets for unified processing
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

    let isBetFinalized = true; // Assume the bet can be settled unless a leg is still pending.
    let hasAnyLegLost = false;
    let pushCount = 0;
    let haveLegsChanged = false;

    const updatedLegs = legsToProcess.map(leg => {
        // If leg is already settled, just update finalization state and skip.
        if (leg.status !== 'pending') {
            if (leg.status === 'lost') hasAnyLegLost = true;
            if (leg.status === 'push') pushCount++;
            return leg;
        }

        const game = completedGamesMap.get(leg.gameId);
        
        // --- GATEKEEPER RULE ---
        // Only grade if the game is found, marked completed, AND its start time is in the past.
        if (!game || !game.completed || new Date(game.commenceTime) > new Date()) {
            isBetFinalized = false; // Cannot settle the bet yet.
            return leg;
        }
        
        // --- SAFETY CHECK ---
        // Failsafe to prevent grading games with 0-0 scores that might be incomplete data.
        if (game.homeScore === 0 && game.awayScore === 0) {
            isBetFinalized = false;
            return leg;
        }

        const homeScore = game.homeScore;
        const awayScore = game.awayScore;
        let legResult: 'won' | 'lost' | 'push' | 'pending' = 'pending';
        
        switch (leg.betType) {
            case 'moneyline': {
                const winner = homeScore > awayScore ? game.homeTeam : homeScore < awayScore ? game.awayTeam : null;
                if (winner === null) {
                  legResult = 'push';
                } else {
                  // Check if the leg's pick (team name) is included in the winner's name
                  legResult = winner.includes(leg.pick) ? 'won' : 'lost';
                }
                break;
            }
            
            case 'spread': {
                const line = extractNumber(leg.pick);
                if (line === null) {
                    isBetFinalized = false; // Cannot parse line, leave pending
                    return leg;
                }
                // The team is the part of the pick that isn't the number
                const teamNameFromPick = leg.pick.replace(/[-+0-9\.]/g, '').trim();
                
                const isHomePick = game.homeTeam.includes(teamNameFromPick);
                const isAwayPick = game.awayTeam.includes(teamNameFromPick);

                if (!isHomePick && !isAwayPick) {
                     isBetFinalized = false; // Team not found, can't grade
                     return leg;
                }

                // Margin is from the perspective of the team picked
                const margin = isHomePick ? (homeScore - awayScore) : (awayScore - homeScore);
                const finalMargin = margin + line;

                if (finalMargin > 0) {
                    legResult = 'won';
                } else if (finalMargin < 0) {
                    legResult = 'lost';
                } else {
                    legResult = 'push';
                }
                break;
            }
            
            case 'total': {
                const line = extractNumber(leg.pick);
                if (line === null) {
                    isBetFinalized = false; // Cannot parse line, leave pending
                    return leg;
                }
                const totalScore = homeScore + awayScore;
                
                if (totalScore === line) {
                  legResult = 'push';
                } else if (leg.pick.toLowerCase().includes('over')) {
                    legResult = totalScore > line ? 'won' : 'lost';
                } else { // Assumes 'under'
                    legResult = totalScore < line ? 'won' : 'lost';
                }
                break;
            }

            // Player props or other types are not graded here.
            default:
                isBetFinalized = false;
                return leg;
        }

        // If we reached here, the leg has been graded.
        if (legResult !== 'pending') haveLegsChanged = true;
        if (legResult === 'lost') hasAnyLegLost = true;
        if (legResult === 'push') pushCount++;
        
        return { ...leg, status: legResult };
    });

    // Don't update the overall bet status if any leg is still pending.
    if (!isBetFinalized) {
        // However, if some legs were updated, we should save their partial progress.
        if (bet.betType === 'parlay' && haveLegsChanged) {
            updates.push({
                betId: bet.id,
                payload: { legs: updatedLegs },
            });
        }
        continue;
    }

    // Determine the final status of the bet ticket.
    let finalBetStatus: UserBet['status'];
    if (hasAnyLegLost) {
        finalBetStatus = 'lost';
    } else if (pushCount === updatedLegs.length) {
        finalBetStatus = 'push';
    } else {
        finalBetStatus = 'won';
    }

    // If the final status is different from the original, we need to update.
    if (bet.status !== finalBetStatus || haveLegsChanged) {
      const payload: Partial<UserBet> = { status: finalBetStatus };
      if (bet.betType === 'parlay') {
          payload.legs = updatedLegs;
      }
      updates.push({ betId: bet.id, payload });

      // Calculate payout only if the bet is newly settled
      if (finalBetStatus === 'won') {
          totalPayout += bet.potentialWinnings;
      } else if (finalBetStatus === 'push') {
          // If the whole parlay pushes, refund stake.
          // For a single bet push, this is also correct.
          totalPayout += bet.stake;
      }
    }
  }

  return { updates, totalPayout };
}
