/**
 * Insights Service
 * Generates actionable business insights, recommendations, and alerts
 * Different insights for Weekly vs Monthly subscribers
 */

import { Sale, Expense, getCurrentStock } from './shopService';
import { StockoutAlert } from './analyticsService';

export type InsightType = 'opportunity' | 'warning' | 'optimization' | 'achievement';
export type InsightPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface BusinessInsight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  impact: string;
  action: string;
  data?: any;
  createdAt: number;
}

export interface PeakHourAnalysis {
  hour: number;
  salesCount: number;
  revenue: number;
  percentage: number;
}

export interface DayPerformance {
  day: string;
  sales: number;
  transactions: number;
  averageTransaction: number;
}

export interface ProductPerformance {
  name: string;
  revenue: number;
  quantity: number;
  margin: number;
  velocity: number;
  score: number; // 0-100
  trend: 'rising' | 'stable' | 'declining';
}

export interface CustomerSegment {
  segment: 'vip' | 'regular' | 'new' | 'at_risk';
  count: number;
  totalSpent: number;
  averageTransaction: number;
}

/**
 * Generate insights based on sales, expenses, and stock data
 * Monthly subscribers get more advanced insights
 */
export const generateBusinessInsights = async (
  sales: Sale[],
  expenses: Expense[],
  stockoutAlerts: StockoutAlert[],
  plan: 'weekly' | 'monthly'
): Promise<BusinessInsight[]> => {
  const insights: BusinessInsight[] = [];

  // 1. STOCKOUT WARNINGS (Both plans)
  const urgentStockouts = stockoutAlerts.filter(a => a.priority === 'urgent' || a.priority === 'high');
  urgentStockouts.forEach((alert, idx) => {
    insights.push({
      id: `stockout-${idx}`,
      type: 'warning',
      priority: alert.priority as InsightPriority,
      title: `${alert.productName} stock critically low`,
      description: `Only ${alert.currentQuantity} ${alert.unit} remaining. At current sales rate, you'll run out in ${alert.daysUntilStockout} days.`,
      impact: `Potential lost sales: KES ${alert.estimatedLostRevenue.toLocaleString()}`,
      action: `Order ${alert.recommendedOrderQuantity} ${alert.unit} immediately (2-week supply)`,
      data: alert,
      createdAt: Date.now(),
    });
  });

  // 2. PRICING OPPORTUNITIES (Both plans, but monthly gets more detail)
  const pricingInsights = analyzePricingOpportunities(sales, plan);
  insights.push(...pricingInsights);

  // 3. EXPENSE OPTIMIZATION (Both plans)
  const expenseInsights = analyzeExpensePatterns(sales, expenses);
  insights.push(...expenseInsights);

  // 4. SALES PATTERNS (Weekly gets basic, Monthly gets advanced)
  const salesPatternInsights = analyzeSalesPatterns(sales, plan);
  insights.push(...salesPatternInsights);

  // 5. MONTHLY EXCLUSIVE: Peak hour analysis
  if (plan === 'monthly') {
    const peakHourInsights = analyzePeakHours(sales);
    insights.push(...peakHourInsights);
  }

  // 6. MONTHLY EXCLUSIVE: Day-of-week optimization
  if (plan === 'monthly') {
    const dayOptimization = analyzeDayPerformance(sales);
    insights.push(...dayOptimization);
  }

  // 7. MONTHLY EXCLUSIVE: Product performance scoring
  if (plan === 'monthly') {
    const productInsights = analyzeProductPerformance(sales);
    insights.push(...productInsights);
  }

  // 8. ACHIEVEMENTS (Positive reinforcement)
  const achievements = generateAchievements(sales, expenses);
  insights.push(...achievements);

  // Sort by priority: urgent > high > medium > low
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return insights.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.createdAt - a.createdAt;
  });
};

/**
 * Analyze pricing opportunities
 */
function analyzePricingOpportunities(sales: Sale[], plan: 'weekly' | 'monthly'): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  // Group by product
  const productData: Record<string, { revenue: number; quantity: number; prices: number[] }> = {};
  sales.forEach(sale => {
    if (!productData[sale.productName]) {
      productData[sale.productName] = { revenue: 0, quantity: 0, prices: [] };
    }
    productData[sale.productName].revenue += sale.totalPrice;
    productData[sale.productName].quantity += sale.quantity;
    productData[sale.productName].prices.push(sale.pricePerUnit);
  });

  // Find top 3 revenue products
  const topProducts = Object.entries(productData)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 3);

  topProducts.forEach(([name, data], idx) => {
    const avgPrice = data.revenue / data.quantity;
    const suggestedPrice = Math.round(avgPrice * 1.05); // 5% increase
    const potentialGain = (suggestedPrice - avgPrice) * data.quantity;

    if (potentialGain > 500) { // Only suggest if gain > KES 500
      insights.push({
        id: `pricing-${idx}`,
        type: 'opportunity',
        priority: potentialGain > 2000 ? 'high' : 'medium',
        title: `Optimize ${name} pricing for higher margins`,
        description: `${name} is a top seller with ${data.quantity} units sold. A small price adjustment could significantly boost profits.`,
        impact: `+KES ${Math.round(potentialGain).toLocaleString()}/month`,
        action: `Consider increasing price from KES ${Math.round(avgPrice)} to KES ${suggestedPrice} (5% increase)`,
        data: { product: name, currentPrice: avgPrice, suggestedPrice, quantity: data.quantity },
        createdAt: Date.now(),
      });
    }
  });

  // MONTHLY EXCLUSIVE: Price consistency check
  if (plan === 'monthly') {
    Object.entries(productData).forEach(([name, data]) => {
      const prices = data.prices;
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);

      // If price varies more than 10%, flag it
      if (stdDev / avgPrice > 0.1 && data.quantity > 10) {
        insights.push({
          id: `price-consistency-${name}`,
          type: 'warning',
          priority: 'medium',
          title: `Inconsistent pricing for ${name}`,
          description: `${name} is being sold at varying prices (KES ${Math.round(Math.min(...prices))} - ${Math.round(Math.max(...prices))}). This could confuse customers and hurt profits.`,
          impact: `Revenue optimization: ~KES ${Math.round(stdDev * data.quantity).toLocaleString()}`,
          action: `Standardize price at KES ${Math.round(avgPrice)}`,
          data: { product: name, priceRange: { min: Math.min(...prices), max: Math.max(...prices) } },
          createdAt: Date.now(),
        });
      }
    });
  }

  return insights;
}

/**
 * Analyze expense patterns
 */
function analyzeExpensePatterns(sales: Sale[], expenses: Expense[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (totalRevenue === 0) return insights;

  const expenseRatio = totalExpenses / totalRevenue;

  // High expense ratio warning
  if (expenseRatio > 0.5) {
    insights.push({
      id: 'high-expenses',
      type: 'warning',
      priority: 'high',
      title: 'Expense ratio is too high',
      description: `Your expenses are ${Math.round(expenseRatio * 100)}% of revenue. Industry benchmark is 30-40% for retail shops.`,
      impact: `Reducing to 40% = KES ${Math.round((expenseRatio - 0.4) * totalRevenue).toLocaleString()} saved/month`,
      action: 'Review recurring expenses, negotiate better supplier rates, reduce waste',
      data: { currentRatio: expenseRatio, targetRatio: 0.4, savings: (expenseRatio - 0.4) * totalRevenue },
      createdAt: Date.now(),
    });
  }

  // Category-specific expense analysis
  const expensesByCategory: Record<string, number> = {};
  expenses.forEach(e => {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
  });

  // Find dominant expense category
  const dominantCategory = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])[0];

  if (dominantCategory && dominantCategory[1] / totalExpenses > 0.4) {
    insights.push({
      id: 'dominant-expense',
      type: 'optimization',
      priority: 'medium',
      title: `${dominantCategory[0]} expenses are dominant`,
      description: `${dominantCategory[0]} accounts for ${Math.round((dominantCategory[1] / totalExpenses) * 100)}% of your total expenses.`,
      impact: `10% reduction = KES ${Math.round(dominantCategory[1] * 0.1).toLocaleString()} saved/month`,
      action: `Focus on optimizing ${dominantCategory[0]} costs - negotiate bulk discounts, find alternative suppliers`,
      data: { category: dominantCategory[0], amount: dominantCategory[1], percentage: dominantCategory[1] / totalExpenses },
      createdAt: Date.now(),
    });
  }

  return insights;
}

/**
 * Analyze sales patterns
 */
function analyzeSalesPatterns(sales: Sale[], plan: 'weekly' | 'monthly'): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  if (sales.length < 7) return insights;

  // Calculate trend
  const midpoint = Math.floor(sales.length / 2);
  const firstHalf = sales.slice(0, midpoint);
  const secondHalf = sales.slice(midpoint);

  const firstHalfTotal = firstHalf.reduce((sum, s) => sum + s.totalPrice, 0);
  const secondHalfTotal = secondHalf.reduce((sum, s) => sum + s.totalPrice, 0);

  const growth = ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100;

  if (growth > 10) {
    insights.push({
      id: 'sales-growth',
      type: 'achievement',
      priority: 'low',
      title: `Sales growing strongly at ${Math.round(growth)}%`,
      description: `Your sales are on an upward trend! Keep up the good work.`,
      impact: `Projected monthly growth: +KES ${Math.round((secondHalfTotal / secondHalf.length) * 30 * (growth / 100)).toLocaleString()}`,
      action: 'Maintain current strategies and consider expanding inventory for high-demand items',
      data: { growth, trend: 'increasing' },
      createdAt: Date.now(),
    });
  } else if (growth < -10) {
    insights.push({
      id: 'sales-decline',
      type: 'warning',
      priority: 'high',
      title: `Sales declining by ${Math.round(Math.abs(growth))}%`,
      description: `Your sales have dropped compared to earlier in the period. Immediate action needed.`,
      impact: `Potential lost revenue: KES ${Math.round((firstHalfTotal / firstHalf.length) * 30 * (Math.abs(growth) / 100)).toLocaleString()}/month`,
      action: 'Run promotions, review pricing, check stock availability, improve customer service',
      data: { growth, trend: 'declining' },
      createdAt: Date.now(),
    });
  }

  return insights;
}

/**
 * MONTHLY ONLY: Analyze peak hours for staffing optimization
 */
function analyzePeakHours(sales: Sale[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const hourlyData: Record<number, { count: number; revenue: number }> = {};

  sales.forEach(sale => {
    const hour = new Date(sale.timestamp * 1000).getHours();
    if (!hourlyData[hour]) {
      hourlyData[hour] = { count: 0, revenue: 0 };
    }
    hourlyData[hour].count++;
    hourlyData[hour].revenue += sale.totalPrice;
  });

  // Find peak hours (top 3)
  const sortedHours = Object.entries(hourlyData)
    .map(([hour, data]) => ({ hour: parseInt(hour), ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  if (sortedHours.length > 0) {
    const peakHour = sortedHours[0];
    const totalRevenue = sales.reduce((sum, s) => sum + s.totalPrice, 0);
    const percentage = (peakHour.revenue / totalRevenue) * 100;

    insights.push({
      id: 'peak-hours',
      type: 'optimization',
      priority: 'medium',
      title: `Peak sales hour: ${peakHour.hour}:00 - ${peakHour.hour + 1}:00`,
      description: `${Math.round(percentage)}% of your sales happen during this hour. Optimize staffing and inventory for peak times.`,
      impact: `Better service during peak = +10% sales = KES ${Math.round(peakHour.revenue * 0.1).toLocaleString()}`,
      action: `Ensure adequate staff and stock during ${peakHour.hour}:00-${peakHour.hour + 1}:00. Consider extending hours around this time.`,
      data: { peakHours: sortedHours },
      createdAt: Date.now(),
    });
  }

  return insights;
}

/**
 * MONTHLY ONLY: Analyze day-of-week performance
 */
function analyzeDayPerformance(sales: Sale[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const dayData: Record<string, { count: number; revenue: number }> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  sales.forEach(sale => {
    const day = dayNames[new Date(sale.timestamp * 1000).getDay()];
    if (!dayData[day]) {
      dayData[day] = { count: 0, revenue: 0 };
    }
    dayData[day].count++;
    dayData[day].revenue += sale.totalPrice;
  });

  // Find best and worst days
  const sortedDays = Object.entries(dayData)
    .map(([day, data]) => ({ day, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  if (sortedDays.length >= 3) {
    const bestDay = sortedDays[0];
    const worstDay = sortedDays[sortedDays.length - 1];
    const gap = bestDay.revenue - worstDay.revenue;

    if (gap / bestDay.revenue > 0.3) { // More than 30% difference
      const potentialGain = gap * 0.2; // If we can lift worst day by 20%

      insights.push({
        id: 'day-optimization',
        type: 'optimization',
        priority: 'medium',
        title: `${worstDay.day} sales are ${Math.round((gap / bestDay.revenue) * 100)}% lower than ${bestDay.day}`,
        description: `Your sales vary significantly by day. ${bestDay.day} is your best day, while ${worstDay.day} underperforms.`,
        impact: `Boost ${worstDay.day} by 20% = +KES ${Math.round(potentialGain).toLocaleString()}/week`,
        action: `Run promotions on ${worstDay.day}: "Midweek Special - 10% off" or "Flash Sale Every ${worstDay.day}"`,
        data: { bestDay: bestDay.day, worstDay: worstDay.day, gap, days: sortedDays },
        createdAt: Date.now(),
      });
    }
  }

  return insights;
}

/**
 * MONTHLY ONLY: Product performance scoring
 */
function analyzeProductPerformance(sales: Sale[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const productData: Record<string, { revenue: number; quantity: number; transactions: number }> = {};

  sales.forEach(sale => {
    if (!productData[sale.productName]) {
      productData[sale.productName] = { revenue: 0, quantity: 0, transactions: 0 };
    }
    productData[sale.productName].revenue += sale.totalPrice;
    productData[sale.productName].quantity += sale.quantity;
    productData[sale.productName].transactions++;
  });

  // Score products (0-100) based on revenue, velocity, and margin
  const scoredProducts = Object.entries(productData).map(([name, data]) => {
    const avgPrice = data.revenue / data.quantity;
    const velocity = data.quantity / sales.length; // Units per day
    
    // Simple scoring: 40% revenue, 40% velocity, 20% consistency
    const revenueScore = Math.min(100, (data.revenue / 10000) * 100);
    const velocityScore = Math.min(100, velocity * 10);
    const consistencyScore = Math.min(100, (data.transactions / sales.length) * 100);
    
    const score = revenueScore * 0.4 + velocityScore * 0.4 + consistencyScore * 0.2;

    return { name, score: Math.round(score), revenue: data.revenue, quantity: data.quantity };
  }).sort((a, b) => b.score - a.score);

  // Find underperformers (score < 30)
  const underperformers = scoredProducts.filter(p => p.score < 30 && p.revenue > 100);

  if (underperformers.length > 0) {
    const topUnderperformer = underperformers[0];
    insights.push({
      id: 'product-underperformer',
      type: 'warning',
      priority: 'low',
      title: `${topUnderperformer.name} is underperforming`,
      description: `Performance score: ${topUnderperformer.score}/100. This product has low sales velocity and inconsistent demand.`,
      impact: `Consider discontinuing or discounting to clear inventory`,
      action: `Run clearance sale: "20% off ${topUnderperformer.name}" or replace with better-selling alternative`,
      data: { product: topUnderperformer, allScores: scoredProducts.slice(0, 10) },
      createdAt: Date.now(),
    });
  }

  return insights;
}

/**
 * Generate achievements (positive reinforcement)
 */
function generateAchievements(sales: Sale[], expenses: Expense[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // Milestone: 100k revenue
  if (totalRevenue >= 100000) {
    insights.push({
      id: 'milestone-100k',
      type: 'achievement',
      priority: 'low',
      title: '🎉 Milestone: KES 100,000+ revenue!',
      description: `Congratulations! You've crossed KES 100K in revenue this period.`,
      impact: 'Major business milestone achieved',
      action: 'Keep growing! Consider expanding product lines or opening another location.',
      createdAt: Date.now(),
    });
  }

  // Great profit margin
  if (profitMargin > 30) {
    insights.push({
      id: 'great-margin',
      type: 'achievement',
      priority: 'low',
      title: `💰 Excellent ${Math.round(profitMargin)}% profit margin`,
      description: `Your profit margin is well above the industry average of 20%. Great job on cost control!`,
      impact: 'Strong financial health',
      action: 'Maintain this efficiency while looking for growth opportunities',
      createdAt: Date.now(),
    });
  }

  // High transaction count
  if (sales.length > 100) {
    insights.push({
      id: 'high-volume',
      type: 'achievement',
      priority: 'low',
      title: `🔥 ${sales.length} transactions - high customer traffic!`,
      description: `You're serving lots of customers! This is a sign of strong market presence.`,
      impact: 'High customer engagement',
      action: 'Consider loyalty programs to turn first-time buyers into repeat customers',
      createdAt: Date.now(),
    });
  }

  return insights;
}

/**
 * Get peak hours analysis (MONTHLY ONLY)
 */
export const getPeakHoursAnalysis = (sales: Sale[]): PeakHourAnalysis[] => {
  const hourlyData: Record<number, { count: number; revenue: number }> = {};

  sales.forEach(sale => {
    const hour = new Date(sale.timestamp * 1000).getHours();
    if (!hourlyData[hour]) {
      hourlyData[hour] = { count: 0, revenue: 0 };
    }
    hourlyData[hour].count++;
    hourlyData[hour].revenue += sale.totalPrice;
  });

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalPrice, 0);

  return Object.entries(hourlyData)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      salesCount: data.count,
      revenue: Math.round(data.revenue),
      percentage: Math.round((data.revenue / totalRevenue) * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue);
};

/**
 * Get day performance analysis (MONTHLY ONLY)
 */
export const getDayPerformanceAnalysis = (sales: Sale[]): DayPerformance[] => {
  const dayData: Record<string, { count: number; revenue: number }> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  sales.forEach(sale => {
    const day = dayNames[new Date(sale.timestamp * 1000).getDay()];
    if (!dayData[day]) {
      dayData[day] = { count: 0, revenue: 0 };
    }
    dayData[day].count++;
    dayData[day].revenue += sale.totalPrice;
  });

  return Object.entries(dayData)
    .map(([day, data]) => ({
      day,
      sales: Math.round(data.revenue),
      transactions: data.count,
      averageTransaction: Math.round(data.revenue / data.count),
    }))
    .sort((a, b) => b.sales - a.sales);
};

/**
 * Get product performance scores (MONTHLY ONLY)
 */
export const getProductPerformanceScores = (sales: Sale[]): ProductPerformance[] => {
  const productData: Record<string, { revenue: number; quantity: number; transactions: number; prices: number[] }> = {};

  sales.forEach(sale => {
    if (!productData[sale.productName]) {
      productData[sale.productName] = { revenue: 0, quantity: 0, transactions: 0, prices: [] };
    }
    productData[sale.productName].revenue += sale.totalPrice;
    productData[sale.productName].quantity += sale.quantity;
    productData[sale.productName].transactions++;
    productData[sale.productName].prices.push(sale.pricePerUnit);
  });

  return Object.entries(productData).map(([name, data]) => {
    const avgPrice = data.revenue / data.quantity;
    const velocity = data.quantity / sales.length;
    
    // Score calculation
    const revenueScore = Math.min(100, (data.revenue / 10000) * 100);
    const velocityScore = Math.min(100, velocity * 10);
    const consistencyScore = Math.min(100, (data.transactions / sales.length) * 100);
    const score = Math.round(revenueScore * 0.4 + velocityScore * 0.4 + consistencyScore * 0.2);

    // Trend calculation (simplified)
    const trend: 'rising' | 'stable' | 'declining' = 
      velocity > 5 ? 'rising' : velocity < 1 ? 'declining' : 'stable';

    return {
      name,
      revenue: Math.round(data.revenue),
      quantity: data.quantity,
      margin: Math.round(avgPrice),
      velocity: Math.round(velocity * 10) / 10,
      score,
      trend,
    };
  }).sort((a, b) => b.score - a.score);
};
