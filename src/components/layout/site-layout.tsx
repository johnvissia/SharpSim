'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Coins } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const pathname = usePathname();
  
  const userProfileRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);


  useEffect(() => {
    // Automatically sign in the user anonymously if they are not logged in.
    // This is required for the application to be able to write to Firestore
    // as per the security rules.
    if (auth && !user && !isUserLoading) {
      signInAnonymously(auth);
    }
  }, [auth, user, isUserLoading]);
  
  const navItems = [
    { href: '/', id: 'dashboard', label: '🔥 Dashboard' },
    { href: '/my-picks', id: 'picks', label: '🎫 My Picks' },
    { href: '/stats', id: 'stats', label: '📊 Stats' },
    { href: '/data', id: 'data', label: '📈 Data' },
    { href: '/store', id: 'store', label: '🛒 Store' },
    { href: '/coaching', id: 'coaching', label: '🎓 Coaching' },
    { href: '/admin', id: 'admin', label: '🛡️ Admin' }
  ];
  
  const getActiveTabId = () => {
    if (pathname === '/') return 'dashboard';
    if (pathname.startsWith('/my-picks')) return 'picks';
    if (pathname.startsWith('/stats')) return 'stats';
    if (pathname.startsWith('/data')) return 'data';
    if (pathname.startsWith('/store')) return 'store';
    if (pathname.startsWith('/coaching')) return 'coaching';
    if (pathname.startsWith('/admin')) return 'admin';
    return '';
  }
  const activeTab = getActiveTabId();


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
       <div className="max-w-5xl mx-auto">
        <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 py-3 mb-4">
            <div className="flex items-center justify-between gap-4 px-2">
              <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {navItems.map((tab) => (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`
                      px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all flex-shrink-0
                      ${activeTab === tab.id 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                    `}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>
              <div className="flex-shrink-0">
                  {isUserLoading || isProfileLoading ? (
                      <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-full">
                          <Skeleton className="h-5 w-5 rounded-full" />
                          <Skeleton className="h-5 w-16" />
                      </div>
                  ) : userProfile ? (
                      <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-full text-sm font-bold text-amber-400">
                          <Coins className="h-5 w-5" />
                          <span>{userProfile.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                  ) : null}
              </div>
            </div>
        </div>

        <main className="px-4 pb-8">{children}</main>
      </div>
    </div>
  );
}
