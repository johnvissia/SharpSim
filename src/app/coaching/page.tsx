'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { analyzeBettingPerformance, BettingPerformanceOutput } from '@/ai/flows/betting-coach';
import type { UserBet } from '@/lib/types';
import { Lightbulb, BrainCircuit, BarChart, Trophy, TrendingDown, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis } from 'recharts';

const mockBettingHistory: UserBet[] = [
  { id: 'bh1', gameId: 'g1', userId: 'u1', sport: 'NBA', betType: 'moneyline', pick: 'Team A', stake: 10, odds: -150, status: 'won', placedAt: '...', potentialWinnings: 16.67 },
  { id: 'bh2', gameId: 'g2', userId: 'u1', sport: 'NFL', betType: 'spread', pick: 'Team B +3.5', stake: 5, odds: -110, status: 'lost', placedAt: '...', potentialWinnings: 9.55 },
  { id: 'bh3', gameId: 'g3', userId: 'u1', sport: 'NBA', betType: 'total', pick: 'Over 220', stake: 5, odds: -110, status: 'won', placedAt: '...', potentialWinnings: 9.55 },
  { id: 'bh4', gameId: 'g4', userId: 'u1', sport: 'NHL', betType: 'moneyline', pick: 'Team C', stake: 10, odds: 200, status: 'lost', placedAt: '...', potentialWinnings: 30 },
  { id: 'bh5', gameId: 'g5', userId: 'u1', sport: 'MLB', betType: 'moneyline', pick: 'Team D', stake: 10, odds: -120, status: 'won', placedAt: '...', potentialWinnings: 18.33 },
];

const chartData = [
    { sport: 'NBA', wins: 15, losses: 5 },
    { sport: 'NFL', wins: 8, losses: 12 },
    { sport: 'MLB', wins: 20, losses: 22 },
    { sport: 'NHL', wins: 5, losses: 10 },
]

const chartConfig = {
    wins: {
        label: "Wins",
        color: "hsl(var(--chart-1))",
    },
    losses: {
        label: "Losses",
        color: "hsl(var(--destructive))",
    },
} satisfies ChartConfig

export default function CoachingPage() {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<BettingPerformanceOutput | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalysis = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      // In a real app, fetch user's full history from Firestore
      const historyString = JSON.stringify(mockBettingHistory, null, 2);
      const result = await analyzeBettingPerformance({ bettingHistory: historyString });
      setAnalysis(result);
    } catch (error) {
      console.error('Failed to get analysis:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Could not retrieve your performance analysis. Please try again later.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BrainCircuit className="h-8 w-8 text-primary" />
            AI Betting Coach
        </h1>
        <p className="text-muted-foreground">
          Get personalized feedback on your betting habits to sharpen your edge.
        </p>
      </header>
      
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Performance Analysis</CardTitle>
                    <CardDescription>Click the button to get an AI-powered breakdown of your recent betting performance.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleAnalysis} disabled={loading} size="lg">
                        <Lightbulb className="mr-2 h-5 w-5" />
                        {loading ? 'Analyzing...' : 'Analyze My Performance'}
                    </Button>
                </CardContent>
            </Card>

            {loading && (
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                </Card>
            )}

            {analysis && (
              <Card>
                <CardHeader>
                    <CardTitle>Your Coaching Report</CardTitle>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="text-lg font-semibold"><Trophy className="mr-2 text-accent"/>Summary</AccordionTrigger>
                            <AccordionContent className="text-base">{analysis.summary}</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                            <AccordionTrigger className="text-lg font-semibold"><BarChart className="mr-2 text-accent"/>Sport-Specific Feedback</AccordionTrigger>
                            <AccordionContent className="text-base">{analysis.sportSpecificFeedback}</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3">
                            <AccordionTrigger className="text-lg font-semibold"><TrendingDown className="mr-2 text-accent"/>Bet-Type Specific Feedback</AccordionTrigger>
                            <AccordionContent className="text-base">{analysis.betTypeSpecificFeedback}</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-4">
                            <AccordionTrigger className="text-lg font-semibold"><Target className="mr-2 text-accent"/>Improvement Tips</AccordionTrigger>
                            <AccordionContent className="text-base">{analysis.improvementTips}</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
              </Card>
            )}
        </div>

        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>Wins vs. Losses by Sport</CardTitle>
                    <CardDescription>A look at your performance across different leagues.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-64 w-full">
                        <RechartsBarChart accessibilityLayer data={chartData}>
                            <XAxis dataKey="sport" tickLine={false} tickMargin={10} axisLine={false} />
                            <YAxis />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                            <ChartLegend />
                            <Bar dataKey="wins" fill="var(--color-wins)" radius={4} />
                            <Bar dataKey="losses" fill="var(--color-losses)" radius={4} />
                        </RechartsBarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
