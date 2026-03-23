'use client';

import { Info } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ModelFormulaDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700"
                >
                    <Info className="h-4 w-4 text-slate-400" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Info className="h-6 w-6 text-indigo-400" />
                        NBA Model Formulas
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Mathematical formulas used to calculate projected spreads and edge values
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Core Projection Formula */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-indigo-400">1. Projected Spread</h3>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                            <div className="text-green-400">Projected = Away TPR - Home TPR - Dynamic HCA</div>
                        </div>
                        <p className="text-sm text-slate-400">
                            Negative result indicates Home Favorite. TPR (True Power Rating) is lineup-adjusted.
                        </p>
                    </div>

                    {/* Team Power Rating */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-indigo-400">2. True Power Rating (TPR)</h3>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                            <div className="text-green-400">TPR = BaseRating + InjuryPenalty</div>
                        </div>
                        <p className="text-sm text-slate-400">
                            Base Rating uses Lineup-Adjusted Net Rating per 100 possessions, scaled by Pace.
                        </p>
                    </div>

                    {/* Injury Impact */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-indigo-400">3. Injury Impact Model (VORP)</h3>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm space-y-2">
                            <div className="text-green-400">Penalty = -PlayerVORP × AvailabilityWeight</div>
                            <div className="text-slate-500 mt-2">Value Over Replacement (Estimated):</div>
                            <div className="text-yellow-400 ml-4">• MVP Candidate: 8.0 pts</div>
                            <div className="text-yellow-400 ml-4">• All-Star: 5.5 pts</div>
                            <div className="text-yellow-400 ml-4">• Starter: 3.0 pts</div>
                            <div className="text-yellow-400 ml-4">• Rotation: 1.5 pts</div>
                            <div className="text-slate-500 mt-2">Availability Weights:</div>
                            <div className="text-cyan-400 ml-4">• OUT: 1.00</div>
                            <div className="text-cyan-400 ml-4">• DOUBTFUL: 0.80</div>
                            <div className="text-cyan-400 ml-4">• QUESTIONABLE: 0.55</div>
                            <div className="text-cyan-400 ml-4">• GTD: 0.40</div>
                        </div>
                    </div>

                    {/* Dynamic HCA */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-indigo-400">4. Dynamic Home Court Advantage</h3>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                            <div className="text-green-400">HCA = Base(1.5) + Rest + Altitude + Refs</div>
                        </div>
                        <p className="text-sm text-slate-400">
                            Adjusts for Back-to-Back fatigue (-0.8), 3-in-4 fatigue (-0.6), and elevation bonuses (e.g. Denver +0.5).
                        </p>
                    </div>

                    {/* Z-Score Edge */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-indigo-400">5. Z-Score Edge</h3>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-sm">
                            <div className="text-green-400">Z = (Market - Projected) / 11.8</div>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 mt-2">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-green-400">ELITE:</span> |Z| &ge; 1.0
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-emerald-400">STRONG:</span> |Z| &ge; 0.75
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-yellow-400">PLAYABLE:</span> |Z| &ge; 0.55
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
