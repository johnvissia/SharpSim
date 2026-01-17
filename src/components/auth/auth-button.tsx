'use client';

import { useState, useEffect } from 'react';
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
import { LogIn, LogOut, User } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

// This is a mock implementation. In a real app, you would use Firebase Auth.
const useAuth = () => {
  const [user, setUser] = useState<{ displayName: string; email: string; photoURL: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching auth state
    const timeout = setTimeout(() => {
      // To test both states, you can toggle this value
      const isLoggedIn = true;
      if (isLoggedIn) {
        setUser({
          displayName: 'Sharp Bettor',
          email: 'user@example.com',
          photoURL: 'https://picsum.photos/seed/user-avatar/40/40',
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    }, 500);

    return () => clearTimeout(timeout);
  }, []);

  const login = () => {
    setLoading(true);
    setTimeout(() => {
      setUser({
        displayName: 'Sharp Bettor',
        email: 'user@example.com',
        photoURL: 'https://picsum.photos/seed/user-avatar/40/40',
      });
      setLoading(false);
    }, 500);
  };

  const logout = () => {
    setLoading(true);
    setTimeout(() => {
      setUser(null);
      setLoading(false);
    }, 500);
  };

  return { user, loading, login, logout };
};


export function AuthButton() {
  const { user, loading, login, logout } = useAuth();
  const { state: sidebarState } = useSidebar();

  if (loading) {
    return (
      <Button variant="ghost" className="w-full justify-start" disabled>
        <User className="mr-2" />
        {sidebarState === 'expanded' && <span>Loading...</span>}
      </Button>
    );
  }

  if (!user) {
    return (
      <Button variant="ghost" className="w-full justify-start" onClick={login}>
        <LogIn className="mr-2" />
        {sidebarState === 'expanded' && <span>Login</span>}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start p-2 h-auto">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.photoURL} alt={user.displayName} />
              <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            {sidebarState === 'expanded' && (
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">{user.displayName}</span>
                <span className="text-xs text-sidebar-foreground/70">{user.email}</span>
              </div>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 mb-2" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
