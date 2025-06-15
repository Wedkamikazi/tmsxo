import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  bankBalanceService, 
  type DailyBalance, 
  type BankBalanceFilters, 
  type BankBalanceStats 
} from '../services/bankBalanceService';
import { unifiedDataService } from '../services/unifiedDataService';
import { BankAccount } from '../types';
import { 
  registerGlobalRefresh, 
  unregisterGlobalRefresh, 
  shouldComponentUseCache,
  setComponentState,
  getComponentState 
} from '../utils/stateManager';
import './BankBalance.css';

interface BankBalanceProps {
  refreshTrigger?: number;
}

type SortField = 'date' | 'accountName' | 'openingBalance' | 'closingBalance' | 'movement' | 'transactionCount';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_ITEMS_PER_PAGE = 50;

export const BankBalance: React.FC<BankBalanceProps> = ({ refreshTrigger }) => {
  // Initialize with cached state if available
  const cachedState = getComponentState<{
    filteredBalances: DailyBalance[];
    bankAccounts: BankAccount[];
    stats: BankBalanceStats | null;
  }>('BankBalance');
  
  // State management
  const [filteredBalances, setFilteredBalances] = useState<DailyBalance[]>(() => {
    if (cachedState?.filteredBalances && shouldComponentUseCache('BankBalance')) {
      console.log('🚀 BANK BALANCE: Using cached balance data');
      return cachedState.filteredBalances;
    }
    return [];
  });
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    if (cachedState?.bankAccounts && shouldComponentUseCache('BankBalance')) {
      console.log('🚀 BANK BALANCE: Using cached account data');
      return cachedState.bankAccounts;
    }
    return [];
  });
  const [stats, setStats] = useState<BankBalanceStats | null>(() => {
    if (cachedState?.stats && shouldComponentUseCache('BankBalance')) {
      console.log('🚀 BANK BALANCE: Using cached stats data');
      return cachedState.stats;
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    // If we have cached data, skip loading
    return !(cachedState?.filteredBalances && shouldComponentUseCache('BankBalance'));
  });
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Filtering state
  const [filters, setFilters] = useState<BankBalanceFilters>({
    accountId: '',
    dateFrom: '',
    dateTo: '',
    balanceMin: '',
    balanceMax: '',
    movementMin: '',
    movementMax: ''
  });

  // Load data
  const loadData = useCallback(async () => {
    try {
      console.log('🔄 BANK BALANCE: Loading balance data...');
      setLoading(true);
      setError(null);
      
      // Load bank accounts
      const accounts = unifiedDataService.getAllAccounts();
      setBankAccounts(accounts);
      
      // Apply filters and sorting to get daily balances
      const filtered = bankBalanceService.getFilteredBalances(filters, sortField, sortDirection);
      setFilteredBalances(filtered);
      
      // Calculate stats
      const balanceStats = bankBalanceService.getBalanceStats(filtered);
      setStats(balanceStats);
      
      // Save state for caching
      setComponentState('BankBalance', {
        filteredBalances: filtered,
        bankAccounts: accounts,
        stats: balanceStats
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bank balances');
    } finally {
      setLoading(false);
    }
  }, [filters, sortField, sortDirection]);

  // Register for global refresh
  useEffect(() => {
    registerGlobalRefresh('BankBalance', loadData);
    
    return () => {
      unregisterGlobalRefresh('BankBalance');
    };
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof BankBalanceFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      accountId: '',
      dateFrom: '',
      dateTo: '',
      balanceMin: '',
      balanceMax: '',
      movementMin: '',
      movementMax: ''
    });
    setCurrentPage(1);
  };

  // Export to CSV
  const handleExportCSV = () => {
    try {
      const csvContent = bankBalanceService.exportToCSV(filteredBalances);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `bank-balances-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export CSV');
    }
  };

  // Pagination calculations
  const paginatedBalances = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredBalances.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredBalances, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredBalances.length / itemsPerPage);

  // Handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    return (isNegative ? '-$' : '$') + absAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get sort icon
  const getSortIcon = (field: SortField): string => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Get movement color class
  const getMovementColorClass = (movement: number): string => {
    if (movement > 0) return 'movement-positive';
    if (movement < 0) return 'movement-negative';
    return 'movement-neutral';
  };

  if (loading) {
    return (
      <div className="bank-balance-loading">
        <div className="loading-spinner"></div>
        <p>Loading bank balances...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bank-balance-error">
        <h3>Error Loading Bank Balances</h3>
        <p>{error}</p>
        <button onClick={loadData} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bank-balance">
      <div className="bank-balance-header">
        <h2>Bank Balance Overview</h2>
        <p>Daily closing balances extracted from transaction data</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalDays}</div>
              <div className="stat-label">Total Days</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🏦</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalAccounts}</div>
              <div className="stat-label">Accounts</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(stats.avgDailyBalance)}</div>
              <div className="stat-label">Avg Daily Balance</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <div className="stat-value">{stats.positiveMovementDays}</div>
              <div className="stat-label">Positive Days</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📉</div>
            <div className="stat-content">
              <div className="stat-value">{stats.negativeMovementDays}</div>
              <div className="stat-label">Negative Days</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⬆️</div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(stats.highestBalance)}</div>
              <div className="stat-label">Highest Balance</div>
            </div>
          </div>
          
          {(stats.daysWithDuplicates || 0) > 0 && (
            <div className="stat-card warning">
              <div className="stat-icon">⚠️</div>
              <div className="stat-content">
                <div className="stat-value">{stats.daysWithDuplicates}</div>
                <div className="stat-label">Days with Duplicates</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters and Controls */}
      <div className="controls-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Account</label>
            <select
              value={filters.accountId}
              onChange={(e) => handleFilterChange('accountId', e.target.value)}
            >
              <option value="">All Accounts</option>
              {bankAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
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
              value={filters.balanceMin}
              onChange={(e) => handleFilterChange('balanceMin', e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>Max Balance</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={filters.balanceMax}
              onChange={(e) => handleFilterChange('balanceMax', e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>Min Movement</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={filters.movementMin}
              onChange={(e) => handleFilterChange('movementMin', e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>Max Movement</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={filters.movementMax}
              onChange={(e) => handleFilterChange('movementMax', e.target.value)}
            />
          </div>
        </div>
        
        <div className="controls-actions">
          <button onClick={clearFilters} className="clear-filters-button">
            Clear Filters
          </button>
          <button onClick={handleExportCSV} className="export-button">
            Export CSV
          </button>
        </div>
      </div>

      {/* Results Info */}
      <div className="results-info">
        <span>
          Showing {paginatedBalances.length} of {filteredBalances.length} daily balances
        </span>
        <div className="pagination-controls">
          <label>
            Items per page:
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              {ITEMS_PER_PAGE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Balance Table */}
      <div className="table-container">
        <table className="balance-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('date')} className="sortable">
                Date {getSortIcon('date')}
              </th>
              <th onClick={() => handleSort('accountName')} className="sortable">
                Account {getSortIcon('accountName')}
              </th>
              <th onClick={() => handleSort('openingBalance')} className="sortable">
                Opening Balance {getSortIcon('openingBalance')}
              </th>
              <th onClick={() => handleSort('closingBalance')} className="sortable">
                Closing Balance {getSortIcon('closingBalance')}
              </th>
              <th onClick={() => handleSort('movement')} className="sortable">
                Movement {getSortIcon('movement')}
              </th>
              <th onClick={() => handleSort('transactionCount')} className="sortable">
                Transactions {getSortIcon('transactionCount')}
              </th>
              <th>Last Transaction</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBalances.map(balance => (
              <tr key={balance.id} className={balance.hasDuplicates ? 'has-duplicates' : ''}>
                <td className="date-cell">
                  {formatDate(balance.date)}
                  {balance.hasDuplicates && (
                    <span className="duplicate-warning" title={`${balance.duplicateCount} duplicate transactions detected`}>
                      ⚠️
                    </span>
                  )}
                </td>
                <td className="account-cell">{balance.accountName}</td>
                <td className="currency-cell">{formatCurrency(balance.openingBalance)}</td>
                <td className="currency-cell">{formatCurrency(balance.closingBalance)}</td>
                <td className={`currency-cell ${getMovementColorClass(balance.movement)}`}>
                  {formatCurrency(balance.movement)}
                </td>
                <td className="count-cell">
                  {balance.transactionCount}
                  {balance.hasDuplicates && (
                    <span className="duplicate-info" title="Unique transactions only">
                      *
                    </span>
                  )}
                </td>
                <td className="time-cell">{balance.lastTransactionTime.substring(0, 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-button"
          >
            Previous
          </button>
          
          <div className="pagination-info">
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="pagination-numbers">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="pagination-button"
          >
            Next
          </button>
        </div>
      )}

      {filteredBalances.length === 0 && !loading && (
        <div className="no-results">
          <div className="no-results-icon">📊</div>
          <h3>No bank balances found</h3>
          <p>Try adjusting your filters or import some transaction data first.</p>
        </div>
      )}
    </div>
  );
}; 