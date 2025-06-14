import React, { useState } from 'react';
import { BankStatementImport } from './BankStatementImport';
import { BankAccountManager } from './BankAccountManager';
import { Transactions } from './Transactions';
import { FileManager } from './FileManager';
import QwenIntegrationStatus from './QwenIntegrationStatus';
import { Transaction, BankAccount } from '../types';
import './DataHub.css';

interface DataHubProps {
  onTransactionImport?: (transactions: Transaction[], bankAccount: BankAccount) => void;
}

export const DataHub: React.FC<DataHubProps> = ({ onTransactionImport }) => {
  const [activeTab, setActiveTab] = useState<'bankStatement' | 'accounts' | 'transactions' | 'fileManager' | 'qwenStatus' | 'payroll' | 'investments' | 'reports'>('bankStatement');
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);

  const handleImportComplete = (transactions: Transaction[], bankAccount: BankAccount) => {
    console.log(`Imported ${transactions.length} transactions for ${bankAccount.name}`);
    if (onTransactionImport) {
      onTransactionImport(transactions, bankAccount);
    }
    // Refresh transactions when new data is imported
    setTransactionRefreshKey(prev => prev + 1);
  };

  const handleFileDeleted = (fileId: string) => {
    console.log(`File deleted: ${fileId}`);
    // Refresh transactions when a file is deleted
    setTransactionRefreshKey(prev => prev + 1);
  };

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
      description: 'Generate and export financial reports'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'bankStatement':
        return <BankStatementImport onImportComplete={handleImportComplete} />;
      case 'accounts':
        return <BankAccountManager />;
      case 'transactions':
        return <Transactions key={transactionRefreshKey} refreshTrigger={transactionRefreshKey} />;
      case 'fileManager':
        return <FileManager onFileDeleted={handleFileDeleted} />;
      case 'payroll':
        return (
          <div className="tab-placeholder">
            <div className="placeholder-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>Payroll Data Import</h3>
            <p>This section will allow you to import and process payroll data, employee compensation records, and related HR financial information.</p>
            <div className="placeholder-features">
              <h4>Coming Soon:</h4>
              <ul>
                <li>Employee salary and wage data import</li>
                <li>Benefits and deductions processing</li>
                <li>Tax withholding calculations</li>
                <li>Payroll period reconciliation</li>
              </ul>
            </div>
          </div>
        );
      case 'investments':
        return (
          <div className="tab-placeholder">
            <div className="placeholder-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
              </svg>
            </div>
            <h3>Investment Data Import</h3>
            <p>Manage your investment portfolio data, market valuations, and performance tracking.</p>
            <div className="placeholder-features">
              <h4>Coming Soon:</h4>
              <ul>
                <li>Portfolio holdings import</li>
                <li>Market price updates</li>
                <li>Performance analytics</li>
                <li>Asset allocation tracking</li>
              </ul>
            </div>
          </div>
        );
      case 'reports':
        return (
          <div className="tab-placeholder">
            <div className="placeholder-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
            </div>
            <h3>Financial Reports</h3>
            <p>Generate comprehensive financial reports and export data for analysis and compliance.</p>
            <div className="placeholder-features">
              <h4>Coming Soon:</h4>
              <ul>
                <li>Balance sheet generation</li>
                <li>Income statement reports</li>
                <li>Cash flow analysis</li>
                <li>Custom report builder</li>
              </ul>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="datahub">
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