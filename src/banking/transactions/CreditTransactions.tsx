/**
 * CREDIT TRANSACTIONS COMPONENT
 * 
 * Provides the user interface for:
 * - Viewing extracted credit transactions
 * - AI/LLM categorization results
 * - Auto-reconciliation with AR Aging and Forecasted Collections
 * - Manual reconciliation for unmatched entries
 * - Verification and confirmation workflow
 * - Observations and notes management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CreditTransaction, ARAgingEntry, ForecastedCollection } from '../../shared/types';
import { creditTransactionManagementService } from './CreditTransactionManagementService';
import { ErrorBoundary } from '../../ui/components/common/ErrorBoundary';
import './CreditTransactions.css';

interface CreditTransactionsProps {
  dataRefreshTrigger?: number;
}

export const CreditTransactions: React.FC<CreditTransactionsProps> = ({ dataRefreshTrigger }) => {
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<CreditTransaction | null>(null);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | CreditTransaction['reconciliationStatus'],
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

  const loadCreditTransactions = useCallback(async () => {
    try {
      setLoading(true);
      
      const filterOptions = filters.status === 'all' ? undefined : {
        status: filters.status,
        accountId: filters.accountId === 'all' ? undefined : filters.accountId,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined
      };

      const [transactions, summaryData] = await Promise.all([
        creditTransactionManagementService.getCreditTransactionsForDisplay(filterOptions),
        creditTransactionManagementService.getCreditTransactionsSummary()
      ]);

      setCreditTransactions(transactions);
      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to load credit transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadCreditTransactions();
  }, [loadCreditTransactions, dataRefreshTrigger]);

  const handleAutoReconciliation = async (transactionId: string) => {
    try {
      await creditTransactionManagementService.performAutoReconciliation(transactionId);
      await loadCreditTransactions();
    } catch (error) {
      console.error('Auto-reconciliation failed:', error);
      alert('Auto-reconciliation failed. Please try manual reconciliation.');
    }
  };

  const handleConfirmTransaction = async (transactionId: string, observations?: string) => {
    try {
      await creditTransactionManagementService.confirmTransaction(
        transactionId, 
        'current_user', // In a real app, this would come from user context
        observations
      );
      await loadCreditTransactions();
    } catch (error) {
      console.error('Transaction confirmation failed:', error);
      alert('Failed to confirm transaction.');
    }
  };

  const openReconciliationModal = (transaction: CreditTransaction) => {
    setSelectedTransaction(transaction);
    setShowReconciliationModal(true);
  };

  const getStatusBadge = (status: CreditTransaction['reconciliationStatus']) => {
    const badges = {
      'pending': { color: '#ff9800', text: 'Pending' },
      'auto_matched': { color: '#4caf50', text: 'Auto Matched' },
      'manually_matched': { color: '#2196f3', text: 'Manual Match' },
      'unknown_collection': { color: '#f44336', text: 'Unknown Collection' },
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

  const getCategoryTypeDisplay = (categoryType: CreditTransaction['categoryType']) => {
    const types = {
      'customer_payment': 'Customer Payment',
      'refund': 'Refund',
      'interest': 'Interest',
      'investment_maturity': 'Investment Maturity',
      'intercompany_in': 'Intercompany In',
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
      <div className="credit-transactions-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading credit transactions...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary componentName="CreditTransactions">
      <div className="credit-transactions-container">
        {/* Header and Summary */}
        <div className="credit-transactions-header">
          <h2>💰 Credit Transactions</h2>
          <p>Automatic extraction & reconciliation with AR Aging and Forecasted Collections</p>
          
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
        <div className="credit-transactions-filters">
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={filters.status} 
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="auto_matched">Auto Matched</option>
              <option value="manually_matched">Manual Match</option>
              <option value="unknown_collection">Unknown Collection</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>

          <div className="filter-group">
            <label>From Date:</label>
            <input 
              type="date" 
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            />
          </div>

          <div className="filter-group">
            <label>To Date:</label>
            <input 
              type="date" 
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            />
          </div>

          <button 
            className="filter-clear-btn"
            onClick={() => setFilters({
              status: 'all',
              accountId: 'all',
              dateFrom: '',
              dateTo: ''
            })}
          >
            Clear Filters
          </button>
        </div>

        {/* Transactions Table */}
        <div className="credit-transactions-table-container">
          {creditTransactions.length === 0 ? (
            <div className="no-transactions">
              <p>No credit transactions found.</p>
              <p>Import bank statements to automatically extract credit transactions.</p>
            </div>
          ) : (
            <table className="credit-transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Match Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {creditTransactions.map(transaction => (
                  <tr key={transaction.id} className={`transaction-row ${transaction.reconciliationStatus}`}>
                    <td>{formatDate(transaction.date)}</td>
                    <td>
                      <div className="transaction-description">
                        <span className="description-text">{transaction.description}</span>
                        <small className="reference">Ref: {transaction.reference}</small>
                      </div>
                    </td>
                    <td className="amount-cell">
                      {formatAmount(transaction.amount)}
                    </td>
                    <td>
                      <span className="category-type">
                        {getCategoryTypeDisplay(transaction.categoryType)}
                      </span>
                    </td>
                    <td>
                      {getStatusBadge(transaction.reconciliationStatus)}
                    </td>
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
                      {transaction.arAgingMatch && (
                        <div className="match-details">
                          <strong>AR:</strong> {transaction.arAgingMatch.customerName}
                          <br />
                          <small>Invoice: {transaction.arAgingMatch.invoiceNumber}</small>
                        </div>
                      )}
                      {transaction.forecastMatch && (
                        <div className="match-details">
                          <strong>Forecast:</strong> Expected {formatDate(transaction.forecastMatch.expectedDate)}
                          <br />
                          <small>Confidence: {transaction.forecastMatch.confidence}</small>
                        </div>
                      )}
                      {!transaction.arAgingMatch && !transaction.forecastMatch && (
                        <span className="no-match">No match</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {transaction.reconciliationStatus === 'pending' && (
                          <>
                            <button 
                              className="auto-reconcile-btn"
                              onClick={() => handleAutoReconciliation(transaction.id)}
                              title="Attempt auto-reconciliation"
                            >
                              🔄 Auto
                            </button>
                            <button 
                              className="manual-reconcile-btn"
                              onClick={() => openReconciliationModal(transaction)}
                              title="Manual reconciliation"
                            >
                              ✋ Manual
                            </button>
                          </>
                        )}
                        
                        {(['auto_matched', 'manually_matched'].includes(transaction.reconciliationStatus)) && (
                          <button 
                            className="confirm-btn"
                            onClick={() => {
                              const observations = prompt('Add any observations (optional):');
                              handleConfirmTransaction(transaction.id, observations || undefined);
                            }}
                            title="Confirm and clear transaction"
                          >
                            ✓ Confirm
                          </button>
                        )}

                        {transaction.reconciliationStatus === 'unknown_collection' && (
                          <button 
                            className="manual-reconcile-btn"
                            onClick={() => openReconciliationModal(transaction)}
                            title="Manual action required"
                          >
                            ⚠️ Action Required
                          </button>
                        )}

                        {transaction.reconciliationStatus === 'confirmed' && (
                          <span className="confirmed-indicator">
                            ✅ Verified
                            {transaction.verifiedBy && (
                              <small>by {transaction.verifiedBy}</small>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Verification Status Indicator */}
        <div className="verification-status">
          <h3>📋 Daily Verification Status</h3>
          <p>Each day should be reviewed and marked as verified once all transactions are reconciled.</p>
          <div className="verification-indicator">
            <span className="verification-date">Today ({new Date().toLocaleDateString()})</span>
            <span className="verification-mark">⩗ Verified</span>
          </div>
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
              loadCreditTransactions();
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

// Manual Reconciliation Modal Component
interface ManualReconciliationModalProps {
  transaction: CreditTransaction;
  onClose: () => void;
  onSuccess: () => void;
}

const ManualReconciliationModal: React.FC<ManualReconciliationModalProps> = ({
  transaction,
  onClose,
  onSuccess
}) => {
  const [arAgings, setARAgings] = useState<ARAgingEntry[]>([]);
  const [forecasts, setForecasts] = useState<ForecastedCollection[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<{
    id: string;
    type: 'ar_aging' | 'forecast';
  } | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMatchOptions = async () => {
      try {
        // Load AR Agings and Forecasted Collections for manual matching
        // This would typically come from the service
        setARAgings([
          {
            id: 'ar_001',
            customerId: 'cust_001',
            customerName: 'ABC Corporation',
            invoiceNumber: 'INV-2024-001',
            dueDate: '2024-12-15',
            amount: 25000.00,
            agingDays: 5,
            status: 'pending'
          }
        ]);

        setForecasts([
          {
            id: 'forecast_001',
            customerId: 'cust_003',
            expectedDate: '2024-12-25',
            amount: 30000.00,
            confidence: 'high',
            notes: 'Regular monthly payment from major client'
          }
        ]);
      } catch (error) {
        console.error('Failed to load match options:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMatchOptions();
  }, []);

  const handleManualMatch = async () => {
    if (!selectedMatch) {
      alert('Please select a match option.');
      return;
    }

    try {
      await creditTransactionManagementService.performManualReconciliation(
        transaction.id,
        selectedMatch.id,
        selectedMatch.type,
        notes
      );
      onSuccess();
    } catch (error) {
      console.error('Manual reconciliation failed:', error);
      alert('Manual reconciliation failed.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="reconciliation-modal">
        <div className="modal-header">
          <h3>Manual Reconciliation</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="transaction-details">
            <h4>Transaction Details</h4>
            <p><strong>Date:</strong> {new Date(transaction.date).toLocaleDateString()}</p>
            <p><strong>Description:</strong> {transaction.description}</p>
            <p><strong>Amount:</strong> {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(transaction.amount)}</p>
            <p><strong>Reference:</strong> {transaction.reference}</p>
          </div>

          {loading ? (
            <div className="modal-loading">Loading match options...</div>
          ) : (
            <div className="match-options">
              <h4>Select Match</h4>
              
              <div className="match-section">
                <h5>AR Aging Entries</h5>
                {arAgings.map(ar => (
                  <div 
                    key={ar.id} 
                    className={`match-option ${selectedMatch?.id === ar.id ? 'selected' : ''}`}
                    onClick={() => setSelectedMatch({ id: ar.id, type: 'ar_aging' })}
                  >
                    <input 
                      type="radio" 
                      name="match" 
                      value={ar.id}
                      checked={selectedMatch?.id === ar.id}
                      onChange={() => setSelectedMatch({ id: ar.id, type: 'ar_aging' })}
                    />
                    <div className="match-details">
                      <strong>{ar.customerName}</strong>
                      <p>Invoice: {ar.invoiceNumber} | Amount: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(ar.amount)}</p>
                      <p>Due: {new Date(ar.dueDate).toLocaleDateString()} | Aging: {ar.agingDays} days</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="match-section">
                <h5>Forecasted Collections</h5>
                {forecasts.map(forecast => (
                  <div 
                    key={forecast.id} 
                    className={`match-option ${selectedMatch?.id === forecast.id ? 'selected' : ''}`}
                    onClick={() => setSelectedMatch({ id: forecast.id, type: 'forecast' })}
                  >
                    <input 
                      type="radio" 
                      name="match" 
                      value={forecast.id}
                      checked={selectedMatch?.id === forecast.id}
                      onChange={() => setSelectedMatch({ id: forecast.id, type: 'forecast' })}
                    />
                    <div className="match-details">
                      <strong>Forecast {forecast.id}</strong>
                      <p>Amount: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(forecast.amount)}</p>
                      <p>Expected: {new Date(forecast.expectedDate).toLocaleDateString()} | Confidence: {forecast.confidence}</p>
                      {forecast.notes && <p><em>{forecast.notes}</em></p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="notes-section">
                <label htmlFor="notes">Notes (optional):</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this manual reconciliation..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button 
            className="confirm-btn"
            onClick={handleManualMatch}
            disabled={!selectedMatch || loading}
          >
            Confirm Match
          </button>
        </div>
      </div>
    </div>
  );
}; 