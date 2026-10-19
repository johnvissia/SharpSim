/**
 * scripts/record_ucl_predictions.js
 * ---------------------------------
 * 1. Fetches tomorrow's (2026-10-14) UCL schedule from ESPN.
 * 2. Runs each matchup through the UCL Dixon-Coles Cross-League Engine (port 8001).
 * 3. Formats predictions into SharpSim standardized model prediction schema.
 * 4. Signs in anonymously and records/updates each snapshot in Firestore `model_predictions`.
 */

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCsZFIQYt7yAUpRKM1-KZB0dg36_0WBSQE';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'studio-5044041186-4b498';

async function getAuthToken() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  const data = await authRes.json();
  if (!data.idToken) {
    throw new Error('Failed to get auth token: ' + JSON.stringify(data));
  }
  return data.idToken;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: String(value) };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreFields(value) } };
    }
  }
  return fields;
}

async function recordUCLFixture(authToken, pred) {
  const docId = pred.gameId;
  const fields = toFirestoreFields(pred);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/model_predictions/${docId}?key=${API_KEY}`;
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ fields })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore save failed for ${docId}: ${errText}`);
  }
  return await res.json();
}

async function run() {
  console.log('🚀 Running analysis for Tomorrow\'s UEFA Champions League Fixtures (Oct 14, 2026)...');
  
  const token = await getAuthToken();
  console.log('🔑 Authenticated with Firebase Auth successfully.');

  // Fetch ESPN schedule for Oct 14, 2026
  const espnRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20261014');
  const espnData = await espnRes.json();
  const events = espnData.events || [];

  console.log(`📋 Found ${events.length} UCL events scheduled for tomorrow.\n`);

  const results = [];

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const homeComp = comp.competitors.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) continue;

    const gameId = event.id;
    const homeTeam = homeComp.team.displayName;
    const startTime = event.date;
    const gameTime = new Date(startTime);
    const timeUntilStart = gameTime.getTime() - Date.now();

    // 15-Minute Freeze Rule: Accuracy predictions freeze 15 minutes before kickoff and cannot be changed
    if (timeUntilStart <= 15 * 60 * 1000) {
      console.log(`🔒 [UCL] ${awayTeam} @ ${homeTeam} is within 15m of kickoff or in progress (${Math.round(timeUntilStart / 60000)}m to start). Prediction is FROZEN — skipping overwrite.`);
      continue;
    }

    // Default bookmaker odds (synthetic or approximate fair market line based on general European markets)
    // Query UCL FastAPI Engine
    const uclApiUrl = `http://localhost:8001/api/v1/ucl/predict?home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`;
    const modelRes = await fetch(uclApiUrl);
    if (!modelRes.ok) {
      console.error(`❌ Model prediction failed for ${awayTeam} @ ${homeTeam}:`, await modelRes.text());
      continue;
    }
    const m = await modelRes.json();

    const lambdaHome = parseFloat(m.lambda_home.toFixed(2));
    const lambdaAway = parseFloat(m.lambda_away.toFixed(2));
    const margin = parseFloat((lambdaAway - lambdaHome).toFixed(2)); // SharpSim convention: <0 is home favorite, >0 is away favorite
    const winH = Math.round(m.p_home * 100);
    const winA = Math.round(m.p_away * 100);
    const draw = Math.round(m.p_draw * 100);
    const over25 = Math.round(m.p_over25 * 100);
    const btts = Math.round(m.p_btts_yes * 100);
    const mostLikelyScore = typeof m.most_likely_score === 'string' ? m.most_likely_score : (m.most_likely_score ? `${m.most_likely_score[0]}-${m.most_likely_score[1]}` : '1-1');

    // Model pick
    let recommendedSide = null;
    let betSignal = 'No Play';
    const zScore = parseFloat((margin / 1.15).toFixed(2));

    if (m.signals && m.signals.length > 0) {
      const topSig = m.signals[0];
      if (topSig.signal === 'STRONG_VALUE') betSignal = 'ELITE VALUE';
      else if (topSig.signal === 'VALUE') betSignal = 'STRONG VALUE';
      else betSignal = 'PLAYABLE';

      if (topSig.outcome === 'home') recommendedSide = homeTeam;
      else if (topSig.outcome === 'away') recommendedSide = awayTeam;
      else if (topSig.outcome === 'draw') recommendedSide = 'Draw';
    } else {
      if (m.p_home >= 0.52) {
        recommendedSide = homeTeam;
        betSignal = m.p_home >= 0.65 ? 'ELITE VALUE' : 'STRONG VALUE';
      } else if (m.p_away >= 0.52) {
        recommendedSide = awayTeam;
        betSignal = m.p_away >= 0.65 ? 'ELITE VALUE' : 'STRONG VALUE';
      } else if (margin < -0.35) {
        recommendedSide = homeTeam;
        betSignal = 'PLAYABLE';
      } else if (margin > 0.35) {
        recommendedSide = awayTeam;
        betSignal = 'PLAYABLE';
      } else {
        recommendedSide = 'Draw';
        betSignal = 'No Play';
      }
    }

    const docData = {
      gameId,
      sport: 'UCL',
      homeTeam,
      awayTeam,
      startTime,
      snapshotTime: new Date().toISOString(),
      marketSpread: 0.0,
      spreadSource: 'PK (Pick\'em)',
      projectedSpread: margin,
      zScore,
      betSignal,
      recommendedSide,
      status: 'pending',
      actualScore: null,
      actualSpread: null,
      correct: null,
      predictedHomeGoals: lambdaHome,
      predictedAwayGoals: lambdaAway,
      winProbHome: winH,
      drawProb: draw,
      winProbAway: winA,
      pOver25: over25,
      pBtts: btts,
      mostLikelyScore
    };

    await recordUCLFixture(token, docData);
    console.log(`✅ Recorded [UCL] ${awayTeam} @ ${homeTeam}`);
    console.log(`   xG: ${lambdaHome} - ${lambdaAway} | Pick: ${recommendedSide} | Signal: ${betSignal} | Score: ${mostLikelyScore}`);

    results.push(docData);
  }

  console.log(`\n🎉 Successfully analyzed and recorded all ${results.length} UCL fixtures into Firestore!`);
}

run().catch(console.error);
