import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | SharpSim',
  description: 'Privacy Policy and data protection terms for SharpSim.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-8 text-slate-300">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="space-y-2 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400">
            <Lock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-slate-400">Effective Date: November 2026</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">1. Information We Collect</h2>
          <p>
            When you register and interact with SharpSim, we collect the following categories of information:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li><strong>Account Identity:</strong> Email address, display name, and authentication tokens provided through Firebase Authentication (including Google OAuth sign-in).</li>
            <li><strong>Simulation &amp; Tracking Activity:</strong> User-placed simulation bets, bankroll history, favorite leagues/teams, and app preference settings.</li>
            <li><strong>Technical &amp; Log Data:</strong> Device identifiers, browser type, and interaction metrics used for performance monitoring and security.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. How We Use Your Information</h2>
          <p>
            Your information is utilized solely to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li>Authenticate your sessions and maintain your simulation bankroll across devices.</li>
            <li>Compute and visualize your personalized sports betting analytics, accuracy metrics, and AI coaching insights.</li>
            <li>Protect our infrastructure from abusive traffic, unauthorized access, and database tampering.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Third-Party Services &amp; Storage</h2>
          <p>
            We leverage industry-standard infrastructure providers to deliver the platform:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li><strong>Google Firebase:</strong> Used for secure cloud authentication and encrypted Firestore database hosting.</li>
            <li><strong>Public Sports Data Providers:</strong> Used for live sports scores, schedules, and consensus odds lines. No personal user data is shared with external data providers.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. Your Privacy Rights &amp; Right to Be Forgotten</h2>
          <p>
            In compliance with applicable privacy regulations (such as GDPR and CCPA), you possess complete sovereignty over your data:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li><strong>Access &amp; Edit:</strong> You can view and update your display name and preferences at any time in <Link href="/settings" className="text-brand-400 underline">Settings</Link>.</li>
            <li><strong>Reset History:</strong> You can completely wipe your betting history, performance stats, and tracking records from your account.</li>
            <li><strong>Permanent Deletion:</strong> You can permanently delete your account, authentication credentials, and all stored data directly through the Danger Zone in <Link href="/settings" className="text-brand-400 underline">Settings</Link>.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Contact Information</h2>
          <p>
            If you have questions regarding this Privacy Policy or your data, you can reach out via your SharpSim account dashboard or settings.
          </p>
        </section>
      </div>
    </div>
  );
}
