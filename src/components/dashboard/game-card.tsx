'use client';

import type { Game, Team } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Star } from 'lucide-react';
import Image from 'next/image';
import { sportIconMap } from '@/lib/team-logos';
import { useBetSlip } from '@/context/BetSlipContext';


const InjuryIndicator = ({ team }: { team: Team }) => {
  const outPlayers = team.players.filter((p) => p.injuryStatus === 'Out');
  const questionablePlayers = team.players.filter(
    (p) => p.injuryStatus === 'Questionable'
  );

  if (outPlayers.length === 0 && questionablePlayers.length === 0) {
    return null;
  }

  const tooltipContent = (
    <div>
      {outPlayers.length > 0 && (
        <div className="mb-2">
          <p className="font-semibold">Out:</p>
          <ul className="list-disc list-inside">
            {outPlayers.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}
      {questionablePlayers.length > 0 && (
        <div>
          <p className="font-semibold">Questionable:</p>
          <ul className="list-disc list-inside">
            {questionablePlayers.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex gap-1">
            {outPlayers.length > 0 && (
              <Badge variant="destructive" className="cursor-pointer">
                O
              </Badge>
            )}
            {questionablePlayers.length > 0 && (
              <Badge className="bg-accent text-accent-foreground hover:bg-accent/80 cursor-pointer">
                Q
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const TeamDisplay = ({ team, score, sport }: { team: Team; score?: number, sport: Game['sport'] }) => {
  const FallbackIcon = sportIconMap[sport] || sportIconMap.Default;

  return (
    <div className="flex flex-col items-center text-center gap-2 w-28">
      {team.logo ? (
        <Image
          src={team.logo}
          alt={`${team.name} logo`}
          width={40}
          height={40}
          className="object-contain h-10 w-10"
        />
      ) : (
        <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full">
          <FallbackIcon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <div className="text-sm font-semibold h-10 flex items-center justify-center">
        {team.rank && (
          <span className="font-bold mr-1.5 text-muted-foreground">#{team.rank}</span>
        )}
        {team.name}
      </div>
      {score !== undefined && <div className="text-2xl font-bold">{score}</div>}
      <InjuryIndicator team={team} />
    </div>
  );
};

export function GameCard({ game, onGameClick }: { game: Game, onGameClick: (game: Game) => void }) {
  const { addPick } = useBetSlip();

  const isLive = game.statusDetail && !game.statusDetail.toLowerCase().includes('final') && !game.statusDetail.toLowerCase().includes('tba') && !game.statusDetail.toLowerCase().includes(':');
  const isFinal = game.statusDetail && game.statusDetail.toLowerCase().includes('final');

  const gameTimeOrStatus = isLive || isFinal 
    ? game.statusDetail
    : new Date(game.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const handleBetSelection = (
    e: React.MouseEvent,
    pick: string,
    odds: number,
    betType: 'moneyline' | 'spread' | 'total'
  ) => {
    e.stopPropagation();
    addPick({ pick, odds, betType, game });
  };
  
  const handleStarClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Add favorite logic here
  }

  return (
      <Card 
        className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer"
        onClick={() => onGameClick(game)}
      >
        <CardHeader className="flex-row items-center justify-between bg-card-foreground/5 p-3">
          <div className="text-sm font-medium">{game.sport}</div>
            <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">{gameTimeOrStatus}</div>
                {isLive && (
                    <Badge className="bg-red-600 hover:bg-red-600 text-white animate-pulse text-xs">
                        LIVE
                    </Badge>
                )}
                <button 
                    onClick={handleStarClick}
                    className="text-muted-foreground hover:text-accent transition-colors"
                >
                    <Star className="h-5 w-5" />
                </button>
            </div>
        </CardHeader>
        <CardContent className="flex-grow p-4 flex flex-col justify-between">
          <div className="flex items-start justify-around text-center mb-4">
            <TeamDisplay team={game.awayTeam} score={(isLive || isFinal) ? game.liveScore?.away : undefined} sport={game.sport} />
            <div className="flex flex-col items-center self-center px-2">
              <span className="text-lg font-bold text-muted-foreground">{isFinal ? 'F' : '@'}</span>
            </div>
            <TeamDisplay team={game.homeTeam} score={(isLive || isFinal) ? game.liveScore?.home : undefined} sport={game.sport} />
          </div>

          {game.odds && !isFinal && ( // Hide odds if game is final
            <div className="space-y-2">
              <p className="text-center text-xs text-muted-foreground mb-2">
                Quick Bets
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2"
                  onClick={(e) =>
                    handleBetSelection(
                      e,
                      game.awayTeam.name,
                      game.odds!.moneyline.away,
                      'moneyline'
                    )
                  }
                >
                  <span>
                    {game.awayTeam.name.split(' ').pop()}{' '}
                    {game.odds.moneyline.away > 0
                      ? `+${game.odds.moneyline.away}`
                      : game.odds.moneyline.away}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Moneyline
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2"
                  onClick={(e) =>
                    handleBetSelection(
                      e,
                      game.homeTeam.name,
                      game.odds!.moneyline.home,
                      'moneyline'
                    )
                  }
                >
                  <span>
                    {game.homeTeam.name.split(' ').pop()}{' '}
                    {game.odds.moneyline.home > 0
                      ? `+${game.odds.moneyline.home}`
                      : game.odds.moneyline.home}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Moneyline
                  </span>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2"
                  onClick={(e) =>
                    handleBetSelection(
                      e,
                      `Over ${game.odds!.total.points}`,
                      game.odds!.total.over,
                      'total'
                    )
                  }
                >
                  <span>Over {game.odds.total.points}</span>
                  <span className="text-xs text-muted-foreground">
                    (
                    {game.odds.total.over > 0
                      ? `+${game.odds.total.over}`
                      : game.odds.total.over}
                    )
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2"
                  onClick={(e) =>
                    handleBetSelection(
                      e,
                      `Under ${game.odds!.total.points}`,
                      game.odds!.total.under,
                      'total'
                    )
                  }
                >
                  <span>Under {game.odds.total.points}</span>
                  <span className="text-xs text-muted-foreground">
                    (
                    {game.odds.total.under > 0
                      ? `+${game.odds.total.under}`
                      : game.odds.total.under}
                    )
                  </span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
  );
}
