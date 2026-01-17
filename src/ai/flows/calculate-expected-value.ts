'use server';

/**
 * @fileOverview A flow to calculate the expected value of a bet and provide a visual indicator for potentially profitable betting opportunities.
 *
 * - calculateExpectedValue - A function that calculates the expected value of a bet.
 * - CalculateExpectedValueInput - The input type for the calculateExpectedValue function.
 * - CalculateExpectedValueOutput - The return type for the calculateExpectedValue function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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

export async function calculateExpectedValue(
  input: CalculateExpectedValueInput
): Promise<CalculateExpectedValueOutput> {
  return calculateExpectedValueFlow(input);
}

const prompt = ai.definePrompt({
  name: 'calculateExpectedValuePrompt',
  input: {schema: CalculateExpectedValueInputSchema},
  output: {schema: CalculateExpectedValueOutputSchema},
  prompt: `You are an expert sports betting analyst. You will calculate the expected value (EV) of a betting line from a sportsbook, compared to the market consensus.

Calculate the expected value of the bet based on the following information:

Sportsbook Line: {{{sportsbookLine}}}
Market Consensus: {{{marketConsensus}}}

Determine if the sportsbook line has a significant value edge compared to the market consensus. A value edge exists if the sportsbook line is significantly better (higher if positive, lower if negative) than the market consensus. If the difference is greater than 5%, highlight it as a Value Edge.

Output the expected value, a boolean indicating whether a value edge exists, and a description of the value edge (including the percentage difference).`,
});

const calculateExpectedValueFlow = ai.defineFlow(
  {
    name: 'calculateExpectedValueFlow',
    inputSchema: CalculateExpectedValueInputSchema,
    outputSchema: CalculateExpectedValueOutputSchema,
  },
  async input => {
    const {sportsbookLine, marketConsensus} = input;
    const expectedValue = sportsbookLine - marketConsensus;
    const percentageDifference = ((sportsbookLine - marketConsensus) / marketConsensus) * 100;
    const hasValueEdge = Math.abs(percentageDifference) > 5;

    let valueEdgeDescription = '';
    if (hasValueEdge) {
      valueEdgeDescription = `Value Edge: The sportsbook line is ${percentageDifference.toFixed(2)}% better than the market consensus.`;
    } else {
      valueEdgeDescription = 'No significant value edge detected.';
    }

    const output: CalculateExpectedValueOutput = {
      expectedValue,
      hasValueEdge,
      valueEdgeDescription,
    };

    return output;
  }
);
