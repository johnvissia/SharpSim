import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SiteLayout } from '@/components/layout/site-layout';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { BetSlipProvider } from '@/context/BetSlipContext';

export const metadata: Metadata = {
  title: 'SharpSim: SportsEdge Trainer',
  description: 'A sports betting simulation and coaching platform.',
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
          <BetSlipProvider>
            <SiteLayout>{children}</SiteLayout>
          </BetSlipProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
