'use client';

import { Game } from '@/lib/types';
import { History, Circle, Loader2 } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';

// --- Types for ESPN Responses ---
interface ESPNResponse {
  header?: any;
  boxscore?: any;
  plays?: any[];
  gameInfo?: any;
}

export function MLBLiveGameTracker({ game }: { game: Game }) {
  const [espnId, setEspnId] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<ESPNResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchInterval = useRef<NodeJS.Timeout | null>(null);

  // 1. Find ESPN ID
  useEffect(() => {
    async function findGame() {
      try {
        setLoading(true);
        // We look securely for today's and the game's actual date in case of UTC mismatch
        const gDate = new Date(game.startTime);
        
        // formats YYYYMMDD
        const getYYYYMMDD = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
        const dateParam = getYYYYMMDD(gDate);
        
        // Also fetch default scoreboard as fallback
        const urls = [
          `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateParam}`,
          `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard`
        ];

        let foundId = null;

        for (const url of urls) {
          const res = await fetch(url);
          const data = await res.json();
          if (data && data.events) {
            const match = data.events.find((e: any) => {
              const name = e.name.toLowerCase();
              const awayMascot = game.awayTeam.name.split(' ').pop()?.toLowerCase() || '';
              const homeMascot = game.homeTeam.name.split(' ').pop()?.toLowerCase() || '';
              return name.includes(awayMascot) && name.includes(homeMascot);
            });
            if (match) {
              foundId = match.id;
              break;
            }
          }
        }

        if (foundId) {
          setEspnId(foundId);
        } else {
          setErrorMsg("Could not link game with live ESPN tracker.");
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("API connection failed.");
        setLoading(false);
      }
    }
    
    if (game?.homeTeam && game?.awayTeam) {
      findGame();
    }
  }, [game]);

  // 2. Poll Summary Data
  const pollGame = useCallback(async () => {
    if (!espnId) return;
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`);
      if (!res.ok) return;
      const data = await res.json();
      setLiveData(data);
      setLoading(false);
    } catch (err) {
      console.warn("Polling error:", err);
    }
  }, [espnId]);

  useEffect(() => {
    if (espnId) {
      pollGame();
      fetchInterval.current = setInterval(pollGame, 5000); // 5 sec interval for pitch-by-pitch
    }
    return () => {
      if (fetchInterval.current) clearInterval(fetchInterval.current);
    };
  }, [espnId, pollGame]);

  if (loading && !liveData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center pt-10 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
        <p className="font-bold tracking-widest uppercase text-xs">Locating Game Cast...</p>
      </div>
    );
  }

  if (errorMsg && !liveData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center pt-10 text-slate-500">
        <Circle className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-bold tracking-widest uppercase text-xs">{errorMsg}</p>
      </div>
    );
  }

  if (!liveData || !liveData.header) {
    return null;
  }

  // --- DATA PARSING ---

  const comp = liveData.header.competitions?.[0];
  if (!comp) return null;

  const homeTeam = comp.competitors?.find((c: any) => c.homeAway === 'home');
  const awayTeam = comp.competitors?.find((c: any) => c.homeAway === 'away');
  
  const statusDetail = comp.status?.type?.detail || 'Scheduled';
  const isLive = comp.status?.type?.state === 'in';
  
  const venue = liveData.gameInfo?.venue?.fullName || 'Stadium';
  const city = liveData.gameInfo?.venue?.address?.city || '';
  const weather = liveData.gameInfo?.weather?.temperature ? `${Math.round(liveData.gameInfo.weather.temperature)}°` : '';

  // Plays & Situation
  const plays = liveData.plays || [];
  const currentPlay = plays.length > 0 ? plays[plays.length - 1] : null;
  const sit = currentPlay?.situation || {};
  
  const outs = sit.outs || 0;
  const balls = sit.balls || 0;
  const strikes = sit.strikes || 0;
  
  const onFirst = !!sit.onFirst;
  const onSecond = !!sit.onSecond;
  const onThird = !!sit.onThird;

  // Matchup parsing
  const batter = currentPlay?.matchup?.batter || sit.batter;
  const pitcher = currentPlay?.matchup?.pitcher || sit.pitcher;

  // Try to find player today stats in boxscore
  const getDailyStats = (playerId: string, isPitcher: boolean) => {
    if (!liveData.boxscore?.players || !playerId) return null;
    for (const teamBox of liveData.boxscore.players) {
      const statsObj = teamBox.statistics?.find((s: any) => isPitcher ? s.name === 'pitching' : s.name === 'batting');
      if (statsObj) {
        const athlete = statsObj.athletes?.find((a: any) => a.athlete?.id === playerId);
        if (athlete) return athlete;
      }
    }
    return null;
  };

  const batterToday = getDailyStats(batter?.id, false);
  const pitcherToday = getDailyStats(pitcher?.id, true);

  // Inning mapping array length of 9 or max actual inning
  const totalInnings = Math.max(9, awayTeam?.linescores?.length || 0, homeTeam?.linescores?.length || 0);
  const inningsArray = Array.from({ length: totalInnings }, (_, i) => i);

  return (
    <div className="flex-1 overflow-y-auto pt-2 space-y-6">
      
      {/* Live Game Details & Standings summary */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center px-4">
            <span className="text-3xl font-black tracking-tight mb-1">
              {awayTeam?.score || 0} - {homeTeam?.score || 0}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${isLive ? 'bg-amber-600/20 text-amber-500' : 'bg-slate-800 text-slate-300'}`}>
              {statusDetail}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="text-lg font-bold text-blue-400">{venue}</div>
          <div className="text-sm text-slate-400">
            {city} {city && weather ? '•' : ''} {weather}
          </div>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Linescore Ledger */}
        <div className="lg:col-span-8 bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800">
          <div className="bg-slate-900 px-6 py-3 flex justify-between items-center border-b border-slate-800">
            <span className="text-sm font-bold tracking-widest uppercase">Linescore</span>
            <span className="text-xs text-slate-500">LIVE TRACKER</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="text-slate-500 text-xs uppercase">
                  <th className="px-6 py-4 text-left font-bold w-32">Team</th>
                  {inningsArray.map(i => (
                     <th key={i} className="px-3 py-4">{i + 1}</th>
                  ))}
                  <th className="px-4 py-4 text-white border-l border-slate-800">R</th>
                  <th className="px-4 py-4 text-slate-300">H</th>
                  <th className="px-4 py-4 text-slate-300">E</th>
                </tr>
              </thead>
              <tbody className="font-medium text-lg">
                <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-left text-sm font-bold text-blue-300 truncate max-w-[120px]">
                    {game.awayTeam.name}
                  </td>
                  {inningsArray.map(i => {
                    const run = awayTeam?.linescores?.[i];
                    return (
                      <td key={i} className={`px-3 py-4 ${i === (sit.inning || 1) - 1 && isLive && !sit.isBottom ? 'bg-blue-900/40 text-blue-100 animate-pulse' : 'text-slate-400'}`}>
                        {run?.displayValue ?? '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-4 font-black border-l border-slate-800">{awayTeam?.score || '0'}</td>
                  <td className="px-4 py-4 text-slate-300">{awayTeam?.hits || '0'}</td>
                  <td className="px-4 py-4 text-slate-300">{awayTeam?.errors || '0'}</td>
                </tr>
                <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-left text-sm font-bold text-red-300 truncate max-w-[120px]">
                    {game.homeTeam.name}
                  </td>
                  {inningsArray.map(i => {
                    const run = homeTeam?.linescores?.[i];
                    return (
                      <td key={i} className={`px-3 py-4 ${i === (sit.inning || 1) - 1 && isLive && sit.isBottom ? 'bg-blue-900/40 text-blue-100 animate-pulse' : 'text-slate-400'}`}>
                        {run?.displayValue ?? '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-4 font-black border-l border-slate-800">{homeTeam?.score || '0'}</td>
                  <td className="px-4 py-4 text-slate-300">{homeTeam?.hits || '0'}</td>
                  <td className="px-4 py-4 text-slate-300">{homeTeam?.errors || '0'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Diamond Graphic */}
        <div className="lg:col-span-4 bg-slate-900 rounded-xl p-6 border border-slate-800 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-20" 
            style={{ backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          </div>
          
          <div className="relative w-40 h-40 rotate-45 border-2 border-slate-700 mt-2">
            {/* 1st Base */}
            <div className={`absolute -top-3 -right-3 w-6 h-6 border-2 rotate-[-45deg] flex items-center justify-center transition-colors ${onFirst ? 'bg-amber-500 border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-800 border-slate-700'}`}>
              {onFirst && <span className="text-[10px] font-black text-amber-900">1</span>}
            </div>
            {/* 2nd Base */}
            <div className={`absolute -top-3 -left-3 w-6 h-6 border-2 rotate-[-45deg] transition-colors flex items-center justify-center ${onSecond ? 'bg-amber-500 border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-800 border-slate-700'}`}>
              {onSecond && <span className="text-[10px] font-black text-amber-900">2</span>}
            </div>
            {/* 3rd Base */}
            <div className={`absolute -bottom-3 -left-3 w-6 h-6 border-2 rotate-[-45deg] transition-colors flex items-center justify-center ${onThird ? 'bg-amber-500 border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-800 border-slate-700'}`}>
               {onThird && <span className="text-[10px] font-black text-amber-900">3</span>}
            </div>
            {/* Home */}
            <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-slate-300 border-2 border-slate-400 rotate-[-45deg] rounded-sm"></div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full pt-4 relative z-10">
            <div className="bg-slate-800/80 rounded p-3 text-center border border-slate-700/50 backdrop-blur-sm">
              <div className="text-xs text-slate-400 uppercase font-bold mb-2">Outs</div>
              <div className="flex justify-center gap-1.5">
                {[1, 2, 3].map(outNum => (
                  <div key={outNum} className={`w-3.5 h-3.5 rounded-full ${outs >= outNum ? 'bg-red-500' : 'bg-slate-700'}`}></div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800/80 rounded p-3 text-center border border-slate-700/50 backdrop-blur-sm">
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Count</div>
              <div className="font-black text-xl text-slate-100">{balls} - {strikes}</div>
            </div>
          </div>
        </div>

        {/* Current Matchup */}
        <div className="lg:col-span-7 space-y-4">
          {batter ? (
            <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800/50 flex items-center gap-6 relative group overflow-hidden hover:bg-slate-800/50 transition-colors">
              <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border-2 border-slate-700 bg-slate-800">
                {batter.headshot?.href ? (
                  <img alt={batter.fullName} className="w-full h-full object-cover" src={batter.headshot.href} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">No Img</div>
                )}
              </div>
              <div className="flex-1 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-2xl tracking-tight text-slate-100">{batter.fullName}</h3>
                    <p className="text-blue-400 font-bold text-sm uppercase tracking-widest mt-0.5">Batter • {batter.position?.abbreviation || 'BAT'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-white">{batterToday?.stats?.[13] || batter.avg || '.---'}</div>
                    <div className="text-xs text-slate-500 font-bold uppercase mt-1">AVG</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-8">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Today</span>
                    <span className="font-bold text-lg text-slate-200">
                      {batterToday?.stats ? `${batterToday.stats[1]}-for-${batterToday.stats[0]}, ${batterToday.stats[4]} HR, ${batterToday.stats[5]} RBI` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">OBP</span>
                    <span className="font-bold text-lg text-slate-200">{batterToday?.stats?.[14] || batter.obp || '.---'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
             <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800/50 flex items-center gap-6 text-slate-500">
                No Batter Data Available
             </div>
          )}

          {pitcher ? (
            <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800/50 flex items-center gap-6 relative group overflow-hidden hover:bg-slate-800/50 transition-colors">
              <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border-2 border-slate-700 bg-slate-800">
                {pitcher.headshot?.href ? (
                  <img alt={pitcher.fullName} className="w-full h-full object-cover" src={pitcher.headshot.href} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">No Img</div>
                )}
              </div>
              <div className="flex-1 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-2xl tracking-tight text-slate-100">{pitcher.fullName}</h3>
                    <p className="text-red-400 font-bold text-sm uppercase tracking-widest mt-0.5">Pitcher • {pitcher.position?.abbreviation || 'P'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-white">{pitcherToday?.stats?.[12] || pitcher.era || '-.--'}</div>
                    <div className="text-xs text-slate-500 font-bold uppercase mt-1">ERA</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-8">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Current Game</span>
                    <span className="font-bold text-lg text-slate-200">
                      {pitcherToday?.stats ? `${pitcherToday.stats[0]} IP, ${pitcherToday.stats[7]} K, ${pitcherToday.stats[3]} ER` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Pitches / Strikes</span>
                    <span className="font-bold text-lg text-slate-200">
                      {pitcherToday?.stats ? `${pitcherToday.stats[13] || '-'} / ${pitcherToday.stats[14] || '-'}` : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800/50 flex items-center gap-6 text-slate-500">
                No Pitcher Data Available
             </div>
          )}
        </div>

        {/* Recent Plays Ticker */}
        <div className="lg:col-span-5 bg-slate-900/60 rounded-xl p-6 border border-slate-800 flex flex-col max-h-[350px]">
          <h3 className="font-bold text-sm uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-300">
            <History className="text-blue-400 w-5 h-5" />
            Recent Action
          </h3>
          <div className="space-y-5 flex-1 pl-1 overflow-y-auto pr-2 custom-scrollbar">
            {plays.length > 0 ? (
              plays.slice().reverse().slice(0, 10).map((play: any, idx: number) => {
                const isScore = play.scoringPlay;
                return (
                  <div key={play.id || idx} className="flex gap-4 items-start pb-5 border-b border-slate-800/80 relative">
                    <div className="absolute left-1.5 top-3 bottom-[-1.25rem] w-px bg-slate-700/50"></div>
                    <div className={`w-3 h-3 rounded-full mt-1 relative z-10 ${isScore ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : (idx === 0 ? 'bg-blue-500' : 'bg-slate-600')}`}></div>
                    <div>
                      <p className={`text-sm leading-snug ${idx === 0 ? 'font-medium text-slate-200' : 'text-slate-400'}`}>
                        {play.text}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">
                        {play.period?.displayValue || play.type?.text} • {play.situation?.outs || 0} Out
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-500 text-sm italic py-4">Waiting for first pitch...</div>
            )}
            
            {(comp.status?.type?.name === 'STATUS_FINAL') && (
              <div className="flex gap-4 items-start pt-1">
                <div className="w-3 h-3 rounded-full bg-slate-600 mt-1 relative z-10"></div>
                <div>
                  <p className="text-sm font-medium text-slate-500 italic">Game has concluded.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
