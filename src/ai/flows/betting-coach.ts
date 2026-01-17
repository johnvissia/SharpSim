'use server';

/**
 * @fileOverview Analyzes user betting history and provides tailored feedback and improvement tips.
 *
 * - analyzeBettingPerformance - Analyzes the user's betting performance and provides feedback.
 * - BettingPerformanceInput - The input type for the analyzeBettingPerformance function.
 * - BettingPerformanceOutput - The return type for the analyzeBettingPerformance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BettingPerformanceInputSchema = z.object({
  bettingHistory: z.string().describe('A detailed JSON string of the user\'s betting history, including sport, bet type, outcome (win/loss), and margin of error.'),
});

export type BettingPerformanceInput = z.infer<typeof BettingPerformanceInputSchema>;

const BettingPerformanceOutputSchema = z.object({
  summary: z.string().describe('A summary of the user\'s betting performance, including strengths and weaknesses.'),
  sportSpecificFeedback: z.string().describe('Specific feedback on the user\'s performance in different sports.'),
  betTypeSpecificFeedback: z.string().describe('Specific feedback on the user\'s performance with different bet types (e.g., moneyline, spreads, totals).'),
  improvementTips: z.string().describe('Actionable tips for improving the user\'s betting strategy.'),
});

export type BettingPerformanceOutput = z.infer<typeof BettingPerformanceOutputSchema>;

export async function analyzeBettingPerformance(input: BettingPerformanceInput): Promise<BettingPerformanceOutput> {
  return analyzeBettingPerformanceFlow(input);
}

const analyzeBettingPerformancePrompt = ai.definePrompt({
  name: 'analyzeBettingPerformancePrompt',
  input: {schema: BettingPerformanceInputSchema},
  output: {schema: BettingPerformanceOutputSchema},
  prompt: `You are a sports betting coach analyzing a user's betting history to provide tailored feedback and improvement tips.

  Analyze the provided betting history and provide a summary of the user's performance, including strengths and weaknesses. Provide specific feedback on the user's performance in different sports and with different bet types.  Also provide actionable tips for improving the user's betting strategy. Focus on clear, concise, and actionable advice.

  Betting History (JSON string): {{{bettingHistory}}}

  Format your response as follows:
  Summary: [Summary of performance]
  Sport-Specific Feedback: [Feedback on each sport]
  Bet-Type Specific Feedback: [Feedback on each bet type]
  Improvement Tips: [Actionable tips for improvement]
  `,
});

const analyzeBettingPerformanceFlow = ai.defineFlow(
  {
    name: 'analyzeBettingPerformanceFlow',
    inputSchema: BettingPerformanceInputSchema,
    outputSchema: BettingPerformanceOutputSchema,
  },
  async input => {
    const {output} = await analyzeBettingPerformancePrompt(input);
    return output!;
  }
);
