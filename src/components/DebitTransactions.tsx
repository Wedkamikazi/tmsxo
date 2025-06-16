/**
 * DEBIT TRANSACTIONS COMPONENT
 * 
 * Provides the user interface for:
 * - Viewing extracted debit transactions
 * - AI/LLM categorization results
 * - Auto-reconciliation with AP Aging and Forecasted Payments
 * - Manual reconciliation for unmatched entries
 * - Verification and confirmation workflow
 * - Observations and notes management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DebitTransaction, APAgingEntry, ForecastedPayment } from '../types';
import { debitTransactionManagementService } from '../services/debitTransactionManagementService';
import { ErrorBoundary } from './ErrorBoundary';
import './DebitTransactions.css';

interface DebitTransactionsProps {
  dataRefreshTrigger?: number;
}

export const DebitTransactions: React.FC<DebitTransactionsProps> = ({ dataRefreshTrigger }) => {
  const [debitTransactions, setDebitTransactions] = useState<DebitTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<DebitTransaction | null>(null);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | DebitTransaction['reconciliationStatus'],
    accountId: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    matched: 0,
    confirmed: 0,
    totalAmount: 0,
    averageConfidence: 0
  });

  const loadDebitTransactions = useCallback(async () => {
    try {
      setLoading(true);
      
      const filterOptions = filters.status === 'all' ? undefined : {
        status: filters.status,
        accountId: filters.accountId === 'all' ? undefined : filters.accountId,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined
      };

      const [transactions, summaryData] = await Promise.all([
        debitTransactionManagementService.getDebitTransactionsForDisplay(filterOptions),
        debitTransactionManagementService.getDebitTransactionsSummary()
      ]);

      setDebitTransactions(transactions);
      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to load debit transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDebitTransactions();
  }, [loadDebitTransactions, dataRefreshTrigger]);

  const handleAutoReconciliation = async (transactionId: string) => {
    try {
      await debitTransactionManagementService.performAutoReconciliation(transactionId);
      await loadDebitTransactions();
    } catch (error) {
      console.error('Auto-reconciliation failed:', error);
      alert('Auto-reconciliation failed. Please try manual reconciliation.');
    }
  };

  const handleConfirmTransaction = async (transactionId: string, observations?: string) => {
    try {
      await debitTransactionManagementService.confirmTransaction(
        transactionId, 
        'current_user',
        observations
      );
      await loadDebitTransactions();
    } catch (error) {
      console.error('Transaction confirmation failed:', error);
      alert('Failed to confirm transaction.');
    }
  };

  const openReconciliationModal = (transaction: DebitTransaction) => {
    setSelectedTransaction(transaction);
    setShowReconciliationModal(true);
  };

  const getStatusBadge = (status: DebitTransaction['reconciliationStatus']) => {
    const badges = {
      'pending': { color: '#ff9800', text: 'Pending' },
      'auto_matched': { color: '#4caf50', text: 'Auto Matched' },
      'manually_matched': { color: '#2196f3', text: 'Manual Match' },
      'confirmed': { color: '#8bc34a', text: '✓ Confirmed' }
    };

    const badge = badges[status];
    return (
      <span 
        className="status-badge"
        style={{ 
          backgroundColor: badge.color,
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}
      >
        {badge.text}
      </span>
    );
  };

  const getCategoryTypeDisplay = (categoryType: DebitTransaction['categoryType']) => {
    const types = {
      'vendor_payment': 'Vendor Payment',
      'hr_payment': 'HR Payment',
      'fee': 'Fee/Charge',
      'tax': 'Tax Payment',
      'intercompany_out': 'Intercompany Out',
      'time_deposit': 'Time Deposit',
      'other': 'Other'
    };
    return types[categoryType];
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="debit-transactions-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading debit transactions...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary componentName="DebitTransactions">
      <div className="debit-transactions-container">
        {/* Header and Summary */}
        <div className="debit-transactions-header">
          <h2>💸 Debit Transactions</h2>
          <p>Automatic extraction & reconciliation with AP Aging and Forecasted Payments</p>
          
          <div className="summary-cards">
            <div className="summary-card">
              <h4>Total Transactions</h4>
              <span className="summary-value">{summary.total}</span>
            </div>
            <div className="summary-card">
              <h4>Pending</h4>
              <span className="summary-value pending">{summary.pending}</span>
            </div>
            <div className="summary-card">
              <h4>Matched</h4>
              <span className="summary-value matched">{summary.matched}</span>
            </div>
            <div className="summary-card">
              <h4>Confirmed</h4>
              <span className="summary-value confirmed">{summary.confirmed}</span>
            </div>
            <div className="summary-card">
              <h4>Total Amount</h4>
              <span className="summary-value">{formatAmount(summary.totalAmount)}</span>
            </div>
            <div className="summary-card">
              <h4>Avg Confidence</h4>
              <span className="summary-value">{(summary.averageConfidence * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <h3>🔍 Filters</h3>
          <div className="filters-grid">
            <div className="filter-group">
              <label htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="auto_matched">Auto Matched</option>
                <option value="manually_matched">Manual Match</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label htmlFor="account-filter">Account</label>
              <select
                id="account-filter"
                value={filters.accountId}
                onChange={(e) => setFilters(prev => ({ ...prev, accountId: e.target.value }))}
              >
                <option value="all">All Accounts</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label htmlFor="date-from">Date From</label>
              <input
                id="date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            
            <div className="filter-group">
              <label htmlFor="date-to">Date To</label>
              <input
                id="date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="transactions-table-section">
          <h3>📋 Debit Transactions ({debitTransactions.length})</h3>
          
          {debitTransactions.length === 0 ? (
            <div className="no-transactions">
              <p>No debit transactions found matching the current filters.</p>
              <p>Import bank statements to extract debit transactions automatically.</p>
            </div>
          ) : (
            <div className="transactions-table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Confidence</th>
                    <th>Matched Entity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {debitTransactions.map(transaction => (
                    <tr key={transaction.id} className={`transaction-row ${transaction.reconciliationStatus}`}>
                      <td>{formatDate(transaction.date)}</td>
                      <td>
                        <div className="transaction-description">
                          <span className="description-text">{transaction.description}</span>
                          <small className="reference-text">Ref: {transaction.reference}</small>
                        </div>
                      </td>
                      <td className="amount-cell">
                        <span className="debit-amount">{formatAmount(transaction.amount)}</span>
                      </td>
                      <td>
                        <span className="category-badge">
                          {getCategoryTypeDisplay(transaction.categoryType)}
                        </span>
                      </td>
                      <td>{getStatusBadge(transaction.reconciliationStatus)}</td>
                      <td>
                        {transaction.confidenceRatio ? (
                          <span className={`confidence-score ${transaction.confidenceRatio >= 0.8 ? 'high' : transaction.confidenceRatio >= 0.6 ? 'medium' : 'low'}`}>
                            {(transaction.confidenceRatio * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="no-confidence">-</span>
                        )}
                      </td>
                      <td>
                        {transaction.apAgingMatch && (
                          <div className="matched-entity">
                            <strong>{transaction.apAgingMatch.vendorName}</strong>
                            <small>Invoice: {transaction.apAgingMatch.invoiceNumber}</small>
                          </div>
                        )}
                        {transaction.forecastMatch && (
                          <div className="matched-entity">
                            <strong>Vendor ID: {transaction.forecastMatch.vendorId}</strong>
                            <small>{transaction.forecastMatch.notes || 'No additional notes'}</small>
                          </div>
                        )}
                        {!transaction.apAgingMatch && !transaction.forecastMatch && (
                          <span className="no-match">No match</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          {transaction.reconciliationStatus === 'pending' && (
                            <>
                              <button 
                                className="btn-auto-reconcile"
                                onClick={() => handleAutoReconciliation(transaction.id)}
                                title="Auto Reconcile"
                              >
                                🔄 Auto
                              </button>
                              <button 
                                className="btn-manual-reconcile"
                                onClick={() => openReconciliationModal(transaction)}
                                title="Manual Reconcile"
                              >
                                ✋ Manual
                              </button>
                            </>
                          )}
                          {(transaction.reconciliationStatus === 'auto_matched' || transaction.reconciliationStatus === 'manually_matched') && (
                            <button 
                              className="btn-confirm"
                              onClick={() => handleConfirmTransaction(transaction.id)}
                              title="Confirm Transaction"
                            >
                              ✅ Confirm
                            </button>
                          )}
                          {transaction.reconciliationStatus === 'confirmed' && (
                            <span className="verified-badge" title={`Verified by ${transaction.verifiedBy} on ${transaction.verificationDate ? formatDate(transaction.verificationDate) : 'Unknown'}`}>
                              ⩗ Verified
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Manual Reconciliation Modal */}
        {showReconciliationModal && selectedTransaction && (
          <ManualReconciliationModal
            transaction={selectedTransaction}
            onClose={() => {
              setShowReconciliationModal(false);
              setSelectedTransaction(null);
            }}
            onSuccess={() => {
              setShowReconciliationModal(false);
              setSelectedTransaction(null);
              loadDebitTransactions();
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

// Manual Reconciliation Modal Component
interface ManualReconciliationModalProps {
  transaction: DebitTransaction;
  onClose: () => void;
  onSuccess: () => void;
}

const ManualReconciliationModal: React.FC<ManualReconciliationModalProps> = ({
  transaction,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'ap_aging' | 'forecast'>('ap_aging');
  const [apAgingEntries, setAPAgingEntries] = useState<APAgingEntry[]>([]);
  const [forecastedPayments, setForecastedPayments] = useState<ForecastedPayment[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMatchOptions = async () => {
      try {
        setLoading(true);
        const [apEntries, forecasts] = await Promise.all([
          debitTransactionManagementService.getAPAging(),
          debitTransactionManagementService.getForecastedPayments()
        ]);
        setAPAgingEntries(apEntries);
        setForecastedPayments(forecasts);
      } catch (error) {
        console.error('Failed to load match options:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMatchOptions();
  }, []);

  const handleManualMatch = async () => {
    if (!selectedEntity) {
      alert('Please select an entity to match with.');
      return;
    }

    try {
      await debitTransactionManagementService.performManualReconciliation(
        transaction.id,
        selectedEntity,
        activeTab === 'ap_aging' ? 'ap_aging' : 'forecast',
        notes
      );
      onSuccess();
    } catch (error) {
      console.error('Manual reconciliation failed:', error);
      alert('Manual reconciliation failed. Please try again.');
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content manual-reconciliation-modal">
        <div className="modal-header">
          <h3>Manual Reconciliation</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="transaction-summary">
            <h4>Transaction to Match:</h4>
            <div className="transaction-details">
              <p><strong>Date:</strong> {new Date(transaction.date).toLocaleDateString()}</p>
              <p><strong>Description:</strong> {transaction.description}</p>
              <p><strong>Amount:</strong> {formatAmount(transaction.amount)}</p>
              <p><strong>Category:</strong> {transaction.categoryType}</p>
            </div>
          </div>

          <div className="match-options">
            <div className="tabs">
              <button 
                className={activeTab === 'ap_aging' ? 'active' : ''}
                onClick={() => setActiveTab('ap_aging')}
              >
                AP Aging ({apAgingEntries.length})
              </button>
              <button 
                className={activeTab === 'forecast' ? 'active' : ''}
                onClick={() => setActiveTab('forecast')}
              >
                Forecasted Payments ({forecastedPayments.length})
              </button>
            </div>

            <div className="tab-content">
              {loading ? (
                <div className="loading-options">Loading options...</div>
              ) : (
                <>
                  {activeTab === 'ap_aging' && (
                    <div className="ap-aging-options">
                      {apAgingEntries.map(entry => (
                        <div 
                          key={entry.id}
                          className={`option-item ${selectedEntity === entry.id ? 'selected' : ''}`}
                          onClick={() => setSelectedEntity(entry.id)}
                        >
                          <div className="option-header">
                            <input 
                              type="radio" 
                              checked={selectedEntity === entry.id}
                              onChange={() => setSelectedEntity(entry.id)}
                            />
                            <strong>{entry.vendorName}</strong>
                            <span className="amount">{formatAmount(entry.amount)}</span>
                          </div>
                          <div className="option-details">
                            <p>Invoice: {entry.invoiceNumber} | Due: {new Date(entry.dueDate).toLocaleDateString()}</p>
                            <p>Aging: {entry.agingDays} days | Status: {entry.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'forecast' && (
                    <div className="forecast-options">
                      {forecastedPayments.map(forecast => (
                        <div 
                          key={forecast.id}
                          className={`option-item ${selectedEntity === forecast.id ? 'selected' : ''}`}
                          onClick={() => setSelectedEntity(forecast.id)}
                        >
                          <div className="option-header">
                            <input 
                              type="radio" 
                              checked={selectedEntity === forecast.id}
                              onChange={() => setSelectedEntity(forecast.id)}
                            />
                            <strong>{forecast.vendorName}</strong>
                            <span className="amount">{formatAmount(forecast.expectedAmount)}</span>
                          </div>
                          <div className="option-details">
                            <p>Expected: {new Date(forecast.expectedDate).toLocaleDateString()} | Type: {forecast.paymentType}</p>
                            <p>Description: {forecast.description}</p>
                            <p>Confidence: {(forecast.confidence * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="notes-section">
            <label htmlFor="reconciliation-notes">Notes (Optional):</label>
            <textarea
              id="reconciliation-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this manual reconciliation..."
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button 
            className="btn-confirm" 
            onClick={handleManualMatch}
            disabled={!selectedEntity}
          >
            Match Selected
          </button>
        </div>
      </div>
    </div>
  );
}; 