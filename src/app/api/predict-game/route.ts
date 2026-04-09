import { NextRequest, NextResponse } from 'next/server';
import {
    calculateDynamicHCA,
    calculateInjuryPenalty,
    calculateTeamAdaptationFactor,
    calculateZScoreEdge,
    checkSteam,
    type PlayerData,
    type RestContext
} from '@/lib/math-utils';
import { db } from '@/lib/firebase';
import { nbaTeamNameToAbbreviation } from '@/lib/nba-data';

export const dynamic = 'force-dynamic';


// Constants
const LEAGUE_AVG_PACE = 99.0; // Approximation, should be dynamic in full production
const SCHEDULE_RESIDUAL = 0; // Placeholder for Schedule Strength adjustment if not in Base

// Altitude Cities (Elevation > 1200m)
const altitudeTeams = ['Denver Nuggets', 'Utah Jazz'];

async function getTeamStats(abbrevOrName: string) {
    const normalized = abbrevOrName.trim();

    // 1. Try to resolve to an abbreviation first (canonical ID)
    let searchId = normalized.toUpperCase();

    // If it looks like a full name, map it to abbreviation
    if (nbaTeamNameToAbbreviation[normalized]) {
        searchId = nbaTeamNameToAbbreviation[normalized];
    } else {
        // Fallback: try different capitalizations for the mapping
        const titleCase = normalized.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (nbaTeamNameToAbbreviation[titleCase]) {
            searchId = nbaTeamNameToAbbreviation[titleCase];
        }
    }

    // 2. Fetch by Abbreviation (Primary Document ID)
    let doc = await db.collection('nba_team_stats').doc(searchId).get();
    if (doc.exists) return doc.data();

    // 3. Fallback: Search by teamName field if abbreviation lookup failed
    const snapshot = await db.collection('nba_team_stats').where('teamName', '==', normalized).limit(1).get();
    if (!snapshot.empty) return snapshot.docs[0].data();

    return null;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const homeName = searchParams.get('home');
    const awayName = searchParams.get('away');
    const marketSpreadStr = searchParams.get('marketSpread');
    const hasMarketSpread = marketSpreadStr !== null && marketSpreadStr !== 'null';
    const marketSpread = hasMarketSpread ? parseFloat(marketSpreadStr || '0') : 0;
    // Optional params for full verification
    const homeRestDays = parseInt(searchParams.get('homeRest') || '1');
    const awayRestDays = parseInt(searchParams.get('awayRest') || '1');

    if (!homeName || !awayName) {
        return NextResponse.json({ error: 'Missing home or away team name' }, { status: 400 });
    }

    try {
        const homeStats = await getTeamStats(homeName);
        const awayStats = await getTeamStats(awayName);

        // Helper to map stored injuries to PlayerData
        const mapInjuries = (stats: any): PlayerData[] => {
            if (!stats || !stats.injuries) return [];

            // Filter for significant injuries
            // Tank01 injury status varies, we look for "Out" or similar
            // And map to our PlayerData structure

            return stats.injuries.filter((inj: any) => {
                const status = inj.status?.toLowerCase() || '';
                const desc = inj.description?.toLowerCase() || '';

                // Broad check for unavailability
                const isOut = status.includes('out') || status.includes('injured') || status.includes('irp') || status.includes('doubtful') || status.includes('questionable');

                // FILTER 1: Ignore G-League/Two-Way/Assignment players as they have no impact on spread
                const isLowImpact = desc.includes('g league') || desc.includes('two-way') || desc.includes('assignment');

                // FILTER 2: Exclude Season-Ending injuries (already factored into Base Team Rating)
                const isSeasonEnding = desc.includes('surgery') || desc.includes('season') || desc.includes('achilles') || desc.includes('acl') || desc.includes('torn');

                return isOut && !isLowImpact && !isSeasonEnding;
            }).map((inj: any) => {
                // Heuristic for impact
                const name = inj.name || '';
                let estimatedVOR = 2.5; // Default starter
                let expectedMinutes = 30;

                const lowerName = name.toLowerCase();

                // ─── Player Impact Tier System ───────────────────────────────────────
                // Strategy: exact last-name matching is used for unique surnames.
                // For ambiguous last names (Mitchell, Brown, White, George, etc.)
                // we check the full name first to assign correct tier.
                // Tiers:
                //   MVP        → VOR 8.0  (top-5 MVP race)
                //   STAR       → VOR 6.0  (All-Star / franchise player)
                //   STARTER    → VOR 4.0  (quality starter, 28-34 mpg)
                //   ROTATION   → VOR 3.0  (key reserve, 18-27 mpg)
                //   DEFAULT    → VOR 2.5  (bench / fringe)

                const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
                const cn = clean(name); // cleaned version of this player's name

                // Full-name checks for disambiguation (checked before tier lists)
                // Returns a tier override if matched, else null
                const disambiguated = (() => {
                    // Mitchell disambiguation
                    if (cn.includes('donovanmitchell') || cn.includes('mitchelldonovan')) return 'mvp';
                    if (cn.includes('daviontmitchell') || cn.includes('mitchelldavion')) return 'rotation';
                    if (cn.includes('malik') && cn.includes('monk')) return 'starter';
                    // Brown disambiguation
                    if (cn.includes('jaylen') && cn.includes('brown')) return 'star';
                    if (cn.includes('bruce') && cn.includes('brown')) return 'rotation';
                    if (cn.includes('moses') && cn.includes('brown')) return 'rotation';
                    // White disambiguation
                    if (cn.includes('derrick') && cn.includes('white')) return 'starter';
                    if (cn.includes('coby') && cn.includes('white')) return 'starter';
                    if (cn.includes('haywood') && cn.includes('high')) return null; // not a real player match issue
                    // George disambiguation
                    if (cn.includes('paul') && cn.includes('george')) return 'star';
                    if (cn.includes('shai') || cn.includes('gilgeous')) return 'mvp';
                    // Curry
                    if (cn.includes('stephen') && cn.includes('curry')) return 'star';
                    if (cn.includes('seth') && cn.includes('curry')) return 'rotation';
                    if (cn.includes('steph') && cn.includes('curry')) return 'star';
                    // Leonard
                    if (cn.includes('kawhi') && cn.includes('leonard')) return 'star';
                    if (cn.includes('meyers') && cn.includes('leonard')) return 'rotation';
                    // Powell
                    if (cn.includes('norman') && cn.includes('powell')) return 'starter';
                    // Johnson disambiguation
                    if (cn.includes('jalen') && cn.includes('johnson') || cn.includes('jalenjohnson')) return 'starter';
                    if (cn.includes('keldon') && cn.includes('johnson')) return 'rotation';
                    if (cn.includes('stanley') && cn.includes('johnson')) return 'rotation';
                    // Jones disambiguation
                    if (cn.includes('tyus') && cn.includes('jones')) return 'rotation';
                    if (cn.includes('herb') && cn.includes('jones')) return 'rotation';
                    if (cn.includes('derrick') && cn.includes('jones')) return 'rotation';
                    // Williams disambiguation
                    if (cn.includes('grant') && cn.includes('williams')) return 'rotation';
                    if (cn.includes('robert') && cn.includes('williams')) return 'rotation';
                    if (cn.includes('ziaire') && cn.includes('williams')) return 'rotation';
                    if (cn.includes('mark') && cn.includes('williams')) return 'rotation';
                    if (cn.includes('vince') && cn.includes('williams')) return 'rotation';
                    return null;
                })();

                // ── Tier 1: MVP Candidates (VOR 8.0) ──────────────────────────────
                const MVP_LAST_NAMES = new Set([
                    'jokic',         // Nikola Jokic
                    'doncic',        // Luka Doncic
                    'cunningham',    // Cade Cunningham
                    'antetokounmpo', // Giannis
                    'brunson',       // Jalen Brunson
                    'edwards',       // Anthony Edwards
                    'wembanyama',    // Victor Wembanyama
                    'booker',        // Devin Booker
                ]);

                // ── Tier 2: Stars / All-Stars (VOR 6.0) ───────────────────────────
                const STAR_LAST_NAMES = new Set([
                    'tatum',       // Jayson Tatum
                    'morant',      // Ja Morant
                    'curry',       // Stephen Curry (full name guarded above)
                    'james',       // LeBron James
                    'durant',      // Kevin Durant
                    'lillard',     // Damian Lillard
                    'haliburton',  // Tyrese Haliburton
                    'sabonis',     // Domantas Sabonis
                    'fox',         // De'Aaron Fox
                    'markkanen',   // Lauri Markkanen
                    'banchero',    // Paolo Banchero
                    'williamson',  // Zion Williamson
                    'ingram',      // Brandon Ingram
                    'butler',      // Jimmy Butler (guarded above if needed)
                    'adebayo',     // Bam Adebayo
                    'young',       // Trae Young (guarded if needed)
                    'randle',      // Julius Randle
                    'leonard',     // Kawhi Leonard (full name guarded above)
                    'harden',      // James Harden
                    'irving',      // Kyrie Irving
                    'bane',        // Desmond Bane
                    'wagner',      // Franz Wagner
                    'george',      // Paul George (full name guarded above)
                    'sengun',      // Alperen Sengun
                    'holmgren',    // Chet Holmgren
                    'embiid',      // Joel Embiid
                    'siakam',      // Pascal Siakam
                    'maxey',       // Tyrese Maxey
                    'brown',       // Jaylen Brown (full name guarded above)
                    'mitchell',    // Donovan Mitchell (full name guarded above)
                    'nembhard',    // Andrew Nembhard -- rising star
                    'thompson',    // Klay Thompson
                ]);

                // ── Tier 3: Quality Starters (VOR 4.0) ────────────────────────────
                const STARTER_LAST_NAMES = new Set([
                    'murray',      // Jamal Murray
                    'derozan',     // DeMar DeRozan
                    'lavine',      // Zach LaVine
                    'vucevic',     // Nikola Vucevic
                    'white',       // Derrick/Coby White (guarded above)
                    'ball',        // LaMelo Ball
                    'garland',     // Darius Garland
                    'mobley',      // Evan Mobley
                    'allen',       // Jarrett Allen
                    'nurkic',      // Jusuf Nurkic
                    'beal',        // Bradley Beal
                    'russell',     // D'Angelo Russell
                    'ivey',        // Jaden Ivey
                    'simons',      // Anfernee Simons
                    'reaves',      // Austin Reaves
                    'kuminga',     // Jonathan Kuminga
                    'johnson',     // Jalen Johnson (full name guarded above)
                    'claxton',     // Nic Claxton
                    'powell',      // Norman Powell (full name guarded above)
                    'monk',        // Malik Monk (full name guarded above)
                    'agbaji',      // Ochai Agbaji
                    'green',       // Draymond Green
                    'poole',       // Jordan Poole
                    'brooks',      // Mikal Brooks
                    'oubre',       // Kelly Oubre
                    'hayward',     // Gordon Hayward
                    'bogdanovic',  // Bogdan Bogdanovic
                    'dinwiddie',   // Spencer Dinwiddie
                    'dejounte',    // Dejounte Murray (last name Murray guarded above)
                    'dejountemurray', // catch full-name cleaned
                    'bridges',     // Miles/Mikal Bridges
                    'poeltl',      // Jakob Poeltl
                    'gobert',      // Rudy Gobert
                    'robinson',    // Mitchell Robinson
                    'ntilikina',
                    'barrett',     // RJ Barrett
                    'anunoby',     // OG Anunoby
                    'quickley',    // Immanuel Quickley
                    'fournier',
                    'oladipo',     // Victor Oladipo
                    'neto',
                    'wiseman',     // James Wiseman
                    'scoot',       // Scoot Henderson (first name)
                    'henderson',   // Scoot Henderson
                    'mathurin',    // Bennedict Mathurin
                    'nwora',
                    'harris',      // Tobias Harris
                    'covington',
                    'mcbride',     // Miles McBride
                    'kuzma',       // Kyle Kuzma
                    'hardaway',    // Tim Hardaway Jr
                    'rozier',      // Terry Rozier
                    'dejean',      // Reed Dejean
                    'jones',       // Herb/Tyus Jones (guarded above)
                    'vanderbilt',  // Jarred Vanderbilt
                    'olynyk',
                    'brogdon',     // Malcolm Brogdon
                    'teague',
                    'okeke',       // Mo Bamba? No - Chuma Okeke
                    'johnson',
                ]);

                // ── Tier 4: Key Rotation Players (VOR 3.0) ────────────────────────
                const ROTATION_LAST_NAMES = new Set([
                    'huerter',     // Kevin Huerter
                    'clarkson',    // Jordan Clarkson
                    'nance',       // Larry Nance Jr.
                    'bogdanovic',  // Bojan Bogdanovic
                    'portis',      // Bobby Portis
                    'augustin',
                    'plumlee',     // Mason Plumlee
                    'nader',
                    'payton',      // Gary Payton II
                    'grant',       // Jerami Grant
                    'strus',       // Max Strus
                    'highsmith',   // Haywood Highsmith
                    'herro',       // Tyler Herro
                    'lowry',       // Kyle Lowry
                    'okoro',       // Isaac Okoro
                    'love',        // Kevin Love
                    'rubio',
                    'mccolllum',   // CJ McCollum
                    'mccollum',
                    'holiday',     // Jrue/Aaron Holiday
                    'noel',
                    'okogie',      // Josh Okogie
                    'finney',      // Finney-Smith
                    'finneysmith',
                    'mclemore',    // Ben McLemore - no
                    'burks',       // Alec Burks
                    'nwaba',
                    'goodwin',
                    'carter',      // Jevon Carter, etc.
                    'wiggins',     // Andrew Wiggins
                    'looney',      // Kevon Looney
                    'podzemski',   // Brandin Podzemski
                    'moody',       // Moses Moody
                    'klay',        // Klay Thompson - last name thompson above
                    'dillon',      // Dillon Brooks - also 'brooks' above
                    'heart',
                    'porzingis',   // Kristaps Porzingis
                    'kornet',
                    'hauser',      // Sam Hauser
                    'horford',     // Al Horford
                    'smart',       // Marcus Smart
                    'rozier',
                    'muscala',
                    'bitadze',
                    'toppin',      // Obi Toppin
                    'grimes',      // Quentin Grimes
                    'bogdanovic',
                    'winslow',
                    'bazley',      // Darius Bazley
                    'dort',        // Luguentz Dort
                    'mann',        // Terence Mann
                    'coffey',      // Amir Coffey
                    'george',
                    'zubac',       // Ivica Zubac
                    'leonard',
                    'jackson',     // Reggie Jackson
                    'nembhard',
                    'matisse',     // Matisse Thybulle
                    'thybulle',
                    'mcdaniel',    // Jaden McDaniels
                    'alexander',   // Kyle Alexander etc
                    'conley',      // Mike Conley
                    'mcdermott',   // Doug McDermott
                    'beverley',    // Patrick Beverley
                    'green',
                ]);

                // ── Determine tier ────────────────────────────────────────────────
                let playerTier: string;

                if (disambiguated) {
                    playerTier = disambiguated;
                } else if (MVP_LAST_NAMES.has(cn) || [...MVP_LAST_NAMES].some(n => cn.includes(n))) {
                    playerTier = 'mvp';
                } else if (STAR_LAST_NAMES.has(cn) || [...STAR_LAST_NAMES].some(n => cn.includes(n))) {
                    playerTier = 'star';
                } else if (STARTER_LAST_NAMES.has(cn) || [...STARTER_LAST_NAMES].some(n => cn.includes(n))) {
                    playerTier = 'starter';
                } else if (ROTATION_LAST_NAMES.has(cn) || [...ROTATION_LAST_NAMES].some(n => cn.includes(n))) {
                    playerTier = 'rotation';
                } else {
                    playerTier = 'default';
                }

                if (playerTier === 'mvp') {
                    estimatedVOR = 8.0;
                    expectedMinutes = 36;
                    console.log(`[ImpactModel] MVP CANDIDATE: ${name} → VOR 8.0`);
                } else if (playerTier === 'star') {
                    estimatedVOR = 6.0;
                    expectedMinutes = 34;
                    console.log(`[ImpactModel] STAR: ${name} → VOR 6.0`);
                } else if (playerTier === 'starter') {
                    estimatedVOR = 4.0;
                    expectedMinutes = 32;
                    console.log(`[ImpactModel] STARTER: ${name} → VOR 4.0`);
                } else if (playerTier === 'rotation') {
                    estimatedVOR = 3.0;
                    expectedMinutes = 22;
                    console.log(`[ImpactModel] ROTATION: ${name} → VOR 3.0`);
                } else {
                    console.log(`[ImpactModel] DEFAULT: ${name} → VOR 2.5`);
                }

                return {
                    name: name,
                    status: 'OUT', // For the model's purposes
                    expectedMinutes: expectedMinutes,
                    stats: {
                        bpm: estimatedVOR,
                        rapm_z: 0,
                        onOff_z: 0,
                        usage_z: 0
                    }
                };
            });
        };

        // 1. BASE TEAM RATING (Lineup-Adjusted)
        const homeNetRating = homeStats?.powerRatings?.baselineTPR || homeStats?.powerRatings?.avgNetRating || 0;
        const awayNetRating = awayStats?.powerRatings?.baselineTPR || awayStats?.powerRatings?.avgNetRating || 0;

        const homePace = homeStats?.powerRatings?.avgPace || 99;
        const awayPace = awayStats?.powerRatings?.avgPace || 99;

        const homePaceFactor = homePace / LEAGUE_AVG_PACE;
        const awayPaceFactor = awayPace / LEAGUE_AVG_PACE;

        const homeBase = homeNetRating * homePaceFactor + SCHEDULE_RESIDUAL;
        const awayBase = awayNetRating * awayPaceFactor + SCHEDULE_RESIDUAL;

        // 2. INJURY MODEL
        const homeInjuries = mapInjuries(homeStats);
        const awayInjuries = mapInjuries(awayStats);

        // Build per-player injury trace for the detail panel
        const buildInjuryTrace = (players: PlayerData[]) =>
            players.map(p => {
                const vor = p.stats?.bpm ?? 0;
                const mins = p.expectedMinutes;
                const minutesShare = mins / 48;
                const rawImpact = vor * minutesShare;
                const statusWeights: Record<string, number> = {
                    OUT: 1.0, DOUBTFUL: 0.8, QUESTIONABLE: 0.55, GTD: 0.4
                };
                const statusWeight = statusWeights[p.status] ?? 1.0;
                const penalty = -(rawImpact * statusWeight);
                return {
                    name: p.name,
                    status: p.status,
                    vor,
                    mins,
                    minutesShare: parseFloat(minutesShare.toFixed(4)),
                    rawImpact: parseFloat(rawImpact.toFixed(3)),
                    statusWeight,
                    penalty: parseFloat(penalty.toFixed(3)),
                };
            });

        const homeInjuryTrace = buildInjuryTrace(homeInjuries);
        const awayInjuryTrace = buildInjuryTrace(awayInjuries);

        let homeInjuryPenalty = 0;
        homeInjuries.forEach(p => homeInjuryPenalty += calculateInjuryPenalty(p));

        let awayInjuryPenalty = 0;
        awayInjuries.forEach(p => awayInjuryPenalty += calculateInjuryPenalty(p));

        const homeAdaptation = calculateTeamAdaptationFactor(0);
        const awayAdaptation = calculateTeamAdaptationFactor(0);

        const homeFinalInjury = homeInjuryPenalty * homeAdaptation;
        const awayFinalInjury = awayInjuryPenalty * awayAdaptation;

        // 3. HOME COURT ADVANTAGE (Dynamic)
        const homeRest: RestContext = {
            isBackToBack: homeRestDays === 0,
            is3in4: false
        };
        const awayRest: RestContext = {
            isBackToBack: awayRestDays === 0,
            is3in4: false
        };

        const hcaContext = {
            elevationMeters: altitudeTeams.includes(homeName) ? 1609 : 0,
            refereeFactor: 0
        };

        const { totalHCA, breakdown: hcaBreakdown } = calculateDynamicHCA(homeRest, awayRest, hcaContext);

        // 4. FINAL SPREAD CALCULATION
        const homeTPR = homeBase + homeFinalInjury;
        const awayTPR = awayBase + awayFinalInjury;

        const projectedSpread = awayTPR - homeTPR - totalHCA;

        // 5. EDGE & BET SIGNAL
        const MODEL_STD_DEV = 11.8;
        const edge = hasMarketSpread ? marketSpread - projectedSpread : 0;
        const zScore = hasMarketSpread ? calculateZScoreEdge(marketSpread, projectedSpread) : 0;

        let betSignal = "No Play";
        const absZ = Math.abs(zScore);
        if (hasMarketSpread) {
            if (absZ >= 1.0) betSignal = "ELITE VALUE";
            else if (absZ >= 0.75) betSignal = "STRONG VALUE";
            else if (absZ >= 0.55) betSignal = "PLAYABLE";
        }

        const recommendedSide = (hasMarketSpread && zScore > 0) ? homeName : (hasMarketSpread && zScore < 0 ? awayName : null);
        const steamConfirmed = checkSteam(projectedSpread, marketSpread, marketSpread);

        return NextResponse.json({
            matchup: `${awayName} @ ${homeName}`,
            prediction: {
                projectedSpread: parseFloat(projectedSpread.toFixed(2)),
                marketSpread: hasMarketSpread ? marketSpread : null,
                zScore: parseFloat(zScore.toFixed(2)),
                betSignal,
                recommendedSide: (hasMarketSpread && absZ >= 0.55) ? recommendedSide : null,
                confidence: hasMarketSpread ? Math.min(absZ * 25, 99).toFixed(0) + '%' : '0%'
            },
            components: {
                home: {
                    baseRating: parseFloat(homeBase.toFixed(2)),
                    injuryPenalty: parseFloat(homeFinalInjury.toFixed(2)),
                    finalTPR: parseFloat(homeTPR.toFixed(2))
                },
                away: {
                    baseRating: parseFloat(awayBase.toFixed(2)),
                    injuryPenalty: parseFloat(awayFinalInjury.toFixed(2)),
                    finalTPR: parseFloat(awayTPR.toFixed(2))
                },
                hca: {
                    total: totalHCA,
                    breakdown: hcaBreakdown
                }
            },
            injuries: {
                home: homeInjuries.map(i => ({ name: i.name, status: i.status, impact: calculateInjuryPenalty(i).toFixed(2) })),
                away: awayInjuries.map(i => ({ name: i.name, status: i.status, impact: calculateInjuryPenalty(i).toFixed(2) }))
            },
            // ── Full computation trace for the "See Details" panel ──────────────
            trace: {
                constants: {
                    leagueAvgPace: LEAGUE_AVG_PACE,
                    modelStdDev: MODEL_STD_DEV,
                    scheduleResidual: SCHEDULE_RESIDUAL,
                    adaptationFactor: homeAdaptation,
                },
                home: {
                    teamName: homeName,
                    step1_base: {
                        avgNetRating: parseFloat(homeNetRating.toFixed(3)),
                        avgPace: parseFloat(homePace.toFixed(1)),
                        paceFactor: parseFloat(homePaceFactor.toFixed(4)),
                        formula: `${homeNetRating.toFixed(3)} × (${homePace.toFixed(1)} / ${LEAGUE_AVG_PACE}) = ${homeBase.toFixed(3)}`,
                        result: parseFloat(homeBase.toFixed(3)),
                    },
                    step2_injuries: {
                        players: homeInjuryTrace,
                        rawTotal: parseFloat(homeInjuryPenalty.toFixed(3)),
                        adaptationFactor: homeAdaptation,
                        formula: `${homeInjuryPenalty.toFixed(3)} × ${homeAdaptation} = ${homeFinalInjury.toFixed(3)}`,
                        result: parseFloat(homeFinalInjury.toFixed(3)),
                    },
                    step3_tpr: {
                        formula: `${homeBase.toFixed(3)} + (${homeFinalInjury.toFixed(3)}) = ${homeTPR.toFixed(3)}`,
                        result: parseFloat(homeTPR.toFixed(3)),
                    },
                },
                away: {
                    teamName: awayName,
                    step1_base: {
                        avgNetRating: parseFloat(awayNetRating.toFixed(3)),
                        avgPace: parseFloat(awayPace.toFixed(1)),
                        paceFactor: parseFloat(awayPaceFactor.toFixed(4)),
                        formula: `${awayNetRating.toFixed(3)} × (${awayPace.toFixed(1)} / ${LEAGUE_AVG_PACE}) = ${awayBase.toFixed(3)}`,
                        result: parseFloat(awayBase.toFixed(3)),
                    },
                    step2_injuries: {
                        players: awayInjuryTrace,
                        rawTotal: parseFloat(awayInjuryPenalty.toFixed(3)),
                        adaptationFactor: awayAdaptation,
                        formula: `${awayInjuryPenalty.toFixed(3)} × ${awayAdaptation} = ${awayFinalInjury.toFixed(3)}`,
                        result: parseFloat(awayFinalInjury.toFixed(3)),
                    },
                    step3_tpr: {
                        formula: `${awayBase.toFixed(3)} + (${awayFinalInjury.toFixed(3)}) = ${awayTPR.toFixed(3)}`,
                        result: parseFloat(awayTPR.toFixed(3)),
                    },
                },
                step4_hca: {
                    base: hcaBreakdown.base,
                    fatigue: hcaBreakdown.fatigue,
                    altitude: hcaBreakdown.altitude,
                    refBias: hcaBreakdown.refBias,
                    formula: `${hcaBreakdown.base} (base) + ${hcaBreakdown.fatigue} (fatigue) + ${hcaBreakdown.altitude} (altitude) = ${totalHCA}`,
                    result: totalHCA,
                    homeIsBackToBack: homeRestDays === 0,
                    awayIsBackToBack: awayRestDays === 0,
                    isAltitudeGame: altitudeTeams.includes(homeName),
                },
                step5_spread: {
                    formula: `awayTPR(${awayTPR.toFixed(3)}) - homeTPR(${homeTPR.toFixed(3)}) - HCA(${totalHCA}) = ${projectedSpread.toFixed(3)}`,
                    awayTPR: parseFloat(awayTPR.toFixed(3)),
                    homeTPR: parseFloat(homeTPR.toFixed(3)),
                    hca: totalHCA,
                    result: parseFloat(projectedSpread.toFixed(3)),
                    interpretation: projectedSpread < 0 ? `Home (${homeName}) favored by ${Math.abs(projectedSpread).toFixed(1)}` : `Away (${awayName}) favored by ${Math.abs(projectedSpread).toFixed(1)}`,
                },
                step6_edge: {
                    marketSpread,
                    projectedSpread: parseFloat(projectedSpread.toFixed(3)),
                    edge: parseFloat(edge.toFixed(3)),
                    stdDev: MODEL_STD_DEV,
                    formula: `(${marketSpread} - ${projectedSpread.toFixed(3)}) / ${MODEL_STD_DEV} = ${zScore.toFixed(4)}`,
                    zScore: parseFloat(zScore.toFixed(4)),
                    absZ: parseFloat(absZ.toFixed(4)),
                    signal: betSignal,
                    recommendedSide: absZ >= 0.55 ? recommendedSide : null,
                    confidence: Math.min(absZ * 25, 99).toFixed(1) + '%',
                },
            }
        });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
