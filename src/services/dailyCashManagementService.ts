/**
 * DAILY CASH MANAGEMENT SERVICE
 * 
 * Micro-Job 2.1.1: Service Foundation
 * 
 * Central service that integrates all transaction types into unified daily cash entries.
 * Provides daily balance reconciliation, discrepancy detection, and verification workflow.
 * 
 * Features:
 * - Daily entry generation for each account/date combination
 * - Integration with credit, debit, and HR transaction services
 * - Balance calculation and discrepancy detection
 * - Daily verification workflow with observations
 * - Real-time updates via event system
 */

import { 
  DailyCashEntry,
  CreditTransaction,
  DebitTransaction,
  HRPayment,
  AuditLogEntry
} from '../types';
import { eventBus } from './eventBus';

// =============================================
// DAILY CASH MANAGEMENT SERVICE FOUNDATION
// =============================================

class DailyCashManagementService {
  private readonly STORAGE_KEY = 'tms_daily_cash_entries';
  private readonly VERIFICATION_KEY = 'tms_daily_cash_verification';
  private readonly AUDIT_LOG_KEY = 'tms_daily_cash_audit_log';

  constructor() {
    console.log('✅ Daily Cash Management Service initialized');
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

  private getStoredData(key: string): any[] {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error(`Failed to get stored data for key ${key}:`, error);
      return [];
    }
  }

  // =============================================
  // DAILY CASH ENTRIES CRUD
  // =============================================

  async getAllDailyCashEntries(): Promise<DailyCashEntry[]> {
    try {
      return this.getStoredData(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to get all daily cash entries:', error);
      return [];
    }
  }

  async getDailyCashEntryById(id: string): Promise<DailyCashEntry | null> {
    try {
      const entries = await this.getAllDailyCashEntries();
      return entries.find(entry => entry.id === id) || null;
    } catch (error) {
      console.error('Failed to get daily cash entry by ID:', error);
      return null;
    }
  }

  async updateDailyCashEntry(entry: DailyCashEntry): Promise<void> {
    try {
      const entries = await this.getAllDailyCashEntries();
      const index = entries.findIndex(e => e.id === entry.id);
      
      if (index >= 0) {
        entries[index] = entry;
        this.storeData(this.STORAGE_KEY, entries);
        
        // Emit event for UI updates
        eventBus.emit('DAILY_CASH_ENTRY_UPDATED', entry);
      } else {
        throw new Error('Daily cash entry not found for update');
      }
    } catch (error) {
      console.error('Failed to update daily cash entry:', error);
      throw error;
    }
  }

  private async storeDailyCashEntries(entries: DailyCashEntry[]): Promise<void> {
    try {
      // Get existing entries
      const existing = await this.getAllDailyCashEntries();
      
      // Merge with new entries (avoid duplicates)
      const merged = [...existing];
      entries.forEach(newEntry => {
        const existingIndex = merged.findIndex(e => e.id === newEntry.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = newEntry;
        } else {
          merged.push(newEntry);
        }
      });

      this.storeData(this.STORAGE_KEY, merged);
    } catch (error) {
      console.error('Failed to store daily cash entries:', error);
      throw error;
    }
  }

  // =============================================
  // VERIFICATION MANAGEMENT
  // =============================================

  async markDayAsVerified(
    date: string, 
    accountId: string, 
    verifiedBy: string, 
    observations?: string
  ): Promise<void> {
    try {
      const entry = await this.getDailyCashEntryByDateAndAccount(date, accountId);
      if (!entry) {
        throw new Error('Daily cash entry not found for verification');
      }

      entry.isVerified = true;
      entry.verifiedDate = new Date().toISOString();
      entry.verifiedBy = verifiedBy;
      if (observations) {
        entry.observations = observations;
      }

      await this.updateDailyCashEntry(entry);

      // Log the verification
      await this.logAuditEntry('DAY_VERIFIED', entry.id, {
        date,
        accountId,
        verifiedBy,
        observations
      });

      eventBus.emit('DAILY_CASH_DAY_VERIFIED', { date, accountId, verifiedBy });
    } catch (error) {
      console.error('Failed to mark day as verified:', error);
      throw error;
    }
  }

  private async getDailyCashEntryByDateAndAccount(
    date: string, 
    accountId: string
  ): Promise<DailyCashEntry | null> {
    try {
      const entries = await this.getAllDailyCashEntries();
      return entries.find(entry => 
        entry.date === date && entry.accountNumber === accountId
      ) || null;
    } catch (error) {
      console.error('Failed to get daily cash entry by date and account:', error);
      return null;
    }
  }

  // =============================================
  // AUDIT LOGGING
  // =============================================

  private async logAuditEntry(action: string, entityId: string, details: any): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: 'current_user', // In a real app, this would come from authentication
        action,
        entityType: 'daily_cash',
        entityId,
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
   * Get daily cash entries with optional filtering
   */
  async getDailyCashEntriesForDisplay(filters?: {
    accountId?: string;
    dateFrom?: string;
    dateTo?: string;
    isVerified?: boolean;
  }): Promise<DailyCashEntry[]> {
    try {
      let entries = await this.getAllDailyCashEntries();

      if (filters) {
        if (filters.accountId) {
          entries = entries.filter(entry => entry.accountNumber === filters.accountId);
        }
        if (filters.dateFrom) {
          entries = entries.filter(entry => entry.date >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          entries = entries.filter(entry => entry.date <= filters.dateTo!);
        }
        if (filters.isVerified !== undefined) {
          entries = entries.filter(entry => entry.isVerified === filters.isVerified);
        }
      }

      return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Failed to get daily cash entries for display:', error);
      return [];
    }
  }

  /**
   * Get summary statistics for daily cash management
   */
  async getDailyCashSummary(): Promise<{
    totalEntries: number;
    verifiedEntries: number;
    unverifiedEntries: number;
    totalDiscrepancies: number;
    averageDiscrepancy: number;
    dateRange: { from: string; to: string } | null;
  }> {
    try {
      const entries = await this.getAllDailyCashEntries();
      
      if (entries.length === 0) {
        return {
          totalEntries: 0,
          verifiedEntries: 0,
          unverifiedEntries: 0,
          totalDiscrepancies: 0,
          averageDiscrepancy: 0,
          dateRange: null
        };
      }

      const verifiedEntries = entries.filter(entry => entry.isVerified);
      const discrepancies = entries.map(entry => Math.abs(entry.discrepancy));
      const dates = entries.map(entry => entry.date).sort();

      return {
        totalEntries: entries.length,
        verifiedEntries: verifiedEntries.length,
        unverifiedEntries: entries.length - verifiedEntries.length,
        totalDiscrepancies: discrepancies.reduce((sum, d) => sum + d, 0),
        averageDiscrepancy: discrepancies.length > 0 
          ? discrepancies.reduce((sum, d) => sum + d, 0) / discrepancies.length 
          : 0,
        dateRange: {
          from: dates[0],
          to: dates[dates.length - 1]
        }
      };
    } catch (error) {
      console.error('Failed to get daily cash summary:', error);
      return {
        totalEntries: 0,
        verifiedEntries: 0,
        unverifiedEntries: 0,
        totalDiscrepancies: 0,
        averageDiscrepancy: 0,
        dateRange: null
      };
    }
  }
}

// Export singleton instance
export const dailyCashManagementService = new DailyCashManagementService(); 