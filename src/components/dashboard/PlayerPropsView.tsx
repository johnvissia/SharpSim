'use client';

import { useState, useEffect } from 'react';
import type { Game, PlayerProp, PlayerPropMarket } from '@/lib/types';
import { sportKeyMapping } from '@/lib/sports';
import { useBetSlip } from '@/context/BetSlipContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert } from 'lucide-react';

const OddsButton = ({
  onClick,
  children,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) => (
  <Button
    variant="outline"
    className="w-full h-auto flex-col p-2 justify-center"
    onClick={(e) => {
        e.stopPropagation();
        onClick();
    }}
    disabled={disabled}
  >
    {children}
  </Button>
);

const marketNameMapping: Record<string, string> = {
    'player_points': 'Player Points',
    'player_rebounds': 'Player Rebounds',
    'player_assists': 'Player Assists',
    'player_threes': 'Player Threes Made',
    'player_blocks': 'Player Blocks',
    'player_steals': 'Player Steals',
};

const USE_MOCK_DATA = false; // Set to true to use mock data and save API quota

const mockPlayerProps: PlayerPropMarket[] = [
    {
        key: 'player_points',
        name: 'Player Points',
        props: [
            { playerName: 'LeBron James', point: 25.5, overOdds: -115, underOdds: -115 },
            { playerName: 'Stephen Curry', point: 28.5, overOdds: -110, underOdds: -120 },
        ]
    },
    {
        key: 'player_assists',
        name: 'Player Assists',
        props: [
            { playerName: 'LeBron James', point: 8.5, overOdds: 100, underOdds: -130 },
            { playerName: 'Draymond Green', point: 7.5, overOdds: -105, underOdds: -125 },
        ]
    }
];

function parsePlayerProps(data: any): PlayerPropMarket[] {
    const bookmaker = data?.bookmakers?.[0];
    if (!bookmaker) return [];

    const markets: PlayerPropMarket[] = [];

    bookmaker.markets.forEach((market: any) => {
        const outcomes = market.outcomes;
        if (!outcomes) return;

        // Group outcomes by player name and point value
        const propsMap = new Map<string, Partial<PlayerProp> & { playerName: string; point: number }>();
        outcomes.forEach((outcome: any) => {
            const key = `${outcome.name}_${outcome.point}`;
            if (!propsMap.has(key)) {
                propsMap.set(key, { playerName: outcome.name, point: outcome.point });
            }
            const prop = propsMap.get(key)!;
            if (outcome.description.toLowerCase() === 'over') {
                prop.overOdds = outcome.price;
            } else if (outcome.description.toLowerCase() === 'under') {
                prop.underOdds = outcome.price;
            }
        });

        const propsList = Array.from(propsMap.values())
            .filter(p => p.overOdds !== undefined && p.underOdds !== undefined) as PlayerProp[];

        if (propsList.length > 0) {
            markets.push({
                key: market.key,
                name: marketNameMapping[market.key] || market.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                props: propsList.sort((a,b) => a.playerName.localeCompare(b.playerName)),
            });
        }
    });

    return markets;
}


export function PlayerPropsView({ game }: { game: Game }) {
    const { addPick } = useBetSlip();
    const { toast } = useToast();
    const [markets, setMarkets] = useState<PlayerPropMarket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlayerProps = async () => {
            setIsLoading(true);
            setError(null);
            setMarkets([]);

            if (USE_MOCK_DATA) {
                setMarkets(mockPlayerProps);
                setIsLoading(false);
                return;
            }
            
            const oddsApiGameId = game.oddsApiId;

            if (!oddsApiGameId) {
                setError("Player props are only available for games with odds. Please sync odds first.");
                setIsLoading(false);
                return;
            }

            const sportKey = sportKeyMapping[game.sport];
            if (!sportKey) {
                setError('Invalid sport for player props.');
                setIsLoading(false);
                return;
            }
            
            const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;
            if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
                setError("API Key is not configured.");
                setIsLoading(false);
                return;
            }
            
            try {
                const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${oddsApiGameId}/odds?apiKey=${API_KEY}&regions=us&markets=player_points,player_rebounds,player_assists&oddsFormat=american`;
                const response = await fetch(url);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch player props.');
                }
                
                const data = await response.json();
                const parsedProps = parsePlayerProps(data);
                
                if (parsedProps.length === 0) {
                    setError('No player props are available for this game at the moment.');
                } else {
                    setMarkets(parsedProps);
                }

            } catch (err: any) {
                console.error("Player prop fetch error:", err);
                const errorMessage = err.message || 'An error occurred while fetching props.';
                setError(errorMessage);
                toast({
                    variant: 'destructive',
                    title: 'Could not load player props.',
                    description: errorMessage,
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlayerProps();
    }, [game, toast]);
    
    const handlePick = (
        playerName: string,
        marketName: string,
        point: number,
        type: 'Over' | 'Under',
        odds: number
    ) => {
        addPick({
            game,
            pick: `${playerName} ${type} ${point} ${marketName.replace('Player ', '')}`,
            odds,
            betType: 'player_prop'
        });
    }

    if (isLoading) {
        return (
            <div className="space-y-4 py-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-4">
                <ShieldAlert className="h-10 w-10 text-accent" />
                <p className="font-semibold">Player Props Unavailable</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    return (
        <Accordion type="multiple" collapsible className="w-full space-y-2">
            {markets.map(market => (
                <AccordionItem value={market.key} key={market.key} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 text-base font-semibold hover:no-underline">
                        {market.name}
                    </AccordionTrigger>
                    <AccordionContent className="px-1">
                        <div className="space-y-1">
                             <div className="grid grid-cols-3 items-center text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider px-2 py-1">
                                <div className="text-left">Player</div>
                                <div>Over</div>
                                <div>Under</div>
                            </div>
                            {market.props.map(prop => (
                                <div key={prop.playerName + prop.point} className="grid grid-cols-3 items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                                    <div className="font-semibold text-sm truncate">{prop.playerName}</div>
                                    <OddsButton onClick={() => handlePick(prop.playerName, market.name, prop.point, 'Over', prop.overOdds)}>
                                        <span className="font-semibold text-primary">O {prop.point}</span>
                                        <span className="text-xs text-muted-foreground">{prop.overOdds > 0 ? `+${prop.overOdds}` : prop.overOdds}</span>
                                    </OddsButton>
                                    <OddsButton onClick={() => handlePick(prop.playerName, market.name, prop.point, 'Under', prop.underOdds)}>
                                        <span className="font-semibold text-primary">U {prop.point}</span>
                                        <span className="text-xs text-muted-foreground">{prop.underOdds > 0 ? `+${prop.underOdds}` : prop.underOdds}</span>
                                    </OddsButton>
                                </div>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
