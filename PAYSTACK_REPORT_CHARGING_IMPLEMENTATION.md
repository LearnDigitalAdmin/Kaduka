# Paystack Premium Report Charging Implementation

## Overview

MyDuka premium reports charging is implemented **exactly like @functions/** with the following architecture:

- **Reference Format**: `REPORT_{shopId}_{timestamp}` (matches @functions/)
- **Client-Side Payment**: Paystack modal opens directly in the browser (no Cloud Function calls to Paystack API)
- **Webhook Pattern**: Paystack webhook updates `report_charges/{reference}` directly in Firestore
- **Real-Time Listener**: Client listens to Firestore for webhook updates
- **No Extra Cloud Function**: Webhook just updates Firestore, that's it
- **API Key**: Paystack PUBLIC_KEY loaded from Firebase RemoteConfig (never hardcoded)

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER WANTS PREMIUM REPORT                    │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. ReportsPage.tsx → handleUpgrade('weekly'|'monthly')         │
│     - Calls premiumReportsService.createPaymentIntent()         │
│     - Which calls premiumReportsService.createReportCharge()    │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. CREATE REPORT CHARGE                                        │
│     - Reference: REPORT_{shopId}_{timestamp}                    │
│     - Store in Firestore: report_charges/{reference}            │
│     - Status: pending                                           │
│     - Amount: 4700 (47 KES) or 19700 (197 KES) in cents        │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. SET UP REAL-TIME LISTENER                                   │
│     - listenToReportChargeUpdates(reference)                    │
│     - Watches report_charges/{reference}                        │
│     - Waiting for webhook to update status                      │
│     - Callback when status = 'success'                          │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. OPEN PAYSTACK MODAL                                         │
│     - initiatePayment(...)                                      │
│     - Loads Paystack PUBLIC_KEY from RemoteConfig               │
│     - Opens Paystack inline modal                               │
│     - User enters M-Pesa/Airtel PIN                             │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. PAYMENT PROCESSING                                          │
│     - Paystack processes payment                                │
│     - Money goes to your platform account                       │
│     - Paystack sends webhook to your endpoint                   │
│     - Reference: REPORT_{shopId}_{timestamp}                    │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. WEBHOOK HANDLER (webhook.copy.ts)                           │
│     - Receives: charge.success event                            │
│     - Parses reference: REPORT_{shopId}_{timestamp}             │
│     - Calls: handleReportCharge()                               │
│     - Updates: report_charges/{reference} → status: 'success'   │
│     - NO EXTRA CLOUD FUNCTION NEEDED                            │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. CLIENT LISTENER DETECTS UPDATE                              │
│     - onSnapshot fires with updated document                    │
│     - status === 'success' detected                             │
│     - Calls onSuccess callback                                  │
│     - Toast: "Payment successful!"                              │
│     - Calls activateSubscription()                              │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. ACTIVATE SUBSCRIPTION                                       │
│     - Create subscription document                              │
│     - Store in: shops/{shopId}/subscriptions/{reference}        │
│     - Status: active                                            │
│     - expiryDate: now + 7 days (weekly) or 30 days (monthly)   │
│     - paymentReference: REPORT_{shopId}_{timestamp}             │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  9. RELOAD PAGE + GRANT ACCESS                                  │
│     - checkPremiumAccess() verifies subscription                │
│     - Reports are now accessible                                │
│     - User can generate premium reports                         │
└─────────────────────────────────────────────────────────────────┘
```

## Code Implementation Details

### 1. premiumReportsService.ts - createReportCharge()

```typescript
export const createReportCharge = async (
  shopId: string,
  userId: string,
  userEmail: string,
  plan: 'weekly' | 'monthly'
): Promise<{ reference: string; amount: number }> => {
  try {
    const amount = plan === 'weekly' ? 4700 : 19700; // Cents: 47 KES or 197 KES
    const reference = `REPORT_${shopId}_${Date.now()}`; // EXACT pattern from @functions/

    // Store in report_charges collection - webhook will update this directly
    const chargeRef = doc(db, 'report_charges', reference);
    await setDoc(chargeRef, {
      reference,
      shopId,
      userId,
      userEmail,
      plan,
      amount,
      status: 'pending', // Webhook will change to 'success'
      createdAt: Math.floor(Date.now() / 1000),
    });

    console.log('Report charge created', { reference, amount, plan });

    return { reference, amount };
  } catch (error) {
    console.error('Error creating report charge:', error);
    throw error;
  }
};
```

**Key Points:**
- Reference format: `REPORT_{shopId}_{timestamp}` matches @functions/
- Stored in `report_charges` collection (root level, not nested)
- Status starts as 'pending'
- Webhook will find this document and update it

### 2. paystackService.ts - listenToReportChargeUpdates()

```typescript
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

    // Real-time listener - fires when webhook updates document
    const unsubscribe = onSnapshot(
      chargeRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as ReportCharge;

          console.log('Report charge status update detected:', { reference, status: data.status });

          if (data.status === 'success') {
            console.log('Report charge successful, triggering callback');
            onSuccess(data); // Triggers subscription activation
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
```

**Key Points:**
- Watches `report_charges/{reference}` in real-time
- Webhook updates this document directly (no extra Cloud Function)
- onSnapshot fires immediately when webhook updates status
- Detects status change from 'pending' → 'success'

### 3. paystackService.ts - initiatePayment()

```typescript
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

    const config = getPaymentConfig(); // Gets PUBLIC_KEY from RemoteConfig

    if (!config.paystackPublicKey) {
      throw new Error('Paystack public key not configured');
    }

    console.log('Initiating Paystack payment', { reference, amount, email, plan });

    const handler = (window as any).PaystackPop.setup({
      key: config.paystackPublicKey,
      email,
      amount, // In cents from createReportCharge
      ref: reference, // REPORT_{shopId}_{timestamp}
      currency: config.currency, // KES
      onClose: () => {
        console.log('Paystack modal closed');
        if (onClose) onClose();
      },
      onSuccess: async (response: any) => {
        console.log('Paystack returned success response:', response);
        // Modal success ≠ payment confirmed
        // Webhook will update Firestore when actually paid
        if (onSuccess) onSuccess(response);
      },
    });

    handler.openIframe(); // Opens inline modal
  } catch (error) {
    console.error('Error initiating payment:', error);
    throw error;
  }
};
```

**Key Points:**
- Gets Paystack PUBLIC_KEY from Firebase RemoteConfig
- Opens modal using Paystack's inline.js library
- Passes our reference format to Paystack
- Modal success doesn't mean payment confirmed
- Real confirmation comes from webhook updating Firestore

### 4. ReportsPage.tsx - handleUpgrade()

```typescript
const handleUpgrade = async (plan: 'weekly' | 'monthly') => {
  if (!currentShop || !user) return;

  try {
    setPaymentInProgress(true);
    await initializePaystack();

    // 1. Create report charge in Firestore (REPORT_{shopId}_{timestamp})
    const { reference, amount } = await createPaymentIntent(
      currentShop.id,
      user.uid,
      user.email || 'user@example.com',
      plan
    );

    console.log('Created report charge', { reference, amount, plan });

    // 2. Set up real-time listener for webhook updates
    const unsubscribe = listenToReportChargeUpdates(
      reference,
      async (charge) => {
        console.log('Report charge successful:', charge);
        toast.success('Payment successful! Premium access activated.');
        unsubscribe();
        await checkAccess(); // Reload subscription status
      },
      (error) => {
        console.error('Report charge failed:', error);
        toast.error('Payment failed: ' + error.message);
        unsubscribe();
      }
    );

    // 3. Open Paystack modal
    // User pays → Paystack webhook → Firestore update → Listener fires
    await initiatePayment(
      user.email || 'user@example.com',
      amount,
      reference,
      plan,
      () => {
        console.log('Payment window closed');
        unsubscribe();
      }
    );
  } catch (error) {
    console.error('Error initiating payment:', error);
    toast.error('Failed to initiate payment');
  } finally {
    setPaymentInProgress(false);
  }
};
```

**Key Points:**
- Creates report charge first
- Sets up listener BEFORE opening modal
- Listener waits for webhook to update Firestore
- Opens Paystack modal
- When webhook fires, listener detects change and activates subscription

## Webhook Handler (webhook.copy.ts in @functions/)

The webhook in @functions/ already handles `REPORT_` prefixed references:

```typescript
if (chargeType === 'report_charge' || reference.startsWith('REPORT_')) {
  await handleReportCharge(reference, data, metadata);
}

async function handleReportCharge(reference: string, data: any, metadata: any) {
  // Updates report_charges/{reference} with:
  // - status: 'success'
  // - completedAt: timestamp
  // - paystackReference: data.reference
  // - paystackResponse: { amount, fees, amountReceived }

  await db.collection("report_charges").doc(reference).update({
    status: "success",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    paystackReference: data.reference,
    paystackResponse: { ... },
  });
}
```

**No extra Cloud Function needed** - webhook just updates the document!

## Firebase Firestore Structure

### report_charges collection

```
report_charges/
├── REPORT_shop_abc_1234567890/
│   ├── reference: "REPORT_shop_abc_1234567890"
│   ├── shopId: "shop_abc"
│   ├── userId: "user_123"
│   ├── userEmail: "user@example.com"
│   ├── plan: "weekly" | "monthly"
│   ├── amount: 4700 | 19700 (cents)
│   ├── status: "pending" → "success" | "failed"
│   ├── createdAt: 1234567890 (Unix timestamp)
│   ├── completedAt: 1234567999 (set by webhook)
│   ├── paystackReference: "ref_xyz..." (from Paystack)
│   └── paystackResponse: {
│       ├── amount: 47 | 197 (KES)
│       ├── fees: X
│       └── amountReceived: Y
│       }
└── REPORT_shop_def_1234567890/
    └── ...
```

### subscriptions collection (after success)

```
shops/
├── shop_abc/
│   └── subscriptions/
│       └── REPORT_shop_abc_1234567890/
│           ├── shopId: "shop_abc"
│           ├── userId: "user_123"
│           ├── plan: "weekly" | "monthly"
│           ├── status: "active" | "expired"
│           ├── startDate: 1234567890 (Unix timestamp)
│           ├── expiryDate: 1234568890 (+ 7 or 30 days)
│           ├── paymentReference: "REPORT_shop_abc_1234567890"
│           ├── amount: 47 | 197 (KES, not cents)
│           └── createdAt: 1234567890
```

## Firebase RemoteConfig Configuration

In Firebase Console → Remote Config, set:

```json
{
  "paystack_public_key": "pk_live_xxxxx...",
  "weekly_price": 4700,
  "monthly_price": 19700,
  "currency": "KES",
  "enable_premium_reports": true,
  "enable_payment": true
}
```

The app loads Paystack PUBLIC_KEY at runtime from RemoteConfig:

```typescript
export const getPaymentConfig = () => {
  if (!remoteConfig) {
    return {
      paystackPublicKey: '',
      weeklyPrice: 4700,
      monthlyPrice: 19700,
      currency: 'KES',
    };
  }

  return {
    paystackPublicKey: getString(remoteConfig, 'paystack_public_key') || '',
    weeklyPrice: getNumber(remoteConfig, 'weekly_price') || 4700,
    monthlyPrice: getNumber(remoteConfig, 'monthly_price') || 19700,
    currency: getString(remoteConfig, 'currency') || 'KES',
  };
};
```

## Exact Implementation Matching @functions/

| Aspect | @functions/ | MyDuka |
|--------|-------------|--------|
| Reference Format | `REPORT_{shopId}_{timestamp}` | `REPORT_{shopId}_{timestamp}` ✓ |
| Storage | `report_charges/{reference}` | `report_charges/{reference}` ✓ |
| Initial Status | `'pending'` | `'pending'` ✓ |
| Webhook Updates | Firestore directly | Firestore directly ✓ |
| Success Status | `'success'` | `'success'` ✓ |
| Real-Time Listener | onSnapshot | onSnapshot ✓ |
| API Key Management | Environment variable | RemoteConfig ✓ |
| Payment Modal | Server-side STK | Client-side inline ✓ |

## Testing the Flow

### 1. Test with Paystack Test Keys

Use test keys from Paystack dashboard → Settings → API Keys

### 2. Test Cards

**M-Pesa (Safaricom):**
- Amount: Any (e.g., 10 KES)
- Phone: +254700000000
- PIN: 123456

**Test with Development**

```typescript
// In configService.ts during development:
if (process.env.NODE_ENV === 'development') {
  remoteConfig.defaultConfig = {
    paystack_public_key: 'pk_test_xxxxx...', // Use test key
    ...
  };
}
```

### 3. Verify Firestore Updates

1. Open Firebase Console
2. Navigate to `report_charges/{reference}`
3. Initiate payment
4. Watch status change: `pending` → `success`
5. Check timestamps and Paystack response data

### 4. Check Subscription Activation

1. After successful payment
2. Navigate to `shops/{shopId}/subscriptions/{reference}`
3. Verify status: `'active'`
4. Verify expiryDate is set

## Deployment Checklist

- [ ] **Webhook in @functions/** is configured to route `REPORT_` prefixed references to `handleReportCharge()`
- [ ] **Paystack Webhook URL** is set in Paystack dashboard pointing to @functions/ webhook endpoint
- [ ] **Firebase RemoteConfig** has `paystack_public_key` configured with your live public key
- [ ] **Firestore Security Rules** allow:
  - Creating documents in `report_charges/`
  - Reading own subscription documents in `shops/{shopId}/subscriptions/`
- [ ] **Test Payment** with test keys to verify complete flow
- [ ] **Monitor Firestore** for charge documents being created and updated

## Troubleshooting

### Listener not detecting webhook update

1. Check Paystack webhook logs in dashboard
2. Verify reference format in Firestore: must start with `REPORT_`
3. Check webhook handler in @functions/ is routing correctly
4. Ensure Firestore listener is set up BEFORE Paystack modal opens

### Payment reference mismatch

- Ensure `reference` passed to `initiatePayment()` matches what was created in `createReportCharge()`
- Format must be exactly: `REPORT_{shopId}_{timestamp}`

### RemoteConfig not loading public key

1. Check Firebase Console → Remote Config
2. Verify `paystack_public_key` is published
3. Check configService initialization in app startup
4. Call `refreshConfig()` manually if needed

### Subscription not activating

1. Check `activateSubscription()` was called
2. Verify charge status is `'success'` in Firestore
3. Check `checkPremiumAccess()` query for active subscriptions
4. Verify expiryDate calculation (now + 7 or 30 days)

## Summary

✅ **Exact @functions/ pattern implemented in MyDuka**
- Reference format: `REPORT_{shopId}_{timestamp}`
- Firestore listener for webhook updates
- No extra Cloud Function needed
- Paystack public key from RemoteConfig
- Client-side payment modal
- Real-time subscription activation

The webhook.copy.ts in @functions/ already handles everything - it just needs to be deployed and configured in Paystack dashboard!
