import React, { useState, useEffect } from 'react';
import { unifiedDataService, type StoredTransaction } from '../services/unifiedDataService';
import { UploadedFile } from '../types';
import './FileManager.css';

interface FileManagerProps {
  onFileDeleted?: (fileId: string) => void;
}

interface DeleteConfirmation {
  fileId: string;
  fileName: string;
  step: 1 | 2;
}

interface DeletionResult {
  report: DeletionReport;
  showRestoreOption: boolean;
}

export const FileManager: React.FC<FileManagerProps> = ({ onFileDeleted }) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletionResult, setDeletionResult] = useState<DeletionResult | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [orphanedCount, setOrphanedCount] = useState(0);
  const [cleaningOrphaned, setCleaningOrphaned] = useState(false);

  // Load uploaded files
  const loadFiles = () => {
    try {
      setLoading(true);
      const files = unifiedDataService.getAllFiles();
      // Sort by upload date (newest first)
      files.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      setUploadedFiles(files);
      
      // Count orphaned transactions (old data without file IDs)
      // Note: This functionality is now handled by the Data Cleanup tab
      setOrphanedCount(0);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle delete initiation
  const handleDeleteClick = (file: UploadedFile) => {
    setDeleteConfirmation({
      fileId: file.id,
      fileName: file.fileName,
      step: 1
    });
  };

  // Handle first confirmation
  const handleFirstConfirmation = () => {
    if (deleteConfirmation) {
      setDeleteConfirmation({
        ...deleteConfirmation,
        step: 2
      });
    }
  };

  // Handle final deletion
  const handleFinalDeletion = async () => {
    if (!deleteConfirmation) return;

    try {
      setDeleting(deleteConfirmation.fileId);
      
      // Delete file and associated transactions
      const fileDeleted = unifiedDataService.deleteFile(deleteConfirmation.fileId);
      const transactionsDeleted = unifiedDataService.deleteTransactionsByFile(deleteConfirmation.fileId);
      
      if (fileDeleted) {
        // Remove from local state
        setUploadedFiles(prev => prev.filter(f => f.id !== deleteConfirmation.fileId));
        
        // Notify parent component (this will refresh transactions)
        if (onFileDeleted) {
          onFileDeleted(deleteConfirmation.fileId);
        }
        
        console.log(`Successfully deleted file: ${deleteConfirmation.fileName} and ${transactionsDeleted} transactions`);
        alert(`Successfully deleted file and ${transactionsDeleted} associated transactions`);
      } else {
        alert('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('An error occurred while deleting the file.');
    } finally {
      setDeleting(null);
      setDeleteConfirmation(null);
    }
  };

  // Cancel deletion
  const cancelDeletion = () => {
    setDeleteConfirmation(null);
  };

  // Handle restore from backup
  const handleRestore = async (backupKey: string) => {
    if (!deletionResult) return;

    try {
      setRestoring(backupKey);
      
      const restoreResult = fileStorageService.restoreFromBackup(backupKey);
      
      if (restoreResult.success) {
        // Reload files to show restored file
        loadFiles();
        
        // Notify parent component to refresh transactions
        if (onFileDeleted) {
          onFileDeleted('restore-trigger');
        }
        
        // Close deletion result dialog
        setDeletionResult(null);
        
        alert(`Successfully restored ${restoreResult.restoredCount} transactions and file record. The Transactions page has been updated.`);
      } else {
        alert(`Failed to restore: ${restoreResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error restoring file:', error);
      alert('An error occurred while restoring the file.');
    } finally {
      setRestoring(null);
    }
  };

  // Close deletion result dialog
  const closeDeletionResult = () => {
    setDeletionResult(null);
  };

  // Handle cleanup of orphaned transactions
  const handleCleanupOrphaned = async () => {
    if (orphanedCount === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${orphanedCount} orphaned transactions?\n\n` +
      'These are transactions that were imported before the file tracking system was implemented. ' +
      'They cannot be linked to any file and should be cleaned up.\n\n' +
      'This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    // Redirect to Data Cleanup tab for orphaned transaction cleanup
    alert('Please use the "Data Cleanup" tab in the main navigation to clean up old transaction data.');
  };

  // Get storage statistics
  const stats = fileStorageService.getStorageStats();

  if (loading) {
    return (
      <div className="file-manager-loading">
        <div className="loading-spinner"></div>
        <p>Loading uploaded files...</p>
      </div>
    );
  }

  return (
    <div className="file-manager">
      <div className="file-manager-header">
        <div className="file-manager-title-section">
          <h2 className="file-manager-title">File Management</h2>
          <p className="file-manager-description">
            Manage your uploaded CSV files and their associated transaction data
          </p>
        </div>
        <div className="file-manager-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.totalFiles}</div>
            <div className="stat-label">Files Uploaded</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalTransactions.toLocaleString()}</div>
            <div className="stat-label">Total Transactions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatFileSize(stats.totalSize)}</div>
            <div className="stat-label">Storage Used</div>
          </div>
        </div>
      </div>

      {/* Orphaned Transactions Warning */}
      {orphanedCount > 0 && (
        <div className="orphaned-warning">
          <div className="warning-content">
            <div className="warning-icon">⚠️</div>
            <div className="warning-message">
              <strong>Orphaned Transaction Data Detected</strong>
              <p>
                Found {orphanedCount.toLocaleString()} transactions that were imported before the file tracking system was implemented. 
                These transactions cannot be properly managed and should be cleaned up.
              </p>
            </div>
            <div className="warning-actions">
              <button 
                onClick={handleCleanupOrphaned}
                disabled={cleaningOrphaned}
                className="btn btn-warning btn-sm"
              >
                {cleaningOrphaned ? (
                  <>
                    <div className="btn-spinner"></div>
                    Cleaning...
                  </>
                ) : (
                  `Clean Up ${orphanedCount.toLocaleString()} Orphaned Transactions`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadedFiles.length === 0 ? (
        <div className="no-files">
          <div className="no-files-icon">📁</div>
          <h3>No Files Uploaded</h3>
          <p>Upload your first CSV file to see it listed here.</p>
        </div>
      ) : (
        <div className="files-table-container">
          <table className="files-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Account</th>
                <th>Upload Date</th>
                <th>Transactions</th>
                <th>File Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {uploadedFiles.map((file) => (
                <tr key={file.id} className={deleting === file.id ? 'deleting' : ''}>
                  <td className="file-name-col">
                    <div className="file-info">
                      <div className="file-icon">📄</div>
                      <div className="file-details">
                        <div className="file-name">{file.fileName}</div>
                        {file.checksum && (
                          <div className="file-checksum">ID: {file.checksum}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="account-col">
                    <div className="account-info">
                      <div className="account-name">{file.accountName}</div>
                      <div className="account-id">{file.accountId}</div>
                    </div>
                  </td>
                  <td className="date-col">
                    {formatDate(file.uploadDate)}
                  </td>
                  <td className="transactions-col">
                    <span className="transaction-count">
                      {file.transactionCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="size-col">
                    {formatFileSize(file.fileSize)}
                  </td>
                  <td className="actions-col">
                    <button
                      onClick={() => handleDeleteClick(file)}
                      disabled={deleting === file.id}
                      className="btn btn-danger btn-sm"
                      title="Delete file and all associated transactions"
                    >
                      {deleting === file.id ? (
                        <>
                          <div className="btn-spinner"></div>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                          Delete
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {deleteConfirmation.step === 1 ? 'Confirm File Deletion' : 'Final Confirmation Required'}
              </h3>
            </div>
            <div className="modal-body">
              {deleteConfirmation.step === 1 ? (
                <>
                  <div className="warning-icon">⚠️</div>
                  <p>
                    Are you sure you want to delete the file <strong>"{deleteConfirmation.fileName}"</strong>?
                  </p>
                  <p className="warning-text">
                    This action will permanently remove the file record and all associated transactions from storage.
                  </p>
                </>
              ) : (
                <>
                  <div className="danger-icon">🚨</div>
                  <p>
                    <strong>FINAL WARNING:</strong> You are about to permanently delete:
                  </p>
                  <ul className="deletion-details">
                    <li>File: <strong>{deleteConfirmation.fileName}</strong></li>
                    <li>All transactions imported from this file</li>
                    <li>All associated transaction data</li>
                  </ul>
                  <p className="final-warning">
                    This action <strong>CANNOT BE UNDONE</strong>. Are you absolutely certain?
                  </p>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={cancelDeletion} className="btn btn-secondary">
                Cancel
              </button>
              {deleteConfirmation.step === 1 ? (
                <button onClick={handleFirstConfirmation} className="btn btn-warning">
                  Yes, Continue
                </button>
              ) : (
                <button onClick={handleFinalDeletion} className="btn btn-danger">
                  Delete Permanently
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deletion Result Modal */}
      {deletionResult && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Deletion Report</h3>
            </div>
            <div className="modal-body">
              <div className={`status-icon ${deletionResult.report.isVerified ? 'success' : 'warning'}`}>
                {deletionResult.report.isVerified ? '✅' : '⚠️'}
              </div>
              
              <h4>File: {deletionResult.report.fileName}</h4>
              
              <div className="deletion-stats">
                <div className="stat-row">
                  <span>Expected to delete:</span>
                  <strong>{deletionResult.report.expectedTransactionCount} transactions</strong>
                </div>
                <div className="stat-row">
                  <span>Actually deleted:</span>
                  <strong>{deletionResult.report.actualDeletedCount} transactions</strong>
                </div>
                <div className="stat-row">
                  <span>Total before:</span>
                  <strong>{deletionResult.report.totalTransactionsBefore} transactions</strong>
                </div>
                <div className="stat-row">
                  <span>Total after:</span>
                  <strong>{deletionResult.report.totalTransactionsAfter} transactions</strong>
                </div>
                <div className="stat-row">
                  <span>Backup created:</span>
                  <strong>{deletionResult.report.backupCreated ? 'Yes' : 'No'}</strong>
                </div>
              </div>

              {deletionResult.report.isVerified ? (
                <div className="success-message">
                  <p>✅ <strong>Deletion completed successfully!</strong></p>
                  <p>All transaction counts match expectations. The file and its {deletionResult.report.actualDeletedCount} transactions have been safely removed.</p>
                  <p><strong>The Transactions page has been automatically updated</strong> to reflect these changes.</p>
                </div>
              ) : (
                <div className="warning-message">
                  <p>⚠️ <strong>Deletion verification failed!</strong></p>
                  <p>The number of deleted transactions doesn't match expectations. This could indicate an issue with the deletion process.</p>
                  {deletionResult.report.backupCreated && (
                    <p><strong>A backup was created before deletion.</strong> You can restore the file if needed.</p>
                  )}
                </div>
              )}

              {deletionResult.report.error && (
                <div className="error-message">
                  <p>❌ <strong>Error:</strong> {deletionResult.report.error}</p>
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button onClick={closeDeletionResult} className="btn btn-secondary">
                Close
              </button>
              
              {deletionResult.report.backupCreated && deletionResult.showRestoreOption && (
                <button 
                  onClick={() => handleRestore(deletionResult.report.backupKey)}
                  disabled={restoring === deletionResult.report.backupKey}
                  className="btn btn-warning"
                >
                  {restoring === deletionResult.report.backupKey ? (
                    <>
                      <div className="btn-spinner"></div>
                      Restoring...
                    </>
                  ) : (
                    'Restore File'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 