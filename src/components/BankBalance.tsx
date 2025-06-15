import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { unifiedBalanceService, type DailyBalance, type BalanceFilters, type BalanceStats } from '../services/unifiedBalanceService';
import { unifiedDataService } from '../services/unifiedDataService';
import { BankAccount } from '../types';
import './BankBalance.css';

interface BankBalanceProps {
  refreshTrigger?: number;
}

type SortField = 'date' | 'accountName' | 'closingBalance' | 'openingBalance' | 'dailyMovement' | 'transactionCount';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_ITEMS_PER_PAGE = 50;

export const BankBalance: React.FC<BankBalanceProps> = ({ refreshTrigger }) => {
  // State management
  const [balances, setBalances] = useState<DailyBalance[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Filtering state
  const [filters, setFilters] = useState<BalanceFilters>({
    accountId: '',
    dateFrom: '',
    dateTo: '',
    balanceFrom: '',
    balanceTo: '',
    movementFrom: '',
    movementTo: ''
  });

  // Load data on component mount and refresh
  const loadData = useCallback(async () => {
    try {
      // Show refreshing indicator if not initial load
      if (balances.length > 0) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Load bank accounts
      const accounts = unifiedDataService.getAllAccounts();
      setBankAccounts(accounts);
      
      // Load daily balances
      const dailyBalances = unifiedBalanceService.getDailyBalances();
      setBalances(dailyBalances);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bank balances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [balances.length]);

  useEffect(() => {
    loadData();
  }, [refreshTrigger]); // Only depend on refreshTrigger to avoid infinite loops

  // Initial load effect
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered and sorted balances
  const filteredAndSortedBalances = useMemo(() => {
    if (!balances || balances.length === 0) {
      return [];
    }
    
    // Apply filters
    const filtered = unifiedBalanceService.filterBalances(balances, filters);
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortField) {
        case 'date':
          aValue = a.date;
          bValue = b.date;
          break;
        case 'accountName':
          aValue = a.accountName;
          bValue = b.accountName;
          break;
        case 'closingBalance':
          aValue = a.closingBalance;
          bValue = b.closingBalance;
          break;
        case 'openingBalance':
          aValue = a.openingBalance;
          bValue = b.openingBalance;
          break;
        case 'dailyMovement':
          aValue = a.dailyMovement;
          bValue = b.dailyMovement;
          break;
        case 'transactionCount':
          aValue = a.transactionCount;
          bValue = b.transactionCount;
          break;
        default:
          aValue = a.date;
          bValue = b.date;
      }
      
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = Number(aValue) - Number(bValue);
      }
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
  }, [balances, filters, sortField, sortDirection]);

  // Paginated data
  const paginatedBalances = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedBalances.slice(startIndex, endIndex);
  }, [filteredAndSortedBalances, currentPage, itemsPerPage]);

  // Statistics
  const stats: BalanceStats = useMemo(() => {
    return unifiedBalanceService.getBalanceStats(filteredAndSortedBalances);
  }, [filteredAndSortedBalances]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedBalances.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredAndSortedBalances.length);

  // Event handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof BalanceFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      accountId: '',
      dateFrom: '',
      dateTo: '',
      balanceFrom: '',
      balanceTo: '',
      movementFrom: '',
      movementTo: ''
    });
    setCurrentPage(1);
  };

  const handleExport = () => {
    try {
      const csvContent = unifiedBalanceService.exportToCSV(filteredAndSortedBalances);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `bank_balances_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export data');
    }
  };

  // Utility functions
  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getAmountClass = (amount: number): string => {
    if (amount > 0) return 'amount-positive';
    if (amount < 0) return 'amount-negative';
    return 'amount-zero';
  };

  const getSortClass = (field: SortField): string => {
    if (sortField !== field) return 'sortable';
    return `sortable sorted-${sortDirection}`;
  };

  // Render loading state
  if (loading) {
    return (
      <div className="bank-balance-container">
        <div className="bank-balance-loading">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <p>Loading bank balances...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bank-balance-container">
        <div className="bank-balance-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadData();
            }}
            className="bank-balance-refresh-btn"
            style={{ marginTop: '16px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bank-balance-container">
      {/* Header */}
      <div className="bank-balance-header">
        <h1 className="bank-balance-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 12h.01M18 12h.01" />
          </svg>
          Bank Balance
        </h1>
        <div className="bank-balance-actions">
          <button
            onClick={loadData}
            disabled={refreshing}
            className="bank-balance-refresh-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={handleExport}
            className="bank-balance-export-btn"
            disabled={filteredAndSortedBalances.length === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Statistics */}
      {filteredAndSortedBalances.length > 0 && (
        <div className="bank-balance-stats">
          <div className="balance-stat-card">
            <div className="balance-stat-label">Total Days</div>
            <div className="balance-stat-value">{stats.totalDays.toLocaleString()}</div>
          </div>
          <div className="balance-stat-card">
            <div className="balance-stat-label">Total Accounts</div>
            <div className="balance-stat-value">{stats.totalAccounts}</div>
          </div>
          <div className="balance-stat-card">
            <div className="balance-stat-label">Average Balance</div>
            <div className="balance-stat-value">{formatCurrency(stats.averageBalance)}</div>
          </div>
          <div className="balance-stat-card">
            <div className="balance-stat-label">Highest Balance</div>
            <div className="balance-stat-value">{formatCurrency(stats.highestBalance)}</div>
          </div>
          <div className="balance-stat-card">
            <div className="balance-stat-label">Lowest Balance</div>
            <div className="balance-stat-value">{formatCurrency(stats.lowestBalance)}</div>
          </div>
          <div className="balance-stat-card">
            <div className="balance-stat-label">Date Range</div>
            <div className="balance-stat-value">
              {stats.dateRange.from ? `${formatDate(stats.dateRange.from)} - ${formatDate(stats.dateRange.to)}` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bank-balance-filters">
        <div className="bank-balance-filters-header">
          <h3 className="bank-balance-filters-title">Filters</h3>
          <button onClick={clearFilters} className="bank-balance-clear-filters">
            Clear All
          </button>
        </div>
        <div className="bank-balance-filters-grid">
          <div className="filter-group">
            <label>Account</label>
            <select
              value={filters.accountId}
              onChange={(e) => handleFilterChange('accountId', e.target.value)}
            >
              <option value="">All Accounts</option>
              {bankAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.accountNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Min Balance</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={filters.balanceFrom}
              onChange={(e) => handleFilterChange('balanceFrom', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Max Balance</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={filters.balanceTo}
              onChange={(e) => handleFilterChange('balanceTo', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Min Movement</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={filters.movementFrom}
              onChange={(e) => handleFilterChange('movementFrom', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredAndSortedBalances.length === 0 ? (
        <div className="bank-balance-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 12h.01M18 12h.01" />
          </svg>
          <h3>No Balance Data</h3>
          <p>No daily balance records found. Import bank statements to see balance history.</p>
        </div>
      ) : (
        <div className="bank-balance-table-container">
          <table className="bank-balance-table">
            <thead>
              <tr>
                <th className={getSortClass('date')} onClick={() => handleSort('date')}>
                  Date
                </th>
                <th className={getSortClass('accountName')} onClick={() => handleSort('accountName')}>
                  Account
                </th>
                <th className={getSortClass('openingBalance')} onClick={() => handleSort('openingBalance')}>
                  Opening Balance
                </th>
                <th className={getSortClass('closingBalance')} onClick={() => handleSort('closingBalance')}>
                  Closing Balance
                </th>
                <th className={getSortClass('dailyMovement')} onClick={() => handleSort('dailyMovement')}>
                  Daily Movement
                </th>
                <th className={getSortClass('transactionCount')} onClick={() => handleSort('transactionCount')}>
                  Transactions
                </th>
                <th>Last Transaction Time</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBalances.map((balance) => (
                <tr key={balance.id}>
                  <td className="date-cell">{formatDate(balance.date)}</td>
                  <td>
                    <div className="account-info">
                      <div className="account-name">{balance.accountName}</div>
                      <div className="account-details">
                        {balance.accountNumber} • {balance.bankName}
                      </div>
                    </div>
                  </td>
                  <td className="currency-value">
                    {formatCurrency(balance.openingBalance, balance.currency)}
                  </td>
                  <td className="currency-value">
                    {formatCurrency(balance.closingBalance, balance.currency)}
                  </td>
                  <td className={`currency-value ${getAmountClass(balance.dailyMovement)}`}>
                    {formatCurrency(balance.dailyMovement, balance.currency)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {balance.transactionCount}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                    {balance.lastTransactionTime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bank-balance-pagination">
              <div className="pagination-info">
                Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of {filteredAndSortedBalances.length.toLocaleString()} records
              </div>
              <div className="pagination-controls">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="pagination-select"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size} per page</option>
                  ))}
                </select>
                <div className="pagination-buttons">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="pagination-btn"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="pagination-btn"
                  >
                    Previous
                  </button>
                  <span className="pagination-btn active">
                    {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="pagination-btn"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 