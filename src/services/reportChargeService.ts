/**
 * Report Charge Service
 * Directly calls Paystack Charge API with secret key from Remote Config
 * Uses Mobile Money endpoint for STK push
 */

import axios from 'axios';
import { db } from './firebaseService';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getPaystackSecretKey } from './configService';

const PAYSTACK_API_BASE = 'https://api.paystack.co';

export interface ReportCharge {
  reference: string;
  shopId: string;
  userId: string;
  userEmail: string;
  plan: 'weekly' | 'monthly';
  amount: number;
  status: 'pending' | 'success' | 'failed';
  createdAt: number;
  completedAt?: number;
  paystackReference?: string;
  paystackResponse?: {
    amount: number;
    fees: number;
    amountReceived: number;
  };
  error?: string;
}

interface PaystackChargeResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    authorization_url?: string;
    display_text?: string;
  };
}

/**
 * Initiate report subscription charge via Paystack Charge API
 * Sends STK push to user's phone
 */
export const initiateReportCharge = async (
  shopId: string,
  userId: string,
  userEmail: string,
  plan: 'weekly' | 'monthly',
  phoneNumber: string
): Promise<{ success: boolean; reference?: string; error?: string }> => {
  try {
    // Get secret key from Remote Config
    const secretKey = getPaystackSecretKey();
    if (!secretKey) {
      throw new Error('Paystack secret key not configured in Remote Config');
    }

    // Normalize phone to +254... format
    let normalizedPhone = phoneNumber.trim();
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '254' + normalizedPhone.slice(1);
    }
    if (!normalizedPhone.startsWith('254')) {
      normalizedPhone = '254' + normalizedPhone;
    }
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone;
    }

    // Plan pricing in cents
    const amount = plan === 'weekly' ? 4700 : 19700;

    // Generate unique reference
    const reference = `REPORT_${shopId}_${Date.now()}`;

    console.log('Initiating Paystack charge via mobile_money', {
      shopId,
      plan,
      amount,
      phone: normalizedPhone,
      reference,
    });

    // CREATE DOCUMENT IN FIRESTORE BEFORE CALLING PAYSTACK
    // This ensures the webhook has a document to update when payment succeeds
    const chargeDocRef = doc(db, 'report_charges', reference);
    await setDoc(chargeDocRef, {
      reference,
      shopId,
      userId,
      userEmail,
      plan,
      amount: amount / 100, // Store in real KES value, not cents
      status: 'pending',
      createdAt: Date.now(),
    });

    // Also create in shops/{shopId}/report_charges subcollection
    if (shopId) {
      const shopChargeRef = doc(db, 'shops', shopId, 'report_charges', reference);
      await setDoc(shopChargeRef, {
        reference,
        plan,
        amount: amount / 100, // Store in real KES value, not cents
        status: 'pending',
        createdAt: Date.now(),
      });
    }

    console.log('Created report_charges document:', { reference });

    // Call Paystack Charge API
    const response = await axios.post<PaystackChargeResponse>(
      `${PAYSTACK_API_BASE}/charge`,
      {
        email: userEmail,
        amount: amount, // Already in cents
        currency: 'KES',
        mobile_money: {
          phone: normalizedPhone,
          provider: 'mpesa', // M-Pesa for Kenya
        },
        reference: reference,
        metadata: {
          shopId,
          userId,
          plan,
          type: 'report_subscription',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('Paystack charge response:', {
      status: response.data.status,
      message: response.data.message,
      reference: response.data.data?.reference,
    });

    if (response.data.status && response.data.data?.reference) {
      return {
        success: true,
        reference: response.data.data.reference,
      };
    } else {
      return {
        success: false,
        error: response.data.message || 'Failed to initiate charge',
      };
    }
  } catch (error: any) {
    console.error('Error initiating report charge:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Failed to initiate charge';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Listen to report charge status updates via Firestore
 * Paystack webhook will update the report_charges document
 */
export const listenToReportChargeUpdates = (
  reference: string,
  onSuccess: (data: ReportCharge) => void,
  onFailed: (error: Error) => void
): (() => void) => {
  try {
    if (!reference.startsWith('REPORT_')) {
      throw new Error('Invalid report charge reference format');
    }

    console.log('Setting up listener for report charge', { reference });

    const chargeRef = doc(db, 'report_charges', reference);

    const unsubscribe = onSnapshot(
      chargeRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as ReportCharge;

          console.log('Report charge status update detected:', {
            reference,
            status: data.status,
          });

          if (data.status === 'success') {
            console.log('Report charge successful');
            onSuccess(data);
          } else if (data.status === 'failed') {
            console.log('Report charge failed:', data.error);
            onFailed(new Error(data.error || 'Report charge failed'));
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
    console.error('Error setting up listener:', error);
    onFailed(error as Error);
    return () => {};
  }
};
