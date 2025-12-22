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
import { Download, TrendingUp, DollarSign, TrendingDown, BarChart3, Calendar, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import SubscriptionPaymentModal from '../components/payments/SubscriptionPaymentModal';

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
      
      // CRITICAL FIX: Store the user's current subscription plan
      if (subscription && subscription.plan) {
        setCurrentPlan(subscription.plan);
        // Set default report type based on plan
        setReportType(subscription.plan === 'weekly' ? 'weekly' : 'monthly');
      }

      if (access) {
        const storedReports = await getStoredReports(currentShop.id, 20);
        setReports(storedReports as Report[]);
      }
    } catch (error) {
      console.error('Error checking premium access:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!currentShop || !user) return;

    // CRITICAL FIX: Validate report type against subscription plan
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

    // CRITICAL FIX: Validate date range against subscription plan
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

  /**
   * Handle upgrade button click
   * Opens the subscription payment modal with phone number input
   */
  const handleUpgrade = (plan: 'weekly' | 'monthly') => {
    if (!currentShop || !user) return;
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  /**
   * Handle successful payment
   * Refresh access status and close modal
   */
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

      // Create download link
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

  const handleDownloadWhatsApp = (downloadUrl?: string) => {
    if (!downloadUrl) {
      toast.error('Download URL not available');
      return;
    }

    try {
      window.open(downloadUrl, '_blank');
      toast.success('Opening WhatsApp download link...');
    } catch (error) {
      console.error('Error opening download link:', error);
      toast.error('Failed to open download link');
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

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-6">
          <div className="text-center">
            <BarChart3 size={48} className="mx-auto mb-4 text-blue-400" />
            <h2 className="text-xl font-semibold text-white mb-2">Unlock Premium Reports</h2>
            <p className="text-gray-400 mb-6">
              Get detailed analytics, trends, and insights about your business with premium reports.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Weekly Plan */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-2">Weekly</h3>
                <p className="text-3xl font-bold text-green-400 mb-4">KSh 47</p>
                <ul className="text-sm text-gray-400 space-y-2 mb-4">
                  <li>✓ 7 days premium access</li>
                  <li>✓ Daily & weekly reports only</li>
                  <li>✓ Max 7-day date range</li>
                  <li>✓ Export to JSON/CSV</li>
                  <li>✓ Basic trend analysis</li>
                </ul>
                <button
                  onClick={() => handleUpgrade('weekly')}
                  className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                  Subscribe Weekly
                </button>
              </div>

              {/* Monthly Plan */}
              <div className="bg-gray-800 border border-blue-500/20 rounded-lg p-4 ring-1 ring-blue-500/20">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">Monthly</h3>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded font-semibold">
                    POPULAR
                  </span>
                </div>
                <p className="text-3xl font-bold text-blue-400 mb-4">KSh 197</p>
                <ul className="text-sm text-gray-400 space-y-2 mb-4">
                  <li>✓ 30 days premium access</li>
                  <li>✓ Daily, weekly & monthly reports</li>
                  <li>✓ Unlimited date range</li>
                  <li>✓ Export to JSON/CSV</li>
                  <li>✓ Advanced trend analysis</li>
                  <li>✓ Historical reports</li>
                </ul>
                <button
                  onClick={() => handleUpgrade('monthly')}
                  className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  Subscribe Monthly
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Secure payment powered by Paystack. No recurring charges without confirmation.
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
            {currentPlan === 'weekly' ? 'Weekly' : 'Monthly'} Plan - Expires in {remainingDays} {remainingDays === 1 ? 'day' : 'days'}
          </p>
        </div>
        <button
          onClick={checkAccess}
          className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
          title="Refresh access status"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* CRITICAL FIX: Show upgrade notice for weekly users */}
      {currentPlan === 'weekly' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <BarChart3 size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-300 mb-2">
                You're on a <strong>Weekly Plan</strong>. You can generate daily and weekly reports for up to 7 days.
              </p>
              <button
                onClick={() => handleUpgrade('monthly')}
                className="text-sm text-blue-400 hover:text-blue-300 underline"
              >
                Upgrade to Monthly for unlimited monthly reports →
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
              {/* CRITICAL FIX: Disable monthly option for weekly subscribers */}
              <option value="monthly" disabled={currentPlan === 'weekly'}>
                Monthly {currentPlan === 'weekly' ? '(Monthly Plan Required)' : ''}
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
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">
              {selectedReport.reportType === 'daily'
                ? 'Daily Report'
                : selectedReport.reportType === 'weekly'
                ? 'Weekly Report'
                : 'Monthly Report'}{' '}
              - {selectedReport.dateCode}
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
              {selectedReport.downloadUrl && (
                <button
                  onClick={() => handleDownloadWhatsApp(selectedReport.downloadUrl)}
                  className="px-3 py-1 text-sm bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Download size={14} />
                  WhatsApp
                </button>
              )}
            </div>
          </div>

          {/* Report Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Total Sales</p>
              <p className="text-xl font-bold text-blue-400">KSh {selectedReport.data.totalSales.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Total Expenses</p>
              <p className="text-xl font-bold text-red-400">KSh {selectedReport.data.totalExpenses.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Profit</p>
              <p className="text-xl font-bold text-green-400">KSh {selectedReport.data.profit.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Profit Margin</p>
              <p className="text-xl font-bold text-purple-400">
                {selectedReport.data.profitMargin !== undefined
                  ? selectedReport.data.profitMargin.toFixed(1)
                  : selectedReport.data.totalSales > 0
                  ? ((selectedReport.data.profit / selectedReport.data.totalSales) * 100).toFixed(1)
                  : '0.0'
                }%
              </p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Transactions</p>
              <p className="text-xl font-bold text-cyan-400">{selectedReport.data.transactionCount}</p>
            </div>
          </div>

          {/* Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                {selectedReport.data.trends.salesTrend === 'increasing' ? (
                  <TrendingUp size={16} className="text-green-400" />
                ) : selectedReport.data.trends.salesTrend === 'decreasing' ? (
                  <TrendingDown size={16} className="text-red-400" />
                ) : (
                  <TrendingUp size={16} className="text-gray-400" />
                )}
                <p className="text-sm text-gray-400">Sales Trend</p>
              </div>
              <p className="text-white font-semibold capitalize">{selectedReport.data.trends.salesTrend}</p>
            </div>

            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-blue-400" />
                <p className="text-sm text-gray-400">Avg Daily Sales</p>
              </div>
              <p className="text-white font-semibold">KSh {selectedReport.data.trends.averageDailySales.toLocaleString()}</p>
            </div>
          </div>

          {/* Best and Worst Days */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-green-400" />
                <p className="text-sm text-gray-400">Best Day</p>
              </div>
              <p className="text-white font-semibold">{new Date(selectedReport.data.trends.bestDay).toLocaleDateString()}</p>
            </div>

            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-red-400" />
                <p className="text-sm text-gray-400">Worst Day</p>
              </div>
              <p className="text-white font-semibold">{new Date(selectedReport.data.trends.worstDay).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Top Products */}
          {selectedReport.data.topProducts.length > 0 && (
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
              <p className="text-sm font-semibold text-white mb-3">Top Products</p>
              <div className="space-y-2 text-sm">
                {selectedReport.data.topProducts.slice(0, 5).map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-600/30 rounded">
                    <span className="text-gray-300">{product.name}</span>
                    <span className="text-gray-400">{product.quantity} units</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
                      {report.reportType === 'daily'
                        ? 'Daily'
                        : report.reportType === 'weekly'
                        ? 'Weekly'
                        : 'Monthly'}{' '}
                      Report - {report.dateCode}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(report.startDate).toLocaleDateString()} to{' '}
                      {new Date(report.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-semibold">
                      KSh {report.data.profit.toLocaleString()}
                    </p>
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