import { db } from './firebaseService';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';

export interface Shop {
  id: string;
  ownerName: string;
  shopName: string;
  location: string;
  totalEmployees: number;
  nationalId: string;
  phone: string;
  email: string;
  businessType: string;
  createdAt: number;
  createdVia: 'whatsapp' | 'cyber' | 'app';
  status: 'active' | 'suspended' | 'pending';
  firebaseUid?: string;
  lastLogin?: number;
  loginCount?: number;
  isAuthSetup?: boolean;
  paymentAccount?: any;
}

export interface Sale {
  id: string;
  shopId: string;
  productName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
  timestamp: number;
  createdVia: 'whatsapp' | 'cyber' | 'app';
  userPhone: string;
}

export interface Expense {
  id: string;
  shopId: string;
  category: string;
  amount: number;
  timestamp: number;
  createdVia: 'whatsapp' | 'cyber' | 'app';
  userPhone: string;
}

export interface StockRecord {
  quantity: number;
  unit: string;
  lastUpdated: number;
  updatedVia: 'whatsapp' | 'cyber' | 'app';
  history: Array<{
    change: number;
    type: 'add' | 'sold' | 'edit';
    timestamp: number;
    amount?: number;
  }>;
}

export interface Stock {
  [productName: string]: StockRecord;
}

export interface DailySummary {
  shopId: string;
  dateCode: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
  lastUpdated: number;
}

/**
 * Generate date code in DDMMYYYY format
 * Example: November 24, 2025 → "24112025"
 */
export const generateDateCode = (date: Date = new Date()): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
};

/**
 * Parse DDMMYYYY date code to Date object
 */
export const parseDateCode = (dateCode: string): Date => {
  const day = parseInt(dateCode.substring(0, 2), 10);
  const month = parseInt(dateCode.substring(2, 4), 10) - 1;
  const year = parseInt(dateCode.substring(4, 8), 10);
  return new Date(year, month, day);
};

/**
 * Search for a shop by shopId or national ID
 */
export const getShop = async (searchTerm: string): Promise<Shop | null> => {
  try {
    // First try to find by shopId
    const shopRef = doc(collection(db, 'shops'), searchTerm);
    const shopSnap = await getDoc(shopRef);

    if (shopSnap.exists()) {
      return {
        id: shopSnap.id,
        ...shopSnap.data(),
      } as Shop;
    }

    // Then try to find by national ID
    const q = query(
      collection(db, 'shops'),
      where('nationalId', '==', searchTerm)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as Shop;
    }

    return null;
  } catch (error) {
    console.error('Error searching for shop:', error);
    throw error;
  }
};

/**
 * Get all shops for a user
 */
export const getUserShops = async (firebaseUid: string): Promise<Shop[]> => {
  try {
    const q = query(
      collection(db, 'shops'),
      where('firebaseUid', '==', firebaseUid)
    );

    const querySnapshot = await getDocs(q);
    const shops: Shop[] = [];

    querySnapshot.forEach((doc) => {
      shops.push({
        id: doc.id,
        ...doc.data(),
      } as Shop);
    });

    return shops;
  } catch (error) {
    console.error('Error fetching user shops:', error);
    throw error;
  }
};

/**
 * Create or update a shop
 */
export const createShop = async (shopData: Partial<Shop>): Promise<string> => {
  try {
    const shopId = shopData.id || doc(collection(db, 'shops')).id;
    const shop: Shop = {
      id: shopId,
      ownerName: shopData.ownerName || '',
      shopName: shopData.shopName || '',
      location: shopData.location || '',
      totalEmployees: shopData.totalEmployees || 0,
      nationalId: shopData.nationalId || '',
      phone: shopData.phone || '',
      email: shopData.email || '',
      businessType: shopData.businessType || '',
      createdAt: shopData.createdAt || Math.floor(Date.now() / 1000),
      createdVia: shopData.createdVia || 'app',
      status: shopData.status || 'pending',
      firebaseUid: shopData.firebaseUid,
      isAuthSetup: shopData.isAuthSetup || false,
    };

    await setDoc(doc(db, 'shops', shopId), shop);
    return shopId;
  } catch (error) {
    console.error('Error creating shop:', error);
    throw error;
  }
};

/**
 * Record a sale
 * Stores in shops/{shopId}/sales/{dateCode}/transactions/{saleId}
 * Also updates stock and daily summary atomically
 */
export const recordSale = async (
  shopId: string,
  productName: string,
  quantity: number,
  unit: string,
  pricePerUnit: number,
  userPhone: string,
  date?: string
): Promise<Sale> => {
  try {
    const totalPrice = quantity * pricePerUnit;
    // ALWAYS use current time for transaction timestamp, never use filter date
    // Filter date is only for UI, not for recording actual transaction time
    const timestamp = Math.floor(Date.now() / 1000);
    const dateCode = generateDateCode();
    const saleId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const sale: Sale = {
      id: saleId,
      shopId,
      productName: productName.toLowerCase().trim(),
      quantity,
      unit,
      pricePerUnit,
      totalPrice,
      timestamp,
      createdVia: 'app',
      userPhone,
    };

    // Atomic transaction: update sales, stock, and summary
    await runTransaction(db, async (transaction) => {
      const salesDocRef = doc(db, 'shops', shopId, 'sales', dateCode);
      const stockDocRef = doc(db, 'shops', shopId, 'stocks', 'inventory');
      const summaryDocRef = doc(db, 'shops', shopId, 'summaries', dateCode);

      // Read current data
      const salesSnap = await transaction.get(salesDocRef);
      const stockSnap = await transaction.get(stockDocRef);
      const summarySnap = await transaction.get(summaryDocRef);

      // Update sales - add to transactions map
      const salesData = salesSnap.exists() ? salesSnap.data() : { transactions: {} };
      salesData.transactions[saleId] = sale;
      transaction.set(salesDocRef, salesData, { merge: true });

      // Update stock - decrease quantity
      const stockData = stockSnap.exists() ? stockSnap.data() : {};
      if (stockData[productName]) {
        const newQuantity = Math.max(0, stockData[productName].quantity - quantity);
        stockData[productName].quantity = newQuantity;
        stockData[productName].lastUpdated = timestamp;
        if (!stockData[productName].history) {
          stockData[productName].history = [];
        }
        stockData[productName].history.push({
          change: -quantity,
          type: 'sold',
          timestamp,
          amount: totalPrice,
        });
      }
      transaction.set(stockDocRef, stockData, { merge: true });

      // Update summary
      const summaryData = summarySnap.exists() ? summarySnap.data() : {
        shopId,
        dateCode,
        totalSales: 0,
        totalExpenses: 0,
        profit: 0,
        transactionCount: 0,
        lastUpdated: timestamp,
      };
      summaryData.totalSales = (summaryData.totalSales || 0) + totalPrice;
      summaryData.profit = summaryData.totalSales - summaryData.totalExpenses;
      summaryData.transactionCount = (summaryData.transactionCount || 0) + 1;
      summaryData.lastUpdated = timestamp;
      transaction.set(summaryDocRef, summaryData, { merge: true });
    });

    return sale;
  } catch (error) {
    console.error('Error recording sale:', error);
    throw error;
  }
};

/**
 * Record an expense
 * Stores in shops/{shopId}/expenses/{dateCode}/transactions/{expenseId}
 * Also updates daily summary atomically
 */
export const recordExpense = async (
  shopId: string,
  category: string,
  amount: number,
  userPhone: string,
  date?: string
): Promise<Expense> => {
  try {
    // ALWAYS use current time for transaction timestamp, never use filter date
    // Filter date is only for UI, not for recording actual transaction time
    const timestamp = Math.floor(Date.now() / 1000);
    const dateCode = generateDateCode();
    const expenseId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const expense: Expense = {
      id: expenseId,
      shopId,
      category: category.toLowerCase().trim(),
      amount: Math.floor(amount),
      timestamp,
      createdVia: 'app',
      userPhone,
    };

    // Atomic transaction: update expenses and summary
    await runTransaction(db, async (transaction) => {
      const expensesDocRef = doc(db, 'shops', shopId, 'expenses', dateCode);
      const summaryDocRef = doc(db, 'shops', shopId, 'summaries', dateCode);

      // Read current data
      const expensesSnap = await transaction.get(expensesDocRef);
      const summarySnap = await transaction.get(summaryDocRef);

      // Update expenses - add to transactions map
      const expensesData = expensesSnap.exists() ? expensesSnap.data() : { transactions: {} };
      expensesData.transactions[expenseId] = expense;
      transaction.set(expensesDocRef, expensesData, { merge: true });

      // Update summary
      const summaryData = summarySnap.exists() ? summarySnap.data() : {
        shopId,
        dateCode,
        totalSales: 0,
        totalExpenses: 0,
        profit: 0,
        transactionCount: 0,
        lastUpdated: timestamp,
      };
      summaryData.totalExpenses = (summaryData.totalExpenses || 0) + expense.amount;
      summaryData.profit = summaryData.totalSales - summaryData.totalExpenses;
      summaryData.transactionCount = (summaryData.transactionCount || 0) + 1;
      summaryData.lastUpdated = timestamp;
      transaction.set(summaryDocRef, summaryData, { merge: true });
    });

    return expense;
  } catch (error) {
    console.error('Error recording expense:', error);
    throw error;
  }
};

/**
 * Add stock for a product
 * Stores in shops/{shopId}/stocks/{dateCode}
 */
export const addStock = async (
  shopId: string,
  productName: string,
  quantity: number,
  unit: string,
  userPhone: string,
  date?: string
): Promise<void> => {
  try {
    const timestamp = date ? Math.floor(new Date(date).getTime() / 1000) : Math.floor(Date.now() / 1000);
    const dateCode = date ? generateDateCode(new Date(date)) : generateDateCode();

    await runTransaction(db, async (transaction) => {
      const stockDocRef = doc(db, 'shops', shopId, 'stocks', 'inventory');
      const summaryDocRef = doc(db, 'shops', shopId, 'summaries', dateCode);

      const stockSnap = await transaction.get(stockDocRef);
      const summarySnap = await transaction.get(summaryDocRef);

      const stockData = stockSnap.exists() ? stockSnap.data() : {};
      const normalizedProductName = productName.toLowerCase().trim();

      if (!stockData[normalizedProductName]) {
        stockData[normalizedProductName] = {
          quantity: 0,
          unit,
          lastUpdated: timestamp,
          updatedVia: 'app',
          history: [],
        };
      }

      stockData[normalizedProductName].quantity += quantity;
      stockData[normalizedProductName].lastUpdated = timestamp;
      stockData[normalizedProductName].updatedVia = 'app';
      stockData[normalizedProductName].history.push({
        change: quantity,
        type: 'add',
        timestamp,
      });

      transaction.set(stockDocRef, stockData, { merge: true });

      // Update summary
      const summaryData = summarySnap.exists() ? summarySnap.data() : {
        shopId,
        dateCode,
        totalSales: 0,
        totalExpenses: 0,
        profit: 0,
        transactionCount: 0,
        lastUpdated: timestamp,
      };
      summaryData.transactionCount = (summaryData.transactionCount || 0) + 1;
      summaryData.lastUpdated = timestamp;
      transaction.set(summaryDocRef, summaryData, { merge: true });
    });
  } catch (error) {
    console.error('Error adding stock:', error);
    throw error;
  }
};

/**
 * Get sales for a date range
 * Queries shops/{shopId}/sales/{dateCode}/transactions
 */
export const getSales = async (
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<Sale[]> => {
  try {
    // Parse dates in local time, not UTC
    // "2025-11-01" should be Nov 1 00:00 local time, not Nov 1 00:00 UTC
    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const start = startDate ? parseLocalDate(startDate) : new Date();
    const end = endDate ? parseLocalDate(endDate) : new Date();

    const sales: Sale[] = [];

    // Get all sales documents for the shop
    const salesCollectionRef = collection(db, 'shops', shopId, 'sales');
    const querySnapshot = await getDocs(salesCollectionRef);

    querySnapshot.forEach((doc) => {
      const dateCode = doc.id;
      const date = parseDateCode(dateCode);

      // Check if date is within range
      if (date >= start && date <= end) {
        const salesData = doc.data();
        if (salesData.transactions) {
          Object.values(salesData.transactions).forEach((transaction: any) => {
            sales.push(transaction as Sale);
          });
        }
      }
    });

    return sales.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching sales:', error);
    throw error;
  }
};

/**
 * Get expenses for a date range
 * Queries shops/{shopId}/expenses/{dateCode}/transactions
 */
export const getExpenses = async (
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<Expense[]> => {
  try {
    // Parse dates in local time, not UTC
    // "2025-11-01" should be Nov 1 00:00 local time, not Nov 1 00:00 UTC
    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const start = startDate ? parseLocalDate(startDate) : new Date();
    const end = endDate ? parseLocalDate(endDate) : new Date();

    const expenses: Expense[] = [];

    // Get all expenses documents for the shop
    const expensesCollectionRef = collection(db, 'shops', shopId, 'expenses');
    const querySnapshot = await getDocs(expensesCollectionRef);

    querySnapshot.forEach((doc) => {
      const dateCode = doc.id;
      const date = parseDateCode(dateCode);

      // Check if date is within range
      if (date >= start && date <= end) {
        const expensesData = doc.data();
        if (expensesData.transactions) {
          Object.values(expensesData.transactions).forEach((transaction: any) => {
            expenses.push(transaction as Expense);
          });
        }
      }
    });

    return expenses.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }
};

/**
 * Get current stock for a shop
 * Reads shops/{shopId}/stocks (single document with all products)
 */
export const getCurrentStock = async (shopId: string): Promise<Stock> => {
  try {
    const stockRef = doc(db, 'shops', shopId, 'stocks', 'inventory');
    const stockSnap = await getDoc(stockRef);

    if (stockSnap.exists()) {
      const data = stockSnap.data();
      const stock: Stock = {};

      Object.entries(data).forEach(([key, value]) => {
        if (key !== '__timestamp__' && typeof value === 'object') {
          stock[key] = value as StockRecord;
        }
      });

      return stock;
    }

    return {};
  } catch (error) {
    console.error('Error fetching current stock:', error);
    throw error;
  }
};

/**
 * Get stock for a specific date
 * Since stock is now in a single document, returns current stock
 * Stock quantities represent the last update for each product
 */
export const getStockForDate = async (shopId: string, date: string): Promise<Stock> => {
  try {
    const stockRef = doc(db, 'shops', shopId, 'stocks', 'inventory');
    const stockSnap = await getDoc(stockRef);

    if (stockSnap.exists()) {
      const data = stockSnap.data();
      const stock: Stock = {};

      Object.entries(data).forEach(([key, value]) => {
        if (key !== '__timestamp__' && typeof value === 'object') {
          stock[key] = value as StockRecord;
        }
      });

      return stock;
    }

    return {};
  } catch (error) {
    console.error('Error fetching stock:', error);
    throw error;
  }
};

/**
 * Get daily summary for a date
 */
export const getDailySummary = async (shopId: string, date: string): Promise<DailySummary | null> => {
  try {
    const dateCode = generateDateCode(new Date(date));
    const summaryRef = doc(db, 'shops', shopId, 'summaries', dateCode);
    const summarySnap = await getDoc(summaryRef);

    if (summarySnap.exists()) {
      return summarySnap.data() as DailySummary;
    }

    return null;
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    throw error;
  }
};

/**
 * Get summaries for a date range
 */
export const getSummaries = async (
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<DailySummary[]> => {
  try {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();

    const summaries: DailySummary[] = [];

    // Get all summaries for the shop
    const summariesCollectionRef = collection(db, 'shops', shopId, 'summaries');
    const querySnapshot = await getDocs(summariesCollectionRef);

    querySnapshot.forEach((doc) => {
      const dateCode = doc.id;
      const date = parseDateCode(dateCode);

      // Check if date is within range
      if (date >= start && date <= end) {
        summaries.push(doc.data() as DailySummary);
      }
    });

    return summaries.sort((a, b) => {
      const dateA = parseDateCode(a.dateCode);
      const dateB = parseDateCode(b.dateCode);
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    throw error;
  }
};

/**
 * Delete a sale (soft delete by marking as deleted in transaction)
 * Note: This removes it from the transactions map
 */
export const deleteSale = async (shopId: string, dateCode: string, saleId: string): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      const salesDocRef = doc(db, 'shops', shopId, 'sales', dateCode);
      const summaryDocRef = doc(db, 'shops', shopId, 'summaries', dateCode);

      const salesSnap = await transaction.get(salesDocRef);
      const summarySnap = await transaction.get(summaryDocRef);

      if (salesSnap.exists()) {
        const salesData = salesSnap.data();
        const sale = salesData.transactions?.[saleId];

        if (sale) {
          // Remove from transactions
          delete salesData.transactions[saleId];
          transaction.set(salesDocRef, salesData, { merge: true });

          // Update summary
          if (summarySnap.exists()) {
            const summaryData = summarySnap.data();
            summaryData.totalSales -= sale.totalPrice;
            summaryData.profit = summaryData.totalSales - summaryData.totalExpenses;
            summaryData.transactionCount -= 1;
            transaction.set(summaryDocRef, summaryData, { merge: true });
          }
        }
      }
    });
  } catch (error) {
    console.error('Error deleting sale:', error);
    throw error;
  }
};

/**
 * Delete an expense (soft delete by removing from transactions map)
 */
export const deleteExpense = async (shopId: string, dateCode: string, expenseId: string): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      const expensesDocRef = doc(db, 'shops', shopId, 'expenses', dateCode);
      const summaryDocRef = doc(db, 'shops', shopId, 'summaries', dateCode);

      const expensesSnap = await transaction.get(expensesDocRef);
      const summarySnap = await transaction.get(summaryDocRef);

      if (expensesSnap.exists()) {
        const expensesData = expensesSnap.data();
        const expense = expensesData.transactions?.[expenseId];

        if (expense) {
          // Remove from transactions
          delete expensesData.transactions[expenseId];
          transaction.set(expensesDocRef, expensesData, { merge: true });

          // Update summary
          if (summarySnap.exists()) {
            const summaryData = summarySnap.data();
            summaryData.totalExpenses -= expense.amount;
            summaryData.profit = summaryData.totalSales - summaryData.totalExpenses;
            summaryData.transactionCount -= 1;
            transaction.set(summaryDocRef, summaryData, { merge: true });
          }
        }
      }
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
};

/**
 * Update shop profile information
 */
export const updateShopProfile = async (shopId: string, updates: Partial<Shop>) => {
  try {
    const shopRef = doc(db, 'shops', shopId);
    await updateDoc(shopRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating shop profile:', error);
    throw error;
  }
};
