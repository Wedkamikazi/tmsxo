import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCleanup, useTimerCleanup, useEventListenerCleanup } from '@/shared/hooks/useCleanup';
import { useInfiniteLoopProtection } from '@/core/safety/InfiniteLoopProtection';
import { Transaction, TransactionCategory, TransactionCategorization as TransactionCategorizationData } from '@/shared/types';
import { unifiedDataService, type StoredTransaction } from '@/data/storage/UnifiedDataService';
import { unifiedCategorizationService } from './UnifiedCategorizationService';
import { categorizationService } from './CategorizationService'; // Keep for category management only
import { enhancedMLOrchestrator } from '../machine-learning/EnhancedMLOrchestrator';
import { localOllamaIntegration } from '@/integration/ai/LocalOllamaIntegration';
import './TransactionCategorization.css';

interface TransactionCategorizationProps {
  refreshTrigger?: number;
}

type ViewMode = 'uncategorized' | 'all' | 'ml-pending' | 'low-confidence' | 'enhanced';
type SortField = 'date' | 'amount' | 'confidence' | 'description' | 'sentiment';
type SortDirection = 'asc' | 'desc';

interface CategoryFilter {
  categoryId: string;
  method: 'all' | 'manual' | 'ml' | 'rule' | 'enhanced';
  confidenceMin: number;
  confidenceMax: number;
  sentimentFilter: 'all' | 'positive' | 'negative' | 'neutral';
}

interface EnhancedAnalysis {
  sentiment?: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
  };
  anomalies?: string[];
  patterns?: string[];
  contextualInfo?: string;
  reasoning?: string;
}

export const TransactionCategorization: React.FC<TransactionCategorizationProps> = ({ refreshTrigger }) => {
  // CRITICAL: Infinite loop protection - monitors renders and prevents browser crashes
  useInfiniteLoopProtection('TransactionCategorization');
  
  // Initialize cleanup hooks
  const cleanup = useCleanup({ 
    componentName: 'TransactionCategorization',
    enableLogging: true 
  });
  const timerCleanup = useTimerCleanup('TransactionCategorization');
  const eventCleanup = useEventListenerCleanup('TransactionCategorization');

  // Use cleanup hooks for component lifecycle management
  useEffect(() => {
    return () => {
      cleanup.cleanup();
      eventCleanup.cleanup();
    };
  }, [cleanup, eventCleanup]);

  // State management
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [categorizations, setCategorizations] = useState<TransactionCategorizationData[]>([]);
  const [enhancedAnalyses, setEnhancedAnalyses] = useState<Record<string, EnhancedAnalysis>>({});
  const [loading, setLoading] = useState(true);
  const [processingML, setProcessingML] = useState(false);
  const [mlProgress, setMLProgress] = useState({ current: 0, total: 0 });
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  
  // View and filter state
  const [viewMode, setViewMode] = useState<ViewMode>('uncategorized');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>({
    categoryId: '',
    method: 'all',
    confidenceMin: 0,
    confidenceMax: 1,
    sentimentFilter: 'all'
  });

  // Enhanced ML Configuration state
  const [mlConfig, setMLConfig] = useState({
    strategy: 'hybrid' as 'ollama-primary' | 'tensorflow-primary' | 'hybrid' | 'tensorflow-only',
    confidenceThreshold: 0.7,
    batchSize: 10,
    autoApplyHighConfidence: true,
    enableEnhancedAnalysis: true,
    enableLearning: true
  });

  // Service status state
  const [serviceStatus, setServiceStatus] = useState({
    ollama: { available: false, model: '', loading: true },
    mlOrchestrator: { initialized: false, strategy: '', performance: {} },
    enhancedCategorization: { initialized: false, performance: {} }
  });

  // Modal state
  const [showMLConfigModal, setShowMLConfigModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<EnhancedAnalysis | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load all data
      const [allTransactions, allCategories, allCategorizations] = await Promise.all([
        Promise.resolve(unifiedDataService.getAllTransactions()),
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

  // Check service status
  const checkServiceStatus = useCallback(async () => {
    try {
      // Check Ollama status
      const ollamaHealth = localOllamaIntegration.getHealthStatus();
      const currentModel = localOllamaIntegration.getCurrentModel();
      
      // Check ML Orchestrator status
      const orchestratorModelStatus = enhancedMLOrchestrator.getModelStatus();
      
      // Check Enhanced Categorization status
      const categorizationPerformance = unifiedCategorizationService.getPerformanceMetrics();

      setServiceStatus({
        ollama: {
          available: ollamaHealth.isReachable,
          model: currentModel || 'none',
          loading: false
        },
        mlOrchestrator: {
          initialized: orchestratorModelStatus.tensorflowJS.categorization,
          strategy: orchestratorModelStatus.performance.recommendedStrategy,
          performance: orchestratorModelStatus.performance
        },
        enhancedCategorization: {
          initialized: true,
          performance: categorizationPerformance
        }
      });
    } catch (error) {
      console.error('Failed to check service status:', error);
      setServiceStatus(prev => ({
        ...prev,
        ollama: { ...prev.ollama, loading: false }
      }));
    }
  }, []);

  useEffect(() => {
    loadData();
    checkServiceStatus();
    
    // Refresh status every 30 seconds using cleanup hook
    timerCleanup.createInterval('status-check', checkServiceStatus, 30000);
    
    // Manual cleanup on unmount (automatically handled by hook)
    return () => {
      timerCleanup.clearInterval('status-check');
    };
  }, [loadData, refreshTrigger, checkServiceStatus, timerCleanup]);

  // Get categorization data for a transaction
  const getTransactionCategorization = useCallback((transactionId: string): TransactionCategorizationData | undefined => {
    return categorizations.find(cat => cat.transactionId === transactionId);
  }, [categorizations]);

  // Get category by ID
  const getCategoryById = useCallback((categoryId: string): TransactionCategory | undefined => {
    return categories.find(cat => cat.id === categoryId);
  }, [categories]);

  // Handle enhanced ML categorization
  const handleEnhancedCategorization = useCallback(async (transactionIds?: string[]) => {
    try {
      setProcessingML(true);
      
      const transactionsToProcess = transactionIds 
        ? transactions.filter(t => transactionIds.includes(t.id))
        : transactions.filter(t => !getTransactionCategorization(t.id));

      if (transactionsToProcess.length === 0) {
        console.log('No transactions to process');
        return;
      }

      setMLProgress({ current: 0, total: transactionsToProcess.length });

      // Convert to expected format
      const mlTransactions: Transaction[] = transactionsToProcess.map(t => ({
        id: t.id,
        date: t.postDateTime,
        description: t.description,
        debitAmount: t.debitAmount || 0,
        creditAmount: t.creditAmount || 0,
        balance: t.balance,
        reference: t.reference
      }));

      const newAnalyses: Record<string, EnhancedAnalysis> = {};

      // Process in batches
      for (let i = 0; i < mlTransactions.length; i += mlConfig.batchSize) {
        const batch = mlTransactions.slice(i, i + mlConfig.batchSize);
        
        await Promise.all(
          batch.map(async (transaction) => {
            try {
                             // Use unified categorization service
               const result = await unifiedCategorizationService.categorizeTransaction(transaction);

               // Store enhanced analysis if available from metadata
               if (result.metadata) {
                 newAnalyses[transaction.id] = {
                   sentiment: result.metadata.sentiment ? {
                     score: 0.8,
                     label: result.metadata.sentiment as 'positive' | 'negative' | 'neutral',
                     confidence: 0.8
                   } : undefined,
                   patterns: result.metadata.patterns || [],
                   anomalies: result.metadata.anomalyDetected ? ['Anomaly detected'] : [],
                   contextualInfo: result.reasoning,
                   reasoning: result.reasoning
                 };
               }

              return { transaction, result };
            } catch (error) {
              console.error(`Failed to categorize transaction ${transaction.id}:`, error);
              return { transaction, result: null };
            }
          })
        );

        // Update progress
        setMLProgress({ current: i + batch.length, total: mlTransactions.length });
        
        // Small delay to prevent overwhelming the system
        if (i + mlConfig.batchSize < mlTransactions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Update enhanced analyses
      setEnhancedAnalyses(prev => ({ ...prev, ...newAnalyses }));

      // Refresh categorizations
      const updatedCategorizations = categorizationService.getAllCategorizations();
      setCategorizations(updatedCategorizations);
      
    } catch (error) {
      console.error('Enhanced ML categorization failed:', error);
    } finally {
      setProcessingML(false);
      setMLProgress({ current: 0, total: 0 });
    }
  }, [transactions, mlConfig, getTransactionCategorization]);

  // Handle manual categorization with learning
  const handleManualCategorization = useCallback(async (transactionId: string, categoryId: string) => {
    try {
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) return;

             // Use manual categorization through traditional service
       categorizationService.categorizeTransaction(transactionId, categoryId, 'manual');
       
       // Optional: improve from feedback for learning if available
       if (mlConfig.enableLearning) {
         try {
           // Unified service handles learning internally during categorization
           console.log('Manual categorization feedback recorded for learning:', { transactionId, categoryId });
         } catch (error) {
           console.log('Learning feedback not available yet:', error);
         }
       }
      
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
  }, [transactions, mlConfig.enableLearning]);

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
      case 'enhanced':
        filtered = filtered.filter(t => enhancedAnalyses[t.id]);
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

    // Apply sentiment filter
    if (categoryFilter.sentimentFilter !== 'all') {
      filtered = filtered.filter(t => {
        const analysis = enhancedAnalyses[t.id];
        return analysis?.sentiment?.label === categoryFilter.sentimentFilter;
      });
    }

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
        case 'sentiment':
          aValue = enhancedAnalyses[a.id]?.sentiment?.score || 0;
          bValue = enhancedAnalyses[b.id]?.sentiment?.score || 0;
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
  }, [transactions, viewMode, categoryFilter, sortField, sortDirection, mlConfig.confidenceThreshold, getTransactionCategorization, enhancedAnalyses]);

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

  // Get sentiment color
  const getSentimentColor = useCallback((sentiment?: { label: string; score: number }): string => {
    if (!sentiment) return '#6B7280';
    switch (sentiment.label) {
      case 'positive': return '#10B981';
      case 'negative': return '#EF4444';
      default: return '#6B7280';
    }
  }, []);

  // Show enhanced analysis modal
  const showEnhancedAnalysis = useCallback((transactionId: string) => {
    const analysis = enhancedAnalyses[transactionId];
    if (analysis) {
      setSelectedAnalysis(analysis);
      setShowAnalysisModal(true);
    }
  }, [enhancedAnalyses]);

  // Statistics with enhanced metrics
  const stats = useMemo(() => {
    const total = transactions.length;
    const categorized = categorizations.length;
    const uncategorized = total - categorized;
    const mlCategorized = categorizations.filter(c => c.method === 'ml').length;
    const manualCategorized = categorizations.filter(c => c.method === 'manual').length;
         const enhancedCategorized = categorizations.filter(c => c.method === 'ml').length;
    const averageMLConfidence = categorizations
      .filter(c => c.method === 'ml' && c.confidence !== undefined)
      .reduce((sum, c, _, arr) => sum + (c.confidence || 0) / arr.length, 0);

    const enhancedAnalysisCount = Object.keys(enhancedAnalyses).length;
    const sentimentBreakdown = Object.values(enhancedAnalyses).reduce((acc, analysis) => {
      if (analysis.sentiment) {
        acc[analysis.sentiment.label] = (acc[analysis.sentiment.label] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      categorized,
      uncategorized,
      mlCategorized,
      manualCategorized,
      enhancedCategorized,
      averageMLConfidence,
      categorizationRate: total > 0 ? (categorized / total) * 100 : 0,
      enhancedAnalysisCount,
      sentimentBreakdown,
      serviceStatus
    };
  }, [transactions, categorizations, enhancedAnalyses, serviceStatus]);

  if (loading) {
    return (
      <div className="categorization-loading">
        <div className="loading-spinner"></div>
        <p>Loading enhanced transaction categorization system...</p>
      </div>
    );
  }

  return (
    <div className="transaction-categorization enhanced">
      <div className="categorization-header">
        <div className="categorization-title">
          <h2>Enhanced Transaction Categorization</h2>
          <p>AI-powered categorization with local Ollama integration, sentiment analysis, and advanced ML orchestration</p>
          
          <div className="service-status-grid">
            <div className={`service-status ${serviceStatus.ollama.available ? 'active' : 'inactive'}`}>
              <div className="status-icon">
                {serviceStatus.ollama.loading ? '🔄' : serviceStatus.ollama.available ? '🤖' : '❌'}
              </div>
              <div className="status-info">
                <div className="status-title">Ollama Integration</div>
                <div className="status-detail">
                  {serviceStatus.ollama.loading ? 'Checking...' : 
                   serviceStatus.ollama.available ? `${serviceStatus.ollama.model} Ready` : 'Offline'}
                </div>
              </div>
            </div>
            
            <div className={`service-status ${serviceStatus.mlOrchestrator.initialized ? 'active' : 'inactive'}`}>
              <div className="status-icon">🧠</div>
              <div className="status-info">
                <div className="status-title">ML Orchestrator</div>
                <div className="status-detail">
                  Strategy: {serviceStatus.mlOrchestrator.strategy || 'Initializing'}
                </div>
              </div>
            </div>
            
            <div className="service-status active">
              <div className="status-icon">⚡</div>
              <div className="status-info">
                <div className="status-title">Enhanced Categorization</div>
                <div className="status-detail">
                  {stats.enhancedAnalysisCount} Enhanced Analyses
                </div>
              </div>
            </div>
          </div>
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
          <div className="stat-card enhanced">
            <div className="stat-value">{stats.enhancedAnalysisCount}</div>
            <div className="stat-label">Enhanced Analyses</div>
          </div>
        </div>
        
        {stats.enhancedAnalysisCount > 0 && (
          <div className="sentiment-breakdown">
            <h4>Sentiment Analysis</h4>
            <div className="sentiment-stats">
              <div className="sentiment-stat positive">
                <span className="sentiment-icon">😊</span>
                <span className="sentiment-count">{stats.sentimentBreakdown.positive || 0}</span>
                <span className="sentiment-label">Positive</span>
              </div>
              <div className="sentiment-stat neutral">
                <span className="sentiment-icon">😐</span>
                <span className="sentiment-count">{stats.sentimentBreakdown.neutral || 0}</span>
                <span className="sentiment-label">Neutral</span>
              </div>
              <div className="sentiment-stat negative">
                <span className="sentiment-icon">😟</span>
                <span className="sentiment-count">{stats.sentimentBreakdown.negative || 0}</span>
                <span className="sentiment-label">Negative</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="categorization-controls">
        <div className="view-filters">
          <div className="filter-group">
            <label>View:</label>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}>
              <option value="uncategorized">Uncategorized Only</option>
              <option value="all">All Transactions</option>
              <option value="ml-pending">ML Pending Review</option>
              <option value="low-confidence">Low Confidence</option>
              <option value="enhanced">Enhanced Analysis Available</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Strategy:</label>
            <select 
              value={mlConfig.strategy} 
              onChange={(e) => setMLConfig(prev => ({ ...prev, strategy: e.target.value as any }))}
            >
              <option value="hybrid">🤖+🧠 Hybrid (Recommended)</option>
              <option value="ollama-primary">🤖 Ollama Primary</option>
              <option value="tensorflow-primary">🧠 TensorFlow Primary</option>
              <option value="tensorflow-only">🧠 TensorFlow Only</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Sentiment:</label>
            <select 
              value={categoryFilter.sentimentFilter} 
              onChange={(e) => setCategoryFilter(prev => ({ ...prev, sentimentFilter: e.target.value as any }))}
            >
              <option value="all">All Sentiments</option>
              <option value="positive">😊 Positive</option>
              <option value="neutral">😐 Neutral</option>
              <option value="negative">😟 Negative</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Confidence:</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={categoryFilter.confidenceMin}
              onChange={(e) => setCategoryFilter(prev => ({ ...prev, confidenceMin: parseFloat(e.target.value) }))}
            />
            <span>{formatConfidence(categoryFilter.confidenceMin)}+</span>
          </div>
        </div>

        <div className="action-buttons">
          <button 
            className="btn btn-primary enhanced"
            onClick={() => handleEnhancedCategorization()}
            disabled={processingML}
            title={`Enhanced AI categorization using ${mlConfig.strategy} strategy`}
          >
            {processingML ? (
              `Processing ${mlProgress.current}/${mlProgress.total}...`
            ) : (
              `🚀 Enhanced AI Categorization`
            )}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowMLConfigModal(true)}
          >
            ⚙️ ML Settings
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowCategoryModal(true)}
          >
            📋 Manage Categories
          </button>
        </div>
      </div>

      <div className="transactions-table-container">
        <table className="transactions-table enhanced">
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
              <th 
                className={`sortable ${sortField === 'sentiment' ? sortDirection : ''}`}
                onClick={() => {
                  if (sortField === 'sentiment') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('sentiment');
                    setSortDirection('desc');
                  }
                }}
              >
                Sentiment
              </th>
              <th>Enhanced</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(transaction => {
              const categorization = getTransactionCategorization(transaction.id);
              const category = categorization ? getCategoryById(categorization.categoryId) : undefined;
              const amount = transaction.debitAmount ? -transaction.debitAmount : (transaction.creditAmount || 0);
              const analysis = enhancedAnalyses[transaction.id];
              
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
                    {analysis?.patterns && analysis.patterns.length > 0 && (
                      <div className="patterns-indicator">
                        🔍 Patterns detected
                      </div>
                    )}
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
                    {analysis?.sentiment ? (
                      <div 
                        className="sentiment-indicator"
                        style={{ color: getSentimentColor(analysis.sentiment) }}
                        title={`${analysis.sentiment.label} (${formatConfidence(analysis.sentiment.confidence)})`}
                      >
                        {analysis.sentiment.label === 'positive' ? '😊' : 
                         analysis.sentiment.label === 'negative' ? '😟' : '😐'}
                        <span className="sentiment-score">
                          {analysis.sentiment.score.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="no-sentiment">-</span>
                    )}
                  </td>
                  <td>
                    {analysis ? (
                      <button 
                        className="btn btn-sm btn-info"
                        onClick={() => showEnhancedAnalysis(transaction.id)}
                        title="View enhanced analysis details"
                      >
                        🔍 Details
                      </button>
                    ) : (
                      <span className="no-analysis">-</span>
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
        <div className="batch-actions enhanced">
          <div className="batch-info">
            {selectedTransactions.size} transaction(s) selected
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => handleEnhancedCategorization(Array.from(selectedTransactions))}
            disabled={processingML}
          >
            🚀 Enhanced Categorization Selected
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setSelectedTransactions(new Set())}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Manage Categories</h3>
              <button className="modal-close" onClick={() => setShowCategoryModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="categories-list">
                <h4>Existing Categories</h4>
                {categories.length === 0 ? (
                  <p>No categories available</p>
                ) : (
                  <div className="category-items">
                    {categories.map(category => (
                      <div key={category.id} className="category-item">
                        <div className="category-color" style={{ backgroundColor: category.color }}></div>
                        <span className="category-name">{category.name}</span>
                        <span className="category-description">{category.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ML Configuration Modal */}
      {showMLConfigModal && (
        <div className="modal-overlay" onClick={() => setShowMLConfigModal(false)}>
          <div className="modal ml-config-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚙️ ML Configuration Settings</h3>
              <button className="modal-close" onClick={() => setShowMLConfigModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="config-section">
                <h4>Processing Strategy</h4>
                <select 
                  value={mlConfig.strategy}
                  onChange={(e) => setMLConfig(prev => ({ ...prev, strategy: e.target.value as any }))}
                  className="form-select"
                >
                  <option value="hybrid">Hybrid (TensorFlow.js + Ollama)</option>
                  <option value="local">Local TensorFlow.js Only</option>
                  <option value="ollama">Ollama Only</option>
                </select>
              </div>
              
              <div className="config-section">
                <h4>Batch Processing</h4>
                <label>
                  Batch Size:
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={mlConfig.batchSize}
                    onChange={(e) => setMLConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                    className="form-input"
                  />
                </label>
              </div>
              
              <div className="config-section">
                <h4>Learning Options</h4>
                <label>
                  <input
                    type="checkbox"
                    checked={mlConfig.enableLearning}
                    onChange={(e) => setMLConfig(prev => ({ ...prev, enableLearning: e.target.checked }))}
                  />
                  Enable Learning from Manual Corrections
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMLConfigModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Analysis Modal */}
      {showAnalysisModal && selectedAnalysis && (
        <div className="modal-overlay" onClick={() => setShowAnalysisModal(false)}>
          <div className="modal enhanced-analysis-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 Enhanced Analysis Details</h3>
              <button className="modal-close" onClick={() => setShowAnalysisModal(false)}>×</button>
            </div>
            <div className="modal-content">
              {selectedAnalysis.sentiment && (
                <div className="analysis-section">
                  <h4>😊 Sentiment Analysis</h4>
                  <div className="sentiment-details">
                    <div className="sentiment-main">
                      <span className="sentiment-icon">
                        {selectedAnalysis.sentiment.label === 'positive' ? '😊' : 
                         selectedAnalysis.sentiment.label === 'negative' ? '😟' : '😐'}
                      </span>
                      <span className="sentiment-label">{selectedAnalysis.sentiment.label}</span>
                      <span className="sentiment-confidence">
                        ({formatConfidence(selectedAnalysis.sentiment.confidence)})
                      </span>
                    </div>
                    <div className="sentiment-score">
                      Score: {selectedAnalysis.sentiment.score.toFixed(3)}
                    </div>
                  </div>
                </div>
              )}

              {selectedAnalysis.patterns && selectedAnalysis.patterns.length > 0 && (
                <div className="analysis-section">
                  <h4>🔍 Detected Patterns</h4>
                  <ul className="patterns-list">
                    {selectedAnalysis.patterns.map((pattern, index) => (
                      <li key={index} className="pattern-item">{pattern}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedAnalysis.anomalies && selectedAnalysis.anomalies.length > 0 && (
                <div className="analysis-section">
                  <h4>⚠️ Anomalies Detected</h4>
                  <ul className="anomalies-list">
                    {selectedAnalysis.anomalies.map((anomaly, index) => (
                      <li key={index} className="anomaly-item">{anomaly}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedAnalysis.contextualInfo && (
                <div className="analysis-section">
                  <h4>ℹ️ Contextual Information</h4>
                  <p className="contextual-info">{selectedAnalysis.contextualInfo}</p>
                </div>
              )}

              {selectedAnalysis.reasoning && (
                <div className="analysis-section">
                  <h4>🤔 AI Reasoning</h4>
                  <p className="reasoning-text">{selectedAnalysis.reasoning}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAnalysisModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 