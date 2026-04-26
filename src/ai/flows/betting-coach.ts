'use server';

import { db } from '@/lib/firebase';
import type { UserBet, CoachingAnalysis, PerformanceSplit } from '@/lib/types';

/**
 * Calculates the Coaching Analysis based on actual user betting history and model data.
 */
export async function analyzeBettingPerformance(input: { bettingHistory: string }): Promise<CoachingAnalysis> {
  const bets: UserBet[] = JSON.parse(input.bettingHistory);
  const settledBets = bets.filter(b => b.status === 'won' || b.status === 'lost');

  if (settledBets.length === 0) {
    throw new Error('No settled bets found to analyze.');
  }

  // 1. Fetch Model Predictions for all relevant games to calculate Alignment and CLV
  const gameIds = Array.from(new Set(settledBets.map(b => b.gameId)));
  const predictionsMap = new Map<string, any>();

  // Use chunks to avoid Firestore "in" limit if history is massive (limit 30)
  const chunkSize = 30;
  for (let i = 0; i < gameIds.length; i += chunkSize) {
    const chunk = gameIds.slice(i, i + chunkSize);
    const snapshot = await db.collection('model_predictions')
      .where('gameId', 'in', chunk)
      .get();
    snapshot.docs.forEach(doc => predictionsMap.set(doc.data().gameId, doc.data()));
  }

  // 2. Perform Grouped Analytics (ROI, Win Rate)
  const statsGrouped = (groupBy: (b: UserBet) => string) => {
    const groups: Record<string, { wins: number; total: number; stake: number; profit: number }> = {};
    settledBets.forEach(bet => {
      const key = groupBy(bet);
      if (!groups[key]) groups[key] = { wins: 0, total: 0, stake: 0, profit: 0 };
      const net = bet.status === 'won' ? (bet.potentialWinnings - bet.stake) : -bet.stake;
      groups[key].total++;
      groups[key].stake += bet.stake;
      groups[key].profit += net;
      if (bet.status === 'won') groups[key].wins++;
    });
    return Object.entries(groups).map(([label, stats]): PerformanceSplit => ({
      category: label,
      label,
      roi: (stats.profit / stats.stake) * 100,
      winRate: (stats.wins / stats.total) * 100,
      totalBets: stats.total,
      profit: stats.profit
    }));
  };

  const sportSplits = statsGrouped(b => b.sport);
  const betTypeSplits = statsGrouped(b => b.betType);
  const tendencySplits = statsGrouped(b => {
    // Basic heuristic: if spread is negative or ML < 2.0, it's a favorite
    if (b.betType === 'moneyline') return b.odds < 2.0 ? 'Favorites' : 'Underdogs';
    if (b.betType === 'spread') return b.pick.includes('-') ? 'Favorites' : 'Underdogs';
    return 'Other';
  });

  // 3. Model Alignment & CLV Tracking
  let matchesModelCount = 0;
  let eligibilityCount = 0;
  let alternativeProfit = 0;
  let clvSum = 0;
  let clvCount = 0;

  settledBets.forEach(bet => {
    const pred = predictionsMap.get(bet.gameId);
    if (pred) {
      eligibilityCount++;
      // Alignment
      if (pred.recommendedSide && bet.pick.toLowerCase().includes(pred.recommendedSide.toLowerCase())) {
        matchesModelCount++;
      }
      
      // Alternative Reality (if they followed model)
      if (pred.correct === true) alternativeProfit += (bet.stake * 0.9); // Assume -110 odds avg
      else if (pred.correct === false) alternativeProfit -= bet.stake;

      // CLV (Beat the line)
      if (bet.betType === 'spread' && bet.line !== undefined && pred.marketSpread !== undefined) {
        // Higher is better for underdogs, lower for favorites
        const isHome = bet.pick.includes(pred.homeTeam);
        const betLine = bet.line;
        const closingLine = pred.marketSpread;
        const edge = isHome ? (closingLine - betLine) : (betLine - closingLine);
        clvSum += edge;
        clvCount++;
      }
    }
  });

  const alignmentScore = eligibilityCount > 0 ? (matchesModelCount / eligibilityCount) * 100 : 0;
  const alignmentGrade = alignmentScore > 80 ? 'A' : alignmentScore > 65 ? 'B' : alignmentScore > 50 ? 'C' : alignmentScore > 35 ? 'D' : 'F';

  // 4. Bankroll Discipline
  let lossChasing = false;
  let sizingConsistency = 100;
  if (settledBets.length > 1) {
    const stakes = settledBets.map(b => b.stake);
    const avgStake = stakes.reduce((a, b) => a + b) / stakes.length;
    const variance = stakes.reduce((a, b) => a + Math.pow(b - avgStake, 2), 0) / stakes.length;
    sizingConsistency = Math.max(0, 100 - (Math.sqrt(variance) / avgStake) * 100);

    for (let i = 1; i < settledBets.length; i++) {
        if (settledBets[i-1].status === 'lost' && settledBets[i].stake >= settledBets[i-1].stake * 1.5) {
            lossChasing = true;
            break;
        }
    }
  }

  // 5. Team Bias Detection
  const teamStats = statsGrouped(b => {
    if (b.betType === 'parlay') return 'Parlay';
    // Extract team name from pick (e.g. "Lakers -4.5" -> "Lakers")
    return b.pick.split(/[+-]/)[0].trim();
  }).filter(s => s.totalBets >= 3 && s.winRate < 40);

  const biasAlerts = teamStats.map(s => ({
    teamName: s.label,
    winRate: s.winRate,
    description: `You have a low win rate (${s.winRate.toFixed(1)}%) when betting on or against the ${s.label}.`,
    severity: (s.winRate < 25 ? 'high' : 'medium') as 'low' | 'medium' | 'high'
  }));

  // 6. Generate Summary & Tips
  const topSport = sportSplits.sort((a, b) => b.roi - a.roi)[0];
  const worstType = betTypeSplits.sort((a, b) => a.roi - b.roi)[0];

  const summary = `Your performance is anchored by your success in ${topSport.label} (${topSport.roi.toFixed(1)}% ROI). However, your ${worstType.label} betting is currently a drag on your bankroll. ${alignmentScore > 70 ? 'You are highly aligned with the sharp models.' : 'Your intuition often diverges from model projections.'}`;

  const improvementTips = [
    `Focus more on ${topSport.label} where you have a proven edge.`,
    `Reduce your unit size on ${worstType.label} until your win rate stabilizes.`,
    alignmentScore < 50 ? "Try cross-referencing your picks with the Vantage Model before locking them in." : "Your model alignment is strong; focus on finding better closing line value.",
    lossChasing ? "Warning: Loss chasing behavior detected. Stick to flat betting after a loss." : "Excellent bankroll discipline; your unit sizing is consistent."
  ];

  return {
    summary,
    splits: {
      sport: sportSplits,
      betType: betTypeSplits,
      tendency: tendencySplits
    },
    modelAlignment: {
      grade: alignmentGrade,
      alignmentPercentage: alignmentScore,
      alternativeBankroll: alternativeProfit,
      actualBankrollDelta: settledBets.reduce((sum, b) => sum + (b.status === 'won' ? b.potentialWinnings - b.stake : -b.stake), 0)
    },
    bankrollDiscipline: {
      grade: sizingConsistency > 80 ? 'A' : sizingConsistency > 60 ? 'B' : 'C',
      isLossChasing: lossChasing,
      sizingConsistencyScore: sizingConsistency
    },
    clvTracking: {
      beatTheLineRate: clvCount > 0 ? (settledBets.filter(b => {
          const pred = predictionsMap.get(b.gameId);
          if (!pred || b.betType !== 'spread' || b.line === undefined) return false;
          // Simplified "beat the line" check
          const isHome = b.pick.includes(pred.homeTeam);
          return isHome ? (pred.marketSpread > b.line) : (pred.marketSpread < b.line);
      }).length / clvCount) * 100 : 0,
      averageEdge: clvCount > 0 ? clvSum / clvCount : 0
    },
    biasAlerts,
    improvementTips
  };
}


