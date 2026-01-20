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
  // The "19th" slip: A 3-leg parlay, 2 won, 1 lost. Overall status is 'lost'.
  {
    id: 'parlay1',
    gameId: 'p1,p2,p3',
    userId: 'u1',
    sport: 'NBA', // Main sport for the ticket
    betType: 'parlay',
    pick: '3-Leg Parlay',
    stake: 10,
    odds: 595, // Example combined odds
    potentialWinnings: 69.5,
    status: 'lost',
    placedAt: '2024-01-19T10:00:00Z',
    legs: [
      { gameId: 'g1', matchup: 'Lakers @ Warriors', commenceTime: '2024-01-19T19:00:00Z', pick: 'Golden State Warriors', betType: 'moneyline', odds: -150, status: 'won', sport: 'NBA' },
      { gameId: 'g2', matchup: 'Suns @ Mavericks', commenceTime: '2024-01-19T20:00:00Z', pick: 'Over 225.5', betType: 'total', odds: -110, status: 'won', sport: 'NBA' },
      { gameId: 'g3', matchup: 'Knicks @ Nets', commenceTime: '2024-01-19T20:30:00Z', pick: 'New York Knicks -2.5', betType: 'spread', odds: -110, status: 'lost', sport: 'NBA' },
    ]
  },
  // A won parlay from the "18th".
  {
    id: 'parlay2',
    gameId: 'p4,p5',
    userId: 'u1',
    sport: 'NFL',
    betType: 'parlay',
    pick: '2-Leg Parlay',
    stake: 20,
    odds: 264,
    potentialWinnings: 72.8,
    status: 'won',
    placedAt: '2024-01-18T11:00:00Z',
    legs: [
      { gameId: 'g4', matchup: 'Eagles @ Chiefs', commenceTime: '2024-01-18T13:00:00Z', pick: 'Kansas City Chiefs -3.5', betType: 'spread', odds: -110, status: 'won', sport: 'NFL' },
      { gameId: 'g5', matchup: 'Bills @ Bengals', commenceTime: '2024-01-18T16:30:00Z', pick: 'Over 48.5', betType: 'total', odds: -110, status: 'won', sport: 'NFL' },
    ]
  },
  // A single bet from the "18th" that was pending and is now lost.
  { id: 'bh2', gameId: 'g2', userId: 'u1', sport: 'NFL', betType: 'spread', pick: 'Team B +3.5', stake: 5, odds: -110, status: 'lost', placedAt: '2024-01-18T09:00:00Z', potentialWinnings: 9.55 },
  // Another single bet to round it out.
  { id: 'bh1', gameId: 'g1', userId: 'u1', sport: 'NBA', betType: 'moneyline', pick: 'Team A', stake: 10, odds: -150, status: 'won', placedAt: '2024-01-18T08:00:00Z', potentialWinnings: 16.67 },
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
