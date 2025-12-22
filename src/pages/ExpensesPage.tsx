import { useState, useEffect, FormEvent } from 'react';
import { toast } from 'react-toastify';
import { useAuthStore } from '../store/authStore';
import { getExpenses, recordExpense, deleteExpense, Expense, generateDateCode } from '../services/shopService';
import { Plus, TrendingDown, Trash2, Calendar } from 'lucide-react';
import { getCurrentMonthRange } from '../utils/dateUtils';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Supplies',
  'Transport',
  'Marketing',
  'Maintenance',
  'Other',
];

function ExpensesPage() {
  const { currentShop, user } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [category, setCategory] = useState('Other');
  const [amount, setAmount] = useState('');

  // Filters - Default to current month (1st to today)
  const monthRange = getCurrentMonthRange();
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  useEffect(() => {
    loadExpenses();
  }, [currentShop, startDate, endDate]);

  const loadExpenses = async () => {
    if (!currentShop) return;

    try {
      setLoading(true);
      const data = await getExpenses(currentShop.id, startDate, endDate);
      setExpenses(data);
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentShop || !user) return;

    if (!category.trim() || !amount) {
      toast.error('Please fill in all fields');
      return;
    }

    const expenseAmount = parseFloat(amount);

    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    try {
      setSaving(true);
      await recordExpense(
        currentShop.id,
        category,
        expenseAmount,
        user.phoneNumber || user.email || '',
        startDate
      );

      toast.success('Expense recorded successfully!');
      setShowForm(false);
      resetForm();
      loadExpenses();
    } catch (error) {
      console.error('Error recording expense:', error);
      toast.error('Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentShop || !expenseToDelete) return;

    try {
      const dateCode = generateDateCode(new Date(expenseToDelete.timestamp * 1000));
      await deleteExpense(currentShop.id, dateCode, expenseToDelete.id);
      toast.success('Expense deleted successfully');
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
      loadExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    }
  };

  const resetForm = () => {
    setCategory('Other');
    setAmount('');
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Group expenses by category
  const expensesByCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  if (!currentShop) {
    return (
      <div className="p-4">
        <EmptyState
          icon={TrendingDown}
          title="No Shop Selected"
          description="Please select a shop to view expenses"
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Expenses</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          New Expense
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
      <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg p-4">
        <p className="text-sm text-gray-400 mb-1">Total Expenses</p>
        <p className="text-3xl font-bold text-red-400">
          KSh {totalExpenses.toLocaleString()}
        </p>
        <p className="text-sm text-gray-400 mt-1">{expenses.length} transactions</p>
      </div>

      {/* Category Breakdown */}
      {Object.keys(expensesByCategory).length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-white mb-3">By Category</h3>
          <div className="space-y-2">
            {Object.entries(expensesByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-gray-400">{cat}</span>
                  <span className="font-medium text-white">
                    KSh {amt.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* New Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-white mb-4">Record New Expense</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (KSh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Saving...
                    </>
                  ) : (
                    'Record Expense'
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
        </div>
      )}

      {/* Expenses List */}
      <div>
        <h3 className="font-semibold text-white mb-3">Expense History</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <EmptyState
              icon={TrendingDown}
              title="No Expenses Found"
              description="Record your first expense to get started"
            />
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
            {expenses.map((expense) => (
              <div key={expense.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-white mb-1">{expense.category}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(expense.timestamp * 1000).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-red-400">
                        KSh {expense.amount.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setExpenseToDelete(expense);
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
        title="Delete Expense"
        message={`Are you sure you want to delete this ${expenseToDelete?.category} expense?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setExpenseToDelete(null);
        }}
        variant="danger"
      />
    </div>
  );
}

export default ExpensesPage;