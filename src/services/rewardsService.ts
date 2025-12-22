import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseService';

export interface CustomerReward {
  phone: string;
  name: string;
  totalCoins: number;
  totalVisits: number;
  totalSpent: number;
  level: number;
  lastVisit: Timestamp;
  createdAt: Timestamp;
}

export interface RewardTransaction {
  shopId: string;
  shopName: string;
  customerPhone: string;
  customerName: string;
  amount: number;
  coins: number;
  type: 'earned' | 'redeemed' | 'purchase' | 'credit' | 'debt_payment';
  paymentMethod?: string;
  transactionType?: string;
  frequency?: string;
  timestamp: Timestamp;
}

export interface ShopRewardStats {
  totalCustomers: number;
  totalCoinsIssued: number;
  totalCoinsRedeemed: number;
  todaysSales: number;
}

class RewardsService {
  // Calculate coins based on transaction details
  calculateCoins(
    amount: number,
    paymentMethod: string,
    transactionType: string,
    frequency: string = 'regular'
  ) {
    const breakdown = {
      baseCoins: 0,
      paymentBonus: 0,
      typeAdjustment: 0,
      frequencyBonus: 0,
      total: 0,
    };

    // Base calculation: KES 100 = 1 coin
    breakdown.baseCoins = amount / 100;

    // Payment method bonus (percentage of current coins)
    const paymentMultipliers: Record<string, number> = {
      mobile: 0.5, // 50% bonus for M-Pesa
      bank: 0.3, // 30% bonus for card
      cash: 0, // No bonus
    };
    breakdown.paymentBonus = breakdown.baseCoins * (paymentMultipliers[paymentMethod] || 0);

    // Transaction type adjustment
    const typeMultipliers: Record<string, number> = {
      purchase: 0, // No change
      credit: -0.5, // 50% penalty
      debt_payment: 0.8, // 80% bonus
    };
    breakdown.typeAdjustment = breakdown.baseCoins * (typeMultipliers[transactionType] || 0);

    // Frequency bonus
    const frequencyBonus: Record<string, number> = {
      first: 0,
      regular: 0.2, // 20% bonus
      frequent: 0.5, // 50% bonus
      vip: 1.0, // 100% bonus
    };
    breakdown.frequencyBonus = breakdown.baseCoins * (frequencyBonus[frequency] || 0);

    // Calculate total
    const subtotal =
      breakdown.baseCoins +
      breakdown.paymentBonus +
      breakdown.typeAdjustment +
      breakdown.frequencyBonus;

    breakdown.total = Math.max(0, Math.round(subtotal));

    return breakdown;
  }

  // Calculate customer level based on total coins
  calculateLevel(totalCoins: number): number {
    if (totalCoins < 100) return 1;
    if (totalCoins < 1000) return 2;
    if (totalCoins < 3000) return 3;
    if (totalCoins < 6000) return 4;
    if (totalCoins < 10000) return 5;
    return 6;
  }

  // Get or create customer reward record
  async getCustomerRewards(shopId: string, phone: string): Promise<CustomerReward> {
    const customerRef = doc(db, 'shops', shopId, 'customers', phone);
    const customerSnap = await getDoc(customerRef);

    if (!customerSnap.exists()) {
      throw new Error('Customer not found');
    }

    return customerSnap.data() as CustomerReward;
  }

  // Record a transaction and award coins
  async recordTransaction(
    shopId: string,
    shopName: string,
    customerPhone: string,
    customerName: string,
    amount: number,
    paymentMethod: string,
    transactionType: string,
    frequency: string = 'regular'
  ): Promise<void> {
    // Calculate coins
    const breakdown = this.calculateCoins(amount, paymentMethod, transactionType, frequency);
    const coins = breakdown.total;

    // Customer reference
    const customerRef = doc(db, 'shops', shopId, 'customers', customerPhone);

    // Check if customer exists
    const customerSnap = await getDoc(customerRef);

    if (customerSnap.exists()) {
      // Update existing customer
      const currentData = customerSnap.data() as CustomerReward;
      const newTotalCoins = currentData.totalCoins + coins;
      const newLevel = this.calculateLevel(newTotalCoins);

      await updateDoc(customerRef, {
        totalCoins: newTotalCoins,
        totalVisits: increment(1),
        totalSpent: increment(amount),
        level: newLevel,
        lastVisit: serverTimestamp(),
        name: customerName, // Update name in case it changed
      });
    } else {
      // Create new customer
      await setDoc(customerRef, {
        phone: customerPhone,
        name: customerName,
        totalCoins: coins,
        totalVisits: 1,
        totalSpent: amount,
        level: this.calculateLevel(coins),
        lastVisit: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }

    // Record transaction
    const transactionRef = doc(collection(db, 'shops', shopId, 'transactions'));
    await setDoc(transactionRef, {
      shopId,
      shopName,
      customerPhone,
      customerName,
      amount,
      coins,
      type: 'earned',
      paymentMethod,
      transactionType,
      frequency,
      timestamp: serverTimestamp(),
    });

    // Update shop stats
    const shopRef = doc(db, 'shops', shopId);
    await updateDoc(shopRef, {
      'rewardStats.totalCoinsIssued': increment(coins),
      'rewardStats.todaysSales': increment(amount),
    });

    // Increment total customers count if new customer
    if (!customerSnap.exists()) {
      await updateDoc(shopRef, {
        'rewardStats.totalCustomers': increment(1),
      });
    }
  }

  // Redeem coins
  async redeemCoins(shopId: string, customerPhone: string, coins: number): Promise<number> {
    const customerRef = doc(db, 'shops', shopId, 'customers', customerPhone);
    const customerSnap = await getDoc(customerRef);

    if (!customerSnap.exists()) {
      throw new Error('Customer not found');
    }

    const customerData = customerSnap.data() as CustomerReward;

    if (customerData.totalCoins < coins) {
      throw new Error('Insufficient coins');
    }

    // Calculate redemption value
    // Base rate: 10 coins = 1 KES (can be made dynamic later)
    const redemptionRate = 10;
    const value = coins / redemptionRate;

    // Update customer coins
    const newTotalCoins = customerData.totalCoins - coins;
    const newLevel = this.calculateLevel(newTotalCoins);

    await updateDoc(customerRef, {
      totalCoins: newTotalCoins,
      level: newLevel,
      lastVisit: serverTimestamp(),
    });

    // Record redemption transaction
    const transactionRef = doc(collection(db, 'shops', shopId, 'transactions'));
    await setDoc(transactionRef, {
      shopId,
      shopName: '', // Will be filled from context if needed
      customerPhone,
      customerName: customerData.name,
      amount: value,
      coins: -coins,
      type: 'redeemed',
      timestamp: serverTimestamp(),
    });

    // Update shop stats
    const shopRef = doc(db, 'shops', shopId);
    await updateDoc(shopRef, {
      'rewardStats.totalCoinsRedeemed': increment(coins),
    });

    return value;
  }

  // Get shop statistics
  async getShopStats(shopId: string): Promise<ShopRewardStats> {
    const shopRef = doc(db, 'shops', shopId);
    const shopSnap = await getDoc(shopRef);

    if (!shopSnap.exists()) {
      return {
        totalCustomers: 0,
        totalCoinsIssued: 0,
        totalCoinsRedeemed: 0,
        todaysSales: 0,
      };
    }

    const data = shopSnap.data();
    return {
      totalCustomers: data.rewardStats?.totalCustomers || 0,
      totalCoinsIssued: data.rewardStats?.totalCoinsIssued || 0,
      totalCoinsRedeemed: data.rewardStats?.totalCoinsRedeemed || 0,
      todaysSales: data.rewardStats?.todaysSales || 0,
    };
  }

  // Get recent transactions
  async getRecentTransactions(
    shopId: string,
    limitCount: number = 10
  ): Promise<RewardTransaction[]> {
    const transactionsRef = collection(db, 'shops', shopId, 'transactions');
    const q = query(transactionsRef, orderBy('timestamp', 'desc'), limit(limitCount));

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data() as RewardTransaction);
  }

  // Initialize shop rewards stats (call this once when setting up a shop)
  async initializeShopRewards(shopId: string): Promise<void> {
    const shopRef = doc(db, 'shops', shopId);
    await updateDoc(shopRef, {
      rewardStats: {
        totalCustomers: 0,
        totalCoinsIssued: 0,
        totalCoinsRedeemed: 0,
        todaysSales: 0,
      },
    });
  }

  // Reset daily sales (call this via a scheduled function at midnight)
  async resetDailySales(shopId: string): Promise<void> {
    const shopRef = doc(db, 'shops', shopId);
    await updateDoc(shopRef, {
      'rewardStats.todaysSales': 0,
    });
  }

  // Get all customers for a shop
  async getShopCustomers(shopId: string): Promise<CustomerReward[]> {
    const customersRef = collection(db, 'shops', shopId, 'customers');
    const q = query(customersRef, orderBy('totalCoins', 'desc'));

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data() as CustomerReward);
  }

  // Search customer by phone
  async searchCustomer(shopId: string, phoneQuery: string): Promise<CustomerReward[]> {
    const customersRef = collection(db, 'shops', shopId, 'customers');
    
    // Note: For better search, consider using Algolia or similar
    // This is a basic implementation
    const q = query(
      customersRef,
      where('phone', '>=', phoneQuery),
      where('phone', '<=', phoneQuery + '\uf8ff'),
      limit(10)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data() as CustomerReward);
  }
}

export const rewardsService = new RewardsService();
