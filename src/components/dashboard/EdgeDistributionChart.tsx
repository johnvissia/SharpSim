'use client';

import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Label, ZAxis } from 'recharts';

interface EdgeDistributionChartProps {
    data: { name: string; edge: number; winProb: number; zScore: number; logo?: string }[];
}

const CustomShape = (props: any) => {
    const { cx, cy, payload } = props;
    const { zScore, logo } = payload;

    // Dynamic Size: z=0.5 -> 30px, z=2.0 -> 60px
    const size = 30 + (zScore * 15);
    const radius = size / 2;

    if (logo) {
        return (
            <foreignObject x={cx - radius} y={cy - radius} width={size} height={size}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={logo}
                    alt=""
                    className="w-full h-full rounded-full object-contain bg-slate-950 border border-slate-600 shadow-md hover:scale-110 transition-transform duration-200"
                    onError={(e) => {
                        // Fallback to circle if image fails
                        (e.target as any).style.display = 'none';
                    }}
                />
            </foreignObject>
        );
    }

    return (
        <circle cx={cx} cy={cy} r={radius / 2} fill="#6366f1" fillOpacity={0.6} />
    );
};

export function EdgeDistributionChart({ data }: EdgeDistributionChartProps) {
    return (
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} stroke="#ffffff" />

                    <XAxis
                        type="number"
                        dataKey="winProb"
                        name="Win Probability"
                        unit="%"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        domain={[40, 70]} // Zoomed in on actionable range
                        ticks={[40, 50, 60, 70]}
                    >
                        <Label value="Win Probability (%)" offset={0} position="insideBottom" fill="#64748b" fontSize={10} />
                    </XAxis>

                    <YAxis
                        type="number"
                        dataKey="edge"
                        name="Points Edge"
                        unit=" pts"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        domain={[0, 'auto']}
                    >
                        <Label value="Edge (Points)" angle={-90} position="insideLeft" fill="#64748b" fontSize={10} />
                    </YAxis>

                    {/* ZAxis is required for tooltips to access zScore sometimes, or just for metadata */}
                    <ZAxis type="number" dataKey="zScore" range={[0, 100]} />

                    <ReferenceLine x={50} stroke="#475569" strokeDasharray="3 3" />

                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        itemStyle={{ color: '#818cf8' }}
                        labelStyle={{ display: 'none' }}
                        formatter={(value: any, name: string) => [
                            name === 'edge' ? `+${value} Points` : `${value}% Win Prob`,
                            name === 'edge' ? 'Edge' : 'Prob'
                        ]}
                    />

                    <Scatter name="Games" data={data} shape={<CustomShape />} />
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
}
