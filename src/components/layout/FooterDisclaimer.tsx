'use client';

import Link from 'next/link';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export function FooterDisclaimer() {
  return (
    <footer className="mt-16 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-xl text-slate-400 text-xs py-8 px-6">
      <div className="max-w-[1400px] mx-auto space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold tracking-tight text-sm">SharpSim</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 font-medium text-xs">Quantitative Sports Analytics & Simulation Engine</span>
          </div>
          <div className="flex items-center gap-6 text-slate-400">
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/settings" className="hover:text-white transition-colors">
              Settings & Privacy Controls
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-400 leading-relaxed text-[11px]">
          <div>
            <p className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-400" />
              Educational & Strategy Simulation Platform
            </p>
            <p>
              SharpSim is an analytics and betting simulation platform intended strictly for educational, research, and entertainment purposes. SharpSim is not a licensed sportsbook, does not accept deposits or bets, and does not facilitate real money gaming. Virtual coins possess zero cash or monetary value and cannot be redeemed, transferred, or exchanged for currency.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              Responsible Gaming Notice
            </p>
            <p>
              If you or someone you know is struggling with a gambling problem, confidential crisis counseling and referral services are available 24/7. Call or text <strong className="text-slate-200">1-800-GAMBLER</strong> (1-800-426-2537) or visit <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">ncpgambling.org</a>. Users must be at least 18 years of age (or the legal age of majority in their jurisdiction) to use this platform.
            </p>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 text-center pt-2">
          &copy; {new Date().getFullYear()} SharpSim. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
