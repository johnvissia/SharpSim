import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SiteLayout } from '@/components/layout/site-layout';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { BetSlipProvider } from '@/context/BetSlipContext';
import { AppModeProvider } from '@/context/AppModeContext';
import { ActivityTracker } from '@/components/analytics/ActivityTracker';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#090a0f',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sharpsim.vercel.app'),
  title: {
    default: 'SharpSim: Sports Analytics & Edge Simulation',
    template: '%s | SharpSim',
  },
  description: 'Real-time sports betting simulation, algorithmic edge modeling, live odds aggregation, and disciplined bankroll training.',
  keywords: [
    'sports betting simulation',
    'sharp sports edge',
    'sports betting model',
    'bankroll tracker',
    'odds comparison',
    'NBA player props',
    'EPL predictions',
    'sports data analytics',
  ],
  authors: [{ name: 'SharpSim Team' }],
  creator: 'SharpSim',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://sharpsim.vercel.app',
    title: 'SharpSim: Sports Analytics & Edge Simulation',
    description: 'Algorithmic sports betting models, expected value detection, and risk-free simulation tracking.',
    siteName: 'SharpSim',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SharpSim: Sports Analytics & Edge Simulation',
    description: 'Algorithmic sports betting models, expected value detection, and risk-free simulation tracking.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Kalam:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <FirebaseClientProvider>
          <ActivityTracker />
          <AppModeProvider>
            <BetSlipProvider>
              <SiteLayout>{children}</SiteLayout>
            </BetSlipProvider>
          </AppModeProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
