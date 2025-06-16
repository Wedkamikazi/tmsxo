import React, { useState, useEffect } from 'react';
import './.css';

interface CleanupReport {
  totalTransactions: number;
  deletedTransactions: number;
  legacyStorageCleared: number;
  errors: string[];
}

interface CleanupStatus {
  needsCleanup: boolean;
  transactionCount: number;
  legacyStorageCount: number;
  recommendations: string[];
}

const SimpleDataCleanup: React.FC = () => {
  const [cleanupStatus, setCleanupStatus] = useState<CleanupStatus | null>(null);
  const [cleanupReport, setCleanupReport] = useState<CleanupReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'cleanup' | 'emergency' | null>(null);

  useEffect(() => {
    checkCleanupStatus();
  }, []);

  const checkCleanupStatus = () => {
    try {
      // Get current transaction data from localStorage
      const transactionData = localStorage.getItem('treasury-transactions');
      const transactionCount = transactionData ? JSON.parse(transactionData).length : 0;
      
      // Check for legacy storage
      let legacyStorageCount = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('treasury-transactions-') && key !== 'treasury-transactions') {
          legacyStorageCount++;
        }
      }

      const recommendations: string[] = [];
      if (transactionCount > 0) {
        recommendations.push(`Found ${transactionCount} transactions in storage`);
      }
      if (legacyStorageCount > 0) {
        recommendations.push(`Found ${legacyStorageCount} legacy storage entries to clean up`);
      }
      if (transactionCount === 0 && legacyStorageCount === 0) {
        recommendations.push('No transaction data found - storage is clean');
      }

      setCleanupStatus({
        needsCleanup: transactionCount > 0 || legacyStorageCount > 0,
        transactionCount,
        legacyStorageCount,
        recommendations
      });
    } catch (error) {
      console.error('Error checking cleanup status:', error);
    }
  };

  const handleCleanup = async () => {
    setIsRunning(true);
    setCleanupReport(null);
    
    try {
      // Get current transaction count
      const transactionData = localStorage.getItem('treasury-transactions');
      const originalCount = transactionData ? JSON.parse(transactionData).length : 0;
      
      // Clear main transaction storage but keep it as empty array
      localStorage.setItem('treasury-transactions', JSON.stringify([]));
      
      // Clean up legacy storage
      let legacyCleared = 0;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('treasury-transactions-') && key !== 'treasury-transactions') {
          localStorage.removeItem(key);
          legacyCleared++;
        }
      }
      
      setCleanupReport({
        totalTransactions: originalCount,
        deletedTransactions: originalCount,
        legacyStorageCleared: legacyCleared,
        errors: []
      });
      
      // Refresh status after cleanup
      setTimeout(() => {
        checkCleanupStatus();
      }, 1000);
      
    } catch (error) {
      console.error('Cleanup failed:', error);
      setCleanupReport({
        totalTransactions: 0,
        deletedTransactions: 0,
        legacyStorageCleared: 0,
        errors: [error instanceof Error ? error.message : 'Cleanup failed']
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
      const transactionData = localStorage.getItem('treasury-transactions');
      const deletedCount = transactionData ? JSON.parse(transactionData).length : 0;
      
      // Clear ALL transaction-related data
      let legacyCleared = 0;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('treasury-transactions')) {
          localStorage.removeItem(key);
          legacyCleared++;
        }
      }
      
      // Also clear uploaded files data
      localStorage.removeItem('treasury-uploaded-files');
      
      setCleanupReport({
        totalTransactions: deletedCount,
        deletedTransactions: deletedCount,
        legacyStorageCleared: legacyCleared,
        errors: []
      });
      
      // Refresh status after cleanup
      setTimeout(() => {
        checkCleanupStatus();
      }, 1000);
      
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      setCleanupReport({
        totalTransactions: 0,
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

  const confirmAndExecute = (action: 'cleanup' | 'emergency') => {
    setConfirmAction(action);
    setShowConfirmDialog(true);
  };

  const executeConfirmedAction = () => {
    if (confirmAction === 'cleanup') {
      handleCleanup();
    } else if (confirmAction === 'emergency') {
      handleEmergencyCleanup();
    }
  };

  const getStatusIcon = () => {
    if (!cleanupStatus) return '🔄';
    if (cleanupStatus.needsCleanup) return '⚠️';
    return '✅';
  };

  const getStatusText = () => {
    if (!cleanupStatus) return 'Checking data status...';
    if (cleanupStatus.needsCleanup) return 'Old transaction data found - cleanup recommended';
    return 'No old transaction data found';
  };

  const getStatusClass = () => {
    if (!cleanupStatus) return 'status-loading';
    if (cleanupStatus.needsCleanup) return 'status-warning';
    return 'status-clean';
  };

  return (
    <div className="data-cleanup">
      <div className="cleanup-header">
        <h2>Legacy Data Cleanup</h2>
        <p>Clean up old transaction data that remains from before the file deletion fix</p>
      </div>

      <div className="status-section">
        <div className="status-card">
          <div className="status-indicator">
            <span className="status-icon">{getStatusIcon()}</span>
            <span className={`status-text ${getStatusClass()}`}>
              {getStatusText()}
            </span>
          </div>
          
          {cleanupStatus && (
            <div className="status-details">
              <div className="status-item">
                <span className="label">Transaction Records:</span>
                <span className="value">{cleanupStatus.transactionCount}</span>
              </div>
              <div className="status-item">
                <span className="label">Legacy Storage Entries:</span>
                <span className="value">{cleanupStatus.legacyStorageCount}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {cleanupStatus?.recommendations && (
        <div className="recommendations-section">
          <h3>Status</h3>
          <ul className="recommendations-list">
            {cleanupStatus.recommendations.map((rec, index) => (
              <li key={index} className="recommendation-item">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions-section">
        <h3>Cleanup Actions</h3>
        
        <div className="action-card">
          <div className="action-info">
            <h4>🧹 Clean Old Transactions</h4>
            <p>Remove all old transaction data while preserving the file deletion fix. This will clear the 1.3k transactions you mentioned.</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => confirmAndExecute('cleanup')}
            disabled={isRunning || !cleanupStatus?.needsCleanup}
          >
            {isRunning ? 'Running...' : 'Clean Old Data'}
          </button>
        </div>

        <div className="action-card emergency">
          <div className="action-info">
            <h4>🚨 Complete Reset</h4>
            <p><strong>WARNING:</strong> This will delete ALL transaction data AND file records. Use only if you want to start completely fresh!</p>
          </div>
          <button 
            className="btn btn-danger"
            onClick={() => confirmAndExecute('emergency')}
            disabled={isRunning}
          >
            {isRunning ? 'Running...' : 'Complete Reset'}
          </button>
        </div>

        <div className="action-card">
          <div className="action-info">
            <h4>🔄 Refresh Status</h4>
            <p>Check the current data status and get updated information.</p>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={checkCleanupStatus}
            disabled={isRunning}
          >
            Refresh Status
          </button>
        </div>
      </div>

      {cleanupReport && (
        <div className="report-section">
          <h3>Cleanup Report</h3>
          <div className="report-grid">
            <div className="report-item">
              <span className="report-label">Total Transactions:</span>
              <span className="report-value">{cleanupReport.totalTransactions}</span>
            </div>
            <div className="report-item">
              <span className="report-label">Deleted:</span>
              <span className="report-value warning">{cleanupReport.deletedTransactions}</span>
            </div>
            <div className="report-item">
              <span className="report-label">Legacy Storage Cleared:</span>
              <span className="report-value">{cleanupReport.legacyStorageCleared}</span>
            </div>
          </div>
          
          {cleanupReport.errors.length > 0 && (
            <div className="errors-section">
              <h4>Errors:</h4>
              <ul className="errors-list">
                {cleanupReport.errors.map((error, index) => (
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
              {confirmAction === 'cleanup' 
                ? 'Are you sure you want to clean up the old transaction data? This will remove all existing transactions but preserve the file deletion fix.'
                : 'Are you sure you want to perform a complete reset? This will DELETE ALL transaction data and file records and cannot be undone!'
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
                {confirmAction === 'emergency' ? 'Delete All Data' : 'Clean Old Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleDataCleanup;
