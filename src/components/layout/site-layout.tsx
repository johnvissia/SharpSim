'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { useAppMode } from '@/context/AppModeContext';
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
  Coins,
  LogIn,
  LogOut,
  Zap,
  Wallet,
  Gamepad2,
  Settings,
  User as UserIcon,
  History,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { BetSlip } from '@/components/dashboard/BetSlip';

const navItems = [
  { href: '/dashboard',   id: 'dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/my-picks',    id: 'picks',        label: 'Picks',         icon: Ticket },
  { href: '/stats',       id: 'stats',        label: 'Stats',         icon: BarChart3 },
  { href: '/data',        id: 'data',         label: 'Data',          icon: Database },
  { href: '/model',       id: 'model',        label: 'Model',         icon: BrainCircuit },
  { href: '/prop-hub',    id: 'prop-hub',     label: 'Prop Hub',      icon: Target },
  { href: '/player-props',id: 'player-props', label: 'Prop Insights', icon: UserIcon },
  { href: '/accuracy',    id: 'accuracy',     label: 'Accuracy',      icon: History },
  { href: '/store',       id: 'store',        label: 'Store',         icon: ShoppingCart },
  { href: '/coaching',    id: 'coaching',     label: 'Coaching',      icon: GraduationCap },
];

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isRealMoneyMode, toggleRealMoneyMode } = useAppMode();
  const auth = useAuth();
  const firestore = useFirestore();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPath = pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password';

  useEffect(() => {
    if (!isUserLoading) {
      if (!user && !isPublicPath) {
        router.push('/login');
      } else if (user && isPublicPath && pathname !== '/') {
        router.push('/dashboard');
      }
    }
  }, [user, isUserLoading, isPublicPath, pathname, router]);

  const userProfileRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const getActiveId = () => {
    if (!pathname || pathname === '/') return 'home';
    const segment = pathname.split('/')[1];
    return navItems.find(item => item.href === `/${segment}`)?.id ?? '';
  };
  const activeId = getActiveId();
  const showNav = !isPublicPath;

  let content = children;

  if (isUserLoading) {
    content = (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  } else if (!user && !isPublicPath) {
    content = null;
  }

  return (
    <div className={cn(
      "min-h-screen bg-slate-950 text-slate-100 font-sans transition-colors duration-500",
      isRealMoneyMode && "selection:bg-emerald-500/30"
    )}>
      {/* ── Real Money Mode Watermark Banner ── */}
      {isRealMoneyMode && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-6 bg-emerald-500/10 backdrop-blur-sm pointer-events-none flex items-center justify-center overflow-hidden border-b border-emerald-500/20">
          <div className="flex animate-[slide_10s_linear_infinite] whitespace-nowrap text-[10px] font-bold tracking-[0.2em] text-emerald-400/60 uppercase">
            {[...Array(20)].map((_, i) => (
              <span key={i} className="mx-8 flex items-center gap-2">
                <Wallet className="h-2.5 w-2.5" />
                Real Money Mode Active
              </span>
            ))}
          </div>
        </div>
      )}

      {showNav && (
        <header className={cn(
          "sticky top-0 z-30 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl transition-all duration-300",
          isRealMoneyMode && "mt-6 border-emerald-500/20 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)]"
        )}>
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">

            {/* ── Brand ── */}
            <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shadow-lg transition-all group-hover:scale-105",
                isRealMoneyMode 
                  ? "bg-emerald-500 shadow-emerald-500/30" 
                  : "bg-brand-500 shadow-brand-500/30"
              )}>
                <Zap className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-white">
                Sharp<span className={cn(
                  "transition-colors",
                  isRealMoneyMode ? "text-emerald-400" : "text-brand-400"
                )}>Sim</span>
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
                        isActive 
                          ? (isRealMoneyMode ? 'text-emerald-400' : 'text-brand-400')
                          : 'text-slate-500 group-hover:text-slate-300'
                      )}
                      strokeWidth={2}
                    />
                    {item.label}
                    {isActive && (
                      <span className={cn(
                        "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full transition-colors",
                        isRealMoneyMode ? "bg-emerald-400" : "bg-brand-400"
                      )} />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* ── User controls ── */}
            <div className="flex-shrink-0 flex items-center gap-4">
              {/* ── Mode Toggle ── */}
              <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800/50 px-2.5 py-1 rounded-full">
                <div className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                  !isRealMoneyMode ? "text-brand-400" : "text-slate-600"
                )}>
                  <Gamepad2 className="h-3.5 w-3.5" />
                </div>
                <Switch 
                  checked={isRealMoneyMode} 
                  onCheckedChange={toggleRealMoneyMode}
                  className={cn(
                    "data-[state=checked]:bg-emerald-500",
                    "data-[state=unchecked]:bg-brand-500"
                  )}
                />
                <div className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                  isRealMoneyMode ? "text-emerald-400" : "text-slate-600"
                )}>
                  <Wallet className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full border border-slate-700/50 hover:bg-slate-800">
                        <Avatar className="h-7 w-7">
                          {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User'} />}
                          <AvatarFallback className="bg-slate-800 text-slate-300">
                            <UserIcon className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 mt-1 border-slate-800/80 bg-slate-950/95 backdrop-blur-xl text-slate-200 shadow-xl" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none text-slate-100">{user.isAnonymous ? "Anonymous User" : user.displayName || 'User'}</p>
                          {user.email && <p className="text-xs leading-none text-slate-400">{user.email}</p>}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-slate-800/80" />
                      <DropdownMenuItem className="cursor-pointer hover:bg-slate-800/80 focus:bg-slate-800/80 text-slate-300" onClick={() => router.push('/settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-slate-800/80 focus:bg-slate-800/80 text-rose-400 focus:text-rose-400" onClick={() => signOut(auth)}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    asChild
                    size="sm"
                    className={cn(
                      "text-white rounded-lg h-8 px-4 text-[13px] font-semibold shadow-lg transition-all",
                      isRealMoneyMode 
                        ? "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20"
                        : "bg-brand-500 hover:bg-brand-400 shadow-brand-500/20"
                    )}
                  >
                    <Link href="/login">
                      <LogIn className="h-3.5 w-3.5 mr-1.5" />
                      Login
                    </Link>
                  </Button>
                )}
              </div>
            </div>

          </div>
        </header>
      )}
      <main className="mx-auto max-w-[1400px] px-6 py-6">{content}</main>
      {showNav && <BetSlip />}
    </div>
  );
}