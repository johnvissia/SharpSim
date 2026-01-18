/**
 * Converts American odds to decimal odds.
 * @param americanOdd The American odd to convert.
 * @returns The decimal odd.
 */
function americanToDecimal(americanOdd: number): number {
  if (americanOdd > 0) {
    return (americanOdd / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdd)) + 1;
  }
}

/**
 * Converts decimal odds back to American odds.
 * @param decimalOdd The decimal odd to convert.
 * @returns The American odd.
 */
function decimalToAmerican(decimalOdd: number): number {
  if (decimalOdd >= 2.0) {
    return (decimalOdd - 1) * 100;
  } else {
    return -100 / (decimalOdd - 1);
  }
}

/**
 * Calculates the total odds and payout for a parlay bet.
 * @param betAmount The amount being wagered.
 * @param americanOddsArray An array of American odds for each leg of the parlay.
 * @returns An object containing the potential payout and the combined American odds.
 */
export function calculateParlay(betAmount: number, americanOddsArray: number[]): { potentialPayout: number; americanOdds: number } {
  if (americanOddsArray.length === 0) {
    return { potentialPayout: 0, americanOdds: 0 };
  }

  const decimalOddsArray = americanOddsArray.map(americanToDecimal);
  const totalDecimalOdds = decimalOddsArray.reduce((acc, odd) => acc * odd, 1);
  const potentialPayout = betAmount * totalDecimalOdds;
  const combinedAmericanOdds = decimalToAmerican(totalDecimalOdds);

  return {
    potentialPayout,
    americanOdds: Math.round(combinedAmericanOdds), // Round to nearest integer for display
  };
}
