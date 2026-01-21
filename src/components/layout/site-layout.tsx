'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  useEffect(() => {
    // Automatically sign in the user anonymously if they are not logged in.
    // This is required for the application to be able to write to Firestore
    // as per the security rules.
    if (auth && !user && !isUserLoading) {
      signInAnonymously(auth);
    }
  }, [auth, user, isUserLoading]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        <main>{children}</main>
    </div>
  );
}
