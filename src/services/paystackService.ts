/**
 * Paystack Integration Service
 * Handles payment processing for premium reports
 * Uses SAME reference pattern and webhook mechanism as @functions/
 * Reference format: REPORT_{shopId}_{timestamp}
 *
 * Flow:
 * 1. Client calls createReportCharge() to create initial document (REPORT_... in report_charges)
 * 2. Client sets up listener with listenToReportChargeUpdates() BEFORE opening payment modal
 * 3. Client initiates Paystack payment with initiatePayment()
 * 4. User completes payment in Paystack modal
 * 5. Paystack backend webhook calls Cyber functions which updates report_charges document
 * 6. Firestore listener detects change and triggers onSuccess callback
 * 7. Client creates subscription record via activateSubscription()
 */

import { db } from './firebaseService';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getPaymentConfig } from './configService';

/**
 * Report Charge (matches webhook.copy.ts handleReportCharge)
 * Stored in report_charges collection with reference as document ID
 * Webhook updates this document directly - no extra Cloud Function needed
 */
export interface ReportCharge {
  reference: string; // REPORT_{shopId}_{timestamp}
  shopId: string;
  userId: string;
  userEmail: string;
  plan: 'weekly' | 'monthly';
  amount: number; // Amount in cents (e.g., 4700 for 47 KES)
  status: 'pending' | 'success' | 'failed';
  createdAt: number;
  completedAt?: number;
  paystackReference?: string;
  paystackResponse?: {
    amount: number;
    fees: number;
    amountReceived: number;
  };
  webhookData?: Record<string, any>;
}

export interface PaymentIntent {
  shopId: string;
  userId: string;
  userEmail: string;
  plan: 'weekly' | 'monthly';
  amount: number;
  reference: string;
  status: 'pending' | 'successful' | 'failed';
  paymentStatus: 'pending' | 'successful' | 'failed';
  createdAt: number;
  updatedAt?: number;
  webhookData?: Record<string, any>;
}

export interface PaymentEvent {
  reference: string;
  status: 'success' | 'failed' | 'cancelled';
  amount: number;
  customer: {
    email: string;
    phone?: string;
  };
  plan: 'weekly' | 'monthly';
  timestamp: number;
  shopId: string;
  userId: string;
}

/**
 * Initialize Paystack script on the page
 */
export const initializePaystack = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).PaystackPop) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Paystack'));
    };
    document.head.appendChild(script);
  });
};

/**
 * Initiate payment on Paystack
 * Same pattern as @functions/: creates reference, stores in Firestore, opens modal
 * Paystack sends webhook to your backend which updates Firestore
 * Client listens to Firestore for status updates
 */
export const initiatePayment = async (
  email: string,
  amount: number,
  reference: string,
  plan: 'weekly' | 'monthly',
  onClose?: () => void,
  onSuccess?: (response: any) => void
): Promise<void> => {
  try {
    await initializePaystack();

    const config = getPaymentConfig();

    if (!config.paystackPublicKey) {
      throw new Error('Paystack public key not configured');
    }

    console.log('Initiating Paystack payment', {
      reference,
      amount,
      email,
      plan,
    });

    const handler = (window as any).PaystackPop.setup({
      key: config.paystackPublicKey,
      email,
      amount, // Already in cents from createPaymentIntent
      ref: reference,
      currency: config.currency,
      // onSuccess callback just closes the modal
      // Real confirmation comes from Paystack webhook updating Firestore
      onClose: () => {
        console.log('Paystack modal closed');
        if (onClose) onClose();
      },
      onSuccess: async (response: any) => {
        console.log('Paystack returned success response:', response);
        // The modal success doesn't mean payment confirmed yet
        // Paystack will send webhook to backend which updates Firestore
        // Our listener detects the update
        if (onSuccess) onSuccess(response);
      },
    });

    handler.openIframe();
  } catch (error) {
    console.error('Error initiating payment:', error);
    throw error;
  }
};

// NOTE: createReportCharge is defined in premiumReportsService.ts
// Import and use it from there to avoid duplication

// Payment verification is handled entirely by:
// 1. Paystack webhook updating report_charges document
// 2. listenToReportChargeUpdates() detecting the status change
// No client-side verification needed

/**
 * Get report charge status (will be updated by webhook)
 * Webhook updates report_charges/{reference} directly
 */
export const getReportChargeStatus = async (
  reference: string
): Promise<ReportCharge | null> => {
  try {
    // Reference format: REPORT_{shopId}_{timestamp}
    const chargeRef = doc(db, 'report_charges', reference);
    const snap = await getDoc(chargeRef);

    if (!snap.exists()) {
      return null;
    }

    return snap.data() as ReportCharge;
  } catch (error) {
    console.error('Error getting report charge status:', error);
    return null;
  }
};

/**
 * Listen to report charge updates via Firestore
 * Matches @functions/ pattern: monitors report_charges document in Firestore
 * When Paystack webhook updates the status, we detect it in real-time
 * Reference format: REPORT_{shopId}_{timestamp}
 * NO EXTRA CLOUD FUNCTION - webhook updates report_charges directly
 */
export const listenToReportChargeUpdates = (
  reference: string,
  onSuccess: (data: ReportCharge) => void,
  onFailed: (error: Error) => void
): (() => void) => {
  try {
    // Reference format: REPORT_{shopId}_{timestamp}
    if (!reference.startsWith('REPORT_')) {
      throw new Error('Invalid report charge reference format');
    }

    console.log('Setting up Firestore listener for report charge', { reference });

    const chargeRef = doc(db, 'report_charges', reference);

    // Use onSnapshot for real-time updates (exactly like @functions/)
    const unsubscribe = onSnapshot(
      chargeRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as ReportCharge;

          console.log('Report charge status update detected:', { reference, status: data.status });

          if (data.status === 'success') {
            console.log('Report charge successful, triggering callback');
            onSuccess(data);
          } else if (data.status === 'failed') {
            console.log('Report charge failed, triggering error callback');
            onFailed(new Error('Report charge failed'));
          }
        }
      },
      (error) => {
        console.error('Firestore listener error:', error);
        onFailed(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up report charge listener:', error);
    onFailed(error as Error);
    return () => {};
  }
};

// Webhook handling is done entirely on backend via Cyber functions
// The webhook updates report_charges collection directly in Firestore
// No client-side webhook handling needed

/**
 * Refresh payment configuration and keys
 */
export const refreshPaymentConfig = async (): Promise<void> => {
  try {
    // This would trigger a remote config refresh
    // For now, just log
    console.log('Payment config refreshed');
  } catch (error) {
    console.error('Error refreshing payment config:', error);
  }
};
