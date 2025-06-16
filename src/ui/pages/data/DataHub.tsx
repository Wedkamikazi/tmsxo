import React, { useState, useEffect } from 'react';
import { BankStatementImport } from './BankStatementImport';
import { BankAccountManager } from './BankAccountManager';
import { Transactions } from './Transactions';
import { BankBalance } from './BankBalance';
import { FileManager } from './FileManager';
import QwenIntegrationStatus from './QwenIntegrationStatus';
import SimpleDataCleanup from './SimpleDataCleanup';
import { OllamaChat } from './OllamaChat';
import { Settings } from './Settings';
import { ErrorBoundary } from './ErrorBoundary';
import SystemHealthMonitor from './SystemHealthMonitor';
import OllamaControlWidget from './OllamaControlWidget';
import { CreditTransactions } from './CreditTransactions';
import { DebitTransactions } from './DebitTransactions';
import { HRPayments } from './HRPayments';
import { DailyCashManagement } from './DailyCashManagement';
import { TimeDepositManagement } from './TimeDepositManagement';
import { 
  stateManager, 
  saveActiveTab, 
  getActiveTab, 
  shouldReinitializeServices, 
  markServicesInitialized,
  incrementDataRefresh,
  getDataRefreshTrigger,
  registerGlobalRefresh,
  unregisterGlobalRefresh,
  clearComponentStates,
  getStateStorageUsage
} from '../utils/stateManager';
import { Transaction, BankAccount } from '../types';
import './DataHub.css';

// Check for debug mode
const isDebugMode = typeof window !== 'undefined' && (
  window.location.search.includes('debug') || 
  localStorage.getItem('debugMode') === 'true'
);

export const DataHub: React.FC = () => {
  // Professional state management - persists across refreshes
  const [activeTab, setActiveTab] = useState<'bankStatement' | 'accounts' | 'transactions' | 'bankBalance' | 'fileManager' | 'qwenStatus' | 'dataCleanup' | 'ollamaChat' | 'settings' | 'payroll' | 'investments' | 'reports' | 'creditTransactions' | 'debitTransactions' | 'hrPayments' | 'cashManagement' | 'timeDeposits'>(() => getActiveTab() as any);
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(() => getDataRefreshTrigger());
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [eventBus, setEventBus] = useState<any>(null);
  const [unifiedDataService, setUnifiedDataService] = useState<any>(null);
  const [initializationSkipped, setInitializationSkipped] = useState(false);

  useEffect(() => {
    // Register DataHub for global refresh
    const refreshDataHub = () => {
      console.log('🔄 DATAHUB: Refreshing data...');
      const newTrigger = incrementDataRefresh();
      setDataRefreshTrigger(newTrigger);
    };
    
    registerGlobalRefresh('DataHub', refreshDataHub);
    
    // PROFESSIONAL STATE MANAGEMENT: Skip reinitialization if services are fresh
    if (!shouldReinitializeServices()) {
      console.log('🚀 INSTANT LOAD: Using cached services - no reinitialization needed');
      console.log('📂 Restoring tab:', activeTab);
      console.log('⚡ INSTANT REFRESH: Services ready without delay');
      setInitializationSkipped(true);
      setServicesLoaded(true);
      
      // Set services as available immediately when using cache
      import('../services/eventBus').then(eventBusModule => {
        setEventBus(eventBusModule.eventBus);
      });
      import('../services/unifiedDataService').then(unifiedDataServiceModule => {
        setUnifiedDataService(unifiedDataServiceModule.unifiedDataService);
      });
      
      // Mark services as initialized to ensure cache persistence
      markServicesInitialized();
      
      return () => {
        unregisterGlobalRefresh('DataHub');
      };
    }

    // Skip service operations in debug mode
    if (isDebugMode) {
      console.log('🚨 DataHub: Running in debug mode - skipping service operations');
      setServicesLoaded(true);
      setInitializationSkipped(true);
      return () => {
        unregisterGlobalRefresh('DataHub');
      };
    }

    console.log('🔄 First-time initialization: Loading services from scratch...');
    
    // Dynamically load services only when necessary
    const loadServices = async () => {
      try {
        const [eventBusModule, unifiedDataServiceModule] = await Promise.all([
          import('../services/eventBus'),
          import('../services/unifiedDataService')
        ]);
        
        setEventBus(eventBusModule.eventBus);
        setUnifiedDataService(unifiedDataServiceModule.unifiedDataService);
        setServicesLoaded(true);
        markServicesInitialized(); // Save that services are loaded
        console.log('✅ Services loaded and cached for future INSTANT refreshes (NO LOADING)');
      } catch (error) {
        console.warn('Failed to load services:', error);
        setServicesLoaded(true); // Set as loaded to prevent infinite loops
      }
    };

    loadServices();
    
    return () => {
      unregisterGlobalRefresh('DataHub');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Skip service operations if in debug mode or services not loaded
    if (isDebugMode || !servicesLoaded) {
      return;
    }

    // CRITICAL: Skip intensive operations completely if we used cached state
    if (initializationSkipped) {
      console.log('🚀 CACHED MODE: Skipping all startup checks - instant refresh experience');
      console.log('📂 Active tab preserved:', activeTab);
      return;
    }

    // Only perform intensive operations if services were actually loaded fresh
    if (!unifiedDataService) {
      console.log('⏳ Services not ready yet for integrity checks');
      return;
    }

    // Only perform these expensive operations on fresh initialization
    if (unifiedDataService && eventBus) {
      console.log('🔧 Performing one-time integrity checks...');
      
      // Perform startup integrity check
      const integrityCheck = unifiedDataService.validateDataIntegrity();
      if (!integrityCheck.isValid) {
        console.warn('Data integrity issues detected:', integrityCheck.issues);
        // Auto-cleanup orphaned data on startup
        const cleanup = unifiedDataService.cleanupOrphanedData();
        if (cleanup.deletedTransactions > 0 || cleanup.deletedFiles > 0) {
          console.log('Cleaned up orphaned data:', cleanup);
          const newTrigger = incrementDataRefresh();
          setDataRefreshTrigger(newTrigger);
        }
      }

      // Migrate any legacy data on startup
      const migration = unifiedDataService.migrateLegacyData();
      if (migration.migratedTransactions > 0 || migration.migratedFiles > 0) {
        console.log('Migrated legacy data:', migration);
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      }
    }

    // Subscribe to all data events for UI updates (only if we have eventBus)
    if (eventBus) {
      const unsubscribeTransactions = eventBus.on('TRANSACTIONS_UPDATED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      const unsubscribeFiles = eventBus.on('FILE_UPLOADED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      const unsubscribeDelete = eventBus.on('FILE_DELETED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      const unsubscribeAccounts = eventBus.on('ACCOUNT_UPDATED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      // Add listeners for new events
      const unsubscribeFilesUpdated = eventBus.on('FILES_UPDATED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      const unsubscribeAccountsUpdated = eventBus.on('ACCOUNTS_UPDATED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      // Add listeners for debit transaction events
      const unsubscribeDebitExtracted = eventBus.on('DEBIT_TRANSACTIONS_EXTRACTED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      // Add listeners for HR payment events
      const unsubscribeHRExtracted = eventBus.on('HR_PAYMENTS_EXTRACTED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      const unsubscribeHRUpdated = eventBus.on('HR_PAYMENT_UPDATED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      const unsubscribeHRConfirmed = eventBus.on('HR_PAYMENT_CONFIRMED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      const unsubscribeDebitUpdated = eventBus.on('DEBIT_TRANSACTION_UPDATED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      const unsubscribeDebitConfirmed = eventBus.on('DEBIT_TRANSACTION_CONFIRMED', () => {
        const newTrigger = incrementDataRefresh();
        setDataRefreshTrigger(newTrigger);
      });

      return () => {
        unsubscribeTransactions();
        unsubscribeFiles();
        unsubscribeDelete();
        unsubscribeAccounts();
        unsubscribeFilesUpdated();
        unsubscribeAccountsUpdated();
        unsubscribeDebitExtracted();
        unsubscribeHRExtracted();
        unsubscribeHRUpdated();
        unsubscribeHRConfirmed();
        unsubscribeDebitUpdated();
        unsubscribeDebitConfirmed();
      };
    }
    
    // Return undefined when no cleanup is needed
    return undefined;
  }, [servicesLoaded, unifiedDataService, eventBus, initializationSkipped, activeTab]);

  const handleImportComplete = async (transactions: Transaction[], bankAccount: BankAccount) => {
    console.log(`Imported ${transactions.length} transactions for ${bankAccount.name}`);
    
    // Extract credit and debit transactions automatically after bank statement import
    try {
      const { creditTransactionManagementService } = await import('../services/creditTransactionManagementService');
      await creditTransactionManagementService.extractCreditTransactions(transactions, bankAccount.id);
      console.log('✅ Credit transactions extracted successfully');
    } catch (error) {
      console.error('Failed to extract credit transactions:', error);
    }

    try {
      const { debitTransactionManagementService } = await import('../services/debitTransactionManagementService');
      await debitTransactionManagementService.extractDebitTransactions(transactions, bankAccount.id);
      console.log('✅ Debit transactions extracted successfully');
    } catch (error) {
      console.error('Failed to extract debit transactions:', error);
    }

    try {
      const { hrPaymentManagementService } = await import('../services/hrPaymentManagementService');
      await hrPaymentManagementService.extractHRPayments(transactions, bankAccount.id);
      console.log('✅ HR payments extracted successfully');
    } catch (error) {
      console.error('Failed to extract HR payments:', error);
    }
    
    // All other data operations are handled by unified service with event bus
    // Event bus will trigger UI updates
  };

  const handleFileDeleted = (fileId: string) => {
    console.log(`File deleted: ${fileId}`);
    // All data operations are now handled by unified service with event bus
    // No additional handling needed here - event bus will trigger UI updates
  };

  // In debug mode, show the app interface with a debug banner
  const debugBanner = isDebugMode ? (
    <div style={{
      background: 'linear-gradient(135deg, #ff9500 0%, #ff6b00 100%)',
      color: 'white',
      padding: '8px 16px',
      fontSize: '14px',
      fontWeight: 500,
      textAlign: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      🚨 Debug Mode Active - Services Disabled
      <button 
        onClick={() => {
          localStorage.removeItem('debugMode');
          window.location.reload();
        }}
        style={{
          background: 'rgba(255,255,255,0.2)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          marginLeft: '16px'
        }}
      >
        Exit Debug Mode
      </button>
      <button 
        onClick={() => {
          clearComponentStates();
          console.log('🧹 Component states cleared');
        }}
        style={{
          background: 'rgba(255,255,255,0.2)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          marginLeft: '8px'
        }}
      >
        🧹 Clear Cache
      </button>
      <button 
        onClick={() => {
          const usage = getStateStorageUsage();
          window.alert(`State Storage Usage:\nTotal: ${Math.round(usage.totalSize / 1024)}KB\nComponent States: ${Math.round(usage.componentStatesSize / 1024)}KB\nComponents: ${usage.componentCount}`);
        }}
        style={{
          background: 'rgba(255,255,255,0.2)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          marginLeft: '8px'
        }}
      >
        📊 Storage Info
      </button>
      <button 
        onClick={() => {
          stateManager.emergencyReset();
        }}
        style={{
          background: 'rgba(255,255,255,0.2)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          marginLeft: '8px'
        }}
      >
        🗑️ Reset State
      </button>
    </div>
  ) : null;

  const tabs = [
    {
      id: 'bankStatement' as const,
      label: 'Bank Statements',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      description: 'Import and process bank statement CSV files'
    },
    {
      id: 'accounts' as const,
      label: 'Bank Accounts',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      ),
      description: 'Manage and configure your bank accounts'
    },
    {
      id: 'transactions' as const,
      label: 'Transactions',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
          <circle cx="6" cy="6" r="1" />
          <circle cx="6" cy="12" r="1" />
          <circle cx="6" cy="18" r="1" />
        </svg>
      ),
      description: 'View and manage all imported transactions'
    },
    {
      id: 'creditTransactions' as const,
      label: 'Credit Transactions',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v6" />
          <path d="M12 16v6" />
          <path d="M4.93 4.93l4.24 4.24" />
          <path d="M14.83 14.83l4.24 4.24" />
          <path d="M2 12h6" />
          <path d="M16 12h6" />
          <path d="M4.93 19.07l4.24-4.24" />
          <path d="M14.83 9.17l4.24-4.24" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ),
      description: 'Credit transaction reconciliation with AR Aging and forecasts'
    },
    {
      id: 'debitTransactions' as const,
      label: 'Debit Transactions',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 7l10 10" />
          <path d="M7 17L17 7" />
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      ),
      description: 'Debit transaction reconciliation with AP Aging and forecasted payments'
    },
    {
      id: 'hrPayments' as const,
      label: 'HR Payments',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <path d="M20 8v6" />
          <path d="M23 11h-6" />
        </svg>
      ),
      description: 'Employee payment processing and payroll reconciliation'
    },
    {
      id: 'cashManagement' as const,
      label: 'Cash Management',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v6" />
          <path d="M12 16v6" />
          <path d="M4.93 4.93l4.24 4.24" />
          <path d="M14.83 14.83l4.24 4.24" />
          <path d="M2 12h6" />
          <path d="M16 12h6" />
          <path d="M4.93 19.07l4.24-4.24" />
          <path d="M14.83 9.17l4.24-4.24" />
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      ),
      description: 'Daily cash management with intercompany transfers and time deposits'
    },
    {
      id: 'timeDeposits' as const,
      label: 'Time Deposits',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
          <path d="M16 8h2" />
          <path d="M16 16h2" />
          <path d="M6 16h2" />
          <path d="M6 8h2" />
        </svg>
      ),
      description: 'Time deposit tracking, maturity management, and investment analytics'
    },
    {
      id: 'bankBalance' as const,
      label: 'Bank Balance',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
          <path d="M2 10h20" />
        </svg>
      ),
      description: 'Daily closing balances extracted from transaction data'
    },
    {
      id: 'fileManager' as const,
      label: 'File Management',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13,2 13,9 20,9" />
          <path d="M8 13h8" />
          <path d="M8 17h8" />
        </svg>
      ),
      description: 'Manage uploaded CSV files and delete file records'
    },
    {
      id: 'qwenStatus' as const,
      label: 'AI Status',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12l2 2 4-4" />
          <path d="M21 12c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z" />
          <path d="M3 12c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z" />
          <path d="M12 21c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z" />
          <path d="M12 3c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z" />
        </svg>
      ),
      description: 'Monitor Qwen 2.5:32B AI integration status and performance'
    },
    {
      id: 'dataCleanup' as const,
      label: 'Data Cleanup',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      ),
      description: 'Clean up legacy data and fix orphaned transactions'
    },
    {
      id: 'ollamaChat' as const,
      label: 'AI Chat',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 9h8" />
          <path d="M8 13h6" />
        </svg>
      ),
      description: 'Chat with AI assistant powered by Ollama for financial insights'
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 10v6m11-7h-6M7 12H1m15.364-6.364l-4.243 4.243M9.879 14.121l-4.243 4.243M20.364 17.364l-4.243-4.243M9.879 9.879l-4.243-4.243" />
        </svg>
      ),
      description: 'Application settings and debug controls'
    },
    {
      id: 'payroll' as const,
      label: 'Payroll Data',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      description: 'Process payroll and employee compensation data'
    },
    {
      id: 'investments' as const,
      label: 'Investment Data',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
        </svg>
      ),
      description: 'Import investment portfolio and market data'
    },
    {
      id: 'reports' as const,
      label: 'Financial Reports',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10,9 9,9 8,9" />
        </svg>
      ),
      description: 'Generate comprehensive financial reports and analytics'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'bankStatement':
        return (
          <ErrorBoundary componentName="BankStatementImport">
            <BankStatementImport onImportComplete={handleImportComplete} />
          </ErrorBoundary>
        );
      case 'accounts':
        return (
          <ErrorBoundary componentName="BankAccountManager">
            <BankAccountManager />
          </ErrorBoundary>
        );
      case 'transactions':
        return (
          <ErrorBoundary componentName="Transactions">
            <Transactions key={dataRefreshTrigger} refreshTrigger={dataRefreshTrigger} />
          </ErrorBoundary>
        );
      case 'creditTransactions':
        return (
          <ErrorBoundary componentName="CreditTransactions">
            <CreditTransactions dataRefreshTrigger={dataRefreshTrigger} />
          </ErrorBoundary>
        );
      case 'debitTransactions':
        return (
          <ErrorBoundary componentName="DebitTransactions">
            <DebitTransactions dataRefreshTrigger={dataRefreshTrigger} />
          </ErrorBoundary>
        );
      case 'hrPayments':
        return (
          <ErrorBoundary componentName="HRPayments">
            <HRPayments dataRefreshTrigger={dataRefreshTrigger} />
          </ErrorBoundary>
        );
      case 'cashManagement':
        return (
          <ErrorBoundary componentName="DailyCashManagement">
            <DailyCashManagement dataRefreshTrigger={dataRefreshTrigger} />
          </ErrorBoundary>
        );
      case 'timeDeposits':
        return (
          <ErrorBoundary componentName="TimeDepositManagement">
            <TimeDepositManagement dataRefreshTrigger={dataRefreshTrigger} />
          </ErrorBoundary>
        );
      case 'bankBalance':
        return (
          <ErrorBoundary componentName="BankBalance">
            <BankBalance key={dataRefreshTrigger} refreshTrigger={dataRefreshTrigger} />
          </ErrorBoundary>
        );
      case 'fileManager':
        return (
          <ErrorBoundary componentName="FileManager">
            <FileManager onFileDeleted={handleFileDeleted} />
          </ErrorBoundary>
        );
      case 'qwenStatus':
        return (
          <ErrorBoundary componentName="QwenIntegrationStatus">
            <QwenIntegrationStatus />
          </ErrorBoundary>
        );
      case 'dataCleanup':
        return (
          <ErrorBoundary componentName="SimpleDataCleanup">
            <SimpleDataCleanup />
          </ErrorBoundary>
        );
      case 'ollamaChat':
        return (
          <ErrorBoundary componentName="OllamaChat">
            <OllamaChat />
          </ErrorBoundary>
        );
      case 'settings':
        return (
          <ErrorBoundary componentName="Settings">
            <Settings />
          </ErrorBoundary>
        );
      case 'payroll':
        return (
          <div className="coming-soon-container">
            <div className="coming-soon-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2>Payroll Data - Coming Soon</h2>
            <p>This feature is currently under development and will be available in a future release.</p>
            <div className="coming-soon-status">
              <span className="status-badge">Feature Not Implemented</span>
            </div>
          </div>
        );
      case 'investments':
        return (
          <div className="coming-soon-container">
            <div className="coming-soon-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
              </svg>
            </div>
            <h2>Investment Data - Coming Soon</h2>
            <p>This feature is currently under development and will be available in a future release.</p>
            <div className="coming-soon-status">
              <span className="status-badge">Feature Not Implemented</span>
            </div>
          </div>
        );
      case 'reports':
        return (
          <div className="coming-soon-container">
            <div className="coming-soon-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
            </div>
            <h2>Financial Reports - Coming Soon</h2>
            <p>This feature is currently under development and will be available in a future release.</p>
            <div className="coming-soon-status">
              <span className="status-badge">Feature Not Implemented</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="datahub">
      {debugBanner}
      <div className="datahub-header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <div className="app-logo">
                <div className="logo-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5c0-1.66 4-3 9-3s9 1.34 9 3v14c0 1.66-4 3-9 3s-9-1.34-9-3V5z" />
                    <path d="M3 12v7c0 1.66 4 3 9 3s9-1.34 9-3v-7" />
                  </svg>
                </div>
                <div className="app-title-section">
                  <h1 className="app-title">Treasury Management System</h1>
                  <p className="app-subtitle">Financial Data Management Hub</p>
                </div>
              </div>
            </div>
            <div className="header-right">
              {initializationSkipped && (
                <div className="system-status instant-load">
                  <div className="status-indicator"></div>
                  <span>Instant Load</span>
                </div>
              )}
              <div className="header-actions">
                <button 
                  className="header-btn" 
                  title="Clear State Cache (Fix Storage Issues)"
                  onClick={() => {
                    if (window.confirm('Clear component state cache? This will fix storage quota issues but you may need to refresh the page.')) {
                      clearComponentStates();
                      window.alert('✅ Component state cache cleared successfully!');
                    }
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
                <button className="header-btn" title="Settings">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
                  </svg>
                </button>
                                 <button className="header-btn" title="Help">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                     <circle cx="12" cy="12" r="10" />
                     <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                     <circle cx="12" cy="17" r="1" />
                   </svg>
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="datahub-content">
        <div className="container">
          <OllamaControlWidget />
          <SystemHealthMonitor refreshInterval={10000} />
          
          <div className="datahub-tabs">
            <div className="tab-list">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    saveActiveTab(tab.id); // Persist tab selection
                  }}
                  className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                >
                  <div className="tab-icon">{tab.icon}</div>
                  <div className="tab-content">
                    <div className="tab-label">{tab.label}</div>
                    <div className="tab-description">{tab.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="tab-panel">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}; 