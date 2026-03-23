'use client';

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Activity,
    AlertTriangle,
    Calculator,
    ChevronRight,
    Home,
    Plane,
    TrendingUp,
    Zap,
} from 'lucide-react';

interface InjuryPlayerTrace {
    name: string;
    status: string;
    vor: number;
    mins: number;
    minutesShare: number;
    rawImpact: number;
    statusWeight: number;
    penalty: number;
}

interface TeamTrace {
    teamName: string;
    step1_base: {
        avgNetRating: number;
        avgPace: number;
        paceFactor: number;
        formula: string;
        result: number;
    };
    step2_injuries: {
        players: InjuryPlayerTrace[];
        rawTotal: number;
        adaptationFactor: number;
        formula: string;
        result: number;
    };
    step3_tpr: {
        formula: string;
        result: number;
    };
}

interface PredictionTrace {
    constants: {
        leagueAvgPace: number;
        modelStdDev: number;
        scheduleResidual: number;
        adaptationFactor: number;
    };
    home: TeamTrace;
    away: TeamTrace;
    step4_hca: {
        base: number;
        fatigue: number;
        altitude: number;
        refBias: number;
        formula: string;
        result: number;
        homeIsBackToBack: boolean;
        awayIsBackToBack: boolean;
        isAltitudeGame: boolean;
    };
    step5_spread: {
        formula: string;
        awayTPR: number;
        homeTPR: number;
        hca: number;
        result: number;
        interpretation: string;
    };
    step6_edge: {
        marketSpread: number;
        projectedSpread: number;
        edge: number;
        stdDev: number;
        formula: string;
        zScore: number;
        absZ: number;
        signal: string;
        recommendedSide: string | null;
        confidence: string;
    };
}

interface GameDetailSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    matchup: string;
    trace: PredictionTrace;
    homeLogo?: string;
    awayLogo?: string;
}

function StepHeader({ step, icon, title }: { step: string; icon: React.ReactNode; title: string }) {
    return (
        <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-[10px] font-black shrink-0">
                {step}
            </div>
            <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                {icon}
                {title}
            </div>
        </div>
    );
}

function FormulaBox({ formula, result, unit = '' }: { formula: string; result: number; unit?: string }) {
    const isNeg = result < 0;
    return (
        <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 font-mono text-xs mt-2">
            <div className="text-slate-500 mb-1">Formula</div>
            <div className="text-slate-300 break-all">{formula}</div>
            <div className={`text-base font-black mt-1 ${isNeg ? 'text-red-400' : 'text-emerald-400'}`}>
                = {result >= 0 ? '+' : ''}{result}{unit}
            </div>
        </div>
    );
}

function VorBadge({ vor }: { vor: number }) {
    if (vor >= 8) return <span className="text-purple-400 font-bold text-[10px]">MVP ({vor})</span>;
    if (vor >= 6) return <span className="text-yellow-400 font-bold text-[10px]">STAR ({vor})</span>;
    if (vor >= 4) return <span className="text-blue-400 font-bold text-[10px]">STARTER ({vor})</span>;
    if (vor >= 3) return <span className="text-slate-400 font-bold text-[10px]">ROTATION ({vor})</span>;
    return <span className="text-slate-600 font-bold text-[10px]">DEFAULT ({vor})</span>;
}

function TeamSection({ team, side }: { team: TeamTrace; side: 'home' | 'away' }) {
    const icon = side === 'home' ? <Home className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />;
    const label = side === 'home' ? 'HOME' : 'AWAY';
    const accentColor = side === 'home' ? 'text-blue-400 border-blue-500/30 bg-blue-950/20' : 'text-orange-400 border-orange-500/30 bg-orange-950/20';

    return (
        <div className={`rounded-xl border p-4 space-y-4 ${accentColor}`}>
            <div className="flex items-center gap-2">
                {icon}
                <span className="font-black text-xs tracking-widest uppercase">{label}: {team.teamName}</span>
            </div>

            {/* Step 1 — Base Rating */}
            <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">① Base Rating</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-900 rounded p-2">
                        <div className="text-[9px] text-slate-500 uppercase">Avg Net Rtg</div>
                        <div className="text-sm font-black text-slate-200">{team.step1_base.avgNetRating >= 0 ? '+' : ''}{team.step1_base.avgNetRating}</div>
                    </div>
                    <div className="bg-slate-900 rounded p-2">
                        <div className="text-[9px] text-slate-500 uppercase">Pace Factor</div>
                        <div className="text-sm font-black text-slate-200">{team.step1_base.paceFactor.toFixed(3)}×</div>
                    </div>
                    <div className="bg-slate-900 rounded p-2 border border-slate-600/40">
                        <div className="text-[9px] text-slate-500 uppercase">Base Rating</div>
                        <div className={`text-sm font-black ${team.step1_base.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {team.step1_base.result >= 0 ? '+' : ''}{team.step1_base.result}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 font-mono text-[10px] mt-2 text-slate-400 break-all">
                    {team.step1_base.formula}
                </div>
            </div>

            {/* Step 2 — Injuries */}
            <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">② Injury Penalty</div>
                {team.step2_injuries.players.length === 0 ? (
                    <div className="text-[10px] text-green-500/50 italic py-1 px-2 bg-slate-900 rounded">No active day-to-day injuries</div>
                ) : (
                    <div className="space-y-1.5">
                        {team.step2_injuries.players.map((p, i) => (
                            <div key={i} className="bg-slate-900 rounded-lg p-2.5 border border-slate-800">
                                <div className="flex justify-between items-start mb-1.5">
                                    <div>
                                        <div className="text-slate-200 font-bold text-xs">{p.name}</div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[9px] text-red-400 uppercase font-bold">{p.status}</span>
                                            <span className="text-slate-600">•</span>
                                            <VorBadge vor={p.vor} />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-red-400 font-black text-sm font-mono">{p.penalty.toFixed(3)}</div>
                                        <div className="text-[9px] text-slate-600">pts impact</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-1 text-center">
                                    <div className="bg-slate-950 rounded p-1">
                                        <div className="text-[8px] text-slate-600">VOR</div>
                                        <div className="text-[10px] font-mono text-slate-300">{p.vor}</div>
                                    </div>
                                    <div className="bg-slate-950 rounded p-1">
                                        <div className="text-[8px] text-slate-600">Mins/48</div>
                                        <div className="text-[10px] font-mono text-slate-300">{p.minutesShare.toFixed(3)}</div>
                                    </div>
                                    <div className="bg-slate-950 rounded p-1">
                                        <div className="text-[8px] text-slate-600">Raw</div>
                                        <div className="text-[10px] font-mono text-slate-300">{p.rawImpact.toFixed(3)}</div>
                                    </div>
                                    <div className="bg-slate-950 rounded p-1">
                                        <div className="text-[8px] text-slate-600">Wt.</div>
                                        <div className="text-[10px] font-mono text-slate-300">{p.statusWeight}</div>
                                    </div>
                                </div>
                                <div className="text-[9px] text-slate-600 font-mono mt-1.5 break-all">
                                    −({p.vor} × {p.minutesShare.toFixed(3)}) × {p.statusWeight} = {p.penalty.toFixed(3)}
                                </div>
                            </div>
                        ))}
                        <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 font-mono text-[10px] text-slate-400 break-all mt-1">
                            {team.step2_injuries.formula}
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center mt-2 px-1">
                    <span className="text-[10px] text-slate-500">Total penalty</span>
                    <span className={`font-black font-mono text-sm ${team.step2_injuries.result < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {team.step2_injuries.result.toFixed(3)}
                    </span>
                </div>
            </div>

            {/* Step 3 — Final TPR */}
            <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">③ Final TPR</div>
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-700/50">
                    <div className="text-[10px] font-mono text-slate-400 break-all mb-1">{team.step3_tpr.formula}</div>
                    <div className={`text-xl font-black font-mono ${team.step3_tpr.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {team.step3_tpr.result >= 0 ? '+' : ''}{team.step3_tpr.result}
                    </div>
                </div>
            </div>
        </div>
    );
}

const signalColors: Record<string, string> = {
    'ELITE VALUE': 'bg-green-600 text-white',
    'STRONG VALUE': 'bg-emerald-600 text-white',
    'PLAYABLE': 'bg-yellow-500 text-slate-900',
    'No Play': 'bg-slate-700 text-slate-300',
};

export function GameDetailSheet({ open, onOpenChange, matchup, trace, homeLogo, awayLogo }: GameDetailSheetProps) {
    const s6 = trace.step6_edge;
    const s5 = trace.step5_spread;
    const s4 = trace.step4_hca;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl overflow-y-auto bg-slate-950 border-slate-800 p-0"
            >
                <SheetHeader className="p-5 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
                    <SheetTitle className="text-slate-100 text-base font-black flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-indigo-400" />
                        Computation Breakdown
                    </SheetTitle>
                    <div className="text-xs text-slate-400 font-semibold">{matchup}</div>
                </SheetHeader>

                <div className="p-5 space-y-6">

                    {/* ── Constants Banner ── */}
                    <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 grid grid-cols-2 gap-3 text-center">
                        <div>
                            <div className="text-[9px] text-slate-500 uppercase font-bold">League Avg Pace</div>
                            <div className="text-sm font-black text-slate-300 font-mono">{trace.constants.leagueAvgPace}</div>
                        </div>
                        <div>
                            <div className="text-[9px] text-slate-500 uppercase font-bold">Model Std Dev</div>
                            <div className="text-sm font-black text-slate-300 font-mono">{trace.constants.modelStdDev}</div>
                        </div>
                        <div>
                            <div className="text-[9px] text-slate-500 uppercase font-bold">Adaptation Factor</div>
                            <div className="text-sm font-black text-slate-300 font-mono">{trace.constants.adaptationFactor}×</div>
                        </div>
                        <div>
                            <div className="text-[9px] text-slate-500 uppercase font-bold">Schedule Residual</div>
                            <div className="text-sm font-black text-slate-300 font-mono">{trace.constants.scheduleResidual}</div>
                        </div>
                    </div>

                    {/* ── Team Sections ── */}
                    <TeamSection team={trace.away} side="away" />
                    <TeamSection team={trace.home} side="home" />

                    <Separator className="bg-slate-800" />

                    {/* ── Step 4: HCA ── */}
                    <div>
                        <StepHeader step="4" icon={<Home className="h-3.5 w-3.5" />} title="Home Court Advantage" />
                        <div className="grid grid-cols-4 gap-2 text-center mb-2">
                            <div className="bg-slate-900 rounded p-2">
                                <div className="text-[9px] text-slate-500 uppercase">Base</div>
                                <div className="text-sm font-black text-slate-300 font-mono">+{s4.base}</div>
                            </div>
                            <div className="bg-slate-900 rounded p-2">
                                <div className="text-[9px] text-slate-500 uppercase">Fatigue</div>
                                <div className={`text-sm font-black font-mono ${s4.fatigue < 0 ? 'text-red-400' : s4.fatigue > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {s4.fatigue >= 0 ? '+' : ''}{s4.fatigue}
                                </div>
                            </div>
                            <div className="bg-slate-900 rounded p-2">
                                <div className="text-[9px] text-slate-500 uppercase">Altitude</div>
                                <div className={`text-sm font-black font-mono ${s4.altitude > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    +{s4.altitude}
                                </div>
                            </div>
                            <div className="bg-slate-900 rounded p-2 border border-slate-600/40">
                                <div className="text-[9px] text-slate-500 uppercase">Total HCA</div>
                                <div className="text-sm font-black text-indigo-400 font-mono">+{s4.result}</div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {s4.homeIsBackToBack && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Home B2B −0.8
                                </Badge>
                            )}
                            {s4.awayIsBackToBack && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Away B2B +0.8
                                </Badge>
                            )}
                            {s4.isAltitudeGame && (
                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                                    ⛰ Altitude +0.5
                                </Badge>
                            )}
                        </div>
                        <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 font-mono text-[10px] text-slate-400 break-all mt-2">
                            {s4.formula}
                        </div>
                    </div>

                    <Separator className="bg-slate-800" />

                    {/* ── Step 5: Spread ── */}
                    <div>
                        <StepHeader step="5" icon={<TrendingUp className="h-3.5 w-3.5" />} title="Projected Spread" />
                        <div className="grid grid-cols-3 gap-2 text-center mb-2">
                            <div className="bg-orange-950/20 border border-orange-500/20 rounded p-2">
                                <div className="text-[9px] text-slate-500 uppercase">Away TPR</div>
                                <div className={`text-sm font-black font-mono ${s5.awayTPR >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                                    {s5.awayTPR >= 0 ? '+' : ''}{s5.awayTPR}
                                </div>
                            </div>
                            <div className="bg-blue-950/20 border border-blue-500/20 rounded p-2">
                                <div className="text-[9px] text-slate-500 uppercase">Home TPR</div>
                                <div className={`text-sm font-black font-mono ${s5.homeTPR >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                    {s5.homeTPR >= 0 ? '+' : ''}{s5.homeTPR}
                                </div>
                            </div>
                            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded p-2">
                                <div className="text-[9px] text-slate-500 uppercase">HCA</div>
                                <div className="text-sm font-black text-indigo-400 font-mono">+{s5.hca}</div>
                            </div>
                        </div>
                        <div className="bg-slate-950 rounded-xl p-4 border border-slate-700/50 text-center">
                            <div className="text-[10px] text-slate-500 font-mono mb-1 break-all">{s5.formula}</div>
                            <div className={`text-3xl font-black font-mono ${s5.result < 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                {s5.result >= 0 ? '+' : ''}{s5.result}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">{s5.interpretation}</div>
                        </div>
                    </div>

                    <Separator className="bg-slate-800" />

                    {/* ── Step 6: Edge & Signal ── */}
                    <div>
                        <StepHeader step="6" icon={<Zap className="h-3.5 w-3.5" />} title="Edge Calculation & Signal" />
                        <div className="grid grid-cols-3 gap-2 text-center mb-2">
                            <div className="bg-slate-900 rounded p-2">
                                <div className="text-[9px] text-slate-500 uppercase">Market</div>
                                <div className="text-sm font-black text-slate-300 font-mono">{s6.marketSpread >= 0 ? '+' : ''}{s6.marketSpread}</div>
                            </div>
                            <div className="bg-slate-900 rounded p-2">
                                <div className="text-[9px] text-slate-500 uppercase">Projected</div>
                                <div className={`text-sm font-black font-mono ${s6.projectedSpread < 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                    {s6.projectedSpread >= 0 ? '+' : ''}{s6.projectedSpread}
                                </div>
                            </div>
                            <div className="bg-slate-900 rounded p-2">
                                <div className="text-[9px] text-slate-500 uppercase">Raw Edge</div>
                                <div className={`text-sm font-black font-mono ${s6.edge >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {s6.edge >= 0 ? '+' : ''}{s6.edge}
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 font-mono text-[10px] text-slate-400 break-all mb-3">
                            {s6.formula}
                        </div>

                        {/* Z-Score + Signal */}
                        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
                            <div className="bg-slate-900 p-4 text-center border-b border-slate-800">
                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Z-Score</div>
                                <div className="text-5xl font-black font-mono text-white">
                                    {s6.zScore >= 0 ? '+' : ''}{s6.zScore}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">|z| = {s6.absZ}</div>
                            </div>
                            <div className="p-4 flex items-center justify-between bg-slate-900/50">
                                <div>
                                    <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Signal</div>
                                    <Badge className={`${signalColors[s6.signal] || signalColors['No Play']} font-black text-xs`}>
                                        {s6.signal}
                                    </Badge>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Confidence</div>
                                    <div className="text-lg font-black text-slate-200">{s6.confidence}</div>
                                </div>
                                {s6.recommendedSide && (
                                    <div className="text-right">
                                        <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Side</div>
                                        <div className="text-sm font-black text-white flex items-center gap-1">
                                            <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                                            {s6.recommendedSide}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Threshold legend */}
                        <div className="mt-3 bg-slate-900 rounded-lg p-3 border border-slate-800">
                            <div className="text-[9px] text-slate-500 uppercase font-bold mb-2">Signal Thresholds</div>
                            <div className="space-y-1">
                                {[
                                    { label: 'ELITE VALUE', threshold: '|z| ≥ 1.00', color: 'text-green-400' },
                                    { label: 'STRONG VALUE', threshold: '|z| ≥ 0.75', color: 'text-emerald-400' },
                                    { label: 'PLAYABLE', threshold: '|z| ≥ 0.55', color: 'text-yellow-400' },
                                    { label: 'No Play', threshold: '|z| < 0.55', color: 'text-slate-500' },
                                ].map(t => (
                                    <div key={t.label} className="flex justify-between items-center text-[10px]">
                                        <span className={`font-bold ${t.color}`}>{t.label}</span>
                                        <span className="font-mono text-slate-600">{t.threshold}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </SheetContent>
        </Sheet>
    );
}
