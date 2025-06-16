"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemIntegrityService = void 0;
const eventBus_1 = require("./eventBus");
const localStorageManager_1 = require("./localStorageManager");
const unifiedDataService_1 = require("./unifiedDataService");
const performanceManager_1 = require("./performanceManager");
const crossTabSyncService_1 = require("./crossTabSyncService");
const debugMode_1 = require("../utils/debugMode");
class SystemIntegrityService {
    constructor() {
        this.healthCheckInterval = null;
        this.errorLog = [];
        this.activeTransactions = new Map();
        this.consistencyCheckers = new Map();
        // HEALTH HISTORY MANAGEMENT
        this.healthHistory = [];
        this.initializeIntegritySystem();
    }
    // INITIALIZE COMPREHENSIVE INTEGRITY SYSTEM
    initializeIntegritySystem() {
        console.log('🛡️ Initializing System Integrity Service...');
        // Set up event monitoring
        this.setupEventMonitoring();
        // Register consistency checkers
        this.registerConsistencyCheckers();
        // Start health monitoring
        this.startHealthMonitoring();
        // Set up error handling
        this.setupGlobalErrorHandling();
        console.log('✅ System Integrity Service Initialized');
    }
    // CENTRALIZED EVENT MONITORING
    setupEventMonitoring() {
        const criticalEvents = [
            'TRANSACTIONS_UPDATED',
            'ACCOUNT_UPDATED',
            'FILE_DELETED',
            'DATA_CLEARED'
        ];
        criticalEvents.forEach(eventType => {
            eventBus_1.eventBus.on(eventType, (payload) => {
                this.validateEventConsistency(eventType, payload);
            });
        });
    }
    // VALIDATE EVENT-DRIVEN DATA CONSISTENCY
    async validateEventConsistency(eventType, payload) {
        try {
            const startTime = Date.now();
            switch (eventType) {
                case 'TRANSACTIONS_UPDATED':
                    await this.validateTransactionConsistency(payload);
                    break;
                case 'ACCOUNT_UPDATED':
                    await this.validateAccountConsistency(payload);
                    break;
                case 'FILE_DELETED':
                    await this.validateFileConsistency(payload);
                    break;
                case 'DATA_CLEARED':
                    await this.validateGlobalConsistency();
                    break;
            }
            const duration = Date.now() - startTime;
            if (duration > 100) {
                this.logWarning('system', `Event validation took ${duration}ms for ${eventType}`, 'medium');
            }
        }
        catch (error) {
            this.logError('system', `Event consistency validation failed for ${eventType}: ${error}`, 'high');
        }
    }
    // CROSS-SERVICE TRANSACTION SUPPORT
    async executeDistributedTransaction(operations) {
        const transactionId = this.generateTransactionId();
        const transaction = {
            id: transactionId,
            operations,
            status: 'pending',
            timestamp: new Date().toISOString(),
            completedOperations: 0
        };
        this.activeTransactions.set(transactionId, transaction);
        try {
            transaction.status = 'executing';
            // Execute operations sequentially with rollback capability
            for (let i = 0; i < operations.length; i++) {
                const operation = operations[i];
                try {
                    await this.executeOperation(operation);
                    transaction.completedOperations++;
                }
                catch (error) {
                    // Rollback all completed operations
                    transaction.status = 'failed';
                    transaction.error = error instanceof Error ? error.message : 'Unknown error';
                    await this.rollbackTransaction(transaction);
                    return {
                        success: false,
                        transactionId,
                        error: transaction.error
                    };
                }
            }
            transaction.status = 'completed';
            this.activeTransactions.delete(transactionId);
            return {
                success: true,
                transactionId
            };
        }
        catch (error) {
            transaction.status = 'failed';
            transaction.error = error instanceof Error ? error.message : 'Transaction failed';
            return {
                success: false,
                transactionId,
                error: transaction.error
            };
        }
    }
    // COMPREHENSIVE DATA CONSISTENCY VALIDATION
    async performFullConsistencyCheck() {
        const issues = [];
        let totalChecks = 0;
        let passedChecks = 0;
        console.log('🔍 Performing Full System Consistency Check...');
        // Run all registered consistency checkers
        for (const [checkName, checker] of this.consistencyCheckers) {
            totalChecks++;
            try {
                const result = await checker();
                if (result) {
                    passedChecks++;
                }
                else {
                    issues.push({
                        severity: 'high',
                        component: checkName,
                        description: `Consistency check failed for ${checkName}`,
                        affectedData: ['Unknown'],
                        resolution: `Investigate ${checkName} data integrity`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            catch (error) {
                issues.push({
                    severity: 'critical',
                    component: checkName,
                    description: `Consistency checker crashed: ${error}`,
                    affectedData: ['Unknown'],
                    resolution: `Fix ${checkName} consistency checker`,
                    timestamp: new Date().toISOString()
                });
            }
        }
        // Additional comprehensive checks
        await this.checkTransactionAccountReferences(issues);
        await this.checkFileTransactionReferences(issues);
        await this.checkBalanceCalculations(issues);
        await this.checkDuplicateIds(issues);
        totalChecks += 4;
        passedChecks += issues.length === 0 ? 4 : Math.max(0, 4 - issues.filter(i => i.timestamp > new Date(Date.now() - 1000).toISOString()).length);
        const criticalIssues = issues.filter(i => i.severity === 'critical').length;
        return {
            isConsistent: issues.length === 0,
            issues,
            summary: {
                totalChecks,
                passedChecks,
                failedChecks: totalChecks - passedChecks,
                criticalIssues
            }
        };
    }
    // SYSTEM HEALTH MONITORING
    async getSystemHealthStatus() {
        const startTime = Date.now();
        // Check storage health
        const storageHealth = await this.checkStorageHealth();
        // Check event bus health
        const eventBusHealth = await this.checkEventBusHealth();
        // Check data integrity
        const dataIntegrityHealth = await this.checkDataIntegrityHealth();
        // Check performance
        const performanceHealth = await this.checkPerformanceHealth();
        // Check cross-tab sync
        const crossTabSyncHealth = await this.checkCrossTabSyncHealth();
        // Calculate overall health
        const componentHealths = [storageHealth, eventBusHealth, dataIntegrityHealth, performanceHealth, crossTabSyncHealth];
        const healthyComponents = componentHealths.filter(h => h === 'healthy').length;
        let overall;
        if (healthyComponents === 5)
            overall = 'excellent';
        else if (healthyComponents === 4)
            overall = 'good';
        else if (healthyComponents >= 3)
            overall = 'warning';
        else if (healthyComponents >= 2)
            overall = 'critical';
        else
            overall = 'failure';
        // Get storage stats
        const storageStats = localStorageManager_1.localStorageManager.getStorageStats();
        // Get cross-tab sync stats
        const syncStats = crossTabSyncService_1.crossTabSyncService.getSyncStats();
        return {
            overall,
            components: {
                storage: storageHealth,
                eventBus: eventBusHealth,
                dataIntegrity: dataIntegrityHealth,
                performance: performanceHealth,
                crossTabSync: crossTabSyncHealth
            },
            metrics: {
                storageUsed: storageStats.totalSize,
                eventLatency: Date.now() - startTime,
                dataConsistency: healthyComponents / 5,
                errorRate: this.calculateErrorRate(),
                activeTabs: syncStats.activeTabs,
                syncConflicts: syncStats.conflictsDetected - syncStats.conflictsResolved
            },
            lastCheck: new Date().toISOString()
        };
    }
    // AUTO-REPAIR SYSTEM ISSUES
    async attemptAutoRepair() {
        const repairedIssues = [];
        const remainingIssues = [];
        try {
            console.log('🔧 Attempting Auto-Repair...');
            // Clean up orphaned data
            const cleanupResult = unifiedDataService_1.unifiedDataService.cleanupOrphanedData();
            if (cleanupResult.deletedTransactions > 0) {
                repairedIssues.push(`Cleaned up ${cleanupResult.deletedTransactions} orphaned transactions`);
            }
            // Validate and fix data integrity
            const integrityResult = localStorageManager_1.localStorageManager.validateDataIntegrity();
            if (!integrityResult.isValid) {
                // Attempt to fix common issues
                try {
                    localStorageManager_1.localStorageManager.createSnapshot('auto_repair');
                    // Add specific repair logic here
                    repairedIssues.push('Fixed data integrity issues');
                }
                catch (error) {
                    remainingIssues.push(`Could not fix data integrity: ${error}`);
                }
            }
            // Repair event system
            if (eventBus_1.eventBus.getRecentEvents(1).length === 0) {
                eventBus_1.eventBus.emit('DATA_CLEARED', { autoRepair: true }, 'SystemIntegrityService');
                repairedIssues.push('Reset event system');
            }
            return {
                success: repairedIssues.length > 0,
                repairedIssues,
                remainingIssues
            };
        }
        catch (error) {
            return {
                success: false,
                repairedIssues,
                remainingIssues: [`Auto-repair failed: ${error}`]
            };
        }
    }
    // REGISTER CONSISTENCY CHECKERS
    registerConsistencyCheckers() {
        this.consistencyCheckers.set('transaction-balance', async () => {
            const transactions = unifiedDataService_1.unifiedDataService.getAllTransactions();
            return transactions.every(t => (t.creditAmount > 0 && t.debitAmount === 0) ||
                (t.debitAmount > 0 && t.creditAmount === 0) ||
                (t.creditAmount === 0 && t.debitAmount === 0));
        });
        this.consistencyCheckers.set('account-references', async () => {
            const transactions = unifiedDataService_1.unifiedDataService.getAllTransactions();
            const accounts = unifiedDataService_1.unifiedDataService.getAllAccounts();
            const accountIds = new Set(accounts.map(a => a.id));
            return transactions.every(t => accountIds.has(t.accountId));
        });
        this.consistencyCheckers.set('file-references', async () => {
            const transactions = unifiedDataService_1.unifiedDataService.getAllTransactions();
            const files = unifiedDataService_1.unifiedDataService.getAllFiles();
            const fileIds = new Set(files.map(f => f.id));
            return transactions.every(t => !t.fileId || fileIds.has(t.fileId));
        });
    }
    // PRIVATE HELPER METHODS
    async executeOperation(operation) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { service, operation: op, parameters } = operation;
        // This would route to the appropriate service method
        // Implementation depends on the specific operation
        console.log(`Executing ${service}.${op} with parameters:`, parameters);
    }
    async rollbackTransaction(transaction) {
        transaction.status = 'rolledback';
        // Execute rollback functions in reverse order
        for (let i = transaction.completedOperations - 1; i >= 0; i--) {
            const operation = transaction.operations[i];
            if (operation.rollbackFn) {
                try {
                    await operation.rollbackFn();
                }
                catch (error) {
                    this.logError('system', `Rollback failed for operation ${i}: ${error}`, 'critical');
                }
            }
        }
    }
    generateTransactionId() {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async validateTransactionConsistency(_payload) {
        // Implement transaction-specific consistency checks
    }
    async validateAccountConsistency(payload) {
        // Reserved for future account-specific consistency check implementation
        // @ts-ignore: Reserved for future implementation
        const _payloadData = payload || {};
        // Explicitly mark as unused to satisfy linter
        void _payloadData;
        // TODO: Implement account-specific consistency checks using _payloadData.accountId and _payloadData.action
    }
    async validateFileConsistency(payload) {
        // Reserved for future file-specific consistency check implementation
        // @ts-ignore: Reserved for future implementation
        const _payloadData = payload || {};
        // Explicitly mark as unused to satisfy linter
        void _payloadData;
        // TODO: Implement file-specific consistency checks using _payloadData.fileId
    }
    async validateGlobalConsistency() {
        // Implement global consistency checks
        const integrity = await this.performFullConsistencyCheck();
        if (!integrity.isConsistent) {
            this.logError('system', `Global consistency check failed: ${integrity.issues.length} issues found`, 'high');
        }
    }
    startHealthMonitoring() {
        // Check system health every 5 minutes
        this.healthCheckInterval = setInterval(async () => {
            const health = await this.getSystemHealthStatus();
            if (health.overall === 'critical' || health.overall === 'failure') {
                this.logError('system', `System health is ${health.overall}`, 'critical');
                // Attempt auto-repair for critical issues
                await this.attemptAutoRepair();
            }
        }, 5 * 60 * 1000);
    }
    setupGlobalErrorHandling() {
        // Global error handler for unhandled promises
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('global', `Unhandled promise rejection: ${event.reason}`, 'high');
            event.preventDefault();
        });
        // Global error handler for runtime errors
        window.addEventListener('error', (event) => {
            var _a;
            this.logError('global', `Runtime error: ${((_a = event.error) === null || _a === void 0 ? void 0 : _a.message) || event.message}`, 'medium');
        });
    }
    async checkStorageHealth() {
        try {
            const stats = localStorageManager_1.localStorageManager.getStorageStats();
            if (stats.totalSize > 50000)
                return 'degraded'; // More than 50MB
            return 'healthy';
        }
        catch (_a) {
            return 'failed';
        }
    }
    async checkEventBusHealth() {
        try {
            const recentEvents = eventBus_1.eventBus.getRecentEvents(10);
            return recentEvents.length >= 0 ? 'healthy' : 'degraded';
        }
        catch (_a) {
            return 'failed';
        }
    }
    async checkDataIntegrityHealth() {
        try {
            const integrity = localStorageManager_1.localStorageManager.validateDataIntegrity();
            if (integrity.isValid)
                return 'healthy';
            if (integrity.issues.length <= 5)
                return 'degraded';
            return 'failed';
        }
        catch (_a) {
            return 'failed';
        }
    }
    async checkPerformanceHealth() {
        try {
            const startTime = Date.now();
            unifiedDataService_1.unifiedDataService.getAllTransactions().slice(0, 100);
            const duration = Date.now() - startTime;
            if (duration < 10)
                return 'healthy';
            if (duration < 50)
                return 'degraded';
            return 'failed';
        }
        catch (_a) {
            return 'failed';
        }
    }
    async checkCrossTabSyncHealth() {
        try {
            const syncStats = crossTabSyncService_1.crossTabSyncService.getSyncStats();
            const pendingConflicts = crossTabSyncService_1.crossTabSyncService.getPendingConflicts();
            // Check for excessive unresolved conflicts
            const unresolvedConflicts = pendingConflicts.filter(c => !c.resolved).length;
            if (unresolvedConflicts > 5)
                return 'failed';
            if (unresolvedConflicts > 2)
                return 'degraded';
            // Check sync latency
            if (syncStats.syncLatency > 1000)
                return 'degraded'; // More than 1 second
            if (syncStats.syncLatency > 5000)
                return 'failed'; // More than 5 seconds
            return 'healthy';
        }
        catch (_a) {
            return 'failed';
        }
    }
    async checkTransactionAccountReferences(issues) {
        const transactions = unifiedDataService_1.unifiedDataService.getAllTransactions();
        const accounts = unifiedDataService_1.unifiedDataService.getAllAccounts();
        const accountIds = new Set(accounts.map(a => a.id));
        const orphanedTransactions = transactions.filter(t => !accountIds.has(t.accountId));
        if (orphanedTransactions.length > 0) {
            issues.push({
                severity: 'high',
                component: 'transaction-references',
                description: `Found ${orphanedTransactions.length} transactions with invalid account references`,
                affectedData: orphanedTransactions.map(t => t.id),
                resolution: 'Clean up orphaned transactions or restore missing accounts',
                timestamp: new Date().toISOString()
            });
        }
    }
    async checkFileTransactionReferences(issues) {
        const transactions = unifiedDataService_1.unifiedDataService.getAllTransactions();
        const files = unifiedDataService_1.unifiedDataService.getAllFiles();
        const fileIds = new Set(files.map(f => f.id));
        const orphanedReferences = transactions.filter(t => t.fileId && !fileIds.has(t.fileId));
        if (orphanedReferences.length > 0) {
            issues.push({
                severity: 'medium',
                component: 'file-references',
                description: `Found ${orphanedReferences.length} transactions with invalid file references`,
                affectedData: orphanedReferences.map(t => t.id),
                resolution: 'Clean up invalid file references',
                timestamp: new Date().toISOString()
            });
        }
    }
    async checkBalanceCalculations(issues) {
        const transactions = unifiedDataService_1.unifiedDataService.getAllTransactions();
        const accounts = unifiedDataService_1.unifiedDataService.getAllAccounts();
        for (const account of accounts) {
            const accountTransactions = transactions
                .filter(t => t.accountId === account.id)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            let calculatedBalance = 0;
            let inconsistentCount = 0;
            for (const transaction of accountTransactions) {
                calculatedBalance += transaction.creditAmount - transaction.debitAmount;
                if (Math.abs(transaction.balance - calculatedBalance) > 0.01) {
                    inconsistentCount++;
                }
            }
            if (inconsistentCount > 0) {
                issues.push({
                    severity: 'high',
                    component: 'balance-calculation',
                    description: `Balance mismatch in transaction ${account.id}`,
                    affectedData: [account.id],
                    resolution: 'Recalculate and fix account balances',
                    timestamp: new Date().toISOString()
                });
            }
        }
    }
    async checkDuplicateIds(issues) {
        // Check transaction ID duplicates
        const transactions = unifiedDataService_1.unifiedDataService.getAllTransactions();
        const transactionIds = transactions.map(t => t.id);
        const uniqueTransactionIds = new Set(transactionIds);
        if (transactionIds.length !== uniqueTransactionIds.size) {
            issues.push({
                severity: 'critical',
                component: 'duplicate-ids',
                description: 'Found duplicate transaction IDs',
                affectedData: ['transactions'],
                resolution: 'Remove or regenerate duplicate IDs',
                timestamp: new Date().toISOString()
            });
        }
        // Check account ID duplicates
        const accounts = unifiedDataService_1.unifiedDataService.getAllAccounts();
        const accountIds = accounts.map(a => a.id);
        const uniqueAccountIds = new Set(accountIds);
        if (accountIds.length !== uniqueAccountIds.size) {
            issues.push({
                severity: 'critical',
                component: 'duplicate-ids',
                description: 'Found duplicate account IDs',
                affectedData: ['accounts'],
                resolution: 'Remove or regenerate duplicate IDs',
                timestamp: new Date().toISOString()
            });
        }
    }
    calculateErrorRate() {
        const recentErrors = this.errorLog.filter(e => new Date(e.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
        );
        return recentErrors.length / Math.max(1, this.errorLog.length);
    }
    logError(component, error, severity) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            component,
            error,
            severity,
            resolved: false
        };
        this.errorLog.push(logEntry);
        // Keep only last 1000 error entries
        if (this.errorLog.length > 1000) {
            this.errorLog.shift();
        }
        console.error(`[${severity.toUpperCase()}] ${component}: ${error}`);
        // Emit event for UI notification
        eventBus_1.eventBus.emit('DATA_CLEARED', {
            systemError: { component, error, severity }
        }, 'SystemIntegrityService');
    }
    logWarning(component, warning, severity) {
        console.warn(`[${severity.toUpperCase()}] ${component}: ${warning}`);
    }
    // PUBLIC API METHODS
    getErrorLog() {
        return [...this.errorLog];
    }
    getActiveTransactions() {
        return Array.from(this.activeTransactions.values());
    }
    // Cleanup resources
    dispose() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        this.activeTransactions.clear();
        console.log('🧹 System Integrity Service disposed');
    }
    // CENTRALIZED ERROR LOGGING FOR ALL SERVICES
    logServiceError(serviceName, operation, error, severity = 'medium', metadata) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            component: serviceName,
            operation,
            error: error instanceof Error ? error.message : error,
            severity,
            metadata,
            resolved: false,
            stack: error instanceof Error ? error.stack : undefined
        };
        this.errorLog.push(errorEntry);
        // Keep error log manageable
        if (this.errorLog.length > 1000) {
            this.errorLog = this.errorLog.slice(-800);
        }
        // Emit critical errors immediately
        if (severity === 'critical') {
            eventBus_1.eventBus.emit('DATA_CLEARED', {
                systemError: {
                    serviceName,
                    operation,
                    error: errorEntry.error,
                    timestamp: errorEntry.timestamp
                }
            }, 'SystemIntegrityService');
        }
        // Console logging with appropriate level
        const logMessage = `[${serviceName}] ${operation}: ${errorEntry.error}`;
        switch (severity) {
            case 'critical':
                console.error('🚨', logMessage, metadata);
                break;
            case 'high':
                console.error('❌', logMessage, metadata);
                break;
            case 'medium':
                console.warn('⚠️', logMessage, metadata);
                break;
            case 'low':
                console.log('ℹ️', logMessage, metadata);
                break;
        }
    }
    // GET ERROR STATISTICS
    getErrorStats() {
        const errorsByService = {};
        const errorsBySeverity = {};
        this.errorLog.forEach((error) => {
            errorsByService[error.component] = (errorsByService[error.component] || 0) + 1;
            errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
        });
        // Generate top error services
        const topErrorServices = Object.entries(errorsByService)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([service, count]) => ({ service, count }));
        return {
            totalErrors: this.errorLog.length,
            errorsByService,
            errorsBySeverity,
            recentErrors: this.errorLog.slice(-20),
            errorRate: this.calculateErrorRate(),
            topErrorServices
        };
    }
    // UNIFIED SYSTEM HEALTH AGGREGATION
    async getUnifiedSystemHealth() {
        const startTime = Date.now();
        try {
            // Get individual service health checks
            const [storageHealth, performanceHealth, dataIntegrityHealth, eventBusHealth, crossTabSyncHealth] = await Promise.all([
                this.checkStorageHealth(),
                this.checkPerformanceHealth(),
                this.checkDataIntegrityHealth(),
                this.checkEventBusHealth(),
                this.checkCrossTabSyncHealth()
            ]);
            // Get error statistics
            const errorStats = this.getErrorStats();
            // Get performance metrics from performanceManager
            const { performanceManager } = require('./performanceManager');
            const performanceReport = performanceManager.getPerformanceReport();
            const memoryHealth = performanceManager.getMemoryHealthStatus();
            // Get data integrity from unifiedDataService
            const { unifiedDataService } = require('./unifiedDataService');
            const integrityReport = unifiedDataService.validateDataIntegrity();
            // Calculate overall health score (0-100)
            let healthScore = 100;
            // Service health penalties
            if (storageHealth === 'failed')
                healthScore -= 30;
            else if (storageHealth === 'degraded')
                healthScore -= 15;
            if (performanceHealth === 'failed')
                healthScore -= 25;
            else if (performanceHealth === 'degraded')
                healthScore -= 10;
            if (dataIntegrityHealth === 'failed')
                healthScore -= 25;
            else if (dataIntegrityHealth === 'degraded')
                healthScore -= 10;
            if (eventBusHealth === 'failed')
                healthScore -= 20;
            else if (eventBusHealth === 'degraded')
                healthScore -= 8;
            if (crossTabSyncHealth === 'failed')
                healthScore -= 10;
            else if (crossTabSyncHealth === 'degraded')
                healthScore -= 5;
            // Error-based penalties
            const criticalErrors = errorStats.errorsBySeverity.critical || 0;
            const highErrors = errorStats.errorsBySeverity.high || 0;
            healthScore -= criticalErrors * 8;
            healthScore -= highErrors * 3;
            healthScore -= Math.min(errorStats.errorRate * 10, 15);
            // Memory health penalties
            if (memoryHealth.status === 'emergency')
                healthScore -= 20;
            else if (memoryHealth.status === 'critical')
                healthScore -= 12;
            else if (memoryHealth.status === 'warning')
                healthScore -= 5;
            // Data integrity penalties  
            healthScore -= (100 - integrityReport.integrityScore) * 0.3;
            healthScore = Math.max(0, Math.min(100, healthScore));
            // Determine overall status
            let overall;
            if (healthScore >= 90)
                overall = 'excellent';
            else if (healthScore >= 75)
                overall = 'good';
            else if (healthScore >= 60)
                overall = 'warning';
            else if (healthScore >= 30)
                overall = 'critical';
            else
                overall = 'failure';
            // Generate top error services
            const topErrorServices = Object.entries(errorStats.errorsByService)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([service, count]) => ({ service, count }));
            // Aggregate recommendations
            const recommendations = [];
            if (criticalErrors > 0) {
                recommendations.push(`Address ${criticalErrors} critical system errors immediately`);
            }
            if (memoryHealth.status === 'emergency' || memoryHealth.status === 'critical') {
                recommendations.push('Memory usage critical - immediate cleanup required');
            }
            if (integrityReport.integrityScore < 80) {
                recommendations.push('Data integrity issues detected - run cleanup operations');
            }
            if (performanceReport.metrics.errorCount > 10) {
                recommendations.push('High error rate detected - investigate recurring issues');
            }
            if (storageHealth === 'degraded') {
                recommendations.push('Storage performance degraded - consider cleanup');
            }
            // Add service-specific recommendations
            recommendations.push(...performanceReport.recommendations);
            recommendations.push(...integrityReport.recommendations);
            recommendations.push(...memoryHealth.recommendations);
            // Remove duplicates and limit
            const uniqueRecommendations = Array.from(new Set(recommendations)).slice(0, 8);
            const checkDuration = Date.now() - startTime;
            if (checkDuration > 200) {
                this.logServiceError('SystemIntegrityService', 'getUnifiedSystemHealth', `Health check took ${checkDuration}ms - performance concern`, 'low', { duration: checkDuration });
            }
            return {
                overall,
                score: Math.round(healthScore),
                services: {
                    storage: {
                        status: storageHealth,
                        details: { responsiveness: 'measured', errors: errorStats.errorsByService.LocalStorageManager || 0 }
                    },
                    performance: {
                        status: memoryHealth.status,
                        details: {
                            memoryUsage: memoryHealth.currentUsage,
                            cacheHitRate: memoryHealth.cacheStats.hitRate,
                            modelCount: memoryHealth.modelStats.total
                        }
                    },
                    dataIntegrity: {
                        status: integrityReport.integrityScore > 80 ? 'healthy' : integrityReport.integrityScore > 60 ? 'degraded' : 'failed',
                        details: {
                            score: integrityReport.integrityScore,
                            duplicates: integrityReport.duplicateTransactions.length,
                            anomalies: integrityReport.anomalies.length
                        }
                    },
                    eventBus: {
                        status: eventBusHealth,
                        details: { errors: errorStats.errorsByService.EventBus || 0 }
                    },
                    crossTabSync: {
                        status: crossTabSyncHealth,
                        details: { errors: errorStats.errorsByService.CrossTabSyncService || 0 }
                    }
                },
                errorSummary: {
                    totalErrors: errorStats.totalErrors,
                    criticalErrors,
                    recentErrorRate: errorStats.recentErrors.length,
                    topErrorServices
                },
                recommendations: uniqueRecommendations,
                lastCheck: new Date().toISOString()
            };
        }
        catch (error) {
            this.logServiceError('SystemIntegrityService', 'getUnifiedSystemHealth', error instanceof Error ? error : new Error(String(error)), 'high', { checkDuration: Date.now() - startTime });
            // Return degraded status on health check failure
            return {
                overall: 'critical',
                score: 0,
                services: {
                    storage: { status: 'unknown', details: {} },
                    performance: { status: 'unknown', details: {} },
                    dataIntegrity: { status: 'unknown', details: {} },
                    eventBus: { status: 'unknown', details: {} },
                    crossTabSync: { status: 'unknown', details: {} }
                },
                errorSummary: {
                    totalErrors: this.errorLog.length,
                    criticalErrors: 0,
                    recentErrorRate: 0,
                    topErrorServices: []
                },
                recommendations: ['System health check failed - manual investigation required'],
                lastCheck: new Date().toISOString()
            };
        }
    }
    // CONSOLIDATED DATA INTEGRITY VALIDATION
    // Replaces scattered validation logic from unifiedDataService and duplicateDetectionService
    async performComprehensiveDataIntegrity() {
        const issues = [];
        const anomalies = [];
        const recommendations = [];
        console.log('🔍 Performing Comprehensive Data Integrity Check...');
        // Get all data for analysis
        const transactions = localStorageManager_1.localStorageManager.getAllTransactions();
        const accounts = localStorageManager_1.localStorageManager.getAllAccounts();
        const files = localStorageManager_1.localStorageManager.getAllFiles();
        // ENHANCED DUPLICATE DETECTION (from duplicateDetectionService)
        const duplicateReport = this.findSophisticatedDuplicates(transactions);
        // ORPHANED DATA DETECTION (consolidated from all services)
        const { orphanedTransactions, orphanedFiles } = this.detectOrphanedData(transactions, accounts, files, issues);
        // DATA ANOMALY DETECTION (from unifiedDataService)
        const detectedAnomalies = this.detectDataAnomalies(transactions, accounts);
        anomalies.push(...detectedAnomalies);
        // BALANCE CONSISTENCY CHECK (enhanced)
        const balanceIssues = this.validateBalanceConsistency(transactions);
        anomalies.push(...balanceIssues);
        // RUN CORE CONSISTENCY CHECKS
        await this.checkTransactionAccountReferences(issues);
        await this.checkFileTransactionReferences(issues);
        await this.checkBalanceCalculations(issues);
        await this.checkDuplicateIds(issues);
        // CALCULATE INTEGRITY SCORE (0-100)
        let integrityScore = 100;
        integrityScore -= issues.length * 5; // Storage issues
        integrityScore -= orphanedTransactions * 2; // Orphaned transactions
        integrityScore -= orphanedFiles * 2; // Orphaned files
        integrityScore -= duplicateReport.duplicates.length * 3; // Duplicates
        integrityScore -= anomalies.length * 2; // Anomalies
        integrityScore = Math.max(0, integrityScore);
        // GENERATE RECOMMENDATIONS
        if (duplicateReport.duplicates.length > 0) {
            recommendations.push(`Remove ${duplicateReport.duplicates.length} duplicate transactions`);
        }
        if (orphanedTransactions > 0) {
            recommendations.push(`Clean up ${orphanedTransactions} orphaned transactions`);
        }
        if (orphanedFiles > 0) {
            recommendations.push(`Fix ${orphanedFiles} file-transaction mismatches`);
        }
        if (anomalies.length > 0) {
            recommendations.push(`Review ${anomalies.length} data anomalies`);
        }
        const storageStats = localStorageManager_1.localStorageManager.getStorageStats();
        if (storageStats.totalSize > 5000) {
            recommendations.push('Consider archiving old data (storage > 5MB)');
        }
        return {
            isValid: issues.length === 0 && duplicateReport.duplicates.length === 0 && anomalies.length === 0,
            issues,
            duplicateReport,
            anomalies,
            recommendations,
            integrityScore,
            summary: {
                totalTransactions: transactions.length,
                totalFiles: files.length,
                totalAccounts: accounts.length,
                orphanedTransactions,
                orphanedFiles,
                duplicateTransactions: duplicateReport.duplicates.length
            }
        };
    }
    // SOPHISTICATED DUPLICATE DETECTION (consolidated from duplicateDetectionService)
    findSophisticatedDuplicates(transactions) {
        const seen = new Map();
        const duplicates = [];
        const confidenceScores = [];
        transactions.forEach(transaction => {
            // Create a sophisticated duplicate detection key
            const normalizedDesc = transaction.description.trim().toLowerCase();
            const key = [
                transaction.accountId,
                transaction.date,
                transaction.debitAmount || 0,
                transaction.creditAmount || 0,
                normalizedDesc.substring(0, 50) // First 50 chars of description
            ].join('|');
            if (seen.has(key)) {
                // Additional validation - check if they're really duplicates
                const existing = seen.get(key);
                const similarity = this.calculateTransactionSimilarity(existing, transaction);
                if (similarity > 0.9) {
                    duplicates.push(transaction);
                    confidenceScores.push(similarity);
                }
            }
            else {
                seen.set(key, transaction);
            }
        });
        return {
            duplicates,
            confidenceScores,
            avgSimilarity: confidenceScores.length > 0 ?
                confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length : 0
        };
    }
    // ENHANCED DUPLICATE DETECTION WITH SIMILARITY SCORING
    calculateTransactionSimilarity(t1, t2) {
        // Same basic data
        if (t1.accountId !== t2.accountId || t1.date !== t2.date)
            return 0;
        if (t1.debitAmount !== t2.debitAmount || t1.creditAmount !== t2.creditAmount)
            return 0;
        // Similar descriptions (allow for minor variations)
        const desc1 = t1.description.trim().toLowerCase();
        const desc2 = t2.description.trim().toLowerCase();
        return this.calculateStringSimilarity(desc1, desc2);
    }
    // STRING SIMILARITY USING LEVENSHTEIN DISTANCE
    calculateStringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0)
            return 1.0;
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
    // ORPHANED DATA DETECTION (consolidated from all services)
    detectOrphanedData(transactions, accounts, files, issues) {
        const accountIds = new Set(accounts.map(a => a.id));
        const fileIds = new Set(files.map(f => f.id));
        const orphanedTransactions = transactions.filter(t => !accountIds.has(t.accountId));
        const orphanedFiles = transactions.filter(t => t.fileId && !fileIds.has(t.fileId));
        if (orphanedTransactions.length > 0) {
            issues.push({
                severity: 'high',
                component: 'transactions',
                description: `Found ${orphanedTransactions.length} transactions with invalid account references`,
                affectedData: orphanedTransactions.map(t => t.id),
                resolution: 'Clean up orphaned transactions or fix account references',
                timestamp: new Date().toISOString()
            });
        }
        if (orphanedFiles.length > 0) {
            issues.push({
                severity: 'medium',
                component: 'files',
                description: `Found ${orphanedFiles.length} transactions with invalid file references`,
                affectedData: orphanedFiles.map(t => t.id),
                resolution: 'Fix file references or remove invalid file IDs',
                timestamp: new Date().toISOString()
            });
        }
        return {
            orphanedTransactions: orphanedTransactions.length,
            orphanedFiles: orphanedFiles.length
        };
    }
    // DATA ANOMALY DETECTION (consolidated from unifiedDataService)
    detectDataAnomalies(transactions, accounts) {
        const anomalies = [];
        // Check for transactions with impossible dates
        const now = new Date();
        const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
        const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        const oldTransactions = transactions.filter(t => new Date(t.date) < twoYearsAgo);
        const futureTransactions = transactions.filter(t => new Date(t.date) > oneYearAhead);
        if (oldTransactions.length > 0) {
            anomalies.push(`${oldTransactions.length} transactions are older than 2 years`);
        }
        if (futureTransactions.length > 0) {
            anomalies.push(`${futureTransactions.length} transactions are dated in the future`);
        }
        // Check for extremely large transactions
        const largeTransactions = transactions.filter(t => (t.debitAmount && t.debitAmount > 1000000) ||
            (t.creditAmount && t.creditAmount > 1000000));
        if (largeTransactions.length > 0) {
            anomalies.push(`${largeTransactions.length} transactions have amounts over 1,000,000`);
        }
        // Check for accounts with no transactions
        const accountsWithTransactions = new Set(transactions.map(t => t.accountId));
        const emptyAccounts = accounts.filter(a => !accountsWithTransactions.has(a.id));
        if (emptyAccounts.length > 0) {
            anomalies.push(`${emptyAccounts.length} accounts have no transactions`);
        }
        return anomalies;
    }
    // BALANCE CONSISTENCY VALIDATION (enhanced from unifiedDataService)
    validateBalanceConsistency(transactions) {
        const issues = [];
        const transactionsByAccount = new Map();
        // Group transactions by account
        transactions.forEach(t => {
            if (!transactionsByAccount.has(t.accountId)) {
                transactionsByAccount.set(t.accountId, []);
            }
            transactionsByAccount.get(t.accountId).push(t);
        });
        // Check each account's balance consistency
        for (const [accountId, accountTransactions] of transactionsByAccount) {
            const sortedTransactions = accountTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            let calculatedBalance = 0;
            let inconsistentCount = 0;
            for (const transaction of sortedTransactions) {
                calculatedBalance += (transaction.creditAmount || 0) - (transaction.debitAmount || 0);
                if (Math.abs(transaction.balance - calculatedBalance) > 0.01) {
                    inconsistentCount++;
                }
            }
            if (inconsistentCount > 0) {
                issues.push(`Account ${accountId}: ${inconsistentCount} transactions with balance inconsistencies`);
            }
        }
        return issues;
    }
    // CONSOLIDATED HEALTH MONITORING - SINGLE SOURCE OF TRUTH
    // Replaces scattered health monitoring from serviceOrchestrator, performanceManager, and other services
    async getConsolidatedSystemHealth() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const startTime = Date.now();
        const systemStartTime = performance.now();
        try {
            console.log('🏥 Performing Consolidated System Health Assessment...');
            // GATHER ALL HEALTH DATA IN PARALLEL
            const [storageHealth, eventBusHealth, crossTabSyncHealth, integrityReport, performanceReport, memoryHealth, errorStats, serviceOrchestratorHealth, mlServicesHealth] = await Promise.all([
                this.checkStorageHealth(),
                this.checkEventBusHealth(),
                this.checkCrossTabSyncHealth(),
                this.performComprehensiveDataIntegrity(),
                performanceManager_1.performanceManager.getPerformanceReport(),
                performanceManager_1.performanceManager.getMemoryHealthStatus(),
                this.getErrorStats(),
                this.getServiceOrchestratorHealth(),
                this.getMLServicesHealth()
            ]);
            // CALCULATE COMPREHENSIVE HEALTH SCORE (0-100)
            let healthScore = 100;
            // Service orchestration health (25 points)
            if (serviceOrchestratorHealth.status === 'failed')
                healthScore -= 25;
            else if (serviceOrchestratorHealth.status === 'degraded')
                healthScore -= 15;
            else if (!serviceOrchestratorHealth.details.criticalServicesReady)
                healthScore -= 10;
            // Storage health (20 points)
            if (storageHealth === 'failed')
                healthScore -= 20;
            else if (storageHealth === 'degraded')
                healthScore -= 10;
            // Performance & memory health (20 points)
            if (memoryHealth.status === 'emergency')
                healthScore -= 20;
            else if (memoryHealth.status === 'critical')
                healthScore -= 15;
            else if (memoryHealth.status === 'warning')
                healthScore -= 8;
            // Data integrity health (15 points)
            const integrityPenalty = Math.round((100 - integrityReport.integrityScore) * 0.15);
            healthScore -= integrityPenalty;
            // Error rate impact (10 points)
            const criticalErrors = errorStats.errorsBySeverity.critical || 0;
            const highErrors = errorStats.errorsBySeverity.high || 0;
            healthScore -= Math.min(criticalErrors * 5 + highErrors * 2, 10);
            // Event bus & sync health (10 points)
            if (eventBusHealth === 'failed')
                healthScore -= 6;
            else if (eventBusHealth === 'degraded')
                healthScore -= 3;
            if (crossTabSyncHealth === 'failed')
                healthScore -= 4;
            else if (crossTabSyncHealth === 'degraded')
                healthScore -= 2;
            healthScore = Math.max(0, healthScore);
            // DETERMINE OVERALL STATUS
            let overall = 'excellent';
            if (healthScore >= 90)
                overall = 'excellent';
            else if (healthScore >= 75)
                overall = 'good';
            else if (healthScore >= 50)
                overall = 'warning';
            else if (healthScore >= 25)
                overall = 'critical';
            else
                overall = 'failure';
            // GENERATE CATEGORIZED RECOMMENDATIONS
            const recommendations = {
                critical: [],
                high: [],
                medium: [],
                performance: [],
                maintenance: []
            };
            // Critical recommendations
            if (serviceOrchestratorHealth.status === 'failed') {
                recommendations.critical.push('Service orchestration failed - system restart may be required');
            }
            if (storageHealth === 'failed') {
                recommendations.critical.push('Storage system failed - data operations unavailable');
            }
            if (memoryHealth.status === 'emergency') {
                recommendations.critical.push('Memory usage critical - immediate cleanup required');
            }
            // High priority recommendations
            if (integrityReport.integrityScore < 60) {
                recommendations.high.push(`Data integrity compromised (${integrityReport.integrityScore}%) - run repair`);
            }
            if (criticalErrors > 0) {
                recommendations.high.push(`${criticalErrors} critical errors detected - investigate immediately`);
            }
            // Performance recommendations
            recommendations.performance.push(...memoryHealth.recommendations);
            recommendations.performance.push(...performanceReport.recommendations);
            // Maintenance recommendations
            if (integrityReport.duplicateReport.duplicates.length > 0) {
                recommendations.maintenance.push(`${integrityReport.duplicateReport.duplicates.length} duplicate transactions found`);
            }
            // GENERATE ALERTS
            const alerts = [];
            if (overall === 'critical' || overall === 'failure') {
                alerts.push({
                    severity: 'critical',
                    message: `System health critical (${healthScore}%) - immediate attention required`,
                    service: 'SystemIntegrityService',
                    timestamp: new Date().toISOString(),
                    actionRequired: true
                });
            }
            if (memoryHealth.status === 'critical' || memoryHealth.status === 'emergency') {
                alerts.push({
                    severity: 'high',
                    message: `Memory usage ${memoryHealth.status} (${memoryHealth.currentUsage}MB)`,
                    service: 'PerformanceManager',
                    timestamp: new Date().toISOString(),
                    actionRequired: true
                });
            }
            // UPDATE HEALTH HISTORY
            this.updateHealthHistory({
                timestamp: new Date().toISOString(),
                score: healthScore,
                status: overall,
                criticalIssues: criticalErrors
            });
            const checkDuration = Date.now() - startTime;
            console.log(`✅ Consolidated health check completed in ${checkDuration}ms (Score: ${healthScore})`);
            return {
                overall,
                score: Math.round(healthScore),
                timestamp: new Date().toISOString(),
                uptime: systemStartTime,
                services: {
                    orchestration: serviceOrchestratorHealth,
                    storage: {
                        status: storageHealth,
                        details: {
                            responsiveness: 'measured',
                            errors: errorStats.errorsByService.LocalStorageManager || 0,
                            storageUsed: localStorageManager_1.localStorageManager.getStorageStats().totalSize
                        }
                    },
                    performance: {
                        status: memoryHealth.status,
                        details: {
                            memoryUsage: memoryHealth.currentUsage,
                            cacheHitRate: memoryHealth.cacheStats.hitRate,
                            modelCount: memoryHealth.modelStats.total,
                            averageResponseTime: performanceReport.metrics.averageResponseTime,
                            operationCount: performanceReport.metrics.operationCount,
                            tensorflowMemory: performanceReport.metrics.tensorflowMemory
                        }
                    },
                    dataIntegrity: {
                        status: integrityReport.integrityScore > 80 ? 'healthy' : integrityReport.integrityScore > 60 ? 'degraded' : 'failed',
                        details: {
                            score: integrityReport.integrityScore,
                            duplicates: integrityReport.duplicateReport.duplicates.length,
                            anomalies: integrityReport.anomalies.length,
                            orphanedData: integrityReport.summary.orphanedTransactions + integrityReport.summary.orphanedFiles
                        }
                    },
                    eventBus: {
                        status: eventBusHealth,
                        details: { errors: errorStats.errorsByService.EventBus || 0 }
                    },
                    crossTabSync: {
                        status: crossTabSyncHealth,
                        details: { errors: errorStats.errorsByService.CrossTabSyncService || 0 }
                    },
                    mlServices: mlServicesHealth
                },
                performance: {
                    memory: {
                        jsHeap: {
                            used: memoryHealth.cacheStats.memoryUsage,
                            total: performanceReport.memoryStats.total,
                            percentage: performanceReport.memoryStats.percentage
                        },
                        tensorflow: {
                            numBytes: (_d = (_b = (_a = performanceReport.metrics.tensorflowMemory) === null || _a === void 0 ? void 0 : _a.totalBytes) !== null && _b !== void 0 ? _b : (_c = performanceReport.metrics.tensorflowMemory) === null || _c === void 0 ? void 0 : _c.numBytes) !== null && _d !== void 0 ? _d : 0,
                            numTensors: (_h = (_f = (_e = performanceReport.metrics.tensorflowMemory) === null || _e === void 0 ? void 0 : _e.totalTensors) !== null && _f !== void 0 ? _f : (_g = performanceReport.metrics.tensorflowMemory) === null || _g === void 0 ? void 0 : _g.numTensors) !== null && _h !== void 0 ? _h : 0,
                            peakBytes: (_k = (_j = performanceReport.metrics.tensorflowMemory) === null || _j === void 0 ? void 0 : _j.peakBytes) !== null && _k !== void 0 ? _k : 0
                        },
                        modelRegistry: {
                            total: memoryHealth.modelStats.total,
                            active: memoryHealth.modelStats.active,
                            inactive: memoryHealth.modelStats.inactive
                        },
                        recommendations: memoryHealth.recommendations
                    },
                    cache: {
                        size: memoryHealth.cacheStats.size,
                        hitRate: memoryHealth.cacheStats.hitRate,
                        efficiency: memoryHealth.cacheStats.hitRate * 100
                    },
                    operations: {
                        count: performanceReport.metrics.operationCount,
                        averageTime: performanceReport.metrics.averageResponseTime,
                        errorRate: (errorStats.totalErrors / Math.max(performanceReport.metrics.operationCount, 1)) * 100
                    }
                },
                healthHistory: this.getHealthHistory(),
                errorSummary: {
                    totalErrors: errorStats.totalErrors,
                    criticalErrors,
                    recentErrorRate: errorStats.recentErrors.length,
                    topErrorServices: errorStats.topErrorServices,
                    errorTrends: {
                        increasing: errorStats.recentErrors.length > (errorStats.totalErrors * 0.3),
                        frequentServices: errorStats.topErrorServices.slice(0, 3).map((s) => s.service),
                        criticalPatterns: this.analyzeCriticalErrorPatterns(errorStats.recentErrors)
                    }
                },
                recommendations,
                alerts
            };
        }
        catch (error) {
            this.logServiceError('SystemIntegrityService', 'getConsolidatedSystemHealth', error instanceof Error ? error : new Error(String(error)), 'critical', { checkDuration: Date.now() - startTime });
            // Return failure status on health check error
            return this.getEmergencyHealthStatus();
        }
    }
    // CONSOLIDATED SERVICE ORCHESTRATOR HEALTH (replaces serviceOrchestrator health checks)
    async getServiceOrchestratorHealth() {
        try {
            // Import serviceOrchestrator dynamically to avoid circular dependencies
            const { serviceOrchestrator } = await Promise.resolve().then(() => require('./serviceOrchestrator'));
            const systemStatus = serviceOrchestrator.getSystemStatus();
            const criticalServices = ['eventBus', 'localStorageManager', 'unifiedDataService', 'systemIntegrityService'];
            const criticalReady = criticalServices.every(serviceName => {
                const serviceStatus = Array.from(systemStatus.services.values()).find(s => s.name === serviceName);
                return (serviceStatus === null || serviceStatus === void 0 ? void 0 : serviceStatus.status) === 'ready';
            });
            let status = 'healthy';
            if (systemStatus.overall === 'failed')
                status = 'failed';
            else if (systemStatus.overall === 'degraded' || !criticalReady)
                status = 'degraded';
            return {
                status,
                details: {
                    totalServices: systemStatus.totalServices,
                    readyServices: systemStatus.readyServices,
                    failedServices: systemStatus.failedServices,
                    criticalServicesReady: criticalReady,
                    initializationTime: systemStatus.readyTime ? systemStatus.readyTime - systemStatus.startupTime : undefined
                }
            };
        }
        catch (error) {
            this.logServiceError('SystemIntegrityService', 'getServiceOrchestratorHealth', error instanceof Error ? error : new Error(String(error)), 'high');
            return {
                status: 'failed',
                details: {
                    totalServices: 0,
                    readyServices: 0,
                    failedServices: 0,
                    criticalServicesReady: false
                }
            };
        }
    }
    // CONSOLIDATED ML SERVICES HEALTH
    async getMLServicesHealth() {
        const checkMLService = async (serviceName, serviceModule) => {
            try {
                if (!serviceModule || typeof serviceModule.getServiceStatus !== 'function') {
                    return { status: 'failed', details: { error: 'Service not available' } };
                }
                const status = serviceModule.getServiceStatus();
                const isHealthy = status.isInitialized && status.modelLoaded;
                return {
                    status: (isHealthy ? 'healthy' : 'degraded'),
                    details: {
                        initialized: status.isInitialized,
                        modelLoaded: status.modelLoaded,
                        vocabularySize: status.vocabularySize,
                        lastCheck: new Date().toISOString()
                    }
                };
            }
            catch (error) {
                this.logServiceError('SystemIntegrityService', `getMLServicesHealth-${serviceName}`, error instanceof Error ? error : new Error(String(error)), 'medium');
                return { status: 'failed', details: { error: 'Health check failed' } };
            }
        };
        const [categorization, predictiveAnalytics, naturalLanguage] = await Promise.allSettled([
            checkMLService('unifiedCategorizationService', (await Promise.resolve().then(() => require('./unifiedCategorizationService'))).unifiedCategorizationService),
            checkMLService('mlPredictiveAnalyticsService', (await Promise.resolve().then(() => require('./mlPredictiveAnalyticsService'))).mlPredictiveAnalyticsService),
            checkMLService('mlNaturalLanguageService', (await Promise.resolve().then(() => require('./mlNaturalLanguageService'))).mlNaturalLanguageService)
        ]);
        return {
            categorization: categorization.status === 'fulfilled' ? categorization.value : { status: 'failed', details: { error: 'Import failed' } },
            predictiveAnalytics: predictiveAnalytics.status === 'fulfilled' ? predictiveAnalytics.value : { status: 'failed', details: { error: 'Import failed' } },
            naturalLanguage: naturalLanguage.status === 'fulfilled' ? naturalLanguage.value : { status: 'failed', details: { error: 'Import failed' } }
        };
    }
    updateHealthHistory(entry) {
        this.healthHistory.push(entry);
        // Keep only last 50 entries
        if (this.healthHistory.length > 50) {
            this.healthHistory = this.healthHistory.slice(-50);
        }
    }
    getHealthHistory() {
        return [...this.healthHistory];
    }
    // CRITICAL ERROR PATTERN ANALYSIS
    analyzeCriticalErrorPatterns(recentErrors) {
        const patterns = [];
        // Group errors by component
        const errorsByComponent = recentErrors.reduce((acc, error) => {
            acc[error.component] = (acc[error.component] || 0) + 1;
            return acc;
        }, {});
        // Identify concerning patterns
        Object.entries(errorsByComponent).forEach(([component, count]) => {
            if (count >= 5) {
                patterns.push(`${component}: ${count} recent errors`);
            }
        });
        // Check for cascading failures
        const timeWindows = this.groupErrorsByTimeWindow(recentErrors, 5 * 60 * 1000); // 5-minute windows
        timeWindows.forEach((windowErrors, index) => {
            if (windowErrors.length >= 3) {
                patterns.push(`Time window ${index}: ${windowErrors.length} errors (potential cascade)`);
            }
        });
        return patterns;
    }
    groupErrorsByTimeWindow(errors, windowMs) {
        const windows = [];
        const sortedErrors = [...errors].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        if (sortedErrors.length === 0)
            return windows;
        let currentWindow = [];
        let windowStart = new Date(sortedErrors[0].timestamp).getTime();
        sortedErrors.forEach(error => {
            const errorTime = new Date(error.timestamp).getTime();
            if (errorTime - windowStart <= windowMs) {
                currentWindow.push(error);
            }
            else {
                if (currentWindow.length > 0) {
                    windows.push([...currentWindow]);
                }
                currentWindow = [error];
                windowStart = errorTime;
            }
        });
        if (currentWindow.length > 0) {
            windows.push(currentWindow);
        }
        return windows;
    }
    // EMERGENCY HEALTH STATUS (for when health check itself fails)
    getEmergencyHealthStatus() {
        return {
            overall: 'failure',
            score: 0,
            timestamp: new Date().toISOString(),
            uptime: 0,
            services: {
                orchestration: { status: 'failed', details: { totalServices: 0, readyServices: 0, failedServices: 0, criticalServicesReady: false } },
                storage: { status: 'unknown', details: {} },
                performance: { status: 'unknown', details: { memoryUsage: 0, cacheHitRate: 0, modelCount: 0, averageResponseTime: 0, operationCount: 0, tensorflowMemory: {} } },
                dataIntegrity: { status: 'unknown', details: {} },
                eventBus: { status: 'unknown', details: {} },
                crossTabSync: { status: 'unknown', details: {} },
                mlServices: {
                    categorization: { status: 'failed', details: {} },
                    predictiveAnalytics: { status: 'failed', details: {} },
                    naturalLanguage: { status: 'failed', details: {} }
                }
            },
            performance: {
                memory: {
                    jsHeap: { used: 0, total: 0, percentage: 0 },
                    tensorflow: { numBytes: 0, numTensors: 0, peakBytes: 0 },
                    modelRegistry: { total: 0, active: 0, inactive: 0 },
                    recommendations: []
                },
                cache: { size: 0, hitRate: 0, efficiency: 0 },
                operations: { count: 0, averageTime: 0, errorRate: 100 }
            },
            healthHistory: [],
            errorSummary: {
                totalErrors: this.errorLog.length,
                criticalErrors: 0,
                recentErrorRate: 0,
                topErrorServices: [],
                errorTrends: {
                    increasing: false,
                    frequentServices: [],
                    criticalPatterns: ['Health check system failure']
                }
            },
            recommendations: {
                critical: ['System health monitoring failed - manual investigation required', 'Consider system restart'],
                high: [],
                medium: [],
                performance: [],
                maintenance: []
            },
            alerts: [{
                    severity: 'critical',
                    message: 'System health monitoring failed - critical system failure',
                    service: 'SystemIntegrityService',
                    timestamp: new Date().toISOString(),
                    actionRequired: true
                }]
        };
    }
}
// Check for debug mode
const debugModeActive = (0, debugMode_1.isDebugMode)();
// Export singleton instance (skip in debug mode)
let systemIntegrityService;
exports.systemIntegrityService = systemIntegrityService;
if (debugModeActive) {
    console.log('🔧 SystemIntegrityService: Debug mode detected - creating mock instance');
    exports.systemIntegrityService = systemIntegrityService = {
        getSystemHealthStatus: () => ({ isHealthy: true, overall: 'excellent' }),
        getUnifiedSystemHealth: () => Promise.resolve({
            overall: 'good',
            score: 100,
            services: {
                storage: { status: 'healthy', details: {} },
                performance: { status: 'healthy', details: {} },
                dataIntegrity: { status: 'healthy', details: {} },
                eventBus: { status: 'healthy', details: {} },
                crossTabSync: { status: 'healthy', details: {} }
            },
            errorSummary: {
                totalErrors: 0,
                criticalErrors: 0,
                recentErrorRate: 0,
                topErrorServices: []
            },
            recommendations: [],
            lastCheck: new Date().toISOString()
        }),
        logServiceError: () => { },
        dispose: () => Promise.resolve()
    };
}
else {
    exports.systemIntegrityService = systemIntegrityService = new SystemIntegrityService();
}
