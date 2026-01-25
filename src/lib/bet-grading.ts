'use client';

import type { CompletedGame, UserBet, ParlayLeg } from './types';

/**
 * Normalizes a team name by handling diacritics and removing special characters.
 * This helps in matching team names from different API sources (e.g., "Montréal" vs "Montreal").
 */
const normalizeName = (name: string): string => {
    if (!name) return '';
    return name
        .normalize("NFD") // Decompose characters (e.g., 'é' -> 'e' + '´')
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
        .toLowerCase()
        .replace(/[\s.&()']/g, ''); // Remove spaces, periods, etc.
};


/**
 * Extracts a number (integer or float, positive or negative) from a string.
 * Used for total lines.
 */
const extractNumber = (str: string | undefined): number | null => {
    if (!str) return null;
    const match = str.match(/[-+]?\d*\.?\d+/g);
    if (!match) return null;
    return parseFloat(match[match.length - 1]);
};

/**
 * Determines if a game is truly complete and ready for grading.
 * A game is gradeable if:
 * 1. It has valid scores for both teams
 * 2. The commence time has passed
 * 3. Either completed flag is true OR the game started more than 4 hours ago (safety margin)
 */
const isGameGradeable = (game: CompletedGame): boolean => {
    // Must have valid scores
    if (game.homeScore === undefined || game.awayScore === undefined) {
        return false;
    }
    
    // Game must have started
    const gameTime = new Date(game.commenceTime);
    const now = new Date();
    if (gameTime > now) {
        return false;
    }
    
    // If completed flag is true, it's definitely ready
    if (game.completed === true) {
        return true;
    }
    
    // Otherwise, check if game started more than 4 hours ago (covers most sports)
    const hoursSinceStart = (now.getTime() - gameTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceStart > 4;
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

  console.log(`[GRADING] Processing ${pendingBets.length} pending bets against ${completedGamesMap.size} completed games`);

  const updates: { betId: string, payload: Partial<UserBet> }[] = [];
  let totalPayout = 0;
  
  for (const bet of pendingBets) {
    if (bet.status !== 'pending') {
        continue;
    }

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

    let isBetFinalized = true;
    let hasAnyLegLost = false;
    let pushCount = 0;
    let haveLegsChanged = false;

    const updatedLegs = legsToProcess.map(leg => {
        if (leg.status !== 'pending') {
            if (leg.status === 'lost') hasAnyLegLost = true;
            if (leg.status === 'push') pushCount++;
            return leg;
        }

        const game = completedGamesMap.get(leg.gameId);
        
        if (!game) {
            console.log(`[GRADING] Game ${leg.gameId} not found in completed games. Leg stays pending.`);
            isBetFinalized = false;
            return leg;
        }
        
        // Check if game is actually gradeable
        if (!isGameGradeable(game)) {
            console.log(`[GRADING] Game ${leg.gameId} exists but is not gradeable yet (completed: ${game.completed}, scores: ${game.homeScore}-${game.awayScore})`);
            isBetFinalized = false;
            return leg;
        }
        
        console.log(`[GRADING] Grading ${leg.betType} bet on ${leg.pick} for game ${leg.gameId}`);
        
        let legResult: 'won' | 'lost' | 'push' | 'pending' = 'pending';
        
        switch (leg.betType) {
            case 'moneyline': {
                if (game.homeScore === undefined || game.awayScore === undefined) {
                    isBetFinalized = false;
                    return leg;
                }
                const winner = game.homeScore > game.awayScore ? game.homeTeam : game.homeScore < game.awayScore ? game.awayTeam : null;
                if (winner === null) {
                  legResult = 'push';
                  console.log(`[GRADING] Moneyline result: PUSH (tie game)`);
                } else {
                  legResult = normalizeName(winner) === normalizeName(leg.pick) ? 'won' : 'lost';
                  console.log(`[GRADING] Moneyline result: ${legResult.toUpperCase()} (winner: ${winner}, pick: ${leg.pick})`);
                }
                break;
            }
            
            case 'spread': {
                if (game.homeScore === undefined || game.awayScore === undefined) {
                    isBetFinalized = false;
                    return leg;
                }
                
                const lastSpaceIndex = leg.pick.lastIndexOf(' ');
                if (lastSpaceIndex === -1) {
                    console.error(`[GRADING] Invalid spread format: ${leg.pick}`);
                    isBetFinalized = false;
                    return leg;
                }
                const teamNameFromPick = leg.pick.substring(0, lastSpaceIndex).trim();
                const lineStr = leg.pick.substring(lastSpaceIndex + 1);
                const line = parseFloat(lineStr);

                if (isNaN(line)) {
                    console.error(`[GRADING] Could not parse spread line: ${lineStr}`);
                    isBetFinalized = false;
                    return leg;
                }
                
                const isHomePick = normalizeName(game.homeTeam) === normalizeName(teamNameFromPick);
                const isAwayPick = normalizeName(game.awayTeam) === normalizeName(teamNameFromPick);

                if (!isHomePick && !isAwayPick) {
                     console.error(`[GRADING] Team name mismatch. Pick: ${teamNameFromPick}, Game: ${game.homeTeam} vs ${game.awayTeam}`);
                     isBetFinalized = false;
                     return leg;
                }

                const margin = isHomePick ? (game.homeScore - game.awayScore) : (game.awayScore - game.homeScore);
                const finalMargin = margin + line;

                if (finalMargin > 0) {
                    legResult = 'won';
                } else if (finalMargin < 0) {
                    legResult = 'lost';
                } else {
                    legResult = 'push';
                }
                console.log(`[GRADING] Spread result: ${legResult.toUpperCase()} (margin: ${margin}, line: ${line}, final: ${finalMargin})`);
                break;
            }
            
            case 'total': {
                if (game.homeScore === undefined || game.awayScore === undefined) {
                    isBetFinalized = false;
                    return leg;
                }
                const line = extractNumber(leg.pick);
                if (line === null) {
                    console.error(`[GRADING] Could not parse total line: ${leg.pick}`);
                    isBetFinalized = false;
                    return leg;
                }
                const totalScore = game.homeScore + game.awayScore;
                
                if (totalScore === line) {
                  legResult = 'push';
                } else if (leg.pick.toLowerCase().includes('over')) {
                    legResult = totalScore > line ? 'won' : 'lost';
                } else {
                    legResult = totalScore < line ? 'won' : 'lost';
                }
                console.log(`[GRADING] Total result: ${legResult.toUpperCase()} (total: ${totalScore}, line: ${line}, pick: ${leg.pick})`);
                break;
            }

            default:
                console.error(`[GRADING] Unknown bet type: ${leg.betType}`);
                isBetFinalized = false;
                return leg;
        }

        if (legResult !== 'pending') haveLegsChanged = true;
        if (legResult === 'lost') hasAnyLegLost = true;
        if (legResult === 'push') pushCount++;
        
        return { ...leg, status: legResult };
    });

    if (!isBetFinalized) {
        if (bet.betType === 'parlay' && haveLegsChanged) {
            console.log(`[GRADING] Parlay ${bet.id} partially graded, updating legs`);
            updates.push({
                betId: bet.id,
                payload: { legs: updatedLegs },
            });
        }
        continue;
    }

    let finalBetStatus: UserBet['status'];
    if (hasAnyLegLost) {
        finalBetStatus = 'lost';
    } else if (pushCount === updatedLegs.length) {
        finalBetStatus = 'push';
    } else {
        finalBetStatus = 'won';
    }

    console.log(`[GRADING] Bet ${bet.id} final status: ${finalBetStatus}`);

    if (bet.status !== finalBetStatus || haveLegsChanged) {
      const payload: Partial<UserBet> = { status: finalBetStatus };
      if (bet.betType === 'parlay') {
          payload.legs = updatedLegs;
      }
      updates.push({ betId: bet.id, payload });

      if (finalBetStatus === 'won') {
          totalPayout += bet.potentialWinnings;
      } else if (finalBetStatus === 'push') {
          totalPayout += bet.stake;
      }
    }
  }

  console.log(`[GRADING] Complete. ${updates.length} bets updated, total payout: ${totalPayout}`);

  return { updates, totalPayout };
}
