'use client';

import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';

interface EdgeDistributionChartProps {
    data: { name: string; edge: number; confidence: number }[];
}

export function EdgeDistributionChart({ data }: EdgeDistributionChartProps) {
    return (
        <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis
                        type="number"
                        dataKey="confidence"
                        name="Confidence"
                        unit="%"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        domain={[0, 100]}
                    />
                    <YAxis
                        type="number"
                        dataKey="edge"
                        name="Edge"
                        unit="%"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                    />
                    <ReferenceLine y={5} stroke="#818cf8" strokeDasharray="5 5" label={{ position: 'right', value: 'High Edge', fill: '#818cf8', fontSize: 10 }} />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        itemStyle={{ color: '#818cf8' }}
                        labelStyle={{ display: 'none' }}
                        formatter={(value: any, name: string) => [name === 'Edge' ? `${value}% Edge` : `${value}% Win Prob`, name]}
                    />
                    <Scatter name="Games" data={data}>
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.edge > 5 ? '#4ade80' : '#6366f1'}
                                fillOpacity={0.6}
                                stroke={entry.edge > 5 ? '#4ade80' : '#818cf8'}
                                strokeWidth={2}
                            />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
}
