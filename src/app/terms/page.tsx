import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | SharpSim',
  description: 'Terms of Service and user agreement for SharpSim.',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-8 text-slate-300">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="space-y-2 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400">
            <Shield className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Terms of Service</h1>
            <p className="text-sm text-slate-400">Effective Date: November 2026</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">1. Acceptance of Terms</h2>
          <p>
            By creating an account, browsing, or using SharpSim (&quot;Service&quot;, &quot;we&quot;, &quot;us&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please discontinue using the platform immediately.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. Simulation &amp; Educational Purpose Only (No Real Money Gambling)</h2>
          <p>
            SharpSim is an analytics, sports modeling, and betting simulation platform designed exclusively for educational, strategy testing, and entertainment purposes.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li>SharpSim is <strong>not</strong> a licensed sportsbook, casino, or gambling operator.</li>
            <li>We do not accept, broker, or process real money wagers or deposits.</li>
            <li>All balances, coins, tokens, and rewards within free play are purely virtual simulation markers.</li>
            <li>Virtual coins have <strong>no cash value</strong> and cannot be redeemed, transferred, or exchanged for fiat currency or prizes.</li>
            <li>&quot;Real Money Mode&quot; is strictly an informational personal tracking utility allowing users to log their own third-party sportsbook activity.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Eligibility &amp; Age Restriction</h2>
          <p>
            You must be at least 18 years of age (or the legal age of majority in your jurisdiction) to access or register on SharpSim. By using this service, you represent and warrant that you meet this requirement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. User Accounts &amp; Fair Play</h2>
          <p>
            You are responsible for safeguarding your login credentials. You agree not to attempt to reverse engineer, exploit, scrape, or manipulate server endpoints, database security rules, simulation balances, or prediction models. Unauthorized automated traffic and bot attacks are strictly prohibited.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Subscriptions &amp; Promo Codes</h2>
          <p>
            Certain advanced analytical features are accessible via Sharp Elite memberships or promotional codes. Promotional codes are non-transferable, subject to usage limits, and may be modified or revoked at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">6. No Financial or Betting Advice &amp; Limitation of Liability</h2>
          <p>
            Statistical models, historical trends, power ratings, and AI coach projections provided on SharpSim do not constitute financial, investment, or legal advice. Sports outcomes inherently involve variance and risk. SharpSim is not responsible for any financial decisions, losses, or damages resulting from the use of data provided on the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">7. Responsible Gaming</h2>
          <p>
            We advocate for healthy, responsible engagement with sports entertainment. If you or someone you know is experiencing a gambling problem, call 1-800-GAMBLER (1-800-426-2537) or visit <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline">ncpgambling.org</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
