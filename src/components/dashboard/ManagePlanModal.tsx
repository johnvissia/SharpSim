'use client';

import { useState } from 'react';
import { Crown, X, CreditCard, Gift, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { validatePromoCode } from '@/lib/promo';

interface ManagePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  membershipTier: string;
}

export function ManagePlanModal({ isOpen, onClose, isPro, membershipTier }: ManagePlanModalProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'code'>('card');
  const [promoCode, setPromoCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    if (!user || !firestore) {
      toast({ title: 'Error', description: 'You must be logged in to upgrade.', variant: 'destructive' });
      return;
    }

    // Validate promo code via Firestore (with local fallback checks)
    if (paymentMethod === 'code') {
      const { valid, message } = await validatePromoCode(firestore, promoCode);
      if (!valid) {
        toast({
          title: 'Invalid Code',
          description: message || 'The promo code entered is invalid.',
          variant: 'destructive'
        });
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Simulate network/payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        isPro: true,
        membershipTier: 'Sharp Elite'
      });

      toast({ 
        title: 'Upgrade Successful!', 
        description: 'Welcome to Sharp Elite. All pro features are now unlocked.' 
      });
      onClose();
      
      // Refresh to update application state
      window.location.reload();
    } catch (error) {
      console.error('Upgrade error:', error);
      toast({ title: 'Upgrade Failed', description: 'An error occurred during upgrade.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelMembership = async () => {
    if (!user || !firestore) {
      toast({ title: 'Error', description: 'You must be logged in to manage your plan.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        isPro: false,
        membershipTier: 'Free Tier'
      });

      toast({ 
        title: 'Membership Canceled', 
        description: 'Your Sharp Elite membership has been canceled. You have returned to the Free Tier.' 
      });
      setShowCancelConfirm(false);
      onClose();
      
      // Refresh to update application state
      window.location.reload();
    } catch (error) {
      console.error('Cancellation error:', error);
      toast({ title: 'Operation Failed', description: 'An error occurred while canceling your membership.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1c23] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {isPro ? (
          /* ====================================================================
             PRO USER FLOW (Cancel subscription, Upgrade disabled)
             ==================================================================== */
          showCancelConfirm ? (
            <div className="p-6 space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/30">
                  <AlertTriangle className="w-8 h-8 text-rose-400" />
                </div>
                <h3 className="text-xl font-black text-white">Cancel Membership?</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Are you sure you want to cancel your <span className="text-emerald-400 font-bold">Sharp Elite</span> membership? You will instantly lose access to:
                </p>
                <ul className="text-left text-xs text-slate-400 space-y-1 max-w-xs mx-auto list-disc pl-5">
                  <li>Proprietary predictive models (NBA, NCAAM, MLB)</li>
                  <li>Point edge calculations and statistical projections</li>
                  <li>Value Opportunity Map dashboard components</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isProcessing}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl transition-all"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelMembership}
                  disabled={isProcessing}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 p-6 text-center border-b border-slate-800/50">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-pulse">
                  <Crown className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-black text-white mb-1">Sharp Elite</h2>
                <p className="text-slate-400 text-sm">Your membership is fully active</p>
              </div>

              {/* Status Info */}
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <div className="text-left">
                        <p className="text-sm font-black text-white">Sharp Elite Access</p>
                        <p className="text-[10px] text-slate-400 font-medium">All pro features unlocked via promo code</p>
                      </div>
                    </div>
                    <span className="bg-[#1d3b2b] text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-emerald-900/30">
                      Active
                    </span>
                  </div>
                  
                  <div className="text-slate-400 text-xs text-center border-b border-slate-800/50 pb-4">
                    Upgrade options are disabled since you already have the highest tier of access.
                  </div>
                </div>

                {/* Cancel Button */}
                <button 
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  Cancel Membership
                </button>
              </div>
            </div>
          )
        ) : (
          /* ====================================================================
             FREE USER FLOW (Upgrade to Pro option available)
             ==================================================================== */
          <div>
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 text-center border-b border-slate-800/50">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                <Crown className="w-8 h-8 text-slate-500" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Upgrade to Pro</h2>
              <p className="text-slate-400 text-sm">Choose a payment method to unlock Sharp Elite</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                <button 
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${paymentMethod === 'card' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <CreditCard className="w-4 h-4" /> Credit Card
                </button>
                <button 
                  onClick={() => setPaymentMethod('code')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${paymentMethod === 'code' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <Gift className="w-4 h-4" /> Promo Code
                </button>
              </div>

              {paymentMethod === 'card' ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-300 font-semibold">One-time payment</span>
                    <span className="text-xl font-black text-white">$17.99</span>
                  </div>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Card Number" 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        placeholder="MM/YY" 
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <input 
                        type="text" 
                        placeholder="CVC" 
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-center">
                    <p className="text-slate-400 text-sm mb-3">Enter your Sharp Elite activation code below. (Hint: use JOHN)</p>
                    <input 
                      type="text" 
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="ENTER PROMO CODE" 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white font-mono text-center uppercase focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              <button 
                onClick={handleUpgrade}
                disabled={isProcessing}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                ) : (
                  paymentMethod === 'card' ? 'Pay $17.99 & Upgrade' : 'Apply Code & Upgrade'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
