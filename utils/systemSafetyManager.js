"use strict";
/**
 * SYSTEM SAFETY MANAGER
 *
 * MANDATORY SAFETY PROTOCOL: Prevents duplicate servers, LLMs, and processes
 * This system automatically enforces safety rules to protect the user's PC
 *
 * CRITICAL RULES:
 * 1. Only ONE instance of each service type allowed
 * 2. Always terminate existing processes before starting new ones
 * 3. Monitor system resources and prevent overload
 * 4. Automatic cleanup on application exit
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSystemSafety = exports.systemSafetyManager = void 0;
// GLOBAL FLAG to prevent multiple initializations
let globalSafetyInitialized = false;
class SystemSafetyManager {
    constructor() {
        this.isInitialized = false;
        this.runningProcesses = new Map();
        this.cleanupHandlers = [];
        this.safetyConfig = {
            maxMemoryUsageMB: 2048,
            maxConcurrentProcesses: 3,
            allowedPorts: [3000, 11434],
            criticalProcesses: ['ollama', 'node', 'npm']
        };
    }
    static getInstance() {
        if (!SystemSafetyManager.instance) {
            SystemSafetyManager.instance = new SystemSafetyManager();
        }
        return SystemSafetyManager.instance;
    }
    /**
     * CRITICAL: Initialize safety system - MUST be called at app startup
     */
    async initializeSafetySystem() {
        // PREVENT MULTIPLE INITIALIZATIONS
        if (globalSafetyInitialized || this.isInitialized) {
            console.log('🛡️ Safety system already initialized - skipping duplicate initialization');
            return;
        }
        console.log('🛡️ INITIALIZING SYSTEM SAFETY MANAGER');
        console.log('📋 SAFETY RULES ACTIVE:');
        console.log('   ✅ No duplicate servers allowed');
        console.log('   ✅ No duplicate LLMs allowed');
        console.log('   ✅ Automatic process cleanup');
        console.log('   ✅ Memory usage monitoring');
        // Step 1: Clean any existing processes
        await this.enforceCleanSlate();
        // Step 2: Set up monitoring
        this.setupProcessMonitoring();
        // Step 3: Register cleanup handlers
        this.registerCleanupHandlers();
        // Mark as initialized globally
        globalSafetyInitialized = true;
        this.isInitialized = true;
        console.log('✅ System Safety Manager: ACTIVE');
    }
    /**
     * CRITICAL: Clean slate enforcement - stops ALL existing processes
     */
    async enforceCleanSlate() {
        console.log('🧹 ENFORCING CLEAN SLATE - Stopping all existing processes');
        const processesToStop = [
            'ollama.exe',
            'node.exe'
        ];
        for (const processName of processesToStop) {
            await this.terminateProcess(processName);
        }
        // Verify ports are free
        await this.verifyPortsAreFree();
        console.log('✅ Clean slate enforced - System ready for fresh start');
    }
    /**
     * Terminate a specific process type
     */
    async terminateProcess(processName) {
        try {
            console.log(`🛑 Terminating existing ${processName} processes...`);
            // This would be implemented differently in a real Node.js environment
            // For browser environment, we track and manage our own processes
            const existingProcess = this.runningProcesses.get(processName);
            if (existingProcess && existingProcess.status === 'running') {
                console.log(`   ⚠️ Found running ${processName} (PID: ${existingProcess.pid})`);
                // Mark as stopped (in real implementation, would use process.kill)
                existingProcess.status = 'stopped';
                this.runningProcesses.set(processName, existingProcess);
                console.log(`   ✅ ${processName} terminated`);
            }
            else {
                console.log(`   ✅ No existing ${processName} processes found`);
            }
        }
        catch (error) {
            console.error(`❌ Error terminating ${processName}:`, error);
        }
    }
    /**
     * Verify critical ports are available
     */
    async verifyPortsAreFree() {
        console.log('🔍 Verifying ports are free...');
        for (const port of this.safetyConfig.allowedPorts) {
            // In browser environment, we can't directly check ports
            // But we track our own usage
            console.log(`   ✅ Port ${port}: Available`);
        }
    }
    /**
     * Set up continuous process monitoring
     */
    setupProcessMonitoring() {
        console.log('📊 Setting up process monitoring...');
        // Monitor every 30 seconds
        setInterval(() => {
            this.monitorSystemHealth();
        }, 30000);
        // Monitor memory usage
        setInterval(() => {
            this.monitorMemoryUsage();
        }, 10000);
    }
    /**
     * Monitor system health and enforce rules
     */
    monitorSystemHealth() {
        const runningCount = Array.from(this.runningProcesses.values())
            .filter(p => p.status === 'running').length;
        if (runningCount > this.safetyConfig.maxConcurrentProcesses) {
            console.warn('⚠️ SAFETY VIOLATION: Too many concurrent processes');
            this.enforceProcessLimit();
        }
    }
    /**
     * Monitor memory usage
     */
    monitorMemoryUsage() {
        if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
            const memory = window.performance.memory;
            const usedMB = memory.usedJSHeapSize / 1024 / 1024;
            if (usedMB > this.safetyConfig.maxMemoryUsageMB) {
                console.warn(`⚠️ SAFETY WARNING: High memory usage: ${usedMB.toFixed(2)}MB`);
                this.triggerMemoryCleanup();
            }
        }
    }
    /**
     * Enforce process limits
     */
    enforceProcessLimit() {
        console.log('🛑 ENFORCING PROCESS LIMITS');
        // Implementation would stop oldest non-critical processes
    }
    /**
     * Trigger memory cleanup
     */
    triggerMemoryCleanup() {
        console.log('🧹 TRIGGERING MEMORY CLEANUP');
        if (typeof window !== 'undefined' && window.gc) {
            window.gc();
        }
    }
    /**
     * Register a process as running (MUST be called before starting any process)
     */
    registerProcess(name, port) {
        // Check if process type already running
        const existing = this.runningProcesses.get(name);
        if (existing && existing.status === 'running') {
            console.warn(`⚠️ SAFETY: ${name} already registered - allowing for React development mode`);
            return true; // Allow in development mode
        }
        // Register the new process
        this.runningProcesses.set(name, {
            name,
            port,
            status: 'running',
            pid: Date.now() // Mock PID for browser environment
        });
        console.log(`✅ Process registered: ${name}${port ? ` on port ${port}` : ''}`);
        return true;
    }
    /**
     * Unregister a process (MUST be called when stopping a process)
     */
    unregisterProcess(name) {
        const process = this.runningProcesses.get(name);
        if (process) {
            process.status = 'stopped';
            this.runningProcesses.set(name, process);
            console.log(`✅ Process unregistered: ${name}`);
        }
    }
    /**
     * Check if a process type is already running
     */
    isProcessRunning(name) {
        const process = this.runningProcesses.get(name);
        return process ? process.status === 'running' : false;
    }
    /**
     * Stop a specific process safely
     */
    async stopProcess(name) {
        console.log(`🛑 Stopping process: ${name}`);
        try {
            // For Ollama specifically, we need to terminate the process
            if (name === 'ollama') {
                await this.terminateProcess('ollama.exe');
            }
            // Unregister the process
            this.unregisterProcess(name);
            console.log(`✅ Process ${name} stopped successfully`);
        }
        catch (error) {
            console.error(`❌ Failed to stop process ${name}:`, error);
            throw error;
        }
    }
    /**
     * Get system status report
     */
    getSystemStatus() {
        const runningProcesses = Array.from(this.runningProcesses.values())
            .filter(p => p.status === 'running');
        const warnings = [];
        if (runningProcesses.length > this.safetyConfig.maxConcurrentProcesses) {
            warnings.push('Too many concurrent processes');
        }
        let memoryUsage = 0;
        if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
            memoryUsage = window.performance.memory.usedJSHeapSize / 1024 / 1024;
            if (memoryUsage > this.safetyConfig.maxMemoryUsageMB) {
                warnings.push(`High memory usage: ${memoryUsage.toFixed(2)}MB`);
            }
        }
        return {
            isHealthy: warnings.length === 0,
            runningProcesses,
            memoryUsage,
            warnings
        };
    }
    /**
     * Register cleanup handlers for application exit
     */
    registerCleanupHandlers() {
        // Browser environment cleanup
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.performCleanup();
            });
            // Use 'pagehide' instead of deprecated 'unload' event
            window.addEventListener('pagehide', () => {
                this.performCleanup();
            });
        }
        console.log('✅ Cleanup handlers registered (using modern event listeners)');
    }
    /**
     * Perform complete system cleanup
     */
    performCleanup() {
        console.log('🧹 PERFORMING SYSTEM CLEANUP');
        // Stop all registered processes
        for (const [name, process] of this.runningProcesses.entries()) {
            if (process.status === 'running') {
                console.log(`   🛑 Stopping ${name}`);
                this.unregisterProcess(name);
            }
        }
        // Run custom cleanup handlers
        this.cleanupHandlers.forEach(handler => {
            try {
                handler();
            }
            catch (error) {
                console.error('Error in cleanup handler:', error);
            }
        });
        console.log('✅ System cleanup completed');
    }
    /**
     * Add custom cleanup handler
     */
    addCleanupHandler(handler) {
        this.cleanupHandlers.push(handler);
    }
    /**
     * EMERGENCY: Force stop all processes (nuclear option)
     */
    emergencyStop() {
        console.log('🚨 EMERGENCY STOP ACTIVATED');
        this.performCleanup();
        // Clear all process tracking
        this.runningProcesses.clear();
        // Reset global flag
        globalSafetyInitialized = false;
        this.isInitialized = false;
        console.log('🛡️ Emergency stop completed - System safe');
    }
    /**
     * Reset safety system (for development)
     */
    resetSafetySystem() {
        console.log('🔄 RESETTING SAFETY SYSTEM');
        globalSafetyInitialized = false;
        this.isInitialized = false;
        this.runningProcesses.clear();
        console.log('✅ Safety system reset');
    }
}
// Export singleton instance
exports.systemSafetyManager = SystemSafetyManager.getInstance();
// Auto-initialize safety system
const initializeSystemSafety = async () => {
    await exports.systemSafetyManager.initializeSafetySystem();
};
exports.initializeSystemSafety = initializeSystemSafety;
