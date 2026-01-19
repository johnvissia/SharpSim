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
import { Coins } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function StorePage() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );

  const { data: userProfile, isLoading: isProfileLoading } =
    useDoc<UserProfile>(userProfileRef);

  const [canCollect, setCanCollect] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userProfile) {
      const now = new Date();
      // If lastCoinCollection is not set or is from a previous day, allow collection.
      const lastCollection = userProfile.lastCoinCollection
        ? new Date(userProfile.lastCoinCollection)
        : new Date(0); // Treat as epoch if never collected

      const lastReset = new Date(lastCollection);
      lastReset.setHours(0, 1, 0, 0); // Set to 12:01 AM on that day

      // Can collect if it has been more than 24 hours since the last 12:01 AM reset point
      if (now.getTime() >= lastReset.getTime() + 24 * 60 * 60 * 1000) {
        setCanCollect(true);
      } else {
        setCanCollect(false);
      }
    }
  }, [userProfile]);

  const handleCollect = async () => {
    if (!userProfileRef) return;
    setLoading(true);
    try {
      await updateDoc(userProfileRef, {
        balance: increment(10),
        lastCoinCollection: new Date().toISOString(),
      });

      toast({
        title: 'Success!',
        description: '10 coins have been added to your balance!',
        variant: 'default',
      });
      setCanCollect(false); // Immediately update UI state
    } catch (error: any) {
      console.error('Failed to collect coins:', error);
      toast({
        title: 'Oops!',
        description:
          error.message || 'Could not collect daily coins. Please try again.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Coins className="h-6 w-6 text-accent" />
              Coin Store
            </CardTitle>
            <CardDescription>
              Your daily stop for more coins to play with.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="p-6 bg-secondary rounded-lg">
              <p className="text-lg text-muted-foreground">Current Balance</p>
              <Skeleton className="h-12 w-32 mx-auto mt-2" />
            </div>
            <Skeleton className="h-12 w-full" />
            <p className="text-xs text-muted-foreground">
              Coin collection resets daily at 12:01 AM.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Coins className="h-6 w-6 text-accent" />
            Coin Store
          </CardTitle>
          <CardDescription>
            Your daily stop for more coins to play with.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="p-6 bg-secondary rounded-lg">
            <p className="text-lg text-muted-foreground">Current Balance</p>
            <p className="text-5xl font-bold text-primary">
              {userProfile?.balance?.toFixed(0) ?? '0'}
            </p>
          </div>
          <Button
            onClick={handleCollect}
            disabled={!canCollect || loading}
            className="w-full text-lg py-6"
            size="lg"
          >
            {loading
              ? 'Collecting...'
              : canCollect
              ? 'Collect Daily 10 Coins'
              : 'Collected for Today'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Coin collection resets daily at 12:01 AM.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
