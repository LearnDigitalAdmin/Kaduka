/**
 * Analytics Service
 * Provides predictive analytics, stockout alerts, and ROI calculations
 */

import { Sale, Expense, Stock, StockRecord, getSales, getExpenses, getCurrentStock } from './shopService';
import { getCachedStock } from './stockCacheService';

export interface StockoutAlert {
  productName: string;
  currentQuantity: number;
  unit: string;
  daysUntilStockout: number;
  averageDailyUsage: number;
  recommendedOrderQuantity: number;
  estimatedLostRevenue: number;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

export interface ProfitOpportunity {
  type: 'pricing' | 'inventory' | 'expense' | 'customer';
  title: string;
  description: string;
  potentialGain: number;
  actionRequired: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

export interface ROICalculation {
  stockoutLosses: number;
  pricingLosses: number;
  customerLosses: number;
  inefficiencyLosses: number;
  totalLosses: number;
  premiumCost: number;
  monthlySavings: number;
  roi: number;
}

export interface SalesForecast {
  nextWeekSales: number;
  nextMonthSales: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Calculate average daily usage for a product based on sales history
 */
export const calculateDailyUsage = async (
  shopId: string,
  productName: string,
  days: number = 30
): Promise<number> => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sales = await getSales(shopId, startDate, endDate);

    const productSales = sales.filter(
      (sale) => sale.productName.toLowerCase().trim() === productName.toLowerCase().trim()
    );

    if (productSales.length === 0) return 0;

    const totalQuantity = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
    return totalQuantity / days;
  } catch (error) {
    console.error('Error calculating daily usage:', error);
    return 0;
  }
};

/**
 * Generate stockout alerts for all products
 */
export const generateStockoutAlerts = async (
  shopId: string,
  thresholdDays: number = 7
): Promise<StockoutAlert[]> => {
  try {
    const stock = await getCurrentStock(shopId);
    const alerts: StockoutAlert[] = [];

    // Get sales data for the last 30 days to calculate usage patterns
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const sales = await getSales(shopId, startDate, endDate);

    for (const [productName, record] of Object.entries(stock)) {
      // Calculate average daily usage
      const productSales = sales.filter(
        (sale) => sale.productName.toLowerCase().trim() === productName.toLowerCase().trim()
      );

      if (productSales.length === 0) continue;

      const totalSold = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
      const averageDailyUsage = totalSold / 30;

      if (averageDailyUsage === 0) continue;

      // Calculate days until stockout
      const daysUntilStockout = record.quantity / averageDailyUsage;

      // Only alert if stockout is within threshold
      if (daysUntilStockout <= thresholdDays) {
        // Calculate average price per unit
        const avgPrice =
          productSales.reduce((sum, sale) => sum + sale.pricePerUnit, 0) / productSales.length;

        // Estimate lost revenue if we run out
        const estimatedLostRevenue = averageDailyUsage * avgPrice * Math.max(1, 7 - daysUntilStockout);

        // Calculate recommended order quantity (for 2 weeks)
        const recommendedOrderQuantity = Math.ceil(averageDailyUsage * 14);

        // Determine priority
        let priority: 'urgent' | 'high' | 'medium' | 'low' = 'low';
        if (daysUntilStockout <= 2) priority = 'urgent';
        else if (daysUntilStockout <= 4) priority = 'high';
        else if (daysUntilStockout <= 7) priority = 'medium';

        alerts.push({
          productName: productName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          currentQuantity: record.quantity,
          unit: record.unit,
          daysUntilStockout: Math.max(0, Math.round(daysUntilStockout * 10) / 10),
          averageDailyUsage: Math.round(averageDailyUsage * 10) / 10,
          recommendedOrderQuantity,
          estimatedLostRevenue: Math.round(estimatedLostRevenue),
          priority,
        });
      }
    }

    // Sort by priority and days until stockout
    return alerts.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.daysUntilStockout - b.daysUntilStockout;
    });
  } catch (error) {
    console.error('Error generating stockout alerts:', error);
    return [];
  }
};

/**
 * Calculate ROI for premium subscription
 */
export const calculatePremiumROI = async (
  shopId: string,
  days: number = 30
): Promise<ROICalculation> => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [sales, expenses, stock, stockoutAlerts] = await Promise.all([
      getSales(shopId, startDate, endDate),
      getExpenses(shopId, startDate, endDate),
      getCurrentStock(shopId),
      generateStockoutAlerts(shopId, 30), // Look ahead 30 days
    ]);

    // 1. Stockout losses (sum of estimated lost revenue from alerts)
    const stockoutLosses = stockoutAlerts.reduce(
      (sum, alert) => sum + alert.estimatedLostRevenue,
      0
    );

    // 2. Pricing losses (estimate based on low profit margin products)
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalPrice, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

    // If profit margin is below 20%, estimate 5% potential gain
    const pricingLosses = profitMargin < 20 ? totalRevenue * 0.05 : 0;

    // 3. Customer losses (no rewards system = lost repeat business)
    // Estimate: 30% of customers would return more often with rewards
    const uniqueCustomers = new Set(sales.map((s) => s.userPhone)).size;
    const avgTransactionValue = totalRevenue / sales.length;
    const customerLosses = uniqueCustomers * avgTransactionValue * 0.3 * 2; // 2 extra visits/month

    // 4. Inefficiency losses (time spent on manual calculations)
    // Estimate: 5 hours/month @ KES 200/hour
    const inefficiencyLosses = 5 * 200;

    const totalLosses = stockoutLosses + pricingLosses + customerLosses + inefficiencyLosses;

    // Monthly premium cost
    const premiumCost = 197;

    const monthlySavings = totalLosses - premiumCost;
    const roi = premiumCost > 0 ? (monthlySavings / premiumCost) * 100 : 0;

    return {
      stockoutLosses: Math.round(stockoutLosses),
      pricingLosses: Math.round(pricingLosses),
      customerLosses: Math.round(customerLosses),
      inefficiencyLosses: Math.round(inefficiencyLosses),
      totalLosses: Math.round(totalLosses),
      premiumCost,
      monthlySavings: Math.round(monthlySavings),
      roi: Math.round(roi),
    };
  } catch (error) {
    console.error('Error calculating ROI:', error);
    return {
      stockoutLosses: 0,
      pricingLosses: 0,
      customerLosses: 0,
      inefficiencyLosses: 0,
      totalLosses: 0,
      premiumCost: 197,
      monthlySavings: 0,
      roi: 0,
    };
  }
};

/**
 * Generate profit opportunities based on data analysis
 */
export const generateProfitOpportunities = async (
  shopId: string
): Promise<ProfitOpportunity[]> => {
  try {
    const opportunities: ProfitOpportunity[] = [];

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [sales, expenses] = await Promise.all([
      getSales(shopId, startDate, endDate),
      getExpenses(shopId, startDate, endDate),
    ]);

    // 1. Pricing opportunities (products with high volume but low margin)
    const productRevenue: Record<string, { revenue: number; quantity: number; avgPrice: number }> = {};

    sales.forEach((sale) => {
      const name = sale.productName;
      if (!productRevenue[name]) {
        productRevenue[name] = { revenue: 0, quantity: 0, avgPrice: 0 };
      }
      productRevenue[name].revenue += sale.totalPrice;
      productRevenue[name].quantity += sale.quantity;
      productRevenue[name].avgPrice =
        (productRevenue[name].avgPrice * (productRevenue[name].quantity - sale.quantity) +
          sale.pricePerUnit * sale.quantity) /
        productRevenue[name].quantity;
    });

    // Find top selling products
    const topProducts = Object.entries(productRevenue)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 3);

    topProducts.forEach(([name, data]) => {
      // Suggest 5% price increase on top sellers
      const currentRevenue = data.revenue;
      const potentialGain = currentRevenue * 0.05;

      opportunities.push({
        type: 'pricing',
        title: `Optimize pricing for ${name}`,
        description: `${name} is a top seller. A small 5% price increase could boost profits significantly.`,
        potentialGain: Math.round(potentialGain),
        actionRequired: `Increase ${name} price from KES ${Math.round(data.avgPrice)} to KES ${Math.round(data.avgPrice * 1.05)}`,
        priority: 'high',
      });
    });

    // 2. Expense optimization
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalPrice, 0);

    if (totalExpenses / totalRevenue > 0.5) {
      opportunities.push({
        type: 'expense',
        title: 'High expense ratio detected',
        description: `Your expenses are ${Math.round((totalExpenses / totalRevenue) * 100)}% of revenue. Industry average is 30-40%.`,
        potentialGain: Math.round((totalExpenses - totalRevenue * 0.4)),
        actionRequired: 'Review recurring expenses and negotiate better supplier rates',
        priority: 'urgent',
      });
    }

    return opportunities;
  } catch (error) {
    console.error('Error generating profit opportunities:', error);
    return [];
  }
};

/**
 * Forecast sales for the next period
 */
export const forecastSales = async (
  shopId: string,
  days: number = 30
): Promise<SalesForecast> => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sales = await getSales(shopId, startDate, endDate);

    if (sales.length === 0) {
      return {
        nextWeekSales: 0,
        nextMonthSales: 0,
        confidence: 0,
        trend: 'stable',
      };
    }

    // Group sales by day
    const dailySales: Record<string, number> = {};
    sales.forEach((sale) => {
      const date = new Date(sale.timestamp * 1000).toISOString().split('T')[0];
      dailySales[date] = (dailySales[date] || 0) + sale.totalPrice;
    });

    const dailyValues = Object.values(dailySales);
    const averageDailySales = dailyValues.reduce((sum, val) => sum + val, 0) / dailyValues.length;

    // Simple trend detection
    const firstHalf = dailyValues.slice(0, Math.floor(dailyValues.length / 2));
    const secondHalf = dailyValues.slice(Math.floor(dailyValues.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let growthRate = 0;

    if (secondHalfAvg > firstHalfAvg * 1.1) {
      trend = 'increasing';
      growthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
    } else if (secondHalfAvg < firstHalfAvg * 0.9) {
      trend = 'decreasing';
      growthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
    }

    // Forecast with trend adjustment
    const nextWeekSales = averageDailySales * 7 * (1 + growthRate * 0.5);
    const nextMonthSales = averageDailySales * 30 * (1 + growthRate * 0.5);

    // Confidence based on data consistency
    const variance =
      dailyValues.reduce((sum, val) => sum + Math.pow(val - averageDailySales, 2), 0) /
      dailyValues.length;
    const stdDev = Math.sqrt(variance);
    const confidence = Math.max(0, Math.min(100, 100 - (stdDev / averageDailySales) * 100));

    return {
      nextWeekSales: Math.round(nextWeekSales),
      nextMonthSales: Math.round(nextMonthSales),
      confidence: Math.round(confidence),
      trend,
    };
  } catch (error) {
    console.error('Error forecasting sales:', error);
    return {
      nextWeekSales: 0,
      nextMonthSales: 0,
      confidence: 0,
      trend: 'stable',
    };
  }
};
