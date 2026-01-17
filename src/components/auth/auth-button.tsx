'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth, useUser } from '@/firebase';
import { signInAnonymously, signOut } from 'firebase/auth';
import { Skeleton } from '../ui/skeleton';


export function AuthButton() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { state: sidebarState } = useSidebar();

  const handleLogin = () => {
    signInAnonymously(auth);
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (isUserLoading) {
    return (
        <div className="flex items-center gap-2 p-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            {sidebarState === 'expanded' && <Skeleton className="h-6 w-24" />}
        </div>
    );
  }

  if (!user) {
    return (
      <Button variant="ghost" className="w-full justify-start" onClick={handleLogin}>
        <LogIn className="mr-2" />
        {sidebarState === 'expanded' && <span>Login Anonymously</span>}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start p-2 h-auto">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User'} />}
              <AvatarFallback>
                <UserIcon/>
              </AvatarFallback>
            </Avatar>
            {sidebarState === 'expanded' && (
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">{user.isAnonymous ? "Anonymous User" : user.displayName || 'User'}</span>
                <span className="text-xs text-sidebar-foreground/70">{user.uid.slice(0,10)}...</span>
              </div>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 mb-2" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.isAnonymous ? "Anonymous User" : user.displayName || 'User'}</p>
            {user.email && <p className="text-xs leading-none text-muted-foreground">{user.email}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
