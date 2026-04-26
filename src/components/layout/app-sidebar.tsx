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
  BarChart3,
  Zap,
  Target,
  History,
  UserRound,
} from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { AuthButton } from '@/components/auth/auth-button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/model', label: 'Model', icon: Zap },
  { href: '/accuracy', label: 'Accuracy', icon: History },
  { href: '/props', label: 'Prop Hub', icon: Target },
  { href: '/player-props', label: 'Prop Insights', icon: UserRound },
  { href: '/my-picks', label: 'My Picks', icon: Ticket },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/store', label: 'Store', icon: Store },
  { href: '/coaching', label: 'Coaching', icon: BookUser },
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
