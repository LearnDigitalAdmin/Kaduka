# Paystack Premium Reports - Quick Start

## What's Implemented?

✅ **Exact @functions/ pattern** for premium report charging
- Reference: `REPORT_{shopId}_{timestamp}`
- Client-side Paystack modal (no extra Cloud Functions)
- Real-time Firestore listener for webhook updates
- Paystack public key from Firebase RemoteConfig

## Three Simple Steps to Get It Working

### Step 1: Deploy Webhook Handler (5 minutes)

The webhook code already exists in `@functions/` (Cyber project):

```bash
cd ~/Desktop/Cyber/functions
firebase deploy --only functions
```

Make sure `PAYSTACK_SECRET_KEY` environment variable is set:

```bash
firebase functions:config:set paystack.secret_key="sk_live_xxxxx..."
firebase deploy --only functions
```

### Step 2: Configure Paystack Webhook (2 minutes)

1. Go to **Paystack Dashboard** → **Settings** → **Webhooks**
2. Add webhook URL:
   ```
   https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/paystackWebhook
   ```
3. Select events:
   - ✓ charge.success
   - ✓ charge.failed

### Step 3: Set Firebase RemoteConfig (2 minutes)

1. Go to **Firebase Console** → **Remote Config**
2. Create parameter `paystack_public_key`:
   ```
   paystack_public_key = pk_live_xxxxx...
   ```
3. Click **Publish changes**

That's it! 🎉

## How It Works

```
User clicks "Upgrade"
    ↓
App creates report_charges/{REPORT_shop_abc_1234567890}
    ↓
Opens Paystack modal
    ↓
User pays with M-Pesa
    ↓
Paystack sends webhook to @functions/
    ↓
Webhook updates report_charges/{reference} → status: 'success'
    ↓
Client listener detects change in real-time
    ↓
Subscription activates automatically
    ↓
User can generate reports!
```

## Files Modified

```
src/
├── services/
│   ├── paystackService.ts          ✓ Client-side payment handler
│   ├── configService.ts            ✓ RemoteConfig for API keys
│   └── premiumReportsService.ts    ✓ Report charging + subscriptions
├── pages/
│   └── ReportsPage.tsx             ✓ Premium reports UI
└── store/
    └── authStore.ts                ✓ (No changes needed)
```

## Code Changes Summary

### premiumReportsService.ts

```typescript
// Creates report charge with EXACT @functions/ pattern
const { reference, amount } = await createReportCharge(
  shopId,
  userId,
  userEmail,
  'weekly' // or 'monthly'
);
// Returns: { reference: "REPORT_shop_abc_1234567890", amount: 4700 }
```

### paystackService.ts

```typescript
// Listen to webhook updates in real-time
const unsubscribe = listenToReportChargeUpdates(
  reference,
  (charge) => {
    // Fired when webhook updates status to 'success'
    console.log('Payment confirmed!', charge);
  },
  (error) => {
    console.error('Payment failed', error);
  }
);

// Open Paystack modal
await initiatePayment(email, amount, reference, 'weekly');
```

## Testing

### Test with Paystack Test Keys

```
pk_test_xxxxx... (use this in RemoteConfig during testing)
sk_test_xxxxx... (use this in Cloud Functions)
```

### Test Payment Flow

1. Set RemoteConfig `paystack_public_key` to test key
2. Click "Upgrade to Premium"
3. Enter test card details
4. Verify in Firebase Console:
   - Document created: `report_charges/REPORT_...`
   - Status changes: `pending` → `success`
5. Check: `shops/{shopId}/subscriptions/REPORT_...` is created

### Verify Webhook

1. Go to **Paystack Dashboard** → **Webhooks**
2. Click your webhook URL
3. See recent events and logs
4. Verify `charge.success` was sent
5. Check Cloud Function logs in Firebase Console

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Paystack modal doesn't open | Check RemoteConfig has `paystack_public_key` |
| Listener doesn't detect payment | Verify webhook is configured in Paystack dashboard |
| Subscription not created | Check `activateSubscription()` is called in success callback |
| Old key shows up | Refresh browser, clear RemoteConfig cache with `refreshConfig()` |

## What's Different from @functions/?

MyDuka uses **client-side Paystack modal** instead of STK push:

| Feature | @functions/ | MyDuka |
|---------|-------------|---------|
| Reference | `REPORT_shopId_timestamp` | `REPORT_shopId_timestamp` ✓ |
| Storage | report_charges | report_charges ✓ |
| Webhook | Updates Firestore | Updates Firestore ✓ |
| Modal | STK push (server) | Inline modal (client) |
| API Key | Env variable | RemoteConfig |
| Result | Same! Both work! | Same! Both work! |

## Price Points

- **Weekly**: 47 KES (4700 cents)
- **Monthly**: 197 KES (19700 cents)

Both auto-renew if you implement subscription renewal logic (coming soon).

## Next Steps

1. ✅ Deploy webhook handler from @functions/
2. ✅ Configure Paystack webhook URL
3. ✅ Set Firebase RemoteConfig
4. ✅ Test with test keys
5. ✅ Switch to live keys when ready
6. 📋 Implement subscription renewal (scheduled Cloud Function)
7. 📋 Add refund handling in webhook
8. 📋 Analytics dashboard for revenue tracking

## Need Help?

Check the detailed guide:
```
PAYSTACK_REPORT_CHARGING_IMPLEMENTATION.md
```

It has:
- Complete flow diagrams
- Code examples
- Firestore structure
- Security checklist
- Deployment guide
- Troubleshooting
