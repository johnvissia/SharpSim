'use client';

import type { CompletedGame, UserBet, ParlayLeg } from './types';

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

  const extractNumber = (str: string | undefined): number | null => {
    if (!str) return null;
    const match = str.match(/[-+]?\d*\.?\d+/);
    return match ? parseFloat(match[0]) : null;
  };

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

        // --- 1. ROBUST GAME FINDER ---
        let game: CompletedGame | undefined = completedGamesMap.get(leg.gameId);
        
        if (!game) {
            // Fallback: Search by matching both team names within the matchup string.
            const completedGamesArray = Array.from(completedGamesMap.values());
            game = completedGamesArray.find(g => 
               (leg.matchup && g.homeTeam && leg.matchup.includes(g.homeTeam)) && 
               (leg.matchup && g.awayTeam && leg.matchup.includes(g.awayTeam))
            );
        }
        
        if (!game) {
            isFinalized = false;
            return leg;
        }
        
        const homeScore = game.homeScore;
        const awayScore = game.awayScore;
        let isWin = false;
        let isPush = false;
        
        if (leg.betType === 'spread') {
            const line = extractNumber(leg.pick);

            if (line === null) {
                console.warn(`Could not parse spread line from pick: "${leg.pick}". Skipping leg.`);
                isFinalized = false;
                return leg;
            }

            const teamName = leg.pick.substring(0, leg.pick.lastIndexOf(' ')).trim();
            const homeTeamName = game.homeTeam.trim();
            const awayTeamName = game.awayTeam.trim();
            
            const isHomePick = homeTeamName.includes(teamName) || teamName.includes(homeTeamName);
            const isAwayPick = awayTeamName.includes(teamName) || teamName.includes(awayTeamName);

            let scoreDiff;
            if (isHomePick) {
                scoreDiff = homeScore - awayScore;
            } else if (isAwayPick) {
                scoreDiff = awayScore - homeScore;
            } else {
                console.warn(`Could not confidently match picked team "${teamName}" in game ${game.id}. Skipping leg.`);
                isFinalized = false;
                return leg;
            }

            const finalMargin = scoreDiff + line;
            
            if (finalMargin > 0) {
                isWin = true;
            } else if (finalMargin < 0) {
                isWin = false;
            } else {
                isPush = true;
            }
        
        } else if (leg.betType === 'total') {
            const line = extractNumber(leg.pick);
            if (line === null) {
              console.warn(`Could not parse total line from pick: "${leg.pick}". Skipping leg.`);
              isFinalized = false;
              return leg;
            }
            const totalScore = homeScore + awayScore;
            
            if (totalScore === line) {
              isPush = true;
            } else if (leg.pick.toLowerCase().includes('over')) {
                isWin = totalScore > line;
            } else { // Under
                isWin = totalScore < line;
            }
        } else if (leg.betType === 'moneyline') {
            const winner = homeScore > awayScore ? game.homeTeam : homeScore < awayScore ? game.awayTeam : null;
            if (winner === null) {
              isPush = true;
            } else {
              isWin = winner.includes(leg.pick);
            }
        } else {
          isFinalized = false;
          return leg;
        }

        const newStatus = isPush ? 'push' : isWin ? 'won' : 'lost';

        if (newStatus !== 'pending') betChanged = true;
        if (newStatus === 'lost') hasLostLeg = true;
        if (newStatus === 'push') pushCount++;
        
        return { ...leg, status: newStatus };
    });

    if (!isFinalized) {
        if (bet.betType === 'parlay' && betChanged) {
            updates.push({
                betId: bet.id,
                payload: { legs: updatedLegs },
            });
        }
        continue;
    }

    let finalStatus: UserBet['status'];
    if (hasLostLeg) {
        finalStatus = 'lost';
    } else if (pushCount === updatedLegs.length) {
        finalStatus = 'push';
    } else {
        finalStatus = 'won';
    }

    if (bet.status !== finalStatus || betChanged) {
      const payload: Partial<UserBet> = { status: finalStatus };
      if (bet.betType === 'parlay') {
          payload.legs = updatedLegs;
      }
      updates.push({ betId: bet.id, payload });

      if (finalStatus === 'won') {
          totalPayout += bet.potentialWinnings;
      } else if (finalStatus === 'push') {
          totalPayout += bet.stake;
      }
    }
  }

  return { updates, totalPayout };
}
