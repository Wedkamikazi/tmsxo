/**
 * DAILY CASH MANAGEMENT COMPONENT
 * 
 * Micro-Job 2.1.5: Basic UI Component Structure
 * 
 * Central dashboard that integrates all transaction types into unified daily view.
 * Provides daily balance reconciliation, discrepancy detection, and verification workflow.
 * 
 * Features:
 * - Interactive daily cash management table (15 columns)
 * - Summary dashboard cards
 * - Date range filtering and account selection
 * - Real-time updates via event system
 * - Verification workflow with observations
 * - Export functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DailyCashEntry } from '../types';
import { dailyCashManagementService } from '../services/dailyCashManagementService';
import { eventBus } from '../services/eventBus';
import { ErrorBoundary } from './ErrorBoundary';
import './DailyCashManagement.css';

interface DailyCashManagementProps {
  dataRefreshTrigger?: number;
}

export const DailyCashManagement: React.FC<DailyCashManagementProps> = ({ dataRefreshTrigger }) => {
  // =============================================
  // STATE MANAGEMENT
  // =============================================

  const [dailyCashEntries, setDailyCashEntries] = useState<DailyCashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DailyCashEntry | null>(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    accountId: 'all',
    isVerified: undefined as boolean | undefined
  });

  // Summary statistics
  const [summary, setSummary] = useState({
    totalEntries: 0,
    verifiedEntries: 0,
    unverifiedEntries: 0,
    totalDiscrepancies: 0,
    averageDiscrepancy: 0,
    dateRange: null as { from: string; to: string } | null
  });

  // Balance statistics
  const [balanceStats, setBalanceStats] = useState({
    totalCashIn: 0,
    totalCashOut: 0,
    totalDiscrepancies: 0,
    averageDiscrepancy: 0,
    maxDiscrepancy: 0,
    entriesWithDiscrepancies: 0,
    discrepancyPercentage: 0
  });

  // Service integration status
  const [integrationStatus, setIntegrationStatus] = useState({
    creditTransactionService: false,
    debitTransactionService: false,
    hrPaymentService: false,
    unifiedBalanceService: false,
    unifiedDataService: false,
    integrationScore: 0
  });

  // UI states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');

  // =============================================
  // DATA LOADING
  // =============================================

  const loadDailyCashData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filter options
      const filterOptions = {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        accountId: filters.accountId === 'all' ? undefined : filters.accountId,
        isVerified: filters.isVerified
      };

      // Load data in parallel
      const [entries, summaryData, integrationData] = await Promise.all([
        dailyCashManagementService.getDailyCashEntriesForDisplay(filterOptions),
        dailyCashManagementService.getDailyCashSummary(),
        dailyCashManagementService.checkServiceIntegration()
      ]);

      setDailyCashEntries(entries);
      setSummary(summaryData);
      setIntegrationStatus(integrationData);

      // Calculate balance statistics
      const balanceStatsData = await dailyCashManagementService.getBalanceSummaryStats(entries);
      setBalanceStats(balanceStatsData);

    } catch (error) {
      console.error('Failed to load daily cash data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load daily cash data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDailyCashData();
  }, [loadDailyCashData, dataRefreshTrigger]);

  // =============================================
  // EVENT LISTENERS
  // =============================================

  useEffect(() => {
    const handleDailyCashUpdate = () => {
      loadDailyCashData();
    };

    // Subscribe to events
    eventBus.on('DAILY_CASH_ENTRY_UPDATED', handleDailyCashUpdate);
    eventBus.on('DAILY_CASH_ENTRIES_GENERATED', handleDailyCashUpdate);
    eventBus.on('DAILY_CASH_BALANCES_RECALCULATED', handleDailyCashUpdate);
    eventBus.on('DAILY_CASH_DAY_VERIFIED', handleDailyCashUpdate);

    return () => {
      eventBus.off('DAILY_CASH_ENTRY_UPDATED', handleDailyCashUpdate);
      eventBus.off('DAILY_CASH_ENTRIES_GENERATED', handleDailyCashUpdate);
      eventBus.off('DAILY_CASH_BALANCES_RECALCULATED', handleDailyCashUpdate);
      eventBus.off('DAILY_CASH_DAY_VERIFIED', handleDailyCashUpdate);
    };
  }, [loadDailyCashData]);

  // =============================================
  // ACTION HANDLERS
  // =============================================

  const handleGenerateEntries = async () => {
    try {
      setLoading(true);
      
      const dateFrom = filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dateTo = filters.dateTo || new Date().toISOString().split('T')[0];
      
      await dailyCashManagementService.generateDailyCashEntries(dateFrom, dateTo);
      await loadDailyCashData();
      
    } catch (error) {
      console.error('Failed to generate entries:', error);
      setError('Failed to generate daily cash entries');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateBalances = async () => {
    try {
      setLoading(true);
      
      const dateFrom = filters.dateFrom || undefined;
      const dateTo = filters.dateTo || undefined;
      const accountIds = filters.accountId === 'all' ? undefined : [filters.accountId];
      
      await dailyCashManagementService.recalculateBalances(dateFrom, dateTo, accountIds);
      await loadDailyCashData();
      
    } catch (error) {
      console.error('Failed to recalculate balances:', error);
      setError('Failed to recalculate balances');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDay = async (entry: DailyCashEntry) => {
    setSelectedEntry(entry);
    setVerificationNotes('');
    setShowVerificationModal(true);
  };

  const handleConfirmVerification = async () => {
    if (!selectedEntry) return;

    try {
      await dailyCashManagementService.markDayAsVerified(
        selectedEntry.date,
        selectedEntry.accountNumber,
        'Current User', // In real app, get from auth context
        verificationNotes
      );
      
      setShowVerificationModal(false);
      setSelectedEntry(null);
      setVerificationNotes('');
      await loadDailyCashData();
      
    } catch (error) {
      console.error('Failed to verify day:', error);
      setError('Failed to verify day');
    }
  };

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getDiscrepancyColor = (discrepancy: number): string => {
    const absDiscrepancy = Math.abs(discrepancy);
    if (absDiscrepancy < 0.01) return 'text-green-600';
    if (absDiscrepancy < 1000) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getIntegrationStatusColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // =============================================
  // RENDER SUMMARY CARDS
  // =============================================

  const renderSummaryCards = () => (
    <div className="daily-cash-summary-grid">
      {/* Overview Card */}
      <div className="summary-card">
        <div className="card-header">
          <h3>Daily Cash Overview</h3>
          <i className="fas fa-chart-line"></i>
        </div>
        <div className="card-content">
          <div className="stat-row">
            <span>Total Entries:</span>
            <span className="stat-value">{summary.totalEntries}</span>
          </div>
          <div className="stat-row">
            <span>Verified:</span>
            <span className="stat-value text-green-600">{summary.verifiedEntries}</span>
          </div>
          <div className="stat-row">
            <span>Unverified:</span>
            <span className="stat-value text-yellow-600">{summary.unverifiedEntries}</span>
          </div>
          {summary.dateRange && (
            <div className="stat-row">
              <span>Date Range:</span>
              <span className="stat-value-small">{summary.dateRange.from} to {summary.dateRange.to}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cash Flow Card */}
      <div className="summary-card">
        <div className="card-header">
          <h3>Cash Flow Summary</h3>
          <i className="fas fa-exchange-alt"></i>
        </div>
        <div className="card-content">
          <div className="stat-row">
            <span>Total Cash In:</span>
            <span className="stat-value text-green-600">{formatCurrency(balanceStats.totalCashIn)}</span>
          </div>
          <div className="stat-row">
            <span>Total Cash Out:</span>
            <span className="stat-value text-red-600">{formatCurrency(balanceStats.totalCashOut)}</span>
          </div>
          <div className="stat-row">
            <span>Net Movement:</span>
            <span className={`stat-value ${balanceStats.totalCashIn - balanceStats.totalCashOut >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(balanceStats.totalCashIn - balanceStats.totalCashOut)}
            </span>
          </div>
        </div>
      </div>

      {/* Discrepancy Card */}
      <div className="summary-card">
        <div className="card-header">
          <h3>Discrepancy Analysis</h3>
          <i className="fas fa-exclamation-triangle"></i>
        </div>
        <div className="card-content">
          <div className="stat-row">
            <span>Entries with Discrepancies:</span>
            <span className="stat-value text-red-600">{balanceStats.entriesWithDiscrepancies}</span>
          </div>
          <div className="stat-row">
            <span>Discrepancy Rate:</span>
            <span className="stat-value text-yellow-600">{balanceStats.discrepancyPercentage.toFixed(1)}%</span>
          </div>
          <div className="stat-row">
            <span>Max Discrepancy:</span>
            <span className="stat-value text-red-600">{formatCurrency(balanceStats.maxDiscrepancy)}</span>
          </div>
          <div className="stat-row">
            <span>Avg Discrepancy:</span>
            <span className="stat-value text-yellow-600">{formatCurrency(balanceStats.averageDiscrepancy)}</span>
          </div>
        </div>
      </div>

      {/* Integration Status Card */}
      <div className="summary-card">
        <div className="card-header">
          <h3>System Integration</h3>
          <i className="fas fa-cogs"></i>
        </div>
        <div className="card-content">
          <div className="stat-row">
            <span>Integration Score:</span>
            <span className={`stat-value ${getIntegrationStatusColor(integrationStatus.integrationScore)}`}>
              {integrationStatus.integrationScore.toFixed(0)}%
            </span>
          </div>
          <div className="service-status">
            <div className={`service-indicator ${integrationStatus.creditTransactionService ? 'active' : 'inactive'}`}>
              Credit Transactions
            </div>
            <div className={`service-indicator ${integrationStatus.debitTransactionService ? 'active' : 'inactive'}`}>
              Debit Transactions
            </div>
            <div className={`service-indicator ${integrationStatus.hrPaymentService ? 'active' : 'inactive'}`}>
              HR Payments
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // =============================================
  // MAIN RENDER
  // =============================================

  if (loading) {
    return (
      <div className="daily-cash-loading">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
        </div>
        <p>Loading Daily Cash Management...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="daily-cash-error">
        <div className="error-content">
          <i className="fas fa-exclamation-circle"></i>
          <h3>Error Loading Daily Cash Data</h3>
          <p>{error}</p>
          <button onClick={() => loadDailyCashData()} className="retry-button">
            <i className="fas fa-redo"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="daily-cash-management">
        {/* Header */}
        <div className="daily-cash-header">
          <div className="header-content">
            <h1>
              <i className="fas fa-table"></i>
              Daily Cash Management
            </h1>
            <p>Unified daily cash reconciliation and balance management</p>
          </div>
          <div className="header-actions">
            <button 
              onClick={handleGenerateEntries}
              className="action-button primary"
              disabled={loading}
            >
              <i className="fas fa-plus"></i>
              Generate Entries
            </button>
            <button 
              onClick={handleRecalculateBalances}
              className="action-button secondary"
              disabled={loading}
            >
              <i className="fas fa-calculator"></i>
              Recalculate
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {renderSummaryCards()}

        {/* Daily Cash Management Table */}
        <div className="daily-cash-table-section">
          <div className="section-header">
            <h2>Daily Cash Entries</h2>
            <span className="entry-count">{dailyCashEntries.length} entries</span>
          </div>
          
          {dailyCashEntries.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-table"></i>
              <h3>No Daily Cash Entries Found</h3>
              <p>Generate entries to see daily cash management data</p>
              <button 
                onClick={handleGenerateEntries}
                className="action-button primary"
              >
                <i className="fas fa-plus"></i>
                Generate Entries for Last 30 Days
              </button>
            </div>
          ) : (
            <div className="table-container">
              <div className="table-wrapper">
                <table className="daily-cash-table">
                  <thead>
                    <tr>
                      <th className="col-date">Date</th>
                      <th className="col-bank">Bank Name</th>
                      <th className="col-account">Account No</th>
                      <th className="col-currency">Currency</th>
                      <th className="col-balance">Opening Balance</th>
                      <th className="col-cash-in">Cash In<br/><small>(AR/Other)</small></th>
                      <th className="col-cash-out">Cash Out<br/><small>(AP/HR/Other)</small></th>
                      <th className="col-interco">Interco In</th>
                      <th className="col-interco">Interco Out</th>
                      <th className="col-deposit">Time Deposit Out</th>
                      <th className="col-deposit">Time Deposit In<br/><small>(Matured)</small></th>
                      <th className="col-balance">Closing Balance<br/><small>(Actual)</small></th>
                      <th className="col-balance">Projected Closing<br/><small>Balance</small></th>
                      <th className="col-discrepancy">Discrepancy</th>
                      <th className="col-notes">Notes/<br/>Observations</th>
                      <th className="col-verified">⩗ Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyCashEntries.map((entry) => (
                      <tr key={entry.id} className={entry.isVerified ? 'verified-row' : ''}>
                        {/* Date */}
                        <td className="col-date">
                          <div className="date-cell">
                            <span className="date-main">{new Date(entry.date).toLocaleDateString('en-GB')}</span>
                            <span className="date-day">{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          </div>
                        </td>
                        
                        {/* Bank Name */}
                        <td className="col-bank">
                          <div className="bank-cell">
                            <i className="fas fa-university"></i>
                            <span>{entry.bankName}</span>
                          </div>
                        </td>
                        
                        {/* Account Number */}
                        <td className="col-account">
                          <div className="account-cell">
                            <span className="account-number">{entry.accountNumber}</span>
                          </div>
                        </td>
                        
                        {/* Currency */}
                        <td className="col-currency">
                          <span className="currency-badge">{entry.currency}</span>
                        </td>
                        
                        {/* Opening Balance */}
                        <td className="col-balance">
                          <div className="balance-cell">
                            <span className={`balance-amount ${entry.openingBalance >= 0 ? 'positive' : 'negative'}`}>
                              {formatCurrency(entry.openingBalance)}
                            </span>
                          </div>
                        </td>
                        
                        {/* Cash In */}
                        <td className="col-cash-in">
                          <div className="cash-flow-cell positive">
                            {entry.cashIn > 0 && <i className="fas fa-arrow-down"></i>}
                            <span>{formatCurrency(entry.cashIn)}</span>
                          </div>
                        </td>
                        
                        {/* Cash Out */}
                        <td className="col-cash-out">
                          <div className="cash-flow-cell negative">
                            {entry.cashOut > 0 && <i className="fas fa-arrow-up"></i>}
                            <span>{formatCurrency(entry.cashOut)}</span>
                          </div>
                        </td>
                        
                        {/* Intercompany In */}
                        <td className="col-interco">
                          <div className="interco-cell positive">
                            {entry.intercoIn > 0 && <i className="fas fa-exchange-alt"></i>}
                            <span>{formatCurrency(entry.intercoIn)}</span>
                          </div>
                        </td>
                        
                        {/* Intercompany Out */}
                        <td className="col-interco">
                          <div className="interco-cell negative">
                            {entry.intercoOut > 0 && <i className="fas fa-exchange-alt"></i>}
                            <span>{formatCurrency(entry.intercoOut)}</span>
                          </div>
                        </td>
                        
                        {/* Time Deposit Out */}
                        <td className="col-deposit">
                          <div className="deposit-cell negative">
                            {entry.timeDepositOut > 0 && <i className="fas fa-piggy-bank"></i>}
                            <span>{formatCurrency(entry.timeDepositOut)}</span>
                          </div>
                        </td>
                        
                        {/* Time Deposit In (Matured) */}
                        <td className="col-deposit">
                          <div className="deposit-cell positive">
                            {entry.timeDepositIn > 0 && <i className="fas fa-coins"></i>}
                            <span>{formatCurrency(entry.timeDepositIn)}</span>
                          </div>
                        </td>
                        
                        {/* Closing Balance (Actual) */}
                        <td className="col-balance">
                          <div className="balance-cell">
                            <span className={`balance-amount ${entry.closingBalanceActual >= 0 ? 'positive' : 'negative'}`}>
                              {formatCurrency(entry.closingBalanceActual)}
                            </span>
                          </div>
                        </td>
                        
                        {/* Projected Closing Balance */}
                        <td className="col-balance">
                          <div className="balance-cell">
                            <span className={`balance-amount projected ${entry.closingBalanceProjected >= 0 ? 'positive' : 'negative'}`}>
                              {formatCurrency(entry.closingBalanceProjected)}
                            </span>
                          </div>
                        </td>
                        
                        {/* Discrepancy */}
                        <td className="col-discrepancy">
                          <div className={`discrepancy-cell ${getDiscrepancyColor(entry.discrepancy).replace('text-', '')}`}>
                            {Math.abs(entry.discrepancy) > 0.01 && (
                              <i className="fas fa-exclamation-triangle"></i>
                            )}
                            <span>{formatCurrency(entry.discrepancy)}</span>
                            {Math.abs(entry.discrepancy) > 0.01 && (
                              <div className="discrepancy-badge">
                                {Math.abs(entry.discrepancy) > 1000 ? 'HIGH' : 'MEDIUM'}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Notes/Observations */}
                        <td className="col-notes">
                          <div className="notes-cell">
                            {entry.observations && (
                              <div className="notes-content">
                                <i className="fas fa-sticky-note"></i>
                                <span title={entry.observations}>
                                  {entry.observations.length > 30 
                                    ? `${entry.observations.substring(0, 30)}...` 
                                    : entry.observations}
                                </span>
                              </div>
                            )}
                            {entry.notes && (
                              <div className="notes-content">
                                <i className="fas fa-comment"></i>
                                <span title={entry.notes}>
                                  {entry.notes.length > 30 
                                    ? `${entry.notes.substring(0, 30)}...` 
                                    : entry.notes}
                                </span>
                              </div>
                            )}
                            {!entry.observations && !entry.notes && (
                              <span className="no-notes">—</span>
                            )}
                          </div>
                        </td>
                        
                        {/* Verification Status */}
                        <td className="col-verified">
                          <div className="verification-cell">
                            {entry.isVerified ? (
                              <div className="verified-status">
                                <i className="fas fa-check-circle"></i>
                                <span className="verified-text">Verified</span>
                                {entry.verifiedDate && (
                                  <div className="verified-details">
                                    <small>{new Date(entry.verifiedDate).toLocaleDateString()}</small>
                                    {entry.verifiedBy && <small>by {entry.verifiedBy}</small>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                className="verify-button"
                                onClick={() => handleVerifyDay(entry)}
                                title="Mark day as verified"
                              >
                                <i className="fas fa-check"></i>
                                Verify
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Table Footer with Summary */}
              <div className="table-footer">
                <div className="table-summary">
                  <div className="summary-item">
                    <span>Total Cash In:</span>
                    <span className="positive">{formatCurrency(balanceStats.totalCashIn)}</span>
                  </div>
                  <div className="summary-item">
                    <span>Total Cash Out:</span>
                    <span className="negative">{formatCurrency(balanceStats.totalCashOut)}</span>
                  </div>
                  <div className="summary-item">
                    <span>Net Movement:</span>
                    <span className={balanceStats.totalCashIn - balanceStats.totalCashOut >= 0 ? 'positive' : 'negative'}>
                      {formatCurrency(balanceStats.totalCashIn - balanceStats.totalCashOut)}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span>Entries with Discrepancies:</span>
                    <span className="warning">{balanceStats.entriesWithDiscrepancies}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Verification Modal - Placeholder */}
        {showVerificationModal && (
          <div className="modal-overlay">
            <div className="verification-modal">
              <h3>Verify Daily Cash Entry</h3>
              <p>Verification modal will be implemented in Micro-Job 2.1.9</p>
              <button onClick={() => setShowVerificationModal(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default DailyCashManagement; 