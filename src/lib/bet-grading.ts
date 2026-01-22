'use client';

import type { CompletedGame, UserBet, ParlayLeg, PlayerGameStats } from './types';

/**
 * Normalizes a team name by converting to lowercase and removing spaces, periods, and parentheses.
 * This helps in matching team names from different API sources.
 * @param name The team name string to normalize.
 * @returns The normalized team name.
 */
const normalizeName = (name: string): string => {
    return name.toLowerCase().replace(/[\s.&()']/g, '');
};


/**
 * Extracts a number (integer or float, positive or negative) from a string.
 * Used for total lines.
 * @param str The string to parse.
 * @returns The extracted number, or null if not found.
 */
const extractNumber = (str: string | undefined): number | null => {
    if (!str) return null;
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
            playerId: bet.playerId,
            market: bet.market,
            line: bet.line,
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
        
        if (!game || !game.completed || new Date(game.commenceTime) > new Date()) {
            isBetFinalized = false;
            return leg;
        }
        
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
                } else {
                  legResult = normalizeName(winner) === normalizeName(leg.pick) ? 'won' : 'lost';
                }
                break;
            }
            
            case 'spread': {
                if (game.homeScore === undefined || game.awayScore === undefined) {
                    isBetFinalized = false;
                    return leg;
                }
                
                // Robustly parse the team name and spread value from the pick string
                const lastSpaceIndex = leg.pick.lastIndexOf(' ');
                if (lastSpaceIndex === -1) {
                    isBetFinalized = false;
                    return leg; // Invalid spread pick format
                }
                const teamNameFromPick = leg.pick.substring(0, lastSpaceIndex).trim();
                const lineStr = leg.pick.substring(lastSpaceIndex + 1);
                const line = parseFloat(lineStr);

                if (isNaN(line)) {
                    isBetFinalized = false;
                    return leg; // Could not parse line number
                }
                
                const isHomePick = normalizeName(game.homeTeam) === normalizeName(teamNameFromPick);
                const isAwayPick = normalizeName(game.awayTeam) === normalizeName(teamNameFromPick);

                if (!isHomePick && !isAwayPick) {
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
                break;
            }
            
            case 'total': {
                if (game.homeScore === undefined || game.awayScore === undefined) {
                    isBetFinalized = false;
                    return leg;
                }
                const line = extractNumber(leg.pick);
                if (line === null) {
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
                break;
            }

            case 'player_prop': {
                if (!game.playerStats || !leg.playerId || !leg.market || leg.line === undefined) {
                    isBetFinalized = false;
                    return leg; // Not enough info to grade
                }

                const playerStat = game.playerStats.find(p => p.playerId === leg.playerId);
                if (!playerStat) {
                    isBetFinalized = false; // Player didn't play or stats not found
                    return leg;
                }

                const marketToStatKey: Record<string, keyof PlayerGameStats['stats']> = {
                    'pts': 'points',
                    'reb': 'rebounds',
                    'ast': 'assists',
                    'stl': 'steals',
                    'blk': 'blocks',
                    '3pt': 'threePointersMade',
                };
                
                let actualStatValue: number | undefined;
                const statKey = marketToStatKey[leg.market];
                
                if (statKey) {
                    actualStatValue = playerStat.stats[statKey];
                } else if (leg.market === 'pts+reb+ast') {
                    actualStatValue = playerStat.stats.points + playerStat.stats.rebounds + playerStat.stats.assists;
                } else if (leg.market === 'blk+stl') {
                    actualStatValue = playerStat.stats.blocks + playerStat.stats.steals;
                }

                if (actualStatValue === undefined) {
                    isBetFinalized = false; // Market not supported for grading
                    return leg;
                }

                const isOver = leg.pick.toLowerCase().includes('over');
                
                if (actualStatValue > leg.line) {
                    legResult = isOver ? 'won' : 'lost';
                } else if (actualStatValue < leg.line) {
                    legResult = isOver ? 'lost' : 'won';
                } else { // actualStatValue === leg.line
                    legResult = 'push';
                }
                break;
            }

            default:
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

  return { updates, totalPayout };
}
