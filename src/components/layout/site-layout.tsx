'use client';

import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarDefaultOpen, setSidebarDefaultOpen] = useState(true);

  useEffect(() => {
    // Read cookie on client-side to avoid hydration mismatch
    const isSidebarOpen = document.cookie.includes('sidebar_state=true');
    setSidebarDefaultOpen(isSidebarOpen);
  }, []);

  return (
    <SidebarProvider defaultOpen={isSidebarDefaultOpen}>
      <div className="flex min-h-screen">
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </div>
    </SidebarProvider>
  );
}
