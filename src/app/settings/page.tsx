'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Settings as SettingsIcon, User, Moon, Sun, DollarSign, Bell, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ManagePlanModal } from '@/components/dashboard/ManagePlanModal';

export default function SettingsPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();

    // Basic state for some dummy/local settings
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [realMoneyMode, setRealMoneyMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

    const firestore = useFirestore();
    const userProfileRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc<any>(userProfileRef);

    const isPro = userProfile?.isPro || userProfile?.membershipTier === 'Sharp Elite';
    const membershipTier = userProfile?.membershipTier || 'Free Tier';

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    useEffect(() => {
        // Read theme from document on mount
        if (typeof document !== 'undefined') {
            const isDark = document.documentElement.classList.contains('dark');
            setTheme(isDark ? 'dark' : 'light');
            
            const isRealMoney = document.documentElement.classList.contains('real-money-mode');
            setRealMoneyMode(isRealMoney);
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        toast({ title: "Theme updated", description: `Switched to ${newTheme} mode.` });
    };

    const toggleRealMoneyMode = () => {
        const newMode = !realMoneyMode;
        setRealMoneyMode(newMode);
        if (newMode) {
            document.documentElement.classList.add('real-money-mode');
            toast({ title: "Real Money Mode Enabled", description: "You are now tracking real sportsbook odds and balances." });
        } else {
            document.documentElement.classList.remove('real-money-mode');
            toast({ title: "Free Play Mode", description: "You are back to simulated betting." });
        }
    };

    const toggleNotifications = () => {
        setNotifications(!notifications);
        toast({ title: "Notifications updated", description: `Alerts are now ${!notifications ? 'on' : 'off'}.` });
    };

    if (isUserLoading || !user) {
        return (
            <div className="flex justify-center items-center h-64 text-slate-400">
                Loading settings...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-500 pb-12">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-brand-500/20 text-brand-400 rounded-xl">
                    <SettingsIcon className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Settings</h1>
                    <p className="text-slate-400">Manage your account preferences and app behavior.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Profile & Account */}
                <div className="bg-[#1a1c23] border border-slate-800/60 rounded-2xl p-6 flex flex-col justify-between shadow-lg">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-2 text-xl font-bold text-slate-100 mb-1">
                                <User className="w-5 h-5 text-emerald-500" />
                                Profile & Account
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase">
                                Identity Management
                            </div>
                        </div>
                        <div className="w-14 h-14 rounded-xl bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.05)] relative group cursor-pointer hover:border-emerald-500/50 transition-colors">
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/20 to-transparent"></div>
                            <User className="w-6 h-6 text-emerald-500/50 group-hover:text-emerald-400 transition-colors" />
                        </div>
                    </div>

                    {/* Content Fields */}
                    <div className="space-y-6">
                        {/* User ID */}
                        <div className="flex justify-between items-end pb-4 border-b border-slate-800/50">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-1 uppercase">User ID</p>
                                <p className="text-slate-300 font-mono text-sm">{user.uid}</p>
                            </div>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(user.uid);
                                    toast({ title: "Copied!", description: "User ID copied to clipboard." });
                                }}
                                className="text-emerald-500 text-sm font-semibold hover:text-emerald-400 transition-colors"
                            >
                                Copy
                            </button>
                        </div>

                        {/* Email */}
                        <div className="flex justify-between items-end pb-4 border-b border-slate-800/50">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-1 uppercase">Email</p>
                                <p className="text-slate-200 text-sm font-medium">{user.email || 'pro.bettor@quantedge.com'}</p>
                            </div>
                            <button className="text-emerald-500 text-sm font-semibold hover:text-emerald-400 transition-colors">
                                Change
                            </button>
                        </div>

                        {/* Membership Tier */}
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-1 uppercase">Membership Tier</p>
                                <div className="flex items-center gap-3">
                                    <span className={`${isPro ? 'text-emerald-500' : 'text-slate-400'} font-bold text-base`}>
                                        {isPro ? 'Sharp Elite' : 'Free Tier'}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                                        isPro 
                                            ? 'bg-[#1d3b2b] text-emerald-400 border-emerald-900/30' 
                                            : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}>
                                        {isPro ? 'Active' : 'Free'}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsUpgradeModalOpen(true)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                            >
                                Manage Plan
                            </button>
                        </div>
                    </div>
                </div>

                {/* Preferences */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-6">
                    <div className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                        <Shield className="w-5 h-5 text-brand-400" />
                        App Preferences
                    </div>

                    {/* Theme Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-semibold flex items-center gap-2">
                                {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
                                Theme Appearance
                            </p>
                            <p className="text-sm text-slate-400">Switch between light and dark modes.</p>
                        </div>
                        <button 
                            onClick={toggleTheme}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${theme === 'dark' ? 'bg-brand-500' : 'bg-slate-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Real Money Mode Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-semibold flex items-center gap-2">
                                <DollarSign className={`w-4 h-4 ${realMoneyMode ? 'text-emerald-400' : 'text-slate-400'}`} />
                                Real Money Mode
                            </p>
                            <p className="text-sm text-slate-400">Track actual sportsbook bets instead of virtual currency.</p>
                        </div>
                        <button 
                            onClick={toggleRealMoneyMode}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${realMoneyMode ? 'bg-emerald-500' : 'bg-slate-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${realMoneyMode ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Notifications Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-semibold flex items-center gap-2">
                                <Bell className={`w-4 h-4 ${notifications ? 'text-rose-400' : 'text-slate-400'}`} />
                                Push Notifications
                            </p>
                            <p className="text-sm text-slate-400">Get alerts for game starts and bet settlements.</p>
                        </div>
                        <button 
                            onClick={toggleNotifications}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${notifications ? 'bg-rose-500' : 'bg-slate-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Danger Zone (Placeholder) */}
            <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-6 backdrop-blur-sm mt-8">
                <h3 className="text-red-400 font-bold mb-2">Danger Zone</h3>
                <p className="text-sm text-slate-400 mb-4">Permanent actions regarding your account data.</p>
                <button className="bg-red-950 text-red-400 hover:bg-red-900 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-red-900/50">
                    Reset Betting History
                </button>
            </div>
            
            <ManagePlanModal 
                isOpen={isUpgradeModalOpen} 
                onClose={() => setIsUpgradeModalOpen(false)} 
                isPro={isPro}
                membershipTier={membershipTier}
            />
        </div>
    );
}
