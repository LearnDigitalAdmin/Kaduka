import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getSales, getExpenses, Sale, Expense } from '../services/shopService';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

interface DashboardStats {
  todaySales: number;
  todayExpenses: number;
  todayProfit: number;
  salesCount: number;
}

function HomePage() {
  const { currentShop, user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayExpenses: 0,
    todayProfit: 0,
    salesCount: 0,
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [currentShop]);

  const loadDashboardData = async () => {
    if (!currentShop) return;

    try {
      setLoading(true);

      const today = new Date().toISOString().split('T')[0];
      const [salesData, expensesData] = await Promise.all([
        getSales(currentShop.id, today, today),
        getExpenses(currentShop.id, today, today),
      ]);

      const totalSales = salesData.reduce((sum, sale) => sum + sale.totalPrice, 0);
      const totalExpenses = expensesData.reduce((sum, exp) => sum + exp.amount, 0);

      setStats({
        todaySales: totalSales,
        todayExpenses: totalExpenses,
        todayProfit: totalSales - totalExpenses,
        salesCount: salesData.length,
      });

      setRecentSales(salesData.slice(0, 5));
      setRecentExpenses(expensesData.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentShop) {
    return (
      <div className="p-4">
        <EmptyState
          icon={AlertCircle}
          title="No Shop Selected"
          description="Please create or select a shop to continue"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">
          Welcome back, {currentShop.ownerName}!
        </h2>
        <p className="text-gray-400 text-sm">Here's your shop summary for today</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sales Card */}
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp size={20} className="text-green-400" />
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Today's Sales</p>
          <p className="text-2xl font-bold text-white">KSh {stats.todaySales.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{stats.salesCount} transactions</p>
        </div>

        {/* Expenses Card */}
        <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingDown size={20} className="text-red-400" />
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Today's Expenses</p>
          <p className="text-2xl font-bold text-white">KSh {stats.todayExpenses.toLocaleString()}</p>
        </div>

        {/* Profit Card - Full Width */}
        <div className="col-span-2 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Today's Profit</p>
              <p className={`text-3xl font-bold ${
                stats.todayProfit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                KSh {stats.todayProfit.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <DollarSign size={32} className="text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Recent Sales</h3>
          <ShoppingCart size={20} className="text-gray-400" />
        </div>

        {recentSales.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <EmptyState
              icon={ShoppingCart}
              title="No Sales Today"
              description="Record your first sale to see it here"
            />
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
            {recentSales.map((sale) => (
              <div key={sale.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-white">{sale.productName}</p>
                    <p className="text-sm text-gray-400">
                      {sale.quantity} {sale.unit} @ KSh {sale.pricePerUnit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-400">
                      KSh {sale.totalPrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(sale.timestamp * 1000).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Expenses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Recent Expenses</h3>
          <TrendingDown size={20} className="text-gray-400" />
        </div>

        {recentExpenses.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <EmptyState
              icon={TrendingDown}
              title="No Expenses Today"
              description="Record expenses to track your spending"
            />
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
            {recentExpenses.map((expense) => (
              <div key={expense.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-white">{expense.category}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(expense.timestamp * 1000).toLocaleTimeString()}
                    </p>
                  </div>
                  <p className="font-semibold text-red-400">
                    KSh {expense.amount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;
