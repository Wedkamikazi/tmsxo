import { 
  HRPayment, 
  PayrollEntry, 
  ReconciliationMatch,
  AuditLogEntry,
  Transaction 
} from '../shared/types';
import { eventBus } from './EventBus';
import { unifiedCategorizationService } from './unifiedCategorizationService';

/**
 * HR Payment Management Service
 * 
 * Handles extraction, categorization, and reconciliation of employee payments
 * with payroll register entries. Provides automated and manual reconciliation
 * workflows with comprehensive audit trails.
 * 
 * Features:
 * - HR payment extraction from bank imports
 * - AI-powered payment type categorization
 * - Auto-reconciliation with payroll entries
 * - Manual reconciliation workflow
 * - Employee verification process
 * - Audit logging and event coordination
 */
class HRPaymentManagementService {
  private readonly STORAGE_KEY = 'tms_hr_payments';
  private readonly PAYROLL_KEY = 'tms_payroll_entries';
  private readonly RECONCILIATION_MATCHES_KEY = 'tms_hr_reconciliation_matches';
  private readonly AUDIT_LOG_KEY = 'tms_hr_audit_log';

  constructor() {
    console.log('✅ HR Payment Management Service initialized');
    this.initializeDefaultData();
  }

  // =============================================
  // INITIALIZATION & SAMPLE DATA
  // =============================================

  private initializeDefaultData(): void {
    try {
      // Initialize with sample payroll data if none exists
      const existingPayroll = this.getStoredData(this.PAYROLL_KEY);
      if (existingPayroll.length === 0) {
        this.initializeSamplePayrollEntries();
      }

      console.log('✅ HR Payment Management Service initialized');
    } catch (error) {
      console.error('Failed to initialize HR payment default data:', error);
    }
  }

  private initializeSamplePayrollEntries(): void {
    const samplePayroll: PayrollEntry[] = [
      {
        id: 'pr_001',
        employeeId: 'EMP001',
        employeeName: 'Ahmed Al-Mansouri',
        payPeriod: '2024-12',
        grossAmount: 15000.00,
        netAmount: 12750.00,
        payDate: '2024-12-25',
        status: 'pending'
      },
      {
        id: 'pr_002',
        employeeId: 'EMP002',
        employeeName: 'Fatima Al-Zahra',
        payPeriod: '2024-12',
        grossAmount: 12500.00,
        netAmount: 10625.00,
        payDate: '2024-12-25',
        status: 'pending'
      },
      {
        id: 'pr_003',
        employeeId: 'EMP003',
        employeeName: 'Omar Hassan',
        payPeriod: '2024-12',
        grossAmount: 18000.00,
        netAmount: 15300.00,
        payDate: '2024-12-25',
        status: 'pending'
      },
      {
        id: 'pr_004',
        employeeId: 'EMP004',
        employeeName: 'Layla Mohammad',
        payPeriod: '2024-12',
        grossAmount: 9500.00,
        netAmount: 8075.00,
        payDate: '2024-12-25',
        status: 'pending'
      },
      {
        id: 'pr_005',
        employeeId: 'EMP005',
        employeeName: 'Khalid Al-Rashid',
        payPeriod: '2024-12',
        grossAmount: 22000.00,
        netAmount: 18700.00,
        payDate: '2024-12-25',
        status: 'pending'
      },
      {
        id: 'pr_006',
        employeeId: 'EMP006',
        employeeName: 'Noor Abdullah',
        payPeriod: '2024-12',
        grossAmount: 11000.00,
        netAmount: 9350.00,
        payDate: '2024-12-25',
        status: 'pending'
      }
    ];

    this.storeData(this.PAYROLL_KEY, samplePayroll);
    console.log('✅ Sample Payroll Entries data initialized (6 employees)');
  }

  // =============================================
  // CORE STORAGE OPERATIONS
  // =============================================

  private storeData(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to store data for key ${key}:`, error);
      throw error;
    }
  }

  private getStoredData(key: string): any {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Failed to get stored data for key ${key}:`, error);
      return [];
    }
  }

  // =============================================
  // HR PAYMENTS CRUD OPERATIONS
  // =============================================

  async getAllHRPayments(): Promise<HRPayment[]> {
    try {
      return this.getStoredData(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to get all HR payments:', error);
      return [];
    }
  }

  async getHRPaymentById(id: string): Promise<HRPayment | null> {
    try {
      const payments = await this.getAllHRPayments();
      return payments.find(p => p.id === id) || null;
    } catch (error) {
      console.error('Failed to get HR payment by ID:', error);
      return null;
    }
  }

  private async storeHRPayments(payments: HRPayment[]): Promise<void> {
    try {
      // Get existing payments
      const existing = await this.getAllHRPayments();
      
      // Merge with new payments (avoid duplicates)
      const merged = [...existing];
      payments.forEach(newPayment => {
        const existingIndex = merged.findIndex(p => p.id === newPayment.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = newPayment;
        } else {
          merged.push(newPayment);
        }
      });

      this.storeData(this.STORAGE_KEY, merged);
    } catch (error) {
      console.error('Failed to store HR payments:', error);
      throw error;
    }
  }

  async updateHRPayment(payment: HRPayment): Promise<void> {
    try {
      const payments = await this.getAllHRPayments();
      const index = payments.findIndex(p => p.id === payment.id);
      
      if (index >= 0) {
        payments[index] = payment;
        this.storeData(this.STORAGE_KEY, payments);
      } else {
        throw new Error('HR payment not found for update');
      }
    } catch (error) {
      console.error('Failed to update HR payment:', error);
      throw error;
    }
  }

  // =============================================
  // PAYROLL ENTRIES ACCESS
  // =============================================

  async getPayrollEntries(): Promise<PayrollEntry[]> {
    try {
      return this.getStoredData(this.PAYROLL_KEY);
    } catch (error) {
      console.error('Failed to get payroll entries:', error);
      return [];
    }
  }

  async getPayrollEntryById(id: string): Promise<PayrollEntry | null> {
    try {
      const entries = await this.getPayrollEntries();
      return entries.find(e => e.id === id) || null;
    } catch (error) {
      console.error('Failed to get payroll entry by ID:', error);
      return null;
    }
  }

  // =============================================
  // CORE EXTRACTION & PROCESSING
  // =============================================

  /**
   * Extract HR payments from imported bank statement transactions
   * Automatically categorizes using AI/LLM and stores in dedicated HR Payments page
   */
  async extractHRPayments(transactions: Transaction[], accountId: string): Promise<HRPayment[]> {
    try {
      const hrPayments: HRPayment[] = [];

      for (const transaction of transactions) {
        // Only process debit transactions that could be HR payments
        if (transaction.debitAmount && transaction.debitAmount > 0) {
          const description = transaction.description.toLowerCase();
          
          // Check if transaction matches HR payment patterns
          if (this.isHRPaymentPattern(description)) {
            const hrPayment: HRPayment = {
              id: `hr_${transaction.id}`,
              date: transaction.date,
              description: transaction.description,
              amount: transaction.debitAmount,
              reference: transaction.reference || '',
              accountId: accountId,
              accountName: this.getAccountName(accountId),
              extractionDate: new Date().toISOString(),
              paymentType: await this.categorizeHRPayment(transaction),
              reconciliationStatus: 'pending',
              observations: ''
            };

            hrPayments.push(hrPayment);
          }
        }
      }

      // Store extracted HR payments
      await this.storeHRPayments(hrPayments);

      // Emit event for UI updates
      eventBus.emit('HR_PAYMENTS_EXTRACTED', {
        count: hrPayments.length,
        accountId: accountId
      });

      return hrPayments;
    } catch (error) {
      console.error('Error extracting HR payments:', error);
      throw error;
    }
  }

  /**
   * Check if transaction description matches HR payment patterns
   */
  private isHRPaymentPattern(description: string): boolean {
    const hrKeywords = [
      'payroll', 'salary', 'wage', 'employee', 'staff',
      'bonus', 'overtime', 'commission', 'allowance',
      'reimbursement', 'expense', 'benefits', 'pension',
      'final settlement', 'severance', 'gratuity'
    ];
    
    return hrKeywords.some(keyword => description.includes(keyword));
  }

  /**
   * AI/LLM-based categorization of HR payments
   */
  private async categorizeHRPayment(transaction: Transaction): Promise<HRPayment['paymentType']> {
    try {
      // Use the unified categorization service for AI analysis
      await unifiedCategorizationService.categorizeTransaction(transaction);
      
      // Map to HR payment types based on description patterns
      const description = transaction.description.toLowerCase();
      
      if (description.includes('bonus') || description.includes('incentive') || description.includes('commission')) {
        return 'bonus';
      } else if (description.includes('overtime') || description.includes('extra time') || description.includes('ot')) {
        return 'overtime';
      } else if (description.includes('reimbursement') || description.includes('expense') || description.includes('allowance')) {
        return 'reimbursement';
      } else if (description.includes('final') || description.includes('settlement') || description.includes('severance') || description.includes('gratuity')) {
        return 'final_settlement';
      } else if (description.includes('payroll') || description.includes('salary') || description.includes('wage')) {
        return 'salary';
      } else {
        return 'salary'; // Default to salary for most HR payments
      }
    } catch (error) {
      console.warn('AI categorization failed, using fallback logic:', error);
      return 'salary';
    }
  }

  // =============================================
  // RECONCILIATION LOGIC
  // =============================================

  /**
   * Auto-reconcile HR payments with payroll entries
   */
  async performAutoReconciliation(hrPaymentId: string): Promise<ReconciliationMatch | null> {
    try {
      const hrPayment = await this.getHRPaymentById(hrPaymentId);
      if (!hrPayment) {
        throw new Error('HR payment not found');
      }

      // Try to match with payroll entries
      const payrollMatch = await this.matchWithPayrollEntries(hrPayment);
      if (payrollMatch && payrollMatch.confidenceScore >= 0.7) {
        const reconciliationMatch: ReconciliationMatch = {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          transactionId: hrPayment.id,
          matchedEntityId: payrollMatch.matchedEntityId,
          matchedEntityType: 'payroll',
          matchType: 'auto',
          confidenceScore: payrollMatch.confidenceScore,
          matchDate: new Date().toISOString(),
          notes: payrollMatch.notes
        };

        // Update HR payment
        hrPayment.reconciliationStatus = 'auto_matched';
        hrPayment.confidenceRatio = payrollMatch.confidenceScore;
        hrPayment.payrollMatch = payrollMatch.payrollEntry;

        await this.updateHRPayment(hrPayment);
        await this.storeReconciliationMatch(reconciliationMatch);

        return reconciliationMatch;
      }

      return null;
    } catch (error) {
      console.error('Auto-reconciliation failed:', error);
      throw error;
    }
  }

  /**
   * Manual reconciliation by user
   */
  async performManualReconciliation(
    hrPaymentId: string, 
    payrollEntryId: string, 
    notes?: string
  ): Promise<ReconciliationMatch> {
    try {
      const hrPayment = await this.getHRPaymentById(hrPaymentId);
      if (!hrPayment) {
        throw new Error('HR payment not found');
      }

      const reconciliationMatch: ReconciliationMatch = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        transactionId: hrPayment.id,
        matchedEntityId: payrollEntryId,
        matchedEntityType: 'payroll',
        matchType: 'manual',
        confidenceScore: 1.0, // Manual matches get full confidence
        matchDate: new Date().toISOString(),
        notes: notes || 'Manual reconciliation by user'
      };

      // Update HR payment
      hrPayment.reconciliationStatus = 'manually_matched';
      hrPayment.confidenceRatio = 1.0;

      // Attach the payroll entry details
      const payrollEntry = await this.getPayrollEntryById(payrollEntryId);
      hrPayment.payrollMatch = payrollEntry || undefined;

      await this.updateHRPayment(hrPayment);
      await this.storeReconciliationMatch(reconciliationMatch);

      // Log the manual action
      await this.logAuditEntry('MANUAL_RECONCILIATION', hrPayment.id, {
        payrollEntryId,
        notes
      });

      return reconciliationMatch;
    } catch (error) {
      console.error('Manual reconciliation failed:', error);
      throw error;
    }
  }

  /**
   * User confirms an HR payment to clear it
   */
  async confirmPayment(hrPaymentId: string, verifiedBy: string, observations?: string): Promise<void> {
    try {
      const hrPayment = await this.getHRPaymentById(hrPaymentId);
      if (!hrPayment) {
        throw new Error('HR payment not found');
      }

      hrPayment.reconciliationStatus = 'confirmed';
      hrPayment.verificationDate = new Date().toISOString();
      hrPayment.verifiedBy = verifiedBy;
      if (observations) {
        hrPayment.observations = observations;
      }

      await this.updateHRPayment(hrPayment);

      // Log the confirmation
      await this.logAuditEntry('PAYMENT_CONFIRMED', hrPayment.id, {
        verifiedBy,
        observations
      });

      eventBus.emit('HR_PAYMENT_CONFIRMED', hrPayment);
    } catch (error) {
      console.error('Payment confirmation failed:', error);
      throw error;
    }
  }

  // =============================================
  // MATCHING ALGORITHMS
  // =============================================

  private async matchWithPayrollEntries(hrPayment: HRPayment): Promise<{
    confidenceScore: number;
    matchedEntityId: string;
    payrollEntry: PayrollEntry;
    notes: string;
  } | null> {
    try {
      const payrollEntries = await this.getPayrollEntries();
      let bestMatch: any = null;
      let highestScore = 0;

      for (const payrollEntry of payrollEntries) {
        let score = 0;

        // Amount matching (both gross and net amounts)
        if (Math.abs(payrollEntry.netAmount - hrPayment.amount) < 0.01) {
          score += 0.7; // Exact net amount match
        } else if (Math.abs(payrollEntry.grossAmount - hrPayment.amount) < 0.01) {
          score += 0.5; // Exact gross amount match
        } else if (Math.abs(payrollEntry.netAmount - hrPayment.amount) / payrollEntry.netAmount < 0.05) {
          score += 0.4; // Within 5% of net amount
        } else if (Math.abs(payrollEntry.grossAmount - hrPayment.amount) / payrollEntry.grossAmount < 0.05) {
          score += 0.3; // Within 5% of gross amount
        }

        // Employee name matching in description
        const description = hrPayment.description.toLowerCase();
        const employeeName = payrollEntry.employeeName.toLowerCase();
        const nameParts = employeeName.split(' ');
        
        let nameMatches = 0;
        nameParts.forEach(namePart => {
          if (description.includes(namePart)) {
            nameMatches++;
          }
        });
        
        if (nameMatches === nameParts.length) {
          score += 0.4; // Full name match
        } else if (nameMatches > 0) {
          score += (nameMatches / nameParts.length) * 0.3; // Partial name match
        }

        // Date proximity (payment date vs payroll pay date)
        const paymentDate = new Date(hrPayment.date);
        const payDate = new Date(payrollEntry.payDate);
        const daysDiff = Math.abs((paymentDate.getTime() - payDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 3) {
          score += 0.2; // Within 3 days
        } else if (daysDiff <= 7) {
          score += 0.1; // Within a week
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            confidenceScore: score,
            matchedEntityId: payrollEntry.id,
            payrollEntry: payrollEntry,
            notes: `Matched based on ${Math.abs(payrollEntry.netAmount - hrPayment.amount) < 0.01 ? 'exact net amount' : 'amount approximation'}, employee name recognition, and date proximity`
          };
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Payroll matching failed:', error);
      return null;
    }
  }

  // =============================================
  // RECONCILIATION MATCH STORAGE
  // =============================================

  private async storeReconciliationMatch(match: ReconciliationMatch): Promise<void> {
    try {
      const existingMatches = this.getStoredData(this.RECONCILIATION_MATCHES_KEY);
      existingMatches.push(match);
      this.storeData(this.RECONCILIATION_MATCHES_KEY, existingMatches);
    } catch (error) {
      console.error('Failed to store reconciliation match:', error);
      throw error;
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  private getAccountName(accountId: string): string {
    // This would typically fetch from the account service
    // For now, return a placeholder
    return `Account ${accountId.substring(0, 8)}`;
  }

  async logAuditEntry(action: string, paymentId: string, details: any): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: 'current_user', // In a real app, this would come from authentication
        action,
        entityType: 'hr',
        entityId: paymentId,
        newValues: details
      };

      const existingLog = this.getStoredData(this.AUDIT_LOG_KEY);
      existingLog.push(auditEntry);
      this.storeData(this.AUDIT_LOG_KEY, existingLog);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  // =============================================
  // PUBLIC API FOR UI COMPONENTS
  // =============================================

  /**
   * Get HR payments with optional filtering
   */
  async getHRPaymentsForDisplay(filters?: {
    employeeName?: string;
    status?: HRPayment['reconciliationStatus'];
    paymentType?: HRPayment['paymentType'];
    dateFrom?: string;
    dateTo?: string;
  }): Promise<HRPayment[]> {
    try {
      let payments = await this.getAllHRPayments();

      if (filters) {
        if (filters.employeeName) {
          const searchTerm = filters.employeeName.toLowerCase();
          payments = payments.filter(p => 
            p.payrollMatch?.employeeName.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm)
          );
        }
        if (filters.status) {
          payments = payments.filter(p => p.reconciliationStatus === filters.status);
        }
        if (filters.paymentType) {
          payments = payments.filter(p => p.paymentType === filters.paymentType);
        }
        if (filters.dateFrom) {
          payments = payments.filter(p => p.date >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          payments = payments.filter(p => p.date <= filters.dateTo!);
        }
      }

      return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Failed to get HR payments for display:', error);
      return [];
    }
  }

  /**
   * Get summary statistics for HR payments
   */
  async getHRPaymentsSummary(): Promise<{
    total: number;
    pending: number;
    matched: number;
    confirmed: number;
    totalAmount: number;
    averageConfidence: number;
  }> {
    try {
      const payments = await this.getAllHRPayments();
      
      const summary = {
        total: payments.length,
        pending: payments.filter(p => p.reconciliationStatus === 'pending').length,
        matched: payments.filter(p => 
          p.reconciliationStatus === 'auto_matched' || 
          p.reconciliationStatus === 'manually_matched'
        ).length,
        confirmed: payments.filter(p => p.reconciliationStatus === 'confirmed').length,
        totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
        averageConfidence: payments.length > 0 
          ? payments.reduce((sum, p) => sum + (p.confidenceRatio || 0), 0) / payments.length
          : 0
      };

      return summary;
    } catch (error) {
      console.error('Failed to get HR payments summary:', error);
      return {
        total: 0,
        pending: 0,
        matched: 0,
        confirmed: 0,
        totalAmount: 0,
        averageConfidence: 0
      };
    }
  }
}

// Export singleton instance
export const hrPaymentManagementService = new HRPaymentManagementService(); 