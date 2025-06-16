import React, { useState } from 'react';
import type { DuplicateMatch, DuplicateResolution as DuplicateResolutionType, DuplicateAnalysis } from '../banking/validation/DuplicateDetectionService';
import './.css';

interface DuplicateResolutionProps {
  analysis: DuplicateAnalysis;
  onResolutionComplete: (resolutions: Map<string, DuplicateResolutionType>) => void;
  onCancel: () => void;
}

export const DuplicateResolution: React.FC<DuplicateResolutionProps> = ({
  analysis,
  onResolutionComplete,
  onCancel
}) => {
  const [resolutions, setResolutions] = useState<Map<string, DuplicateResolutionType>>(new Map());

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleResolutionChange = (transactionId: string, action: DuplicateResolutionType['action'], reason: string) => {
    const newResolutions = new Map(resolutions);
    newResolutions.set(transactionId, { action, reason });
    setResolutions(newResolutions);
  };

  const handleApplyAll = (action: DuplicateResolutionType['action'], matches: DuplicateMatch[]) => {
    const newResolutions = new Map(resolutions);
    matches.forEach(match => {
      newResolutions.set(match.newTransaction.id, { 
        action, 
        reason: `Applied to all ${action === 'skip' ? 'duplicates' : action === 'replace' ? 'replacements' : 'keep both'}` 
      });
    });
    setResolutions(newResolutions);
  };

  const handleComplete = () => {
    // Set default resolution for unresolved duplicates
    const finalResolutions = new Map(resolutions);
    
    analysis.potentialDuplicates.forEach(match => {
      if (!finalResolutions.has(match.newTransaction.id)) {
        // Default to skip for high confidence matches, review for others
        const defaultAction = match.matchScore >= 0.9 ? 'skip' : 'skip';
        finalResolutions.set(match.newTransaction.id, { 
          action: defaultAction, 
          reason: 'Default resolution applied' 
        });
      }
    });

    onResolutionComplete(finalResolutions);
  };

  const getResolution = (transactionId: string): DuplicateResolutionType | undefined => {
    return resolutions.get(transactionId);
  };

  const renderTransactionComparison = (match: DuplicateMatch) => {
    const existing = match.existingTransaction;
    const newTxn = match.newTransaction;
    const resolution = getResolution(newTxn.id);

    return (
      <div key={newTxn.id} className="duplicate-match">
        <div className="match-header">
          <div className="match-score">
            <span className={`score-badge ${match.matchScore >= 0.9 ? 'high' : match.matchScore >= 0.7 ? 'medium' : 'low'}`}>
              {Math.round(match.matchScore * 100)}% match
            </span>
          </div>
          <div className="match-reasons">
            {match.matchReasons.map((reason, index) => (
              <span key={index} className="reason-tag">{reason}</span>
            ))}
          </div>
        </div>

        <div className="transaction-comparison">
          <div className="transaction-card existing">
            <h5>Existing Transaction</h5>
            <div className="transaction-details">
              <p><strong>Date:</strong> {existing.date}</p>
              <p><strong>Description:</strong> {existing.description}</p>
              <p><strong>Debit:</strong> {existing.debitAmount ? formatCurrency(existing.debitAmount) : '-'}</p>
              <p><strong>Credit:</strong> {existing.creditAmount ? formatCurrency(existing.creditAmount) : '-'}</p>
              <p><strong>Balance:</strong> {formatCurrency(existing.balance)}</p>
              <p><strong>Reference:</strong> {existing.reference || '-'}</p>
            </div>
          </div>

          <div className="transaction-card new">
            <h5>New Transaction</h5>
            <div className="transaction-details">
              <p><strong>Date:</strong> {newTxn.date}</p>
              <p><strong>Description:</strong> {newTxn.description}</p>
              <p><strong>Debit:</strong> {newTxn.debitAmount ? formatCurrency(newTxn.debitAmount) : '-'}</p>
              <p><strong>Credit:</strong> {newTxn.creditAmount ? formatCurrency(newTxn.creditAmount) : '-'}</p>
              <p><strong>Balance:</strong> {formatCurrency(newTxn.balance)}</p>
              <p><strong>Reference:</strong> {newTxn.reference || '-'}</p>
            </div>
          </div>
        </div>

        <div className="resolution-controls">
          <div className="resolution-options">
            <label className="resolution-option">
              <input
                type="radio"
                name={`resolution-${newTxn.id}`}
                value="skip"
                checked={resolution?.action === 'skip'}
                onChange={() => handleResolutionChange(newTxn.id, 'skip', 'Skip duplicate transaction')}
              />
              <span className="option-label">Skip (Keep existing)</span>
              <span className="option-description">Don't import this transaction</span>
            </label>

            <label className="resolution-option">
              <input
                type="radio"
                name={`resolution-${newTxn.id}`}
                value="replace"
                checked={resolution?.action === 'replace'}
                onChange={() => handleResolutionChange(newTxn.id, 'replace', 'Replace with new transaction')}
              />
              <span className="option-label">Replace</span>
              <span className="option-description">Replace existing with new transaction</span>
            </label>

            <label className="resolution-option">
              <input
                type="radio"
                name={`resolution-${newTxn.id}`}
                value="keep_both"
                checked={resolution?.action === 'keep_both'}
                onChange={() => handleResolutionChange(newTxn.id, 'keep_both', 'Keep both transactions')}
              />
              <span className="option-label">Keep Both</span>
              <span className="option-description">Import both transactions (not recommended)</span>
            </label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="duplicate-resolution">
      <div className="resolution-header">
        <h3>Duplicate Transaction Detection</h3>
        <p>We found potential duplicate transactions in the overlap period ({analysis.overlapPeriod.start} to {analysis.overlapPeriod.end})</p>
      </div>

      <div className="resolution-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-value">{analysis.potentialDuplicates.length}</span>
            <span className="stat-label">Potential Duplicates</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{analysis.safeToImport.length}</span>
            <span className="stat-label">Safe to Import</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{analysis.recommendations.autoSkip.length}</span>
            <span className="stat-label">Auto-Skip (High Confidence)</span>
          </div>
        </div>
      </div>

      {analysis.recommendations.autoSkip.length > 0 && (
        <div className="auto-skip-section">
          <h4>High Confidence Duplicates (Auto-Skip Recommended)</h4>
          <p>These transactions have a high probability of being duplicates and will be automatically skipped.</p>
          <div className="bulk-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => handleApplyAll('skip', analysis.recommendations.autoSkip)}
            >
              Skip All High Confidence Duplicates
            </button>
          </div>
          <div className="duplicate-matches">
            {analysis.recommendations.autoSkip.map(match => renderTransactionComparison(match))}
          </div>
        </div>
      )}

      {analysis.recommendations.requiresReview.length > 0 && (
        <div className="review-section">
          <h4>Requires Manual Review</h4>
          <p>Please review these potential duplicates and choose how to handle each one.</p>
          <div className="bulk-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => handleApplyAll('skip', analysis.recommendations.requiresReview)}
            >
              Skip All
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => handleApplyAll('replace', analysis.recommendations.requiresReview)}
            >
              Replace All
            </button>
          </div>
          <div className="duplicate-matches">
            {analysis.recommendations.requiresReview.map(match => renderTransactionComparison(match))}
          </div>
        </div>
      )}

      <div className="resolution-actions">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel Import
        </button>
        <button
          type="button"
          onClick={handleComplete}
          className="btn btn-primary"
        >
          Apply Resolutions & Continue
        </button>
      </div>
    </div>
  );
}; 