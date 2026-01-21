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

  const completedGamesArray = Array.from(completedGamesMap.values());

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

        let game: CompletedGame | undefined = completedGamesMap.get(leg.gameId);
        
        if (!game) {
            game = completedGamesArray.find(g => 
               (leg.matchup && g.homeTeam && leg.matchup.includes(g.homeTeam)) && 
               (leg.matchup && g.awayTeam && leg.matchup.includes(g.awayTeam))
            );
        }
        
        // --- GATEKEEPER RULE ---
        // Only grade if the game is found, marked completed, AND its start time is in the past.
        if (!game || !game.completed || new Date(game.commenceTime) > new Date()) {
            isFinalized = false;
            return leg;
        }
        
        // --- SAFETY CHECK ---
        // Failsafe to prevent grading games with 0-0 scores that might have slipped through.
        if (game.homeScore === 0 && game.awayScore === 0) {
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
                isFinalized = false;
                return leg;
            }
            const teamNameFromPick = leg.pick.replace(/[-+0-9\.]/g, '').trim();
            const isHomePick = game.homeTeam.includes(teamNameFromPick);
            const isAwayPick = game.awayTeam.includes(teamNameFromPick);

            if (!isHomePick && !isAwayPick) {
                isFinalized = false;
                return leg;
            }
            const margin = isHomePick ? (homeScore - awayScore) : (awayScore - homeScore);
            const finalMargin = margin + line;
            isWin = finalMargin > 0;
            if (finalMargin === 0) isPush = true;

        } else if (leg.betType === 'total') {
            const line = extractNumber(leg.pick);
            if (line === null) {
              isFinalized = false;
              return leg;
            }
            const totalScore = homeScore + awayScore;
            
            if (totalScore === line) {
              isPush = true;
            } else if (leg.pick.toLowerCase().includes('over')) {
                isWin = totalScore > line;
            } else {
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
