export interface SummaryData {
  date: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
}

export interface ChartDataPoint {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
}

export interface PeriodSummary {
  startDate: string;
  endDate: string;
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;
  averageDailySales: number;
  averageDailyExpenses: number;
  averageDailyProfit: number;
  numberOfDays: number;
  transactionCount: number;
}
