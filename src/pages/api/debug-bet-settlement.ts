// pages/api/debug-bet-settlement.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import type { UserBet, CompletedGame, ParlayLeg } from '@/lib/types';

// Helper functions copied from bet-grading.ts for consistency
const normalizeName = (name: string): string => {
    if (!name) return '';
    return name.toLowerCase().replace(/[\s.&()']/g, '');
};
const extractNumber = (str: string | undefined): number | null => {
    if (!str) return null;
    const match = str.match(/[-+]?\d*\.?\d+/g);
    if (!match) return null;
    return parseFloat(match[match.length - 1]);
};

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // Use application default credentials in a GCP environment
    admin.initializeApp();
  } catch (e) {
    console.error('Firebase admin initialization error', e);
  }
}

const db = admin.firestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { betId, userId } = req.query;

  if (typeof betId !== 'string' || typeof userId !== 'string') {
    return res.status(400).send('Please provide both betId and userId query parameters.');
  }

  let log = `--- Debugging Bet ID: ${betId} for User ID: ${userId} ---\n\n`;

  try {
    // 1. Fetch the bet document
    const betRef = db.collection('users').doc(userId).collection('bets').doc(betId);
    const betDoc = await betRef.get();

    if (!betDoc.exists) {
      return res.status(404).send(`Bet with ID ${betId} not found for user ${userId}.`);
    }

    const bet = betDoc.data() as UserBet;
    log += `Bet Document Found. Details:\n${JSON.stringify(bet, null, 2)}\n\n`;

    // 2. Simulate grading
    const legs: Partial<ParlayLeg>[] = bet.legs ? bet.legs : [{
        gameId: bet.gameId,
        pick: bet.pick,
        betType: bet.betType,
        status: bet.status,
    }];

    for (const leg of legs) {
      if (!leg.gameId || !leg.pick || !leg.betType) {
        log += `--- Invalid leg found in bet. Skipping. ---\n\n`;
        continue;
      }
      if (leg.status !== 'pending') {
        log += `--- Leg for "${leg.pick}" is already settled with status: ${leg.status}. Skipping. ---\n\n`;
        continue;
      }
      
      log += `--- Processing Leg: "${leg.pick}" on Game ID: ${leg.gameId} ---\n`;
      const gameRef = db.collection('completed_games').doc(leg.gameId);
      const gameDoc = await gameRef.get();
      
      if (!gameDoc.exists) {
        log += "Did we find the game? [NO]\n";
        log += `  - No document found in 'completed_games' with ID: ${leg.gameId}\n\n`;
        continue;
      }
      
      log += "Did we find the game? [YES]\n";
      const game = gameDoc.data() as CompletedGame;
      log += `Raw API Response (from Firestore):\n${JSON.stringify(game, null, 2)}\n\n`;

      const isCompleted = game.completed === true;
      log += `Is the Game Status 'Final' (completed=true)? [${isCompleted ? 'YES' : 'NO'}] (Value: ${game.completed})\n`;
      
      if (!isCompleted) {
        log += "  - Game is not final. Grading cannot proceed.\n\n";
        continue;
      }
      
      // The "Why" Check
      switch(leg.betType) {
        case 'moneyline':
          const winner = game.homeScore > game.awayScore ? game.homeTeam : game.awayScore > game.homeScore ? game.awayTeam : null;
          log += `Grading as Moneyline...\n`;
          if (winner) {
            const betPickNormalized = normalizeName(leg.pick);
            const apiWinnerNormalized = normalizeName(winner);
            const match = betPickNormalized === apiWinnerNormalized;
            log += `Did the Team Name match? [${match ? 'YES' : 'NO'}] (Bet says: ${leg.pick}, API says: ${winner})\n`;
            log += `  - Normalized Bet: '${betPickNormalized}', Normalized API: '${apiWinnerNormalized}'\n`;
            log += `  - Leg Result: ${match ? 'WON' : 'LOST'}\n`;
          } else {
            log += `Game was a tie (or scores invalid). Result should be a PUSH.\n`;
            log += `  - Leg Result: PUSH\n`;
          }
          break;

        case 'spread':
          log += `Grading as Spread...\n`;
          const lastSpaceIndex = leg.pick.lastIndexOf(' ');
          const teamNameFromPick = leg.pick.substring(0, lastSpaceIndex).trim();
          const lineStr = leg.pick.substring(lastSpaceIndex + 1);
          const line = parseFloat(lineStr);

          log += `  - Parsed Team: '${teamNameFromPick}', Parsed Line: ${line}\n`;

          const isHomePick = normalizeName(game.homeTeam) === normalizeName(teamNameFromPick);
          const margin = isHomePick ? (game.homeScore - game.awayScore) : (game.awayScore - game.homeScore);
          const finalMargin = margin + line;

          log += `  - Actual Score: ${game.awayTeam} ${game.awayScore} @ ${game.homeTeam} ${game.homeScore}\n`;
          log += `  - Final Margin (with spread): ${finalMargin}\n`;
          
          let spreadResult = 'PENDING';
          if (finalMargin > 0) spreadResult = 'WON';
          else if (finalMargin < 0) spreadResult = 'LOST';
          else spreadResult = 'PUSH';
          log += `  - Leg Result: ${spreadResult}\n`;
          break;

        case 'total':
          log += `Grading as Total...\n`;
          const totalLine = extractNumber(leg.pick);
          const totalScore = game.homeScore + game.awayScore;
          log += `  - Parsed Line: ${totalLine}\n`;
          log += `  - Actual Total Score: ${totalScore}\n`;
          const isOver = leg.pick.toLowerCase().includes('over');
          
          let totalResult = 'PENDING';
          if (totalScore === totalLine) totalResult = 'PUSH';
          else if (isOver) totalResult = totalScore > totalLine ? 'WON' : 'LOST';
          else totalResult = totalScore < totalLine ? 'WON' : 'LOST';
          log += `  - Leg Result: ${totalResult}\n`;
          break;
        
        default:
          log += `Grading for bet type '${leg.betType}' is not implemented in this debug tool.\n`;
      }
      log += "\n";
    }

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(log);

  } catch (error: any) {
    log += `\n---!! ENCOUNTERED AN UNEXPECTED ERROR !!---\n`;
    log += error.stack;
    res.setHeader('Content-Type', 'text/plain');
    res.status(500).send(log);
  }
}
