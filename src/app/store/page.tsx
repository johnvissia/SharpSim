'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Coins } from 'lucide-react';

// Mock server state
let lastCollectionDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
let userBalance = 50;

// Mock server action
const collectDailyCoinsAction = async () => {
  return new Promise<{ success: boolean; message: string; newBalance?: number }>((resolve) => {
    setTimeout(() => {
      const now = new Date();
      const lastReset = new Date(lastCollectionDate);
      lastReset.setHours(0, 1, 0, 0); // Set to 12:01 AM on that day

      if (now.getTime() < lastReset.getTime() + 24 * 60 * 60 * 1000) {
        resolve({ success: false, message: 'You have already collected your coins for today.' });
      } else {
        lastCollectionDate = now;
        userBalance += 10;
        resolve({ success: true, message: '10 coins have been added to your balance!', newBalance: userBalance });
      }
    }, 500);
  });
};


export default function StorePage() {
  const { toast } = useToast();
  const [balance, setBalance] = useState(userBalance);
  const [canCollect, setCanCollect] = useState(true);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // This effect would check on load if the user can collect
    // In a real app, this logic is best handled server-side and passed to the client
    const checkCollectionStatus = () => {
      const now = new Date();
      const lastReset = new Date(lastCollectionDate);
      lastReset.setHours(0, 1, 0, 0);
      if (now.getTime() < lastReset.getTime() + 24 * 60 * 60 * 1000) {
          setCanCollect(false);
      } else {
          setCanCollect(true);
      }
    };
    checkCollectionStatus();
  }, []);


  const handleCollect = async () => {
    setLoading(true);
    const result = await collectDailyCoinsAction();
    if (result.success) {
      setBalance(result.newBalance!);
      setCanCollect(false);
      toast({
        title: 'Success!',
        description: result.message,
        variant: 'default',
      });
    } else {
      setCanCollect(false);
      toast({
        title: 'Oops!',
        description: result.message,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

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
            <p className="text-5xl font-bold text-primary">{balance}</p>
          </div>
          <Button
            onClick={handleCollect}
            disabled={!canCollect || loading}
            className="w-full text-lg py-6"
            size="lg"
          >
            {loading ? 'Collecting...' : canCollect ? 'Collect Daily 10 Coins' : 'Collected for Today'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Coin collection resets daily at 12:01 AM.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
