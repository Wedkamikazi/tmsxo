"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crossTabSyncService = void 0;
const debugMode_1 = require("../utils/debugMode");
const eventBus_1 = require("./eventBus");
const unifiedDataService_1 = require("./unifiedDataService");
class CrossTabSyncService {
    constructor() {
        this.STORAGE_KEY = 'tms_cross_tab_sync';
        this.TAB_REGISTRY_KEY = 'tms_active_tabs';
        this.HEARTBEAT_INTERVAL = 5000; // 5 seconds
        this.TAB_TIMEOUT = 15000; // 15 seconds
        this.heartbeatInterval = null;
        this.storageListener = null;
        this.sequenceNumber = 0;
        this.activeTabs = new Map();
        this.pendingConflicts = new Map();
        this.currentTabId = this.generateTabId();
        this.syncStats = {
            activeTabs: 0,
            totalSyncMessages: 0,
            conflictsDetected: 0,
            conflictsResolved: 0,
            lastSyncTime: new Date().toISOString(),
            syncLatency: 0
        };
        this.initializeCrossTabSync();
    }
    // INITIALIZE CROSS-TAB SYNCHRONIZATION
    initializeCrossTabSync() {
        console.log(`🔄 Initializing Cross-Tab Sync Service (Tab: ${this.currentTabId})...`);
        // Register current tab
        this.registerCurrentTab();
        // Set up storage event listener for cross-tab communication
        this.setupStorageListener();
        // Start heartbeat mechanism
        this.startHeartbeat();
        // Set up cleanup on page unload
        this.setupUnloadHandlers();
        // Listen to local data events for broadcasting
        this.setupLocalEventListeners();
        // Clean up dead tabs
        this.cleanupInactiveTabs();
        console.log('✅ Cross-Tab Sync Service Initialized');
    }
    // REGISTER CURRENT TAB IN SHARED REGISTRY
    registerCurrentTab() {
        const tabInfo = {
            tabId: this.currentTabId,
            isActive: true,
            lastHeartbeat: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent.substring(0, 100)
        };
        this.activeTabs.set(this.currentTabId, tabInfo);
        this.updateTabRegistry();
        // Broadcast tab registration
        this.broadcastMessage({
            type: 'TAB_REGISTER',
            tabId: this.currentTabId,
            timestamp: new Date().toISOString(),
            sequenceNumber: this.getNextSequenceNumber(),
            payload: tabInfo
        });
        console.log(`📝 Registered tab: ${this.currentTabId}`);
    }
    // SET UP STORAGE EVENT LISTENER FOR CROSS-TAB COMMUNICATION
    setupStorageListener() {
        this.storageListener = (event) => {
            if (event.key === this.STORAGE_KEY && event.newValue) {
                this.handleIncomingSyncMessage(event.newValue);
            }
            else if (event.key === this.TAB_REGISTRY_KEY && event.newValue) {
                this.handleTabRegistryUpdate(event.newValue);
            }
        };
        window.addEventListener('storage', this.storageListener);
    }
    // HANDLE INCOMING SYNC MESSAGES FROM OTHER TABS
    handleIncomingSyncMessage(messageData) {
        try {
            const message = JSON.parse(messageData);
            // Ignore messages from current tab
            if (message.tabId === this.currentTabId) {
                return;
            }
            const startTime = Date.now();
            switch (message.type) {
                case 'DATA_SYNC':
                    this.handleDataSync(message);
                    break;
                case 'TAB_REGISTER':
                    this.handleTabRegister(message);
                    break;
                case 'TAB_HEARTBEAT':
                    this.handleTabHeartbeat(message);
                    break;
                case 'TAB_CLOSE':
                    this.handleTabClose(message);
                    break;
                case 'CONFLICT_RESOLUTION':
                    this.handleConflictResolution(message);
                    break;
            }
            // Update sync stats
            this.syncStats.totalSyncMessages++;
            this.syncStats.syncLatency = Date.now() - startTime;
            this.syncStats.lastSyncTime = new Date().toISOString();
        }
        catch (error) {
            console.error('❌ Error handling sync message:', error);
        }
    }
    // HANDLE DATA SYNCHRONIZATION FROM OTHER TABS
    handleDataSync(message) {
        const { payload } = message;
        if (!payload || !payload.eventType) {
            return;
        }
        console.log(`🔄 Syncing data from tab ${message.tabId}: ${payload.eventType}`);
        try {
            switch (payload.eventType) {
                case 'TRANSACTIONS_UPDATED':
                    this.syncTransactionUpdates(payload, message.tabId);
                    break;
                case 'ACCOUNT_UPDATED':
                    this.syncAccountUpdates(payload, message.tabId);
                    break;
                case 'FILE_UPLOADED':
                case 'FILE_DELETED':
                    this.syncFileUpdates(payload, message.tabId);
                    break;
                case 'DATA_CLEARED':
                    this.syncDataClearance(payload, message.tabId);
                    break;
            }
            // Emit local event to update UI
            eventBus_1.eventBus.emit(payload.eventType, {
                ...payload.data,
                fromCrossTab: true,
                sourceTabId: message.tabId
            }, 'CrossTabSyncService');
        }
        catch (error) {
            console.error(`❌ Error syncing ${payload.eventType}:`, error);
        }
    }
    // SYNC TRANSACTION UPDATES ACROSS TABS
    syncTransactionUpdates(payload, sourceTabId) {
        var _a;
        // Check for conflicts with local data
        const localTransactions = unifiedDataService_1.unifiedDataService.getAllTransactions();
        const incomingTransactions = ((_a = payload.data) === null || _a === void 0 ? void 0 : _a.transactions) || [];
        for (const incomingTx of incomingTransactions) {
            const existingTx = localTransactions.find(tx => tx.id === incomingTx.id);
            if (existingTx && this.hasDataConflict(existingTx, incomingTx)) {
                this.reportDataConflict('transaction', incomingTx.id, sourceTabId, existingTx, incomingTx);
            }
            else if (!existingTx) {
                // New transaction, add it locally
                unifiedDataService_1.unifiedDataService.addTransactions([incomingTx]);
            }
        }
    }
    // SYNC ACCOUNT UPDATES ACROSS TABS
    syncAccountUpdates(payload, sourceTabId) {
        const { accountId, action, accountData } = payload.data || {};
        if (!accountId)
            return;
        const localAccounts = unifiedDataService_1.unifiedDataService.getAllAccounts();
        const existingAccount = localAccounts.find(acc => acc.id === accountId);
        switch (action) {
            case 'created':
                if (!existingAccount && accountData) {
                    unifiedDataService_1.unifiedDataService.addAccount(accountData);
                }
                break;
            case 'updated':
                if (existingAccount && accountData) {
                    if (this.hasDataConflict(existingAccount, accountData)) {
                        this.reportDataConflict('account', accountId, sourceTabId, existingAccount, accountData);
                    }
                    else {
                        unifiedDataService_1.unifiedDataService.updateAccount(accountId, accountData);
                    }
                }
                break;
            case 'deleted':
                if (existingAccount) {
                    unifiedDataService_1.unifiedDataService.deleteAccount(accountId);
                }
                break;
        }
    }
    // SYNC FILE UPDATES ACROSS TABS
    syncFileUpdates(payload, _sourceTabId) {
        const { fileId, action, fileData } = payload.data || {};
        if (action === 'uploaded' && fileData) {
            const existingFiles = unifiedDataService_1.unifiedDataService.getAllFiles();
            if (!existingFiles.find(f => f.id === fileId)) {
                unifiedDataService_1.unifiedDataService.addFile(fileData);
            }
        }
        else if (action === 'deleted' && fileId) {
            unifiedDataService_1.unifiedDataService.deleteFile(fileId);
        }
    }
    // SYNC DATA CLEARANCE ACROSS TABS
    syncDataClearance(payload, _sourceTabId) {
        // Handle global data operations like cleanup, backup restore, etc.
        const { operation } = payload.data || {};
        if (operation === 'cleanup') {
            // Trigger local cleanup to stay consistent
            unifiedDataService_1.unifiedDataService.cleanupOrphanedData();
        }
        else if (operation === 'restore') {
            // Handle backup restore - may need full refresh
            window.location.reload();
        }
    }
    // DETECT DATA CONFLICTS BETWEEN TABS
    hasDataConflict(localData, incomingData) {
        // Simple conflict detection based on modification timestamps
        const localTimestamp = new Date(localData.modifiedDate || localData.lastUpdated || 0).getTime();
        const incomingTimestamp = new Date(incomingData.modifiedDate || incomingData.lastUpdated || 0).getTime();
        // Consider it a conflict if data differs and timestamps are close (within 1 second)
        const timeDiff = Math.abs(localTimestamp - incomingTimestamp);
        return timeDiff < 1000 && JSON.stringify(localData) !== JSON.stringify(incomingData);
    }
    // REPORT DATA CONFLICT FOR RESOLUTION
    reportDataConflict(type, itemId, sourceTabId, localData, incomingData) {
        const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const conflict = {
            conflictId,
            type,
            itemId,
            tabId1: this.currentTabId,
            tabId2: sourceTabId,
            data1: localData,
            data2: incomingData,
            timestamp: new Date().toISOString(),
            resolved: false
        };
        this.pendingConflicts.set(conflictId, conflict);
        this.syncStats.conflictsDetected++;
        console.warn(`⚠️ Data conflict detected for ${type} ${itemId} between tabs`);
        // For now, use "last writer wins" strategy
        // In production, you might want more sophisticated conflict resolution
        this.resolveConflictLastWriterWins(conflict);
    }
    // RESOLVE CONFLICT USING LAST WRITER WINS STRATEGY
    resolveConflictLastWriterWins(conflict) {
        try {
            const timestamp1 = new Date(conflict.data1.modifiedDate || conflict.data1.lastUpdated || 0);
            const timestamp2 = new Date(conflict.data2.modifiedDate || conflict.data2.lastUpdated || 0);
            const winningData = timestamp2 > timestamp1 ? conflict.data2 : conflict.data1;
            // Apply winning data
            switch (conflict.type) {
                case 'transaction':
                    // Update local transaction with winning data
                    break;
                case 'account':
                    unifiedDataService_1.unifiedDataService.updateAccount(conflict.itemId, winningData);
                    break;
                case 'file':
                    // Handle file conflict resolution
                    break;
            }
            conflict.resolved = true;
            this.syncStats.conflictsResolved++;
            console.log(`✅ Resolved conflict ${conflict.conflictId} using last writer wins`);
            // Broadcast resolution to other tabs
            this.broadcastMessage({
                type: 'CONFLICT_RESOLUTION',
                tabId: this.currentTabId,
                timestamp: new Date().toISOString(),
                sequenceNumber: this.getNextSequenceNumber(),
                payload: {
                    conflictId: conflict.conflictId,
                    resolution: 'last_writer_wins',
                    winningData
                }
            });
        }
        catch (error) {
            console.error(`❌ Error resolving conflict ${conflict.conflictId}:`, error);
        }
    }
    // START HEARTBEAT MECHANISM
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
            this.cleanupInactiveTabs();
        }, this.HEARTBEAT_INTERVAL);
    }
    // SEND HEARTBEAT TO OTHER TABS
    sendHeartbeat() {
        const tabInfo = this.activeTabs.get(this.currentTabId);
        if (tabInfo) {
            tabInfo.lastHeartbeat = new Date().toISOString();
            this.updateTabRegistry();
            this.broadcastMessage({
                type: 'TAB_HEARTBEAT',
                tabId: this.currentTabId,
                timestamp: new Date().toISOString(),
                sequenceNumber: this.getNextSequenceNumber(),
                payload: { lastHeartbeat: tabInfo.lastHeartbeat }
            });
        }
    }
    // CLEAN UP INACTIVE TABS
    cleanupInactiveTabs() {
        const now = Date.now();
        const timeoutThreshold = now - this.TAB_TIMEOUT;
        for (const [tabId, tabInfo] of this.activeTabs) {
            const lastHeartbeat = new Date(tabInfo.lastHeartbeat).getTime();
            if (lastHeartbeat < timeoutThreshold && tabId !== this.currentTabId) {
                console.log(`🗑️ Cleaning up inactive tab: ${tabId}`);
                this.activeTabs.delete(tabId);
                this.updateTabRegistry();
            }
        }
        this.syncStats.activeTabs = this.activeTabs.size;
    }
    // SET UP LOCAL EVENT LISTENERS FOR BROADCASTING
    setupLocalEventListeners() {
        const syncEvents = [
            'TRANSACTIONS_UPDATED',
            'ACCOUNT_UPDATED',
            'FILE_UPLOADED',
            'FILE_DELETED',
            'DATA_CLEARED'
        ];
        syncEvents.forEach(eventType => {
            eventBus_1.eventBus.on(eventType, (data) => {
                // Don't broadcast events that came from cross-tab sync to avoid loops
                if (data === null || data === void 0 ? void 0 : data.fromCrossTab) {
                    return;
                }
                this.broadcastDataChange(eventType, data);
            });
        });
    }
    // BROADCAST DATA CHANGES TO OTHER TABS
    broadcastDataChange(eventType, data) {
        if (this.activeTabs.size <= 1) {
            return; // No other tabs to sync with
        }
        this.broadcastMessage({
            type: 'DATA_SYNC',
            tabId: this.currentTabId,
            timestamp: new Date().toISOString(),
            sequenceNumber: this.getNextSequenceNumber(),
            payload: {
                eventType,
                data
            }
        });
        console.log(`📤 Broadcasted ${eventType} to ${this.activeTabs.size - 1} other tabs`);
    }
    // BROADCAST MESSAGE TO OTHER TABS VIA LOCALSTORAGE
    broadcastMessage(message) {
        try {
            const messageJson = JSON.stringify(message);
            // Use localStorage to communicate with other tabs
            localStorage.setItem(this.STORAGE_KEY, messageJson);
            // Immediately remove to trigger storage event in other tabs
            setTimeout(() => {
                const currentMessage = localStorage.getItem(this.STORAGE_KEY);
                if (currentMessage === messageJson) {
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            }, 100);
        }
        catch (error) {
            console.error('❌ Error broadcasting message:', error);
        }
    }
    // UPDATE TAB REGISTRY IN LOCALSTORAGE
    updateTabRegistry() {
        try {
            const registry = Array.from(this.activeTabs.values());
            localStorage.setItem(this.TAB_REGISTRY_KEY, JSON.stringify(registry));
        }
        catch (error) {
            console.error('❌ Error updating tab registry:', error);
        }
    }
    // HANDLE TAB REGISTRY UPDATES FROM OTHER TABS
    handleTabRegistryUpdate(registryData) {
        try {
            const registry = JSON.parse(registryData);
            // Update local tab registry
            this.activeTabs.clear();
            registry.forEach(tab => {
                this.activeTabs.set(tab.tabId, tab);
            });
            this.syncStats.activeTabs = this.activeTabs.size;
        }
        catch (error) {
            console.error('❌ Error handling tab registry update:', error);
        }
    }
    // HANDLE TAB REGISTRATION
    handleTabRegister(message) {
        const tabInfo = message.payload;
        if (tabInfo) {
            this.activeTabs.set(message.tabId, tabInfo);
            this.updateTabRegistry();
            console.log(`📝 New tab registered: ${message.tabId}`);
        }
    }
    // HANDLE TAB HEARTBEAT
    handleTabHeartbeat(message) {
        var _a;
        const tabInfo = this.activeTabs.get(message.tabId);
        if (tabInfo && ((_a = message.payload) === null || _a === void 0 ? void 0 : _a.lastHeartbeat)) {
            tabInfo.lastHeartbeat = message.payload.lastHeartbeat;
            this.activeTabs.set(message.tabId, tabInfo);
        }
    }
    // HANDLE TAB CLOSE
    handleTabClose(message) {
        this.activeTabs.delete(message.tabId);
        this.updateTabRegistry();
        console.log(`🗑️ Tab closed: ${message.tabId}`);
    }
    // HANDLE CONFLICT RESOLUTION
    handleConflictResolution(message) {
        const { conflictId, resolution } = message.payload || {};
        const conflict = this.pendingConflicts.get(conflictId);
        if (conflict && !conflict.resolved) {
            conflict.resolved = true;
            // Apply the resolution locally if needed
            console.log(`✅ Applied conflict resolution for ${conflictId}: ${resolution}`);
        }
    }
    // SETUP CLEANUP ON PAGE UNLOAD
    setupUnloadHandlers() {
        const cleanup = () => {
            this.broadcastMessage({
                type: 'TAB_CLOSE',
                tabId: this.currentTabId,
                timestamp: new Date().toISOString(),
                sequenceNumber: this.getNextSequenceNumber()
            });
        };
        window.addEventListener('beforeunload', cleanup);
        // Use 'pagehide' instead of deprecated 'unload' event
        window.addEventListener('pagehide', cleanup);
    }
    // UTILITY METHODS
    generateTabId() {
        return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getNextSequenceNumber() {
        return ++this.sequenceNumber;
    }
    // PUBLIC API METHODS
    getActiveTabs() {
        return Array.from(this.activeTabs.values());
    }
    getCurrentTabId() {
        return this.currentTabId;
    }
    getSyncStats() {
        return { ...this.syncStats };
    }
    getPendingConflicts() {
        return Array.from(this.pendingConflicts.values());
    }
    // Force sync with other tabs
    forceSyncCheck() {
        console.log('🔄 Force sync check initiated');
        // Request current state from all other tabs
        this.broadcastMessage({
            type: 'DATA_SYNC',
            tabId: this.currentTabId,
            timestamp: new Date().toISOString(),
            sequenceNumber: this.getNextSequenceNumber(),
            payload: {
                eventType: 'SYNC_REQUEST',
                data: { requestCurrentState: true }
            }
        });
    }
    // CLEANUP AND DISPOSAL
    dispose() {
        console.log('🧹 Disposing Cross-Tab Sync Service...');
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.storageListener) {
            window.removeEventListener('storage', this.storageListener);
            this.storageListener = null;
        }
        // Broadcast tab closure
        this.broadcastMessage({
            type: 'TAB_CLOSE',
            tabId: this.currentTabId,
            timestamp: new Date().toISOString(),
            sequenceNumber: this.getNextSequenceNumber()
        });
        // Clean up local state
        this.activeTabs.clear();
        this.pendingConflicts.clear();
        console.log('✅ Cross-Tab Sync Service disposed');
    }
}
// Check for debug mode
const isDebugMode = (0, debugMode_1.isDebugMode)();
// Export singleton instance (skip in debug mode)
let crossTabSyncService;
exports.crossTabSyncService = crossTabSyncService;
if (isDebugMode) {
    console.log('🚨 CrossTabSyncService: Debug mode detected - creating mock instance');
    exports.crossTabSyncService = crossTabSyncService = {
        getSyncStats: () => ({ activeTabs: 0, lastSync: Date.now(), syncEnabled: false }),
        dispose: () => Promise.resolve()
    };
}
else {
    exports.crossTabSyncService = crossTabSyncService = new CrossTabSyncService();
}
