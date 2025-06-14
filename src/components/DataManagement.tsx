import React, { useState, useEffect } from 'react';
import { unifiedDataService } from '../services/unifiedDataService';
import './DataManagement.css';

interface StorageInfo {
  bankAccounts: { location: string; filename: string };
  transactions: { location: string; filename: string };
  dataDirectory: string;
  availableFiles: string[];
}

export const DataManagement: React.FC = () => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [backupStatus, setBackupStatus] = useState<string>('');

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    try {
      const info: StorageInfo = {
        bankAccounts: { location: 'localStorage', filename: 'treasury-data-accounts' },
        transactions: { location: 'localStorage', filename: 'treasury-data-transactions' },
        dataDirectory: 'localStorage',
        availableFiles: ['treasury-data-accounts', 'treasury-data-transactions', 'treasury-data-files']
      };
      setStorageInfo(info);
    } catch (error) {
      console.error('Error loading storage info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (_filename: string): string => {
    // This would need to be implemented with actual file size checking
    return 'N/A';
  };

  const handleBackup = async () => {
    setBackupStatus('Creating backup...');
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${storageInfo?.dataDirectory || ''}_backup_${timestamp}`;
      
      // Backup functionality temporarily disabled during consolidation
      const success = false;
      
      if (success) {
        setBackupStatus(`Backup created successfully at: ${backupPath}`);
      } else {
        setBackupStatus('Backup failed. Please check console for details.');
      }
    } catch (error) {
      console.error('Backup error:', error);
      setBackupStatus('Backup failed due to an error.');
    }
    
    // Clear status after 5 seconds
    setTimeout(() => setBackupStatus(''), 5000);
  };

  const handleOpenDataDirectory = () => {
    if (storageInfo?.dataDirectory && storageInfo.dataDirectory !== 'localStorage') {
      // This would need to be implemented with electron or similar desktop framework
      console.log('Opening directory:', storageInfo.dataDirectory);
      setBackupStatus('Directory path copied to console');
      setTimeout(() => setBackupStatus(''), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="data-management">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading storage information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-management">
      <div className="data-management-header">
        <h2>Data Management</h2>
        <p>Manage your treasury system data files and storage location</p>
      </div>

      {storageInfo && (
        <div className="storage-info-section">
          <div className="info-card">
            <h3>Storage Location</h3>
            <div className="storage-type">
              <span className="type-label">Storage Type:</span>
              <span className={`type-value ${storageInfo.dataDirectory === 'localStorage' ? 'browser' : 'filesystem'}`}>
                {storageInfo.dataDirectory === 'localStorage' ? 'Browser Storage (Web App)' : 'File System Storage'}
              </span>
            </div>
            <div className="storage-path">
              <span className="path-label">
                {storageInfo.dataDirectory === 'localStorage' ? 'Storage Location:' : 'Data Directory:'}
              </span>
              <code className="path-value">
                {storageInfo.dataDirectory === 'localStorage' ? 'Browser localStorage' : storageInfo.dataDirectory}
              </code>
            </div>
            
            <div className="storage-details">
              <div className="detail-item">
                <span className="detail-label">Bank Accounts:</span>
                <span className="detail-value">{storageInfo.bankAccounts.filename}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Transactions:</span>
                <span className="detail-value">{storageInfo.transactions.filename}</span>
              </div>
            </div>
          </div>

          <div className="files-list-card">
            <h3>Data Files</h3>
            {storageInfo.availableFiles.length > 0 ? (
              <div className="files-list">
                {storageInfo.availableFiles.map(filename => (
                  <div key={filename} className="file-item">
                    <div className="file-info">
                      <span className="file-name">{filename}.json</span>
                      <span className="file-size">{formatFileSize(filename)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-files">No data files found</p>
            )}
          </div>

          <div className="actions-card">
            <h3>Data Management Actions</h3>
            
            <div className="action-buttons">
              <button
                onClick={handleBackup}
                className="btn btn-primary"
                disabled={!storageInfo || storageInfo.dataDirectory === 'localStorage'}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Create Backup
              </button>
              
              <button
                onClick={handleOpenDataDirectory}
                className="btn btn-secondary"
                disabled={!storageInfo || storageInfo.dataDirectory === 'localStorage'}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Open Data Folder
              </button>
              
              <button
                onClick={loadStorageInfo}
                className="btn btn-outline"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {backupStatus && (
              <div className={`status-message ${backupStatus.includes('successfully') ? 'success' : backupStatus.includes('failed') ? 'error' : 'info'}`}>
                {backupStatus}
              </div>
            )}
          </div>

          {storageInfo.dataDirectory === 'localStorage' && (
            <div className="warning-card">
              <div className="warning-icon">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="warning-content">
                <h4>Web Application Mode</h4>
                <p>
                  You're running the Treasury Management System as a web application. Your data is securely stored in the browser's localStorage.
                  This is normal behavior for web apps. Data will persist between sessions unless you clear your browser data.
                </p>
                <p>
                  <strong>Note:</strong> For a desktop application with file system storage, this would need to be packaged with Electron or similar framework.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 