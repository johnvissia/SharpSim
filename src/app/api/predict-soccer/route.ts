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
  projectedSpread: number;
  marketSpread: number | null;
  recommendedSide: string | null;
  modelPick: string | null;
  coverProb: number;
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

  // UCL Giants & Matchday Clubs
  'real madrid': { att: 0.56, def: -0.40 },
  'barcelona': { att: 0.50, def: -0.35 },
  'bayern munich': { att: 0.55, def: -0.38 },
  'inter milan': { att: 0.45, def: -0.40 },
  'internazionale': { att: 0.45, def: -0.40 },
  'paris saint-germain': { att: 0.44, def: -0.32 },
  'psg': { att: 0.44, def: -0.32 },
  'bayer leverkusen': { att: 0.42, def: -0.30 },
  'atletico madrid': { att: 0.35, def: -0.38 },
  'atlético madrid': { att: 0.35, def: -0.38 },
  'borussia dortmund': { att: 0.36, def: -0.22 },
  'dortmund': { att: 0.36, def: -0.22 },
  'juventus': { att: 0.30, def: -0.30 },
  'sporting cp': { att: 0.32, def: -0.18 },
  'sporting lisbon': { att: 0.32, def: -0.18 },
  'benfica': { att: 0.28, def: -0.15 },
  'fc porto': { att: 0.26, def: -0.15 },
  'porto': { att: 0.26, def: -0.15 },
  'as roma': { att: 0.26, def: -0.14 },
  'roma': { att: 0.26, def: -0.14 },
  'villarreal': { att: 0.25, def: -0.14 },
  'rb leipzig': { att: 0.30, def: -0.18 },
  'leipzig': { att: 0.30, def: -0.18 },
  'monaco': { att: 0.24, def: -0.12 },
  'psv eindhoven': { att: 0.22, def: -0.10 },
  'psv': { att: 0.22, def: -0.10 },
  'real betis': { att: 0.20, def: -0.10 },
  'betis': { att: 0.20, def: -0.10 },
  'feyenoord': { att: 0.18, def: -0.08 },
  'feyenoord rotterdam': { att: 0.18, def: -0.08 },
  'lille': { att: 0.16, def: -0.08 },
  'stuttgart': { att: 0.15, def: -0.06 },
  'vfb stuttgart': { att: 0.15, def: -0.06 },
  'bologna': { att: 0.12, def: -0.05 },
  'girona': { att: 0.10, def: -0.05 },
  'napoli': { att: 0.28, def: -0.25 },
  'fenerbahce': { att: 0.08, def: 0.00 },
  'fenerbahçe': { att: 0.08, def: 0.00 },
  'club brugge': { att: 0.06, def: 0.02 },
  'brugge': { att: 0.06, def: 0.02 },
  'celtic': { att: 0.02, def: 0.05 },
  'shakhtar donetsk': { att: 0.00, def: 0.08 },
  'shakhtar': { att: 0.00, def: 0.08 },
  'brest': { att: -0.04, def: 0.12 },
  'como': { att: -0.05, def: 0.10 },
  'bodo/glimt': { att: -0.04, def: 0.12 },
  'bodø/glimt': { att: -0.04, def: 0.12 },
  'dinamo zagreb': { att: -0.05, def: 0.12 },
  'salzburg': { att: -0.06, def: 0.14 },
  'sparta prague': { att: -0.08, def: 0.15 },
  'slavia prague': { att: -0.08, def: 0.15 },
  'red star belgrade': { att: -0.10, def: 0.18 },
  'sturm graz': { att: -0.12, def: 0.20 },
  'lask linz': { att: -0.12, def: 0.20 },
  'lask': { att: -0.12, def: 0.20 },
  'young boys': { att: -0.15, def: 0.22 },
  'aek athens': { att: -0.15, def: 0.22 },
  'aek': { att: -0.15, def: 0.22 },
  'slovan bratislava': { att: -0.22, def: 0.28 },
  'slovan': { att: -0.22, def: 0.28 },
  'sabah fk': { att: -0.35, def: 0.40 },
  'sabah': { att: -0.35, def: 0.40 },
  'viking fk': { att: -0.25, def: 0.30 },
  'lens': { att: 0.08, def: 0.02 },
  'galatasaray': { att: 0.10, def: 0.00 },
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

function formatSpread(points: number): string {
  if (points === 0) return 'PK';
  return points > 0 ? `+${points}` : `${points}`;
}

function generateDixonColesPrediction(
  home: string,
  away: string,
  league: string,
  inputMarketSpread?: number | null
): SoccerPrediction {
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

  // Matrix of probabilities for exact scores (h, a)
  const scoreProbs: Array<{ h: number; a: number; prob: number }> = [];

  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      let prob = poissonProb(h, lambdaHome) * poissonProb(a, lambdaAway);

      // Dixon-Coles tau adjustment
      if (h === 0 && a === 0) prob *= (1.0 - lambdaHome * lambdaAway * rho);
      else if (h === 1 && a === 0) prob *= (1.0 + lambdaAway * rho);
      else if (h === 0 && a === 1) prob *= (1.0 + lambdaHome * rho);
      else if (h === 1 && a === 1) prob *= (1.0 - rho);

      scoreProbs.push({ h, a, prob });

      if (h > a) pHome += prob;
      else if (h === a) pDraw += prob;
      else pAway += prob;
    }
  }

  const total = pHome + pDraw + pAway || 1;
  const winHome = Math.round((pHome / total) * 100);
  const draw = Math.round((pDraw / total) * 100);
  const winAway = Math.round((pAway / total) * 100);

  // Goal margin (Home - Away)
  const margin = parseFloat((lambdaHome - lambdaAway).toFixed(2));
  // In betting spread terms (Home perspective), projectedSpread = -margin
  const projectedSpread = parseFloat((-margin).toFixed(2));

  // Determine market spread: use provided market spread or derive standard consensus Asian handicap
  let marketSpread: number;
  if (inputMarketSpread !== undefined && inputMarketSpread !== null) {
    marketSpread = inputMarketSpread;
  } else {
    // Benchmark handicap line rounded to nearest 0.5 (e.g. -1.5, -0.5, 0, +0.5, +1.5)
    marketSpread = -Math.round(margin * 2) / 2;
  }

  // Calculate cover probabilities for the spread (Home covers if (h - a) > -marketSpread)
  const targetThreshold = -marketSpread;
  let pHomeCover = 0;
  let pAwayCover = 0;

  for (const item of scoreProbs) {
    const diff = item.h - item.a;
    if (diff > targetThreshold) {
      pHomeCover += item.prob;
    } else if (diff < targetThreshold) {
      pAwayCover += item.prob;
    }
    // push outcomes (diff === targetThreshold) refund stake at standard -110 spread books
  }

  const totalDecisionProb = pHomeCover + pAwayCover || 1;
  const homeCoverProb = Math.round((pHomeCover / totalDecisionProb) * 100);
  const awayCoverProb = Math.round((pAwayCover / totalDecisionProb) * 100);

  // Edge in goals: marketSpread - projectedSpread
  const edge = parseFloat((marketSpread - projectedSpread).toFixed(2));
  const absEdge = Math.abs(edge);
  const zScore = parseFloat((edge / 1.25).toFixed(2));

  let recommendedSide: string;
  let pickSpreadStr: string;
  let coverProb: number;

  if (homeCoverProb >= awayCoverProb) {
    recommendedSide = home;
    pickSpreadStr = formatSpread(marketSpread);
    coverProb = homeCoverProb;
  } else {
    recommendedSide = away;
    // Away spread is opposite of home spread
    pickSpreadStr = formatSpread(-marketSpread);
    coverProb = awayCoverProb;
  }

  const modelPick = `${recommendedSide} ${pickSpreadStr}`;

  // Evaluate Value Signal against standard -110 spread benchmark (~52.4% break-even)
  // Standard deviation for soccer spreads is ~1.25 goals.
  // A true edge requires significant discrepancy between projected margin and market spread (absEdge).
  // A 0.1 or 0.2 goal edge is statistical noise and must be classified as 'No Play'.
  let betSignal: BetSignal = 'No Play';
  let confidence = 'No Play';

  if (absEdge >= 1.05 && coverProb >= 58) {
    betSignal = 'ELITE VALUE';
    confidence = 'High Edge';
  } else if (absEdge >= 0.70 && coverProb >= 55) {
    betSignal = 'STRONG VALUE';
    confidence = 'Solid Edge';
  } else if (absEdge >= 0.35 && coverProb >= 52.5) {
    betSignal = 'PLAYABLE';
    confidence = 'Lean';
  } else {
    betSignal = 'No Play';
    confidence = 'No Play';
  }

  return {
    homeTeam: home,
    awayTeam: away,
    predictedHomeGoals: parseFloat(lambdaHome.toFixed(2)),
    predictedAwayGoals: parseFloat(lambdaAway.toFixed(2)),
    predictedMargin: margin,
    projectedSpread,
    marketSpread,
    recommendedSide,
    modelPick,
    coverProb,
    winProbHome: winHome,
    winProbAway: winAway,
    drawProb: draw,
    betSignal,
    confidence,
    zScore,
    marketLine: marketSpread,
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

  const marketSpreadParam = searchParams.get('marketSpread');
  const hasExplicitMarketSpread = marketSpreadParam !== null && marketSpreadParam !== 'null' && marketSpreadParam !== '';
  let marketSpread = hasExplicitMarketSpread ? parseFloat(marketSpreadParam!) : null;

  // If no explicit market spread passed, look for one from daily_games
  if (marketSpread === null) {
    marketSpread = await findMarketSpreadFromDailyGames(home, away);
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
        const winHome = Math.round(data.p_home * 100);
        const winAway = Math.round(data.p_away * 100);
        const draw = Math.round(data.p_draw * 100);

        const lamHome = parseFloat(data.lambda_home);
        const lamAway = parseFloat(data.lambda_away);
        const margin = parseFloat((lamHome - lamAway).toFixed(2));
        const projectedSpread = parseFloat((-margin).toFixed(2));

        const effectiveSpread = marketSpread !== null ? marketSpread : -Math.round(margin * 2) / 2;
        const edge = parseFloat((effectiveSpread - projectedSpread).toFixed(2));
        const zScore = parseFloat((edge / 1.25).toFixed(2));

        // Evaluate cover probability
        let pHomeCover = 0;
        let pAwayCover = 0;
        const targetThreshold = -effectiveSpread;
        for (let h = 0; h <= 6; h++) {
          for (let a = 0; a <= 6; a++) {
            const prob = poissonProb(h, lamHome) * poissonProb(a, lamAway);
            if (h - a > targetThreshold) pHomeCover += prob;
            else if (h - a < targetThreshold) pAwayCover += prob;
          }
        }
        const totalCover = pHomeCover + pAwayCover || 1;
        const homeCoverProb = Math.round((pHomeCover / totalCover) * 100);
        const awayCoverProb = Math.round((pAwayCover / totalCover) * 100);

        const isHomePick = homeCoverProb >= awayCoverProb;
        const recommendedSide = isHomePick ? data.home_team : data.away_team;
        const pickSpreadStr = isHomePick ? formatSpread(effectiveSpread) : formatSpread(-effectiveSpread);
        const coverProb = Math.max(homeCoverProb, awayCoverProb);

        let bestSignal: BetSignal = 'No Play';
        if (coverProb >= 60 || Math.abs(zScore) >= 0.75) bestSignal = 'ELITE VALUE';
        else if (coverProb >= 55 || Math.abs(zScore) >= 0.45) bestSignal = 'STRONG VALUE';
        else if (coverProb >= 53) bestSignal = 'PLAYABLE';

        return NextResponse.json({
          homeTeam: data.home_team,
          awayTeam: data.away_team,
          predictedHomeGoals: parseFloat(lamHome.toFixed(2)),
          predictedAwayGoals: parseFloat(lamAway.toFixed(2)),
          predictedMargin: margin,
          projectedSpread,
          marketSpread: effectiveSpread,
          recommendedSide,
          modelPick: `${recommendedSide} ${pickSpreadStr}`,
          coverProb,
          winProbHome: winHome,
          winProbAway: winAway,
          drawProb: draw,
          betSignal: bestSignal,
          confidence: coverProb >= 60 ? 'High Edge' : (coverProb >= 55 ? 'Solid Edge' : 'Lean'),
          zScore,
          marketLine: effectiveSpread,
        } satisfies SoccerPrediction);
      }
    } catch {
      // Microservice offline, fall through
    }
  }

  // 2. Fallback: Check saved Firestore model_predictions
  try {
    const firestorePred = await getFirestorePrediction(home, away, league, marketSpread);
    if (firestorePred) {
      return NextResponse.json(firestorePred);
    }
  } catch (err) {
    console.warn('[predict-soccer] Firestore fallback lookup failed:', err);
  }

  // 3. Robust In-Process Dixon-Coles Poisson Engine
  const prediction = generateDixonColesPrediction(home, away, league, marketSpread);
  return NextResponse.json(prediction);
}

async function findMarketSpreadFromDailyGames(home: string, away: string): Promise<number | null> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const homeNorm = norm(home);
  const awayNorm = norm(away);

  try {
    const docs = await getRestCollectionDocs('daily_games', 80);
    for (const d of docs) {
      const dHome = norm(d.homeTeam || '');
      const dAway = norm(d.awayTeam || '');
      const match = (dHome.includes(homeNorm) || homeNorm.includes(dHome)) &&
                    (dAway.includes(awayNorm) || awayNorm.includes(dAway));
      if (match && d.bookmakerOdds && d.bookmakerOdds.length > 0) {
        for (const bo of d.bookmakerOdds) {
          try {
            const bm = typeof bo === 'string' ? JSON.parse(bo) : bo;
            const sm = bm.markets?.find((m: any) => m.key === 'spreads');
            if (sm && sm.outcomes) {
              const homeOutcome = sm.outcomes.find((o: any) => norm(o.name).includes(homeNorm) || homeNorm.includes(norm(o.name)));
              if (homeOutcome && typeof homeOutcome.point === 'number') {
                return homeOutcome.point;
              }
            }
          } catch { }
        }
      }
    }
  } catch { }
  return null;
}

async function getFirestorePrediction(
  home: string,
  away: string,
  _league: string,
  inputMarketSpread?: number | null
): Promise<SoccerPrediction | null> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const homeNorm = norm(home);
  const awayNorm = norm(away);

  const checkMatch = (data: any): SoccerPrediction | null => {
    const dHome = norm(data.homeTeam || '');
    const dAway = norm(data.awayTeam || '');
    const isMatch = (dHome.includes(homeNorm) || homeNorm.includes(dHome)) &&
                    (dAway.includes(awayNorm) || awayNorm.includes(dAway));

    if (isMatch && data.predictedHomeGoals !== undefined && data.predictedAwayGoals !== undefined) {
      const hG = Number(data.predictedHomeGoals);
      const aG = Number(data.predictedAwayGoals);
      const margin = parseFloat((hG - aG).toFixed(2));
      const projectedSpread = parseFloat((-margin).toFixed(2));
      const effectiveSpread = inputMarketSpread !== undefined && inputMarketSpread !== null
        ? inputMarketSpread
        : (data.marketSpread !== undefined ? Number(data.marketSpread) : -Math.round(margin * 2) / 2);

      const edge = parseFloat((effectiveSpread - projectedSpread).toFixed(2));
      const zScore = parseFloat((edge / 1.25).toFixed(2));
      const isHomeFavored = edge >= 0;
      const recSide = isHomeFavored ? data.homeTeam : data.awayTeam;
      const pickSpread = isHomeFavored ? effectiveSpread : -effectiveSpread;
      const pickSpreadStr = formatSpread(pickSpread);

      return {
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        predictedHomeGoals: hG,
        predictedAwayGoals: aG,
        predictedMargin: margin,
        projectedSpread,
        marketSpread: effectiveSpread,
        recommendedSide: recSide,
        modelPick: `${recSide} ${pickSpreadStr}`,
        coverProb: Math.round(52.4 + Math.min(Math.abs(zScore) * 12, 35)),
        winProbHome: Number(data.winProbHome ?? 0),
        winProbAway: Number(data.winProbAway ?? 0),
        drawProb: Number(data.drawProb ?? 0),
        betSignal: (data.betSignal as BetSignal) ?? 'No Play',
        confidence: Math.abs(zScore) >= 0.75 ? 'High Edge' : (Math.abs(zScore) >= 0.45 ? 'Solid Edge' : 'Lean'),
        zScore,
        marketLine: effectiveSpread,
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
