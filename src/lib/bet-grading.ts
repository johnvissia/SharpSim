'use client';

import type { CompletedGame, UserBet, ParlayLeg } from './types';

interface CompletedPlayerStats {
  id: string;
  gameId: string;
  playerId: string;
  playerName: string;
  gameDate: string;
  stats: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    threePointersMade: number;
  };
  completed: boolean;
}

/**
 * Normalizes a team name by converting to lowercase and removing spaces, periods, and parentheses.
 * This helps in matching team names from different API sources.
 */
const normalizeName = (name: string): string => {
    if (!name) return '';
    return name
        .normalize('NFD') // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
        .toLowerCase()
        .replace(/[\s.&()']/g, '');
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
 * Grades all pending bets for a given user against completed games and player stats.
 * This is a pure function that returns a list of required updates.
 * @param pendingBets The user's bets that have a 'pending' status.
 * @param completedGamesMap A Map of completed game data, with game ID as the key.
 * @param completedPlayerStatsMap A Map of completed player stats, with "{gameId}_{playerId}" as the key.
 * @returns An object with an array of bet updates and the total payout to be applied.
 */
export function gradeUserBets(
  pendingBets: UserBet[],
  completedGamesMap: Map<string, CompletedGame>,
  completedPlayerStatsMap?: Map<string, CompletedPlayerStats>
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

            case 'player_prop': {
                // Player props require individual player stats
                if (!completedPlayerStatsMap) {
                    console.log(`[GRADING] Player prop bet detected but no stats provided - skipping`);
                    isBetFinalized = false;
                    return leg;
                }
                
                if (!leg.playerId || !leg.market || leg.line === undefined) {
                    console.error(`[GRADING] Player prop missing required fields:`, leg);
                    isBetFinalized = false;
                    return leg;
                }
                
                // Look up player stats using gameId_playerId format
                const statsKey = `${leg.gameId}_${leg.playerId}`;
                const playerStats = completedPlayerStatsMap.get(statsKey);
                
                if (!playerStats) {
                    console.log(`[GRADING] Player stats not found for ${statsKey}. Leg stays pending.`);
                    isBetFinalized = false;
                    return leg;
                }
                
                if (!playerStats.completed) {
                    console.log(`[GRADING] Player stats exist but game not completed for ${statsKey}`);
                    isBetFinalized = false;
                    return leg;
                }
                
                // Get the actual stat value based on market
                let actualValue: number | undefined;
                const market = leg.market.toLowerCase();
                
                switch (market) {
                    case 'points':
                    case 'pts':
                        actualValue = playerStats.stats.points;
                        break;
                    case 'rebounds':
                    case 'reb':
                        actualValue = playerStats.stats.rebounds;
                        break;
                    case 'assists':
                    case 'ast':
                        actualValue = playerStats.stats.assists;
                        break;
                    case 'steals':
                    case 'stl':
                        actualValue = playerStats.stats.steals;
                        break;
                    case 'blocks':
                    case 'blk':
                        actualValue = playerStats.stats.blocks;
                        break;
                    case 'turnovers':
                    case 'to':
                        actualValue = playerStats.stats.turnovers;
                        break;
                    case 'threes':
                    case 'three_pointers_made':
                    case '3pt':
                        actualValue = playerStats.stats.threePointersMade;
                        break;
                    case 'pts+reb+ast':
                        actualValue = (playerStats.stats.points || 0) + (playerStats.stats.rebounds || 0) + (playerStats.stats.assists || 0);
                        break;
                    case 'blk+stl':
                        actualValue = (playerStats.stats.blocks || 0) + (playerStats.stats.steals || 0);
                        break;
                    default:
                        console.error(`[GRADING] Unknown player prop market: ${leg.market}`);
                        isBetFinalized = false;
                        return leg;
                }
                
                if (actualValue === undefined) {
                    console.log(`[GRADING] Could not determine actual value for market '${market}'.`);
                    isBetFinalized = false;
                    return leg;
                }
                
                // Determine if it's an over or under bet
                const isOver = leg.pick.toLowerCase().includes('over');
                
                if (actualValue === leg.line) {
                    legResult = 'push';
                } else if (isOver) {
                    legResult = actualValue > leg.line ? 'won' : 'lost';
                } else {
                    legResult = actualValue < leg.line ? 'won' : 'lost';
                }
                
                console.log(`[GRADING] Player prop result: ${legResult.toUpperCase()} (${playerStats.playerName} ${leg.market}: ${actualValue} vs line ${leg.line})`);
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
