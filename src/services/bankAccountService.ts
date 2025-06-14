import { BankAccount } from '../types';
import { fileStorageService } from './fileStorageService';

// Mock bank accounts for demo - in production this would come from a local database
const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: '1',
    name: 'Main Operating Account',
    accountNumber: '1234567890',
    bankName: 'First National Bank',
    currency: 'USD',
    currentBalance: 0.00 // Start with zero balance - will be updated from imports
  },
  {
    id: '2',
    name: 'Savings Account',
    accountNumber: '0987654321',
    bankName: 'First National Bank',
    currency: 'USD',
    currentBalance: 350000.75
  },
  {
    id: '3',
    name: 'Investment Account',
    accountNumber: '1122334455',
    bankName: 'Investment Bank Corp',
    currency: 'USD',
    currentBalance: 750000.00
  },
  {
    id: '4',
    name: 'Petty Cash Account',
    accountNumber: '5566778899',
    bankName: 'Community Bank',
    currency: 'USD',
    currentBalance: 5000.25
  }
];

class BankAccountService {
  private readonly STORAGE_FILENAME = 'bank_accounts';
  private accounts: BankAccount[] = [];

  constructor() {
    this.loadAccounts();
  }

  private loadAccounts(): void {
    // Load from file system instead of localStorage
    this.accounts = fileStorageService.readData(this.STORAGE_FILENAME, MOCK_BANK_ACCOUNTS);
    
    // If no accounts exist, initialize with mock data
    if (this.accounts.length === 0) {
      this.accounts = [...MOCK_BANK_ACCOUNTS];
      this.saveAccounts();
    }
  }

  private saveAccounts(): void {
    const success = fileStorageService.writeData(this.STORAGE_FILENAME, this.accounts);
    if (!success) {
      console.error('Failed to save bank accounts to file system');
    }
  }

  getAllAccounts(): BankAccount[] {
    return [...this.accounts];
  }

  getAccountById(id: string): BankAccount | undefined {
    return this.accounts.find(account => account.id === id);
  }

  addAccount(account: Omit<BankAccount, 'id'>): BankAccount {
    const newAccount: BankAccount = {
      ...account,
      id: Date.now().toString()
    };
    this.accounts.push(newAccount);
    this.saveAccounts();
    return newAccount;
  }

  updateAccount(id: string, updates: Partial<Omit<BankAccount, 'id'>>): BankAccount | null {
    const index = this.accounts.findIndex(account => account.id === id);
    if (index === -1) return null;

    this.accounts[index] = { ...this.accounts[index], ...updates };
    this.saveAccounts();
    return this.accounts[index];
  }

  deleteAccount(id: string): boolean {
    const index = this.accounts.findIndex(account => account.id === id);
    if (index === -1) return false;

    this.accounts.splice(index, 1);
    this.saveAccounts();
    return true;
  }

  updateBalance(id: string, newBalance: number): boolean {
    const account = this.getAccountById(id);
    if (!account) return false;

    const updated = this.updateAccount(id, { currentBalance: newBalance });
    return updated !== null;
  }

  // Get data storage location for debugging/info
  getStorageInfo(): { location: string; filename: string } {
    return {
      location: fileStorageService.getDataDirectory(),
      filename: `${this.STORAGE_FILENAME}.json`
    };
  }
}

export const bankAccountService = new BankAccountService(); 