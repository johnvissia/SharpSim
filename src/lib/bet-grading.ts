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
 * Finds a matching completed game for a leg, either by exact game ID or by team names & commence date.
 */
const findGameForLeg = (leg: ParlayLeg, completedGamesMap: Map<string, CompletedGame>): CompletedGame | undefined => {
    // 1. Direct ID lookup
    if (leg.gameId && completedGamesMap.has(leg.gameId)) {
        return completedGamesMap.get(leg.gameId);
    }

    const normMatchup = normalizeName(leg.matchup || '');
    const normPick = normalizeName(leg.pick || '');

    // 2. Match by both home & away team names
    for (const game of completedGamesMap.values()) {
        const homeNorm = normalizeName(game.homeTeam);
        const awayNorm = normalizeName(game.awayTeam);

        if (!homeNorm || !awayNorm) continue;

        const matchesHome = normMatchup.includes(homeNorm) || homeNorm.includes(normMatchup) || normPick.includes(homeNorm);
        const matchesAway = normMatchup.includes(awayNorm) || awayNorm.includes(normMatchup) || normPick.includes(awayNorm);

        if (matchesHome && matchesAway) {
            if (leg.commenceTime && game.commenceTime) {
                const legTime = new Date(leg.commenceTime).getTime();
                const gameTime = new Date(game.commenceTime).getTime();
                const diffHours = Math.abs(legTime - gameTime) / (1000 * 60 * 60);
                if (diffHours > 48) continue;
            }
            return game;
        }
    }

    // 3. Fallback match by pick team name & date
    for (const game of completedGamesMap.values()) {
        const homeNorm = normalizeName(game.homeTeam);
        const awayNorm = normalizeName(game.awayTeam);

        // Check if pick contains team name or vice versa
        const pickTeamMatch = (homeNorm.length >= 3 && normPick.includes(homeNorm)) || 
                              (awayNorm.length >= 3 && normPick.includes(awayNorm));

        if (pickTeamMatch) {
            if (leg.commenceTime && game.commenceTime) {
                const legTime = new Date(leg.commenceTime).getTime();
                const gameTime = new Date(game.commenceTime).getTime();
                const diffHours = Math.abs(legTime - gameTime) / (1000 * 60 * 60);
                if (diffHours <= 36) return game;
            } else {
                return game;
            }
        }
    }

    return undefined;
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

    if (!pendingBets || pendingBets.length === 0) {
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
                playerId: bet.playerId,
                playerName: bet.playerName,
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

            let legResult: 'won' | 'lost' | 'push' | 'pending' = 'pending';

            if (leg.betType === 'player_prop') {
                // Player props are graded against player stats, not the `completedGamesMap`.
                if (!completedPlayerStatsMap) {
                    console.log(`[GRADING] Player prop bet on ${leg.pick} found, but player stats are not available. Leg will remain pending.`);
                    isBetFinalized = false;
                    return leg;
                }
                if (!leg.playerId || !leg.market || leg.line === undefined) {
                    console.error(`[GRADING] Player prop for ${leg.pick} is missing required fields (playerId, market, line).`);
                    isBetFinalized = false;
                    return leg;
                }

                const statsKey = `${leg.gameId}_${leg.playerId}`;
                const playerStats = completedPlayerStatsMap.get(statsKey);

                if (!playerStats) {
                    console.log(`[GRADING] Player stats not found for key ${statsKey}. Leg will remain pending.`);
                    isBetFinalized = false;
                    return leg;
                }

                if (!playerStats.completed) {
                    console.log(`[GRADING] Player stats for ${playerStats.playerName} exist but game not marked as complete.`);
                    isBetFinalized = false;
                    return leg;
                }

                // Map our app's market name to the specific stat key from the API
                const marketMap: Record<string, keyof CompletedPlayerStats['stats'] | 'combo'> = {
                    'points': 'points', 'pts': 'points',
                    'rebounds': 'rebounds', 'reb': 'rebounds',
                    'assists': 'assists', 'ast': 'assists',
                    'steals': 'steals', 'stl': 'steals',
                    'blocks': 'blocks', 'blk': 'blocks',
                    'turnovers': 'turnovers', 'to': 'turnovers',
                    'threes': 'threePointersMade', 'three_pointers_made': 'threePointersMade', '3pt': 'threePointersMade',
                    'pts+reb+ast': 'combo',
                    'blk+stl': 'combo',
                };

                let actualValue: number | undefined;
                const marketKey = marketMap[leg.market.toLowerCase()];

                if (!marketKey) {
                    console.error(`[GRADING] Unknown player prop market: ${leg.market}`);
                    isBetFinalized = false;
                    return leg;
                }

                if (marketKey === 'combo') {
                    if (leg.market.toLowerCase() === 'pts+reb+ast') {
                        actualValue = (playerStats.stats.points || 0) + (playerStats.stats.rebounds || 0) + (playerStats.stats.assists || 0);
                    } else if (leg.market.toLowerCase() === 'blk+stl') {
                        actualValue = (playerStats.stats.blocks || 0) + (playerStats.stats.steals || 0);
                    }
                } else {
                    actualValue = playerStats.stats[marketKey];
                }

                if (typeof actualValue !== 'number') {
                    console.error(`[GRADING] Could not find a valid number for stat '${marketKey}' for player ${playerStats.playerName}.`);
                    isBetFinalized = false;
                    return leg;
                }

                const isOver = leg.pick.toLowerCase().includes('over');
                if (actualValue === leg.line) {
                    legResult = 'push';
                } else if (isOver) {
                    legResult = actualValue > leg.line ? 'won' : 'lost';
                } else {
                    legResult = actualValue < leg.line ? 'won' : 'lost';
                }
                console.log(`[GRADING] Player prop result: ${legResult.toUpperCase()} (${playerStats.playerName} ${leg.market}: ${actualValue} vs line ${leg.line})`);

            } else {
                // This path handles game lines (moneyline, spread, total)
                const game = findGameForLeg(leg, completedGamesMap);

                if (!game || !isGameGradeable(game)) {
                    console.log(`[GRADING] Game ${leg.gameId} / ${leg.matchup} not found or not gradeable. Leg stays pending.`);
                    isBetFinalized = false;
                    return leg;
                }

                console.log(`[GRADING] Grading ${leg.betType} bet on ${leg.pick} for game ${game.awayTeam} @ ${game.homeTeam} (${game.awayScore}-${game.homeScore})`);

                switch (leg.betType) {
                    case 'moneyline': {
                        if (game.homeScore === game.awayScore) {
                            legResult = 'push';
                            console.log(`[GRADING] Moneyline result: PUSH (tie game)`);
                        } else {
                            const winner = game.homeScore > game.awayScore ? game.homeTeam : game.awayTeam;
                            const normWinner = normalizeName(winner);
                            const normPick = normalizeName(leg.pick);
                            const isWin = normWinner.includes(normPick) || normPick.includes(normWinner);
                            legResult = isWin ? 'won' : 'lost';
                            console.log(`[GRADING] Moneyline result: ${legResult.toUpperCase()} (winner: ${winner}, pick: ${leg.pick})`);
                        }
                        break;
                    }
                    case 'spread': {
                        const lastSpaceIndex = leg.pick.lastIndexOf(' ');
                        if (lastSpaceIndex === -1) {
                            console.error(`[GRADING] Invalid spread format: ${leg.pick}`);
                            isBetFinalized = false; return leg;
                        }
                        const teamNameFromPick = leg.pick.substring(0, lastSpaceIndex).trim();
                        const line = parseFloat(leg.pick.substring(lastSpaceIndex + 1));

                        if (isNaN(line)) {
                            console.error(`[GRADING] Could not parse spread line from: ${leg.pick}`);
                            isBetFinalized = false; return leg;
                        }

                        const normPickTeam = normalizeName(teamNameFromPick);
                        const normHome = normalizeName(game.homeTeam);
                        const normAway = normalizeName(game.awayTeam);

                        const isHomePick = normHome.includes(normPickTeam) || normPickTeam.includes(normHome);
                        const isAwayPick = normAway.includes(normPickTeam) || normPickTeam.includes(normAway);

                        if (!isHomePick && !isAwayPick) {
                            console.error(`[GRADING] Team name mismatch. Pick: ${teamNameFromPick}, Game: ${game.homeTeam} vs ${game.awayTeam}`);
                            isBetFinalized = false; return leg;
                        }

                        const margin = isHomePick ? (game.homeScore - game.awayScore) : (game.awayScore - game.homeScore);
                        const finalMargin = margin + line;

                        if (finalMargin > 0) legResult = 'won';
                        else if (finalMargin < 0) legResult = 'lost';
                        else legResult = 'push';

                        console.log(`[GRADING] Spread result: ${legResult.toUpperCase()} (margin: ${margin}, line: ${line}, final: ${finalMargin})`);
                        break;
                    }
                    case 'total': {
                        const line = extractNumber(leg.pick);
                        if (line === null) {
                            console.error(`[GRADING] Could not parse total line: ${leg.pick}`);
                            isBetFinalized = false; return leg;
                        }
                        const totalScore = game.homeScore + game.awayScore;

                        if (totalScore === line) legResult = 'push';
                        else if (leg.pick.toLowerCase().includes('over')) legResult = totalScore > line ? 'won' : 'lost';
                        else legResult = totalScore < line ? 'won' : 'lost';

                        console.log(`[GRADING] Total result: ${legResult.toUpperCase()} (total: ${totalScore}, line: ${line}, pick: ${leg.pick})`);
                        break;
                    }
                    default:
                        console.error(`[GRADING] Unknown bet type for game line: ${leg.betType}`);
                        isBetFinalized = false; return leg;
                }
            }

            if ((legResult as string) !== 'pending') haveLegsChanged = true;
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

        if ((bet.status as string) !== (finalBetStatus as string) || haveLegsChanged) {
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
