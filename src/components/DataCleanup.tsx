import React, { useState, useEffect } from 'react';
import { fileStorageService } from '../services/fileStorageService';
import './DataCleanup.css';

interface MigrationReport {
  totalTransactions: number;
  orphanedTransactions: number;
  migratedTransactions: number;
  deletedTransactions: number;
  legacyStorageCleared: number;
  errors: string[];
}

interface MigrationStatus {
  needsMigration: boolean;
  orphanedCount: number;
  legacyStorageCount: number;
  recommendations: string[];
}

const DataCleanup: React.FC = () => {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'migrate' | 'emergency' | null>(null);

  useEffect(() => {
    checkMigrationStatus();
  }, []);

  const checkMigrationStatus = () => {
    try {
      // Get current transaction data
      const allTransactions = fileStorageService.readData<any[]>('transactions', []);
      const orphanedCount = allTransactions.filter(t => !t.fileId).length;

      // Check for legacy storage
      let legacyStorageCount = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('treasury-transactions-') && key !== 'treasury-transactions') {
          legacyStorageCount++;
        }
      }

      const recommendations: string[] = [];
      if (orphanedCount > 0) {
        recommendations.push(`Found ${orphanedCount} transactions without file tracking`);
      }
      if (legacyStorageCount > 0) {
        recommendations.push(`Found ${legacyStorageCount} legacy storage entries`);
      }
      if (orphanedCount === 0 && legacyStorageCount === 0) {
        recommendations.push('Data is clean and up-to-date');
      }

      setMigrationStatus({
        needsMigration: orphanedCount > 0 || legacyStorageCount > 0,
        orphanedCount,
        legacyStorageCount,
        recommendations
      });
    } catch (error) {
      console.error('Error checking migration status:', error);
    }
  };

  const handleMigration = async () => {
    setIsRunning(true);
    setMigrationReport(null);

    try {
      // Simple cleanup: remove orphaned transactions and legacy storage
      const allTransactions = fileStorageService.readData<any[]>('transactions', []);
      const originalCount = allTransactions.length;

      // Keep only transactions with fileId or recent transactions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const cleanedTransactions = allTransactions.filter(t => {
        if (t.fileId) return true; // Keep transactions with file tracking

        // Keep recent transactions even without fileId
        if (t.importDate) {
          const importDate = new Date(t.importDate);
          return importDate > thirtyDaysAgo;
        }

        return false; // Remove old transactions without file tracking
      });

      // Save cleaned data
      fileStorageService.writeData('transactions', cleanedTransactions);

      // Clean up legacy storage
      let legacyCleared = 0;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('treasury-transactions-') && key !== 'treasury-transactions') {
          localStorage.removeItem(key);
          legacyCleared++;
        }
      }

      const deletedCount = originalCount - cleanedTransactions.length;

      setMigrationReport({
        totalTransactions: originalCount,
        orphanedTransactions: deletedCount,
        migratedTransactions: 0,
        deletedTransactions: deletedCount,
        legacyStorageCleared: legacyCleared,
        errors: []
      });

      // Refresh status after migration
      setTimeout(() => {
        checkMigrationStatus();
      }, 1000);

    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationReport({
        totalTransactions: 0,
        orphanedTransactions: 0,
        migratedTransactions: 0,
        deletedTransactions: 0,
        legacyStorageCleared: 0,
        errors: [error instanceof Error ? error.message : 'Migration failed']
      });
    } finally {
      setIsRunning(false);
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  };

  const handleEmergencyCleanup = async () => {
    setIsRunning(true);

    try {
      // Get current count
      const allTransactions = fileStorageService.readData<any[]>('transactions', []);
      const deletedCount = allTransactions.length;

      // Clear all transaction data
      fileStorageService.writeData('transactions', []);

      // Clear all legacy storage
      let legacyCleared = 0;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('treasury-transactions-')) {
          localStorage.removeItem(key);
          legacyCleared++;
        }
      }

      setMigrationReport({
        totalTransactions: deletedCount,
        orphanedTransactions: deletedCount,
        migratedTransactions: 0,
        deletedTransactions: deletedCount,
        legacyStorageCleared: legacyCleared,
        errors: []
      });

      // Refresh status after cleanup
      setTimeout(() => {
        checkMigrationStatus();
      }, 1000);

    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      setMigrationReport({
        totalTransactions: 0,
        orphanedTransactions: 0,
        migratedTransactions: 0,
        deletedTransactions: 0,
        legacyStorageCleared: 0,
        errors: [error instanceof Error ? error.message : 'Emergency cleanup failed']
      });
    } finally {
      setIsRunning(false);
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  };

  const confirmAndExecute = (action: 'migrate' | 'emergency') => {
    setConfirmAction(action);
    setShowConfirmDialog(true);
  };

  const executeConfirmedAction = () => {
    if (confirmAction === 'migrate') {
      handleMigration();
    } else if (confirmAction === 'emergency') {
      handleEmergencyCleanup();
    }
  };

  const getStatusIcon = () => {
    if (!migrationStatus) return '🔄';
    if (migrationStatus.needsMigration) return '⚠️';
    return '✅';
  };

  const getStatusText = () => {
    if (!migrationStatus) return 'Checking data status...';
    if (migrationStatus.needsMigration) return 'Data cleanup needed';
    return 'Data is clean and up-to-date';
  };

  const getStatusClass = () => {
    if (!migrationStatus) return 'status-loading';
    if (migrationStatus.needsMigration) return 'status-warning';
    return 'status-clean';
  };

  return (
    <div className="data-cleanup">
      <div className="cleanup-header">
        <h2>Data Cleanup & Migration</h2>
        <p>Manage legacy transaction data and fix orphaned records</p>
      </div>

      <div className="status-section">
        <div className="status-card">
          <div className="status-indicator">
            <span className="status-icon">{getStatusIcon()}</span>
            <span className={`status-text ${getStatusClass()}`}>
              {getStatusText()}
            </span>
          </div>
          
          {migrationStatus && (
            <div className="status-details">
              <div className="status-item">
                <span className="label">Orphaned Transactions:</span>
                <span className="value">{migrationStatus.orphanedCount}</span>
              </div>
              <div className="status-item">
                <span className="label">Legacy Storage Entries:</span>
                <span className="value">{migrationStatus.legacyStorageCount}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {migrationStatus?.recommendations && (
        <div className="recommendations-section">
          <h3>Recommendations</h3>
          <ul className="recommendations-list">
            {migrationStatus.recommendations.map((rec, index) => (
              <li key={index} className="recommendation-item">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions-section">
        <h3>Available Actions</h3>
        
        <div className="action-card">
          <div className="action-info">
            <h4>🔄 Smart Migration</h4>
            <p>Automatically migrate orphaned transactions to their corresponding files and clean up legacy storage. This is the recommended approach.</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => confirmAndExecute('migrate')}
            disabled={isRunning || !migrationStatus?.needsMigration}
          >
            {isRunning ? 'Running...' : 'Run Smart Migration'}
          </button>
        </div>

        <div className="action-card emergency">
          <div className="action-info">
            <h4>🚨 Emergency Cleanup</h4>
            <p><strong>WARNING:</strong> This will delete ALL transaction data. Only use this if you want to start completely fresh. This action cannot be undone!</p>
          </div>
          <button 
            className="btn btn-danger"
            onClick={() => confirmAndExecute('emergency')}
            disabled={isRunning}
          >
            {isRunning ? 'Running...' : 'Emergency Cleanup'}
          </button>
        </div>

        <div className="action-card">
          <div className="action-info">
            <h4>🔄 Refresh Status</h4>
            <p>Check the current data status and get updated recommendations.</p>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={checkMigrationStatus}
            disabled={isRunning}
          >
            Refresh Status
          </button>
        </div>
      </div>

      {migrationReport && (
        <div className="report-section">
          <h3>Migration Report</h3>
          <div className="report-grid">
            <div className="report-item">
              <span className="report-label">Total Transactions:</span>
              <span className="report-value">{migrationReport.totalTransactions}</span>
            </div>
            <div className="report-item">
              <span className="report-label">Orphaned Found:</span>
              <span className="report-value">{migrationReport.orphanedTransactions}</span>
            </div>
            <div className="report-item">
              <span className="report-label">Successfully Migrated:</span>
              <span className="report-value success">{migrationReport.migratedTransactions}</span>
            </div>
            <div className="report-item">
              <span className="report-label">Deleted:</span>
              <span className="report-value warning">{migrationReport.deletedTransactions}</span>
            </div>
            <div className="report-item">
              <span className="report-label">Legacy Storage Cleared:</span>
              <span className="report-value">{migrationReport.legacyStorageCleared}</span>
            </div>
          </div>
          
          {migrationReport.errors.length > 0 && (
            <div className="errors-section">
              <h4>Errors:</h4>
              <ul className="errors-list">
                {migrationReport.errors.map((error, index) => (
                  <li key={index} className="error-item">{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {showConfirmDialog && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h3>Confirm Action</h3>
            <p>
              {confirmAction === 'migrate' 
                ? 'Are you sure you want to run the smart migration? This will attempt to fix orphaned transactions and clean up legacy data.'
                : 'Are you sure you want to perform an emergency cleanup? This will DELETE ALL transaction data and cannot be undone!'
              }
            </p>
            <div className="dialog-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </button>
              <button 
                className={`btn ${confirmAction === 'emergency' ? 'btn-danger' : 'btn-primary'}`}
                onClick={executeConfirmedAction}
              >
                {confirmAction === 'emergency' ? 'Delete All Data' : 'Run Migration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataCleanup;
