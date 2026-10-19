'use client';

import { useState, useEffect } from 'react';
import { Info, Sparkles, TrendingUp, ShieldCheck, Activity, BrainCircuit } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ModelFormulaDialogProps {
    currentSport?: string;
}

export function ModelFormulaDialog({ currentSport = 'NFL' }: ModelFormulaDialogProps) {
    const [activeSport, setActiveSport] = useState<string>(currentSport.toUpperCase());

    // When the user opens or changes current sport tab outside, update activeSport inside
    useEffect(() => {
        if (currentSport) {
            setActiveSport(currentSport.toUpperCase());
        }
    }, [currentSport]);

    const sports = [
        { id: 'NFL', label: 'NFL' },
        { id: 'NBA', label: 'NBA' },
        { id: 'MLB', label: 'MLB' },
        { id: 'NCAAM', label: 'NCAAM' },
        { id: 'UCL', label: 'UCL' },
        { id: 'EPL', label: 'EPL' },
        { id: 'NHL', label: 'NHL' },
    ];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                    title={`View ${activeSport} Mathematical Formulas`}
                >
                    <Info className="h-4 w-4 text-slate-300" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-200 shadow-2xl p-6">
                <DialogHeader className="border-b border-slate-800/80 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <DialogTitle className="text-2xl font-black flex items-center gap-2.5 text-white">
                            <BrainCircuit className="h-6 w-6 text-indigo-400" />
                            <span>{activeSport} Model Mathematical Calculations</span>
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-slate-400 text-xs mt-1">
                        Formulas, statistical adjustments, and edge determination algorithms for {activeSport}.
                    </DialogDescription>

                    {/* Sport Switcher Tabs inside the Dialog */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-3 no-scrollbar">
                        {sports.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setActiveSport(s.id)}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                    activeSport === s.id
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* NFL FORMULAS */}
                    {activeSport === 'NFL' && (
                        <div className="space-y-5 animate-in fade-in-50 duration-200">
                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2">
                                    <span>1. Core Projected Spread Formula</span>
                                </h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-1">
                                    <div className="text-emerald-400 font-semibold">
                                        Projected Spread = Net EPA Differential - Dynamic HFA - Weather Delta
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        Negative result = Home team favored (e.g., -6.5 pts).
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">2. Opponent-Adjusted EPA / Play</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-1">
                                    <div className="text-cyan-400">Matchup EPA = 0.60 * (Pass EPA Delta) + 0.40 * (Rush EPA Delta)</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        EPA is weighted against opponent defensive success rate and pass pressure percentages.
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">3. Quarterback Value & Injury Downgrades</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs space-y-1.5">
                                    <div className="text-yellow-400">• Tier 1 Elite (Mahomes, Allen, Lamar): -7.5 pts</div>
                                    <div className="text-yellow-400">• Tier 2 Pro Bowl (Burrow, Stroud, Dak, Purdy): -4.5 pts</div>
                                    <div className="text-yellow-400">• Tier 3 League Average Starter: -3.0 pts</div>
                                    <div className="text-yellow-400">• Tier 4 Bridge / Backup: -1.5 pts</div>
                                    <p className="text-slate-400 pt-1 font-sans text-xs">
                                        Offensive Line cluster penalty: 2+ starters out deducts up to -3.0 pts based on pass-block win rate.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">4. Dynamic Home Field Advantage (HFA)</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-emerald-400">HFA = Base (1.65) + Short Rest (+0.75) + Altitude (+1.20) + Travel Delta</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Base 1.65 pts. Thursday night short rest grants extra +0.75 pts to host. Denver Mile High altitude grants +1.2 pts.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">5. Environmental Weather Degradation</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-emerald-400">Wind &ge; 15 mph = -0.08 Pass EPA/play &amp; -4.5 pts Game Total</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Cold temperature (&lt; 25&deg;F) and heavy precipitation degrade offensive success rate by 6.2%.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">6. Z-Score Edge &amp; Tier Signal</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-2">
                                    <div className="text-green-400 font-bold">Z = (Market Spread - Projected Spread) / 10.5</div>
                                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                                        <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                            <span className="font-bold block">ELITE VALUE</span> |Z| &ge; 1.0 (3.0+ pts)
                                        </div>
                                        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                                            <span className="font-bold block">STRONG VALUE</span> |Z| &ge; 0.75 (2.0+ pts)
                                        </div>
                                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                            <span className="font-bold block">PLAYABLE</span> |Z| &ge; 0.55 (1.5+ pts)
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NBA FORMULAS */}
                    {activeSport === 'NBA' && (
                        <div className="space-y-5 animate-in fade-in-50 duration-200">
                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">1. Core Projected Spread</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-emerald-400 font-semibold">Projected Spread = Away TPR - Home TPR - Dynamic HCA</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Negative result indicates Home Favorite. TPR (True Power Rating) is lineup-adjusted.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">2. True Power Rating (TPR)</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-emerald-400">TPR = BaseRating + InjuryPenalty</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Base Rating uses Lineup-Adjusted Net Rating per 100 possessions, scaled by game Pace.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">3. Injury Impact Model (VORP)</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs space-y-1.5">
                                    <div className="text-cyan-400 font-semibold">Penalty = -PlayerVORP &times; AvailabilityWeight</div>
                                    <div className="text-yellow-400 ml-2">• MVP Candidate: 8.0 pts</div>
                                    <div className="text-yellow-400 ml-2">• All-Star: 5.5 pts</div>
                                    <div className="text-yellow-400 ml-2">• Starter: 3.0 pts</div>
                                    <div className="text-yellow-400 ml-2">• Key Rotation: 1.5 pts</div>
                                    <div className="text-slate-400 ml-2 pt-1 font-sans">
                                        Availability Weights: OUT (1.00), DOUBTFUL (0.80), QUESTIONABLE (0.55), GTD (0.40).
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">4. Dynamic Home Court Advantage</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-emerald-400">HCA = Base (1.50) + Rest Penalty + Altitude</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Back-to-Back fatigue applies -0.80 penalty; 3 games in 4 nights applies -0.60; Denver altitude bonus +0.50.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">5. Z-Score Edge</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-2">
                                    <div className="text-green-400 font-bold">Z = (Market Spread - Projected Spread) / 11.8</div>
                                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                                        <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                            <span className="font-bold block">ELITE VALUE</span> |Z| &ge; 1.0
                                        </div>
                                        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                                            <span className="font-bold block">STRONG VALUE</span> |Z| &ge; 0.75
                                        </div>
                                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                            <span className="font-bold block">PLAYABLE</span> |Z| &ge; 0.55
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MLB FORMULAS */}
                    {activeSport === 'MLB' && (
                        <div className="space-y-5 animate-in fade-in-50 duration-200">
                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">1. Expected Run Projection</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-1">
                                    <div className="text-emerald-400 font-semibold">
                                        Runs = (Pitcher ERA / 4.20) &times; (Lineup wRC+ / 100) &times; ParkFactor &times; 4.50
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        League baseline is 4.50 runs per game. Pitcher quality is regressed against FIP and K-BB%.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">2. Pitcher Split Weighting</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
                                    <div className="text-cyan-400">Composite Pitcher Rating = 0.65 &times; SP FIP + 0.35 &times; Bullpen xFIP</div>
                                    <p className="text-slate-400 pt-1 font-sans">
                                        Accounts for starting pitcher innings expectation (~5.1 IP) plus bullpen relief leverage.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">3. Logistic Win Probability</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-emerald-400">P(Home Win) = 1 / (1 + 10^((AwayRuns - HomeRuns) / 12.0))</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Home field boost adds +0.018 probability points (~0.15 runs margin) to host team.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">4. Runline &amp; Moneyline Edge</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-2">
                                    <div className="text-green-400 font-bold">Edge % = Model Implied Probability - Market Decimal Implied Probability</div>
                                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                                        <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                            <span className="font-bold block">ELITE VALUE</span> Edge &ge; +6.0%
                                        </div>
                                        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                                            <span className="font-bold block">STRONG VALUE</span> Edge &ge; +4.0%
                                        </div>
                                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                            <span className="font-bold block">PLAYABLE</span> Edge &ge; +2.5%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NCAAM FORMULAS */}
                    {activeSport === 'NCAAM' && (
                        <div className="space-y-5 animate-in fade-in-50 duration-200">
                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">1. College Basketball Projected Spread</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-1">
                                    <div className="text-emerald-400 font-semibold">
                                        Projected Spread = Away Net Rating - Home Net Rating - HCA (3.0 pts)
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        College home court advantage is substantial: base 3.0 pts net adjustment.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">2. Box Plus/Minus (BPM) Lineup Impact</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-cyan-400">Missing Player Penalty = (Player BPM - Replacement (-2.0)) &times; (Minutes% / 40)</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Injured key players are deducted relative to bench replacement baseline (-2.0 BPM).
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">3. Standard Deviation &amp; Z-Score Edge</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-2">
                                    <div className="text-green-400 font-bold">Z = (Market Spread - Projected Spread) / 12.0</div>
                                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                                        <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                            <span className="font-bold block">ELITE VALUE</span> |Z| &ge; 1.0
                                        </div>
                                        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                                            <span className="font-bold block">STRONG VALUE</span> |Z| &ge; 0.75
                                        </div>
                                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                            <span className="font-bold block">PLAYABLE</span> |Z| &ge; 0.55
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* UCL (CHAMPIONS LEAGUE) FORMULAS */}
                    {activeSport === 'UCL' && (
                        <div className="space-y-5 animate-in fade-in-50 duration-200">
                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">1. Dixon-Coles Bivariate Poisson Goal Expectancy</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs space-y-1.5">
                                    <div className="text-emerald-400 font-semibold">
                                        &lambda;_home = exp(&alpha;_home + &beta;_away + &gamma;*(1 - neutral) + (&kappa;_home_lg - &kappa;_away_lg))
                                    </div>
                                    <div className="text-emerald-400 font-semibold">
                                        &lambda;_away = exp(&alpha;_away + &beta;_home + (&kappa;_away_lg - &kappa;_home_lg))
                                    </div>
                                    <p className="text-slate-400 pt-1 font-sans text-xs">
                                        &alpha; = Club Attack Power | &beta; = Club Defense Weakness | &gamma; = European Home Advantage (~0.28).
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">2. Cross-League Quality Coefficients (&kappa;)</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
                                    <div className="text-yellow-400">• Premier League: 1.000 | La Liga: 0.952</div>
                                    <div className="text-yellow-400">• Bundesliga: 0.914 | Serie A: 0.902</div>
                                    <div className="text-yellow-400">• Ligue 1: 0.850 | Eredivisie / Liga Portugal: 0.780</div>
                                    <p className="text-slate-400 pt-1 font-sans text-xs">
                                        Normalizes domestic league power ratings across international Champions League fixtures.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">3. Low-Score Tau Dependency Correction</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-cyan-400">&tau;(x, y, &lambda;, &mu;, &rho;) modifies (0-0, 1-0, 0-1, 1-1) scores</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Corrects standard Poisson independence failure for low-scoring European tournament soccer.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">4. 3-Way Match Outcome Probabilities</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
                                    <div className="text-emerald-400">P(Home Win) = &sum; P(i, j) for i &gt; j</div>
                                    <div className="text-cyan-400">P(Draw) = &sum; P(i, i)</div>
                                    <div className="text-rose-400">P(Away Win) = &sum; P(i, j) for i &lt; j</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EPL FORMULAS */}
                    {activeSport === 'EPL' && (
                        <div className="space-y-5 animate-in fade-in-50 duration-200">
                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">1. Expected Goals (xG) Rating Matrix</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-1">
                                    <div className="text-emerald-400 font-semibold">
                                        Club Power = Rolling 10-match Non-Penalty xG / xGA per match
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Regressed against Premier League average (1.35 xG per match) and pitch tilt metrics.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">2. Home Goal Expectancy Boost</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-cyan-400">&lambda;_home += 0.32 goals (Premier League home advantage)</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">3. Time-Decay Weighting Factor</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-yellow-400">Weight = exp(-0.0065 &times; Days Ago)</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Recent form (past 30 days) receives heavier weighting than early-season fixtures.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">4. Asian Handicap &amp; Goal Line Spreads</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-emerald-400">Projected Goal Spread = &lambda;_home - &lambda;_away</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NHL FORMULAS */}
                    {activeSport === 'NHL' && (
                        <div className="space-y-5 animate-in fade-in-50 duration-200">
                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">1. Expected Goals (xGF / xGA) Engine</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-1">
                                    <div className="text-emerald-400 font-semibold">
                                        &lambda;_team = (5v5 xGF/60 &times; 0.75) + (PP xGF/60 &times; 0.25)
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Evaluated per 60 minutes based on shot danger zones (slot vs perimeter).
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">2. Goalie GSAx (Goals Saved Above Expected)</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-cyan-400">Goalie Adjustment = Starting Goalie GSAx/60 - Backup Baseline (-0.35)</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Netminders are evaluated on save rate above expected based on high-danger shot quality.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">3. Regulation vs Overtime Distribution</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-yellow-400">P(OT / Shootout) &asymp; 23.5% across NHL 60-minute regulation</div>
                                    <p className="text-xs text-slate-400 mt-1 font-sans">
                                        Ties after 60 minutes resolve into 3-on-3 sudden death and penalty shootouts.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-indigo-400">4. Puckline (-1.5 / +1.5) &amp; Total Goals</h3>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                                    <div className="text-green-400 font-bold">Total Expected = &lambda;_home + &lambda;_away (Avg: 6.0 goals)</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
