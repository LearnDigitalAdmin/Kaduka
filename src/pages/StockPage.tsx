import { useState, useEffect, FormEvent } from 'react';
import { toast } from 'react-toastify';
import { useAuthStore } from '../store/authStore';
import { getCurrentStock, getStockForDate, addStock, Stock } from '../services/shopService';
import { categorizeStock, getStockStatistics } from '../services/stockCacheService';
import { Plus, Package, Edit2, Calendar, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

interface StockItem {
  productName: string;
  quantity: number;
  unit: string;
  lastUpdated: number;
}

interface StockAnalytics {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  fastMovingItems: number;
  slowMovingItems: number;
  staleItems: number;
  overstockItems: number;
}

interface StockCategory {
  category: 'fast-moving' | 'slow-moving' | 'low-stock' | 'overstock' | 'stale' | 'optimal';
  products: string[];
  count: number;
}

function StockPage() {
  const { currentShop, user } = useAuthStore();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [analytics, setAnalytics] = useState<StockAnalytics | null>(null);
  const [categorized, setCategorized] = useState<Record<string, any[]>>({});

  // Form fields
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pieces');
  const [editingProduct, setEditingProduct] = useState<string | null>(null);

  // Date for stock
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadStock();
  }, [currentShop, stockDate]);

  const loadStock = async () => {
    if (!currentShop) return;

    try {
      setLoading(true);
      // Use getStockForDate if stockDate is specified, otherwise use today's stock
      const isToday = stockDate === new Date().toISOString().split('T')[0];
      const data = isToday
        ? await getCurrentStock(currentShop.id)
        : await getStockForDate(currentShop.id, stockDate);

      const stockArray: StockItem[] = Object.entries(data).map(([name, details]: any) => ({
        productName: name,
        quantity: details.quantity,
        unit: details.unit,
        lastUpdated: details.lastUpdated as any as number || Date.now() / 1000,
      }));

      setStock(stockArray.sort((a, b) => a.productName.localeCompare(b.productName)));

      // Calculate analytics only for today's stock
      if (isToday) {
        try {
          const stats = getStockStatistics(currentShop.id);
          setAnalytics({
            totalItems: stats.totalItems,
            lowStockItems: stats.lowStockItems,
            outOfStockItems: stats.outOfStockItems,
            fastMovingItems: stats.fastMovingItems,
            slowMovingItems: stats.slowMovingItems,
            staleItems: stats.staleItems,
            overstockItems: stats.overstockItems,
          });

          // Categorize stock
          const categorized = categorizeStock(currentShop.id, 30);
          setCategorized(categorized);
        } catch (error) {
          console.warn('Analytics not available:', error);
        }
      }
    } catch (error) {
      console.error('Error loading stock:', error);
      toast.error('Failed to load stock');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentShop || !user) return;

    if (!productName.trim() || !quantity) {
      toast.error('Please fill in all fields');
      return;
    }

    const qty = parseFloat(quantity);

    if (isNaN(qty) || qty < 0) {
      toast.error('Invalid quantity');
      return;
    }

    try {
      setSaving(true);
      const userPhone = user.phoneNumber || user.email || '';
      await addStock(currentShop.id, productName, qty, unit, userPhone, stockDate);

      toast.success(
        editingProduct ? 'Stock updated successfully!' : 'Stock added successfully!'
      );
      setShowForm(false);
      setEditingProduct(null);
      resetForm();
      loadStock();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: StockItem) => {
    setProductName(item.productName);
    setQuantity(item.quantity.toString());
    setUnit(item.unit);
    setEditingProduct(item.productName);
    setShowForm(true);
  };

  const resetForm = () => {
    setProductName('');
    setQuantity('');
    setUnit('pieces');
    setEditingProduct(null);
  };

  const totalItems = stock.length;
  const lowStockItems = stock.filter((item) => item.quantity < 10).length;

  if (!currentShop) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Package}
          title="No Shop Selected"
          description="Please select a shop to view stock"
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Stock Management</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) resetForm();
          }}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Add Stock
        </button>
      </div>

      {/* Date Selector */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={20} className="text-gray-400" />
          <h3 className="font-medium text-white">Stock Date</h3>
        </div>
        <input
          type="date"
          value={stockDate}
          onChange={(e) => setStockDate(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-2">
          Showing stock for {new Date(stockDate).toLocaleDateString()}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Items */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Total Items</p>
          <p className="text-2xl font-bold text-blue-400">{stock.length}</p>
        </div>

        {/* Low Stock */}
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-400">{analytics?.lowStockItems || 0}</p>
        </div>

        {/* Out of Stock */}
        <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Out of Stock</p>
          <p className="text-2xl font-bold text-red-400">{analytics?.outOfStockItems || 0}</p>
        </div>

        {/* Fast Moving */}
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Fast Moving</p>
          <p className="text-2xl font-bold text-green-400">{analytics?.fastMovingItems || 0}</p>
        </div>

        {/* Slow Moving */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Slow Moving</p>
          <p className="text-2xl font-bold text-purple-400">{analytics?.slowMovingItems || 0}</p>
        </div>

        {/* Overstock */}
        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Overstock</p>
          <p className="text-2xl font-bold text-cyan-400">{analytics?.overstockItems || 0}</p>
        </div>

        {/* Stale */}
        <div className="bg-gradient-to-br from-gray-600/10 to-gray-700/5 border border-gray-600/20 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Stale Items</p>
          <p className="text-2xl font-bold text-gray-400">{analytics?.staleItems || 0}</p>
        </div>

        {/* Optimal */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Optimal Stock</p>
          <p className="text-2xl font-bold text-emerald-400">
            {stock.length - (analytics?.lowStockItems || 0) - (analytics?.outOfStockItems || 0) - (analytics?.staleItems || 0) || 0}
          </p>
        </div>
      </div>

      {/* Add/Edit Stock Form */}
      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-white mb-4">
            {editingProduct ? 'Update Stock' : 'Add New Stock'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Product Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Milk"
                disabled={!!editingProduct || saving}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              {editingProduct && (
                <p className="text-xs text-gray-400 mt-1">
                  Product name cannot be changed when editing
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                >
                  <option value="pieces">Pieces</option>
                  <option value="kg">Kilograms</option>
                  <option value="liters">Liters</option>
                  <option value="packets">Packets</option>
                  <option value="boxes">Boxes</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {editingProduct ? 'Updating...' : 'Adding...'}
                  </>
                ) : editingProduct ? (
                  'Update Stock'
                ) : (
                  'Add Stock'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Categories Summary */}
      {stock.length > 0 && Object.keys(categorized).length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-white mb-3">Stock Categories</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {categorized['fast-moving'] && categorized['fast-moving'].length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded">
                <TrendingUp size={16} className="text-green-400" />
                <span className="text-green-400">{categorized['fast-moving'].length} Fast-Moving</span>
              </div>
            )}
            {categorized['slow-moving'] && categorized['slow-moving'].length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded">
                <TrendingDown size={16} className="text-purple-400" />
                <span className="text-purple-400">{categorized['slow-moving'].length} Slow-Moving</span>
              </div>
            )}
            {categorized['low-stock'] && categorized['low-stock'].length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded">
                <AlertCircle size={16} className="text-yellow-400" />
                <span className="text-yellow-400">{categorized['low-stock'].length} Low Stock</span>
              </div>
            )}
            {categorized['stale'] && categorized['stale'].length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-gray-600/10 rounded">
                <Package size={16} className="text-gray-400" />
                <span className="text-gray-400">{categorized['stale'].length} Stale</span>
              </div>
            )}
            {categorized['overstock'] && categorized['overstock'].length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-cyan-500/10 rounded">
                <Package size={16} className="text-cyan-400" />
                <span className="text-cyan-400">{categorized['overstock'].length} Overstock</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock List */}
      <div>
        <h3 className="font-semibold text-white mb-3">Current Stock</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : stock.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <EmptyState
              icon={Package}
              title="No Stock Items"
              description="Add your first stock item to get started"
            />
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
            {stock.map((item) => {
              // Determine status
              let status = 'optimal';
              let statusIcon = <CheckCircle size={16} />;
              let statusColor = 'text-green-400';
              let statusBg = 'bg-green-500/10';

              if (item.quantity === 0) {
                status = 'out-of-stock';
                statusIcon = <AlertCircle size={16} />;
                statusColor = 'text-red-400';
                statusBg = 'bg-red-500/10';
              } else if (item.quantity < 10) {
                status = 'low-stock';
                statusIcon = <AlertCircle size={16} />;
                statusColor = 'text-yellow-400';
                statusBg = 'bg-yellow-500/10';
              } else if (item.quantity > 100) {
                status = 'overstock';
                statusIcon = <TrendingUp size={16} />;
                statusColor = 'text-cyan-400';
                statusBg = 'bg-cyan-500/10';
              }

              // Calculate days in stock
              const lastUpdated = new Date(item.lastUpdated * 1000);
              const today = new Date();
              const daysInStock = Math.floor(
                (today.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
              );

              const isStale = daysInStock > 60;

              return (
                <div key={item.productName} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-white">{item.productName}</p>
                        <span className={`px-2 py-0.5 ${statusBg} ${statusColor} text-xs rounded flex items-center gap-1`}>
                          {statusIcon}
                          {status === 'out-of-stock'
                            ? 'Out of Stock'
                            : status === 'low-stock'
                            ? 'Low Stock'
                            : status === 'overstock'
                            ? 'Overstock'
                            : 'Optimal'}
                        </span>
                        {isStale && (
                          <span className="px-2 py-0.5 bg-gray-600/20 text-gray-400 text-xs rounded">
                            Stale
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Quantity</p>
                          <p className="text-gray-300">
                            {item.quantity} {item.unit}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Last Updated</p>
                          <p className="text-gray-300">{daysInStock}d ago</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Last Modified</p>
                          <p className="text-gray-300 text-xs">
                            {lastUpdated.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default StockPage;
