import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { unifiedDataService, type StoredTransaction } from '../services/unifiedDataService';
import { BankAccount } from '../types';
import { TransactionCategorization } from './TransactionCategorization';
import './Transactions.css';

interface TransactionsProps {
  onTransactionUpdate?: (transactions: StoredTransaction[]) => void;
  refreshTrigger?: number;
}

type TransactionTab = 'all' | 'categorization';

type SortField = 'postDateTime' | 'description' | 'amount' | 'balance' | 'accountName';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'debits' | 'credits' | 'duplicates';

interface TransactionFilters {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  amountFrom: string;
  amountTo: string;
  description: string;
  type: FilterType;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_ITEMS_PER_PAGE = 50;

export const Transactions: React.FC<TransactionsProps> = ({ onTransactionUpdate, refreshTrigger }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TransactionTab>('all');
  
  // State management
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<StoredTransaction[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('postDateTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Filtering state
  const [filters, setFilters] = useState<TransactionFilters>({
    accountId: '',
    dateFrom: '',
    dateTo: '',
    amountFrom: '',
    amountTo: '',
    description: '',
    type: 'all'
  });
  
  // Selection state
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  // Calculate string similarity
  /* Temporarily commented out for debugging pagination
  const calculateStringSimilarity = useCallback((str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    // Simple similarity based on common characters
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (s1.includes(s2[i])) matches++;
    }
    
    return matches / longer.length;
  }, []);
  */

  // Check if two transactions are potential duplicates
  /* Temporarily commented out for debugging pagination
  const arePotentialDuplicates = useCallback((t1: StoredTransaction, t2: StoredTransaction): boolean => {
    // Same account
    if (t1.accountId !== t2.accountId) return false;

    // Same date (within 1 day)
    const date1 = new Date(t1.postDateTime);
    const date2 = new Date(t2.postDateTime);
    const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 1) return false;

    // Same amounts
    const sameDebit = Math.abs((t1.debitAmount || 0) - (t2.debitAmount || 0)) < 0.01;
    const sameCredit = Math.abs((t1.creditAmount || 0) - (t2.creditAmount || 0)) < 0.01;
    if (!sameDebit || !sameCredit) return false;

    // Similar description (at least 80% similarity)
    const similarity = calculateStringSimilarity(t1.description, t2.description);
    if (similarity < 0.8) return false;

    return true;
  }, [calculateStringSimilarity]);
  */

  // Simple duplicate detection within a single set of transactions
  const findDuplicatesInTransactions = useCallback((_transactions: StoredTransaction[]): StoredTransaction[][] => {
    // Temporarily disable complex duplicate detection to debug pagination
    return [];
    
    /* Original code commented out for debugging
    const duplicateGroups: StoredTransaction[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
      if (processed.has(transactions[i].id)) continue;

      const group: StoredTransaction[] = [transactions[i]];
      processed.add(transactions[i].id);

      for (let j = i + 1; j < transactions.length; j++) {
        if (processed.has(transactions[j].id)) continue;

        // Check if transactions are potential duplicates
        if (arePotentialDuplicates(transactions[i], transactions[j])) {
          group.push(transactions[j]);
          processed.add(transactions[j].id);
        }
      }

      // Only consider groups with 2 or more transactions as duplicates
      if (group.length > 1) {
        duplicateGroups.push(group);
      }
    }

    return duplicateGroups;
    */
  }, []); // Empty dependency array since function currently doesn't use any dependencies

  // Load data on component mount
  const loadData = useCallback(async () => {
    try {
      // Show refreshing indicator if not initial load
      if (transactions.length > 0) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Load bank accounts
      const accounts = unifiedDataService.getAllAccounts();
      setBankAccounts(accounts);
      
      // Load all transactions
      const allTransactions = unifiedDataService.getAllTransactions();
      
      setTransactions(allTransactions);
      
      // Detect duplicates within the transaction set
      const duplicates = findDuplicatesInTransactions(allTransactions);
      setDuplicateGroups(duplicates);
      
      if (onTransactionUpdate) {
        onTransactionUpdate(allTransactions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onTransactionUpdate, findDuplicatesInTransactions]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // Filtered and sorted transactions
  const filteredAndSortedTransactions = useMemo(() => {
    // Early return if transactions not loaded yet
    if (!transactions || transactions.length === 0) {
      return [];
    }
    
    let filtered = [...transactions];
    
    // Apply filters
    if (filters.accountId) {
      filtered = filtered.filter(t => t.accountId === filters.accountId);
    }
    
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(t => new Date(t.postDateTime) >= fromDate);
    }
    
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      filtered = filtered.filter(t => new Date(t.postDateTime) <= toDate);
    }
    
    if (filters.description) {
      const searchTerm = filters.description.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchTerm) ||
        (t.reference && t.reference.toLowerCase().includes(searchTerm))
      );
    }
    
    if (filters.amountFrom) {
      const minAmount = parseFloat(filters.amountFrom);
      if (!isNaN(minAmount)) {
        filtered = filtered.filter(t => {
          const amount = Math.abs((t.debitAmount || 0) + (t.creditAmount || 0));
          return amount >= minAmount;
        });
      }
    }
    
    if (filters.amountTo) {
      const maxAmount = parseFloat(filters.amountTo);
      if (!isNaN(maxAmount)) {
        filtered = filtered.filter(t => {
          const amount = Math.abs((t.debitAmount || 0) + (t.creditAmount || 0));
          return amount <= maxAmount;
        });
      }
    }
    
    if (filters.type === 'debits') {
      filtered = filtered.filter(t => (t.debitAmount || 0) > 0);
    } else if (filters.type === 'credits') {
      filtered = filtered.filter(t => (t.creditAmount || 0) > 0);
    }
    
    // Show duplicates only
    if (showDuplicatesOnly && duplicateGroups.length > 0) {
      const duplicateIds = new Set(duplicateGroups.flat().map(t => t.id));
      filtered = filtered.filter(t => duplicateIds.has(t.id));
    }
    
    // Sort transactions
    if (bankAccounts.length > 0) {
      filtered.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;
        
        switch (sortField) {
          case 'postDateTime':
            aValue = new Date(a.postDateTime).getTime();
            bValue = new Date(b.postDateTime).getTime();
            break;
          case 'description':
            aValue = a.description.toLowerCase();
            bValue = b.description.toLowerCase();
            break;
          case 'amount':
            aValue = Math.abs((a.debitAmount || 0) + (a.creditAmount || 0));
            bValue = Math.abs((b.debitAmount || 0) + (b.creditAmount || 0));
            break;
          case 'balance':
            aValue = a.balance;
            bValue = b.balance;
            break;
          case 'accountName':
            const accountA = bankAccounts.find(acc => acc.id === a.accountId);
            const accountB = bankAccounts.find(acc => acc.id === b.accountId);
            aValue = accountA?.name.toLowerCase() || '';
            bValue = accountB?.name.toLowerCase() || '';
            break;
          default:
            return 0;
        }
        
        if (sortDirection === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    }
    
    return filtered;
  }, [transactions, filters, sortField, sortDirection, showDuplicatesOnly, duplicateGroups, bankAccounts]);

  // Pagination calculations
  const totalTransactions = filteredAndSortedTransactions.length;
  const totalPages = Math.ceil(totalTransactions / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalTransactions);
  const currentTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);

  // Debug pagination issue (simplified)
  if (currentTransactions.length !== itemsPerPage && totalTransactions > 0) {
    console.log('PAGINATION ISSUE:', {
      currentPage,
      itemsPerPage,
      totalTransactions,
      totalPages,
      currentTransactionsLength: currentTransactions.length
    });
  }



  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortField, sortDirection, showDuplicatesOnly, itemsPerPage]);

  // Event handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleFilterChange = (key: keyof TransactionFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectTransaction = (transactionId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = useCallback(() => {
    if (selectedTransactions.size === currentTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(currentTransactions.map(t => t.id)));
    }
  }, [selectedTransactions.size, currentTransactions]);

  const clearFilters = () => {
    setFilters({
      accountId: '',
      dateFrom: '',
      dateTo: '',
      amountFrom: '',
      amountTo: '',
      description: '',
      type: 'all'
    });
    setShowDuplicatesOnly(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't interfere with input fields
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
          }
          break;
        case 'ArrowRight':
          if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
          }
          break;
        case 'Home':
          setCurrentPage(1);
          break;
        case 'End':
          setCurrentPage(totalPages);
          break;
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            document.getElementById('search-input')?.focus();
          }
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            loadData();
          }
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSelectAll();
          }
          break;
        case 'Escape':
          setSelectedTransactions(new Set());
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, totalPages, loadData, handleSelectAll]);

  // Utility functions
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
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

  const getAccountName = (accountId: string): string => {
    const account = bankAccounts.find(acc => acc.id === accountId);
    return account?.name || 'Unknown Account';
  };

  const isDuplicate = (transaction: StoredTransaction): boolean => {
    return duplicateGroups.some(group => group.some(t => t.id === transaction.id));
  };

  if (loading) {
    return (
      <div className="transactions-loading">
        <div className="loading-spinner"></div>
        <p>Loading transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transactions-error">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Transactions</h3>
        <p>{error}</p>
        <button onClick={loadData} className="btn btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'categorization':
        return <TransactionCategorization refreshTrigger={refreshTrigger} />;
      case 'all':
      default:
        return (
          <div className="all-transactions-content">
            {/* Filters Section */}
            <div className="transactions-filters">
              <div className="filters-row">
                <div className="filter-group">
                  <label className="filter-label">Account</label>
                  <select
                    value={filters.accountId}
                    onChange={(e) => handleFilterChange('accountId', e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All Accounts</option>
                    {bankAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} - {account.accountNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Type</label>
                  <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value as FilterType)}
                    className="filter-select"
                  >
                    <option value="all">All Types</option>
                    <option value="debits">Debits Only</option>
                    <option value="credits">Credits Only</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">
                    <input
                      type="checkbox"
                      checked={showDuplicatesOnly}
                      onChange={(e) => setShowDuplicatesOnly(e.target.checked)}
                      className="filter-checkbox"
                    />
                    Show Duplicates Only
                  </label>
                </div>
              </div>

              <div className="filters-row">
                <div className="filter-group">
                  <label className="filter-label">Search</label>
                  <input
                    id="search-input"
                    type="text"
                    value={filters.description}
                    onChange={(e) => handleFilterChange('description', e.target.value)}
                    placeholder="Search description or reference..."
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Date From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Date To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Amount Range</label>
                  <div className="amount-range">
                    <input
                      type="number"
                      value={filters.amountFrom}
                      onChange={(e) => handleFilterChange('amountFrom', e.target.value)}
                      placeholder="Min"
                      className="filter-input amount-input"
                      step="0.01"
                    />
                    <span className="amount-separator">-</span>
                    <input
                      type="number"
                      value={filters.amountTo}
                      onChange={(e) => handleFilterChange('amountTo', e.target.value)}
                      placeholder="Max"
                      className="filter-input amount-input"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="filter-group">
                  <button onClick={clearFilters} className="btn btn-secondary btn-sm">
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="transactions-table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.size === currentTransactions.length && currentTransactions.length > 0}
                        onChange={handleSelectAll}
                        className="table-checkbox"
                      />
                    </th>
                    <th 
                      className={`sortable ${sortField === 'postDateTime' ? 'sorted' : ''}`}
                      onClick={() => handleSort('postDateTime')}
                    >
                      Date
                      {sortField === 'postDateTime' && (
                        <span className="sort-arrow">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th 
                      className={`sortable ${sortField === 'accountName' ? 'sorted' : ''}`}
                      onClick={() => handleSort('accountName')}
                    >
                      Account
                      {sortField === 'accountName' && (
                        <span className="sort-arrow">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th 
                      className={`sortable ${sortField === 'description' ? 'sorted' : ''}`}
                      onClick={() => handleSort('description')}
                    >
                      Description
                      {sortField === 'description' && (
                        <span className="sort-arrow">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th className="amount-col">Debit</th>
                    <th className="amount-col">Credit</th>
                    <th 
                      className={`amount-col sortable ${sortField === 'balance' ? 'sorted' : ''}`}
                      onClick={() => handleSort('balance')}
                    >
                      Balance
                      {sortField === 'balance' && (
                        <span className="sort-arrow">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTransactions.map((transaction, _index) => (
                    <tr 
                      key={transaction.id}
                      className={`
                        ${selectedTransactions.has(transaction.id) ? 'selected' : ''}
                        ${isDuplicate(transaction) ? 'duplicate' : ''}
                      `}
                      title={transaction.description}
                    >
                      <td className="checkbox-col">
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(transaction.id)}
                          onChange={() => handleSelectTransaction(transaction.id)}
                          className="table-checkbox"
                        />
                      </td>
                      <td className="date-col">
                        <div className="date-display">
                          {formatDate(transaction.postDateTime)}
                          {transaction.time && (
                            <span className="time-display">{transaction.time}</span>
                          )}
                        </div>
                      </td>
                      <td className="account-col">
                        <div className="account-info">
                          {getAccountName(transaction.accountId)}
                          {isDuplicate(transaction) && (
                            <span className="duplicate-badge">DUPLICATE</span>
                          )}
                        </div>
                      </td>
                      <td className="description-col">
                        <div className="description-content">
                          {transaction.description}
                        </div>
                      </td>
                      <td className="amount-col debit">
                        {transaction.debitAmount ? formatCurrency(transaction.debitAmount) : ''}
                      </td>
                      <td className="amount-col credit">
                        {transaction.creditAmount ? formatCurrency(transaction.creditAmount) : ''}
                      </td>
                      <td className="amount-col balance">
                        {formatCurrency(transaction.balance)}
                      </td>
                      <td className="reference-col">
                        {transaction.reference || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {currentTransactions.length === 0 && (
                <div className="no-transactions">
                  <div className="no-transactions-icon">📊</div>
                  <h3>No Transactions Found</h3>
                  <p>
                    {filteredAndSortedTransactions.length === 0 && transactions.length === 0
                      ? 'No transactions have been imported yet. Import bank statements from the Bank Statements tab to get started.'
                      : 'No transactions match your current filters.'}
                  </p>
                  {filteredAndSortedTransactions.length === 0 && transactions.length > 0 && (
                    <button onClick={clearFilters} className="btn btn-primary">
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="transactions-pagination">
                <div className="pagination-info">
                  <span>
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedTransactions.length)} of {filteredAndSortedTransactions.length} transactions
                  </span>
                  <div className="items-per-page">
                    <label>Items per page:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="page-size-select"
                    >
                      {ITEMS_PER_PAGE_OPTIONS.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pagination-controls">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    Previous
                  </button>
                  <div className="pagination-pages">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`btn btn-secondary btn-sm ${currentPage === pageNumber ? 'active' : ''}`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}

            {/* Keyboard Shortcuts Help */}
            <div className="keyboard-shortcuts">
              <details>
                <summary>Keyboard Shortcuts</summary>
                <div className="shortcuts-grid">
                  <div className="shortcut-item">
                    <kbd>←</kbd> <span>Previous page</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>→</kbd> <span>Next page</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>Home</kbd> <span>First page</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>End</kbd> <span>Last page</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>Ctrl+F</kbd> <span>Focus search</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>Ctrl+R</kbd> <span>Refresh</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>Ctrl+A</kbd> <span>Select all</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>Esc</kbd> <span>Clear selection</span>
                  </div>
                </div>
              </details>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="transactions">
      <div className="transactions-header">
        <div className="transactions-title-section">
          <h2 className="transactions-title">Transactions</h2>
          <div className="transactions-stats">
            <span className="stat-item">
              Total: <strong>{transactions.length.toLocaleString()}</strong>
            </span>
            <span className="stat-item">
              Filtered: <strong>{filteredAndSortedTransactions.length.toLocaleString()}</strong>
            </span>
            {duplicateGroups.length > 0 && (
              <span className="stat-item duplicate-stat">
                Duplicates: <strong>{duplicateGroups.flat().length}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="transactions-actions">
          <button onClick={loadData} className="btn btn-secondary btn-sm" disabled={refreshing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          {refreshing && (
            <span className="refresh-indicator">
              <div className="refresh-spinner"></div>
              Data updated - refreshing...
            </span>
          )}
          {selectedTransactions.size > 0 && (
            <span className="selection-count">
              {selectedTransactions.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Transaction Tabs */}
      <div className="transaction-tabs">
        <button
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
            <circle cx="6" cy="6" r="1" />
            <circle cx="6" cy="12" r="1" />
            <circle cx="6" cy="18" r="1" />
          </svg>
          All Transactions
        </button>
        <button
          className={`tab-button ${activeTab === 'categorization' ? 'active' : ''}`}
          onClick={() => setActiveTab('categorization')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          Categorization
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
}; 