import React, { useState, useEffect, useCallback } from 'react';
import { BankAccount } from '../types';
import { unifiedDataService } from '../services/unifiedDataService';
import { unifiedBalanceService } from '../services/unifiedBalanceService';
import { 
  registerGlobalRefresh, 
  unregisterGlobalRefresh, 
  shouldComponentUseCache,
  setComponentState,
  getComponentState 
} from '../utils/stateManager';
import './BankAccountManager.css';

interface BankAccountManagerProps {
  onAccountsUpdated?: () => void;
}

interface AccountFormData {
  name: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  currentBalance: string;
}

interface BalanceAdjustmentFormData {
  newBalance: string;
  effectiveDate: string;
  reason: string;
}

export const BankAccountManager: React.FC<BankAccountManagerProps> = ({ onAccountsUpdated }) => {
  // Initialize with cached state if available
  const cachedState = getComponentState<{
    accounts: BankAccount[];
    isAddingAccount: boolean;
  }>('BankAccountManager');
  
  const [accounts, setAccounts] = useState<BankAccount[]>(() => {
    if (cachedState?.accounts && shouldComponentUseCache('BankAccountManager')) {
      console.log('🚀 BANK ACCOUNTS: Using cached account data');
      return cachedState.accounts;
    }
    return unifiedDataService.getAllAccounts();
  });
  
  const [isAddingAccount, setIsAddingAccount] = useState(cachedState?.isAddingAccount || false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [adjustingBalanceAccount, setAdjustingBalanceAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    accountNumber: '',
    bankName: '',
    currency: 'USD',
    currentBalance: '0.00'
  });
  const [balanceFormData, setBalanceFormData] = useState<BalanceAdjustmentFormData>({
    newBalance: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    reason: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [balanceErrors, setBalanceErrors] = useState<Record<string, string>>({});
  const [showBalanceHistory, setShowBalanceHistory] = useState<Record<string, boolean>>({});

  const refreshAccounts = useCallback(() => {
    console.log('🔄 BANK ACCOUNTS: Refreshing account data...');
    const freshAccounts = unifiedDataService.getAllAccounts();
    setAccounts(freshAccounts);
    
    // Save state for caching
    setComponentState('BankAccountManager', {
      accounts: freshAccounts,
      isAddingAccount
    });
    
    if (onAccountsUpdated) {
      onAccountsUpdated();
    }
  }, [onAccountsUpdated, isAddingAccount]);

  // Register for global refresh
  useEffect(() => {
    registerGlobalRefresh('BankAccountManager', refreshAccounts);
    
    return () => {
      unregisterGlobalRefresh('BankAccountManager');
    };
  }, [refreshAccounts]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      accountNumber: '',
      bankName: '',
      currency: 'USD',
      currentBalance: '0.00'
    });
    setErrors({});
    setIsAddingAccount(false);
    setEditingAccount(null);
  }, []);

  const validateForm = useCallback((data: AccountFormData): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!data.name.trim()) {
      newErrors.name = 'Account name is required';
    }

    if (!data.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (accounts.some(acc => 
      acc.accountNumber === data.accountNumber.trim() && 
      (!editingAccount || acc.id !== editingAccount.id)
    )) {
      newErrors.accountNumber = 'Account number already exists';
    }

    if (!data.bankName.trim()) {
      newErrors.bankName = 'Bank name is required';
    }

    if (!data.currency.trim()) {
      newErrors.currency = 'Currency is required';
    }

    const balance = parseFloat(data.currentBalance);
    if (isNaN(balance)) {
      newErrors.currentBalance = 'Current balance must be a valid number';
    }

    return newErrors;
  }, [accounts, editingAccount]);

  const handleInputChange = useCallback((field: keyof AccountFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const handleAddAccount = useCallback(() => {
    setIsAddingAccount(true);
    setEditingAccount(null);
    resetForm();
  }, [resetForm]);

  const handleEditAccount = useCallback((account: BankAccount) => {
    setEditingAccount(account);
    setIsAddingAccount(false);
    setFormData({
      name: account.name,
      accountNumber: account.accountNumber,
      bankName: account.bankName,
      currency: account.currency,
      currentBalance: account.currentBalance.toFixed(2)
    });
    setErrors({});
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors = validateForm(formData);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const accountData = {
      name: formData.name.trim(),
      accountNumber: formData.accountNumber.trim(),
      bankName: formData.bankName.trim(),
      currency: formData.currency.trim() as 'SAR' | 'USD' | 'AED',
      currentBalance: parseFloat(formData.currentBalance)
    };

    try {
      if (editingAccount) {
        unifiedDataService.updateAccount(editingAccount.id, accountData);
      } else {
        // For new accounts, add the required fields
        unifiedDataService.addAccount(accountData);
      }
      
      refreshAccounts();
      resetForm();
    } catch (error) {
      console.error('Error saving account:', error);
      setErrors({ submit: 'Failed to save account. Please try again.' });
    }
  }, [formData, validateForm, editingAccount, refreshAccounts, resetForm]);

  const handleDeleteAccount = useCallback((accountId: string) => {
    // Check if account has associated transactions
    const accountTransactions = unifiedDataService.getTransactionsByAccount(accountId);
    
    if (accountTransactions.length > 0) {
      if (window.confirm(
        `This account has ${accountTransactions.length} transactions. Deleting the account will also delete all associated transactions. This action cannot be undone. Are you sure?`
      )) {
        // Create snapshot before deletion
        const snapshotId = unifiedDataService.createSnapshot('delete', `account-${accountId}-${Date.now()}`);
        
        // Delete all transactions for this account
        const deletedTransactionCount = unifiedDataService.deleteTransactionsByAccount(accountId);
        
        // Delete the account
        const accountDeleted = unifiedDataService.deleteAccount(accountId);
        
        if (accountDeleted) {
          alert(`Successfully deleted account and ${deletedTransactionCount} associated transactions. A backup snapshot was created: ${snapshotId}`);
          refreshAccounts();
        } else {
          alert('Failed to delete account. Please try again.');
        }
      }
    } else {
      if (window.confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
        // Create snapshot before deletion
        const snapshotId = unifiedDataService.createSnapshot('delete', `account-${accountId}-${Date.now()}`);
        
        // Delete the account
        const accountDeleted = unifiedDataService.deleteAccount(accountId);
        
        if (accountDeleted) {
          alert(`Account deletion completed. Backup snapshot created: ${snapshotId}`);
          refreshAccounts();
        } else {
          alert('Failed to delete account. Please try again.');
        }
      }
    }
  }, [refreshAccounts]);

  // Balance adjustment methods
  const handleAdjustBalance = useCallback((account: BankAccount) => {
    setAdjustingBalanceAccount(account);
    setBalanceFormData({
      newBalance: account.currentBalance.toFixed(2),
      effectiveDate: new Date().toISOString().split('T')[0],
      reason: ''
    });
    setBalanceErrors({});
  }, []);

  const validateBalanceForm = useCallback((data: BalanceAdjustmentFormData): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    const balance = parseFloat(data.newBalance);
    if (isNaN(balance)) {
      newErrors.newBalance = 'Balance must be a valid number';
    }

    if (!data.effectiveDate) {
      newErrors.effectiveDate = 'Effective date is required';
    }

    if (!data.reason.trim()) {
      newErrors.reason = 'Reason for adjustment is required';
    }

    return newErrors;
  }, []);

  const handleBalanceSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adjustingBalanceAccount) return;

    const newErrors = validateBalanceForm(balanceFormData);
    if (Object.keys(newErrors).length > 0) {
      setBalanceErrors(newErrors);
      return;
    }

    try {
      const newBalance = parseFloat(balanceFormData.newBalance);
              const updatedAccount = unifiedBalanceService.updateAccountBalance(
        adjustingBalanceAccount,
        newBalance,
        balanceFormData.effectiveDate,
        balanceFormData.reason
      );

      // Update the account in the service
      unifiedDataService.updateAccount(updatedAccount.id, {
        currentBalance: updatedAccount.currentBalance
      });

      refreshAccounts();
      setAdjustingBalanceAccount(null);
      setBalanceFormData({
        newBalance: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        reason: ''
      });
    } catch (error) {
      console.error('Error adjusting balance:', error);
      setBalanceErrors({ submit: 'Failed to adjust balance. Please try again.' });
    }
  }, [adjustingBalanceAccount, balanceFormData, validateBalanceForm, refreshAccounts]);

  const toggleBalanceHistory = useCallback((accountId: string) => {
    setShowBalanceHistory(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="bank-account-manager">
      <div className="manager-header">
        <h2>Bank Account Management</h2>
        <p>Add, edit, and manage your bank accounts</p>
      </div>

      <div className="accounts-section">
        <div className="section-header">
          <h3>Your Bank Accounts ({accounts.length})</h3>
          <button
            type="button"
            onClick={handleAddAccount}
            className="btn btn-primary"
          >
            Add New Account
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
            </div>
            <h3>No Bank Accounts</h3>
            <p>Get started by adding your first bank account</p>
          </div>
        ) : (
          <div className="accounts-grid">
            {accounts.map((account) => (
              <div key={account.id} className="account-card">
                <div className="account-header">
                  <h4>{account.name}</h4>
                  <div className="account-actions">
                    <button
                      type="button"
                      onClick={() => handleAdjustBalance(account)}
                      className="btn-icon"
                      title="Adjust balance"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBalanceHistory(account.id)}
                      className="btn-icon"
                      title="View balance history"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3v5h5M3 8l4-4 4 4 8-8" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditAccount(account)}
                      className="btn-icon"
                      title="Edit account"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(account.id)}
                      className="btn-icon btn-danger"
                      title="Delete account"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="account-details">
                  <p><strong>Bank:</strong> {account.bankName}</p>
                  <p><strong>Account Number:</strong> {account.accountNumber}</p>
                  <p><strong>Currency:</strong> {account.currency}</p>
                  <p><strong>Current Balance:</strong> <span className="balance">{formatCurrency(account.currentBalance)}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(isAddingAccount || editingAccount) && (
        <div className="account-form-section">
          <div className="form-header">
            <h3>{editingAccount ? 'Edit Account' : 'Add New Account'}</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="account-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="account-name" className="form-label">
                  Account Name *
                </label>
                <input
                  id="account-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`form-input ${errors.name ? 'error' : ''}`}
                  placeholder="e.g., Main Operating Account"
                />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="account-number" className="form-label">
                  Account Number *
                </label>
                <input
                  id="account-number"
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                  className={`form-input ${errors.accountNumber ? 'error' : ''}`}
                  placeholder="e.g., 1234567890"
                />
                {errors.accountNumber && <span className="form-error">{errors.accountNumber}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bank-name" className="form-label">
                  Bank Name *
                </label>
                <input
                  id="bank-name"
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  className={`form-input ${errors.bankName ? 'error' : ''}`}
                  placeholder="e.g., First National Bank"
                />
                {errors.bankName && <span className="form-error">{errors.bankName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="currency" className="form-label">
                  Currency *
                </label>
                <select
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className={`form-select ${errors.currency ? 'error' : ''}`}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                </select>
                {errors.currency && <span className="form-error">{errors.currency}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="current-balance" className="form-label">
                  Current Balance *
                </label>
                <input
                  id="current-balance"
                  type="number"
                  step="0.01"
                  value={formData.currentBalance}
                  onChange={(e) => handleInputChange('currentBalance', e.target.value)}
                  className={`form-input ${errors.currentBalance ? 'error' : ''}`}
                  placeholder="0.00"
                />
                {errors.currentBalance && <span className="form-error">{errors.currentBalance}</span>}
              </div>
            </div>

            {errors.submit && (
              <div className="form-error-message">
                {errors.submit}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                {editingAccount ? 'Update Account' : 'Add Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Balance Adjustment Form */}
      {adjustingBalanceAccount && (
        <div className="balance-adjustment-section">
          <div className="form-header">
            <h3>Adjust Balance - {adjustingBalanceAccount.name}</h3>
            <p>Update the account balance with an effective date and reason</p>
          </div>
          
          <form onSubmit={handleBalanceSubmit} className="balance-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="current-balance-display" className="form-label">
                  Current Balance
                </label>
                <input
                  id="current-balance-display"
                  type="text"
                  value={formatCurrency(adjustingBalanceAccount.currentBalance)}
                  disabled
                  className="form-input disabled"
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-balance" className="form-label">
                  New Balance *
                </label>
                <input
                  id="new-balance"
                  type="number"
                  step="0.01"
                  value={balanceFormData.newBalance}
                  onChange={(e) => setBalanceFormData(prev => ({ ...prev, newBalance: e.target.value }))}
                  className={`form-input ${balanceErrors.newBalance ? 'error' : ''}`}
                  placeholder="0.00"
                />
                {balanceErrors.newBalance && <span className="form-error">{balanceErrors.newBalance}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="effective-date" className="form-label">
                  Effective Date *
                </label>
                <input
                  id="effective-date"
                  type="date"
                  value={balanceFormData.effectiveDate}
                  onChange={(e) => setBalanceFormData(prev => ({ ...prev, effectiveDate: e.target.value }))}
                  className={`form-input ${balanceErrors.effectiveDate ? 'error' : ''}`}
                />
                {balanceErrors.effectiveDate && <span className="form-error">{balanceErrors.effectiveDate}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="adjustment-reason" className="form-label">
                  Reason for Adjustment *
                </label>
                <select
                  id="adjustment-reason"
                  value={balanceFormData.reason}
                  onChange={(e) => setBalanceFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className={`form-select ${balanceErrors.reason ? 'error' : ''}`}
                >
                  <option value="">Select a reason...</option>
                  <option value="Bank reconciliation">Bank reconciliation</option>
                  <option value="Manual correction">Manual correction</option>
                  <option value="Interest adjustment">Interest adjustment</option>
                  <option value="Fee adjustment">Fee adjustment</option>
                  <option value="Opening balance setup">Opening balance setup</option>
                  <option value="Other">Other</option>
                </select>
                {balanceErrors.reason && <span className="form-error">{balanceErrors.reason}</span>}
              </div>
            </div>

            {balanceFormData.reason === 'Other' && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="custom-reason" className="form-label">
                    Custom Reason *
                  </label>
                  <input
                    id="custom-reason"
                    type="text"
                    placeholder="Enter custom reason..."
                    className="form-input"
                    onChange={(e) => setBalanceFormData(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="adjustment-preview">
              <h4>Adjustment Preview</h4>
              <div className="preview-details">
                <p><strong>Current Balance:</strong> {formatCurrency(adjustingBalanceAccount.currentBalance)}</p>
                <p><strong>New Balance:</strong> {balanceFormData.newBalance ? formatCurrency(parseFloat(balanceFormData.newBalance)) : '$0.00'}</p>
                <p><strong>Adjustment Amount:</strong> 
                  <span className={`adjustment-amount ${balanceFormData.newBalance && parseFloat(balanceFormData.newBalance) - adjustingBalanceAccount.currentBalance >= 0 ? 'positive' : 'negative'}`}>
                    {balanceFormData.newBalance ? 
                      (parseFloat(balanceFormData.newBalance) - adjustingBalanceAccount.currentBalance >= 0 ? '+' : '') + 
                      formatCurrency(parseFloat(balanceFormData.newBalance) - adjustingBalanceAccount.currentBalance) : 
                      '$0.00'
                    }
                  </span>
                </p>
              </div>
            </div>

            {balanceErrors.submit && (
              <div className="form-error-message">
                {balanceErrors.submit}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={() => setAdjustingBalanceAccount(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Apply Adjustment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Balance History Display */}
      {accounts.map(account => 
        showBalanceHistory[account.id] && (
          <div key={`history-${account.id}`} className="balance-history-section">
            <div className="form-header">
              <h3>Balance History - {account.name}</h3>
              <button
                type="button"
                onClick={() => toggleBalanceHistory(account.id)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
            
            <div className="balance-history">
              {(() => {
                      const history = unifiedBalanceService.getBalanceHistory(account.id);
      const adjustments = unifiedBalanceService.getBalanceAdjustments(account.id);
                
                if (history.length === 0 && adjustments.length === 0) {
                  return (
                    <div className="empty-history">
                      <p>No balance history available for this account.</p>
                    </div>
                  );
                }

                return (
                  <div className="history-content">
                    {adjustments.length > 0 && (
                      <div className="adjustments-section">
                        <h4>Balance Adjustments</h4>
                        <div className="adjustments-list">
                          {adjustments.map(adjustment => (
                            <div key={adjustment.id} className="adjustment-item">
                              <div className="adjustment-header">
                                <span className="adjustment-date">{adjustment.date}</span>
                                <span className={`adjustment-amount ${adjustment.adjustmentAmount >= 0 ? 'positive' : 'negative'}`}>
                                  {adjustment.adjustmentAmount >= 0 ? '+' : ''}{formatCurrency(adjustment.adjustmentAmount)}
                                </span>
                              </div>
                              <div className="adjustment-details">
                                <p><strong>Reason:</strong> {adjustment.reason}</p>
                                <p><strong>Previous Balance:</strong> {formatCurrency(adjustment.previousBalance)}</p>
                                <p><strong>New Balance:</strong> {formatCurrency(adjustment.newBalance)}</p>
                                <p><strong>Type:</strong> {adjustment.type}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )
      )}
    </div>
  );
}; 