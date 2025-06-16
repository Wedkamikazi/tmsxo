import { HRPayment, PayrollEntry, ReconciliationMatch, AuditLogEntry, Transaction } from '../types';
import { eventBus } from '../utils/eventBus';

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