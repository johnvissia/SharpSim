'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, TrendingUp, Users, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PlayerPropCard } from '@/components/props/PlayerPropCard';

export default function PlayerPropsPage() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/predict-props');
      if (!res.ok) throw new Error('Failed to fetch prop predictions');
      const data = await res.json();
      setPredictions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-slate-400 font-medium animate-pulse text-sm uppercase tracking-widest">
          Loading Player Props...
        </p>
      </div>
    );
  }

  const actionableProps = predictions.filter(p => Math.abs(p.edge) > 0);

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Target className="h-10 w-10 text-indigo-500" />
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
            Prop Insights 
          </h1>
        </div>
        <p className="text-slate-400 max-w-2xl font-medium">
          Player props with historical performance charts and edge calculations.
        </p>
      </header>
      
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                  <h3 className="text-xl font-black text-white">{predictions.length}</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Players Analyzed</p>
              </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div>
                  <h3 className="text-xl font-black text-white">{actionableProps.length}</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">With Edge</p>
              </div>
          </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Active Opportunities</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {actionableProps.map((prop) => (
            <PlayerPropCard key={prop.id} prop={prop} />
          ))}
        </div>

        {actionableProps.length === 0 && !loading && (
          <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-10 h-10 text-slate-700" />
            <div>
              <h3 className="text-slate-400 font-bold uppercase italic">No Actionable Props</h3>
              <p className="text-sm text-slate-600">No edges found against the market currently.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
