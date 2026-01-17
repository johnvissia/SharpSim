'use client';

import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { useAuth, useUser } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarDefaultOpen, setSidebarDefaultOpen] = useState(true);
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  useEffect(() => {
    // Read cookie on client-side to avoid hydration mismatch
    const isSidebarOpen = document.cookie.includes('sidebar_state=true');
    setSidebarDefaultOpen(isSidebarOpen);
  }, []);

  useEffect(() => {
    // Automatically sign in the user anonymously if they are not logged in.
    // This is required for the application to be able to write to Firestore
    // as per the security rules.
    if (auth && !user && !isUserLoading) {
      signInAnonymously(auth);
    }
  }, [auth, user, isUserLoading]);

  return (
    <SidebarProvider defaultOpen={isSidebarDefaultOpen}>
      <div className="flex min-h-screen">
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </div>
    </SidebarProvider>
  );
}
