import { useEffect, useState } from 'react';
import { AlertTriangle, Package, TrendingDown, ShoppingCart, Lock } from 'lucide-react';
import { generateStockoutAlerts, StockoutAlert } from '../../services/analyticsService';
import LoadingSpinner from '../common/LoadingSpinner';

interface StockoutAlertsWidgetProps {
  shopId: string;
  isPremium: boolean;
  onUpgrade: () => void;
}

function StockoutAlertsWidget({ shopId, isPremium, onUpgrade }: StockoutAlertsWidgetProps) {
  const [alerts, setAlerts] = useState<StockoutAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, [shopId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await generateStockoutAlerts(shopId, 7);
      setAlerts(data);
    } catch (error) {
      console.error('Error loading stockout alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'from-red-500 to-red-600';
      case 'high':
        return 'from-orange-500 to-orange-600';
      case 'medium':
        return 'from-yellow-500 to-yellow-600';
      default:
        return 'from-blue-500 to-blue-600';
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 border-red-500/50';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/50';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/50';
      default:
        return 'bg-blue-500/10 border-blue-500/50';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </div>
    );
  }

  // Free users see limited preview
  if (!isPremium && alerts.length > 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-400" />
            <h3 className="font-semibold text-white">Stock Alerts</h3>
          </div>
          <div className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded font-medium">
            {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Blurred preview */}
        <div className="space-y-2 filter blur-sm pointer-events-none">
          {alerts.slice(0, 2).map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 ${getPriorityBg(alert.priority)} border rounded-lg`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-white text-sm">{alert.productName}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {alert.currentQuantity} {alert.unit} left • {alert.daysUntilStockout} days
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Lost revenue</p>
                  <p className="font-bold text-red-400 text-sm">
                    KES {alert.estimatedLostRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent flex items-end justify-center pb-4">
          <button
            onClick={onUpgrade}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg flex items-center gap-2 transition-all transform hover:scale-105"
          >
            <Lock size={18} />
            Unlock {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    );
  }

  // Premium users see full details
  if (isPremium && alerts.length > 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-400" />
            <h3 className="font-semibold text-white">Stockout Alerts</h3>
          </div>
          <div className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded font-medium">
            {alerts.length} Active
          </div>
        </div>

        <div className="space-y-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 ${getPriorityBg(alert.priority)} border rounded-lg`}
            >
              {/* Priority badge */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-2 py-0.5 bg-gradient-to-r ${getPriorityColor(
                    alert.priority
                  )} text-white text-xs rounded-full font-semibold uppercase`}
                >
                  {alert.priority}
                </span>
                <span className="text-xs text-gray-400">
                  {alert.daysUntilStockout < 1 ? (
                    <span className="text-red-400 font-bold">OUT OF STOCK</span>
                  ) : (
                    `${alert.daysUntilStockout} days left`
                  )}
                </span>
              </div>

              {/* Product info */}
              <div className="mb-3">
                <h4 className="font-semibold text-white mb-1">{alert.productName}</h4>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Package size={12} />
                    {alert.currentQuantity} {alert.unit} remaining
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingDown size={12} />
                    {alert.averageDailyUsage} {alert.unit}/day
                  </span>
                </div>
              </div>

              {/* Action needed */}
              <div className="bg-gray-900/50 rounded p-2 mb-2">
                <p className="text-xs text-gray-400 mb-1">Recommended Action:</p>
                <p className="text-sm text-white font-medium">
                  <ShoppingCart size={14} className="inline mr-1" />
                  Order {alert.recommendedOrderQuantity} {alert.unit} (2-week supply)
                </p>
              </div>

              {/* Lost revenue warning */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Potential lost revenue:</span>
                <span className="font-bold text-red-400">
                  KES {alert.estimatedLostRevenue.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={loadAlerts}
          className="w-full mt-4 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Refresh Alerts
        </button>
      </div>
    );
  }

  // No alerts
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="text-center">
        <Package size={48} className="mx-auto text-green-400 mb-3" />
        <h3 className="font-semibold text-white mb-2">All Stock Levels Good</h3>
        <p className="text-sm text-gray-400">
          No stockout alerts at this time. We'll notify you when items are running low.
        </p>
      </div>
    </div>
  );
}

export default StockoutAlertsWidget;
