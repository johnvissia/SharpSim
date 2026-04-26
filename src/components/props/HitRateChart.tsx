'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';

interface HitRateChartProps {
  data: { date: string; points: number }[];
  marketLine: number;
}

export function HitRateChart({ data, marketLine }: HitRateChartProps) {
  // Add an index or format the date for the axis
  const chartData = data.map((d, i) => ({
    name: `G${i + 1}`,
    points: d.points,
    fullDate: d.date,
    isOver: d.points > marketLine,
  }));

  return (
    <div className="h-32 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 0, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }}
            dy={5}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} 
          />
          <Tooltip 
            cursor={{ fill: 'rgba(30, 41, 59, 0.5)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const isOver = payload[0].payload.isOver;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl relative z-50">
                    <p className="text-[10px] text-slate-400 mb-0.5 font-bold uppercase tracking-wider">{payload[0].payload.fullDate}</p>
                    <p className="text-sm font-black text-white">
                      Pts: <span className={isOver ? 'text-green-400' : 'text-red-400'}>{payload[0].value}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <ReferenceLine y={marketLine} stroke="#eab308" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.8} />
          <Bar dataKey="points" radius={[2, 2, 0, 0]} maxBarSize={30}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isOver ? '#22c55e' : '#ef4444'} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
