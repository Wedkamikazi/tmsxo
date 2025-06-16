"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localStorageManager = void 0;
const performanceManager_1 = require("./performanceManager");
const systemIntegrityService_1 = require("./systemIntegrityService");
const eventBus_1 = require("./eventBus");
const storageQuotaManager_1 = require("./storageQuotaManager");
/**
 * UNIFIED LOCAL STORAGE MANAGER
 * Single source of truth for all data operations
 * Handles atomic operations, error recovery, and data integrity
 */
class LocalStorageManager {
    constructor() {
        this.STORAGE_KEYS = {
            transactions: 'tms_transactions',
            accounts: 'tms_accounts',
            files: 'tms_files',
            categories: 'tms_categories',
            categorizations: 'tms_categorizations',
            metadata: 'tms_metadata',
            snapshots: 'tms_snapshots'
        };
        this.MAX_SNAPSHOTS = 5;
        this.STORAGE_VERSION = '2.0.0';
    }
    // ATOMIC TRANSACTION OPERATIONS
    executeTransaction(operation) {
        const endTimer = performanceManager_1.performanceManager.startOperation();
        const snapshot = this.createSnapshot('atomic_operation');
        try {
            const result = operation();
            this.updateMetadata();
            endTimer();
            return { success: true, result };
        }
        catch (error) {
            performanceManager_1.performanceManager.recordError();
            // Rollback on failure
            this.restoreSnapshot(snapshot);
            endTimer();
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    // TRANSACTION DATA OPERATIONS
    getAllTransactions() {
        return this.getStorageData(this.STORAGE_KEYS.transactions, []);
    }
    addTransactions(transactions) {
        const result = this.executeTransaction(() => {
            const existing = this.getAllTransactions();
            const existingIds = new Set(existing.map(t => t.id));
            const newTransactions = transactions.filter(t => !existingIds.has(t.id));
            if (newTransactions.length === 0)
                return { success: true, affectedAccountIds: [] };
            const updated = [...existing, ...newTransactions].sort((a, b) => new Date(b.postDateTime).getTime() - new Date(a.postDateTime).getTime());
            this.setStorageData(this.STORAGE_KEYS.transactions, updated);
            // Return affected account IDs for balance update
            const affectedAccountIds = [...new Set(newTransactions.map(t => t.accountId))];
            return { success: true, affectedAccountIds };
        });
        if (result.success && result.result) {
            // Automatically update account balances for affected accounts
            const affectedAccountIds = result.result.affectedAccountIds;
            if (affectedAccountIds.length > 0) {
                this.updateAccountBalancesFromTransactions(affectedAccountIds);
            }
        }
        return result.success;
    }
    getTransactionsByAccount(accountId) {
        return this.getAllTransactions().filter(t => t.accountId === accountId);
    }
    deleteTransactionsByFile(fileId) {
        const result = this.executeTransaction(() => {
            const all = this.getAllTransactions();
            const deletedTransactions = all.filter(t => t.fileId === fileId);
            const remaining = all.filter(t => t.fileId !== fileId);
            const deletedCount = all.length - remaining.length;
            this.setStorageData(this.STORAGE_KEYS.transactions, remaining);
            // Return both count and affected account IDs
            const affectedAccountIds = [...new Set(deletedTransactions.map(t => t.accountId))];
            return { deletedCount, affectedAccountIds };
        });
        if (result.success && result.result) {
            // Automatically update account balances for affected accounts
            const { deletedCount, affectedAccountIds } = result.result;
            if (affectedAccountIds.length > 0) {
                this.updateAccountBalancesFromTransactions(affectedAccountIds);
            }
            return deletedCount;
        }
        return 0;
    }
    deleteTransactionsByAccount(accountId) {
        const result = this.executeTransaction(() => {
            const all = this.getAllTransactions();
            const remaining = all.filter(t => t.accountId !== accountId);
            const deletedCount = all.length - remaining.length;
            this.setStorageData(this.STORAGE_KEYS.transactions, remaining);
            return deletedCount;
        });
        if (result.success && result.result) {
            // Automatically update account balance for this account (will be set to 0 since no transactions remain)
            this.updateAccountBalancesFromTransactions([accountId]);
            return result.result;
        }
        return 0;
    }
    // ACCOUNT OPERATIONS
    getAllAccounts() {
        const defaultAccounts = this.getDefaultAccounts();
        return this.getStorageData(this.STORAGE_KEYS.accounts, defaultAccounts);
    }
    addAccount(account) {
        const result = this.executeTransaction(() => {
            const newAccount = {
                ...account,
                id: this.generateId('acc')
            };
            const accounts = this.getAllAccounts();
            accounts.push(newAccount);
            this.setStorageData(this.STORAGE_KEYS.accounts, accounts);
            return newAccount;
        });
        return result.success ? result.result : null;
    }
    updateAccount(accountId, updates) {
        return this.executeTransaction(() => {
            const accounts = this.getAllAccounts();
            const index = accounts.findIndex(a => a.id === accountId);
            if (index === -1)
                throw new Error('Account not found');
            accounts[index] = { ...accounts[index], ...updates };
            this.setStorageData(this.STORAGE_KEYS.accounts, accounts);
            return true;
        }).success;
    }
    deleteAccount(accountId) {
        return this.executeTransaction(() => {
            // First delete all transactions for this account
            this.deleteTransactionsByAccount(accountId);
            // Then delete the account
            const accounts = this.getAllAccounts();
            const filtered = accounts.filter(a => a.id !== accountId);
            if (filtered.length === accounts.length) {
                throw new Error('Account not found');
            }
            this.setStorageData(this.STORAGE_KEYS.accounts, filtered);
            return true;
        }).success;
    }
    // FILE OPERATIONS
    getAllFiles() {
        return this.getStorageData(this.STORAGE_KEYS.files, []);
    }
    addFile(file) {
        const result = this.executeTransaction(() => {
            const newFile = {
                ...file,
                id: this.generateId('file'),
                uploadDate: new Date().toISOString()
            };
            const files = this.getAllFiles();
            files.push(newFile);
            this.setStorageData(this.STORAGE_KEYS.files, files);
            return newFile;
        });
        return result.success ? result.result : null;
    }
    deleteFile(fileId) {
        return this.executeTransaction(() => {
            // Get the transactions that will be deleted to identify affected accounts
            const allTransactions = this.getAllTransactions();
            const deletedTransactions = allTransactions.filter(t => t.fileId === fileId);
            const affectedAccountIds = new Set(deletedTransactions.map(t => t.accountId));
            // First delete all transactions for this file
            this.deleteTransactionsByFile(fileId);
            // Update account balances for affected accounts
            this.updateAccountBalancesFromTransactions(Array.from(affectedAccountIds));
            // Then delete the file record
            const files = this.getAllFiles();
            const filtered = files.filter(f => f.id !== fileId);
            if (filtered.length === files.length) {
                throw new Error('File not found');
            }
            this.setStorageData(this.STORAGE_KEYS.files, filtered);
            return true;
        }).success;
    }
    // CATEGORY OPERATIONS
    getAllCategories() {
        return this.getStorageData(this.STORAGE_KEYS.categories, this.getDefaultCategories());
    }
    addCategory(category) {
        const result = this.executeTransaction(() => {
            const now = new Date().toISOString();
            const newCategory = {
                ...category,
                id: this.generateId('cat'),
                createdDate: now,
                modifiedDate: now
            };
            const categories = this.getAllCategories();
            categories.push(newCategory);
            this.setStorageData(this.STORAGE_KEYS.categories, categories);
            return newCategory;
        });
        return result.success ? result.result : null;
    }
    // CATEGORIZATION OPERATIONS
    getAllCategorizations() {
        return this.getStorageData(this.STORAGE_KEYS.categorizations, []);
    }
    addCategorization(categorization) {
        const result = this.executeTransaction(() => {
            const now = new Date().toISOString();
            const newCategorization = {
                ...categorization,
                createdDate: now,
                modifiedDate: now
            };
            const categorizations = this.getAllCategorizations();
            const existingIndex = categorizations.findIndex(c => c.transactionId === categorization.transactionId);
            if (existingIndex >= 0) {
                categorizations[existingIndex] = newCategorization;
            }
            else {
                categorizations.push(newCategorization);
            }
            this.setStorageData(this.STORAGE_KEYS.categorizations, categorizations);
            return newCategorization;
        });
        return result.success ? result.result : null;
    }
    // DATA INTEGRITY AND MAINTENANCE
    validateDataIntegrity() {
        const issues = [];
        const transactions = this.getAllTransactions();
        const accounts = this.getAllAccounts();
        const files = this.getAllFiles();
        const categorizations = this.getAllCategorizations();
        // Check for orphaned transactions
        const accountIds = new Set(accounts.map(a => a.id));
        const orphanedTransactions = transactions.filter(t => !accountIds.has(t.accountId));
        if (orphanedTransactions.length > 0) {
            issues.push(`${orphanedTransactions.length} orphaned transactions found`);
        }
        // Check for orphaned files
        const fileIds = new Set(files.map(f => f.id));
        const orphanedFileRefs = transactions.filter(t => t.fileId && !fileIds.has(t.fileId));
        if (orphanedFileRefs.length > 0) {
            issues.push(`${orphanedFileRefs.length} transactions reference missing files`);
        }
        // Check for orphaned categorizations
        const transactionIds = new Set(transactions.map(t => t.id));
        const orphanedCategorizations = categorizations.filter(c => !transactionIds.has(c.transactionId));
        if (orphanedCategorizations.length > 0) {
            issues.push(`${orphanedCategorizations.length} orphaned categorizations found`);
        }
        const stats = this.getStorageStats();
        return {
            isValid: issues.length === 0,
            issues,
            stats
        };
    }
    cleanupOrphanedData() {
        const result = this.executeTransaction(() => {
            let deletedTransactions = 0;
            let deletedCategorizations = 0;
            // Clean orphaned transactions
            const transactions = this.getAllTransactions();
            const accounts = this.getAllAccounts();
            const accountIds = new Set(accounts.map(a => a.id));
            const validTransactions = transactions.filter(t => {
                if (!accountIds.has(t.accountId)) {
                    deletedTransactions++;
                    return false;
                }
                return true;
            });
            this.setStorageData(this.STORAGE_KEYS.transactions, validTransactions);
            // Clean orphaned categorizations
            const categorizations = this.getAllCategorizations();
            const transactionIds = new Set(validTransactions.map(t => t.id));
            const validCategorizations = categorizations.filter(c => {
                if (!transactionIds.has(c.transactionId)) {
                    deletedCategorizations++;
                    return false;
                }
                return true;
            });
            this.setStorageData(this.STORAGE_KEYS.categorizations, validCategorizations);
            return { deletedTransactions, deletedCategorizations };
        });
        return result.success ? result.result : { deletedTransactions: 0, deletedCategorizations: 0 };
    }
    // SNAPSHOT AND BACKUP OPERATIONS
    createSnapshot(_operationType) {
        const timestamp = new Date().toISOString();
        const snapshot = {
            timestamp,
            transactions: this.getAllTransactions(),
            accounts: this.getAllAccounts(),
            files: this.getAllFiles(),
            categories: this.getAllCategories(),
            categorizations: this.getAllCategorizations()
        };
        try {
            const snapshots = this.getStorageData(this.STORAGE_KEYS.snapshots, []);
            snapshots.push(snapshot);
            // Keep only the most recent snapshots
            if (snapshots.length > this.MAX_SNAPSHOTS) {
                snapshots.splice(0, snapshots.length - this.MAX_SNAPSHOTS);
            }
            this.setStorageData(this.STORAGE_KEYS.snapshots, snapshots);
            return timestamp;
        }
        catch (error) {
            // If we hit quota exceeded, try to clean up old snapshots first
            if (error instanceof Error && error.name === 'QuotaExceededError') {
                console.warn('🚨 Snapshot storage quota exceeded, attempting cleanup...');
                try {
                    // Clear all existing snapshots and try again with just the new one
                    this.setStorageData(this.STORAGE_KEYS.snapshots, [snapshot]);
                    console.log('✅ Snapshot cleanup successful, created new snapshot');
                    return timestamp;
                }
                catch (secondError) {
                    // If still failing, we can't create snapshots - continue without backup
                    console.error('🚨 Cannot create snapshots due to storage quota limits. Operations will continue without backup protection.');
                    // Clear snapshots completely to free space
                    try {
                        this.setStorageData(this.STORAGE_KEYS.snapshots, []);
                    }
                    catch (_a) {
                        // If we can't even clear snapshots, localStorage is severely constrained
                        console.error('🚨 Critical: Unable to manage snapshot storage. Consider clearing browser data.');
                    }
                    // Return a timestamp anyway so operations can continue
                    return timestamp;
                }
            }
            // For other types of errors, log and continue
            console.error('Error creating snapshot:', error);
            return timestamp;
        }
    }
    restoreSnapshot(timestamp) {
        const snapshots = this.getStorageData(this.STORAGE_KEYS.snapshots, []);
        const snapshot = snapshots.find(s => s.timestamp === timestamp);
        if (!snapshot)
            return false;
        try {
            this.setStorageData(this.STORAGE_KEYS.transactions, snapshot.transactions);
            this.setStorageData(this.STORAGE_KEYS.accounts, snapshot.accounts);
            this.setStorageData(this.STORAGE_KEYS.files, snapshot.files);
            this.setStorageData(this.STORAGE_KEYS.categories, snapshot.categories);
            this.setStorageData(this.STORAGE_KEYS.categorizations, snapshot.categorizations);
            this.updateMetadata();
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    // UTILITY METHODS
    getStorageStats() {
        const transactions = this.getAllTransactions();
        const accounts = this.getAllAccounts();
        const files = this.getAllFiles();
        const categories = this.getAllCategories();
        const categorizations = this.getAllCategorizations();
        let totalSize = 0;
        Object.values(this.STORAGE_KEYS).forEach(key => {
            const data = localStorage.getItem(key);
            if (data)
                totalSize += data.length;
        });
        return {
            totalSize: Math.round(totalSize / 1024),
            itemCounts: {
                transactions: transactions.length,
                accounts: accounts.length,
                files: files.length,
                categories: categories.length,
                categorizations: categorizations.length
            },
            lastUpdated: new Date().toISOString()
        };
    }
    /**
     * Get comprehensive storage statistics including quota information
     */
    getEnhancedStorageStats() {
        const basicStats = this.getStorageStats();
        const quotaInfo = storageQuotaManager_1.storageQuotaManager.getQuotaInfo();
        const cleanupHistory = storageQuotaManager_1.storageQuotaManager.getCleanupHistory().slice(-5); // Last 5 cleanups
        return {
            ...basicStats,
            quotaInfo: quotaInfo ? {
                utilization: quotaInfo.utilization,
                isNearLimit: quotaInfo.isNearLimit,
                isCritical: quotaInfo.isCritical,
                totalQuota: Math.round(quotaInfo.total / 1024),
                usedSpace: Math.round(quotaInfo.used / 1024),
                availableSpace: Math.round(quotaInfo.available / 1024) // KB
            } : null,
            cleanupHistory
        };
    }
    exportData() {
        const data = {
            version: this.STORAGE_VERSION,
            timestamp: new Date().toISOString(),
            transactions: this.getAllTransactions(),
            accounts: this.getAllAccounts(),
            files: this.getAllFiles(),
            categories: this.getAllCategories(),
            categorizations: this.getAllCategorizations()
        };
        return JSON.stringify(data, null, 2);
    }
    importData(jsonData) {
        const result = this.executeTransaction(() => {
            var _a, _b, _c, _d, _e;
            const data = JSON.parse(jsonData);
            if (data.version !== this.STORAGE_VERSION) {
                throw new Error(`Version mismatch. Expected ${this.STORAGE_VERSION}, got ${data.version}`);
            }
            this.setStorageData(this.STORAGE_KEYS.transactions, data.transactions || []);
            this.setStorageData(this.STORAGE_KEYS.accounts, data.accounts || []);
            this.setStorageData(this.STORAGE_KEYS.files, data.files || []);
            this.setStorageData(this.STORAGE_KEYS.categories, data.categories || []);
            this.setStorageData(this.STORAGE_KEYS.categorizations, data.categorizations || []);
            const imported = {
                transactions: ((_a = data.transactions) === null || _a === void 0 ? void 0 : _a.length) || 0,
                accounts: ((_b = data.accounts) === null || _b === void 0 ? void 0 : _b.length) || 0,
                files: ((_c = data.files) === null || _c === void 0 ? void 0 : _c.length) || 0,
                categories: ((_d = data.categories) === null || _d === void 0 ? void 0 : _d.length) || 0,
                categorizations: ((_e = data.categorizations) === null || _e === void 0 ? void 0 : _e.length) || 0
            };
            return { success: true, message: 'Data imported successfully', imported };
        });
        return result.success ? result.result : { success: false, message: result.error || 'Import failed', imported: {} };
    }
    clearAllData() {
        Object.values(this.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
    // PUBLIC GENERIC STORAGE METHODS
    getItem(key, defaultValue) {
        return this.getStorageData(key, defaultValue || null);
    }
    setItem(key, data) {
        this.setStorageData(key, data);
    }
    // PRIVATE HELPER METHODS
    getStorageData(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        }
        catch (error) {
            systemIntegrityService_1.systemIntegrityService.logServiceError('LocalStorageManager', 'getStorageData', error instanceof Error ? error : new Error(String(error)), 'medium', { key, operation: 'load' });
            return defaultValue;
        }
    }
    setStorageData(key, data) {
        try {
            // Check quota before attempting to save
            const quotaInfo = storageQuotaManager_1.storageQuotaManager.getQuotaInfo();
            if (quotaInfo && quotaInfo.isCritical) {
                console.warn('⚠️ Storage quota critical - attempting cleanup before save');
                // Trigger immediate cleanup for critical quota situations (fire and forget)
                storageQuotaManager_1.storageQuotaManager.performManualCleanup('moderate').catch(error => {
                    console.error('Cleanup failed during storage operation:', error);
                });
            }
            localStorage.setItem(key, JSON.stringify(data));
            // Trigger quota check after successful save (fire and forget)
            storageQuotaManager_1.storageQuotaManager.forceQuotaCheck().catch(error => {
                console.warn('Quota check failed after storage operation:', error);
            });
        }
        catch (error) {
            // Handle QuotaExceededError specifically
            if (error instanceof Error && error.name === 'QuotaExceededError') {
                console.error('🚨 Storage quota exceeded - performing emergency cleanup synchronously');
                // Get current quota info for error reporting
                const quotaInfo = storageQuotaManager_1.storageQuotaManager.getQuotaInfo();
                const errorMessage = `Storage quota exceeded. Current usage: ${(quotaInfo === null || quotaInfo === void 0 ? void 0 : quotaInfo.utilization.toFixed(1)) || 'unknown'}%. Emergency cleanup will be triggered asynchronously.`;
                // Trigger async cleanup but don't wait for it
                storageQuotaManager_1.storageQuotaManager.performManualCleanup('aggressive').then(result => {
                    if (result.success && result.spaceFreed > 0) {
                        console.log(`✅ Emergency cleanup completed - freed ${result.spaceFreed} bytes`);
                        // Optionally retry the operation that failed
                        try {
                            localStorage.setItem(key, JSON.stringify(data));
                            console.log('✅ Retry after cleanup successful');
                        }
                        catch (retryError) {
                            console.error('❌ Retry after cleanup failed:', retryError);
                        }
                    }
                }).catch(cleanupError => {
                    console.error('Emergency cleanup failed:', cleanupError);
                });
                systemIntegrityService_1.systemIntegrityService.logServiceError('LocalStorageManager', 'setStorageData', new Error(errorMessage), 'critical', {
                    key,
                    operation: 'save',
                    quotaInfo,
                    errorType: 'QuotaExceededError'
                });
                throw new Error(errorMessage);
            }
            // Handle other storage errors
            systemIntegrityService_1.systemIntegrityService.logServiceError('LocalStorageManager', 'setStorageData', error instanceof Error ? error : new Error(String(error)), 'high', { key, operation: 'save' });
            throw error;
        }
    }
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    updateMetadata() {
        const metadata = {
            version: this.STORAGE_VERSION,
            lastUpdated: new Date().toISOString()
        };
        this.setStorageData(this.STORAGE_KEYS.metadata, metadata);
    }
    getDefaultAccounts() {
        return [
            {
                id: 'default_current',
                name: 'Current Account',
                accountNumber: '00000000',
                bankName: 'Default Bank',
                currency: 'USD',
                currentBalance: 0
            }
        ];
    }
    getDefaultCategories() {
        const now = new Date().toISOString();
        return [
            {
                id: 'cat_income',
                name: 'Income',
                description: 'All income transactions',
                keywords: ['salary', 'wage', 'income', 'payment'],
                color: '#4CAF50',
                isSystem: true,
                createdDate: now,
                modifiedDate: now
            },
            {
                id: 'cat_expense',
                name: 'Expenses',
                description: 'General expenses',
                keywords: ['purchase', 'payment', 'expense'],
                color: '#F44336',
                isSystem: true,
                createdDate: now,
                modifiedDate: now
            },
            {
                id: 'cat_transfer',
                name: 'Transfers',
                description: 'Account transfers',
                keywords: ['transfer', 'move'],
                color: '#2196F3',
                isSystem: true,
                createdDate: now,
                modifiedDate: now
            }
        ];
    }
    // PUBLIC METHOD - Update all account balances based on transactions
    updateAllAccountBalances() {
        const accounts = this.getAllAccounts();
        const accountIds = accounts.map(a => a.id);
        this.updateAccountBalancesFromTransactions(accountIds);
    }
    // BALANCE MANAGEMENT - Update account balances based on remaining transactions
    updateAccountBalancesFromTransactions(accountIds) {
        const accounts = this.getAllAccounts();
        const allTransactions = this.getAllTransactions();
        accountIds.forEach(accountId => {
            const accountIndex = accounts.findIndex(a => a.id === accountId);
            if (accountIndex === -1)
                return;
            // Get all transactions for this account, sorted by postDateTime (most recent first)
            const accountTransactions = allTransactions
                .filter(t => t.accountId === accountId)
                .sort((a, b) => {
                // First sort by postDateTime (which combines date and time)
                const dateComparison = new Date(b.postDateTime).getTime() - new Date(a.postDateTime).getTime();
                if (dateComparison !== 0)
                    return dateComparison;
                // If postDateTime is the same, fall back to regular date comparison
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
            if (accountTransactions.length > 0) {
                // Use the balance from the most recent transaction (by postDateTime)
                const mostRecentTransaction = accountTransactions[0];
                accounts[accountIndex].currentBalance = mostRecentTransaction.balance;
                console.log(`🔄 Updated account ${accounts[accountIndex].name} balance to ${mostRecentTransaction.balance} based on most recent transaction (${mostRecentTransaction.postDateTime})`);
                eventBus_1.eventBus.emit('ACCOUNT_UPDATED', { accountId, action: 'balance_updated', balance: mostRecentTransaction.balance });
            }
            else {
                // No transactions left for this account - RESET TO ZERO
                accounts[accountIndex].currentBalance = 0;
                console.log(`🔄 No transactions remaining for account ${accounts[accountIndex].name}, resetting balance to 0`);
                eventBus_1.eventBus.emit('ACCOUNT_UPDATED', { accountId, action: 'balance_reset', balance: 0 });
            }
        });
        // Save updated accounts
        this.setStorageData(this.STORAGE_KEYS.accounts, accounts);
        // Emit a general accounts updated event for UI refresh
        eventBus_1.eventBus.emit('ACCOUNTS_UPDATED', { updatedAccountIds: accountIds }, 'LocalStorageManager');
    }
}
exports.localStorageManager = new LocalStorageManager();
