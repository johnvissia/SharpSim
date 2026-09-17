'use client';
import React from 'react';
import type { Game, Team, SportName } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Ticket, User, Trophy } from 'lucide-react';
import { useBetSlip, type BetSlipPick } from '@/context/BetSlipContext';
import { sportIconMap } from '@/lib/team-logos';
import Image from 'next/image';

const OddsButton = ({
  onClick,
  children,
  disabled = false,
  isSelected = false,
  className = "",
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  disabled?: boolean;
  isSelected?: boolean;
  className?: string;
}) => (
  <Button
    variant={isSelected ? "secondary" : "outline"}
    className={`w-full h-auto min-h-[3.5rem] flex flex-col items-center justify-center p-1 text-sm leading-tight ${className}`}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
);

const getMascot = (fullName: string) => {
  if (!fullName) return '';
  if (fullName.includes('Red Sox')) return 'Red Sox';
  if (fullName.includes('White Sox')) return 'White Sox';
  if (fullName.includes('Blue Jays')) return 'Blue Jays';
  if (fullName.includes('Trail Blazers')) return 'Trail Blazers';
  if (fullName.includes('Golden Knights')) return 'Golden Knights';
  if (fullName.includes('Diamondbacks')) return 'D-Backs';
  if (fullName.includes('Demon Deacons')) return 'Demon Deacons';
  if (fullName.includes('Tar Heels')) return 'Tar Heels';
  if (fullName.includes('Blue Devils')) return 'Blue Devils';
  if (fullName.includes('Red Raiders')) return 'Red Raiders';
  if (fullName.includes('Horned Frogs')) return 'Horned Frogs';
  if (fullName.includes('Cornhuskers')) return 'Cornhuskers';

  const parts = fullName.trim().split(' ');
  return parts[parts.length - 1];
};

const getModelPick = (game: Game) => {
  const isMlb = game.sport === 'MLB';
  const unit = isMlb ? 'runs' : 'pts';

  // 1. If explicit model prediction from Firestore exists
  if (game.modelPrediction) {
    const proj = game.modelPrediction.projectedSpread ?? 0;
    if (proj < 0) {
      const mascot = getMascot(game.homeTeam.name);
      return {
        teamName: game.homeTeam.name,
        mascot,
        text: `${mascot} by ${Math.abs(proj).toFixed(1)} ${unit}`
      };
    } else if (proj > 0) {
      const mascot = getMascot(game.awayTeam.name);
      return {
        teamName: game.awayTeam.name,
        mascot,
        text: `${mascot} by ${proj.toFixed(1)} ${unit}`
      };
    } else if (game.modelPrediction.recommendedSide) {
      const mascot = getMascot(game.modelPrediction.recommendedSide);
      return {
        teamName: game.modelPrediction.recommendedSide,
        mascot,
        text: `${mascot} to win`
      };
    }
  }

  // 2. Derive from sportsbook spread odds if available
  if (game.odds?.spread && game.odds.spread.points !== 0) {
    const pts = game.odds.spread.points;
    if (pts < 0) {
      // Home favored
      const mascot = getMascot(game.homeTeam.name);
      return {
        teamName: game.homeTeam.name,
        mascot,
        text: `${mascot} (${pts > 0 ? '+' : ''}${pts} ${unit})`
      };
    } else if (pts > 0) {
      // Away favored
      const mascot = getMascot(game.awayTeam.name);
      return {
        teamName: game.awayTeam.name,
        mascot,
        text: `${mascot} (-${pts} ${unit})`
      };
    }
  }

  return null;
};

export function GameCard({ game, onGameClick, hasActiveBet }: { game: Game, onGameClick: (game: Game) => void, hasActiveBet: boolean }) {
  const { picks, addPick } = useBetSlip();

  const isLive = game.statusState === 'in';
  const isFinal = game.statusState === 'post';
  const canBet = game.statusState === 'pre';

  const isPickInSlip = (betType: BetSlipPick['betType'], pick: string) => {
    const marketId = `${game.id}-${betType}`;
    const pickId = `${marketId}-${pick.replace(/\s/g, '')}`;
    return picks.some(p => p.id === pickId);
  };

  const gameDate = new Date(game.startTime);
  const now = new Date();
  const isToday =
    now.toLocaleDateString('en-CA') === gameDate.toLocaleDateString('en-CA');

  const gameTimeOrStatus = isLive || isFinal
    ? game.statusDetail
    : isToday
      ? gameDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : gameDate.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

  const handleBetSelection = (
    e: React.MouseEvent,
    pick: string,
    odds: number,
    betType: 'moneyline' | 'spread' | 'total'
  ) => {
    e.stopPropagation();
    addPick({ 
      pick, 
      odds, 
      betType, 
      game, 
      marketId: `${game.id}-${betType}` 
    });
  };
  
  const { odds, liveScore } = game;
  const homeSpreadPoints = odds?.spread?.points ?? 0;
  const awaySpreadPoints = -homeSpreadPoints;

  const isAwayFav = (odds?.spread?.away ?? 0) < 0;
  const isHomeFav = (odds?.spread?.home ?? 0) < 0;

  const modelPick = getModelPick(game);
  
  const TeamRow = ({ 
    team, 
    score, 
    isFav, 
    mlOdds, 
    spreadPoints, 
    spreadOdds, 
    totalType,
    totalPoints,
    totalOdds 
  }: { 
    team: Team, 
    score?: number, 
    isFav: boolean,
    mlOdds?: number,
    spreadPoints?: number,
    spreadOdds?: number,
    totalType?: 'Over' | 'Under',
    totalPoints?: number,
    totalOdds?: number
  }) => {
    const FallbackIcon = sportIconMap[game.sport] || sportIconMap.Default;
    const showScore = isLive || isFinal;
    const isPickedWinner = canBet && modelPick && modelPick.teamName === team.name;
    
    return (
      <div className={`flex items-center ${showScore ? 'gap-2' : 'gap-3'} w-full`}>
        {/* Team Identity */}
        <div className={`flex-grow flex items-center ${showScore ? 'gap-2' : 'gap-3'} min-w-0 ${showScore ? 'pr-0' : 'pr-2'}`}>
          <div className={`${showScore ? 'w-7 h-7' : 'w-9 h-9'} flex-shrink-0 flex items-center justify-center bg-slate-900/40 rounded-full border border-slate-800/50`}>
            {team.logo ? (
              <Image src={team.logo} alt={team.name} width={showScore ? 28 : 36} height={showScore ? 28 : 36} className={`${showScore ? 'w-7 h-7' : 'w-9 h-9'} object-contain p-1`} />
            ) : (
              <FallbackIcon className={`${showScore ? 'w-5 h-5' : 'w-7 h-7'} text-muted-foreground`} />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-shrink">
            <div className="flex items-center">
              <span className={`${showScore ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm'} font-black truncate leading-tight text-white uppercase tracking-tight`}>
                {team.name}
              </span>
              {isPickedWinner && (
                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[8px] font-black uppercase tracking-tighter px-1 py-0 ml-1.5 shrink-0">
                  PICK
                </Badge>
              )}
            </div>
            {game.sport === 'MLB' && canBet && team.startingPitcher && (
              <span className="text-[9px] text-slate-500 truncate font-medium">
                {team.startingPitcher.name} ({team.startingPitcher.era} ERA)
              </span>
            )}
          </div>
          {showScore && (typeof score === 'number') && (
            <span className="ml-auto text-xl md:text-2xl font-black text-white px-1 italic tracking-tighter">
              {score}
            </span>
          )}
        </div>

        {/* Odds Grid for this team */}
        {canBet && odds ? (
          <div className="flex gap-2 flex-shrink-0">
            {/* Moneyline */}
            <div className="w-[68px]">
              <OddsButton 
                onClick={(e) => handleBetSelection(e, team.name, mlOdds!, 'moneyline')}
                isSelected={isPickInSlip('moneyline', team.name)}
                className="h-11 text-xs"
              >
                <span className="font-bold text-white uppercase">{mlOdds! > 0 ? `+${mlOdds}` : mlOdds}</span>
              </OddsButton>
            </div>

            {/* Spread */}
            <div className="w-[78px]">
              <OddsButton 
                onClick={(e) => handleBetSelection(e, `${team.name} ${spreadPoints! > 0 ? `+${spreadPoints}` : spreadPoints}`, spreadOdds!, 'spread')}
                isSelected={isPickInSlip('spread', `${team.name} ${spreadPoints! > 0 ? `+${spreadPoints}` : spreadPoints}`)}
                className={`h-11 text-xs ${isFav ? 'border-brand-500/50 bg-brand-500/5' : ''}`}
              >
                <div className="flex flex-col items-center leading-none">
                  <span className="font-bold text-white uppercase">{spreadPoints! > 0 ? `+${spreadPoints}` : spreadPoints}</span>
                  <span className="text-[10px] opacity-60">({spreadOdds! > 0 ? `+${spreadOdds}` : spreadOdds})</span>
                </div>
              </OddsButton>
            </div>

            {/* Total (Shared Column) */}
            <div className="w-[78px]">
              <OddsButton 
                onClick={(e) => handleBetSelection(e, `${totalType} ${totalPoints}`, totalOdds!, 'total')}
                isSelected={isPickInSlip('total', `${totalType} ${totalPoints}`)}
                className="h-11 text-xs"
              >
                <div className="flex flex-col items-center leading-none">
                  <span className="font-bold text-white uppercase">{totalType === 'Over' ? 'O' : 'U'} {totalPoints}</span>
                  <span className="text-[10px] opacity-60">({totalOdds! > 0 ? `+${totalOdds}` : totalOdds})</span>
                </div>
              </OddsButton>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Card 
      className={`group relative shadow-lg hover:shadow-brand-500/10 transition-all duration-300 cursor-pointer overflow-hidden border-slate-800 bg-slate-900/40 backdrop-blur-md flex flex-col ${isLive || isFinal ? 'min-h-[110px]' : 'min-h-[140px]'} hover:border-slate-700`}
      onClick={() => onGameClick(game)}
    >
      {/* Active Bet Indicator */}
      {hasActiveBet && (
        <div className="absolute top-1 right-1 z-20">
          <Ticket className="h-3 w-3 text-brand-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
        </div>
      )}

       {/* Live Glow Effect */}
       {isLive && (
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none" />
      )}

      {/* Top Header */}
      <div className="px-3 py-1 flex justify-between items-center bg-slate-950/40 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
             {game.leagueContext || game.sport}
           </span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />}
          <span className={`text-[9px] font-black uppercase tracking-wider ${isLive ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
            {gameTimeOrStatus}
          </span>
        </div>
      </div>

      {/* Model Pick Sub-Header (Only shown pre-game) */}
      {canBet && modelPick && (
        <div className="px-3 py-1 flex items-center justify-between bg-slate-950/70 border-b border-slate-800/40 text-[10px]">
          <div className="flex items-center gap-1.5 font-bold text-slate-300">
            <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 uppercase tracking-wider text-[9px]">Model Pick:</span>
            <span className="text-emerald-400 font-extrabold">{modelPick.text}</span>
          </div>
          {game.modelPrediction?.betSignal && (
            <Badge className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0 ${
              game.modelPrediction.betSignal.includes('ELITE') ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
              game.modelPrediction.betSignal.includes('STRONG') ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
              game.modelPrediction.betSignal.includes('PLAYABLE') ? 'bg-slate-700 text-slate-200' :
              'bg-slate-800 text-amber-400 border-amber-500/20'
            }`}>
              {game.modelPrediction.betSignal}
            </Badge>
          )}
        </div>
      )}

      <div className="p-3 flex flex-col gap-2">
        {/* Column Labels */}
        {canBet && odds && (
          <div className="flex w-full justify-end mb-[-12px]">
             <div className="flex gap-2 text-[8px] font-black text-slate-600 uppercase tracking-tighter w-[240px] justify-around pr-2">
                <span className="w-[68px] text-center">Moneyline</span>
                <span className="w-[78px] text-center">Spread</span>
                <span className="w-[78px] text-center">Total</span>
             </div>
          </div>
        )}

        <div className="space-y-2">
          <TeamRow 
            team={game.awayTeam} 
            score={liveScore?.away} 
            isFav={isAwayFav}
            mlOdds={odds?.moneyline?.away}
            spreadPoints={awaySpreadPoints}
            spreadOdds={odds?.spread?.away}
            totalType="Over"
            totalPoints={odds?.total?.points}
            totalOdds={odds?.total?.over}
          />
          <TeamRow 
            team={game.homeTeam} 
            score={liveScore?.home} 
            isFav={isHomeFav}
            mlOdds={odds?.moneyline?.home}
            spreadPoints={homeSpreadPoints}
            spreadOdds={odds?.spread?.home}
            totalType="Under"
            totalPoints={odds?.total?.points}
            totalOdds={odds?.total?.under}
          />
        </div>
      </div>

      {/* Live/Final Details */}
      {(isLive || isFinal) && (
        <div className="px-3 pb-2 flex justify-between items-center mt-auto border-t border-slate-800/30 pt-2">
           <span className="text-[10px] font-bold text-slate-500 italic">
             {game.statusDetail}
           </span>
        </div>
      )}
    </Card>
  );
}
