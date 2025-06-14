interface ImportHistory {
  accountId: string;
  lastImportDate: string;
  lastClosingBalance: number;
  lastImportTimestamp: number;
}

class ImportHistoryService {
  private readonly STORAGE_KEY = 'treasury_import_history';

  // Get import history for all accounts
  getImportHistory(): ImportHistory[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  // Get last import info for a specific account
  getLastImportInfo(accountId: string): ImportHistory | null {
    const history = this.getImportHistory();
    return history.find(h => h.accountId === accountId) || null;
  }

  // Update import history after successful import
  updateImportHistory(accountId: string, lastImportDate: string, closingBalance: number): void {
    const history = this.getImportHistory();
    const existingIndex = history.findIndex(h => h.accountId === accountId);
    
    const newEntry: ImportHistory = {
      accountId,
      lastImportDate,
      lastClosingBalance: closingBalance,
      lastImportTimestamp: Date.now()
    };

    if (existingIndex >= 0) {
      history[existingIndex] = newEntry;
    } else {
      history.push(newEntry);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  // Check if new import date is after last import
  isNewImportAfterLast(accountId: string, newImportDate: string): boolean {
    const lastImport = this.getLastImportInfo(accountId);
    if (!lastImport) return true; // First import
    
    const lastDate = new Date(lastImport.lastImportDate);
    const newDate = new Date(newImportDate);
    
    return newDate > lastDate;
  }

  // Calculate expected opening balance based on last import
  getExpectedOpeningBalance(accountId: string): number | null {
    const lastImport = this.getLastImportInfo(accountId);
    return lastImport ? lastImport.lastClosingBalance : null;
  }

  // Get days since last import
  getDaysSinceLastImport(accountId: string): number | null {
    const lastImport = this.getLastImportInfo(accountId);
    if (!lastImport) return null;
    
    const lastDate = new Date(lastImport.lastImportDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  // Clear import history (for testing/reset)
  clearImportHistory(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const importHistoryService = new ImportHistoryService(); 