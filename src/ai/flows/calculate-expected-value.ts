'use server';

/**
 * @fileOverview A flow to calculate the expected value of a bet and provide a visual indicator for potentially profitable betting opportunities.
 *
 * - calculateExpectedValue - A function that calculates the expected value of a bet.
 * - CalculateExpectedValueInput - The input type for the calculateExpectedValue function.
 * - CalculateExpectedValueOutput - The return type for the calculateExpectedValue function.
 */

import { z } from 'zod';

const CalculateExpectedValueInputSchema = z.object({
  sportsbookLine: z.number().describe('The betting line from a specific sportsbook.'),
  marketConsensus: z.number().describe('The average betting line across the market.'),
});
export type CalculateExpectedValueInput = z.infer<
  typeof CalculateExpectedValueInputSchema
>;

const CalculateExpectedValueOutputSchema = z.object({
  expectedValue: z
    .number()
    .describe(
      'The calculated expected value of the bet, representing the potential profit or loss.'
    ),
  hasValueEdge: z
    .boolean()
    .describe(
      'A boolean indicating whether the sportsbook line has a significant value edge compared to the market consensus.'
    ),
  valueEdgeDescription: z
    .string()
    .describe(
      'A description of the value edge, including the percentage difference between the sportsbook line and the market consensus.'
    ),
});
export type CalculateExpectedValueOutput = z.infer<
  typeof CalculateExpectedValueOutputSchema
>;

/**
 * Calculates the expected value of a bet without LLM/Genkit overhead.
 */
export async function calculateExpectedValue(
  input: CalculateExpectedValueInput
): Promise<CalculateExpectedValueOutput> {
  const { sportsbookLine, marketConsensus } = input;
  
  // Simple mathematical EV calculation (difference between lines)
  const expectedValue = sportsbookLine - marketConsensus;
  
  const percentageDifference = marketConsensus !== 0 
    ? ((sportsbookLine - marketConsensus) / Math.abs(marketConsensus)) * 100 
    : 0;
    
  const hasValueEdge = Math.abs(percentageDifference) > 5;

  let valueEdgeDescription = '';
  if (hasValueEdge) {
    valueEdgeDescription = `Value Edge: The sportsbook line is ${percentageDifference.toFixed(2)}% better than the market consensus.`;
  } else {
    valueEdgeDescription = 'No significant value edge detected.';
  }

  return {
    expectedValue,
    hasValueEdge,
    valueEdgeDescription,
  };
}

