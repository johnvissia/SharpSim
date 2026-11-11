export interface TopScoreline {
  homeScore: number;
  awayScore: number;
  prob: number;
  label: string;
}

export interface SoccerMatchInsights {
  btts: {
    recommendation: 'BTTS - YES' | 'BTTS - NO';
    probYes: number;
    probNo: number;
    signal: 'HIGH VALUE' | 'VALUE LEAN' | 'DEFENSIVE ANGLE';
    badgeColor: string;
    reasoning: string;
  };
  totals: {
    recommendation: 'OVER 2.5 GOALS' | 'OVER 3.5 GOALS' | 'UNDER 2.5 GOALS' | 'BALANCED 2.5';
    totalExpectedGoals: number;
    over25Prob: number;
    under25Prob: number;
    over35Prob: number;
    badgeColor: string;
    reasoning: string;
  };
  marketAngle: {
    type: 'Handicap' | 'Draw No Bet' | 'Moneyline Value';
    pick: string;
    badgeColor: string;
    reasoning: string;
  };
  topScores: TopScoreline[];
  profile: {
    label: string;
    badgeColor: string;
    homeCleanSheetProb: number;
    awayCleanSheetProb: number;
  };
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export function computeSoccerMatchInsights(
  homeTeam: string,
  awayTeam: string,
  homeGoals: number,
  awayGoals: number,
  winProbHome: number,
  winProbAway: number,
  drawProb: number
): SoccerMatchInsights {
  const hG = Math.max(0.2, homeGoals || 1.2);
  const aG = Math.max(0.2, awayGoals || 1.0);
  const totalG = hG + aG;

  // 1. BTTS Calculation
  const pHomeScores = 1 - Math.exp(-hG);
  const pAwayScores = 1 - Math.exp(-aG);
  const rawBttsYes = pHomeScores * pAwayScores;
  const probYes = Math.round(rawBttsYes * 100);
  const probNo = 100 - probYes;

  const isSweetSpotBtts = (hG >= 1.15 && aG >= 1.15) || probYes >= 53;
  const isOneSided = hG <= 0.85 || aG <= 0.85;

  let bttsRec: 'BTTS - YES' | 'BTTS - NO' = 'BTTS - YES';
  let bttsSignal: 'HIGH VALUE' | 'VALUE LEAN' | 'DEFENSIVE ANGLE' = 'VALUE LEAN';
  let bttsBadgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  let bttsReasoning = '';

  if (isSweetSpotBtts && !isOneSided) {
    bttsRec = 'BTTS - YES';
    bttsSignal = 'HIGH VALUE';
    bttsBadgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    bttsReasoning = `Both sides project in active scoring range (${awayTeam} ${aG.toFixed(1)}, ${homeTeam} ${hG.toFixed(1)}). ${probYes}% BTTS probability.`;
  } else if (isOneSided) {
    bttsRec = 'BTTS - NO';
    bttsSignal = 'DEFENSIVE ANGLE';
    bttsBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    const lowSide = hG < aG ? homeTeam : awayTeam;
    const lowVal = Math.min(hG, aG).toFixed(1);
    const shutoutPct = Math.round(Math.exp(-Math.min(hG, aG)) * 100);
    bttsReasoning = `${lowSide} capped at ${lowVal} projected goals (${shutoutPct}% shutout rate). Favors BTTS - No.`;
  } else {
    bttsRec = probYes >= 50 ? 'BTTS - YES' : 'BTTS - NO';
    bttsSignal = 'VALUE LEAN';
    bttsBadgeColor = probYes >= 50 ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-700/50 text-slate-300 border-slate-600';
    bttsReasoning = `${probYes}% probability based on ${aG.toFixed(1)} to ${hG.toFixed(1)} expected goals.`;
  }

  // 2. Totals Calculation (Under 2.5 vs Over 2.5 / 3.5)
  const p0 = Math.exp(-totalG);
  const p1 = totalG * Math.exp(-totalG);
  const p2 = (Math.pow(totalG, 2) / 2) * Math.exp(-totalG);
  const p3 = (Math.pow(totalG, 3) / 6) * Math.exp(-totalG);

  const rawUnder25 = p0 + p1 + p2;
  const over25Prob = Math.round((1 - rawUnder25) * 100);
  const under25Prob = 100 - over25Prob;
  const over35Prob = Math.round((1 - (p0 + p1 + p2 + p3)) * 100);

  let totalsRec: 'OVER 2.5 GOALS' | 'OVER 3.5 GOALS' | 'UNDER 2.5 GOALS' | 'BALANCED 2.5' = 'OVER 2.5 GOALS';
  let totalsBadgeColor = 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
  let totalsReasoning = '';

  if (totalG >= 3.4) {
    totalsRec = 'OVER 3.5 GOALS';
    totalsBadgeColor = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    totalsReasoning = `High total expectancy of ${totalG.toFixed(1)} goals (${over25Prob}% Over 2.5, ${over35Prob}% Over 3.5).`;
  } else if (totalG >= 2.65) {
    totalsRec = 'OVER 2.5 GOALS';
    totalsBadgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    totalsReasoning = `${totalG.toFixed(1)} expected combined goals. ${over25Prob}% probability of 3+ goals.`;
  } else if (totalG <= 2.25) {
    totalsRec = 'UNDER 2.5 GOALS';
    totalsBadgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    totalsReasoning = `Low-scoring pace of ${totalG.toFixed(1)} expected goals. ${under25Prob}% Under 2.5 probability.`;
  } else {
    totalsRec = 'BALANCED 2.5';
    totalsBadgeColor = 'bg-slate-700/50 text-slate-300 border-slate-600';
    totalsReasoning = `Neutral pace near the market line (${totalG.toFixed(1)} expected goals).`;
  }

  // 3. Market Angle & Spread/Handicap
  const margin = hG - aG;
  let marketAngle: SoccerMatchInsights['marketAngle'];

  if (Math.abs(margin) >= 1.6) {
    const heavyFav = margin > 0 ? homeTeam : awayTeam;
    marketAngle = {
      type: 'Handicap',
      pick: `${heavyFav} -1.5 Asian Handicap`,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      reasoning: `+${Math.abs(margin).toFixed(1)} goal margin edge indicates multi-goal cover potential.`,
    };
  } else if (drawProb >= 28 && Math.abs(margin) <= 0.6) {
    const slightFav = winProbHome >= winProbAway ? homeTeam : awayTeam;
    marketAngle = {
      type: 'Draw No Bet',
      pick: `${slightFav} Draw No Bet (DNB)`,
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      reasoning: `${drawProb}% draw rate. DNB eliminates draw risk.`,
    };
  } else {
    const fav = winProbHome >= winProbAway ? homeTeam : awayTeam;
    marketAngle = {
      type: 'Moneyline Value',
      pick: `${fav} ML`,
      badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      reasoning: `${Math.max(winProbHome, winProbAway)}% win probability.`,
    };
  }

  // 4. Top 3 Exact Scores
  const scoreGrid: Array<{ h: number; a: number; p: number }> = [];
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      scoreGrid.push({ h: i, a: j, p: poisson(i, hG) * poisson(j, aG) });
    }
  }
  scoreGrid.sort((x, y) => y.p - x.p);

  const topScores: TopScoreline[] = scoreGrid.slice(0, 3).map(s => ({
    homeScore: s.h,
    awayScore: s.a,
    prob: Math.round(s.p * 100),
    label: `${awayTeam} ${s.a} – ${s.h} ${homeTeam}`,
  }));

  // 5. Match Profile & Clean Sheet Odds
  const homeCleanSheetProb = Math.round(Math.exp(-aG) * 100);
  const awayCleanSheetProb = Math.round(Math.exp(-hG) * 100);

  let profileLabel = 'Competitive Clash';
  let profileBadge = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';

  if (Math.abs(margin) >= 1.6) {
    profileLabel = 'Lopsided Fixture';
    profileBadge = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  } else if (totalG >= 3.2) {
    profileLabel = 'High-Scoring Shootout';
    profileBadge = 'bg-orange-500/20 text-orange-300 border-orange-500/30';
  } else if (totalG <= 2.2) {
    profileLabel = 'Defensive Duel';
    profileBadge = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  }

  return {
    btts: {
      recommendation: bttsRec,
      probYes,
      probNo,
      signal: bttsSignal,
      badgeColor: bttsBadgeColor,
      reasoning: bttsReasoning,
    },
    totals: {
      recommendation: totalsRec,
      totalExpectedGoals: parseFloat(totalG.toFixed(1)),
      over25Prob,
      under25Prob,
      over35Prob,
      badgeColor: totalsBadgeColor,
      reasoning: totalsReasoning,
    },
    marketAngle,
    topScores,
    profile: {
      label: profileLabel,
      badgeColor: profileBadge,
      homeCleanSheetProb,
      awayCleanSheetProb,
    },
  };
}
