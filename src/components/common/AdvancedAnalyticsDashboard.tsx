import { Clock, Calendar, TrendingUp, Award } from 'lucide-react';
import {
  PeakHourAnalysis,
  DayPerformance,
  ProductPerformance,
} from '../../services/insightsService';

interface AdvancedAnalyticsDashboardProps {
  peakHours: PeakHourAnalysis[];
  dayPerformance: DayPerformance[];
  productScores: ProductPerformance[];
}

function AdvancedAnalyticsDashboard({
  peakHours,
  dayPerformance,
  productScores,
}: AdvancedAnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Peak Hours Analysis */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={24} className="text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Peak Hours Analysis</h3>
            <p className="text-sm text-gray-400">Optimize staffing and inventory by hour</p>
          </div>
        </div>

        <div className="space-y-2">
          {peakHours.slice(0, 5).map((hour, idx) => (
            <div key={hour.hour} className="flex items-center gap-3">
              <div
                className={`px-3 py-2 rounded-lg font-bold ${
                  idx === 0
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : idx === 1
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {hour.hour}:00
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">
                    {hour.salesCount} transactions
                  </span>
                  <span className="text-sm font-semibold text-white">
                    KES {hour.revenue.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      idx === 0
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : idx === 1
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                        : 'bg-gray-600'
                    }`}
                    style={{ width: `${hour.percentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{hour.percentage}% of sales</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300">
            <strong>💡 Recommendation:</strong> Schedule your best staff during{' '}
            {peakHours[0]?.hour}:00-{(peakHours[0]?.hour || 0) + 1}:00 and ensure adequate
            stock levels.
          </p>
        </div>
      </div>

      {/* Day-of-Week Performance */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={24} className="text-purple-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Day-of-Week Performance</h3>
            <p className="text-sm text-gray-400">Identify best and worst days</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dayPerformance.map((day, idx) => {
            const isTopDay = idx === 0;
            const isBottomDay = idx === dayPerformance.length - 1;

            return (
              <div
                key={day.day}
                className={`p-4 rounded-lg border ${
                  isTopDay
                    ? 'bg-green-500/10 border-green-500/30'
                    : isBottomDay
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-gray-700/50 border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{day.day}</span>
                  {isTopDay && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">BEST</span>}
                  {isBottomDay && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">WORST</span>}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Revenue</span>
                    <span className="font-semibold text-white">
                      KES {day.sales.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Transactions</span>
                    <span className="text-gray-300">{day.transactions}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Avg Transaction</span>
                    <span className="text-gray-300">
                      KES {day.averageTransaction.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {dayPerformance.length >= 2 && (
          <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-sm text-purple-300">
              <strong>💡 Recommendation:</strong> Run promotions on{' '}
              {dayPerformance[dayPerformance.length - 1]?.day} to boost sales. Consider
              "Flash Sale" or "Special Discount Day" strategies.
            </p>
          </div>
        )}
      </div>

      {/* Product Performance Scoring */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award size={24} className="text-yellow-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Product Performance Scores</h3>
            <p className="text-sm text-gray-400">Top and bottom performers</p>
          </div>
        </div>

        {/* Top performers */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-green-400 mb-3 uppercase tracking-wide">
            🏆 Top Performers
          </h4>
          <div className="space-y-2">
            {productScores.slice(0, 5).map((product, idx) => (
              <div
                key={product.name}
                className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white text-sm">{product.name}</span>
                    <span className="text-xs font-bold text-green-400">
                      Score: {product.score}/100
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Revenue: KES {product.revenue.toLocaleString()}</span>
                    <span>Velocity: {product.velocity}/day</span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        product.trend === 'rising'
                          ? 'bg-green-500/20 text-green-400'
                          : product.trend === 'declining'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-600 text-gray-300'
                      }`}
                    >
                      {product.trend === 'rising' ? '📈' : product.trend === 'declining' ? '📉' : '➡️'}{' '}
                      {product.trend}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom performers */}
        {productScores.length > 5 && (
          <div>
            <h4 className="text-sm font-semibold text-red-400 mb-3 uppercase tracking-wide">
              ⚠️ Need Attention
            </h4>
            <div className="space-y-2">
              {productScores.slice(-3).reverse().map((product) => (
                <div
                  key={product.name}
                  className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                    ⚠️
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-white text-sm">{product.name}</span>
                      <span className="text-xs font-bold text-red-400">
                        Score: {product.score}/100
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>Revenue: KES {product.revenue.toLocaleString()}</span>
                      <span>Velocity: {product.velocity}/day</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-300">
                <strong>💡 Recommendation:</strong> Consider clearance sales for low-scoring
                products or replace them with better alternatives.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-400 mb-1">{peakHours.length}</div>
          <div className="text-xs text-gray-400">Active Hours</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-purple-400 mb-1">{dayPerformance.length}</div>
          <div className="text-xs text-gray-400">Trading Days</div>
        </div>
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-400 mb-1">{productScores.length}</div>
          <div className="text-xs text-gray-400">Products Analyzed</div>
        </div>
      </div>
    </div>
  );
}

export default AdvancedAnalyticsDashboard;
