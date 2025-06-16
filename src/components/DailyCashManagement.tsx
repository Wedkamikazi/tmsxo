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

        {/* Table Section - Placeholder for next micro-job */}
        <div className="daily-cash-table-section">
          <div className="section-header">
            <h2>Daily Cash Entries</h2>
            <span className="entry-count">{dailyCashEntries.length} entries</span>
          </div>
          
          {/* Table will be implemented in Micro-Job 2.1.6 */}
          <div className="table-placeholder">
            <i className="fas fa-table"></i>
            <p>Daily Cash Table will be implemented in the next micro-job</p>
            <p className="placeholder-detail">
              Will include all 15 columns: Date, Bank, Account, Currency, Opening Balance, 
              Cash In/Out, Intercompany, Time Deposits, Projected/Actual Closing, Discrepancy, etc.
            </p>
          </div>
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