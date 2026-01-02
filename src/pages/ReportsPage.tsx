import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuthStore } from '../store/authStore';
import {
  checkPremiumAccess,
  generateReport,
  saveReport,
  getStoredReports,
  exportReportAsJSON,
  exportReportAsCSV,
} from '../services/premiumReportsService';
import { getSales, getExpenses } from '../services/shopService';
import { generateStockoutAlerts } from '../services/analyticsService';
import {
  generateBusinessInsights,
  getPeakHoursAnalysis,
  getDayPerformanceAnalysis,
  getProductPerformanceScores,
} from '../services/insightsService';
import { Download, BarChart3, RefreshCw, Lightbulb } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import SubscriptionPaymentModal from '../components/payments/SubscriptionPaymentModal';
import ROICalculator from '../services/ROICalculator';
import BusinessInsightsWidget from '../components/common/BusinessInsightsWidget';
import AdvancedAnalyticsDashboard from '../components/common/AdvancedAnalyticsDashboard';

interface Report {
  shopId: string;
  reportId: string;
  dateCode: string;
  startDate: string;
  endDate: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  data: {
    totalSales: number;
    totalExpenses: number;
    profit: number;
    profitMargin: number;
    transactionCount: number;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
    expenseBreakdown: Record<string, number>;
    dailyBreakdown: Array<{ date: string; sales: number; expenses: number; profit: number; transactions: number }>;
    trends: {
      salesTrend: 'increasing' | 'decreasing' | 'stable';
      averageDailySales: number;
      bestDay: string;
      worstDay: string;
    };
  };
  generatedAt: number;
  downloadUrl?: string;
}

function ReportsPage() {
  const { currentShop, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [remainingDays, setRemainingDays] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<'weekly' | 'monthly'>('weekly');
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Insights and analytics
  const [insights, setInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [dayPerformance, setDayPerformance] = useState<any[]>([]);
  const [productScores, setProductScores] = useState<any[]>([]);

  // Subscription modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly'>('monthly');

  // Report generation form
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    checkAccess();
  }, [currentShop, user]);

  useEffect(() => {
    if (hasAccess && selectedReport) {
      loadInsights();
    }
  }, [selectedReport, hasAccess]);

  const checkAccess = async () => {
    if (!currentShop || !user) return;

    try {
      setLoading(true);
      const { hasAccess: access, remainingDays: days, subscription } = await checkPremiumAccess(
        currentShop.id,
        user.uid
      );

      setHasAccess(access);
      setRemainingDays(days || 0);
      
      if (subscription && subscription.plan) {
        setCurrentPlan(subscription.plan);
        setReportType(subscription.plan === 'weekly' ? 'weekly' : 'monthly');
      }

      if (access) {
        const storedReports = await getStoredReports(currentShop.id, 20);
        setReports(storedReports as Report[]);
        
        // Auto-select most recent report
        if (storedReports.length > 0 && !selectedReport) {
          setSelectedReport(storedReports[0] as Report);
        }
      }
    } catch (error) {
      console.error('Error checking premium access:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    if (!currentShop || !selectedReport) return;

    try {
      setInsightsLoading(true);

      // Load sales and expenses for the report period
      const [sales, expenses, stockoutAlerts] = await Promise.all([
        getSales(currentShop.id, selectedReport.startDate, selectedReport.endDate),
        getExpenses(currentShop.id, selectedReport.startDate, selectedReport.endDate),
        generateStockoutAlerts(currentShop.id, 7),
      ]);

      // Generate insights
      const businessInsights = await generateBusinessInsights(
        sales,
        expenses,
        stockoutAlerts,
        currentPlan
      );
      setInsights(businessInsights);

      // Monthly exclusive: Advanced analytics
      if (currentPlan === 'monthly') {
        const peakHoursData = getPeakHoursAnalysis(sales);
        const dayPerfData = getDayPerformanceAnalysis(sales);
        const productScoresData = getProductPerformanceScores(sales);

        setPeakHours(peakHoursData);
        setDayPerformance(dayPerfData);
        setProductScores(productScoresData);
      }
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!currentShop || !user) return;

    if (currentPlan === 'weekly' && reportType === 'monthly') {
      toast.error('Monthly reports require a monthly subscription. Please upgrade to generate monthly reports.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      toast.error('Start date must be before end date');
      return;
    }

    const daysDifference = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (currentPlan === 'weekly' && daysDifference > 7) {
      toast.error('Weekly subscription allows reports up to 7 days only. Please select a shorter date range or upgrade to monthly.');
      return;
    }

    try {
      setGenerating(true);
      const report = await generateReport(
        currentShop.id,
        startDate,
        endDate,
        reportType
      );

      if (!report) {
        toast.error('No data available for the selected date range');
        return;
      }

      await saveReport(report as Report);
      setSelectedReport(report as Report);
      setReports([report as Report, ...reports]);

      toast.success('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpgrade = (plan: 'weekly' | 'monthly') => {
    if (!currentShop || !user) return;
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    await checkAccess();
    setShowPaymentModal(false);
  };

  const handleExport = (format: 'json' | 'csv') => {
    if (!selectedReport) {
      toast.error('Please select a report to export');
      return;
    }

    try {
      let content = '';
      let filename = `report-${selectedReport.dateCode}`;

      if (format === 'json') {
        content = exportReportAsJSON(selectedReport);
        filename += '.json';
      } else {
        content = exportReportAsCSV(selectedReport);
        filename += '.csv';
      }

      const element = document.createElement('a');
      const file = new Blob([content], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });
      element.href = URL.createObjectURL(file);
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  if (!currentShop) {
    return (
      <div className="p-4">
        <EmptyState
          icon={BarChart3}
          title="No Shop Selected"
          description="Please select a shop to view reports"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold text-white">Premium Reports</h1>

        {/* ROI Calculator */}
        {currentShop && (
          <ROICalculator shopId={currentShop.id} onUpgrade={() => handleUpgrade('monthly')} />
        )}

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-6">
          <div className="text-center">
            <BarChart3 size={48} className="mx-auto mb-4 text-blue-400" />
            <h2 className="text-xl font-semibold text-white mb-2">Unlock Premium Reports</h2>
            <p className="text-gray-400 mb-6">
              Get detailed analytics, trends, insights, and actionable recommendations for your business.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Weekly Plan */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-left">
                <h3 className="text-lg font-semibold text-white mb-2">Weekly Plan</h3>
                <p className="text-3xl font-bold text-green-400 mb-4">KSh 47/week</p>
                <ul className="text-sm text-gray-400 space-y-2 mb-4">
                  <li>✅ 7 days premium access</li>
                  <li>✅ Daily & weekly reports</li>
                  <li>✅ Max 7-day date range</li>
                  <li>✅ Basic trends & insights</li>
                  <li>✅ Top 5 products analysis</li>
                  <li>✅ Expense breakdown</li>
                  <li>✅ Export to JSON/CSV</li>
                  <li>❌ NO monthly reports</li>
                  <li>❌ NO advanced analytics</li>
                  <li>❌ NO rewards system</li>
                  <li>❌ NO peak hour analysis</li>
                </ul>
                <button
                  onClick={() => handleUpgrade('weekly')}
                  className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                  Subscribe Weekly
                </button>
              </div>

              {/* Monthly Plan */}
              <div className="bg-gray-800 border border-blue-500/30 rounded-lg p-4 ring-2 ring-blue-500/30 text-left">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">Monthly Plan</h3>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded font-semibold">
                    BEST VALUE
                  </span>
                </div>
                <p className="text-3xl font-bold text-blue-400 mb-4">KSh 197/month</p>
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-blue-400 mb-1 uppercase">Everything in Weekly +</p>
                    <ul className="text-sm text-gray-400 space-y-1">
                      <li>✅ 30 days premium access</li>
                      <li>✅ Monthly reports & unlimited range</li>
                      <li>✅ Advanced trend analysis</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-400 mb-1 uppercase">🎯 Smart Insights</p>
                    <ul className="text-sm text-gray-400 space-y-1">
                      <li>✅ Actionable recommendations</li>
                      <li>✅ Pricing optimization alerts</li>
                      <li>✅ Stockout predictions</li>
                      <li>✅ Sales forecasting</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-purple-400 mb-1 uppercase">📊 Advanced Analytics</p>
                    <ul className="text-sm text-gray-400 space-y-1">
                      <li>✅ Peak hour staffing analysis</li>
                      <li>✅ Day-of-week optimization</li>
                      <li>✅ Product performance scoring</li>
                      <li>✅ Customer segmentation</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-yellow-400 mb-1 uppercase">🪙 Rewards System</p>
                    <ul className="text-sm text-gray-400 space-y-1">
                      <li>✅ Full customer loyalty program</li>
                      <li>✅ VIP customer tracking</li>
                      <li>✅ Automated campaigns</li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => handleUpgrade('monthly')}
                  className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  Subscribe Monthly
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Secure payment via M-Pesa. Cancel anytime.
            </p>
          </div>
        </div>

        {/* Subscription Payment Modal */}
        {currentShop && user && (
          <SubscriptionPaymentModal
            isOpen={showPaymentModal}
            plan={selectedPlan}
            shopId={currentShop.id}
            userId={user.uid}
            userEmail={user.email || 'user@example.com'}
            userName={currentShop.shopName}
            onSuccess={handlePaymentSuccess}
            onClose={() => setShowPaymentModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Premium Reports</h1>
          <p className="text-sm text-gray-400">
            {currentPlan === 'weekly' ? 'Weekly' : 'Monthly'} Plan - {remainingDays} {remainingDays === 1 ? 'day' : 'days'} remaining
          </p>
        </div>
        <button
          onClick={checkAccess}
          className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Weekly plan upgrade notice */}
      {currentPlan === 'weekly' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-300 mb-2">
                <strong>Weekly Plan:</strong> You get daily & weekly reports (max 7 days), basic insights, and export features.
              </p>
              <button
                onClick={() => handleUpgrade('monthly')}
                className="text-sm text-blue-400 hover:text-blue-300 underline"
              >
                Upgrade to Monthly for advanced analytics, peak hours, product scoring & rewards →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Generation */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="font-semibold text-white mb-4">Generate Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={generating}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={generating}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={generating}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly" disabled={currentPlan === 'weekly'}>
                Monthly {currentPlan === 'weekly' ? '(Upgrade Required)' : ''}
              </option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <LoadingSpinner size="sm" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart3 size={18} />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Selected Report Details */}
      {selectedReport && (
        <>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">
                {selectedReport.reportType.charAt(0).toUpperCase() + selectedReport.reportType.slice(1)} Report - {selectedReport.dateCode}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('json')}
                  className="px-3 py-1 text-sm bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Download size={14} />
                  JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="px-3 py-1 text-sm bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Download size={14} />
                  CSV
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Total Sales</p>
                <p className="text-xl font-bold text-blue-400">KSh {selectedReport.data.totalSales.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Expenses</p>
                <p className="text-xl font-bold text-red-400">KSh {selectedReport.data.totalExpenses.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Profit</p>
                <p className="text-xl font-bold text-green-400">KSh {selectedReport.data.profit.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Margin</p>
                <p className="text-xl font-bold text-purple-400">
                  {selectedReport.data.totalSales > 0
                    ? ((selectedReport.data.profit / selectedReport.data.totalSales) * 100).toFixed(1)
                    : '0.0'}%
                </p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Transactions</p>
                <p className="text-xl font-bold text-cyan-400">{selectedReport.data.transactionCount}</p>
              </div>
            </div>
          </div>

          {/* Business Insights */}
          <BusinessInsightsWidget
            insights={insights}
            plan={currentPlan}
            loading={insightsLoading}
          />

          {/* Advanced Analytics (Monthly Only) */}
          {currentPlan === 'monthly' && peakHours.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Advanced Analytics</h2>
                <button
                  onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {showAdvancedAnalytics ? 'Hide' : 'Show'} Details
                </button>
              </div>
              
              {showAdvancedAnalytics && (
                <AdvancedAnalyticsDashboard
                  peakHours={peakHours}
                  dayPerformance={dayPerformance}
                  productScores={productScores}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Historical Reports */}
      {reports.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-white mb-3">Historical Reports</h3>
          <div className="space-y-2">
            {reports.map((report) => (
              <button
                key={report.reportId}
                onClick={() => setSelectedReport(report)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  selectedReport?.reportId === report.reportId
                    ? 'bg-blue-500/20 border border-blue-500/40'
                    : 'bg-gray-700/50 hover:bg-gray-700 border border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report - {report.dateCode}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(report.startDate).toLocaleDateString()} to{' '}
                      {new Date(report.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-semibold">KSh {report.data.profit.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Profit</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;