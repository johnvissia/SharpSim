'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutGrid,
  Store,
  BookUser,
  Ticket,
  Shield,
} from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { AuthButton } from '@/components/auth/auth-button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/my-picks', label: 'My Picks', icon: Ticket },
  { href: '/store', label: 'Store', icon: Store },
  { href: '/coaching', label: 'Coaching', icon: BookUser },
  { href: '/admin', label: 'Admin', icon: Shield },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-semibold text-sidebar-foreground">
            SharpSim
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <AuthButton />
      </SidebarFooter>
    </Sidebar>
  );
}
