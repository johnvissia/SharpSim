import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getRestCollectionDocs } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

type BetSignal = 'ELITE VALUE' | 'STRONG VALUE' | 'PLAYABLE' | 'No Play';

interface SoccerPrediction {
  homeTeam: string;
  awayTeam: string;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  predictedMargin: number;
  modelPick: string | null;
  winProbHome: number;
  winProbAway: number;
  drawProb: number;
  betSignal: BetSignal;
  confidence: string;
  zScore: number;
  marketLine: number | null;
}

// Dixon-Coles attack/defense coefficients
const SOCCER_POWER_RATINGS: Record<string, { att: number; def: number }> = {
  // EPL
  'manchester city': { att: 0.58, def: -0.42 },
  'arsenal': { att: 0.52, def: -0.45 },
  'liverpool': { att: 0.54, def: -0.38 },
  'aston villa': { att: 0.32, def: -0.15 },
  'tottenham': { att: 0.36, def: -0.12 },
  'tottenham hotspur': { att: 0.36, def: -0.12 },
  'chelsea': { att: 0.28, def: -0.10 },
  'newcastle': { att: 0.25, def: -0.08 },
  'newcastle united': { att: 0.25, def: -0.08 },
  'manchester united': { att: 0.18, def: 0.02 },
  'brighton': { att: 0.16, def: 0.05 },
  'brighton & hove albion': { att: 0.16, def: 0.05 },
  'west ham': { att: 0.08, def: 0.12 },
  'west ham united': { att: 0.08, def: 0.12 },
  'fulham': { att: 0.02, def: 0.14 },
  'bournemouth': { att: 0.05, def: 0.16 },
  'afc bournemouth': { att: 0.05, def: 0.16 },
  'brentford': { att: 0.04, def: 0.18 },
  'crystal palace': { att: -0.02, def: 0.15 },
  'everton': { att: -0.08, def: 0.12 },
  'nottingham forest': { att: -0.05, def: 0.10 },
  'wolverhampton': { att: -0.12, def: 0.20 },
  'wolverhampton wanderers': { att: -0.12, def: 0.20 },
  'leicester': { att: -0.15, def: 0.25 },
  'leicester city': { att: -0.15, def: 0.25 },
  'ipswich': { att: -0.22, def: 0.32 },
  'ipswich town': { att: -0.22, def: 0.32 },
  'southampton': { att: -0.25, def: 0.35 },
  'coventry': { att: -0.18, def: 0.28 },
  'coventry city': { att: -0.18, def: 0.28 },
  'leeds': { att: -0.10, def: 0.22 },
  'leeds united': { att: -0.10, def: 0.22 },
  'sunderland': { att: -0.20, def: 0.30 },

  // UCL Giants
  'real madrid': { att: 0.56, def: -0.40 },
  'barcelona': { att: 0.50, def: -0.35 },
  'bayern munich': { att: 0.55, def: -0.38 },
  'inter milan': { att: 0.45, def: -0.40 },
  'paris saint-germain': { att: 0.44, def: -0.32 },
  'bayer leverkusen': { att: 0.42, def: -0.30 },
  'atletico madrid': { att: 0.35, def: -0.38 },
  'borussia dortmund': { att: 0.36, def: -0.22 },
  'juventus': { att: 0.30, def: -0.30 },
  'sporting cp': { att: 0.32, def: -0.18 },
  'benfica': { att: 0.28, def: -0.15 },
};

function resolveTeamRating(teamName: string) {
  const norm = teamName.toLowerCase().trim();
  if (SOCCER_POWER_RATINGS[norm]) return SOCCER_POWER_RATINGS[norm];

  for (const [k, v] of Object.entries(SOCCER_POWER_RATINGS)) {
    if (norm.includes(k) || k.includes(norm)) return v;
  }
  // Newly promoted / unlisted baseline
  return { att: -0.15, def: 0.25 };
}

function factorial(n: number): number {
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function poissonProb(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function generateDixonColesPrediction(home: string, away: string, league: string): SoccerPrediction {
  const homeRatings = resolveTeamRating(home);
  const awayRatings = resolveTeamRating(away);

  // Home field goal expectancy boost (+0.30 in EPL, +0.26 in UCL)
  const homeAdv = league === 'UCL' ? 0.26 : 0.30;

  const lambdaHome = Math.max(0.4, Math.min(4.5, Math.exp(homeRatings.att + awayRatings.def + homeAdv)));
  const lambdaAway = Math.max(0.2, Math.min(3.8, Math.exp(awayRatings.att + homeRatings.def)));

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  const rho = -0.05; // Dixon-Coles low scoring correlation parameter

  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      let prob = poissonProb(h, lambdaHome) * poissonProb(a, lambdaAway);

      // Dixon-Coles tau adjustment
      if (h === 0 && a === 0) prob *= (1.0 - lambdaHome * lambdaAway * rho);
      else if (h === 1 && a === 0) prob *= (1.0 + lambdaAway * rho);
      else if (h === 0 && a === 1) prob *= (1.0 + lambdaHome * rho);
      else if (h === 1 && a === 1) prob *= (1.0 - rho);

      if (h > a) pHome += prob;
      else if (h === a) pDraw += prob;
      else pAway += prob;
    }
  }

  const total = pHome + pDraw + pAway || 1;
  const winHome = Math.round((pHome / total) * 100);
  const draw = Math.round((pDraw / total) * 100);
  const winAway = Math.round((pAway / total) * 100);

  const margin = parseFloat((lambdaHome - lambdaAway).toFixed(2));
  let modelPick: string | null = null;
  if (winHome >= winAway && winHome >= draw) modelPick = home;
  else if (winAway >= winHome && winAway >= draw) modelPick = away;
  else modelPick = 'Draw';

  const zScore = parseFloat((margin / 1.15).toFixed(2));
  let betSignal: BetSignal = 'No Play';
  if (Math.abs(zScore) >= 1.0 || Math.max(winHome, winAway) >= 65) betSignal = 'ELITE VALUE';
  else if (Math.abs(zScore) >= 0.70 || Math.max(winHome, winAway) >= 54) betSignal = 'STRONG VALUE';
  else if (Math.abs(zScore) >= 0.40) betSignal = 'PLAYABLE';

  return {
    homeTeam: home,
    awayTeam: away,
    predictedHomeGoals: parseFloat(lambdaHome.toFixed(2)),
    predictedAwayGoals: parseFloat(lambdaAway.toFixed(2)),
    predictedMargin: margin,
    modelPick,
    winProbHome: winHome,
    winProbAway: winAway,
    drawProb: draw,
    betSignal,
    confidence: Math.abs(zScore) > 0.8 ? 'High' : 'Medium',
    zScore,
    marketLine: null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const home = searchParams.get('home');
  const away = searchParams.get('away');
  const league = (searchParams.get('league') ?? 'EPL').toUpperCase();

  if (!home || !away) {
    return NextResponse.json({ error: 'Missing required params: home, away' }, { status: 400 });
  }

  // 1. If league is EPL and microservice is running, attempt query
  if (league === 'EPL') {
    const fastApiUrl = process.env.EPL_API_URL || 'http://127.0.0.1:8000';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(
        `${fastApiUrl}/api/v1/epl/predict?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        let bestSignal: BetSignal = 'No Play';
        if (data.signals && data.signals.length > 0) {
          for (const s of data.signals) {
            if (s.signal === 'STRONG_VALUE') bestSignal = 'ELITE VALUE';
            else if (s.signal === 'VALUE' && bestSignal !== 'ELITE VALUE') bestSignal = 'STRONG VALUE';
          }
        }

        const winHome = Math.round(data.p_home * 100);
        const winAway = Math.round(data.p_away * 100);
        const draw = Math.round(data.p_draw * 100);

        let modelPick: string | null = null;
        if (data.p_home >= data.p_away && data.p_home >= data.p_draw) modelPick = data.home_team;
        else if (data.p_away >= data.p_home && data.p_away >= data.p_draw) modelPick = data.away_team;
        else modelPick = 'Draw';

        const zScore = parseFloat(((data.lambda_home - data.lambda_away) / 1.15).toFixed(2));

        return NextResponse.json({
          homeTeam: data.home_team,
          awayTeam: data.away_team,
          predictedHomeGoals: parseFloat(data.lambda_home.toFixed(2)),
          predictedAwayGoals: parseFloat(data.lambda_away.toFixed(2)),
          predictedMargin: parseFloat((data.lambda_home - data.lambda_away).toFixed(2)),
          modelPick,
          winProbHome: winHome,
          winProbAway: winAway,
          drawProb: draw,
          betSignal: bestSignal,
          confidence: Math.abs(zScore) > 0.8 ? 'High' : 'Medium',
          zScore,
          marketLine: null,
        } satisfies SoccerPrediction);
      }
    } catch {
      // Microservice offline, fall through
    }
  }

  // 2. Fallback: Check saved Firestore model_predictions
  try {
    const firestorePred = await getFirestorePrediction(home, away, league);
    if (firestorePred) {
      return NextResponse.json(firestorePred);
    }
  } catch (err) {
    console.warn('[predict-soccer] Firestore fallback lookup failed:', err);
  }

  // 3. Robust In-Process Dixon-Coles Poisson Engine
  const prediction = generateDixonColesPrediction(home, away, league);
  return NextResponse.json(prediction);
}

async function getFirestorePrediction(home: string, away: string, _league: string): Promise<SoccerPrediction | null> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const homeNorm = norm(home);
  const awayNorm = norm(away);

  const checkMatch = (data: any): SoccerPrediction | null => {
    const dHome = norm(data.homeTeam || '');
    const dAway = norm(data.awayTeam || '');
    const isMatch = (dHome.includes(homeNorm) || homeNorm.includes(dHome)) &&
                    (dAway.includes(awayNorm) || awayNorm.includes(dAway));

    if (isMatch && data.predictedHomeGoals !== undefined && data.predictedAwayGoals !== undefined) {
      return {
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        predictedHomeGoals: Number(data.predictedHomeGoals),
        predictedAwayGoals: Number(data.predictedAwayGoals),
        predictedMargin: parseFloat((Number(data.predictedHomeGoals) - Number(data.predictedAwayGoals)).toFixed(2)),
        modelPick: data.recommendedSide ?? null,
        winProbHome: Number(data.winProbHome ?? 0),
        winProbAway: Number(data.winProbAway ?? 0),
        drawProb: Number(data.drawProb ?? 0),
        betSignal: (data.betSignal as BetSignal) ?? 'No Play',
        confidence: Math.abs(data.zScore ?? 0) > 0.8 ? 'High' : 'Medium',
        zScore: Number(data.zScore ?? 0),
        marketLine: data.marketSpread !== undefined ? Number(data.marketSpread) : null,
      };
    }
    return null;
  };

  try {
    if (db) {
      const snap = await db.collection('model_predictions').where('sport', '==', 'EPL').limit(50).get();
      for (const doc of snap.docs) {
        const res = checkMatch(doc.data());
        if (res) return res;
      }
    } else {
      const docs = await getRestCollectionDocs('model_predictions', 50);
      for (const d of docs) {
        if (d.sport === 'EPL' || d.sport === 'UCL') {
          const res = checkMatch(d);
          if (res) return res;
        }
      }
    }
  } catch {
    // Return null to allow fallback to calculate
  }
  return null;
}
