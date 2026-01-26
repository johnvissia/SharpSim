'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Coins, Pencil, Save, LogIn, LogOut, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


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

  const [isEditing, setIsEditing] = useState(false);

  const initialNavItems = [
    { href: '/', id: 'home', label: '🏠 Home' },
    { href: '/dashboard', id: 'dashboard', label: '🔥 Dashboard' },
    { href: '/prop-hub', id: 'prop-hub', label: '👥 Prop Hub' },
    { href: '/my-picks', id: 'picks', label: '🎫 My Picks' },
    { href: '/stats', id: 'stats', label: '📊 Stats' },
    { href: '/data', id: 'data', label: '📈 Data' },
    { href: '/store', id: 'store', label: '🛒 Store' },
    { href: '/coaching', id: 'coaching', label: '🎓 Coaching' },
    { href: '/admin', id: 'admin', label: '🛡️ Admin' }
  ];

  const [navItems, setNavItems] = useState(initialNavItems);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Load order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem('navOrder');
    if (savedOrder) {
      try {
        const orderedIds: string[] = JSON.parse(savedOrder);
        const orderedItems = orderedIds
          .map(id => initialNavItems.find(item => item.id === id))
          .filter((item): item is typeof initialNavItems[0] => !!item);
        
        const currentIds = new Set(orderedItems.map(i => i.id));
        const missingItems = initialNavItems.filter(item => !currentIds.has(item.id));
        setNavItems([...orderedItems, ...missingItems]);
      } catch (e) {
        console.error("Failed to parse nav order from localStorage", e);
        setNavItems(initialNavItems);
      }
    } else {
      setNavItems(initialNavItems);
    }
  }, []);

  const handleSaveOrder = () => {
    const orderedIds = navItems.map(item => item.id);
    localStorage.setItem('navOrder', JSON.stringify(orderedIds));
    setIsEditing(false);
  };
  
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault(); // Necessary to allow drop
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newNavItems = [...navItems];
    const [draggedItem] = newNavItems.splice(draggedItemIndex, 1);
    newNavItems.splice(index, 0, draggedItem);
    
    setDraggedItemIndex(index);
    setNavItems(newNavItems);
  };
  
  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };
  
  const getActiveTabId = () => {
    if (pathname === '/') return 'home';
    const activeSegment = pathname.split('/')[1];
    if (activeSegment) {
        const activeItem = initialNavItems.find(item => item.href === `/${activeSegment}`);
        if(activeItem) return activeItem.id;
    }
    return '';
  };
  const activeTab = getActiveTabId();

  const showNav = pathname !== '/';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
       <div className="max-w-5xl mx-auto">
        {showNav && (
            <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 py-3 mb-4">
                <div className="flex items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-2 flex-grow min-w-0">
                    <nav 
                        className={cn(
                        "flex items-center gap-1 overflow-x-auto no-scrollbar",
                        isEditing && "space-x-1"
                        )}
                        onDragOver={isEditing ? (e) => e.preventDefault() : undefined}
                    >
                        {navItems.map((tab, index) => (
                        <div
                            key={tab.id}
                            draggable={isEditing}
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                            "transition-all",
                            isEditing ? 'cursor-move rounded-full p-0.5 bg-slate-800' : '',
                            draggedItemIndex === index ? 'opacity-50 scale-95' : 'opacity-100'
                            )}
                        >
                            <Link
                            href={tab.href}
                            className={cn(
                                'px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 block',
                                activeTab === tab.id && !isEditing
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                : 'text-slate-400 hover:text-white',
                                isEditing ? 'pointer-events-none bg-slate-700 text-white' : 'hover:bg-slate-800'
                            )}
                            onClick={(e) => {
                                if (isEditing) e.preventDefault();
                            }}
                            >
                            {tab.label}
                            </Link>
                        </div>
                        ))}
                    </nav>
                    {isEditing ? (
                        <Button onClick={handleSaveOrder} size="sm" className="bg-green-600 hover:bg-green-500 text-white ml-2 flex-shrink-0">
                        <Save className="h-4 w-4 mr-2"/> Save
                        </Button>
                    ) : (
                        <Button onClick={() => setIsEditing(true)} size="icon" variant="ghost" className="flex-shrink-0">
                        <Pencil className="h-4 w-4 text-slate-400 hover:text-white"/>
                        </Button>
                    )}
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
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
                        
                        {isUserLoading ? (
                            <Skeleton className="h-9 w-20" />
                        ) : user ? (
                            <Button variant="ghost" size="sm" onClick={() => signOut(auth)}>
                                <LogOut className="h-4 w-4 mr-2" />
                                Logout
                            </Button>
                        ) : (
                            <Button asChild size="sm">
                                <Link href="/login">
                                    <LogIn className="h-4 w-4 mr-2" />
                                    Login
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        )}
        <main className="px-4 pb-8">{children}</main>
      </div>
    </div>
  );
}
