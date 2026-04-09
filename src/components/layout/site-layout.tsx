'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import {
  LayoutDashboard,
  Ticket,
  BarChart3,
  Database,
  BrainCircuit,
  Target,
  ShoppingCart,
  GraduationCap,
  ShieldCheck,
  Coins,
  LogIn,
  LogOut,
  Zap,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard',  id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/my-picks',   id: 'picks',     label: 'Picks',      icon: Ticket },
  { href: '/stats',      id: 'stats',     label: 'Stats',      icon: BarChart3 },
  { href: '/data',       id: 'data',      label: 'Data',       icon: Database },
  { href: '/model',      id: 'model',     label: 'Model',      icon: BrainCircuit },
  { href: '/accuracy',   id: 'accuracy',  label: 'Accuracy',   icon: Target },
  { href: '/store',      id: 'store',     label: 'Store',      icon: ShoppingCart },
  { href: '/coaching',   id: 'coaching',  label: 'Coaching',   icon: GraduationCap },
  { href: '/admin',      id: 'admin',     label: 'Admin',      icon: ShieldCheck },
];

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

  const getActiveId = () => {
    if (pathname === '/') return 'home';
    const segment = pathname.split('/')[1];
    return navItems.find(item => item.href === `/${segment}`)?.id ?? '';
  };
  const activeId = getActiveId();
  const showNav = pathname !== '/';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {showNav && (
        <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">

            {/* ── Brand ── */}
            <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shadow-lg shadow-emerald-500/30 transition-transform group-hover:scale-105">
                <Zap className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-white">
                Sharp<span className="text-emerald-400">Sim</span>
              </span>
            </Link>

            {/* ── Divider ── */}
            <div className="h-5 w-px bg-slate-800 flex-shrink-0" />

            {/* ── Nav links ── */}
            <nav className="flex items-center gap-0.5 flex-1 min-w-0">
              {navItems.map((item) => {
                const isActive = activeId === item.id;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all duration-150',
                      isActive
                        ? 'text-white bg-slate-800'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5 flex-shrink-0 transition-colors',
                        isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                      )}
                      strokeWidth={2}
                    />
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-emerald-400" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* ── User controls ── */}
            <div className="flex-shrink-0 flex items-center gap-2">
              {isUserLoading || isProfileLoading ? (
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ) : userProfile ? (
                <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-lg text-sm font-semibold text-amber-400">
                  <Coins className="h-4 w-4" />
                  <span>{userProfile.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              ) : null}

              {isUserLoading ? (
                <Skeleton className="h-8 w-20 rounded-lg" />
              ) : user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut(auth)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg h-8 px-3 text-[13px]"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Logout
                </Button>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg h-8 px-4 text-[13px] font-semibold shadow-lg shadow-emerald-500/20"
                >
                  <Link href="/login">
                    <LogIn className="h-3.5 w-3.5 mr-1.5" />
                    Login
                  </Link>
                </Button>
              )}
            </div>

          </div>
        </header>
      )}
      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
    </div>
  );
}