'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { useUser } from '@/firebase';

export default function HomePage() {
  const { user, isUserLoading } = useUser();

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
      <main className="max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-amber-400">
          Welcome to SharpSim
        </h1>
        <p className="mt-4 text-lg md:text-xl text-muted-foreground">
          Your personal sports betting simulator and AI-powered coach. Hone your skills, track your performance, and get an edge without risking a dime.
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          {isUserLoading ? (
             <Button size="lg" disabled>Loading...</Button>
          ) : user ? (
            <Button asChild size="lg">
              <Link href="/dashboard">
                View Dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/login">
                  <LogIn className="mr-2 h-5 w-5" /> Login
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/signup">
                  <UserPlus className="mr-2 h-5 w-5" /> Sign Up Free
                </Link>
              </Button>
            </>
          )}
        </div>
      </main>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <Card>
              <CardHeader>
                  <CardTitle>Realistic Simulation</CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-muted-foreground">Bet on real games with live odds, from single bets to complex parlays, using virtual currency.</p>
              </CardContent>
          </Card>
           <Card>
              <CardHeader>
                  <CardTitle>AI Coaching</CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-muted-foreground">Get personalized feedback on your betting patterns and strategies from our AI betting coach.</p>
              </CardContent>
          </Card>
           <Card>
              <CardHeader>
                  <CardTitle>In-Depth Stats</CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-muted-foreground">Track your performance across different sports, bet types, and teams to find your winning formula.</p>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
