'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Coins, Clock, Sparkles, Loader2, Gift } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export default function StorePage() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const [canCollect, setCanCollect] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const calculateStatus = () => {
      if (!userProfile) return;
      const lastCollectedTime = userProfile.lastCoinCollection
        ? new Date(userProfile.lastCoinCollection).getTime()
        : 0;

      const now = Date.now();
      const elapsed = now - lastCollectedTime;

      if (elapsed >= COOLDOWN_MS) {
        setCanCollect(true);
        setTimeLeft('');
      } else {
        setCanCollect(false);
        const remaining = COOLDOWN_MS - elapsed;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    calculateStatus();
    const interval = setInterval(calculateStatus, 1000);
    return () => clearInterval(interval);
  }, [userProfile]);

  const handleCollect = async () => {
    if (!user) {
      toast({
        title: 'Sign In Required',
        description: 'You must be logged in to claim daily coins.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/collect-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to collect daily coins.');
      }

      toast({
        title: 'Daily Reward Claimed!',
        description: `+${data.reward} simulation coins have been added to your bankroll!`,
      });
      setCanCollect(false);
    } catch (error: any) {
      console.error('Failed to collect coins:', error);
      toast({
        title: 'Collection Failed',
        description: error.message || 'Could not collect daily coins. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Card className="w-full max-w-md border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl text-white">
              <Coins className="h-6 w-6 text-amber-400" />
              Coin Store
            </CardTitle>
            <CardDescription className="text-slate-400">
              Loading bankroll and streak status...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="p-6 bg-slate-900/60 rounded-xl border border-slate-800">
              <Skeleton className="h-4 w-28 mx-auto mb-2" />
              <Skeleton className="h-12 w-32 mx-auto" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-md border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
            <Gift className="h-7 w-7 text-amber-400" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-white">
            Daily Coin Reload
          </CardTitle>
          <CardDescription className="text-slate-400">
            Claim 50 free coins every 24 hours to keep testing your betting models.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6 pt-4">
          <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Coins className="h-24 w-24 text-amber-400" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Bankroll</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Coins className="h-7 w-7 text-amber-400" />
              <p className="text-4xl font-extrabold text-white font-mono tracking-tight">
                {(userProfile?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <Button
            onClick={handleCollect}
            disabled={!canCollect || loading}
            className={`w-full py-6 text-base font-bold rounded-xl transition-all shadow-lg ${
              canCollect 
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20' 
                : 'bg-slate-800 text-slate-400 border border-slate-700/50 cursor-not-allowed'
            }`}
            size="lg"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Validating with server...
              </span>
            ) : canCollect ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Claim +50 Free Coins
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-slate-500" />
                Cooldown: {timeLeft}
              </span>
            )}
          </Button>

          <p className="text-xs text-slate-500 leading-relaxed">
            Reload cooldown is verified server-side. Virtual coins have no real-world monetary value and are solely for strategy simulation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
