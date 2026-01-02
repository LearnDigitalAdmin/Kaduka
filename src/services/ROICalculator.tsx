import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Clock, Crown } from 'lucide-react';
import { calculatePremiumROI, ROICalculation } from './analyticsService';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface ROICalculatorProps {
  shopId: string;
  onUpgrade: () => void;
}

function ROICalculator({ shopId, onUpgrade }: ROICalculatorProps) {
  const [roi, setRoi] = useState<ROICalculation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadROI();
  }, [shopId]);

  const loadROI = async () => {
    try {
      setLoading(true);
      const data = await calculatePremiumROI(shopId);
      setRoi(data);
    } catch (error) {
      console.error('Error loading ROI:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!roi) return null;

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Premium ROI Calculator</h3>
          <p className="text-sm text-gray-400">See how much you're losing without premium</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
          <Crown size={16} className="text-yellow-400" />
          <span className="text-yellow-400 font-semibold text-sm">Premium</span>
        </div>
      </div>

      {/* Monthly Losses Breakdown */}
      <div className="space-y-3 mb-6">
        <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Monthly Losses Without Premium:
        </h4>

        <div className="space-y-2">
          {/* Stockout Losses */}
          <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-400" />
              <div>
                <p className="text-sm font-medium text-white">Stockout Losses</p>
                <p className="text-xs text-gray-400">Lost sales from empty shelves</p>
              </div>
            </div>
            <p className="text-lg font-bold text-red-400">
              KES {roi.stockoutLosses.toLocaleString()}
            </p>
          </div>

          {/* Pricing Losses */}
          {roi.pricingLosses > 0 && (
            <div className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <DollarSign size={20} className="text-orange-400" />
                <div>
                  <p className="text-sm font-medium text-white">Pricing Optimization</p>
                  <p className="text-xs text-gray-400">Potential profit from better pricing</p>
                </div>
              </div>
              <p className="text-lg font-bold text-orange-400">
                KES {roi.pricingLosses.toLocaleString()}
              </p>
            </div>
          )}

          {/* Customer Losses */}
          <div className="flex items-center justify-between p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-purple-400" />
              <div>
                <p className="text-sm font-medium text-white">Lost Customer Revenue</p>
                <p className="text-xs text-gray-400">No rewards = fewer repeat customers</p>
              </div>
            </div>
            <p className="text-lg font-bold text-purple-400">
              KES {roi.customerLosses.toLocaleString()}
            </p>
          </div>

          {/* Inefficiency Losses */}
          <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-blue-400" />
              <div>
                <p className="text-sm font-medium text-white">Time Wasted</p>
                <p className="text-xs text-gray-400">Manual calculations & tracking</p>
              </div>
            </div>
            <p className="text-lg font-bold text-blue-400">
              KES {roi.inefficiencyLosses.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Total Calculation */}
      <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 mb-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Total Monthly Losses:</span>
            <span className="text-white font-semibold">
              KES {roi.totalLosses.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Premium Cost (Monthly):</span>
            <span className="text-white font-semibold">- KES {roi.premiumCost}</span>
          </div>

          <div className="h-px bg-gray-600" />

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-white">Your Monthly Savings:</span>
            <span className="text-2xl font-bold text-green-400">
              KES {roi.monthlySavings.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ROI Highlight */}
      <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-300 mb-2">Return on Investment</p>
          <p className="text-4xl font-bold text-green-400 mb-2">
            {roi.roi > 0 ? roi.roi.toLocaleString() : 0}%
          </p>
          <p className="text-xs text-gray-400">
            {roi.roi > 100 
              ? `That's ${Math.round(roi.roi / 100)}x your investment back every month!`
              : 'Upgrade to start saving'}
          </p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onUpgrade}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
      >
        <Crown size={20} />
        Unlock Premium & Start Saving
      </button>

      <p className="text-xs text-center text-gray-500 mt-3">
        Based on your last 30 days of data
      </p>
    </div>
  );
}

export default ROICalculator;
