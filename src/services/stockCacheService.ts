/**
 * Stock Cache Service
 * Manages local caching of stock data for fast lookups and offline support
 * Uses localStorage for persistence
 */

import { Stock, StockRecord } from './shopService';

const STOCK_CACHE_PREFIX = 'duka_stock_cache_';
const STOCK_METADATA_PREFIX = 'duka_stock_meta_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface StockAnalysis {
  quantity: number;
  unit: string;
  lastUpdated: number;
  updatedVia: 'whatsapp' | 'cyber' | 'app';
  status: 'stale' | 'low' | 'optimal' | 'overstock';
  trend: 'fast-moving' | 'slow-moving' | 'stable';
  daysInStock?: number;
  velocity?: number; // Units per day
}

interface StockMetadata {
  shopId: string;
  lastSync: number;
  totalValue: number;
  itemCount: number;
}

/**
 * Cache stock data locally for quick lookups
 */
export const cacheStockData = (shopId: string, stock: Stock): void => {
  try {
    const cacheKey = `${STOCK_CACHE_PREFIX}${shopId}`;
    const metaKey = `${STOCK_METADATA_PREFIX}${shopId}`;

    // Store the stock data
    localStorage.setItem(cacheKey, JSON.stringify(stock));

    // Store metadata for cache validation
    const metadata: StockMetadata = {
      shopId,
      lastSync: Date.now(),
      totalValue: Object.values(stock).reduce((sum, item: any) => {
        // This is a placeholder - actual value would come from pricing
        return sum + item.quantity;
      }, 0),
      itemCount: Object.keys(stock).length,
    };

    localStorage.setItem(metaKey, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error caching stock data:', error);
  }
};

/**
 * Get cached stock data if still valid
 */
export const getCachedStock = (shopId: string): Stock | null => {
  try {
    const cacheKey = `${STOCK_CACHE_PREFIX}${shopId}`;
    const metaKey = `${STOCK_METADATA_PREFIX}${shopId}`;

    const metaStr = localStorage.getItem(metaKey);
    if (!metaStr) return null;

    const metadata: StockMetadata = JSON.parse(metaStr);

    // Check if cache is still fresh
    if (Date.now() - metadata.lastSync > CACHE_DURATION) {
      clearStockCache(shopId);
      return null;
    }

    const stockStr = localStorage.getItem(cacheKey);
    return stockStr ? JSON.parse(stockStr) : null;
  } catch (error) {
    console.error('Error retrieving cached stock:', error);
    return null;
  }
};

/**
 * Clear stock cache for a shop
 */
export const clearStockCache = (shopId: string): void => {
  try {
    const cacheKey = `${STOCK_CACHE_PREFIX}${shopId}`;
    const metaKey = `${STOCK_METADATA_PREFIX}${shopId}`;

    localStorage.removeItem(cacheKey);
    localStorage.removeItem(metaKey);
  } catch (error) {
    console.error('Error clearing stock cache:', error);
  }
};

/**
 * Search stock items by name
 */
export const searchStock = (shopId: string, query: string): Array<{ [productName: string]: StockRecord }> => {
  const stock = getCachedStock(shopId);
  if (!stock) return [];

  const lowerQuery = query.toLowerCase().trim();

  return Object.entries(stock)
    .filter(([name]) => name.toLowerCase().includes(lowerQuery))
    .map(([name, record]) => ({ [name]: record }))  // ✅ Return both name and record
    .slice(0, 10); // Return top 10 results
};

/**
 * Categorize stock based on quantity and movement patterns
 */
export const categorizeStock = (
  shopId: string,
  daysBackForAnalysis: number = 30
): Record<string, StockAnalysis[]> => {
  const stock = getCachedStock(shopId);
  if (!stock) return {};

  const now = Date.now();
  const categories: Record<string, StockAnalysis[]> = {
    'fast-moving': [],
    'slow-moving': [],
    'low-stock': [],
    'overstock': [],
    'stale': [],
  };

  Object.entries(stock).forEach(([name, record]: [string, any]) => {
    const daysSinceUpdate = (now - record.lastUpdated * 1000) / (1000 * 60 * 60 * 24);

    let status: 'stale' | 'low' | 'optimal' | 'overstock' = 'optimal';
    let trend: 'fast-moving' | 'slow-moving' | 'stable' = 'stable';

    // Determine status
    if (record.quantity === 0) {
      status = 'low';
    } else if (record.quantity < 10) {
      status = 'low';
    } else if (record.quantity > 100) {
      status = 'overstock';
    }

    // Determine trend based on history
    if (record.history && record.history.length > 0) {
      const recentHistory = record.history.filter(
        (h: any) => (now - h.timestamp * 1000) / (1000 * 60 * 60 * 24) <= daysBackForAnalysis
      );

      if (recentHistory.length === 0) {
        trend = 'slow-moving';
      } else {
        const soldQuantity = recentHistory
          .filter((h: any) => h.type === 'sold')
          .reduce((sum: number, h: any) => sum + Math.abs(h.change), 0);

        const velocity = soldQuantity / daysBackForAnalysis;

        if (velocity > 5) {
          trend = 'fast-moving';
        } else if (velocity < 1) {
          trend = 'slow-moving';
        }
      }
    } else if (daysSinceUpdate > 30) {
      trend = 'slow-moving';
    }

    // Determine if stale
    if (daysSinceUpdate > 60) {
      status = 'stale';
    }

    const analysis: StockAnalysis = {
      quantity: record.quantity,
      unit: record.unit,
      lastUpdated: record.lastUpdated,
      updatedVia: record.updatedVia,
      status,
      trend,
      daysInStock: Math.round(daysSinceUpdate),
    };

    // Categorize
    if (status === 'stale') {
      categories['stale'].push(analysis);
    } else if (status === 'low') {
      categories['low-stock'].push(analysis);
    } else if (trend === 'fast-moving') {
      categories['fast-moving'].push(analysis);
    } else if (trend === 'slow-moving') {
      categories['slow-moving'].push(analysis);
    } else if (status === 'overstock') {
      categories['overstock'].push(analysis);
    }
  });

  return categories;
};

/**
 * Check if product is in stock with quantity validation
 */
export const checkStockAvailability = (
  shopId: string,
  productName: string,
  requiredQuantity: number
): { available: boolean; message: string; currentQuantity: number } => {
  const stock = getCachedStock(shopId);

  if (!stock) {
    return {
      available: false,
      message: 'Stock data not available',
      currentQuantity: 0,
    };
  }

  const normalizedName = productName.toLowerCase().trim();
  const product = stock[normalizedName];

  if (!product) {
    return {
      available: false,
      message: `"${productName}" is not in your stock`,
      currentQuantity: 0,
    };
  }

  if (product.quantity < requiredQuantity) {
    return {
      available: false,
      message: `Insufficient stock. Available: ${product.quantity} ${product.unit}`,
      currentQuantity: product.quantity,
    };
  }

  return {
    available: true,
    message: `Available: ${product.quantity} ${product.unit}`,
    currentQuantity: product.quantity,
  };
};

/**
 * Get stock statistics for dashboard
 */
export const getStockStatistics = (
  shopId: string
): {
  totalItems: number;
  lowStockItems: number;
  outOfStock: number;
  fastMovingItems: number;
  slowMovingItems: number;
  staleItems: number;
  totalValue: number;
} => {
  const stock = getCachedStock(shopId);

  if (!stock) {
    return {
      totalItems: 0,
      lowStockItems: 0,
      outOfStock: 0,
      fastMovingItems: 0,
      slowMovingItems: 0,
      staleItems: 0,
      totalValue: 0,
    };
  }

  let lowStockItems = 0;
  let outOfStock = 0;
  let fastMovingItems = 0;
  let slowMovingItems = 0;
  let staleItems = 0;

  Object.values(stock).forEach((record: any) => {
    if (record.quantity === 0) {
      outOfStock++;
    } else if (record.quantity < 10) {
      lowStockItems++;
    }

    const daysSinceUpdate = (Date.now() - record.lastUpdated * 1000) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate > 60) {
      staleItems++;
    } else if (record.history) {
      const recentSales = record.history.filter((h: any) => h.type === 'sold').length;
      if (recentSales > 5) {
        fastMovingItems++;
      } else if (recentSales < 1) {
        slowMovingItems++;
      }
    }
  });

  return {
    totalItems: Object.keys(stock).length,
    lowStockItems,
    outOfStock,
    fastMovingItems,
    slowMovingItems,
    staleItems,
    totalValue: 0, // Would need pricing data
  };
};

/**
 * Get product names for autocomplete
 */
export const getStockProductNames = (shopId: string): string[] => {
  const stock = getCachedStock(shopId);
  if (!stock) return [];

  return Object.keys(stock).map((name) =>
    name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
};
