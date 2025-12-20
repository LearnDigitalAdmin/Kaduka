import { useState } from 'react';
import { toast } from 'react-toastify';
import { X, Lock, Smartphone } from 'lucide-react';
import { initiateReportCharge, listenToReportChargeUpdates } from '../../services/reportChargeService';
import { activateSubscription, createReportCharge } from '../../services/premiumReportsService';
import LoadingSpinner from '../common/LoadingSpinner';

interface SubscriptionPaymentModalProps {
  isOpen: boolean;
  plan: 'weekly' | 'monthly';
  shopId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  onSuccess: () => void;
  onClose: () => void;
}

/**
 * Subscription Payment Modal
 * - Accepts phone number for Paystack charge
 * - Loads Paystack public key from RemoteConfig
 * - Initiates payment with phone number
 * - Sets up real-time listener for success
 * - Creates subscription record on successful payment
 */
function SubscriptionPaymentModal({
  isOpen,
  plan,
  shopId,
  userId,
  userEmail,
  userName = 'Merchant',
  onSuccess,
  onClose,
}: SubscriptionPaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Plan details
  const planDetails = {
    weekly: { days: 7, amount: 47, description: '7 days of premium access' },
    monthly: { days: 30, amount: 197, description: '30 days of premium access' },
  };

  const details = planDetails[plan];

  /**
   * Normalize phone number to E.164 format (+254...)
   * Handles: 0712345678, 712345678, +254712345678, 254712345678
   */
  const normalizePhoneNumber = (phone: string): string => {
    let normalized = phone.trim().replace(/\s+/g, '');

    // Remove leading +
    if (normalized.startsWith('+')) {
      normalized = normalized.slice(1);
    }

    // If starts with 0, replace with 254
    if (normalized.startsWith('0')) {
      normalized = '254' + normalized.slice(1);
    }

    // If doesn't start with 254, assume it's missing and add it
    if (!normalized.startsWith('254')) {
      normalized = '254' + normalized;
    }

    return '+' + normalized;
  };

  /**
   * Validate phone number
   */
  const validatePhoneNumber = (phone: string): boolean => {
    const normalized = normalizePhoneNumber(phone);
    // E.164 format: +254712345678 (13 chars)
    return /^\+254\d{9}$/.test(normalized);
  };

  /**
   * Handle payment submission
   */
  const handlePayment = async () => {
    try {
      // Validate phone number
      if (!phoneNumber.trim()) {
        setValidationError('Phone number is required');
        return;
      }

      if (!validatePhoneNumber(phoneNumber)) {
        setValidationError('Invalid phone number. Use format: 0712345678 or +254712345678');
        return;
      }

      setValidationError('');
      setLoading(true);

      console.log('Initiating subscription payment', {
        plan,
        amount: details.amount,
        phone: phoneNumber,
      });

      // Initiate charge via backend Cloud Function
      // This uses Paystack Charge API with secret key (secure)
      const chargeResult = await initiateReportCharge(
        shopId,
        userId,
        userEmail,
        plan,
        phoneNumber
      );

      if (!chargeResult.success || !chargeResult.reference) {
        throw new Error(chargeResult.error || 'Failed to initiate payment');
      }

      const reference = chargeResult.reference;
      console.log('Report charge initiated', { reference });

      // Show message to user
      toast.info(
        'Payment initiated! You should receive an STK push on your phone. Please enter your M-Pesa PIN to complete the payment.',
        {
          autoClose: 10000,
        }
      );

      // Set up listener BEFORE payment
      // This ensures we catch the webhook update when it comes
      let paymentSucceeded = false;
      const unsubscribe = listenToReportChargeUpdates(
        reference,
        async (charge) => {
          console.log('Subscription payment successful:', charge);
          paymentSucceeded = true;

          // Create subscription record
          try {
            await activateSubscription(shopId, userId, plan, charge.reference);
            console.log('Subscription activated successfully');
            toast.success(`${plan.charAt(0).toUpperCase() + plan.slice(1)} subscription activated!`);
            onSuccess();
            onClose();
          } catch (error) {
            console.error('Error activating subscription:', error);
            toast.error('Payment received but failed to activate subscription');
          }
        },
        (error) => {
          console.error('Subscription payment failed:', error);
          if (!paymentSucceeded) {
            toast.error('Payment failed: ' + error.message);
          }
        }
      );

      // Set timeout to unsubscribe after 10 minutes if payment doesn't complete
      const timeoutId = setTimeout(() => {
        if (!paymentSucceeded) {
          console.log('Payment timeout - unsubscribing from updates');
          unsubscribe();
          setLoading(false);
          toast.warning('Payment timeout. Please try again if payment was not completed.');
        }
      }, 10 * 60 * 1000);

      // Clean up timeout
      return () => clearTimeout(timeoutId);
    } catch (error) {
      console.error('Error initiating subscription payment:', error);
      setValidationError(error instanceof Error ? error.message : 'Payment failed');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            Subscribe to {plan.charAt(0).toUpperCase() + plan.slice(1)}
          </h2>
          <button
            onClick={() => {
              if (!loading) onClose();
            }}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Plan Summary */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-gray-400">Plan</span>
            <span className="text-white font-semibold capitalize">
              {plan} ({details.days} days)
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-400">Amount</span>
            <span className="text-2xl font-bold text-green-400">KSh {details.amount}</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">{details.description}</p>
        </div>

        {/* Form */}
        <div className="space-y-4 mb-6">
          {/* Phone Number Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Smartphone size={16} />
              Phone Number (for Paystack)
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setValidationError('');
              }}
              placeholder="0712345678 or +254712345678"
              className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                validationError ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500'
              }`}
              disabled={loading}
            />
            {validationError && (
              <p className="text-red-400 text-sm mt-1">{validationError}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Enter your phone number for Paystack payment notification
            </p>
          </div>

          {/* User Info Display */}
          <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Shop ID:</span>
              <span className="text-gray-300 font-mono text-xs">{shopId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Email:</span>
              <span className="text-gray-300 truncate">{userEmail}</span>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-2">
            <Lock size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300">
              Secure payment via M-Pesa STK push. You'll receive a payment prompt on your phone.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={loading || !phoneNumber.trim()}
            className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                Processing...
              </>
            ) : (
              `Pay KSh ${details.amount}`
            )}
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-gray-500 text-center mt-4">
          An M-Pesa payment prompt will be sent to {phoneNumber || 'your phone'}. Keep this window open while you complete the payment.
        </p>
      </div>
    </div>
  );
}

export default SubscriptionPaymentModal;
