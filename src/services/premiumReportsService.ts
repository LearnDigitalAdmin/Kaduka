/**
 * Premium Reports Service
 * Manages premium report access, storage, and Paystack payment integration
 */

import { db } from './firebaseService';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { getSummaries, parseDateCode } from './shopService';

export interface ReportSubscription {
  shopId: string;
  userId: string;
  plan: 'weekly' | 'monthly';
  status: 'active' | 'expired' | 'cancelled';
  startDate: number;
  expiryDate: number;
  amount: number;
  paymentReference?: string;
  paymentStatus: 'pending' | 'successful' | 'failed';
  createdAt: number;
  renewalDate?: number;
}

export interface StoredReport {
  shopId: string;
  reportId: string;
  dateCode: string; // DDMMYYYY format
  startDate: string;
  endDate: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  data: {
    totalSales: number;
    totalExpenses: number;
    profit: number;
    transactionCount: number;
    topProducts: Array<{
      name: string;
      quantity: number;
      revenue: number;
    }>;
    expenseBreakdown: Record<string, number>;
    dailyBreakdown: Array<{
      date: string;
      sales: number;
      expenses: number;
      profit: number;
      transactions: number;
    }>;
    trends: {
      salesTrend: 'increasing' | 'decreasing' | 'stable';
      profitMargin: number;
      averageDailySales: number;
      bestDay: string;
      worstDay: string;
    };
  };
  generatedAt: number;
  downloadUrl?: string; // From WhatsApp implementation
}

/**
 * Check if user has active premium subscription
 */
export const checkPremiumAccess = async (
  shopId: string,
  userId: string
): Promise<{
  hasAccess: boolean;
  subscription?: ReportSubscription;
  remainingDays?: number;
}> => {
  try {
    const subscriptionRef = doc(db, 'shops', shopId, 'subscriptions', userId);
    const subscriptionSnap = await getDoc(subscriptionRef);

    if (!subscriptionSnap.exists()) {
      return { hasAccess: false };
    }

    const subscription = subscriptionSnap.data() as ReportSubscription;

    if (subscription.status !== 'active' || subscription.expiryDate < Math.floor(Date.now() / 1000)) {
      return { hasAccess: false, subscription };
    }

    const remainingDays = Math.ceil((subscription.expiryDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24));

    return {
      hasAccess: true,
      subscription,
      remainingDays: Math.max(0, remainingDays),
    };
  } catch (error) {
    console.error('Error checking premium access:', error);
    return { hasAccess: false };
  }
};

/**
 * Create payment intent for premium report access
 */
/**
 * Create report charge for premium report access
 * Uses EXACT @functions/ pattern: REPORT_{shopId}_{timestamp}
 * Webhook will update report_charges collection directly
 * NO EXTRA CLOUD FUNCTION NEEDED - webhook just updates Firestore
 */
export const createReportCharge = async (
  shopId: string,
  userId: string,
  userEmail: string,
  plan: 'weekly' | 'monthly'
): Promise<{
  reference: string;
  amount: number;
}> => {
  try {
    const amount = plan === 'weekly' ? 4700 : 19700; // Amount in cents: 47 KES or 197 KES
    const reference = `REPORT_${shopId}_${Date.now()}`; // Exact pattern from @functions/

    // Store report charge in report_charges collection
    // Webhook will update this document directly when payment succeeds
    const chargeRef = doc(db, 'report_charges', reference);
    await setDoc(chargeRef, {
      reference,
      shopId,
      userId,
      userEmail,
      plan,
      amount,
      status: 'pending',
      createdAt: Math.floor(Date.now() / 1000),
    });

    console.log('Report charge created', { reference, amount, plan });

    return {
      reference,
      amount,
    };
  } catch (error) {
    console.error('Error creating report charge:', error);
    throw error;
  }
};

/**
 * Legacy alias for backwards compatibility
 * Use createReportCharge instead
 */
export const createPaymentIntent = async (
  shopId: string,
  userId: string,
  userEmail: string,
  plan: 'weekly' | 'monthly'
): Promise<{
  reference: string;
  amount: number;
  paymentUrl?: string;
}> => {
  const result = await createReportCharge(shopId, userId, userEmail, plan);
  return {
    reference: result.reference,
    amount: result.amount,
  };
};

/**
 * Update subscription after successful payment
 */
export const activateSubscription = async (
  shopId: string,
  userId: string,
  plan: 'weekly' | 'monthly',
  paymentReference: string
): Promise<ReportSubscription> => {
  try {
    const amount = plan === 'weekly' ? 47 : 197;
    const now = Math.floor(Date.now() / 1000);
    const expiryTime = plan === 'weekly' ? 7 * 24 * 60 * 60 : 30 * 24 * 60 * 60;

    const subscription: ReportSubscription = {
      shopId,
      userId,
      plan,
      status: 'active',
      startDate: now,
      expiryDate: now + expiryTime,
      amount,
      paymentReference,
      paymentStatus: 'successful',
      createdAt: now,
      renewalDate: now + expiryTime,
    };

    const subscriptionRef = doc(db, 'shops', shopId, 'subscriptions', userId);
    await setDoc(subscriptionRef, subscription);

    return subscription;
  } catch (error) {
    console.error('Error activating subscription:', error);
    throw error;
  }
};

/**
 * Generate comprehensive report with all analytics
 */
export const generateReport = async (
  shopId: string,
  startDate: string,
  endDate: string,
  reportType: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<StoredReport> => {
  try {
    const summaries = await getSummaries(shopId, startDate, endDate);

    if (summaries.length === 0) {
      throw new Error('No data available for the selected period');
    }

    // Calculate aggregate data
    const totalSales = summaries.reduce((sum, s) => sum + s.totalSales, 0);
    const totalExpenses = summaries.reduce((sum, s) => sum + s.totalExpenses, 0);
    const profit = totalSales - totalExpenses;

    // Build daily breakdown
    const dailyBreakdown = summaries.map((summary) => ({
      date: parseDateCode(summary.dateCode).toISOString().split('T')[0],
      sales: summary.totalSales,
      expenses: summary.totalExpenses,
      profit: summary.profit,
      transactions: summary.transactionCount,
    }));

    // Calculate trends
    const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;
    const averageDailySales = summaries.length > 0 ? totalSales / summaries.length : 0;

    const bestDay = dailyBreakdown.reduce((best, day) =>
      day.profit > best.profit ? day : best
    );
    const worstDay = dailyBreakdown.reduce((worst, day) =>
      day.profit < worst.profit ? day : worst
    );

    // Determine sales trend
    let salesTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (dailyBreakdown.length > 1) {
      const firstHalf = dailyBreakdown.slice(0, Math.floor(dailyBreakdown.length / 2));
      const secondHalf = dailyBreakdown.slice(Math.floor(dailyBreakdown.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.sales, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.sales, 0) / secondHalf.length;

      if (secondHalfAvg > firstHalfAvg * 1.1) {
        salesTrend = 'increasing';
      } else if (secondHalfAvg < firstHalfAvg * 0.9) {
        salesTrend = 'decreasing';
      }
    }

    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const report: StoredReport = {
      shopId,
      reportId,
      dateCode: dailyBreakdown[0]?.date.replace(/-/g, '') || '',
      startDate,
      endDate,
      reportType: reportType || 'weekly',
      data: {
        totalSales,
        totalExpenses,
        profit,
        transactionCount: summaries.reduce((sum, s) => sum + s.transactionCount, 0),
        topProducts: [], // Would need sales data to populate
        expenseBreakdown: {}, // Would need expense details
        dailyBreakdown,
        trends: {
          salesTrend,
          profitMargin,
          averageDailySales,
          bestDay: bestDay.date,
          worstDay: worstDay.date,
        },
      },
      generatedAt: Math.floor(Date.now() / 1000),
    };

    return report;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
};

/**
 * Save report to Firestore
 */
export const saveReport = async (report: StoredReport): Promise<void> => {
  try {
    const reportRef = doc(db, 'shops', report.shopId, 'reports', report.reportId);
    await setDoc(reportRef, report);
  } catch (error) {
    console.error('Error saving report:', error);
    throw error;
  }
};

/**
 * Retrieve stored reports for a shop
 */
export const getStoredReports = async (shopId: string, limit: number = 50): Promise<StoredReport[]> => {
  try {
    const reportsRef = collection(db, 'shops', shopId, 'reports');
    const q = query(reportsRef);
    const querySnapshot = await getDocs(q);

    const reports: StoredReport[] = [];
    querySnapshot.forEach((doc) => {
      reports.push(doc.data() as StoredReport);
    });

    // Sort by generated date, newest first
    return reports.sort((a, b) => b.generatedAt - a.generatedAt).slice(0, limit);
  } catch (error) {
    console.error('Error fetching stored reports:', error);
    throw error;
  }
};

/**
 * Export report as JSON
 */
export const exportReportAsJSON = (report: StoredReport): string => {
  return JSON.stringify(report, null, 2);
};

/**
 * Export report as CSV
 */
export const exportReportAsCSV = (report: StoredReport): string => {
  const { data } = report;

  let csv = `MyDuka Report - ${report.startDate} to ${report.endDate}\n`;
  csv += `Generated: ${new Date(report.generatedAt * 1000).toISOString()}\n\n`;

  csv += 'SUMMARY\n';
  csv += `Total Sales,${data.totalSales}\n`;
  csv += `Total Expenses,${data.totalExpenses}\n`;
  csv += `Profit,${data.profit}\n`;
  csv += `Profit Margin,${data.trends.profitMargin.toFixed(2)}%\n`;
  csv += `Transactions,${data.transactionCount}\n\n`;

  csv += 'DAILY BREAKDOWN\n';
  csv += 'Date,Sales,Expenses,Profit,Transactions\n';
  data.dailyBreakdown.forEach((day) => {
    csv += `${day.date},${day.sales},${day.expenses},${day.profit},${day.transactions}\n`;
  });

  return csv;
};

/**
 * Check if report URL from WhatsApp exists and is accessible
 */
export const validateReportUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Error validating report URL:', error);
    return false;
  }
};
