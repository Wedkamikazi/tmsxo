import React from 'react';
import { BalanceValidationResult } from '../services/transactionStorageService';
import './BalanceValidationDialog.css';

interface BalanceValidationDialogProps {
  isOpen: boolean;
  validationResult: BalanceValidationResult;
  onConfirm: (useImportBalance: boolean) => void;
  onCancel: () => void;
}

export const BalanceValidationDialog: React.FC<BalanceValidationDialogProps> = ({
  isOpen,
  validationResult,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="balance-validation-overlay">
      <div className="balance-validation-dialog">
        <div className="dialog-content">
          {/* Header */}
          <div className="dialog-header">
            <div className="header-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="header-text">
              <h2>Balance Validation Required</h2>
              <p>The imported balance doesn't match the expected balance</p>
            </div>
          </div>

          {/* Balance Analysis */}
          <div className="balance-analysis-section">
            <h3>Balance Analysis</h3>
            
            <div className="balance-comparison-grid">
              {/* Expected Balance */}
              <div className="balance-card expected">
                <h4>Expected Balance</h4>
                <div className="balance-amount">
                  {formatCurrency(validationResult.expectedBalance)}
                </div>
                <div className="balance-details">
                  <div className="detail-row">
                    <span>Current Balance:</span>
                    <span>{formatCurrency(validationResult.currentBalance)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Daily Movement:</span>
                    <span>{formatCurrency(validationResult.dailyMovement)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Last Transaction:</span>
                    <span>{formatDate(validationResult.lastTransactionDate)}</span>
                  </div>
                </div>
              </div>

              {/* Import Balance */}
              <div className="balance-card import">
                <h4>Import Balance</h4>
                <div className="balance-amount">
                  {formatCurrency(validationResult.actualBalance)}
                </div>
                <div className="balance-details">
                  <div className="detail-row">
                    <span>From Bank Statement</span>
                  </div>
                  <div className="detail-row">
                    <span>Most Recent Transaction</span>
                  </div>
                  <div className="detail-row">
                    <span>Post Date + Time Based</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Difference */}
            <div className="difference-section">
              <div className="difference-row">
                <span className="difference-label">Difference:</span>
                <span className={`difference-amount ${validationResult.difference >= 0 ? 'positive' : 'negative'}`}>
                  {validationResult.difference >= 0 ? '+' : ''}{formatCurrency(validationResult.difference)}
                </span>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="explanation-section">
            <h4>What does this mean?</h4>
            <div className="explanation-content">
              <p>
                <strong>Expected Balance:</strong> Calculated as your current account balance plus the daily movement from the new import.
              </p>
              <p>
                <strong>Import Balance:</strong> The actual closing balance from the bank statement you're importing.
              </p>
              <p>
                The difference could be due to pending transactions, bank fees, or timing differences between when transactions were posted.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="dialog-actions">
            <button
              onClick={() => onConfirm(true)}
              className="btn btn-primary action-btn"
            >
              <div className="btn-content">
                <span className="btn-title">Use Import Balance</span>
                <span className="btn-subtitle">{formatCurrency(validationResult.actualBalance)}</span>
                <span className="btn-description">Trust the bank statement balance</span>
              </div>
            </button>
            
            <button
              onClick={() => onConfirm(false)}
              className="btn btn-secondary action-btn"
            >
              <div className="btn-content">
                <span className="btn-title">Use Expected Balance</span>
                <span className="btn-subtitle">{formatCurrency(validationResult.expectedBalance)}</span>
                <span className="btn-description">Keep calculated balance</span>
              </div>
            </button>
            
            <button
              onClick={onCancel}
              className="btn btn-outline action-btn"
            >
              <div className="btn-content">
                <span className="btn-title">Cancel Import</span>
                <span className="btn-description">Review and try again</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 