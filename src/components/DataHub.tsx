import React, { useState, useEffect } from 'react';
import { BankStatementImport } from './BankStatementImport';
import { BankAccountManager } from './BankAccountManager';
import { Transactions } from './Transactions';
import { FileManager } from './FileManager';
import QwenIntegrationStatus from './QwenIntegrationStatus';
import SimpleDataCleanup from './SimpleDataCleanup';
import { OllamaChat } from './OllamaChat';
import { ErrorBoundary } from './ErrorBoundary';
import SystemHealthMonitor from './SystemHealthMonitor';
import OllamaControlWidget from './OllamaControlWidget';
import { 
  stateManager, 
  saveActiveTab, 
  getActiveTab, 
  shouldReinitializeServices, 
  markServicesInitialized,
  incrementDataRefresh,
  getDataRefreshTrigger
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
  const [activeTab, setActiveTab] = useState<'bankStatement' | 'accounts' | 'transactions' | 'fileManager' | 'qwenStatus' | 'dataCleanup' | 'ollamaChat' | 'payroll' | 'investments' | 'reports'>(() => getActiveTab() as any);
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(() => getDataRefreshTrigger());
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [eventBus, setEventBus] = useState<any>(null);
  const [unifiedDataService, setUnifiedDataService] = useState<any>(null);
  const [initializationSkipped, setInitializationSkipped] = useState(false);

  useEffect(() => {
    // Skip service operations in debug mode
    if (isDebugMode) {
      console.log('🚨 DataHub: Running in debug mode - skipping service operations');
      return;
    }

    // Dynamically load services only when not in debug mode
    const loadServices = async () => {
      try {
        const [eventBusModule, unifiedDataServiceModule] = await Promise.all([
          import('../services/eventBus'),
          import('../services/unifiedDataService')
        ]);
        
        setEventBus(eventBusModule.eventBus);
        setUnifiedDataService(unifiedDataServiceModule.unifiedDataService);
        setServicesLoaded(true);
      } catch (error) {
        console.warn('Failed to load services:', error);
      }
    };

    loadServices();
  }, []);

  useEffect(() => {
    // Skip service operations if in debug mode or services not loaded
    if (isDebugMode || !servicesLoaded || !unifiedDataService || !eventBus) {
      return;
    }

    // Perform startup integrity check
    const integrityCheck = unifiedDataService.validateDataIntegrity();
    if (!integrityCheck.isValid) {
      console.warn('Data integrity issues detected:', integrityCheck.issues);
      // Auto-cleanup orphaned data on startup
      const cleanup = unifiedDataService.cleanupOrphanedData();
      if (cleanup.deletedTransactions > 0 || cleanup.deletedFiles > 0) {
        console.log('Cleaned up orphaned data:', cleanup);
        setDataRefreshTrigger(prev => prev + 1);
      }
    }

    // Migrate any legacy data on startup
    const migration = unifiedDataService.migrateLegacyData();
    if (migration.migratedTransactions > 0 || migration.migratedFiles > 0) {
      console.log('Migrated legacy data:', migration);
      setDataRefreshTrigger(prev => prev + 1);
    }

    // Subscribe to all data events for UI updates
    const unsubscribeTransactions = eventBus.on('TRANSACTIONS_UPDATED', () => {
      setDataRefreshTrigger(prev => prev + 1);
    });

    const unsubscribeFiles = eventBus.on('FILE_UPLOADED', () => {
      setDataRefreshTrigger(prev => prev + 1);
    });

    const unsubscribeDelete = eventBus.on('FILE_DELETED', () => {
      setDataRefreshTrigger(prev => prev + 1);
    });

    const unsubscribeAccounts = eventBus.on('ACCOUNT_UPDATED', () => {
      setDataRefreshTrigger(prev => prev + 1);
    });

    // Add listeners for new events
    const unsubscribeFilesUpdated = eventBus.on('FILES_UPDATED', () => {
      setDataRefreshTrigger(prev => prev + 1);
    });

    const unsubscribeAccountsUpdated = eventBus.on('ACCOUNTS_UPDATED', () => {
      setDataRefreshTrigger(prev => prev + 1);
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeFiles();
      unsubscribeDelete();
      unsubscribeAccounts();
      unsubscribeFilesUpdated();
      unsubscribeAccountsUpdated();
    };
  }, [servicesLoaded, unifiedDataService, eventBus]);

  const handleImportComplete = (transactions: Transaction[], bankAccount: BankAccount) => {
    console.log(`Imported ${transactions.length} transactions for ${bankAccount.name}`);
    // All data operations are now handled by unified service with event bus
    // No additional handling needed here - event bus will trigger UI updates
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
          <h1 className="datahub-title">DataHub</h1>
          <p className="datahub-description">
            Central hub for importing, processing, and managing all your financial data
          </p>
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
                  onClick={() => setActiveTab(tab.id)}
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