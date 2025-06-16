/**
 * TIME DEPOSIT MANAGEMENT COMPONENT
 * 
 * Dedicated interface for managing time deposits including:
 * - Active deposits tracking
 * - Maturity calendar
 * - Investment suggestions
 * - Performance analytics
 * - Placement and maturity reconciliation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TimeDeposit, InvestmentSuggestion } from '../types';
import { eventBus } from '../services/eventBus';
import { ErrorBoundary } from './ErrorBoundary';
import './TimeDepositManagement.css';

interface TimeDepositManagementProps {
  dataRefreshTrigger?: number;
}

export const TimeDepositManagement: React.FC<TimeDepositManagementProps> = ({ dataRefreshTrigger }) => {
  // =============================================
  // STATE MANAGEMENT
  // =============================================

  const [activeTab, setActiveTab] = useState<'overview' | 'active' | 'matured' | 'suggestions' | 'calendar'>('overview');
  const [timeDeposits, setTimeDeposits] = useState<TimeDeposit[]>([]);
  const [investmentSuggestions, setInvestmentSuggestions] = useState<InvestmentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    accountId: '',
    bankName: '',
    status: 'all' as 'all' | 'active' | 'matured' | 'cancelled',
    minAmount: '',
    maxAmount: ''
  });

  // Summary statistics
  const [summary, setSummary] = useState({
    totalDeposits: 0,
    activeDeposits: 0,
    maturedDeposits: 0,
    totalPrincipal: 0,
    totalMaturedAmount: 0,
    averageInterestRate: 0,
    totalInterestEarned: 0,
    utilizationRate: 0
  });

  // =============================================
  // DATA LOADING
  // =============================================

  const loadTimeDepositData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filter options
      const filterOptions = {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        accountId: filters.accountId || undefined,
        bankName: filters.bankName || undefined,
        status: filters.status === 'all' ? undefined : filters.status
      };

      // Import time deposit service dynamically
      const { timeDepositService } = await import('../services/timeDepositService');

      // Load data in parallel
      const [deposits, summaryData] = await Promise.all([
        timeDepositService.getAllTimeDeposits(filterOptions),
        timeDepositService.getTimeDepositSummary()
      ]);

      // Apply amount filters
      let filteredDeposits = deposits;
      if (filters.minAmount) {
        filteredDeposits = filteredDeposits.filter((d: TimeDeposit) => d.principalAmount >= parseFloat(filters.minAmount));
      }
      if (filters.maxAmount) {
        filteredDeposits = filteredDeposits.filter((d: TimeDeposit) => d.principalAmount <= parseFloat(filters.maxAmount));
      }

      setTimeDeposits(filteredDeposits);
      setSummary(summaryData);

      // Load investment suggestions if in suggestions tab
      if (activeTab === 'suggestions') {
        const suggestions = await timeDepositService.generateInvestmentSuggestions('1001', 10000000); // Sample
        setInvestmentSuggestions(suggestions);
      }

    } catch (error) {
      console.error('Failed to load time deposit data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load time deposit data');
    } finally {
      setLoading(false);
    }
  }, [filters, activeTab]);

  useEffect(() => {
    loadTimeDepositData();
  }, [loadTimeDepositData, dataRefreshTrigger]);

  // =============================================
  // EVENT LISTENERS
  // =============================================

  useEffect(() => {
    const handleTimeDepositUpdate = () => {
      loadTimeDepositData();
    };

    // Subscribe to events
    eventBus.on('TIME_DEPOSITS_EXTRACTED', handleTimeDepositUpdate);
    eventBus.on('INVESTMENT_SUGGESTIONS_GENERATED', handleTimeDepositUpdate);

    return () => {
      // Cleanup listeners
    };
  }, [loadTimeDepositData]);

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const getDaysToMaturity = (maturityDate: string): number => {
    const today = new Date();
    const maturity = new Date(maturityDate);
    return Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'matured': return 'text-blue-600';
      case 'cancelled': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getMaturityStatus = (deposit: TimeDeposit): { status: string; color: string; days: number } => {
    if (deposit.status === 'matured') {
      return { status: 'Matured', color: 'text-blue-600', days: 0 };
    }
    
    const days = getDaysToMaturity(deposit.maturityDate);
    if (days < 0) {
      return { status: 'Overdue', color: 'text-red-600', days: Math.abs(days) };
    } else if (days <= 7) {
      return { status: 'Due Soon', color: 'text-yellow-600', days };
    } else {
      return { status: 'Active', color: 'text-green-600', days };
    }
  };

  // =============================================
  // FILTER FUNCTIONS
  // =============================================

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      accountId: '',
      bankName: '',
      status: 'all',
      minAmount: '',
      maxAmount: ''
    });
  };

  const hasActiveFilters = () => {
    return filters.dateFrom || filters.dateTo || filters.accountId || 
           filters.bankName || filters.status !== 'all' || 
           filters.minAmount || filters.maxAmount;
  };

  // =============================================
  // RENDER FILTER SECTION
  // =============================================

  const renderFilterSection = () => (
    <div className="time-deposit-filters">
      <div className="filters-header">
        <h3>
          <i className="fas fa-filter"></i>
          Filters
        </h3>
        {hasActiveFilters() && (
          <button className="clear-filters-btn" onClick={clearFilters}>
            <i className="fas fa-times"></i>
            Clear All
          </button>
        )}
      </div>
      
      <div className="filters-grid">
        {/* Date Range Filters */}
        <div className="filter-group">
          <label className="filter-label">Date Range</label>
          <div className="date-range-inputs">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="filter-input date-input"
              placeholder="From Date"
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="filter-input date-input"
              placeholder="To Date"
            />
          </div>
        </div>

        {/* Account Filter */}
        <div className="filter-group">
          <label className="filter-label">Account</label>
          <select
            value={filters.accountId}
            onChange={(e) => handleFilterChange('accountId', e.target.value)}
            className="filter-select"
          >
            <option value="">All Accounts</option>
            <option value="1001">Main Operating Account (1001)</option>
            <option value="1002">Investment Account (1002)</option>
            <option value="1003">Reserve Account (1003)</option>
          </select>
        </div>

        {/* Bank Filter */}
        <div className="filter-group">
          <label className="filter-label">Bank</label>
          <select
            value={filters.bankName}
            onChange={(e) => handleFilterChange('bankName', e.target.value)}
            className="filter-select"
          >
            <option value="">All Banks</option>
            <option value="Saudi National Bank">Saudi National Bank</option>
            <option value="Al Rajhi Bank">Al Rajhi Bank</option>
            <option value="Riyad Bank">Riyad Bank</option>
            <option value="SABB">SABB</option>
            <option value="Banque Saudi Fransi">Banque Saudi Fransi</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-group">
          <label className="filter-label">Status</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="matured">Matured Only</option>
            <option value="cancelled">Cancelled Only</option>
          </select>
        </div>

        {/* Amount Range Filters */}
        <div className="filter-group">
          <label className="filter-label">Amount Range (SAR)</label>
          <div className="amount-range-inputs">
            <input
              type="number"
              value={filters.minAmount}
              onChange={(e) => handleFilterChange('minAmount', e.target.value)}
              className="filter-input amount-input"
              placeholder="Min Amount"
              min="0"
              step="1000"
            />
            <span className="amount-separator">to</span>
            <input
              type="number"
              value={filters.maxAmount}
              onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
              className="filter-input amount-input"
              placeholder="Max Amount"
              min="0"
              step="1000"
            />
          </div>
        </div>

        {/* Quick Filters */}
        <div className="filter-group">
          <label className="filter-label">Quick Filters</label>
          <div className="quick-filters">
            <button 
              className={`quick-filter-btn ${filters.status === 'active' ? 'active' : ''}`}
              onClick={() => handleFilterChange('status', filters.status === 'active' ? 'all' : 'active')}
            >
              <i className="fas fa-clock"></i>
              Active Only
            </button>
            <button 
              className={`quick-filter-btn ${filters.minAmount === '1000000' ? 'active' : ''}`}
              onClick={() => handleFilterChange('minAmount', filters.minAmount === '1000000' ? '' : '1000000')}
            >
              <i className="fas fa-coins"></i>
              1M+ SAR
            </button>
            <button 
              className={`quick-filter-btn ${getDaysToMaturity(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) <= 7 ? 'active' : ''}`}
              onClick={() => {
                const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                handleFilterChange('dateTo', filters.dateTo === nextWeek ? '' : nextWeek);
              }}
            >
              <i className="fas fa-exclamation-triangle"></i>
              Due Soon
            </button>
          </div>
        </div>
      </div>

      {/* Filter Summary */}
      {hasActiveFilters() && (
        <div className="filter-summary">
          <div className="filter-summary-content">
            <span className="filter-summary-label">
              <i className="fas fa-info-circle"></i>
              Active Filters:
            </span>
            <div className="active-filters-list">
              {filters.dateFrom && (
                <span className="filter-tag">
                  From: {formatDate(filters.dateFrom)}
                  <button onClick={() => handleFilterChange('dateFrom', '')}>
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              )}
              {filters.dateTo && (
                <span className="filter-tag">
                  To: {formatDate(filters.dateTo)}
                  <button onClick={() => handleFilterChange('dateTo', '')}>
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              )}
              {filters.accountId && (
                <span className="filter-tag">
                  Account: {filters.accountId}
                  <button onClick={() => handleFilterChange('accountId', '')}>
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              )}
              {filters.bankName && (
                <span className="filter-tag">
                  Bank: {filters.bankName}
                  <button onClick={() => handleFilterChange('bankName', '')}>
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              )}
              {filters.status !== 'all' && (
                <span className="filter-tag">
                  Status: {filters.status}
                  <button onClick={() => handleFilterChange('status', 'all')}>
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              )}
              {filters.minAmount && (
                <span className="filter-tag">
                  Min: {formatCurrency(parseFloat(filters.minAmount))}
                  <button onClick={() => handleFilterChange('minAmount', '')}>
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              )}
              {filters.maxAmount && (
                <span className="filter-tag">
                  Max: {formatCurrency(parseFloat(filters.maxAmount))}
                  <button onClick={() => handleFilterChange('maxAmount', '')}>
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              )}
            </div>
          </div>
          <div className="filter-results-count">
            <span className="results-count">
              {timeDeposits.length} result{timeDeposits.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>
      )}
    </div>
  );

  // =============================================
  // RENDER SUMMARY CARDS
  // =============================================

  const renderSummaryCards = () => (
    <div className="time-deposit-summary-grid">
      {/* Portfolio Overview */}
      <div className="summary-card">
        <div className="card-header">
          <h3>Portfolio Overview</h3>
          <i className="fas fa-chart-pie"></i>
        </div>
        <div className="card-content">
          <div className="stat-row">
            <span>Total Deposits:</span>
            <span className="stat-value">{summary.totalDeposits}</span>
          </div>
          <div className="stat-row">
            <span>Active:</span>
            <span className="stat-value text-green-600">{summary.activeDeposits}</span>
          </div>
          <div className="stat-row">
            <span>Matured:</span>
            <span className="stat-value text-blue-600">{summary.maturedDeposits}</span>
          </div>
          <div className="stat-row">
            <span>Utilization:</span>
            <span className="stat-value">{formatPercentage(summary.utilizationRate)}</span>
          </div>
        </div>
      </div>

      {/* Investment Value */}
      <div className="summary-card">
        <div className="card-header">
          <h3>Investment Value</h3>
          <i className="fas fa-coins"></i>
        </div>
        <div className="card-content">
          <div className="stat-row">
            <span>Total Principal:</span>
            <span className="stat-value">{formatCurrency(summary.totalPrincipal)}</span>
          </div>
          <div className="stat-row">
            <span>Matured Value:</span>
            <span className="stat-value text-green-600">{formatCurrency(summary.totalMaturedAmount)}</span>
          </div>
          <div className="stat-row">
            <span>Interest Earned:</span>
            <span className="stat-value text-green-600">{formatCurrency(summary.totalInterestEarned)}</span>
          </div>
          <div className="stat-row">
            <span>Avg Interest Rate:</span>
            <span className="stat-value">{formatPercentage(summary.averageInterestRate)}</span>
          </div>
        </div>
      </div>

      {/* Maturity Calendar */}
      <div className="summary-card">
        <div className="card-header">
          <h3>Upcoming Maturities</h3>
          <i className="fas fa-calendar-alt"></i>
        </div>
        <div className="card-content">
          {timeDeposits.filter(d => d.status === 'active').slice(0, 3).map(deposit => {
            const maturityStatus = getMaturityStatus(deposit);
            return (
              <div key={deposit.id} className="stat-row">
                <span>{formatDate(deposit.maturityDate)}:</span>
                <span className={`stat-value-small ${maturityStatus.color}`}>
                  {formatCurrency(deposit.principalAmount)} ({maturityStatus.days}d)
                </span>
              </div>
            );
          })}
          {timeDeposits.filter(d => d.status === 'active').length === 0 && (
            <div className="stat-row">
              <span className="text-gray-500">No active deposits</span>
            </div>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="summary-card">
        <div className="card-header">
          <h3>Performance</h3>
          <i className="fas fa-chart-line"></i>
        </div>
        <div className="card-content">
          <div className="stat-row">
            <span>ROI (Annualized):</span>
            <span className="stat-value text-green-600">
              {summary.totalPrincipal > 0 ? 
                formatPercentage((summary.totalInterestEarned / summary.totalPrincipal) * 365 / 30) : 
                '0.00%'}
            </span>
          </div>
          <div className="stat-row">
            <span>Active Principal:</span>
            <span className="stat-value">
              {formatCurrency(timeDeposits.filter(d => d.status === 'active').reduce((sum, d) => sum + d.principalAmount, 0))}
            </span>
          </div>
          <div className="stat-row">
            <span>Avg Term:</span>
            <span className="stat-value">
              {timeDeposits.length > 0 ? Math.round(timeDeposits.reduce((sum, d) => {
                const days = Math.ceil((new Date(d.maturityDate).getTime() - new Date(d.placementDate).getTime()) / (1000 * 60 * 60 * 24));
                return sum + days;
              }, 0) / timeDeposits.length) : 0} days
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // =============================================
  // RENDER TAB CONTENT
  // =============================================

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'active':
        return renderActiveDepositsTab();
      case 'matured':
        return renderMaturedDepositsTab();
      case 'suggestions':
        return renderSuggestionsTab();
      case 'calendar':
        return renderCalendarTab();
      default:
        return null;
    }
  };

  const renderOverviewTab = () => (
    <div className="overview-content">
      <div className="section-header">
        <h2>All Time Deposits</h2>
        <span className="entry-count">{timeDeposits.length} deposits</span>
      </div>
      
      {timeDeposits.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-piggy-bank"></i>
          <h3>No Time Deposits Found</h3>
          <p>Import bank statements or create manual entries to see time deposit data</p>
        </div>
      ) : (
        <div className="table-container">
          <div className="table-wrapper">
            <table className="deposits-table">
              <thead>
                <tr>
                  <th>Deposit Number</th>
                  <th>Bank</th>
                  <th>Principal Amount</th>
                  <th>Interest Rate</th>
                  <th>Placement Date</th>
                  <th>Maturity Date</th>
                  <th>Status</th>
                  <th>Maturity Status</th>
                  <th>Expected Return</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {timeDeposits.map((deposit) => {
                  const maturityStatus = getMaturityStatus(deposit);
                  const termDays = Math.ceil((new Date(deposit.maturityDate).getTime() - new Date(deposit.placementDate).getTime()) / (1000 * 60 * 60 * 24));
                  const expectedReturn = deposit.principalAmount * (deposit.interestRate / 100) * (termDays / 365);
                  
                  return (
                    <tr key={deposit.id} className={deposit.status === 'active' ? 'active-deposit' : ''}>
                      <td>
                        <div className="deposit-number">
                          <span className="deposit-id">{deposit.depositNumber}</span>
                          <span className="deposit-ref">{deposit.placementReference}</span>
                        </div>
                      </td>
                      <td>
                        <div className="bank-info">
                          <i className="fas fa-university"></i>
                          <span>{deposit.bankName}</span>
                        </div>
                      </td>
                      <td className="amount-cell">
                        <span className="amount-value">{formatCurrency(deposit.principalAmount)}</span>
                      </td>
                      <td className="rate-cell">
                        <span className="rate-value">{formatPercentage(deposit.interestRate)}</span>
                      </td>
                      <td className="date-cell">
                        <span>{formatDate(deposit.placementDate)}</span>
                      </td>
                      <td className="date-cell">
                        <span>{formatDate(deposit.maturityDate)}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${deposit.status} ${getStatusColor(deposit.status)}`}>
                          {deposit.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`maturity-status ${maturityStatus.color}`}>
                          {maturityStatus.status}
                          {maturityStatus.days > 0 && ` (${maturityStatus.days}d)`}
                        </span>
                      </td>
                      <td className="amount-cell">
                        <span className="return-value text-green-600">
                          {deposit.status === 'matured' ? 
                            formatCurrency((deposit.maturedAmount || deposit.principalAmount) - deposit.principalAmount) :
                            formatCurrency(expectedReturn)
                          }
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button className="action-btn view" title="View Details">
                          <i className="fas fa-eye"></i>
                        </button>
                        {deposit.status === 'active' && maturityStatus.days <= 7 && (
                          <button className="action-btn mature" title="Mark as Matured">
                            <i className="fas fa-check"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderActiveDepositsTab = () => {
    const activeDeposits = timeDeposits.filter(d => d.status === 'active');
    
    return (
      <div className="active-deposits-content">
        <div className="section-header">
          <h2>Active Time Deposits</h2>
          <span className="entry-count">{activeDeposits.length} active deposits</span>
        </div>
        
        <div className="active-deposits-grid">
          {activeDeposits.map((deposit) => {
            const maturityStatus = getMaturityStatus(deposit);
            const termDays = Math.ceil((new Date(deposit.maturityDate).getTime() - new Date(deposit.placementDate).getTime()) / (1000 * 60 * 60 * 24));
            const expectedReturn = deposit.principalAmount * (deposit.interestRate / 100) * (termDays / 365);
            
            return (
              <div key={deposit.id} className={`deposit-card ${maturityStatus.status.toLowerCase().replace(' ', '-')}`}>
                <div className="card-header">
                  <div className="deposit-info">
                    <h3>{deposit.depositNumber}</h3>
                    <p>{deposit.bankName}</p>
                  </div>
                  <div className="deposit-status">
                    <span className={`status-indicator ${maturityStatus.status.toLowerCase().replace(' ', '-')}`}></span>
                    <span className={maturityStatus.color}>{maturityStatus.status}</span>
                  </div>
                </div>
                
                <div className="card-content">
                  <div className="deposit-amount">
                    <span className="amount-label">Principal Amount</span>
                    <span className="amount-value">{formatCurrency(deposit.principalAmount)}</span>
                  </div>
                  
                  <div className="deposit-details">
                    <div className="detail-row">
                      <span>Interest Rate:</span>
                      <span className="detail-value">{formatPercentage(deposit.interestRate)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Placement Date:</span>
                      <span className="detail-value">{formatDate(deposit.placementDate)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Maturity Date:</span>
                      <span className="detail-value">{formatDate(deposit.maturityDate)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Days to Maturity:</span>
                      <span className={`detail-value ${maturityStatus.color}`}>{maturityStatus.days} days</span>
                    </div>
                    <div className="detail-row">
                      <span>Expected Return:</span>
                      <span className="detail-value text-green-600">{formatCurrency(expectedReturn)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="card-actions">
                  <button className="action-button secondary">
                    <i className="fas fa-eye"></i>
                    View Details
                  </button>
                  {maturityStatus.days <= 7 && (
                    <button className="action-button primary">
                      <i className="fas fa-check"></i>
                      Mark Matured
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {activeDeposits.length === 0 && (
          <div className="empty-state">
            <i className="fas fa-clock"></i>
            <h3>No Active Deposits</h3>
            <p>All deposits have matured or there are no deposits to display</p>
          </div>
        )}
      </div>
    );
  };

  const renderMaturedDepositsTab = () => {
    const maturedDeposits = timeDeposits.filter(d => d.status === 'matured');
    
    return (
      <div className="matured-deposits-content">
        <div className="section-header">
          <h2>Matured Time Deposits</h2>
          <span className="entry-count">{maturedDeposits.length} matured deposits</span>
        </div>
        
        {/* Summary stats for matured deposits */}
        <div className="matured-summary">
          <div className="summary-item">
            <span>Total Principal:</span>
            <span className="value">{formatCurrency(maturedDeposits.reduce((sum, d) => sum + d.principalAmount, 0))}</span>
          </div>
          <div className="summary-item">
            <span>Total Matured Value:</span>
            <span className="value text-green-600">{formatCurrency(maturedDeposits.reduce((sum, d) => sum + (d.maturedAmount || d.principalAmount), 0))}</span>
          </div>
          <div className="summary-item">
            <span>Total Interest Earned:</span>
            <span className="value text-green-600">{formatCurrency(maturedDeposits.reduce((sum, d) => sum + ((d.maturedAmount || d.principalAmount) - d.principalAmount), 0))}</span>
          </div>
        </div>
        
        <div className="table-container">
          <div className="table-wrapper">
            <table className="deposits-table">
              <thead>
                <tr>
                  <th>Deposit Number</th>
                  <th>Bank</th>
                  <th>Principal Amount</th>
                  <th>Interest Rate</th>
                  <th>Placement Date</th>
                  <th>Maturity Date</th>
                  <th>Actual Maturity</th>
                  <th>Matured Amount</th>
                  <th>Interest Earned</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {maturedDeposits.map((deposit) => {
                  const interestEarned = (deposit.maturedAmount || deposit.principalAmount) - deposit.principalAmount;
                  const termDays = Math.ceil((new Date(deposit.actualMaturityDate || deposit.maturityDate).getTime() - new Date(deposit.placementDate).getTime()) / (1000 * 60 * 60 * 24));
                  const actualRate = termDays > 0 ? (interestEarned / deposit.principalAmount) * (365 / termDays) * 100 : 0;
                  
                  return (
                    <tr key={deposit.id} className="matured-deposit">
                      <td>
                        <div className="deposit-number">
                          <span className="deposit-id">{deposit.depositNumber}</span>
                          <span className="deposit-ref">{deposit.maturityReference}</span>
                        </div>
                      </td>
                      <td>
                        <div className="bank-info">
                          <i className="fas fa-university"></i>
                          <span>{deposit.bankName}</span>
                        </div>
                      </td>
                      <td className="amount-cell">
                        <span className="amount-value">{formatCurrency(deposit.principalAmount)}</span>
                      </td>
                      <td className="rate-cell">
                        <span className="rate-value">{formatPercentage(deposit.interestRate)}</span>
                      </td>
                      <td className="date-cell">
                        <span>{formatDate(deposit.placementDate)}</span>
                      </td>
                      <td className="date-cell">
                        <span>{formatDate(deposit.maturityDate)}</span>
                      </td>
                      <td className="date-cell">
                        <span>{formatDate(deposit.actualMaturityDate || deposit.maturityDate)}</span>
                      </td>
                      <td className="amount-cell">
                        <span className="amount-value text-green-600">{formatCurrency(deposit.maturedAmount || deposit.principalAmount)}</span>
                      </td>
                      <td className="amount-cell">
                        <span className="return-value text-green-600">{formatCurrency(interestEarned)}</span>
                      </td>
                      <td className="performance-cell">
                        <div className="performance-info">
                          <span className={`actual-rate ${actualRate >= deposit.interestRate ? 'text-green-600' : 'text-yellow-600'}`}>
                            {formatPercentage(actualRate)}
                          </span>
                          <span className="performance-indicator">
                            {actualRate >= deposit.interestRate ? '✓' : '⚠'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        {maturedDeposits.length === 0 && (
          <div className="empty-state">
            <i className="fas fa-history"></i>
            <h3>No Matured Deposits</h3>
            <p>No deposits have reached maturity yet</p>
          </div>
        )}
      </div>
    );
  };

  const renderSuggestionsTab = () => (
    <div className="suggestions-content">
      <div className="section-header">
        <h2>Investment Suggestions</h2>
        <button className="action-button primary" onClick={() => loadTimeDepositData()}>
          <i className="fas fa-refresh"></i>
          Refresh Suggestions
        </button>
      </div>
      
      <div className="suggestions-grid">
        {investmentSuggestions.map((suggestion, index) => (
          <div key={suggestion.id} className={`suggestion-card ${suggestion.riskLevel}`}>
            <div className="card-header">
              <div className="suggestion-info">
                <h3>{suggestion.suggestedTerm}-Day Placement</h3>
                <span className={`risk-badge ${suggestion.riskLevel}`}>
                  {suggestion.riskLevel.toUpperCase()}
                </span>
              </div>
              <div className="suggestion-amount">
                <span className="amount-value">{formatCurrency(suggestion.suggestedAmount)}</span>
              </div>
            </div>
            
            <div className="card-content">
              <div className="suggestion-details">
                <div className="detail-row">
                  <span>Suggested Term:</span>
                  <span className="detail-value">{suggestion.suggestedTerm} days</span>
                </div>
                <div className="detail-row">
                  <span>Projected Return:</span>
                  <span className="detail-value text-green-600">{formatCurrency(suggestion.projectedReturn)}</span>
                </div>
                <div className="detail-row">
                  <span>Available After:</span>
                  <span className="detail-value">{formatCurrency(suggestion.liquidity.availableAfterInvestment)}</span>
                </div>
                <div className="detail-row">
                  <span>Buffer Amount:</span>
                  <span className="detail-value">{formatCurrency(suggestion.liquidity.bufferAmount)}</span>
                </div>
              </div>
              
              <div className="suggestion-reasoning">
                <p>{suggestion.reasoning}</p>
              </div>
            </div>
            
            <div className="card-actions">
              <button className="action-button secondary">
                <i className="fas fa-eye"></i>
                View Details
              </button>
              <button className="action-button primary">
                <i className="fas fa-plus"></i>
                Create Placement
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {investmentSuggestions.length === 0 && (
        <div className="empty-state">
          <i className="fas fa-lightbulb"></i>
          <h3>No Investment Suggestions</h3>
          <p>Generate suggestions based on your current cash position and liquidity needs</p>
          <button className="action-button primary" onClick={() => loadTimeDepositData()}>
            <i className="fas fa-magic"></i>
            Generate Suggestions
          </button>
        </div>
      )}
    </div>
  );

  const renderCalendarTab = () => {
    const upcomingMaturities = timeDeposits
      .filter(d => d.status === 'active')
      .sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime());
    
    return (
      <div className="calendar-content">
        <div className="section-header">
          <h2>Maturity Calendar</h2>
          <span className="entry-count">{upcomingMaturities.length} upcoming maturities</span>
        </div>
        
        <div className="calendar-view">
          <div className="calendar-summary">
            <div className="calendar-stats">
              <div className="stat-item">
                <span className="stat-label">Next 7 Days:</span>
                <span className="stat-value text-red-600">
                  {upcomingMaturities.filter(d => getDaysToMaturity(d.maturityDate) <= 7).length}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Next 30 Days:</span>
                <span className="stat-value text-yellow-600">
                  {upcomingMaturities.filter(d => getDaysToMaturity(d.maturityDate) <= 30).length}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">This Quarter:</span>
                <span className="stat-value text-blue-600">
                  {upcomingMaturities.filter(d => getDaysToMaturity(d.maturityDate) <= 90).length}
                </span>
              </div>
            </div>
          </div>
          
          <div className="maturity-timeline">
            {upcomingMaturities.map((deposit) => {
              const daysToMaturity = getDaysToMaturity(deposit.maturityDate);
              const maturityStatus = getMaturityStatus(deposit);
              
              return (
                <div key={deposit.id} className={`timeline-item ${maturityStatus.status.toLowerCase().replace(' ', '-')}`}>
                  <div className="timeline-date">
                    <div className="date-display">
                      <span className="date-day">{new Date(deposit.maturityDate).getDate()}</span>
                      <span className="date-month">{new Date(deposit.maturityDate).toLocaleDateString('en-US', { month: 'short' })}</span>
                    </div>
                    <div className={`days-indicator ${maturityStatus.color}`}>
                      {daysToMaturity > 0 ? `${daysToMaturity}d` : 'Due'}
                    </div>
                  </div>
                  
                  <div className="timeline-content">
                    <div className="deposit-summary">
                      <h4>{deposit.depositNumber}</h4>
                      <p>{deposit.bankName}</p>
                    </div>
                    
                    <div className="deposit-details">
                      <div className="detail-item">
                        <span>Principal:</span>
                        <span className="value">{formatCurrency(deposit.principalAmount)}</span>
                      </div>
                      <div className="detail-item">
                        <span>Rate:</span>
                        <span className="value">{formatPercentage(deposit.interestRate)}</span>
                      </div>
                      <div className="detail-item">
                        <span>Expected Return:</span>
                        <span className="value text-green-600">
                          {formatCurrency(deposit.principalAmount * (deposit.interestRate / 100) * (Math.ceil((new Date(deposit.maturityDate).getTime() - new Date(deposit.placementDate).getTime()) / (1000 * 60 * 60 * 24)) / 365))}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="timeline-actions">
                    {daysToMaturity <= 7 && (
                      <button className="action-button primary small">
                        <i className="fas fa-bell"></i>
                        Alert Setup
                      </button>
                    )}
                    <button className="action-button secondary small">
                      <i className="fas fa-eye"></i>
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {upcomingMaturities.length === 0 && (
            <div className="empty-state">
              <i className="fas fa-calendar-check"></i>
              <h3>No Upcoming Maturities</h3>
              <p>All deposits have matured or there are no active deposits</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =============================================
  // MAIN RENDER
  // =============================================

  if (loading) {
    return (
      <div className="time-deposit-loading">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
        </div>
        <p>Loading Time Deposit Management...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="time-deposit-error">
        <div className="error-content">
          <i className="fas fa-exclamation-circle"></i>
          <h3>Error Loading Time Deposit Data</h3>
          <p>{error}</p>
          <button onClick={() => loadTimeDepositData()} className="retry-button">
            <i className="fas fa-redo"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="time-deposit-management">
        {/* Header */}
        <div className="time-deposit-header">
          <div className="header-content">
            <h1>
              <i className="fas fa-piggy-bank"></i>
              Time Deposit Management
            </h1>
            <p>Investment tracking, maturity management, and performance analytics</p>
          </div>
          <div className="header-actions">
            <button className="action-button primary">
              <i className="fas fa-plus"></i>
              New Placement
            </button>
            <button className="action-button secondary">
              <i className="fas fa-download"></i>
              Export
            </button>
          </div>
        </div>

        {/* Filter Section */}
        {renderFilterSection()}

        {/* Summary Cards */}
        {renderSummaryCards()}

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <div className="tab-buttons">
            <button 
              className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <i className="fas fa-list"></i>
              Overview
            </button>
            <button 
              className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              <i className="fas fa-clock"></i>
              Active ({summary.activeDeposits})
            </button>
            <button 
              className={`tab-button ${activeTab === 'matured' ? 'active' : ''}`}
              onClick={() => setActiveTab('matured')}
            >
              <i className="fas fa-check-circle"></i>
              Matured ({summary.maturedDeposits})
            </button>
            <button 
              className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''}`}
              onClick={() => setActiveTab('suggestions')}
            >
              <i className="fas fa-lightbulb"></i>
              Suggestions
            </button>
            <button 
              className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <i className="fas fa-calendar-alt"></i>
              Calendar
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {renderTabContent()}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default TimeDepositManagement; 