/**
 * Advanced Mathematical Utilities for NBA Model
 * Implements rigorous, variance-aware statistical methods.
 */

// ============================================================================
// 1. PLAYER IMPACT & INJURIES
// ============================================================================

export type PlayerStatus = 'ACTIVE' | 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' | 'GTD';

export interface PlayerData {
    name: string;
    status: PlayerStatus;
    stats?: {
        rapm_z?: number;
        onOff_z?: number;
        usage_z?: number;
        bpm?: number; // Fallback if advanced stats missing
    };
    expectedMinutes: number; // Projected minutes for this game
}

/**
 * Calculates a player's Net Rating Impact per 100 possessions.
 * Formula: (RAPM_z + 0.5 * OnOff_z + 0.3 * Usage_z) * ExpectedMinutesShare
 */
export function calculatePlayerImpact(player: PlayerData): number {
    // defaults if data is missing
    const rapm = player.stats?.rapm_z ?? 0;
    const onOff = player.stats?.onOff_z ?? 0;
    const usage = player.stats?.usage_z ?? 0;

    // Fallback: If no advanced stats, use BPM/VORP approx if available
    // BPM is already roughly "Points per 100 possessions above average"
    let rawImpact = 0;
    if (rapm === 0 && onOff === 0 && usage === 0 && player.stats?.bpm) {
        // Use raw BPM (Points scale) - No divisor needed as BPM is already points/100ish
        rawImpact = player.stats.bpm;
    } else {
        // Convert Z-score sum to Points (approx 1.0 Z = 2.5 pts impact)
        const zSum = rapm + (0.5 * onOff) + (0.3 * usage);
        rawImpact = zSum * 2.5;
    }

    const minutesShare = player.expectedMinutes / 48.0;
    return rawImpact * minutesShare;
}

/**
 * Calculates injury penalty based on availability probability.
 * Weights: OUT=1.0, DOUBTFUL=0.8, QUESTIONABLE=0.55, GTD=0.40
 */
export function calculateInjuryPenalty(player: PlayerData): number {
    const impact = calculatePlayerImpact(player);

    let availabilityWeight = 0;
    switch (player.status.toUpperCase()) {
        case 'OUT': availabilityWeight = 1.0; break;
        case 'DOUBTFUL': availabilityWeight = 0.80; break;
        case 'QUESTIONABLE': availabilityWeight = 0.55; break;
        case 'GTD': availabilityWeight = 0.40; break;
        default: availabilityWeight = 0; // ACTIVE = 0 penalty
    }

    // Penalty is the negative of the lost impact
    return -impact * availabilityWeight;
}

/**
 * Calculates Team Adaptation Factor for baked-in injuries.
 * Formula: 1 - min(0.6, GamesMissedLast25 / 25)
 */
export function calculateTeamAdaptationFactor(gamesMissedLast25: number): number {
    const adaptationCheck = Math.min(0.6, gamesMissedLast25 / 25.0);
    return 1.0 - adaptationCheck;
}

// ============================================================================
// 2. DYNAMIC HOME COURT ADVANTAGE (HCA)
// ============================================================================

export type RestContext = {
    isBackToBack: boolean;
    is3in4: boolean;
    milesTraveled?: number;
};

export type HCAContext = {
    elevationMeters: number; // e.g., Denver=1609
    refereeFactor?: number;   // +/- bias points
};

const BASE_HCA = 1.5;

/**
 * Calculates Dynamic HCA.
 * Formula: BaseHCA + RestDiff + Altitude + RefBias
 */
export function calculateDynamicHCA(
    homeRest: RestContext,
    awayRest: RestContext,
    context: HCAContext
): { totalHCA: number; breakdown: any } {
    let hca = BASE_HCA;
    const breakdown: any = { base: BASE_HCA, fatigue: 0, altitude: 0, refBias: 0 };

    // Fatigue Adjustments: Back-to-Back is a significant disadvantage
    if (homeRest.isBackToBack) {
        hca -= 0.8;
        breakdown.fatigue -= 0.8;
    }
    if (awayRest.isBackToBack) {
        hca += 0.8;
        breakdown.fatigue += 0.8;
    }

    // Altitude Bonus (Denver/Utah)
    if (context.elevationMeters > 1200) {
        hca += 0.5;
        breakdown.altitude = 0.5;
    }

    // Referee Bias (Placeholder)
    if (context.refereeFactor) {
        hca += context.refereeFactor;
        breakdown.refBias = context.refereeFactor;
    }

    return { totalHCA: hca, breakdown };
}

// ============================================================================
// 3. Z-SCORE EDGE
// ============================================================================

const MODEL_STD_DEV = 11.8; // Standard Deviation of NBA game margins

/**
 * Calculates Z-Score of the edge.
 * Formula: (MarketSpread - ProjectedSpread) / SD
 */
export function calculateZScoreEdge(marketSpread: number, projectedSpread: number): number {
    const edge = marketSpread - projectedSpread;
    return edge / MODEL_STD_DEV;
}

/**
 * Checks if steam (market movement) confirms the model's side.
 * Returns a confidence multiplier.
 */
export function checkSteam(projectedSpread: number, marketOpen: number, marketCurrent: number): boolean {
    const modelSide = projectedSpread < marketCurrent ? 'HOME' : 'AWAY';

    // If market moved TOWARDS the model side, that is confirmation.
    const marketO = marketOpen;
    const marketC = marketCurrent;

    // If model likes Home (Projected < Current)
    if (modelSide === 'HOME') {
        // Did market move towards home? (Open > Current) e.g. -2 -> -3
        return marketC < marketO;
    } else {
        // Model likes Away (Projected > Current)
        // Did market move towards away? (Open < Current) e.g. -8 -> -7
        return marketC > marketO;
    }
}

// ============================================================================
// 4. POWER RATING UTILITIES
// ============================================================================

/**
 * Shrinks a sample mean towards a population mean (0) based on sample size.
 * Formula: (SumDiff + (PriorMean * K)) / (Games + K)
 * Valid K is usually around 5-10 for NBA.
 */
export function applyBayesianShrinkage(avgDiff: number, gamesPlayed: number, priorMean = 0, k = 8): number {
    const rawSum = avgDiff * gamesPlayed;
    const shrunk = (rawSum + (priorMean * k)) / (gamesPlayed + k);
    return shrunk;
}

/**
 * Calculates a time-decay weight for a game.
 * Formula: e^(-decayRate * daysAgo)
 */
export function calculateDecayWeight(daysAgo: number, halfLifeDays = 20): number {
    const decayRate = Math.log(2) / halfLifeDays;
    return Math.exp(-decayRate * daysAgo);
}

/**
 * Adjusts margin of victory to prevent blowouts from skewing ratings.
 * Soft Cap implementation.
 */
export function calculateAdjustedMargin(margin: number): number {
    const cap = 25;
    if (Math.abs(margin) > cap) {
        return (margin > 0 ? 1 : -1) * (cap + Math.log(Math.abs(margin) - cap + 1));
    }
    return margin;
}

/**
 * Helper to get time decay based on a date string.
 */
export function getRecencyWeight(dateStr: string): number {
    const gameDate = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - gameDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return calculateDecayWeight(diffDays);
}
