'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HitRateChart } from './HitRateChart';
import { ArrowUpRight } from 'lucide-react';

interface PlayerPropCardProps {
  prop: {
    id: string;
    playerName: string;
    matchup: string;
    market: string;
    line: number;
    overOdds: number;
    edge: number;
    recommendation: string;
    confidence: number;
    projectedPoints: number;
    recentGames?: { date: string; points: number }[];
  }
}

export function PlayerPropCard({ prop }: PlayerPropCardProps) {
  // Use Dicebear API for cartoon avatars
  // Try adventurers or notionists style
  const avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(prop.playerName)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;

  return (
    <Card className="border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition-all overflow-hidden flex flex-col h-full group">
      <CardContent className="p-0 flex flex-col h-full">
        <div className="p-4 md:p-5 flex-grow">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-700 bg-slate-800 flex-shrink-0 group-hover:border-indigo-500 transition-colors">
                <img src={avatarUrl} alt={prop.playerName} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white leading-tight">{prop.playerName}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{prop.matchup}</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <Badge variant="outline" className={`${prop.recommendation === 'Over' ? 'bg-green-500/10 text-green-400 border-green-500/20' : prop.recommendation === 'Under' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'} font-black px-2 py-0.5`}>
                {prop.recommendation} {prop.line}
              </Badge>
              <div className={`mt-1 text-sm font-black ${prop.edge > 0 ? 'text-green-500' : prop.edge < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                {prop.edge > 0 ? '+' : ''}{prop.edge}% <span className="text-[9px] text-slate-600 uppercase">Edge</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
             <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800/50 text-center">
               <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Market Line</div>
               <div className="text-lg font-bold text-white font-mono">{prop.line}</div>
             </div>
             <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800/50 text-center relative overflow-hidden">
               <div className="absolute inset-0 bg-indigo-500/5"></div>
               <div className="text-[9px] text-indigo-400 uppercase font-black tracking-tighter relative z-10">Model Proj</div>
               <div className="text-lg font-bold text-indigo-400 font-mono relative z-10">{prop.projectedPoints}</div>
             </div>
          </div>

          {prop.recentGames && prop.recentGames.length > 0 && (
            <HitRateChart data={prop.recentGames.slice(-10)} marketLine={prop.line} />
          )}
        </div>
        
        <div className="mt-auto px-4 py-3 border-t border-slate-800/50 bg-slate-950/30 flex justify-between items-center">
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
              Confidence: {prop.confidence.toFixed(0)}%
            </div>
            <div className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors group-hover:translate-x-1 duration-200">
                <span className="text-[10px] font-black uppercase tracking-widest italic">Place Bet</span>
                <ArrowUpRight className="w-3 h-3" />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
