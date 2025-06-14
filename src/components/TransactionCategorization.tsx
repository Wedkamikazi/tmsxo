import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, TransactionCategory, TransactionCategorization as TransactionCategorizationData } from '../types';
import { transactionStorageService, type StoredTransaction } from '../services/transactionStorageService';
import { categorizationService } from '../services/categorizationService';
import { mlCategorizationService } from '../services/mlCategorizationService';
import './TransactionCategorization.css';

interface TransactionCategorizationProps {
  refreshTrigger?: number;
}

type ViewMode = 'uncategorized' | 'all' | 'ml-pending' | 'low-confidence';
type SortField = 'date' | 'amount' | 'confidence' | 'description';
type SortDirection = 'asc' | 'desc';

interface CategoryFilter {
  categoryId: string;
  method: 'all' | 'manual' | 'ml' | 'rule';
  confidenceMin: number;
  confidenceMax: number;
}

export const TransactionCategorization: React.FC<TransactionCategorizationProps> = ({ refreshTrigger }) => {
  // State management
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [categorizations, setCategorizations] = useState<TransactionCategorizationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingML, setProcessingML] = useState(false);
  const [mlProgress, setMLProgress] = useState({ current: 0, total: 0 });
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  
  // View and filter state
  const [viewMode, setViewMode] = useState<ViewMode>('uncategorized');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [categoryFilter] = useState<CategoryFilter>({
    categoryId: '',
    method: 'all',
    confidenceMin: 0,
    confidenceMax: 1
  });

  // ML Configuration state
  const [mlConfig] = useState({
    confidenceThreshold: 0.7,
    batchSize: 10,
    autoApplyHighConfidence: true
  });

  // Qwen status state
  const [qwenStatus, setQwenStatus] = useState({
    available: false,
    modelLoaded: false,
    loading: true
  });

  // Modal state
  const [, setShowMLConfigModal] = useState(false);
  const [, setShowCategoryModal] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load all data
      const [allTransactions, allCategories, allCategorizations] = await Promise.all([
        Promise.resolve(transactionStorageService.getAllTransactions()),
        Promise.resolve(categorizationService.getAllCategories()),
        Promise.resolve(categorizationService.getAllCategorizations())
      ]);

      setTransactions(allTransactions);
      setCategories(allCategories);
      setCategorizations(allCategorizations);
    } catch (error) {
      console.error('Failed to load categorization data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    checkQwenStatus();
  }, [loadData, refreshTrigger]);

  // Check Qwen 2.5:32B status
  const checkQwenStatus = useCallback(async () => {
    try {
      const status = mlCategorizationService.getModelStatus();
      const qwenStats = mlCategorizationService.getQwenPerformanceStats();

      setQwenStatus({
        available: status.isAvailable,
        modelLoaded: status.modelLoaded,
        loading: false
      });

      console.log('Qwen 2.5:32B Status:', {
        available: status.isAvailable,
        modelLoaded: status.modelLoaded,
        performance: qwenStats
      });
    } catch (error) {
      console.error('Failed to check Qwen status:', error);
      setQwenStatus({
        available: false,
        modelLoaded: false,
        loading: false
      });
    }
  }, []);

  // Get categorization data for a transaction
  const getTransactionCategorization = useCallback((transactionId: string): TransactionCategorizationData | undefined => {
    return categorizations.find(cat => cat.transactionId === transactionId);
  }, [categorizations]);

  // Get category by ID
  const getCategoryById = useCallback((categoryId: string): TransactionCategory | undefined => {
    return categories.find(cat => cat.id === categoryId);
  }, [categories]);

  // Filter and sort transactions based on current settings
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Apply view mode filter
    switch (viewMode) {
      case 'uncategorized':
        filtered = filtered.filter(t => !getTransactionCategorization(t.id));
        break;
      case 'ml-pending':
        filtered = filtered.filter(t => {
          const cat = getTransactionCategorization(t.id);
          return cat && cat.method === 'ml' && (cat.confidence || 0) < mlConfig.confidenceThreshold;
        });
        break;
      case 'low-confidence':
        filtered = filtered.filter(t => {
          const cat = getTransactionCategorization(t.id);
          return cat && cat.method === 'ml' && (cat.confidence || 0) < 0.8;
        });
        break;
      case 'all':
      default:
        // No additional filtering
        break;
    }

    // Apply category filter
    if (categoryFilter.categoryId) {
      filtered = filtered.filter(t => {
        const cat = getTransactionCategorization(t.id);
        return cat && cat.categoryId === categoryFilter.categoryId;
      });
    }

    // Apply method filter
    if (categoryFilter.method !== 'all') {
      filtered = filtered.filter(t => {
        const cat = getTransactionCategorization(t.id);
        return cat && cat.method === categoryFilter.method;
      });
    }

    // Apply confidence filter
    filtered = filtered.filter(t => {
      const cat = getTransactionCategorization(t.id);
      if (!cat || cat.method !== 'ml') return true; // Include non-ML transactions
      const confidence = cat.confidence || 0;
      return confidence >= categoryFilter.confidenceMin && confidence <= categoryFilter.confidenceMax;
    });

    // Sort transactions
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'date':
          aValue = new Date(a.postDateTime).getTime();
          bValue = new Date(b.postDateTime).getTime();
          break;
        case 'amount':
          aValue = Math.abs(a.debitAmount || a.creditAmount || 0);
          bValue = Math.abs(b.debitAmount || b.creditAmount || 0);
          break;
        case 'confidence':
          aValue = getTransactionCategorization(a.id)?.confidence || 0;
          bValue = getTransactionCategorization(b.id)?.confidence || 0;
          break;
        case 'description':
        default:
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [transactions, viewMode, categoryFilter, sortField, sortDirection, mlConfig.confidenceThreshold, getTransactionCategorization]);

  // Handle manual categorization
  const handleManualCategorization = useCallback(async (transactionId: string, categoryId: string) => {
    try {
      categorizationService.categorizeTransaction(transactionId, categoryId, 'manual');
      
      // Refresh categorizations
      const updatedCategorizations = categorizationService.getAllCategorizations();
      setCategorizations(updatedCategorizations);
      
      // Clear selection
      setSelectedTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to categorize transaction:', error);
    }
  }, []);

  // Handle batch ML categorization
  const handleMLCategorization = useCallback(async (transactionIds?: string[]) => {
    try {
      setProcessingML(true);
      
      const transactionsToProcess = transactionIds 
        ? transactions.filter(t => transactionIds.includes(t.id))
        : filteredTransactions.filter(t => !getTransactionCategorization(t.id));

      setMLProgress({ current: 0, total: transactionsToProcess.length });

      // Convert StoredTransaction to Transaction format for ML service
      const mlTransactions: Transaction[] = transactionsToProcess.map(t => ({
        id: t.id,
        date: t.postDateTime,
        description: t.description,
        debitAmount: t.debitAmount || 0,
        creditAmount: t.creditAmount || 0,
        balance: t.balance,
        reference: t.reference
      }));

      const results = await mlCategorizationService.categorizeTransactionsBatch(mlTransactions);
      
      // Update progress and categorizations
      let processed = 0;
      for (const result of results) {
        processed++;
        setMLProgress({ current: processed, total: transactionsToProcess.length });
        
        if (result.result && result.result.confidence >= mlConfig.confidenceThreshold && mlConfig.autoApplyHighConfidence) {
          // High confidence results are automatically applied
          continue; // Already applied by ML service
        }
      }

      // Refresh categorizations
      const updatedCategorizations = categorizationService.getAllCategorizations();
      setCategorizations(updatedCategorizations);
      
    } catch (error) {
      console.error('ML categorization failed:', error);
    } finally {
      setProcessingML(false);
      setMLProgress({ current: 0, total: 0 });
    }
  }, [transactions, filteredTransactions, mlConfig, getTransactionCategorization]);

  // Format currency
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }, []);

  // Format confidence as percentage
  const formatConfidence = useCallback((confidence?: number): string => {
    if (confidence === undefined) return 'N/A';
    return `${Math.round(confidence * 100)}%`;
  }, []);

  // Get confidence color
  const getConfidenceColor = useCallback((confidence?: number): string => {
    if (confidence === undefined) return '#6B7280';
    if (confidence >= 0.9) return '#10B981';
    if (confidence >= 0.7) return '#F59E0B';
    return '#EF4444';
  }, []);

  // Statistics
  const stats = useMemo(() => {
    const total = transactions.length;
    const categorized = categorizations.length;
    const uncategorized = total - categorized;
    const mlCategorized = categorizations.filter(c => c.method === 'ml').length;
    const manualCategorized = categorizations.filter(c => c.method === 'manual').length;
    const averageMLConfidence = categorizations
      .filter(c => c.method === 'ml' && c.confidence !== undefined)
      .reduce((sum, c, _, arr) => sum + (c.confidence || 0) / arr.length, 0);

    return {
      total,
      categorized,
      uncategorized,
      mlCategorized,
      manualCategorized,
      averageMLConfidence,
      categorizationRate: total > 0 ? (categorized / total) * 100 : 0
    };
  }, [transactions, categorizations]);

  if (loading) {
    return (
      <div className="categorization-loading">
        <div className="loading-spinner"></div>
        <p>Loading transaction categorization data...</p>
      </div>
    );
  }

  return (
    <div className="transaction-categorization">
      <div className="categorization-header">
        <div className="categorization-title">
          <h2>Transaction Categorization</h2>
          <p>Categorize transactions manually or use AI-powered categorization with Qwen 3</p>
        </div>
        
        <div className="categorization-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Transactions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.categorized}</div>
            <div className="stat-label">Categorized</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.uncategorized}</div>
            <div className="stat-label">Uncategorized</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.categorizationRate.toFixed(1)}%</div>
            <div className="stat-label">Completion Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatConfidence(stats.averageMLConfidence)}</div>
            <div className="stat-label">Avg ML Confidence</div>
          </div>
        </div>
      </div>

      <div className="categorization-controls">
        <div className="view-modes">
          <button 
            className={`view-mode-btn ${viewMode === 'uncategorized' ? 'active' : ''}`}
            onClick={() => setViewMode('uncategorized')}
          >
            Uncategorized ({stats.uncategorized})
          </button>
          <button 
            className={`view-mode-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            All Transactions
          </button>
          <button 
            className={`view-mode-btn ${viewMode === 'ml-pending' ? 'active' : ''}`}
            onClick={() => setViewMode('ml-pending')}
          >
            ML Pending Review
          </button>
          <button 
            className={`view-mode-btn ${viewMode === 'low-confidence' ? 'active' : ''}`}
            onClick={() => setViewMode('low-confidence')}
          >
            Low Confidence
          </button>
        </div>

        <div className="action-buttons">
          <button 
            className="btn btn-primary"
            onClick={() => handleMLCategorization()}
            disabled={processingML}
          >
            {processingML ? `Processing ${mlProgress.current}/${mlProgress.total}...` : 'Run ML Categorization'}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowMLConfigModal(true)}
          >
            ML Settings
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowCategoryModal(true)}
          >
            Manage Categories
          </button>
        </div>
      </div>

      <div className="transactions-table-container">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)));
                    } else {
                      setSelectedTransactions(new Set());
                    }
                  }}
                />
              </th>
              <th 
                className={`sortable ${sortField === 'date' ? sortDirection : ''}`}
                onClick={() => {
                  if (sortField === 'date') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('date');
                    setSortDirection('desc');
                  }
                }}
              >
                Date
              </th>
              <th 
                className={`sortable ${sortField === 'description' ? sortDirection : ''}`}
                onClick={() => {
                  if (sortField === 'description') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('description');
                    setSortDirection('asc');
                  }
                }}
              >
                Description
              </th>
              <th 
                className={`sortable ${sortField === 'amount' ? sortDirection : ''}`}
                onClick={() => {
                  if (sortField === 'amount') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('amount');
                    setSortDirection('desc');
                  }
                }}
              >
                Amount
              </th>
              <th>Category</th>
              <th 
                className={`sortable ${sortField === 'confidence' ? sortDirection : ''}`}
                onClick={() => {
                  if (sortField === 'confidence') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('confidence');
                    setSortDirection('desc');
                  }
                }}
              >
                Confidence
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(transaction => {
              const categorization = getTransactionCategorization(transaction.id);
              const category = categorization ? getCategoryById(categorization.categoryId) : undefined;
              const amount = transaction.debitAmount ? -transaction.debitAmount : (transaction.creditAmount || 0);
              
              return (
                <tr key={transaction.id} className={selectedTransactions.has(transaction.id) ? 'selected' : ''}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selectedTransactions.has(transaction.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedTransactions);
                        if (e.target.checked) {
                          newSet.add(transaction.id);
                        } else {
                          newSet.delete(transaction.id);
                        }
                        setSelectedTransactions(newSet);
                      }}
                    />
                  </td>
                  <td>{new Date(transaction.postDateTime).toLocaleDateString()}</td>
                  <td className="description-cell" title={transaction.description}>
                    {transaction.description}
                  </td>
                  <td className={`amount-cell ${amount < 0 ? 'debit' : 'credit'}`}>
                    {formatCurrency(Math.abs(amount))}
                  </td>
                  <td>
                    {category ? (
                      <div className="category-tag" style={{ backgroundColor: category.color }}>
                        {category.name}
                        {categorization?.method && (
                          <span className="category-method">{categorization.method.toUpperCase()}</span>
                        )}
                      </div>
                    ) : (
                      <span className="uncategorized">Uncategorized</span>
                    )}
                  </td>
                  <td>
                    {categorization?.confidence !== undefined ? (
                      <span 
                        className="confidence-score"
                        style={{ color: getConfidenceColor(categorization.confidence) }}
                      >
                        {formatConfidence(categorization.confidence)}
                      </span>
                    ) : (
                      <span className="no-confidence">-</span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <select 
                        value={categorization?.categoryId || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleManualCategorization(transaction.id, e.target.value);
                          }
                        }}
                        className="category-select"
                      >
                        <option value="">Select Category...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedTransactions.size > 0 && (
        <div className="batch-actions">
          <div className="batch-info">
            {selectedTransactions.size} transaction(s) selected
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => handleMLCategorization(Array.from(selectedTransactions))}
            disabled={processingML}
          >
            Categorize Selected with ML
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setSelectedTransactions(new Set())}
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}; 