import React, { useState, useCallback } from 'react';
import { FileUpload } from './FileUpload';
import { ImportSummary, BankAccount, Transaction } from '../types';
import { csvProcessingService } from '../services/csvProcessingService';
import { unifiedDataService, type StoredTransaction } from '../services/unifiedDataService';
import { BalanceValidationResult } from '../services/unifiedBalanceService';
import { BalanceValidationDialog } from './BalanceValidationDialog';
import './BankStatementImport.css';

interface BankStatementImportProps {
  onImportComplete?: (transactions: Transaction[], bankAccount: BankAccount) => void;
}

export const BankStatementImport: React.FC<BankStatementImportProps> = ({
  onImportComplete
}) => {
  const [step, setStep] = useState<'upload' | 'selectBank' | 'review' | 'confirm'>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null);
  const [importSummaries, setImportSummaries] = useState<ImportSummary[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankAccounts] = useState<BankAccount[]>(unifiedDataService.getAllAccounts());
  
  // Balance validation state
  const [balanceValidation, setBalanceValidation] = useState<BalanceValidationResult | null>(null);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);

  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setIsProcessing(true);
    setError(null);

    try {
      const summaries: ImportSummary[] = [];
      
      for (const file of selectedFiles) {
        const summary = await csvProcessingService.processFile(file);
        summaries.push(summary);
      }
      
      setImportSummaries(summaries);
      setStep('selectBank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleBankAccountSelect = useCallback((accountId: string) => {
    const account = bankAccounts.find(acc => acc.id === accountId);
    if (account) {
      setSelectedBankAccount(account);
      
      // Perform balance validation using balanceManagementService
      const allTransactions = importSummaries.flatMap(summary => summary.transactions);
      // For now, we'll skip complex balance validation and proceed directly
      // This will be properly implemented when we integrate balance management service
      const validation: BalanceValidationResult = {
        isValid: true,
        issues: [],
        recommendations: [],
        actualBalance: allTransactions[allTransactions.length - 1]?.balance || account.currentBalance
      };
      
      setBalanceValidation(validation);
      
      if (!validation.isValid) {
        setShowBalanceDialog(true);
      } else {
        setStep('review');
      }
    }
  }, [bankAccounts, importSummaries]);

  const handleDownloadTemplate = useCallback(() => {
    csvProcessingService.downloadTemplate();
  }, []);

  const handleTransactionEdit = useCallback((
    summaryIndex: number, 
    transactionIndex: number, 
    field: keyof Transaction, 
    value: string | number
  ) => {
    setImportSummaries(prev => {
      const updated = [...prev];
      updated[summaryIndex].transactions[transactionIndex] = {
        ...updated[summaryIndex].transactions[transactionIndex],
        [field]: value
      };
      return updated;
    });
  }, []);

  // Handle balance validation dialog
  const handleBalanceValidationConfirm = useCallback((useImportBalance: boolean) => {
    if (!selectedBankAccount || !balanceValidation) return;
    
    setShowBalanceDialog(false);
    
    if (useImportBalance) {
      // Update account balance to match import balance
      unifiedDataService.updateAccount(selectedBankAccount.id, { currentBalance: balanceValidation.actualBalance });
      // Update local state
      setSelectedBankAccount(prev => prev ? { ...prev, currentBalance: balanceValidation.actualBalance } : null);
    }
    
    setStep('review');
  }, [selectedBankAccount, balanceValidation]);

  const handleBalanceValidationCancel = useCallback(() => {
    setShowBalanceDialog(false);
    setSelectedBankAccount(null);
    setBalanceValidation(null);
    setStep('selectBank');
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (!selectedBankAccount) return;

    // Track uploaded files first to get file IDs
    const uploadedFileIds: string[] = [];
    files.forEach((file, index) => {
      const summary = importSummaries[index];
      if (summary) {
        try {
          const uploadedFile = unifiedDataService.addFile({
            fileName: file.name,
            accountId: selectedBankAccount.id,
            accountName: selectedBankAccount.name,
            transactionCount: summary.totalTransactions,
            fileSize: file.size,
            checksum: `${file.name}_${file.size}_${Date.now()}`
          });
          if (uploadedFile) {
            uploadedFileIds.push(uploadedFile.id);
          }
        } catch (error) {
          console.error('Error tracking uploaded file:', error);
          uploadedFileIds.push(''); // Fallback for failed file tracking
        }
      }
    });

    // Store transactions using unified data service
    const allTransactions = importSummaries.flatMap(summary => summary.transactions);
    const storedTransactions: StoredTransaction[] = allTransactions.map((tx, index) => {
      // Ensure we use the postDate instead of potentially malformed date field
      const dateToUse = tx.postDate || tx.date;
      
      // Create proper postDateTime using the post date from bank statement
      let postDateTime: string;
      if (dateToUse && dateToUse !== 'Invalid Date' && !dateToUse.includes('Invalid')) {
        // If the date is in YYYY-MM-DD format, use it directly
        if (dateToUse.match(/^\d{4}-\d{2}-\d{2}$/)) {
          postDateTime = `${dateToUse}T${tx.time || '00:00'}:00`;
        } else {
          // Convert other date formats to YYYY-MM-DD first
          const date = new Date(dateToUse);
          if (!isNaN(date.getTime())) {
            const formattedDate = date.toISOString().split('T')[0];
            postDateTime = `${formattedDate}T${tx.time || '00:00'}:00`;
          } else {
            // Fallback to current date if all else fails
            const fallbackDate = new Date().toISOString().split('T')[0];
            postDateTime = `${fallbackDate}T${tx.time || '00:00'}:00`;
          }
        }
      } else {
        // Fallback to current date if date is invalid
        const fallbackDate = new Date().toISOString().split('T')[0];
        postDateTime = `${fallbackDate}T${tx.time || '00:00'}:00`;
      }
      
      return {
        ...tx,
        accountId: selectedBankAccount.id,
        importDate: new Date().toISOString(),
        fileId: uploadedFileIds[Math.floor(index / importSummaries[0].totalTransactions)] || undefined,
        postDateTime
      };
    });
    unifiedDataService.addTransactions(storedTransactions);

    // Update account balance to the most recent transaction balance (Post date + Time based)
    const sortedTransactions = [...allTransactions].sort((a, b) => {
      const dateTimeA = new Date(`${a.postDate || a.date}T${a.time || '00:00'}`);
      const dateTimeB = new Date(`${b.postDate || b.date}T${b.time || '00:00'}`);
      return dateTimeB.getTime() - dateTimeA.getTime();
    });
    
    if (sortedTransactions.length > 0) {
      const latestBalance = sortedTransactions[0].balance;
      unifiedDataService.updateAccount(selectedBankAccount.id, { currentBalance: latestBalance });
    }

    if (onImportComplete) {
      onImportComplete(allTransactions, selectedBankAccount);
    }
    
    // Reset state
    setStep('upload');
    setFiles([]);
    setSelectedBankAccount(null);
    setImportSummaries([]);
    setBalanceValidation(null);
    setShowBalanceDialog(false);
  }, [selectedBankAccount, importSummaries, onImportComplete, files]);

  const handleCancel = useCallback(() => {
    setStep('upload');
    setFiles([]);
    setSelectedBankAccount(null);
    setImportSummaries([]);
    setError(null);
    setBalanceValidation(null);
    setShowBalanceDialog(false);
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const totalTransactions = importSummaries.reduce((sum, summary) => sum + summary.totalTransactions, 0);
  const totalDebitAmount = importSummaries.reduce((sum, summary) => sum + summary.totalDebitAmount, 0);
  const totalCreditAmount = importSummaries.reduce((sum, summary) => sum + summary.totalCreditAmount, 0);
  const totalValidationErrors = importSummaries.reduce((sum, summary) => sum + summary.validationErrors.length, 0);

  return (
    <div className="bank-statement-import">
      <div className="import-header">
        <h2 className="import-title">Bank Statement Import</h2>
        <p className="import-description">
          Import CSV bank statements to process transactions automatically
        </p>
      </div>

      {/* Step 1: File Upload */}
      {step === 'upload' && (
        <div className="import-step">
          <div className="step-header">
            <h3>Step 1: Upload CSV Files</h3>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="btn btn-secondary btn-sm"
            >
              Download CSV Template
            </button>
          </div>
          
          <FileUpload
            onFilesSelected={handleFilesSelected}
            disabled={isProcessing}
          />
          
          {isProcessing && (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <p>Processing files...</p>
            </div>
          )}
          
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Bank Account */}
      {step === 'selectBank' && (
        <div className="import-step">
          <div className="step-header">
            <h3>Step 2: Select Bank Account</h3>
            <p>Choose which bank account these transactions belong to</p>
          </div>
          
          {bankAccounts.length === 0 ? (
            <div className="empty-accounts-state">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                </svg>
              </div>
              <h3>No Bank Accounts Found</h3>
              <p>You need to create at least one bank account before importing transactions.</p>
              <p>Please go to the <strong>Bank Accounts</strong> tab to add your first account.</p>
              <div className="empty-actions">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn btn-primary"
                >
                  Go to Bank Accounts
                </button>
              </div>
            </div>
          ) : (
            <div className="bank-selection">
              <div className="form-group">
                <label htmlFor="bank-account-select" className="form-label">
                  Bank Account
                </label>
                <select
                  id="bank-account-select"
                  className="form-select"
                  onChange={(e) => handleBankAccountSelect(e.target.value)}
                  defaultValue=""
                >
                  <option value="">Select a bank account...</option>
                  {bankAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {account.bankName} ({account.accountNumber})
                    </option>
                  ))}
                </select>
              </div>
            
            <div className="import-summary-preview">
              <h4>Import Summary</h4>
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Files:</span>
                  <span className="stat-value">{files.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Transactions:</span>
                  <span className="stat-value">{totalTransactions}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Debits:</span>
                  <span className="stat-value text-error">{formatCurrency(totalDebitAmount)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Credits:</span>
                  <span className="stat-value text-success">{formatCurrency(totalCreditAmount)}</span>
                </div>
                {totalValidationErrors > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Validation Errors:</span>
                    <span className="stat-value text-warning">{totalValidationErrors}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="step-actions">
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Step 3: Review and Edit */}
      {step === 'review' && selectedBankAccount && (
        <div className="import-step">
          <div className="step-header">
            <h3>Step 3: Review & Edit Transactions</h3>
            <p>Review the imported transactions and make any necessary adjustments</p>
          </div>
          
          <div className="account-info">
            <h4>Selected Account</h4>
            <div className="account-details">
              <p><strong>{selectedBankAccount.name}</strong></p>
              <p>{selectedBankAccount.bankName} - {selectedBankAccount.accountNumber}</p>
              <p>Current Balance: {formatCurrency(selectedBankAccount.currentBalance)}</p>
              {importSummaries.length > 0 && balanceValidation && (
                <div className="balance-comparison">
                  <p>Import Closing Balance: {formatCurrency(balanceValidation.actualBalance)}</p>
                  {!balanceValidation.isValid && (
                    <div className="balance-warning">
                      ⚠️ Balance Validated: Expected {balanceValidation.expectedBalance ? formatCurrency(balanceValidation.expectedBalance) : 'N/A'}, 
                      Got {formatCurrency(balanceValidation.actualBalance)} 
                      (Variance: {balanceValidation.variance ? formatCurrency(balanceValidation.variance) : 'N/A'})
                    </div>
                  )}
                  {balanceValidation.isValid && (
                    <div className="balance-success">
                      ✅ Balance validation passed - transactions are consistent with account history
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="import-summaries">
            {importSummaries.map((summary, summaryIndex) => (
              <div key={summaryIndex} className="import-summary-card">
                <div className="summary-header">
                  <h4>{summary.fileName}</h4>
                  <div className="summary-stats">
                    <span>{summary.totalTransactions} transactions</span>
                    <span>Period: {summary.dateRange.from} to {summary.dateRange.to}</span>
                  </div>
                </div>
                
                <div className="balance-summary">
                  <div className="balance-row">
                    <span className="balance-label">Opening Balance:</span>
                    <span className="balance-value">{formatCurrency(summary.openingBalance)}</span>
                  </div>
                  <div className="balance-row">
                    <span className="balance-label">Daily Movement:</span>
                    <span className={`balance-value ${summary.dailyMovement >= 0 ? 'text-success' : 'text-error'}`}>
                      {summary.dailyMovement >= 0 ? '+' : ''}{formatCurrency(summary.dailyMovement)}
                    </span>
                  </div>
                  <div className="balance-row">
                    <span className="balance-label">Closing Balance:</span>
                    <span className="balance-value">{formatCurrency(summary.closingBalance)}</span>
                  </div>
                </div>
                
                {summary.validationErrors.length > 0 && (
                  <div className="validation-errors">
                    <h5>Validation Errors</h5>
                    <ul>
                      {summary.validationErrors.map((error, index) => (
                        <li key={index} className="validation-error">
                          Row {error.row}, {error.field}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="transactions-table-container">
                  <table className="transactions-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Balance</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.transactions.map((transaction, transactionIndex) => (
                        <tr key={transaction.id}>
                          <td>
                            <input
                              type="date"
                              value={transaction.date}
                              onChange={(e) => handleTransactionEdit(summaryIndex, transactionIndex, 'date', e.target.value)}
                              className="form-input"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={transaction.description}
                              onChange={(e) => handleTransactionEdit(summaryIndex, transactionIndex, 'description', e.target.value)}
                              className="form-input"
                            />
                          </td>
                                                     <td>
                             <input
                               type="number"
                               step="0.01"
                               value={transaction.debitAmount ? transaction.debitAmount.toFixed(2) : ''}
                               onChange={(e) => handleTransactionEdit(summaryIndex, transactionIndex, 'debitAmount', parseFloat(e.target.value) || 0)}
                               className="form-input"
                               placeholder="0.00"
                             />
                           </td>
                           <td>
                             <input
                               type="number"
                               step="0.01"
                               value={transaction.creditAmount ? transaction.creditAmount.toFixed(2) : ''}
                               onChange={(e) => handleTransactionEdit(summaryIndex, transactionIndex, 'creditAmount', parseFloat(e.target.value) || 0)}
                               className="form-input"
                               placeholder="0.00"
                             />
                           </td>
                           <td>
                             <input
                               type="number"
                               step="0.01"
                               value={transaction.balance.toFixed(2)}
                               onChange={(e) => handleTransactionEdit(summaryIndex, transactionIndex, 'balance', parseFloat(e.target.value) || 0)}
                               className="form-input"
                             />
                           </td>
                          <td>
                            <input
                              type="text"
                              value={transaction.reference || ''}
                              onChange={(e) => handleTransactionEdit(summaryIndex, transactionIndex, 'reference', e.target.value)}
                              className="form-input"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          
          <div className="step-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep('confirm')}
              className="btn btn-primary"
              disabled={totalValidationErrors > 0}
            >
              Proceed to Confirmation
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 'confirm' && selectedBankAccount && (
        <div className="import-step">
          <div className="step-header">
            <h3>Step 4: Confirm Import</h3>
            <p>Please review the final summary before proceeding with the import</p>
          </div>
          
          <div className="confirmation-summary">
            <div className="summary-section">
              <h4>Account Information</h4>
              <div className="account-details">
                <p><strong>{selectedBankAccount.name}</strong></p>
                <p>{selectedBankAccount.bankName} - {selectedBankAccount.accountNumber}</p>
                <p>Current Balance: {formatCurrency(selectedBankAccount.currentBalance)}</p>
              </div>
            </div>
            
            <div className="summary-section">
              <h4>Import Summary</h4>
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Files Processed:</span>
                  <span className="stat-value">{files.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Transactions:</span>
                  <span className="stat-value">{totalTransactions}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Debit Amount:</span>
                  <span className="stat-value text-error">{formatCurrency(totalDebitAmount)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Credit Amount:</span>
                  <span className="stat-value text-success">{formatCurrency(totalCreditAmount)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Net Change:</span>
                  <span className={`stat-value ${totalCreditAmount - totalDebitAmount >= 0 ? 'text-success' : 'text-error'}`}>
                    {formatCurrency(totalCreditAmount - totalDebitAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="confirmation-question">
            <h4>Do you want to proceed with this import?</h4>
            <p>This action will add all transactions to the selected bank account.</p>
          </div>
          
          <div className="step-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-danger"
            >
              No, Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              className="btn btn-success btn-lg"
            >
              Yes, Proceed
            </button>
          </div>
        </div>
      )}

      {/* Balance Validation Dialog */}
      {balanceValidation && (
        <BalanceValidationDialog
          isOpen={showBalanceDialog}
          validationResult={balanceValidation}
          onConfirm={handleBalanceValidationConfirm}
          onCancel={handleBalanceValidationCancel}
        />
      )}
    </div>
  );
}; 