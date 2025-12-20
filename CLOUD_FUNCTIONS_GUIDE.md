# MyDuka Cloud Functions Guide

Setup and implement server-side functions for payments and premium features.

## Overview

Cloud Functions handle:
- Charging shop owners for premium reports
- Charging shops for usage/transactions
- Server-side PDF generation for large reports
- Email notifications
- Payment processing integration (Paystack/M-Pesa)

## Prerequisites

- Firebase project (plot-9fd6e or your own)
- Firebase CLI installed: `npm install -g firebase-tools`
- Node.js 18+
- (Optional) Paystack/M-Pesa credentials

## Setup

### 1. Initialize Functions Directory

```bash
cd C:\Users\na\Desktop\Cyber\functions
# or from parent
firebase functions:config:set stripe.apikey="YOUR_KEY"
```

### 2. Install Functions Dependencies

```bash
cd functions
npm install
```

## Cloud Function Templates

### Function 1: Charge Customer for Premium Report

**Purpose**: Charge a shop owner for downloading a premium report

**Endpoint**: `POST /api/chargeForReport`

```typescript
// functions/src/chargeForReport.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const db = admin.firestore();

interface ChargeRequest {
  shopId: string;
  userId: string;
  reportType: 'monthly' | 'quarterly' | 'annual';
  amount: number;
  phone: string;
}

export const chargeForReport = functions.https.onCall(
  async (data: ChargeRequest, context) => {
    try {
      // Verify user is authenticated
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const { shopId, reportType, amount, phone } = data;

      // Verify shop ownership
      const shop = await db.collection('shops').doc(shopId).get();
      if (!shop.exists || shop.data()?.firebaseUid !== context.auth.uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User does not own this shop'
        );
      }

      // Initiate payment with Paystack
      const paystackResponse = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email: shop.data()?.email,
          amount: amount * 100, // Paystack expects amount in kobo
          reference: `REPORT-${shopId}-${Date.now()}`,
          metadata: {
            shopId,
            userId: context.auth.uid,
            reportType,
            type: 'premium_report',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      if (!paystackResponse.data.status) {
        throw new Error('Failed to initialize payment');
      }

      // Save transaction record
      await db.collection('transactions').add({
        shopId,
        userId: context.auth.uid,
        type: 'premium_report',
        reportType,
        amount,
        status: 'pending',
        reference: paystackResponse.data.data.reference,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        authorizationUrl: paystackResponse.data.data.authorization_url,
        accessCode: paystackResponse.data.data.access_code,
        reference: paystackResponse.data.data.reference,
      };
    } catch (error: any) {
      console.error('Error charging for report:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to initiate payment'
      );
    }
  }
);
```

### Function 2: Verify Payment & Generate Report

**Purpose**: Verify Paystack payment and generate PDF report

**Endpoint**: `POST /api/verifyPayment`

```typescript
// functions/src/verifyPayment.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const db = admin.firestore();

export const verifyPayment = functions.https.onCall(
  async (data: { reference: string }, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const { reference } = data;

      // Verify with Paystack
      const paystackResponse = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      if (!paystackResponse.data.data.status === 'success') {
        return { success: false, message: 'Payment not successful' };
      }

      // Update transaction record
      const transactionRef = paystackResponse.data.data.metadata;
      await db.collection('transactions').add({
        shopId: transactionRef.shopId,
        userId: transactionRef.userId,
        type: transactionRef.type,
        amount: paystackResponse.data.data.amount / 100,
        status: 'completed',
        reference,
        paystackReference: paystackResponse.data.data.reference,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Add premium access
      await db
        .collection('shops')
        .doc(transactionRef.shopId)
        .update({
          premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          lastPremiumPayment: admin.firestore.FieldValue.serverTimestamp(),
        });

      return {
        success: true,
        message: 'Payment verified successfully',
      };
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to verify payment'
      );
    }
  }
);
```

### Function 3: Generate PDF Report (Server-Side)

**Purpose**: Generate detailed PDF report on server for large datasets

**Endpoint**: `POST /api/generateReport`

```typescript
// functions/src/generateReport.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import PDFDocument from 'pdfkit';
import * as bucket from '@google-cloud/storage';

const db = admin.firestore();
const storage = admin.storage().bucket();

interface ReportRequest {
  shopId: string;
  startDate: string;
  endDate: string;
}

export const generateReport = functions.https.onCall(
  async (data: ReportRequest, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const { shopId, startDate, endDate } = data;

      // Verify shop ownership
      const shop = await db.collection('shops').doc(shopId).get();
      if (!shop.exists || shop.data()?.firebaseUid !== context.auth.uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User does not own this shop'
        );
      }

      // Fetch sales and expenses
      const salesRef = db.collection('shops').doc(shopId).collection('sales');
      const expensesRef = db.collection('shops').doc(shopId).collection('expenses');

      const start = new Date(startDate).getTime() / 1000;
      const end = new Date(endDate).getTime() / 1000;

      const sales = await salesRef
        .where('timestamp', '>=', start)
        .where('timestamp', '<=', end)
        .orderBy('timestamp')
        .get();

      const expenses = await expensesRef
        .where('timestamp', '>=', start)
        .where('timestamp', '<=', end)
        .orderBy('timestamp')
        .get();

      // Create PDF
      const doc = new PDFDocument();
      const fileName = `report-${shopId}-${Date.now()}.pdf`;
      const file = storage.file(`reports/${fileName}`);
      const writeStream = file.createWriteStream();

      doc.pipe(writeStream);

      // Add content
      doc.fontSize(24).text('Shop Report', { align: 'center' });
      doc.fontSize(14).text(`Shop: ${shop.data()?.shopName}`);
      doc.text(`Period: ${startDate} to ${endDate}`);
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      // Sales section
      doc.fontSize(16).text('Sales');
      let totalSales = 0;
      sales.forEach((sale) => {
        const data = sale.data();
        doc.fontSize(10).text(
          `${new Date(data.timestamp * 1000).toLocaleDateString()} - ${data.productName}: KES ${data.totalPrice}`
        );
        totalSales += data.totalPrice;
      });
      doc.text(`Total Sales: KES ${totalSales.toLocaleString()}`);
      doc.moveDown();

      // Expenses section
      doc.fontSize(16).text('Expenses');
      let totalExpenses = 0;
      expenses.forEach((expense) => {
        const data = expense.data();
        doc.fontSize(10).text(
          `${new Date(data.timestamp * 1000).toLocaleDateString()} - ${data.category}: KES ${data.amount}`
        );
        totalExpenses += data.amount;
      });
      doc.text(`Total Expenses: KES ${totalExpenses.toLocaleString()}`);
      doc.moveDown();

      // Summary
      const profit = totalSales - totalExpenses;
      doc.fontSize(14).text(
        `Profit: KES ${profit.toLocaleString()}`,
        { align: 'center' }
      );

      doc.end();

      // Wait for file to finish writing
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Generate signed URL
      const signedUrl = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      return {
        success: true,
        downloadUrl: signedUrl[0],
        fileName,
      };
    } catch (error: any) {
      console.error('Error generating report:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to generate report'
      );
    }
  }
);
```

### Function 4: Paystack Webhook Handler

**Purpose**: Handle Paystack webhook for payment confirmations

**Endpoint**: `POST /api/paystack-webhook`

```typescript
// functions/src/paystackWebhook.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

export const paystackWebhook = functions.https.onRequest(
  async (req, res) => {
    try {
      // Verify Paystack signature
      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (hash !== req.headers['x-paystack-signature']) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { event, data } = req.body;

      if (event === 'charge.success') {
        const { reference, amount, metadata } = data;

        // Update transaction
        await db.collection('transactions').add({
          shopId: metadata.shopId,
          userId: metadata.userId,
          type: metadata.type,
          amount: amount / 100,
          status: 'completed',
          reference,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Grant access if premium report
        if (metadata.type === 'premium_report') {
          await db
            .collection('shops')
            .doc(metadata.shopId)
            .update({
              premiumUntil: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ),
            });
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
  }
);
```

## Deployment

### 1. Set Environment Variables

```bash
firebase functions:config:set paystack.apikey="sk_test_..."
firebase functions:config:set paystack.secret="sk_test_..."
firebase functions:config:set app.name="Kaduka"
```

### 2. Deploy Functions

```bash
firebase deploy --only functions
```

### 3. Test Functions

```bash
firebase functions:shell
> chargeForReport({shopId: 'test', userId: 'user', amount: 100, phone: '2547...'})
```

## Integration in React App

### Call From Frontend

```typescript
// src/services/paymentService.ts
import { functions } from './firebaseService';
import { httpsCallable } from 'firebase/functions';

export const chargeForReport = async (
  shopId: string,
  reportType: 'monthly' | 'quarterly' | 'annual',
  amount: number
) => {
  const charge = httpsCallable(functions, 'chargeForReport');
  return await charge({
    shopId,
    reportType,
    amount,
    phone: '2547...', // Get from user profile
  });
};

export const verifyPayment = async (reference: string) => {
  const verify = httpsCallable(functions, 'verifyPayment');
  return await verify({ reference });
};

export const generateReport = async (
  shopId: string,
  startDate: string,
  endDate: string
) => {
  const generate = httpsCallable(functions, 'generateReport');
  return await generate({ shopId, startDate, endDate });
};
```

### Use in ReportsPage

```typescript
// src/pages/ReportsPage.tsx
const handleDownloadPDF = async () => {
  try {
    setLoading(true);

    // Check if user has premium access
    const shopDoc = await getDoc(doc(db, 'shops', selectedShop.id));
    const isPremium = shopDoc.data()?.premiumUntil > new Date();

    if (!isPremium) {
      // Charge for premium report
      const result = await chargeForReport(selectedShop.id, 'monthly', 999);
      window.location.href = result.authorizationUrl;
      return;
    }

    // Generate report
    const result = await generateReport(
      selectedShop.id,
      dateRange.start,
      dateRange.end
    );

    // Download
    const link = document.createElement('a');
    link.href = result.downloadUrl;
    link.download = `report-${selectedShop.shopName}.pdf`;
    link.click();
  } catch (error) {
    toast.error('Failed to download report');
  } finally {
    setLoading(false);
  }
};
```

## Payment Pricing

Suggested pricing model:

| Report Type | Price (KES) | Duration |
|-------------|------------|----------|
| Monthly | 999 | 30 days |
| Quarterly | 2,499 | 90 days |
| Annual | 7,999 | 365 days |
| Premium Access | 99/month | Monthly subscription |

## Testing with Paystack Test Cards

| Card | CVV | Exp |
|------|-----|-----|
| 4111 1111 1111 1111 | 123 | Any |
| 5399 8383 8383 8381 | 883 | Any |

Use OTP: 123456

## Security Checklist

- ✅ Validate all inputs in cloud functions
- ✅ Check user ownership of shops
- ✅ Verify Paystack signatures on webhooks
- ✅ Use environment variables for secrets
- ✅ Set proper Firestore security rules
- ✅ Rate limit payment endpoints
- ✅ Log all transactions
- ✅ Handle errors gracefully

## Monitoring

Monitor functions in Firebase Console:
1. Go to Cloud Functions
2. Check logs for errors
3. Monitor execution time
4. Track billed invocations

## Next Steps

1. Deploy cloud functions to Firebase
2. Set Paystack API credentials
3. Test payment flow with test cards
4. Enable premium reports in ReportsPage
5. Monitor transactions in Firestore

## Support

Firebase Functions docs: https://firebase.google.com/docs/functions
Paystack docs: https://paystack.com/docs
