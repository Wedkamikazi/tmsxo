"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceOrchestrator = void 0;
const debugMode_1 = require("../utils/debugMode");
const eventBus_1 = require("./eventBus");
const localStorageManager_1 = require("./localStorageManager");
const unifiedDataService_1 = require("./unifiedDataService");
const performanceManager_1 = require("./performanceManager");
const systemIntegrityService_1 = require("./systemIntegrityService");
const crossTabSyncService_1 = require("./crossTabSyncService");
const unifiedCategorizationService_1 = require("./unifiedCategorizationService");
const mlNaturalLanguageService_1 = require("./mlNaturalLanguageService");
const mlPredictiveAnalyticsService_1 = require("./mlPredictiveAnalyticsService");
const localOllamaIntegration_1 = require("./localOllamaIntegration");
const enhancedMLOrchestrator_1 = require("./enhancedMLOrchestrator");
class ServiceOrchestrator {
    constructor() {
        this.services = new Map();
        this.serviceStatus = new Map();
        this.initializationPromises = new Map();
        this.healthCheckInterval = null;
        this.isShuttingDown = false;
        this.systemStartTime = 0;
        // ML Services handled separately for background initialization
        this.mlServices = {
            unifiedCategorizationService: unifiedCategorizationService_1.unifiedCategorizationService,
            mlNaturalLanguageService: mlNaturalLanguageService_1.mlNaturalLanguageService,
            mlPredictiveAnalyticsService: mlPredictiveAnalyticsService_1.mlPredictiveAnalyticsService,
            localOllamaIntegration: localOllamaIntegration_1.localOllamaIntegration,
            enhancedMLOrchestrator: enhancedMLOrchestrator_1.enhancedMLOrchestrator
        };
        // Skip initialization in debug mode
        if ((0, debugMode_1.isDebugMode)()) {
            console.log('🔧 ServiceOrchestrator: Debug mode detected - skipping service registration');
            return;
        }
        this.registerServices();
        this.setupGlobalHandlers();
    }
    // REGISTER ALL SYSTEM SERVICES WITH DEPENDENCIES
    registerServices() {
        console.log('🎯 Registering System Services...');
        // Core Infrastructure Services (Tier 1) - Fast initialization
        this.registerService({
            name: 'eventBus',
            service: eventBus_1.eventBus,
            dependencies: [],
            timeout: 2000,
            critical: true,
            retryAttempts: 2
        });
        this.registerService({
            name: 'localStorageManager',
            service: localStorageManager_1.localStorageManager,
            dependencies: [],
            timeout: 2000,
            critical: true,
            retryAttempts: 2
        });
        this.registerService({
            name: 'performanceManager',
            service: performanceManager_1.performanceManager,
            dependencies: [],
            healthCheckMethod: 'getMemoryHealthStatus',
            timeout: 2000,
            critical: true,
            retryAttempts: 1
        });
        // Data Services (Tier 2) - Reduced timeout for faster startup
        this.registerService({
            name: 'unifiedDataService',
            service: unifiedDataService_1.unifiedDataService,
            dependencies: ['localStorageManager', 'eventBus'],
            timeout: 3000,
            critical: true,
            retryAttempts: 2
        });
        // System Services (Tier 3) - Made non-critical for faster startup
        this.registerService({
            name: 'crossTabSyncService',
            service: crossTabSyncService_1.crossTabSyncService,
            dependencies: ['eventBus', 'unifiedDataService'],
            healthCheckMethod: 'getSyncStats',
            disposeMethod: 'dispose',
            timeout: 3000,
            critical: false,
            retryAttempts: 1
        });
        this.registerService({
            name: 'systemIntegrityService',
            service: systemIntegrityService_1.systemIntegrityService,
            dependencies: ['localStorageManager', 'eventBus', 'performanceManager'],
            healthCheckMethod: 'getSystemHealthStatus',
            disposeMethod: 'dispose',
            timeout: 4000,
            critical: false,
            retryAttempts: 1
        });
        // ML Services are initialized in background only - not part of main startup flow
        // They are stored for background initialization but excluded from main dependency graph
        console.log(`✅ Registered ${this.services.size} services`);
    }
    // REGISTER INDIVIDUAL SERVICE
    registerService(definition) {
        const serviceDefinition = {
            ...definition,
            healthCheckMethod: definition.healthCheckMethod,
            disposeMethod: definition.disposeMethod,
            initMethod: definition.initMethod
        };
        this.services.set(definition.name, serviceDefinition);
        this.serviceStatus.set(definition.name, {
            name: definition.name,
            status: 'pending',
            retryCount: 0,
            healthStatus: 'unknown'
        });
    }
    // INITIALIZE ALL SERVICES IN DEPENDENCY ORDER
    async initializeSystem(fastMode = false) {
        console.log('🚀 Starting System Initialization...' + (fastMode ? ' (Fast Mode)' : ''));
        this.systemStartTime = Date.now();
        try {
            // Build dependency graph and initialization order
            const initializationOrder = this.resolveDependencyOrder();
            console.log('📋 Service initialization order:', initializationOrder);
            // Initialize services in tiers
            const tiers = this.groupServicesByTier(initializationOrder);
            // In fast mode, only initialize critical services from the first two tiers
            const tiersToInitialize = fastMode ? tiers.slice(0, 2) : tiers;
            for (let tierIndex = 0; tierIndex < tiersToInitialize.length; tierIndex++) {
                const tier = tiersToInitialize[tierIndex];
                console.log(`🔄 Initializing Tier ${tierIndex + 1}: [${tier.join(', ')}]`);
                // Initialize all services in current tier in parallel
                const tierPromises = tier.map(serviceName => this.initializeService(serviceName));
                const tierResults = await Promise.allSettled(tierPromises);
                // Check for critical service failures
                const criticalFailures = tierResults
                    .map((result, index) => ({ result, serviceName: tier[index] }))
                    .filter(({ result, serviceName }) => {
                    const service = this.services.get(serviceName);
                    return result.status === 'rejected' && (service === null || service === void 0 ? void 0 : service.critical);
                });
                if (criticalFailures.length > 0) {
                    const failedServices = criticalFailures.map(f => f.serviceName).join(', ');
                    throw new Error(`Critical services failed to initialize: ${failedServices}`);
                }
            }
            // In fast mode, initialize remaining services in background
            if (fastMode && tiers.length > 2) {
                setTimeout(() => {
                    this.initializeRemainingServicesInBackground(tiers.slice(2));
                }, 100);
            }
            // Start health monitoring
            this.startHealthMonitoring();
            const systemStatus = this.getSystemStatus();
            console.log(`✅ System Initialization Complete (${Date.now() - this.systemStartTime}ms)`);
            // Initialize ML services in background (non-blocking)
            this.initializeMLServicesInBackground();
            // Emit system ready event
            eventBus_1.eventBus.emit('DATA_CLEARED', {
                systemReady: {
                    totalTime: Date.now() - this.systemStartTime,
                    readyServices: systemStatus.readyServices,
                    totalServices: systemStatus.totalServices
                }
            }, 'ServiceOrchestrator');
            return systemStatus;
        }
        catch (error) {
            console.error('❌ System Initialization Failed:', error);
            // Emit system failure event
            eventBus_1.eventBus.emit('DATA_CLEARED', {
                systemFailure: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    totalTime: Date.now() - this.systemStartTime
                }
            }, 'ServiceOrchestrator');
            throw error;
        }
    }
    // INITIALIZE INDIVIDUAL SERVICE WITH RETRY LOGIC
    async initializeService(serviceName) {
        const definition = this.services.get(serviceName);
        const status = this.serviceStatus.get(serviceName);
        if (!definition || !status) {
            throw new Error(`Service not found: ${serviceName}`);
        }
        // Check if already initializing
        if (this.initializationPromises.has(serviceName)) {
            return this.initializationPromises.get(serviceName);
        }
        const initPromise = this.performServiceInitialization(definition, status);
        this.initializationPromises.set(serviceName, initPromise);
        try {
            await initPromise;
        }
        finally {
            this.initializationPromises.delete(serviceName);
        }
    }
    // PERFORM ACTUAL SERVICE INITIALIZATION
    async performServiceInitialization(definition, status) {
        const maxRetries = definition.retryAttempts;
        let lastError = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                status.status = 'initializing';
                status.startTime = Date.now();
                status.retryCount = attempt;
                console.log(`🔧 Initializing ${definition.name} (attempt ${attempt + 1}/${maxRetries + 1})`);
                // Wait for dependencies
                await this.waitForDependencies(definition.dependencies);
                // Initialize service with timeout
                await this.initializeServiceWithTimeout(definition);
                // Mark as ready
                status.status = 'ready';
                status.readyTime = Date.now();
                status.healthStatus = 'healthy';
                console.log(`✅ ${definition.name} initialized (${status.readyTime - status.startTime}ms)`);
                return;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.warn(`⚠️ ${definition.name} initialization attempt ${attempt + 1} failed:`, lastError.message);
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        // All retries failed
        status.status = 'failed';
        status.error = (lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown error';
        status.healthStatus = 'failed';
        console.error(`❌ ${definition.name} failed to initialize after ${maxRetries + 1} attempts`);
        if (definition.critical) {
            throw new Error(`Critical service ${definition.name} failed to initialize: ${status.error}`);
        }
    }
    // INITIALIZE SERVICE WITH TIMEOUT
    async initializeServiceWithTimeout(definition) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Initialization timeout (${definition.timeout}ms)`)), definition.timeout);
        });
        const initPromise = definition.initMethod && typeof definition.service[definition.initMethod] === 'function'
            ? definition.service[definition.initMethod]()
            : Promise.resolve();
        await Promise.race([initPromise, timeoutPromise]);
    }
    // WAIT FOR SERVICE DEPENDENCIES
    async waitForDependencies(dependencies) {
        if (dependencies.length === 0)
            return;
        const dependencyPromises = dependencies.map(async (depName) => {
            const depStatus = this.serviceStatus.get(depName);
            if (!depStatus) {
                throw new Error(`Dependency not found: ${depName}`);
            }
            // If dependency is already ready, continue
            if (depStatus.status === 'ready')
                return;
            // If dependency failed and is critical, throw error
            if (depStatus.status === 'failed') {
                const depDefinition = this.services.get(depName);
                if (depDefinition === null || depDefinition === void 0 ? void 0 : depDefinition.critical) {
                    throw new Error(`Critical dependency ${depName} failed`);
                }
                return; // Non-critical dependency failure is acceptable
            }
            // Wait for dependency to be ready or fail
            return new Promise((resolve, reject) => {
                const checkDependency = () => {
                    const currentStatus = this.serviceStatus.get(depName);
                    if ((currentStatus === null || currentStatus === void 0 ? void 0 : currentStatus.status) === 'ready') {
                        resolve();
                    }
                    else if ((currentStatus === null || currentStatus === void 0 ? void 0 : currentStatus.status) === 'failed') {
                        const depDefinition = this.services.get(depName);
                        if (depDefinition === null || depDefinition === void 0 ? void 0 : depDefinition.critical) {
                            reject(new Error(`Critical dependency ${depName} failed`));
                        }
                        else {
                            resolve(); // Non-critical failure is acceptable
                        }
                    }
                    else {
                        setTimeout(checkDependency, 100);
                    }
                };
                checkDependency();
            });
        });
        await Promise.all(dependencyPromises);
    }
    // RESOLVE SERVICE DEPENDENCY ORDER
    resolveDependencyOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];
        const visit = (serviceName) => {
            if (visiting.has(serviceName)) {
                throw new Error(`Circular dependency detected involving ${serviceName}`);
            }
            if (visited.has(serviceName))
                return;
            visiting.add(serviceName);
            const service = this.services.get(serviceName);
            if (service) {
                for (const dep of service.dependencies) {
                    visit(dep);
                }
            }
            visiting.delete(serviceName);
            visited.add(serviceName);
            order.push(serviceName);
        };
        for (const serviceName of this.services.keys()) {
            visit(serviceName);
        }
        return order;
    }
    // GROUP SERVICES BY INITIALIZATION TIER
    groupServicesByTier(order) {
        var _a;
        const tiers = [];
        const serviceTier = new Map();
        // Calculate tier for each service based on dependency depth
        for (const serviceName of order) {
            const service = this.services.get(serviceName);
            if (!service)
                continue;
            let maxDepTier = -1;
            for (const dep of service.dependencies) {
                const depTier = (_a = serviceTier.get(dep)) !== null && _a !== void 0 ? _a : 0;
                maxDepTier = Math.max(maxDepTier, depTier);
            }
            const tier = maxDepTier + 1;
            serviceTier.set(serviceName, tier);
            if (!tiers[tier])
                tiers[tier] = [];
            tiers[tier].push(serviceName);
        }
        return tiers;
    }
    // START HEALTH MONITORING
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            if (this.isShuttingDown)
                return;
            for (const [serviceName, definition] of this.services) {
                const status = this.serviceStatus.get(serviceName);
                if (!status || status.status !== 'ready')
                    continue;
                try {
                    if (definition.healthCheckMethod && typeof definition.service[definition.healthCheckMethod] === 'function') {
                        const healthResult = await definition.service[definition.healthCheckMethod]();
                        // Interpret health result
                        if (typeof healthResult === 'object' && healthResult !== null) {
                            if ('isHealthy' in healthResult) {
                                status.healthStatus = healthResult.isHealthy ? 'healthy' : 'degraded';
                            }
                            else if ('overall' in healthResult) {
                                status.healthStatus = healthResult.overall === 'excellent' || healthResult.overall === 'good'
                                    ? 'healthy'
                                    : healthResult.overall === 'warning' ? 'degraded' : 'failed';
                            }
                            else {
                                status.healthStatus = 'healthy'; // Assume healthy if method returns object
                            }
                        }
                        else {
                            status.healthStatus = 'healthy'; // Assume healthy if method completes
                        }
                    }
                    else {
                        status.healthStatus = 'healthy'; // No health check method, assume healthy
                    }
                    status.lastHealthCheck = Date.now();
                }
                catch (error) {
                    console.warn(`Health check failed for ${serviceName}:`, error);
                    status.healthStatus = 'degraded';
                    status.lastHealthCheck = Date.now();
                }
            }
        }, 30000); // Health check every 30 seconds
    }
    // GET CURRENT SYSTEM STATUS
    getSystemStatus() {
        const services = new Map(this.serviceStatus);
        const readyServices = Array.from(services.values()).filter(s => s.status === 'ready').length;
        const failedServices = Array.from(services.values()).filter(s => s.status === 'failed').length;
        const criticalServices = Array.from(this.services.values()).filter(s => s.critical);
        const criticalServicesReady = criticalServices.every(s => {
            const status = this.serviceStatus.get(s.name);
            return (status === null || status === void 0 ? void 0 : status.status) === 'ready';
        });
        let overall;
        if (readyServices === services.size) {
            overall = 'ready';
        }
        else if (criticalServicesReady && failedServices === 0) {
            overall = 'ready'; // All critical services ready, non-critical may still be initializing
        }
        else if (criticalServicesReady) {
            overall = 'degraded'; // Critical services ready but some non-critical failed
        }
        else {
            overall = 'failed'; // Critical services not ready
        }
        return {
            overall,
            services,
            startupTime: this.systemStartTime,
            readyTime: overall === 'ready' ? Date.now() : undefined,
            criticalServicesReady,
            totalServices: services.size,
            readyServices,
            failedServices
        };
    }
    // GRACEFUL SYSTEM SHUTDOWN
    async shutdown() {
        console.log('🛑 Starting System Shutdown...');
        this.isShuttingDown = true;
        // Stop health monitoring
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        // Get services in reverse dependency order for shutdown
        const shutdownOrder = this.resolveDependencyOrder().reverse();
        for (const serviceName of shutdownOrder) {
            const definition = this.services.get(serviceName);
            const status = this.serviceStatus.get(serviceName);
            if (!definition || !status || status.status !== 'ready')
                continue;
            try {
                console.log(`🧹 Disposing ${serviceName}...`);
                if (definition.disposeMethod && typeof definition.service[definition.disposeMethod] === 'function') {
                    await definition.service[definition.disposeMethod]();
                }
                status.status = 'disposed';
                console.log(`✅ ${serviceName} disposed`);
            }
            catch (error) {
                console.warn(`⚠️ Error disposing ${serviceName}:`, error);
            }
        }
        console.log('✅ System Shutdown Complete');
    }
    // INITIALIZE ML SERVICES IN BACKGROUND (NON-BLOCKING)
    async initializeMLServicesInBackground() {
        console.log('🤖 Starting ML services initialization in background...');
        // Initialize each ML service with a delay to prevent blocking
        Object.entries(this.mlServices).forEach(([serviceName, service], index) => {
            setTimeout(async () => {
                try {
                    if (service && typeof service.ensureInitialized === 'function') {
                        console.log(`🔧 Background initializing ${serviceName}...`);
                        await service.ensureInitialized();
                        console.log(`✅ ${serviceName} background initialization complete`);
                    }
                }
                catch (error) {
                    console.warn(`⚠️ ${serviceName} background initialization failed:`, error);
                    // ML service failures are non-critical - app continues working
                }
            }, (index + 1) * 3000 + Math.random() * 2000); // Stagger initialization with 3s+ delays
        });
    }
    // INITIALIZE REMAINING SERVICES IN BACKGROUND AFTER FAST MODE STARTUP
    async initializeRemainingServicesInBackground(remainingTiers) {
        console.log('🔄 Initializing Remaining Services in Background...');
        try {
            for (let tierIndex = 0; tierIndex < remainingTiers.length; tierIndex++) {
                const tier = remainingTiers[tierIndex];
                console.log(`🔄 Background Tier ${tierIndex + 3}: [${tier.join(', ')}]`);
                // Initialize all services in current tier in parallel
                const tierPromises = tier.map(async (serviceName) => {
                    try {
                        await this.initializeService(serviceName);
                    }
                    catch (error) {
                        console.warn(`⚠️ Background service ${serviceName} failed:`, error);
                    }
                });
                await Promise.allSettled(tierPromises);
            }
            console.log('✅ Background Services Initialization Complete');
        }
        catch (error) {
            console.warn('⚠️ Background Services Initialization Failed:', error);
        }
    }
    // SETUP GLOBAL HANDLERS
    setupGlobalHandlers() {
        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.shutdown().catch(console.error);
        });
        // Handle process termination (if in Node.js environment)
        if (typeof process !== 'undefined') {
            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());
        }
    }
    // RESTART FAILED SERVICE
    async restartService(serviceName) {
        const definition = this.services.get(serviceName);
        const status = this.serviceStatus.get(serviceName);
        if (!definition || !status) {
            console.error(`Cannot restart unknown service: ${serviceName}`);
            return false;
        }
        if (status.status === 'ready') {
            console.log(`Service ${serviceName} is already running`);
            return true;
        }
        try {
            console.log(`🔄 Restarting service: ${serviceName}`);
            // Reset status
            status.status = 'pending';
            status.retryCount = 0;
            status.error = undefined;
            status.healthStatus = 'unknown';
            // Reinitialize
            await this.initializeService(serviceName);
            return true;
        }
        catch (error) {
            console.error(`Failed to restart service ${serviceName}:`, error);
            return false;
        }
    }
    // GET COMPREHENSIVE SYSTEM HEALTH REPORT (UNIFIED)
    async getHealthReport() {
        try {
            // Get orchestrator-specific status
            const systemStatus = this.getSystemStatus();
            const now = Date.now();
            const orchestratorServices = Array.from(systemStatus.services.values()).map(status => ({
                name: status.name,
                status: status.status,
                healthStatus: status.healthStatus,
                uptime: status.readyTime ? now - status.readyTime : undefined,
                error: status.error
            }));
            // Get comprehensive system health from unified monitoring
            const unifiedHealth = await systemIntegrityService_1.systemIntegrityService.getUnifiedSystemHealth();
            // Determine service initialization status
            let serviceInitialization;
            const failedServices = orchestratorServices.filter(s => s.status === 'failed');
            const readyServices = orchestratorServices.filter(s => s.status === 'ready');
            if (failedServices.length === 0 && readyServices.length === orchestratorServices.length) {
                serviceInitialization = 'complete';
            }
            else if (readyServices.length > 0) {
                serviceInitialization = 'partial';
            }
            else {
                serviceInitialization = 'failed';
            }
            // Combine recommendations from orchestrator and unified health
            const orchestratorRecommendations = [];
            if (failedServices.length > 0) {
                orchestratorRecommendations.push(`${failedServices.length} services failed to initialize - consider restarting`);
            }
            const degradedServices = orchestratorServices.filter(s => s.healthStatus === 'degraded');
            if (degradedServices.length > 0) {
                orchestratorRecommendations.push(`${degradedServices.length} services are degraded - monitor closely`);
            }
            if (systemStatus.overall === 'failed') {
                orchestratorRecommendations.push('System is in failed state - immediate attention required');
            }
            // Combine all recommendations, prioritizing critical ones
            const allRecommendations = [
                ...orchestratorRecommendations,
                ...unifiedHealth.recommendations
            ];
            // Remove duplicates and limit
            const uniqueRecommendations = Array.from(new Set(allRecommendations)).slice(0, 10);
            return {
                overall: unifiedHealth.overall,
                score: unifiedHealth.score,
                orchestrator: {
                    services: orchestratorServices,
                    serviceInitialization
                },
                systemHealth: unifiedHealth,
                recommendations: uniqueRecommendations
            };
        }
        catch (error) {
            // Fallback to basic orchestrator health if unified health fails
            systemIntegrityService_1.systemIntegrityService.logServiceError('ServiceOrchestrator', 'getHealthReport', error instanceof Error ? error : new Error(String(error)), 'medium', { fallbackMode: true });
            const systemStatus = this.getSystemStatus();
            const services = Array.from(systemStatus.services.values()).map(status => ({
                name: status.name,
                status: status.status,
                healthStatus: status.healthStatus,
                uptime: status.readyTime ? Date.now() - status.readyTime : undefined,
                error: status.error
            }));
            return {
                overall: 'warning',
                score: 50,
                orchestrator: {
                    services,
                    serviceInitialization: 'partial'
                },
                systemHealth: {
                    overall: 'warning',
                    score: 50,
                    services: {
                        storage: { status: 'unknown', details: {} },
                        performance: { status: 'unknown', details: {} },
                        dataIntegrity: { status: 'unknown', details: {} },
                        eventBus: { status: 'unknown', details: {} },
                        crossTabSync: { status: 'unknown', details: {} }
                    },
                    errorSummary: {
                        totalErrors: 0,
                        criticalErrors: 0,
                        recentErrorRate: 0,
                        topErrorServices: []
                    },
                    recommendations: ['Health monitoring temporarily unavailable'],
                    lastCheck: new Date().toISOString()
                },
                recommendations: [
                    'Health monitoring system unavailable - using fallback mode',
                    'Check system integrity service status'
                ]
            };
        }
    }
}
// Create and export singleton instance (skip in debug mode)
let serviceOrchestrator;
exports.serviceOrchestrator = serviceOrchestrator;
if ((0, debugMode_1.isDebugMode)()) {
    console.log('🔧 ServiceOrchestrator: Creating mock instance for debug mode');
    // Create a mock service orchestrator for debug mode
    exports.serviceOrchestrator = serviceOrchestrator = {
        initializeSystem: () => Promise.resolve({
            overall: 'ready',
            services: new Map(),
            startupTime: Date.now(),
            readyTime: Date.now(),
            criticalServicesReady: true,
            totalServices: 0,
            readyServices: 0,
            failedServices: 0
        }),
        getSystemStatus: () => ({
            overall: 'ready',
            services: new Map(),
            startupTime: Date.now(),
            readyTime: Date.now(),
            criticalServicesReady: true,
            totalServices: 0,
            readyServices: 0,
            failedServices: 0
        }),
        shutdown: () => Promise.resolve(),
        restartService: () => Promise.resolve(true),
        getHealthReport: () => Promise.resolve({
            overall: 'good',
            score: 100,
            orchestrator: {
                services: [],
                serviceInitialization: 'complete'
            },
            systemHealth: {
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
            },
            recommendations: ['Debug mode active - all services mocked']
        })
    };
}
else {
    exports.serviceOrchestrator = serviceOrchestrator = new ServiceOrchestrator();
}
exports.default = serviceOrchestrator;
