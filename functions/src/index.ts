import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { setGlobalOptions } from 'firebase-functions/v2';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Set default options for callable functions
setGlobalOptions({ region: 'africa-south1' });

/**
 * Cloud Function: Reset Daily Sales
 * 
 * Runs every day at midnight (East Africa Time)
 * Resets the todaysSales counter for all shops
 * 
 * Note: Scheduled functions must use us-central1 region in v2
 */
export const resetDailySales = onSchedule(
  {
    schedule: '0 0 * * *', // Cron: Every day at midnight
    timeZone: 'Africa/Nairobi', // East Africa Time
    region: 'us-central1', // v2 schedulers must use us-central1
  },
  async (event) => {
    try {
      console.log('Starting daily sales reset...');

      // Get all shops
      const shopsSnapshot = await db.collection('shops').get();

      if (shopsSnapshot.empty) {
        console.log('No shops found');
        return;
      }

      // Prepare batch updates
      const batch = db.batch();
      let shopCount = 0;

      shopsSnapshot.forEach((doc) => {
        const shopRef = db.collection('shops').doc(doc.id);
        
        // Reset todaysSales to 0
        batch.update(shopRef, {
          'rewardStats.todaysSales': 0,
        });

        shopCount++;
      });

      // Commit all updates
      await batch.commit();

      console.log(`Daily sales reset completed for ${shopCount} shops`);
    } catch (error) {
      console.error('Error resetting daily sales:', error);
    }
  }
);
// export const resetDailySales = onSchedule(
//   {
//     schedule: '0 0 * * *', // Cron: Every day at midnight
//     timeZone: 'Africa/Nairobi', // East Africa Time
//     region: 'us-central1', // v2 schedulers must use us-central1
//   },
//   async (event) => {
//     try {
//       console.log('Starting daily sales reset...');

//       // Get all shops
//       const shopsSnapshot = await db.collection('shops').get();

//       if (shopsSnapshot.empty) {
//         console.log('No shops found');
//         return null;
//       }

//       // Prepare batch updates
//       const batch = db.batch();
//       let shopCount = 0;

//       shopsSnapshot.forEach((doc) => {
//         const shopRef = db.collection('shops').doc(doc.id);
        
//         // Reset todaysSales to 0
//         batch.update(shopRef, {
//           'rewardStats.todaysSales': 0,
//         });

//         shopCount++;
//       });

//       // Commit all updates
//       await batch.commit();

//       console.log(`Daily sales reset completed for ${shopCount} shops`);
//       return;
//     } catch (error) {
//       console.error('Error resetting daily sales:', error);
//       return;
//     }
//   }
// );

/**
 * Cloud Function: Calculate and Update Customer Levels
 * 
 * Runs every hour to update customer levels based on their coin balance
 * This ensures levels are always up to date
 * 
 * Note: Scheduled functions must use us-central1 region in v2
 */
export const updateCustomerLevels = onSchedule(
  {
    schedule: '0 * * * *', // Cron: Every hour
    timeZone: 'Africa/Nairobi',
    region: 'us-central1', // v2 schedulers must use us-central1
  },
  async (event) => {
    try {
      console.log('Starting customer level update...');

      // Get all shops
      const shopsSnapshot = await db.collection('shops').get();

      let totalUpdates = 0;

      for (const shopDoc of shopsSnapshot.docs) {
        const customersSnapshot = await db
          .collection('shops')
          .doc(shopDoc.id)
          .collection('customers')
          .get();

        const batch = db.batch();
        let batchCount = 0;

        for (const customerDoc of customersSnapshot.docs) {
          const customerData = customerDoc.data();
          const totalCoins = customerData.totalCoins || 0;

          // Calculate level
          let level = 1;
          if (totalCoins >= 5000) level = 6;
          else if (totalCoins >= 2000) level = 5;
          else if (totalCoins >= 1000) level = 4;
          else if (totalCoins >= 500) level = 3;
          else if (totalCoins >= 100) level = 2;

          // Update if level changed
          if (customerData.level !== level) {
            const customerRef = db
              .collection('shops')
              .doc(shopDoc.id)
              .collection('customers')
              .doc(customerDoc.id);

            batch.update(customerRef, { level });
            batchCount++;
          }
        }

        // Commit batch if there are updates
        if (batchCount > 0) {
          await batch.commit();
          totalUpdates += batchCount;
        }
      }

      console.log(`Customer level update completed. Updated ${totalUpdates} customers`);
      return;
    } catch (error) {
      console.error('Error updating customer levels:', error);
      return;
    }
  }
);

/**
 * Cloud Function: Clean Old Transactions
 * 
 * Runs weekly to archive or delete transactions older than 90 days
 * This helps manage Firestore costs
 * 
 * Note: Scheduled functions must use us-central1 region in v2
 */
export const cleanOldTransactions = onSchedule(
  {
    schedule: '0 3 * * 0', // Cron: Every Sunday at 3 AM
    timeZone: 'Africa/Nairobi',
    region: 'us-central1', // v2 schedulers must use us-central1
  },
  async (event) => {
    try {
      console.log('Starting transaction cleanup...');

      // Calculate cutoff date (90 days ago)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

      // Get all shops
      const shopsSnapshot = await db.collection('shops').get();

      let totalDeleted = 0;

      for (const shopDoc of shopsSnapshot.docs) {
        // Get old transactions
        const oldTransactionsSnapshot = await db
          .collection('shops')
          .doc(shopDoc.id)
          .collection('transactions')
          .where('timestamp', '<', cutoffTimestamp)
          .limit(500) // Process in batches to avoid timeout
          .get();

        if (oldTransactionsSnapshot.empty) continue;

        const batch = db.batch();

        oldTransactionsSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
          totalDeleted++;
        });

        await batch.commit();
      }

      console.log(`Transaction cleanup completed. Deleted ${totalDeleted} old transactions`);
      return;
    } catch (error) {
      console.error('Error cleaning old transactions:', error);
      return;
    }
  }
);

/**
 * Cloud Function: Generate Weekly Report
 * 
 * Runs every Monday at 6 AM to generate and email weekly reports
 * 
 * Note: Scheduled functions must use us-central1 region in v2
 */
export const generateWeeklyReport = onSchedule(
  {
    schedule: '0 6 * * 1', // Cron: Every Monday at 6 AM
    timeZone: 'Africa/Nairobi',
    region: 'us-central1', // v2 schedulers must use us-central1
  },
  async (event) => {
    try {
      console.log('Starting weekly report generation...');

      // Calculate date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
      const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);

      // Get all shops
      const shopsSnapshot = await db.collection('shops').get();

      for (const shopDoc of shopsSnapshot.docs) {
        const shopData = shopDoc.data();

        // Get transactions for the week
        const transactionsSnapshot = await db
          .collection('shops')
          .doc(shopDoc.id)
          .collection('transactions')
          .where('timestamp', '>=', startTimestamp)
          .where('timestamp', '<=', endTimestamp)
          .get();

        // Calculate metrics
        let totalSales = 0;
        let totalCoinsIssued = 0;
        let totalCoinsRedeemed = 0;
        let newCustomers = 0;

        transactionsSnapshot.forEach((doc) => {
          const txn = doc.data();
          totalSales += txn.amount || 0;
          
          if (txn.type === 'earned') {
            totalCoinsIssued += txn.coins || 0;
          } else if (txn.type === 'redeemed') {
            totalCoinsRedeemed += Math.abs(txn.coins || 0);
          }
        });

        // Get new customers count
        const newCustomersSnapshot = await db
          .collection('shops')
          .doc(shopDoc.id)
          .collection('customers')
          .where('createdAt', '>=', startTimestamp)
          .where('createdAt', '<=', endTimestamp)
          .get();

        newCustomers = newCustomersSnapshot.size;

        // Store report
        await db
          .collection('shops')
          .doc(shopDoc.id)
          .collection('reports')
          .add({
            type: 'weekly',
            startDate: startTimestamp,
            endDate: endTimestamp,
            metrics: {
              totalSales,
              totalCoinsIssued,
              totalCoinsRedeemed,
              newCustomers,
              totalCustomers: shopData.rewardStats?.totalCustomers || 0,
            },
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        console.log(`Weekly report generated for shop: ${shopDoc.id}`);
      }

      console.log('Weekly report generation completed');
      return;
    } catch (error) {
      console.error('Error generating weekly report:', error);
      return;
    }
  }
);

/**
 * Callable Function: Manually Trigger Daily Reset
 * 
 * Can be called from the admin panel to manually reset daily sales
 * Uses africa-south1 region for callable functions
 */
export const manualResetDailySales = onCall(
  { region: 'africa-south1' },
  async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // You can add admin role check here
    // if (!request.auth.token.admin) {
    //   throw new HttpsError('permission-denied', 'User must be an admin');
    // }

    try {
      const shopId = request.data.shopId;

      if (!shopId) {
        throw new HttpsError('invalid-argument', 'shopId is required');
      }

      // Reset the shop's daily sales
      await db.collection('shops').doc(shopId).update({
        'rewardStats.todaysSales': 0,
      });

      console.log(`Manual daily sales reset for shop: ${shopId}`);

      return {
        success: true,
        message: 'Daily sales reset successfully',
      };
    } catch (error) {
      console.error('Error in manual reset:', error);
      throw new HttpsError('internal', 'Failed to reset daily sales');
    }
  }
);

/**
 * Callable Function: Get Customer Insights
 * 
 * Returns analytics and insights for a specific customer
 * Uses africa-south1 region for callable functions
 */
export const getCustomerInsights = onCall(
  { region: 'africa-south1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const { shopId, customerPhone } = request.data;

      if (!shopId || !customerPhone) {
        throw new HttpsError(
          'invalid-argument',
          'shopId and customerPhone are required'
        );
      }

      // Get customer data
      const customerDoc = await db
        .collection('shops')
        .doc(shopId)
        .collection('customers')
        .doc(customerPhone)
        .get();

      if (!customerDoc.exists) {
        throw new HttpsError('not-found', 'Customer not found');
      }

      const customerData = customerDoc.data();

      // Get customer transactions
      const transactionsSnapshot = await db
        .collection('shops')
        .doc(shopId)
        .collection('transactions')
        .where('customerPhone', '==', customerPhone)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      const transactions = transactionsSnapshot.docs.map((doc) => doc.data());

      // Calculate insights
      const totalTransactions = transactions.length;
      const earnedTransactions = transactions.filter((t) => t.type === 'earned').length;
      const redeemedTransactions = transactions.filter((t) => t.type === 'redeemed').length;

      const avgTransactionAmount =
        transactions.reduce((sum, t) => sum + (t.amount || 0), 0) / totalTransactions || 0;

      // Get last visit
      const lastVisit = customerData?.lastVisit?.toDate() || null;
      const daysSinceLastVisit = lastVisit
        ? Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        customer: customerData,
        insights: {
          totalTransactions,
          earnedTransactions,
          redeemedTransactions,
          avgTransactionAmount: Math.round(avgTransactionAmount),
          daysSinceLastVisit,
        },
        recentTransactions: transactions.slice(0, 10),
      };
    } catch (error) {
      console.error('Error getting customer insights:', error);
      throw new HttpsError('internal', 'Failed to get customer insights');
    }
  }
);