'use client';

import { Game } from '@/lib/types';
import { History, Circle } from 'lucide-react';

export function MLBLiveGameTracker({ game }: { game: Game }) {
  // Using static data matching the provided structure for now until the user implements the API.
  return (
    <div className="flex-1 overflow-y-auto pt-2 space-y-6">
      
      {/* Live Game Details & Standings summary - Optional if game header is enough, but including per design */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center px-4">
            <span className="text-3xl font-black tracking-tight mb-1">4 - 2</span>
            <span className="bg-amber-600/20 text-amber-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              Live: Top 7th
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="text-xl font-bold text-blue-400">Angel Stadium</div>
          <div className="text-sm text-slate-400">Anaheim, CA • 74° Clear</div>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Linescore Ledger */}
        <div className="lg:col-span-8 bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800">
          <div className="bg-slate-900 px-6 py-3 flex justify-between items-center border-b border-slate-800">
            <span className="text-sm font-bold tracking-widest uppercase">Linescore</span>
            <span className="text-xs text-slate-500">LAST UPDATE: 8:42 PM ET</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="text-slate-500 text-xs uppercase">
                  <th className="px-6 py-4 text-left font-bold w-32">Team</th>
                  <th className="px-3 py-4">1</th>
                  <th className="px-3 py-4">2</th>
                  <th className="px-3 py-4">3</th>
                  <th className="px-3 py-4">4</th>
                  <th className="px-3 py-4">5</th>
                  <th className="px-3 py-4">6</th>
                  <th className="px-3 py-4">7</th>
                  <th className="px-3 py-4">8</th>
                  <th className="px-3 py-4">9</th>
                  <th className="px-4 py-4 text-white border-l border-slate-800">R</th>
                  <th className="px-4 py-4 text-slate-300">H</th>
                  <th className="px-4 py-4 text-slate-300">E</th>
                </tr>
              </thead>
              <tbody className="font-medium text-lg">
                <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-left text-sm font-bold text-blue-300">SEATTLE</td>
                  <td className="px-3 py-4 text-slate-500">0</td>
                  <td className="px-3 py-4 text-slate-500">0</td>
                  <td className="px-3 py-4 text-slate-100">1</td>
                  <td className="px-3 py-4 text-slate-500">0</td>
                  <td className="px-3 py-4 text-slate-100">3</td>
                  <td className="px-3 py-4 text-slate-500">0</td>
                  <td className="px-3 py-4 bg-blue-900/40 text-blue-100 animate-pulse">0</td>
                  <td className="px-3 py-4 text-slate-700">-</td>
                  <td className="px-3 py-4 text-slate-700">-</td>
                  <td className="px-4 py-4 font-black border-l border-slate-800">4</td>
                  <td className="px-4 py-4 text-slate-300">7</td>
                  <td className="px-4 py-4 text-slate-300">0</td>
                </tr>
                <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-left text-sm font-bold text-red-400">L.A. ANGELS</td>
                  <td className="px-3 py-4 text-slate-500">0</td>
                  <td className="px-3 py-4 text-slate-100">2</td>
                  <td className="px-3 py-4 text-slate-500">0</td>
                  <td className="px-3 py-4 text-slate-500">0</td>
                  <td className="px-3 py-4 text-slate-500">0</td>
                  <td className="px-3 py-4 text-slate-500">0</td>
                  <td className="px-3 py-4 text-slate-700">-</td>
                  <td className="px-3 py-4 text-slate-700">-</td>
                  <td className="px-3 py-4 text-slate-700">-</td>
                  <td className="px-4 py-4 font-black border-l border-slate-800">2</td>
                  <td className="px-4 py-4 text-slate-300">5</td>
                  <td className="px-4 py-4 text-slate-300">1</td>
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
            <div className="absolute -top-3 -right-3 w-6 h-6 bg-blue-500 border-2 border-slate-900 rotate-[-45deg] flex items-center justify-center">
              <span className="text-[10px] font-black text-white">1</span>
            </div>
            {/* 2nd Base */}
            <div className="absolute -top-3 -left-3 w-6 h-6 bg-slate-800 border-2 border-slate-700 rotate-[-45deg]"></div>
            {/* 3rd Base */}
            <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-slate-800 border-2 border-slate-700 rotate-[-45deg]"></div>
            {/* Home */}
            <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-slate-300 border-2 border-slate-700 rotate-[-45deg] rounded-sm"></div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full pt-4 relative z-10">
            <div className="bg-slate-800/80 rounded p-3 text-center border border-slate-700/50 backdrop-blur-sm">
              <div className="text-xs text-slate-400 uppercase font-bold mb-2">Outs</div>
              <div className="flex justify-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-slate-700"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-slate-700"></div>
              </div>
            </div>
            <div className="bg-slate-800/80 rounded p-3 text-center border border-slate-700/50 backdrop-blur-sm">
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Count</div>
              <div className="font-black text-xl text-slate-100">2 - 1</div>
            </div>
          </div>
        </div>

        {/* Current Matchup */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800/50 flex items-center gap-6 relative group overflow-hidden hover:bg-slate-800/50 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Circle className="w-32 h-32 text-blue-300" />
            </div>
            <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border-2 border-blue-500 bg-slate-800">
              <img 
                alt="Julio Rodriguez" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBg1PMMiTLdMQff7BTNsiMjLikb5UaxU2ZHx-xoeGEd-XC_tNeOw2byEYY8w86C9XTY6-IyJnK9EIJ39aPiD5cIRR6apWwxARXwnqK7wHedcFo6BIcyo09L6jAUUsSRtx44HpyBAUZz7uvxEzLHfNZImMtpbleRr7V34ZA75V7V6H5ZslXSn-lkvCvg8rnh5YwUWWXrzB8oIpYxCY5nlTr9JirHf1F5KvvBbNQV1GBPoC-mVMeqleX-uhCRtSpnSXVV5mVdbtpjJrVh"
              />
            </div>
            <div className="flex-1 relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-2xl tracking-tight text-slate-100">Julio Rodriguez</h3>
                  <p className="text-blue-400 font-bold text-sm uppercase tracking-widest mt-0.5">Batter • Center Field</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-white">.312</div>
                  <div className="text-xs text-slate-500 font-bold uppercase mt-1">Season AVG</div>
                </div>
              </div>
              <div className="mt-4 flex gap-8">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Today</span>
                  <span className="font-bold text-lg text-slate-200">2-for-3, HR, 2 RBI</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Last 10 Games</span>
                  <span className="font-bold text-lg text-slate-200">.345 AVG</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800/50 flex items-center gap-6 relative group overflow-hidden hover:bg-slate-800/50 transition-colors">
            <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border-2 border-red-500 bg-slate-800">
              <img 
                alt="Shohei Ohtani" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBSsjjzvcfkVgf6UFdW5cO_qVUvOudR3Z3EJZG_ON56UpBUkqD9aw7XiFXwpT4gSRlK5kC7P7Jo7Z3EPBVYCjPXFPn3subjGVcure7fQt0oguI_-e06_ogffBZFl8Zy7DxxR53fg97MJBS-SA3_Id3p12xb274C2I2xul4nF4XxADMvCaTlcwjFLXC4whVVZ15Epje-THgszPDoh9npjYs1mMjV2xGVearhsyjnHimUBiURCn4mXzAYCH53ixpdB8j2sQx2GEAeWSn3"
              />
            </div>
            <div className="flex-1 relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-2xl tracking-tight text-slate-100">Shohei Ohtani</h3>
                  <p className="text-red-400 font-bold text-sm uppercase tracking-widest mt-0.5">Pitcher • RHP</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-white">2.84</div>
                  <div className="text-xs text-slate-500 font-bold uppercase mt-1">Season ERA</div>
                </div>
              </div>
              <div className="mt-4 flex gap-8">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Current Game</span>
                  <span className="font-bold text-lg text-slate-200">6.1 IP, 8 K, 2 ER</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Pitches</span>
                  <span className="font-bold text-lg text-slate-200">94 (62 Strikes)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Plays Ticker */}
        <div className="lg:col-span-5 bg-slate-900/60 rounded-xl p-6 border border-slate-800 flex flex-col">
          <h3 className="font-bold text-sm uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-300">
            <History className="text-blue-400 w-5 h-5" />
            Recent Action
          </h3>
          <div className="space-y-5 flex-1 pl-1">
            <div className="flex gap-4 items-start pb-5 border-b border-slate-800/80 relative">
              <div className="absolute left-1.5 top-3 bottom-[-1.25rem] w-px bg-slate-700/50"></div>
              <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 relative z-10 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
              <div>
                <p className="text-sm font-medium text-slate-200 leading-snug">Julio Rodriguez homers to deep center (422 ft).</p>
                <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">Top 5th • 2 Runs Scored</p>
              </div>
            </div>
            <div className="flex gap-4 items-start pb-5 border-b border-slate-800/80 relative">
              <div className="absolute left-1.5 top-3 bottom-[-1.25rem] w-px bg-slate-700/50"></div>
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1 relative z-10"></div>
              <div>
                <p className="text-sm font-medium text-slate-300 leading-snug">Mike Trout flies out to right field.</p>
                <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">Bottom 4th • 2 Out</p>
              </div>
            </div>
            <div className="flex gap-4 items-start pb-5 border-b border-slate-800/80 relative">
              <div className="absolute left-1.5 top-3 bottom-0 w-px bg-slate-700/50"></div>
              <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 relative z-10"></div>
              <div>
                <p className="text-sm font-medium text-slate-300 leading-snug">Ty France doubles down the left field line.</p>
                <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">Top 4th • 0 Out</p>
              </div>
            </div>
            <div className="flex gap-4 items-start pt-1">
              <div className="w-3 h-3 rounded-full bg-slate-600 mt-1 relative z-10"></div>
              <div>
                <p className="text-sm font-medium text-slate-500 italic">Game started at 7:05 PM PT.</p>
              </div>
            </div>
          </div>
          
          <button className="mt-8 w-full py-3 bg-slate-800/80 hover:bg-slate-700 transition-colors text-xs font-bold uppercase tracking-widest rounded-lg text-slate-300 border border-slate-700">
            View Full Play-By-Play
          </button>
        </div>
      </div>
    </div>
  );
}
