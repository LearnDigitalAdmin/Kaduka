import { useState, useEffect, FormEvent, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAuthStore } from '../store/authStore';
import {
  getSales,
  recordSale,
  deleteSale,
  Sale,
  generateDateCode,
  getCurrentStock,
} from '../services/shopService';
import {
  cacheStockData,
  getCachedStock,
  checkStockAvailability,
  searchStock,
  getStockProductNames,
} from '../services/stockCacheService';
import { Plus, ShoppingCart, Trash2, Calendar, AlertCircle, TrendingUp } from 'lucide-react';
import { getCurrentMonthRange } from '../utils/dateUtils';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';

function SalesPage() {
  const { currentShop, user } = useAuthStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pieces');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [stockValidation, setStockValidation] = useState<{
    available: boolean;
    message: string;
    currentQuantity: number;
  } | null>(null);

  // Autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const productInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filters - Default to current month (1st to today)
  const monthRange = getCurrentMonthRange();
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<{
    avgTransactionValue: number;
    bestProduct: string;
    totalTransactions: number;
    peakHour: number;
  }>({ avgTransactionValue: 0, bestProduct: '', totalTransactions: 0, peakHour: 0 });

  useEffect(() => {
    loadSales();
  }, [currentShop, startDate, endDate]);

  const loadSales = async () => {
    if (!currentShop) return;

    try {
      setLoading(true);

      // Load sales
      const data = await getSales(currentShop.id, startDate, endDate);
      setSales(data);

      // Load and cache stock
      const stock = await getCurrentStock(currentShop.id);
      cacheStockData(currentShop.id, stock);

      // Calculate analytics
      if (data.length > 0) {
        const totalValue = data.reduce((sum, s) => sum + s.totalPrice, 0);
        const avgValue = totalValue / data.length;

        // Find best-selling product
        const productSales: Record<string, number> = {};
        data.forEach((s) => {
          productSales[s.productName] = (productSales[s.productName] || 0) + s.quantity;
        });
        const bestProduct = Object.entries(productSales).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        // Find peak hour
        const hourCounts: Record<number, number> = {};
        data.forEach((s) => {
          const hour = new Date(s.timestamp * 1000).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 0;

        setAnalytics({
          avgTransactionValue: Math.round(avgValue),
          bestProduct,
          totalTransactions: data.length,
          peakHour: parseInt(peakHour as string),
        });
      }
    } catch (error) {
      console.error('Error loading sales:', error);
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const handleProductInput = (value: string) => {
    setProductName(value);
    setStockValidation(null);

    if (value.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const results = searchStock(currentShop!.id, value);
    setSuggestions(results);
    setShowSuggestions(true);
  };

  const handleProductSelect = (productName: string) => {
    setProductName(productName);
    setShowSuggestions(false);
    setSuggestions([]);

    // Validate stock immediately
    const qty = parseFloat(quantity);
    if (!isNaN(qty) && qty > 0) {
      const validation = checkStockAvailability(currentShop!.id, productName, qty);
      setStockValidation(validation);

      if (!validation.available) {
        toast.error(validation.message);
      }
    }
  };

  const handleQuantityChange = (value: string) => {
    setQuantity(value);

    // Re-validate stock when quantity changes
    if (productName.trim() && value) {
      const qty = parseFloat(value);
      if (!isNaN(qty) && qty > 0) {
        const validation = checkStockAvailability(currentShop!.id, productName, qty);
        setStockValidation(validation);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentShop || !user) return;

    if (!productName.trim() || !quantity || !pricePerUnit) {
      toast.error('Please fill in all fields');
      return;
    }

    const qty = parseFloat(quantity);
    const price = parseFloat(pricePerUnit);

    if (isNaN(qty) || qty <= 0) {
      toast.error('Invalid quantity');
      return;
    }

    if (isNaN(price) || price <= 0) {
      toast.error('Invalid price');
      return;
    }

    // Final stock validation
    const validation = checkStockAvailability(currentShop.id, productName, qty);
    if (!validation.available) {
      toast.error(validation.message);
      return;
    }

    try {
      setSaving(true);
      await recordSale(
        currentShop.id,
        productName,
        qty,
        unit,
        price,
        user.phoneNumber || user.email || '',
        startDate
      );

      toast.success('Sale recorded successfully!');
      setShowForm(false);
      resetForm();
      setStockValidation(null);
      loadSales();
    } catch (error) {
      console.error('Error recording sale:', error);
      toast.error('Failed to record sale');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentShop || !saleToDelete) return;

    try {
      const dateCode = generateDateCode(new Date(saleToDelete.timestamp * 1000));
      await deleteSale(currentShop.id, dateCode, saleToDelete.id);
      toast.success('Sale deleted successfully');
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
      loadSales();
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('Failed to delete sale');
    }
  };

  const resetForm = () => {
    setProductName('');
    setQuantity('');
    setUnit('pieces');
    setPricePerUnit('');
  };

  const totalSales = sales.reduce((sum, sale) => sum + sale.totalPrice, 0);

  if (!currentShop) {
    return (
      <div className="p-4">
        <EmptyState
          icon={ShoppingCart}
          title="No Shop Selected"
          description="Please select a shop to view sales"
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Sales</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          New Sale
        </button>
      </div>

      {/* Date Filter */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={20} className="text-gray-400" />
          <h3 className="font-medium text-white">Filter by Date</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-4">
        <p className="text-sm text-gray-400 mb-1">Total Sales</p>
        <p className="text-3xl font-bold text-green-400">
          KSh {totalSales.toLocaleString()}
        </p>
        <p className="text-sm text-gray-400 mt-1">{sales.length} transactions</p>
      </div>

      {/* Sales Analytics */}
      {sales.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400">Avg Transaction</p>
            <p className="text-lg font-bold text-blue-400">KSh {analytics.avgTransactionValue.toLocaleString()}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400">Best Product</p>
            <p className="text-lg font-bold text-green-400">{analytics.bestProduct}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400">Peak Hour</p>
            <p className="text-lg font-bold text-amber-400">{analytics.peakHour}:00</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-400">Total Transactions</p>
            <p className="text-lg font-bold text-purple-400">{analytics.totalTransactions}</p>
          </div>
        </div>
      )}

      {/* New Sale Form */}
      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-white mb-4">Record New Sale</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <label className="block text-sm text-gray-400 mb-1">Product Name</label>
              <input
                ref={productInputRef}
                type="text"
                value={productName}
                onChange={(e) => handleProductInput(e.target.value)}
                onFocus={() => productName && setShowSuggestions(true)}
                placeholder="e.g., Milk - type to search"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
                autoComplete="off"
              />

              
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg z-10 max-h-48 overflow-y-auto"
                >
                  {suggestions.map((product: any, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleProductSelect(Object.keys({ [Object.keys({ ...product })[0]]: product })[0])}
                      className="w-full text-left px-3 py-2 hover:bg-gray-600 text-white flex items-center justify-between border-b border-gray-600 last:border-b-0"
                    >
                      <span>{Object.keys({ ...product })[0]}</span>
                      <span className="text-xs text-gray-400">{product.quantity} {product.unit}</span>
                    </button>
                  ))}
                </div>
              )} 

              {/* Stock Validation Message */}
              {stockValidation && (
                <div
                  className={`mt-2 p-2 rounded text-sm flex items-center gap-2 ${
                    stockValidation.available ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {stockValidation.available ? '✓' : '✕'} {stockValidation.message}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="10"
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

            <div>
              <label className="block text-sm text-gray-400 mb-1">Price per Unit (KSh)</label>
              <input
                type="number"
                step="0.01"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                placeholder="50"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
            </div>

            {quantity && pricePerUnit && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-gray-400">Total Amount</p>
                <p className="text-xl font-bold text-blue-400">
                  KSh {(parseFloat(quantity) * parseFloat(pricePerUnit)).toLocaleString()}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Saving...
                  </>
                ) : (
                  'Record Sale'
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

      {/* Sales List */}
      <div>
        <h3 className="font-semibold text-white mb-3">Sales History</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : sales.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <EmptyState
              icon={ShoppingCart}
              title="No Sales Found"
              description="Record your first sale to get started"
            />
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
            {sales.map((sale) => (
              <div key={sale.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-white mb-1">{sale.productName}</p>
                    <p className="text-sm text-gray-400">
                      {sale.quantity} {sale.unit} × KSh {sale.pricePerUnit.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(sale.timestamp * 1000).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-green-400">
                        KSh {sale.totalPrice.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSaleToDelete(sale);
                        setDeleteDialogOpen(true);
                      }}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Sale"
        message={`Are you sure you want to delete this sale of ${saleToDelete?.productName}?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSaleToDelete(null);
        }}
        variant="danger"
      />
    </div>
  );
}

export default SalesPage;
