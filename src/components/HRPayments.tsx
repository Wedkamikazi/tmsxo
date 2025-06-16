import React, { useState, useEffect, useCallback } from 'react';
import { 
  HRPayment, 
  PayrollEntry
} from '../types';
import { hrPaymentManagementService } from '../services/hrPaymentManagementService';
import { eventBus } from '../services/eventBus';
import { ErrorBoundary } from './ErrorBoundary';
import './HRPayments.css';

interface HRPaymentsProps {
  dataRefreshTrigger: number;
}

export const HRPayments: React.FC<HRPaymentsProps> = ({ dataRefreshTrigger }) => {
  const [hrPayments, setHRPayments] = useState<HRPayment[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    matched: 0,
    confirmed: 0,
    totalAmount: 0,
    averageConfidence: 0
  });
  const [filterStatus, setFilterStatus] = useState<HRPayment['reconciliationStatus'] | 'all'>('all');
  const [filterPaymentType, setFilterPaymentType] = useState<HRPayment['paymentType'] | 'all'>('all');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<HRPayment | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [selectedPayrollEntry, setSelectedPayrollEntry] = useState<string>('');

  const loadHRPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterOptions: any = {};
      
      if (filterStatus !== 'all') {
        filterOptions.status = filterStatus;
      }
      if (filterPaymentType !== 'all') {
        filterOptions.paymentType = filterPaymentType;
      }
      if (filterEmployee.trim()) {
        filterOptions.employeeName = filterEmployee.trim();
      }

      const [payments, summaryData, payroll] = await Promise.all([
        hrPaymentManagementService.getHRPaymentsForDisplay(filterOptions),
        hrPaymentManagementService.getHRPaymentsSummary(),
        hrPaymentManagementService.getPayrollEntries()
      ]);

      setHRPayments(payments);
      setSummary(summaryData);
      setPayrollEntries(payroll);
    } catch (error) {
      console.error('Failed to load HR payments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterPaymentType, filterEmployee, dataRefreshTrigger]);

  useEffect(() => {
    loadHRPayments();
  }, [loadHRPayments, dataRefreshTrigger]);

  const handleAutoReconcile = async (paymentId: string) => {
    try {
      setIsLoading(true);
      await hrPaymentManagementService.performAutoReconciliation(paymentId);
      await loadHRPayments();
    } catch (error) {
      console.error('Auto-reconciliation failed:', error);
      alert('Auto-reconciliation failed. Please try manual reconciliation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualReconcile = (payment: HRPayment) => {
    setSelectedPayment(payment);
    setIsReconciling(true);
    setReconciliationNotes('');
    setSelectedPayrollEntry('');
  };

  const submitManualReconciliation = async () => {
    if (!selectedPayment || !selectedPayrollEntry) {
      alert('Please select a payroll entry to match with.');
      return;
    }

    try {
      setIsLoading(true);
      await hrPaymentManagementService.performManualReconciliation(
        selectedPayment.id,
        selectedPayrollEntry,
        reconciliationNotes
      );
      setIsReconciling(false);
      setSelectedPayment(null);
      await loadHRPayments();
    } catch (error) {
      console.error('Manual reconciliation failed:', error);
      alert('Manual reconciliation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPayment = async (payment: HRPayment) => {
    const observations = 'Payment confirmed by user';
    try {
      setIsLoading(true);
      await hrPaymentManagementService.confirmPayment(
        payment.id,
        'current_user', // In a real app, this would come from authentication
        observations
      );
      await loadHRPayments();
    } catch (error) {
      console.error('Payment confirmation failed:', error);
      alert('Payment confirmation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to events for real-time updates
  useEffect(() => {
    const unsubscribeExtracted = eventBus.on('HR_PAYMENTS_EXTRACTED', () => {
      loadHRPayments();
    });

    const unsubscribeUpdated = eventBus.on('HR_PAYMENT_UPDATED', () => {
      loadHRPayments();
    });

    const unsubscribeConfirmed = eventBus.on('HR_PAYMENT_CONFIRMED', () => {
      loadHRPayments();
    });

    return () => {
      unsubscribeExtracted();
      unsubscribeUpdated();
      unsubscribeConfirmed();
    };
  }, [loadHRPayments]);

  const getStatusBadge = (status: HRPayment['reconciliationStatus']) => {
    const badges = {
      pending: 'status-pending',
      auto_matched: 'status-matched',
      manually_matched: 'status-matched',
      confirmed: 'status-confirmed'
    };
    
    const labels = {
      pending: 'Pending',
      auto_matched: 'Auto Matched',
      manually_matched: 'Manual Match',
      confirmed: '⩗ Verified'
    };

    return <span className={`status-badge ${badges[status]}`}>{labels[status]}</span>;
  };

  const getPaymentTypeBadge = (type: HRPayment['paymentType']) => {
    const badges = {
      salary: 'payment-type-salary',
      bonus: 'payment-type-bonus',
      overtime: 'payment-type-overtime',
      reimbursement: 'payment-type-reimbursement',
      final_settlement: 'payment-type-settlement'
    };
    
    const labels = {
      salary: 'Salary',
      bonus: 'Bonus',
      overtime: 'Overtime',
      reimbursement: 'Reimbursement',
      final_settlement: 'Final Settlement'
    };

    return <span className={`payment-type-badge ${badges[type]}`}>{labels[type]}</span>;
  };

  return (
    <ErrorBoundary componentName="HRPayments">
      <div className="hr-payments-container">
        {/* Header */}
        <div className="hr-payments-header">
          <div className="header-content">
            <div className="header-title">
              <h2>👥 HR Payments Processing</h2>
              <p>Employee payment reconciliation with payroll register</p>
            </div>
            {isLoading && <div className="loading-spinner">Loading...</div>}
          </div>
        </div>

        {/* Summary Dashboard */}
        <div className="summary-dashboard">
          <div className="summary-card">
            <div className="summary-icon">📊</div>
            <div className="summary-content">
              <h3>{summary.total}</h3>
              <p>Total Payments</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">⏳</div>
            <div className="summary-content">
              <h3>{summary.pending}</h3>
              <p>Pending</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">🎯</div>
            <div className="summary-content">
              <h3>{summary.matched}</h3>
              <p>Matched</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">✅</div>
            <div className="summary-content">
              <h3>{summary.confirmed}</h3>
              <p>Confirmed</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">💰</div>
            <div className="summary-content">
              <h3>{summary.totalAmount.toLocaleString()}</h3>
              <p>Total Amount</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">🎲</div>
            <div className="summary-content">
              <h3>{(summary.averageConfidence * 100).toFixed(1)}%</h3>
              <p>Avg Confidence</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="auto_matched">Auto Matched</option>
              <option value="manually_matched">Manual Match</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Payment Type:</label>
            <select 
              value={filterPaymentType} 
              onChange={(e) => setFilterPaymentType(e.target.value as any)}
            >
              <option value="all">All Types</option>
              <option value="salary">Salary</option>
              <option value="bonus">Bonus</option>
              <option value="overtime">Overtime</option>
              <option value="reimbursement">Reimbursement</option>
              <option value="final_settlement">Final Settlement</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Employee Search:</label>
            <input
              type="text"
              placeholder="Search by employee name..."
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            />
          </div>
        </div>

        {/* HR Payments Table */}
        <div className="payments-table-section">
          <h3>👥 HR Payments ({hrPayments.length})</h3>
          
          {hrPayments.length === 0 ? (
            <div className="no-data">
              <p>No HR payments found. HR payments will appear here when bank statements containing employee payment transactions are imported.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee/Description</th>
                    <th>Payment Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Confidence</th>
                    <th>Payroll Match</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hrPayments.map(payment => (
                    <tr key={payment.id} className={`payment-row ${payment.reconciliationStatus}`}>
                      <td>{new Date(payment.date).toLocaleDateString()}</td>
                      <td>
                        <div className="employee-info">
                          <strong>{payment.payrollMatch?.employeeName || 'Unknown Employee'}</strong>
                          <small>{payment.description}</small>
                        </div>
                      </td>
                      <td>{getPaymentTypeBadge(payment.paymentType)}</td>
                      <td className="amount">{payment.amount.toLocaleString()}</td>
                      <td>{getStatusBadge(payment.reconciliationStatus)}</td>
                      <td>
                        {payment.confidenceRatio ? (
                          <span className={`confidence ${payment.confidenceRatio >= 0.8 ? 'high' : payment.confidenceRatio >= 0.6 ? 'medium' : 'low'}`}>
                            {(payment.confidenceRatio * 100).toFixed(0)}%
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {payment.payrollMatch ? (
                          <div className="payroll-match">
                            <strong>{payment.payrollMatch.employeeName}</strong>
                            <small>Net: {payment.payrollMatch.netAmount.toLocaleString()}</small>
                          </div>
                        ) : (
                          <span className="no-match">No Match</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          {payment.reconciliationStatus === 'pending' && (
                            <>
                              <button 
                                className="btn-auto-reconcile"
                                onClick={() => handleAutoReconcile(payment.id)}
                                disabled={isLoading}
                              >
                                Auto Match
                              </button>
                              <button 
                                className="btn-manual-reconcile"
                                onClick={() => handleManualReconcile(payment)}
                                disabled={isLoading}
                              >
                                Manual Match
                              </button>
                            </>
                          )}
                          {(payment.reconciliationStatus === 'auto_matched' || payment.reconciliationStatus === 'manually_matched') && (
                            <button 
                              className="btn-confirm"
                              onClick={() => handleConfirmPayment(payment)}
                              disabled={isLoading}
                            >
                              Confirm
                            </button>
                          )}
                          {payment.reconciliationStatus === 'confirmed' && (
                            <span className="confirmed-text">✅ Verified</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Manual Reconciliation Modal */}
        {isReconciling && selectedPayment && (
          <div className="modal-overlay" onClick={() => setIsReconciling(false)}>
            <div className="reconciliation-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Manual Reconciliation</h3>
                <button className="close-btn" onClick={() => setIsReconciling(false)}>×</button>
              </div>
              
              <div className="modal-body">
                <div className="payment-details">
                  <h4>HR Payment Details</h4>
                  <p><strong>Date:</strong> {new Date(selectedPayment.date).toLocaleDateString()}</p>
                  <p><strong>Description:</strong> {selectedPayment.description}</p>
                  <p><strong>Amount:</strong> {selectedPayment.amount.toLocaleString()}</p>
                  <p><strong>Payment Type:</strong> {selectedPayment.paymentType}</p>
                </div>
                
                <div className="payroll-selection">
                  <h4>Select Payroll Entry</h4>
                  <select 
                    value={selectedPayrollEntry} 
                    onChange={(e) => setSelectedPayrollEntry(e.target.value)}
                  >
                    <option value="">-- Select Payroll Entry --</option>
                    {payrollEntries.map(entry => (
                      <option key={entry.id} value={entry.id}>
                        {entry.employeeName} - {entry.payPeriod} - Net: {entry.netAmount.toLocaleString()} - Gross: {entry.grossAmount.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="notes-section">
                  <h4>Notes (Optional)</h4>
                  <textarea
                    value={reconciliationNotes}
                    onChange={(e) => setReconciliationNotes(e.target.value)}
                    placeholder="Add any observations about this reconciliation..."
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  className="btn-cancel" 
                  onClick={() => setIsReconciling(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-confirm-reconciliation" 
                  onClick={submitManualReconciliation}
                  disabled={!selectedPayrollEntry || isLoading}
                >
                  Confirm Reconciliation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}; 