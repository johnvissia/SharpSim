'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import {
  analyzeBettingPerformance,
  BettingPerformanceOutput,
} from '@/ai/flows/betting-coach';
import type { UserBet, SportName } from '@/lib/types';
import {
  Lightbulb,
  BrainCircuit,
  BarChart,
  Trophy,
  TrendingDown,
  Target,
} from 'lucide-react';
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
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { sportKeyMapping } from '@/lib/sports';

const chartConfig = {
  wins: {
    label: 'Wins',
    color: 'hsl(var(--chart-1))',
  },
  losses: {
    label: 'Losses',
    color: 'hsl(var(--destructive))',
  },
} satisfies ChartConfig;

// The sports available for betting in the app. This will be the basis for the chart.
const AVAILABLE_SPORTS = Object.keys(sportKeyMapping) as SportName[];

export default function CoachingPage() {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<BettingPerformanceOutput | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const { user } = useUser();
  const firestore = useFirestore();

  const betsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'bets'),
      orderBy('placedAt', 'desc')
    );
  }, [user, firestore]);

  const { data: userBets, isLoading: isLoadingBets } =
    useCollection<UserBet>(betsQuery);

  const chartData = useMemo(() => {
    // Initialize stats for all available sports
    const statsBySport: { [key in SportName]?: { wins: number; losses: number } } = {};
    AVAILABLE_SPORTS.forEach(sport => {
        statsBySport[sport] = { wins: 0, losses: 0 };
    });

    if (userBets) {
        userBets.forEach((bet) => {
            // We only want to include settled bets in the chart
            if (bet.status !== 'won' && bet.status !== 'lost') {
                return;
            }
    
          const sports: SportName[] = [];
          if (bet.betType === 'parlay' && bet.legs) {
            const sportSet = new Set(bet.legs.map((leg) => leg.sport));
            sports.push(...Array.from(sportSet));
          } else {
            sports.push(bet.sport);
          }
    
          for (const sport of sports) {
              // Only update if the sport from the bet exists in our initialized map
            if (statsBySport[sport]) {
              if (bet.status === 'won') {
                statsBySport[sport]!.wins++;
              } else if (bet.status === 'lost') {
                statsBySport[sport]!.losses++;
              }
            }
          }
        });
    }

    return Object.entries(statsBySport).map(([sport, stats]) => ({
      sport,
      wins: stats!.wins,
      losses: stats!.losses,
    }));
  }, [userBets]);

  const handleAnalysis = async () => {
    if (!userBets || userBets.length === 0) {
      toast({
        title: 'No Betting History',
        description:
          'You need to place some bets before the AI coach can analyze your performance.',
        variant: 'default',
      });
      return;
    }

    setLoading(true);
    setAnalysis(null);
    try {
      const historyString = JSON.stringify(userBets, null, 2);
      const result = await analyzeBettingPerformance({
        bettingHistory: historyString,
      });
      setAnalysis(result);
    } catch (error) {
      console.error('Failed to get analysis:', error);
      toast({
        title: 'Analysis Failed',
        description:
          'Could not retrieve your performance analysis. Please try again later.',
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
        <div className="lg:col-span-1 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analysis</CardTitle>
              <CardDescription>
                Click the button to get an AI-powered breakdown of your recent
                betting performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleAnalysis}
                disabled={loading || isLoadingBets}
                size="lg"
              >
                <Lightbulb className="mr-2 h-5 w-5" />
                {loading
                  ? 'Analyzing...'
                  : isLoadingBets
                  ? 'Loading Bets...'
                  : 'Analyze My Performance'}
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
                <Accordion
                  type="single"
                  collapsible
                  defaultValue="item-1"
                  className="w-full"
                >
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-lg font-semibold">
                      <Trophy className="mr-2 text-accent" />
                      Summary
                    </AccordionTrigger>
                    <AccordionContent className="text-base">
                      {analysis.summary}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger className="text-lg font-semibold">
                      <BarChart className="mr-2 text-accent" />
                      Sport-Specific Feedback
                    </AccordionTrigger>
                    <AccordionContent className="text-base">
                      {analysis.sportSpecificFeedback}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger className="text-lg font-semibold">
                      <TrendingDown className="mr-2 text-accent" />
                      Bet-Type Specific Feedback
                    </AccordionTrigger>
                    <AccordionContent className="text-base">
                      {analysis.betTypeSpecificFeedback}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-4">
                    <AccordionTrigger className="text-lg font-semibold">
                      <Target className="mr-2 text-accent" />
                      Improvement Tips
                    </AccordionTrigger>
                    <AccordionContent className="text-base">
                      {analysis.improvementTips}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Wins vs. Losses by Sport</CardTitle>
              <CardDescription>
                A look at your performance across different leagues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBets ? (
                <Skeleton className="h-[500px] w-full" />
              ) : chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[500px] w-full">
                  <RechartsBarChart accessibilityLayer data={chartData}>
                    <XAxis
                      dataKey="sport"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                    />
                    <YAxis />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <ChartLegend />
                    <Bar dataKey="wins" fill="var(--color-wins)" radius={4} />
                    <Bar
                      dataKey="losses"
                      fill="var(--color-losses)"
                      radius={4}
                    />
                  </RechartsBarChart>
                </ChartContainer>
              ) : (
                <div className="h-[500px] flex items-center justify-center">
                    <p className="text-muted-foreground text-center">No settled bets to display.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
