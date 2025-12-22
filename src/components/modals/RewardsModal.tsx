import React, { useState, useEffect } from 'react';
import { X, Search, TrendingUp, Users, Award, DollarSign } from 'lucide-react';
import { rewardsService, CustomerReward, RewardTransaction } from '../../services/rewardsService';

interface RewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
}

export const RewardsModal: React.FC<RewardsModalProps> = ({
  isOpen,
  onClose,
  shopId,
  shopName,
}) => {
  const [activeTab, setActiveTab] = useState<'lookup' | 'transaction' | 'stats'>('lookup');
  const [loading, setLoading] = useState(false);

  // Lookup state
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<CustomerReward | null>(null);

  // Transaction state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [frequency, setFrequency] = useState('regular');
  const [coinBreakdown, setCoinBreakdown] = useState<any>(null);

  // Stats state
  const [shopStats, setShopStats] = useState({
    totalCustomers: 0,
    totalCoinsIssued: 0,
    totalCoinsRedeemed: 0,
    todaysSales: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<RewardTransaction[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadShopStats();
      loadRecentTransactions();
    }
  }, [isOpen, shopId]);

  const loadShopStats = async () => {
    try {
      const stats = await rewardsService.getShopStats(shopId);
      setShopStats(stats);
    } catch (error) {
      console.error('Error loading shop stats:', error);
    }
  };

  const loadRecentTransactions = async () => {
    try {
      const transactions = await rewardsService.getRecentTransactions(shopId, 10);
      setRecentTransactions(transactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handleLookup = async () => {
    if (!lookupPhone.trim()) {
      alert('Please enter a phone number');
      return;
    }

    setLoading(true);
    try {
      const result = await rewardsService.getCustomerRewards(shopId, lookupPhone);
      setLookupResult(result);
    } catch (error) {
      console.error('Error looking up customer:', error);
      alert('Customer not found or error occurred');
      setLookupResult(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateCoins = () => {
    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || !paymentMethod || !transactionType) {
      alert('Please fill in all transaction details');
      return;
    }

    const breakdown = rewardsService.calculateCoins(
      amount,
      paymentMethod,
      transactionType,
      frequency
    );

    setCoinBreakdown(breakdown);
  };

  const handleRecordTransaction = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Please enter customer name and phone');
      return;
    }

    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || !paymentMethod || !transactionType) {
      alert('Please fill in all transaction details');
      return;
    }

    setLoading(true);
    try {
      await rewardsService.recordTransaction(
        shopId,
        shopName,
        customerPhone,
        customerName,
        amount,
        paymentMethod,
        transactionType,
        frequency
      );

      alert('✅ Transaction recorded successfully!');
      
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setTransactionAmount('');
      setPaymentMethod('');
      setTransactionType('');
      setFrequency('regular');
      setCoinBreakdown(null);

      // Reload stats
      await loadShopStats();
      await loadRecentTransactions();
    } catch (error) {
      console.error('Error recording transaction:', error);
      alert('Error recording transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemCoins = async () => {
    if (!lookupResult) {
      alert('Please lookup a customer first');
      return;
    }

    const coinsToRedeem = prompt(`Customer has ${lookupResult.totalCoins} coins.\nHow many coins to redeem?`);
    if (!coinsToRedeem) return;

    const coins = parseInt(coinsToRedeem);
    if (isNaN(coins) || coins <= 0 || coins > lookupResult.totalCoins) {
      alert('Invalid number of coins');
      return;
    }

    setLoading(true);
    try {
      const value = await rewardsService.redeemCoins(shopId, lookupResult.phone, coins);
      alert(`✅ Successfully redeemed ${coins} coins for KES ${value.toFixed(2)}!\n\nCustomer now has ${lookupResult.totalCoins - coins} coins remaining.`);
      
      // Refresh lookup
      await handleLookup();
      await loadShopStats();
      await loadRecentTransactions();
    } catch (error: any) {
      console.error('Error redeeming coins:', error);
      alert(error.message || 'Error redeeming coins');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="rewards-modal-overlay" onClick={onClose}>
      <div className="rewards-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rewards-modal-header">
          <div>
            <h2>🪙 ShopCoins Rewards</h2>
            <p>{shopName}</p>
          </div>
          <button className="rewards-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="rewards-modal-tabs">
          <button
            className={`rewards-tab ${activeTab === 'lookup' ? 'active' : ''}`}
            onClick={() => setActiveTab('lookup')}
          >
            <Search size={18} />
            Customer Lookup
          </button>
          <button
            className={`rewards-tab ${activeTab === 'transaction' ? 'active' : ''}`}
            onClick={() => setActiveTab('transaction')}
          >
            <TrendingUp size={18} />
            New Transaction
          </button>
          <button
            className={`rewards-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <Award size={18} />
            Statistics
          </button>
        </div>

        {/* Content */}
        <div className="rewards-modal-body">
          {/* Lookup Tab */}
          {activeTab === 'lookup' && (
            <div className="rewards-tab-content">
              <div className="lookup-section-modal">
                <h3>Check Customer Points</h3>
                <div className="lookup-form-modal">
                  <input
                    type="tel"
                    placeholder="Enter customer phone (e.g., 0712345678)"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    className="rewards-input"
                  />
                  <button
                    onClick={handleLookup}
                    disabled={loading}
                    className="rewards-btn rewards-btn-primary"
                  >
                    {loading ? 'Searching...' : 'Check Points'}
                  </button>
                </div>

                {lookupResult && (
                  <div className="lookup-result-modal">
                    <div className="customer-info-card">
                      <h4>👤 {lookupResult.name}</h4>
                      <p className="phone-number">{lookupResult.phone}</p>
                    </div>

                    <div className="lookup-stats-grid">
                      <div className="lookup-stat-card">
                        <div className="stat-icon">🪙</div>
                        <div className="stat-value">{lookupResult.totalCoins}</div>
                        <div className="stat-label">Total Coins</div>
                      </div>
                      <div className="lookup-stat-card">
                        <div className="stat-icon">🛍️</div>
                        <div className="stat-value">{lookupResult.totalVisits}</div>
                        <div className="stat-label">Total Visits</div>
                      </div>
                      <div className="lookup-stat-card">
                        <div className="stat-icon">💰</div>
                        <div className="stat-value">KES {lookupResult.totalSpent.toFixed(0)}</div>
                        <div className="stat-label">Total Spent</div>
                      </div>
                      <div className="lookup-stat-card">
                        <div className="stat-icon">⭐</div>
                        <div className="stat-value">{lookupResult.level}</div>
                        <div className="stat-label">Customer Level</div>
                      </div>
                    </div>

                    <button
                      onClick={handleRedeemCoins}
                      disabled={loading || lookupResult.totalCoins === 0}
                      className="rewards-btn rewards-btn-redeem"
                    >
                      💸 Redeem Coins
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transaction Tab */}
          {activeTab === 'transaction' && (
            <div className="rewards-tab-content">
              <div className="transaction-form">
                <h3>Record New Transaction</h3>
                
                <div className="form-grid">
                  <div className="form-group-modal">
                    <label>Customer Name</label>
                    <input
                      type="text"
                      placeholder="Enter customer name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="rewards-input"
                    />
                  </div>

                  <div className="form-group-modal">
                    <label>Customer Phone</label>
                    <input
                      type="tel"
                      placeholder="0712345678"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="rewards-input"
                    />
                  </div>

                  <div className="form-group-modal">
                    <label>Transaction Amount (KES)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={transactionAmount}
                      onChange={(e) => setTransactionAmount(e.target.value)}
                      className="rewards-input"
                    />
                  </div>

                  <div className="form-group-modal">
                    <label>Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="rewards-select"
                    >
                      <option value="">Select...</option>
                      <option value="mobile">Mobile Money (M-Pesa)</option>
                      <option value="bank">Bank Card</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>

                  <div className="form-group-modal">
                    <label>Transaction Type</label>
                    <select
                      value={transactionType}
                      onChange={(e) => setTransactionType(e.target.value)}
                      className="rewards-select"
                    >
                      <option value="">Select...</option>
                      <option value="purchase">Purchase</option>
                      <option value="credit">Credit Purchase</option>
                      <option value="debt_payment">Debt Payment</option>
                    </select>
                  </div>

                  <div className="form-group-modal">
                    <label>Customer Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="rewards-select"
                    >
                      <option value="first">First Purchase</option>
                      <option value="regular">Regular (2-4/month)</option>
                      <option value="frequent">Frequent (5+/month)</option>
                      <option value="vip">VIP (Daily)</option>
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    onClick={calculateCoins}
                    className="rewards-btn rewards-btn-secondary"
                  >
                    Calculate Coins
                  </button>
                  <button
                    onClick={handleRecordTransaction}
                    disabled={loading}
                    className="rewards-btn rewards-btn-primary"
                  >
                    {loading ? 'Recording...' : 'Award Coins'}
                  </button>
                </div>

                {coinBreakdown && (
                  <div className="coin-breakdown-modal">
                    <h4>Coin Calculation Breakdown:</h4>
                    <div className="breakdown-item">
                      <span>Base Coins (KES 100 = 1 coin):</span>
                      <span>{Math.round(coinBreakdown.baseCoins)}</span>
                    </div>
                    <div className="breakdown-item">
                      <span>Payment Method Bonus:</span>
                      <span>+{Math.round(coinBreakdown.paymentBonus)}</span>
                    </div>
                    <div className="breakdown-item">
                      <span>Transaction Type Adjustment:</span>
                      <span>{coinBreakdown.typeAdjustment >= 0 ? '+' : ''}{Math.round(coinBreakdown.typeAdjustment)}</span>
                    </div>
                    <div className="breakdown-item">
                      <span>Frequency Bonus:</span>
                      <span>+{Math.round(coinBreakdown.frequencyBonus)}</span>
                    </div>
                    <div className="breakdown-item total">
                      <span><strong>Total Coins:</strong></span>
                      <span><strong>🪙 {coinBreakdown.total}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="rewards-tab-content">
              <div className="stats-section">
                <h3>Shop Statistics</h3>
                
                <div className="stats-grid-modal">
                  <div className="stat-card-modal">
                    <div className="stat-icon-large">
                      <Users size={32} />
                    </div>
                    <div className="stat-value-large">{shopStats.totalCustomers}</div>
                    <div className="stat-label-modal">Total Customers</div>
                  </div>

                  <div className="stat-card-modal">
                    <div className="stat-icon-large">
                      <Award size={32} />
                    </div>
                    <div className="stat-value-large">{shopStats.totalCoinsIssued}</div>
                    <div className="stat-label-modal">Coins Issued</div>
                  </div>

                  <div className="stat-card-modal">
                    <div className="stat-icon-large">
                      <DollarSign size={32} />
                    </div>
                    <div className="stat-value-large">{shopStats.totalCoinsRedeemed}</div>
                    <div className="stat-label-modal">Coins Redeemed</div>
                  </div>

                  <div className="stat-card-modal">
                    <div className="stat-icon-large">
                      <TrendingUp size={32} />
                    </div>
                    <div className="stat-value-large">KES {shopStats.todaysSales.toFixed(0)}</div>
                    <div className="stat-label-modal">Today's Sales</div>
                  </div>
                </div>

                <div className="recent-transactions">
                  <h4>Recent Transactions</h4>
                  {recentTransactions.length === 0 ? (
                    <p className="no-data">No transactions yet</p>
                  ) : (
                    <div className="transactions-list">
                      {recentTransactions.map((txn, index) => (
                        <div key={index} className="transaction-item">
                          <div className="transaction-info">
                            <div className="transaction-name">{txn.customerName}</div>
                            <div className="transaction-phone">{txn.customerPhone}</div>
                            <div className="transaction-date">
                              {new Date(txn.timestamp.toDate()).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="transaction-details">
                            <div className="transaction-amount">KES {txn.amount.toFixed(2)}</div>
                            <div className={`transaction-coins ${txn.coins > 0 ? 'positive' : 'negative'}`}>
                              {txn.coins > 0 ? '+' : ''}{txn.coins} 🪙
                            </div>
                            <span className={`transaction-badge ${txn.type}`}>
                              {txn.type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .rewards-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .rewards-modal-content {
          background: white;
          border-radius: 25px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .rewards-modal-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 25px 25px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .rewards-modal-header h2 {
          margin: 0;
          font-size: 1.8em;
          font-weight: 700;
        }

        .rewards-modal-header p {
          margin: 5px 0 0 0;
          opacity: 0.9;
          font-size: 1em;
        }

        .rewards-modal-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }

        .rewards-modal-close:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: rotate(90deg);
        }

        .rewards-modal-tabs {
          display: flex;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
        }

        .rewards-tab {
          flex: 1;
          padding: 18px 20px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95em;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s;
          position: relative;
        }

        .rewards-tab::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          transform: scaleX(0);
          transition: transform 0.3s;
        }

        .rewards-tab.active {
          color: #667eea;
          background: white;
        }

        .rewards-tab.active::after {
          transform: scaleX(1);
        }

        .rewards-tab:hover {
          background: rgba(102, 126, 234, 0.05);
        }

        .rewards-modal-body {
          padding: 30px;
          overflow-y: auto;
          flex: 1;
        }

        .rewards-tab-content {
          animation: fadeIn 0.4s ease-out;
        }

        /* Lookup Section */
        .lookup-section-modal h3 {
          color: #333;
          margin-bottom: 20px;
          font-size: 1.4em;
        }

        .lookup-form-modal {
          display: flex;
          gap: 12px;
          margin-bottom: 25px;
        }

        .rewards-input {
          flex: 1;
          padding: 14px 18px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          font-size: 1em;
          transition: all 0.3s;
          background: #f8f9fa;
        }

        .rewards-input:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .rewards-select {
          width: 100%;
          padding: 14px 18px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          font-size: 1em;
          transition: all 0.3s;
          background: #f8f9fa;
          cursor: pointer;
        }

        .rewards-select:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .rewards-btn {
          padding: 14px 28px;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1em;
          cursor: pointer;
          transition: all 0.3s;
          white-space: nowrap;
        }

        .rewards-btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .rewards-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }

        .rewards-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .rewards-btn-secondary {
          background: #f8f9fa;
          color: #667eea;
          border: 2px solid #667eea;
        }

        .rewards-btn-secondary:hover {
          background: #667eea;
          color: white;
        }

        .rewards-btn-redeem {
          width: 100%;
          margin-top: 20px;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }

        .rewards-btn-redeem:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(240, 147, 251, 0.4);
        }

        .lookup-result-modal {
          background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
          padding: 25px;
          border-radius: 16px;
          color: white;
          animation: slideUp 0.4s ease-out;
        }

        .customer-info-card {
          background: rgba(255, 255, 255, 0.95);
          color: #333;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .customer-info-card h4 {
          margin: 0 0 5px 0;
          font-size: 1.3em;
        }

        .phone-number {
          color: #666;
          margin: 0;
          font-size: 0.95em;
        }

        .lookup-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-top: 15px;
        }

        .lookup-stat-card {
          background: rgba(255, 255, 255, 0.95);
          padding: 20px;
          border-radius: 12px;
          text-align: center;
        }

        .stat-icon {
          font-size: 2em;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 1.8em;
          font-weight: 700;
          color: #667eea;
          margin-bottom: 5px;
        }

        .stat-label {
          color: #666;
          font-size: 0.9em;
        }

        /* Transaction Form */
        .transaction-form h3 {
          color: #333;
          margin-bottom: 25px;
          font-size: 1.4em;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 25px;
        }

        .form-group-modal {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group-modal label {
          font-weight: 600;
          color: #333;
          font-size: 0.95em;
        }

        .form-actions {
          display: flex;
          gap: 12px;
        }

        .form-actions button {
          flex: 1;
        }

        .coin-breakdown-modal {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          margin-top: 20px;
        }

        .coin-breakdown-modal h4 {
          color: #667eea;
          margin-bottom: 15px;
        }

        .breakdown-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .breakdown-item:last-child {
          border-bottom: none;
        }

        .breakdown-item.total {
          border-top: 2px solid #667eea;
          padding-top: 15px;
          margin-top: 10px;
          font-size: 1.1em;
          color: #667eea;
        }

        /* Stats Section */
        .stats-section h3 {
          color: #333;
          margin-bottom: 25px;
          font-size: 1.4em;
        }

        .stats-grid-modal {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }

        .stat-card-modal {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 25px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 5px 20px rgba(102, 126, 234, 0.3);
          transition: all 0.3s;
        }

        .stat-card-modal:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }

        .stat-icon-large {
          margin-bottom: 12px;
          opacity: 0.9;
        }

        .stat-value-large {
          font-size: 2.2em;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .stat-label-modal {
          opacity: 0.95;
          font-size: 0.95em;
        }

        /* Recent Transactions */
        .recent-transactions {
          background: #f8f9fa;
          padding: 25px;
          border-radius: 16px;
        }

        .recent-transactions h4 {
          color: #333;
          margin-bottom: 20px;
          font-size: 1.2em;
        }

        .no-data {
          text-align: center;
          color: #666;
          padding: 30px;
        }

        .transactions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transaction-item {
          background: white;
          padding: 18px;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          transition: all 0.3s;
        }

        .transaction-item:hover {
          transform: translateX(5px);
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
        }

        .transaction-info {
          flex: 1;
        }

        .transaction-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }

        .transaction-phone {
          color: #666;
          font-size: 0.9em;
          margin-bottom: 4px;
        }

        .transaction-date {
          color: #999;
          font-size: 0.85em;
        }

        .transaction-details {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .transaction-amount {
          font-weight: 700;
          color: #333;
          font-size: 1.1em;
        }

        .transaction-coins {
          font-weight: 600;
          font-size: 1em;
        }

        .transaction-coins.positive {
          color: #28a745;
        }

        .transaction-coins.negative {
          color: #dc3545;
        }

        .transaction-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.8em;
          font-weight: 600;
          text-transform: capitalize;
        }

        .transaction-badge.earned,
        .transaction-badge.purchase,
        .transaction-badge.debt_payment {
          background: #d4edda;
          color: #155724;
        }

        .transaction-badge.redeemed,
        .transaction-badge.credit {
          background: #fff3cd;
          color: #856404;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .rewards-modal-content {
            max-width: 100%;
            border-radius: 20px;
          }

          .rewards-modal-header {
            padding: 20px;
          }

          .rewards-modal-header h2 {
            font-size: 1.4em;
          }

          .rewards-modal-body {
            padding: 20px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid-modal {
            grid-template-columns: 1fr;
          }

          .lookup-stats-grid {
            grid-template-columns: 1fr;
          }

          .lookup-form-modal {
            flex-direction: column;
          }

          .form-actions {
            flex-direction: column;
          }

          .transaction-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
          }

          .transaction-details {
            width: 100%;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
        }
      `}</style>
    </div>
  );
};
