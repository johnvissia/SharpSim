'use client';

import { useState, useEffect } from 'react';
import { useUser, useAuth, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Settings as SettingsIcon, User, Moon, Sun, DollarSign, Bell, Shield, Star, Trophy, Edit2, Check, X, KeyRound, Loader2, AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { ManagePlanModal } from '@/components/dashboard/ManagePlanModal';
import { useAppMode } from '@/context/AppModeContext';

const AVAILABLE_LEAGUES = [
    { id: 'EPL', name: 'English Premier League', sport: 'Soccer', badge: '⚽ EPL' },
    { id: 'UCL', name: 'UEFA Champions League', sport: 'Soccer', badge: '🏆 UCL' },
    { id: 'MLS', name: 'Major League Soccer', sport: 'Soccer', badge: '⚽ MLS' },
    { id: 'NBA', name: 'National Basketball Association', sport: 'Basketball', badge: '🏀 NBA' },
    { id: 'NCAAM', name: "Men's College Basketball", sport: 'Basketball', badge: '🏀 NCAAM' },
    { id: 'MLB', name: 'Major League Baseball', sport: 'Baseball', badge: '⚾ MLB' },
    { id: 'NHL', name: 'National Hockey League', sport: 'Hockey', badge: '🏒 NHL' },
    { id: 'NFL', name: 'National Football League', sport: 'Football', badge: '🏈 NFL' },
];

export default function SettingsPage() {
    const { user, isUserLoading } = useUser();
    const auth = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { isRealMoneyMode, toggleRealMoneyMode: toggleAppRealMoneyMode } = useAppMode();

    // Basic state for settings
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [notifications, setNotifications] = useState(true);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [isResettingHistory, setIsResettingHistory] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

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

    const handleToggleRealMoneyMode = () => {
        const nextMode = !isRealMoneyMode;
        toggleAppRealMoneyMode();
        if (nextMode) {
            toast({ title: "Real Money Mode Enabled", description: "You are now tracking real sportsbook odds and balances." });
        } else {
            toast({ title: "Free Play Mode", description: "You are back to simulated betting." });
        }
    };

    const toggleNotifications = () => {
        setNotifications(!notifications);
        toast({ title: "Notifications updated", description: `Alerts are now ${!notifications ? 'on' : 'off'}.` });
    };

    const [localFavoriteLeagues, setLocalFavoriteLeagues] = useState<string[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('sharpsim_favorite_leagues');
            if (saved) setLocalFavoriteLeagues(JSON.parse(saved));
        } catch (e) { }
    }, []);

    useEffect(() => {
        if (user) {
            setNameInput(user.displayName || userProfile?.displayName || '');
        }
    }, [user, userProfile]);

    const handleSaveName = async () => {
        if (!user) return;
        const trimmed = nameInput.trim();
        setIsSavingName(true);
        try {
            await updateProfile(user, { displayName: trimmed });
            if (firestore) {
                const userRef = doc(firestore, 'users', user.uid);
                await updateDoc(userRef, { displayName: trimmed });
            }
            setIsEditingName(false);
            toast({ title: 'Name Updated', description: 'Your display name has been updated.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message || 'Could not update name.' });
        } finally {
            setIsSavingName(false);
        }
    };

    const handleSendPasswordReset = async () => {
        if (!user?.email || !auth) return;
        setIsSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, user.email);
            toast({ title: 'Password Reset Email Sent', description: `Instructions have been sent to ${user.email}.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to Send', description: e.message || 'Could not send reset email.' });
        } finally {
            setIsSendingReset(false);
        }
    };

    const handleResetBettingHistory = async () => {
        if (!user) return;
        setIsResettingHistory(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/user/reset-history', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to reset betting history.');
            }
            toast({ title: 'History Reset', description: 'Your betting history and performance stats have been cleared.' });
            setConfirmReset(false);
            window.location.reload();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Reset Failed', description: e.message || 'Could not reset history.' });
        } finally {
            setIsResettingHistory(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        setIsDeletingAccount(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/user/delete-account', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to delete account.');
            }
            toast({ title: 'Account Deleted', description: 'Your account and personal data have been permanently removed.' });
            await signOut(auth);
            router.push('/signup');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: e.message || 'Could not delete account.' });
            setIsDeletingAccount(false);
        }
    };

    const favoriteLeagues = Array.from(new Set([
        ...(userProfile?.favoriteLeagues || []),
        ...localFavoriteLeagues
    ]));

    const handleToggleFavoriteLeague = async (leagueId: string) => {
        const isCurrentlyFavorite = favoriteLeagues.includes(leagueId);
        const updated = isCurrentlyFavorite
            ? favoriteLeagues.filter(l => l !== leagueId)
            : [...favoriteLeagues, leagueId];

        setLocalFavoriteLeagues(updated);
        try {
            localStorage.setItem('sharpsim_favorite_leagues', JSON.stringify(updated));
        } catch (err) { }

        toast({
            title: isCurrentlyFavorite ? 'Removed from Favorites' : 'Added to Favorites',
            description: isCurrentlyFavorite
                ? `${leagueId} removed from your favorite leagues.`
                : `${leagueId} is now in your favorite leagues!`,
        });

        if (user && firestore) {
            try {
                const userRef = doc(firestore, 'users', user.uid);
                await updateDoc(userRef, {
                    favoriteLeagues: isCurrentlyFavorite ? arrayRemove(leagueId) : arrayUnion(leagueId),
                });
            } catch (err) {
                console.warn('Failed to update favoriteLeagues in Firestore:', err);
            }
        }
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
                    <div className="space-y-5">
                        {/* Display Name */}
                        <div className="flex justify-between items-end pb-4 border-b border-slate-800/50">
                            <div className="flex-1 mr-4">
                                <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-1 uppercase">Display Name</p>
                                {isEditingName ? (
                                    <div className="flex items-center gap-2 mt-1">
                                        <input
                                            type="text"
                                            value={nameInput}
                                            onChange={(e) => setNameInput(e.target.value)}
                                            placeholder="Enter display name"
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-sm text-slate-100 focus:outline-none focus:border-brand-500 w-full max-w-[200px]"
                                        />
                                        <button
                                            onClick={handleSaveName}
                                            disabled={isSavingName}
                                            className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                                            title="Save"
                                        >
                                            {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditingName(false);
                                                setNameInput(user.displayName || userProfile?.displayName || '');
                                            }}
                                            className="p-1.5 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors"
                                            title="Cancel"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-slate-200 text-sm font-medium">
                                        {user.displayName || userProfile?.displayName || 'Not set'}
                                    </p>
                                )}
                            </div>
                            {!isEditingName && (
                                <button
                                    onClick={() => setIsEditingName(true)}
                                    className="text-emerald-500 text-sm font-semibold hover:text-emerald-400 transition-colors flex items-center gap-1"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Edit
                                </button>
                            )}
                        </div>

                        {/* Email */}
                        <div className="flex justify-between items-end pb-4 border-b border-slate-800/50">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-1 uppercase">Email</p>
                                <p className="text-slate-200 text-sm font-medium">
                                    {user.email || (user.isAnonymous ? 'Anonymous Session' : 'No email attached')}
                                </p>
                            </div>
                            {user.email && (
                                <button
                                    onClick={handleSendPasswordReset}
                                    disabled={isSendingReset}
                                    className="text-emerald-500 text-sm font-semibold hover:text-emerald-400 transition-colors flex items-center gap-1"
                                    title="Send password reset link"
                                >
                                    {isSendingReset ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <KeyRound className="w-3.5 h-3.5" />
                                    )}
                                    Reset Password
                                </button>
                            )}
                        </div>

                        {/* User ID */}
                        <div className="flex justify-between items-end pb-4 border-b border-slate-800/50">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-1 uppercase">User ID</p>
                                <p className="text-slate-400 font-mono text-xs">{user.uid}</p>
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
                                <DollarSign className={`w-4 h-4 ${isRealMoneyMode ? 'text-emerald-400' : 'text-slate-400'}`} />
                                Real Money Mode
                            </p>
                            <p className="text-sm text-slate-400">Track actual sportsbook bets instead of virtual currency.</p>
                        </div>
                        <button 
                            onClick={handleToggleRealMoneyMode}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isRealMoneyMode ? 'bg-emerald-500' : 'bg-slate-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isRealMoneyMode ? 'translate-x-6' : 'translate-x-1'}`} />
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

            {/* Favorite Leagues Management */}
            <div className="bg-[#1a1c23] border border-slate-800/60 rounded-2xl p-6 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-xl font-bold text-slate-100">
                            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                            Favorite Leagues
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                            Pin leagues to customize your dashboard feeds and easily filter games under the Favorites tab.
                        </p>
                    </div>
                    {favoriteLeagues.length > 0 && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                            {favoriteLeagues.length} Active
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                    {AVAILABLE_LEAGUES.map(league => {
                        const isFav = favoriteLeagues.includes(league.id);
                        return (
                            <button
                                key={league.id}
                                onClick={() => handleToggleFavoriteLeague(league.id)}
                                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                                    isFav
                                        ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-sm'
                                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                }`}
                            >
                                <div className="min-w-0 pr-2">
                                    <div className="font-bold text-sm truncate flex items-center gap-1.5">
                                        <span>{league.badge}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                        {league.name}
                                    </div>
                                </div>
                                <Star
                                    className={`w-4 h-4 shrink-0 transition-colors ${
                                        isFav
                                            ? 'fill-amber-400 text-amber-400'
                                            : 'text-slate-600'
                                    }`}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>
            
            {/* Danger Zone */}
            <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-6 backdrop-blur-sm mt-8 space-y-6">
                <div>
                    <h3 className="text-red-400 font-bold text-lg flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        Danger Zone
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                        Permanent and irreversible actions regarding your account and stored data.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Reset History Card */}
                    <div className="bg-slate-900/60 border border-red-900/40 p-4 rounded-xl flex flex-col justify-between space-y-3">
                        <div>
                            <p className="text-sm font-bold text-slate-200">Reset Betting History</p>
                            <p className="text-xs text-slate-400 mt-1">
                                Permanently wipe all past and pending bets, reset win/loss stats, and restore your initial 100 coin bankroll.
                            </p>
                        </div>

                        {confirmReset ? (
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={handleResetBettingHistory}
                                    disabled={isResettingHistory}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                >
                                    {isResettingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                    Confirm Reset
                                </button>
                                <button
                                    onClick={() => setConfirmReset(false)}
                                    className="px-3 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmReset(true)}
                                className="w-full bg-red-950/60 hover:bg-red-900 text-red-300 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors border border-red-900/50 flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset Betting History
                            </button>
                        )}
                    </div>

                    {/* Delete Account Card */}
                    <div className="bg-slate-900/60 border border-red-900/40 p-4 rounded-xl flex flex-col justify-between space-y-3">
                        <div>
                            <p className="text-sm font-bold text-slate-200">Delete Account Permanently</p>
                            <p className="text-xs text-slate-400 mt-1">
                                Exercising your right to be forgotten: permanently delete your login, profile, and all analytics data.
                            </p>
                        </div>

                        {confirmDelete ? (
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={isDeletingAccount}
                                    className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                >
                                    {isDeletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    Confirm Delete
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="px-3 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="w-full bg-red-950/60 hover:bg-red-900 text-red-300 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors border border-red-900/50 flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Account
                            </button>
                        )}
                    </div>
                </div>
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
