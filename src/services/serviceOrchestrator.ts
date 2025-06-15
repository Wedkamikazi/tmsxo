import { eventBus } from './eventBus';
import { localStorageManager } from './localStorageManager';
import { unifiedDataService } from './unifiedDataService';
import { performanceManager } from './performanceManager';
import { systemIntegrityService } from './systemIntegrityService';
import { memoryManagementService } from './memoryManagementService';
import { crossTabSyncService } from './crossTabSyncService';
import { mlCategorizationService } from './mlCategorizationService';
import { mlNaturalLanguageService } from './mlNaturalLanguageService';
import { mlPredictiveAnalyticsService } from './mlPredictiveAnalyticsService';

// SERVICE ORCHESTRATOR - ULTIMATE SYSTEM INITIALIZATION
// Manages service startup sequence, dependencies, health monitoring, and graceful shutdown

export interface ServiceDefinition {
  name: string;
  service: any;
  dependencies: string[];
  initMethod?: string;
  healthCheckMethod?: string;
  disposeMethod?: string;
  timeout: number;
  critical: boolean;
  retryAttempts: number;
}

export interface ServiceStatus {
  name: string;
  status: 'pending' | 'initializing' | 'ready' | 'failed' | 'disposed';
  startTime?: number;
  readyTime?: number;
  error?: string;
  retryCount: number;
  healthStatus: 'unknown' | 'healthy' | 'degraded' | 'failed';
  lastHealthCheck?: number;
}

export interface SystemStatus {
  overall: 'initializing' | 'ready' | 'degraded' | 'failed';
  services: Map<string, ServiceStatus>;
  startupTime: number;
  readyTime?: number;
  criticalServicesReady: boolean;
  totalServices: number;
  readyServices: number;
  failedServices: number;
}

class ServiceOrchestrator {
  private services: Map<string, ServiceDefinition> = new Map();
  private serviceStatus: Map<string, ServiceStatus> = new Map();
  private initializationPromises: Map<string, Promise<void>> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private systemStartTime = 0;

  constructor() {
    this.registerServices();
    this.setupGlobalHandlers();
  }

  // REGISTER ALL SYSTEM SERVICES WITH DEPENDENCIES
  private registerServices(): void {
    console.log('🎯 Registering System Services...');

    // Core Infrastructure Services (Tier 1)
    this.registerService({
      name: 'eventBus',
      service: eventBus,
      dependencies: [],
      timeout: 5000,
      critical: true,
      retryAttempts: 3
    });

    this.registerService({
      name: 'localStorageManager',
      service: localStorageManager,
      dependencies: [],
      timeout: 5000,
      critical: true,
      retryAttempts: 3
    });

    this.registerService({
      name: 'performanceManager',
      service: performanceManager,
      dependencies: [],
      timeout: 5000,
      critical: true,
      retryAttempts: 2
    });

    // Data Services (Tier 2)
    this.registerService({
      name: 'unifiedDataService',
      service: unifiedDataService,
      dependencies: ['localStorageManager', 'eventBus'],
      timeout: 10000,
      critical: true,
      retryAttempts: 3
    });

    // System Services (Tier 3)
    this.registerService({
      name: 'memoryManagementService',
      service: memoryManagementService,
      dependencies: ['eventBus', 'performanceManager'],
      healthCheckMethod: 'getMemoryHealthStatus',
      disposeMethod: 'dispose',
      timeout: 15000,
      critical: true,
      retryAttempts: 2
    });

    this.registerService({
      name: 'crossTabSyncService',
      service: crossTabSyncService,
      dependencies: ['eventBus', 'unifiedDataService'],
      healthCheckMethod: 'getSyncStats',
      disposeMethod: 'dispose',
      timeout: 10000,
      critical: false,
      retryAttempts: 2
    });

    this.registerService({
      name: 'systemIntegrityService',
      service: systemIntegrityService,
      dependencies: ['localStorageManager', 'eventBus', 'performanceManager', 'crossTabSyncService'],
      healthCheckMethod: 'getSystemHealthStatus',
      disposeMethod: 'dispose',
      timeout: 15000,
      critical: true,
      retryAttempts: 2
    });

    // ML Services (Background initialization) - Initialize after main app loads
    this.registerService({
      name: 'mlCategorizationService',
      service: mlCategorizationService,
      dependencies: ['memoryManagementService', 'unifiedDataService'],
      healthCheckMethod: 'getModelStatus',
      timeout: 5000, // Shorter timeout - just for basic service setup
      critical: false,
      retryAttempts: 1
    });

    this.registerService({
      name: 'mlNaturalLanguageService',
      service: mlNaturalLanguageService,
      dependencies: ['memoryManagementService', 'unifiedDataService'],
      healthCheckMethod: 'getServiceStatus',
      timeout: 5000, // Shorter timeout - just for basic service setup
      critical: false,
      retryAttempts: 1
    });

    this.registerService({
      name: 'mlPredictiveAnalyticsService',
      service: mlPredictiveAnalyticsService,
      dependencies: ['memoryManagementService', 'unifiedDataService'],
      healthCheckMethod: 'getServiceStatus',
      timeout: 5000, // Shorter timeout - just for basic service setup
      critical: false,
      retryAttempts: 1
    });

    console.log(`✅ Registered ${this.services.size} services`);
  }

  // REGISTER INDIVIDUAL SERVICE
  private registerService(definition: Omit<ServiceDefinition, 'healthCheckMethod' | 'disposeMethod' | 'initMethod'> & {
    healthCheckMethod?: string;
    disposeMethod?: string;
    initMethod?: string;
  }): void {
    const serviceDefinition: ServiceDefinition = {
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
  async initializeSystem(): Promise<SystemStatus> {
    console.log('🚀 Starting System Initialization...');
    this.systemStartTime = Date.now();

    try {
      // Build dependency graph and initialization order
      const initializationOrder = this.resolveDependencyOrder();
      console.log('📋 Service initialization order:', initializationOrder);

      // Initialize services in tiers
      const tiers = this.groupServicesByTier(initializationOrder);
      
      for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
        const tier = tiers[tierIndex];
        console.log(`🔄 Initializing Tier ${tierIndex + 1}: [${tier.join(', ')}]`);
        
        // Initialize all services in current tier in parallel
        const tierPromises = tier.map(serviceName => this.initializeService(serviceName));
        const tierResults = await Promise.allSettled(tierPromises);
        
        // Check for critical service failures
        const criticalFailures = tierResults
          .map((result, index) => ({ result, serviceName: tier[index] }))
          .filter(({ result, serviceName }) => {
            const service = this.services.get(serviceName);
            return result.status === 'rejected' && service?.critical;
          });

        if (criticalFailures.length > 0) {
          const failedServices = criticalFailures.map(f => f.serviceName).join(', ');
          throw new Error(`Critical services failed to initialize: ${failedServices}`);
        }
      }

      // Start health monitoring
      this.startHealthMonitoring();

      const systemStatus = this.getSystemStatus();
      console.log(`✅ System Initialization Complete (${Date.now() - this.systemStartTime}ms)`);
      
      // Initialize ML services in background (non-blocking)
      this.initializeMLServicesInBackground();
      
      // Emit system ready event
      eventBus.emit('DATA_CLEARED', {
        systemReady: {
          totalTime: Date.now() - this.systemStartTime,
          readyServices: systemStatus.readyServices,
          totalServices: systemStatus.totalServices
        }
      }, 'ServiceOrchestrator');

      return systemStatus;

    } catch (error) {
      console.error('❌ System Initialization Failed:', error);
      
      // Emit system failure event
      eventBus.emit('DATA_CLEARED', {
        systemFailure: {
          error: error instanceof Error ? error.message : 'Unknown error',
          totalTime: Date.now() - this.systemStartTime
        }
      }, 'ServiceOrchestrator');

      throw error;
    }
  }

  // INITIALIZE INDIVIDUAL SERVICE WITH RETRY LOGIC
  private async initializeService(serviceName: string): Promise<void> {
    const definition = this.services.get(serviceName);
    const status = this.serviceStatus.get(serviceName);
    
    if (!definition || !status) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    // Check if already initializing
    if (this.initializationPromises.has(serviceName)) {
      return this.initializationPromises.get(serviceName)!;
    }

    const initPromise = this.performServiceInitialization(definition, status);
    this.initializationPromises.set(serviceName, initPromise);
    
    try {
      await initPromise;
    } finally {
      this.initializationPromises.delete(serviceName);
    }
  }

  // PERFORM ACTUAL SERVICE INITIALIZATION
  private async performServiceInitialization(definition: ServiceDefinition, status: ServiceStatus): Promise<void> {
    const maxRetries = definition.retryAttempts;
    let lastError: Error | null = null;

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
        
        console.log(`✅ ${definition.name} initialized (${status.readyTime - status.startTime!}ms)`);
        return;

      } catch (error) {
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
    status.error = lastError?.message || 'Unknown error';
    status.healthStatus = 'failed';
    
    console.error(`❌ ${definition.name} failed to initialize after ${maxRetries + 1} attempts`);
    
    if (definition.critical) {
      throw new Error(`Critical service ${definition.name} failed to initialize: ${status.error}`);
    }
  }

  // INITIALIZE SERVICE WITH TIMEOUT
  private async initializeServiceWithTimeout(definition: ServiceDefinition): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Initialization timeout (${definition.timeout}ms)`)), definition.timeout);
    });

    const initPromise = definition.initMethod && typeof definition.service[definition.initMethod] === 'function'
      ? definition.service[definition.initMethod]()
      : Promise.resolve();

    await Promise.race([initPromise, timeoutPromise]);
  }

  // WAIT FOR SERVICE DEPENDENCIES
  private async waitForDependencies(dependencies: string[]): Promise<void> {
    if (dependencies.length === 0) return;

    const dependencyPromises = dependencies.map(async (depName) => {
      const depStatus = this.serviceStatus.get(depName);
      if (!depStatus) {
        throw new Error(`Dependency not found: ${depName}`);
      }

      // If dependency is already ready, continue
      if (depStatus.status === 'ready') return;

      // If dependency failed and is critical, throw error
      if (depStatus.status === 'failed') {
        const depDefinition = this.services.get(depName);
        if (depDefinition?.critical) {
          throw new Error(`Critical dependency ${depName} failed`);
        }
        return; // Non-critical dependency failure is acceptable
      }

      // Wait for dependency to be ready or fail
      return new Promise<void>((resolve, reject) => {
        const checkDependency = () => {
          const currentStatus = this.serviceStatus.get(depName);
          if (currentStatus?.status === 'ready') {
            resolve();
          } else if (currentStatus?.status === 'failed') {
            const depDefinition = this.services.get(depName);
            if (depDefinition?.critical) {
              reject(new Error(`Critical dependency ${depName} failed`));
            } else {
              resolve(); // Non-critical failure is acceptable
            }
          } else {
            setTimeout(checkDependency, 100);
          }
        };
        checkDependency();
      });
    });

    await Promise.all(dependencyPromises);
  }

  // RESOLVE SERVICE DEPENDENCY ORDER
  private resolveDependencyOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (serviceName: string) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }
      if (visited.has(serviceName)) return;

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
  private groupServicesByTier(order: string[]): string[][] {
    const tiers: string[][] = [];
    const serviceTier = new Map<string, number>();

    // Calculate tier for each service based on dependency depth
    for (const serviceName of order) {
      const service = this.services.get(serviceName);
      if (!service) continue;

      let maxDepTier = -1;
      for (const dep of service.dependencies) {
        const depTier = serviceTier.get(dep) ?? 0;
        maxDepTier = Math.max(maxDepTier, depTier);
      }
      
      const tier = maxDepTier + 1;
      serviceTier.set(serviceName, tier);
      
      if (!tiers[tier]) tiers[tier] = [];
      tiers[tier].push(serviceName);
    }

    return tiers;
  }

  // START HEALTH MONITORING
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      for (const [serviceName, definition] of this.services) {
        const status = this.serviceStatus.get(serviceName);
        if (!status || status.status !== 'ready') continue;

        try {
          if (definition.healthCheckMethod && typeof definition.service[definition.healthCheckMethod] === 'function') {
            const healthResult = await definition.service[definition.healthCheckMethod]();
            
            // Interpret health result
            if (typeof healthResult === 'object' && healthResult !== null) {
              if ('isHealthy' in healthResult) {
                status.healthStatus = healthResult.isHealthy ? 'healthy' : 'degraded';
              } else if ('overall' in healthResult) {
                status.healthStatus = healthResult.overall === 'excellent' || healthResult.overall === 'good' 
                  ? 'healthy' 
                  : healthResult.overall === 'warning' ? 'degraded' : 'failed';
              } else {
                status.healthStatus = 'healthy'; // Assume healthy if method returns object
              }
            } else {
              status.healthStatus = 'healthy'; // Assume healthy if method completes
            }
          } else {
            status.healthStatus = 'healthy'; // No health check method, assume healthy
          }
          
          status.lastHealthCheck = Date.now();
          
        } catch (error) {
          console.warn(`Health check failed for ${serviceName}:`, error);
          status.healthStatus = 'degraded';
          status.lastHealthCheck = Date.now();
        }
      }
    }, 30000); // Health check every 30 seconds
  }

  // GET CURRENT SYSTEM STATUS
  getSystemStatus(): SystemStatus {
    const services = new Map(this.serviceStatus);
    const readyServices = Array.from(services.values()).filter(s => s.status === 'ready').length;
    const failedServices = Array.from(services.values()).filter(s => s.status === 'failed').length;
    
    const criticalServices = Array.from(this.services.values()).filter(s => s.critical);
    const criticalServicesReady = criticalServices.every(s => {
      const status = this.serviceStatus.get(s.name);
      return status?.status === 'ready';
    });

    let overall: SystemStatus['overall'];
    if (readyServices === services.size) {
      overall = 'ready';
    } else if (criticalServicesReady && failedServices === 0) {
      overall = 'ready'; // All critical services ready, non-critical may still be initializing
    } else if (criticalServicesReady) {
      overall = 'degraded'; // Critical services ready but some non-critical failed
    } else {
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
  async shutdown(): Promise<void> {
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
      
      if (!definition || !status || status.status !== 'ready') continue;

      try {
        console.log(`🧹 Disposing ${serviceName}...`);
        
        if (definition.disposeMethod && typeof definition.service[definition.disposeMethod] === 'function') {
          await definition.service[definition.disposeMethod]();
        }
        
        status.status = 'disposed';
        console.log(`✅ ${serviceName} disposed`);
        
      } catch (error) {
        console.warn(`⚠️ Error disposing ${serviceName}:`, error);
      }
    }

    console.log('✅ System Shutdown Complete');
  }

  // INITIALIZE ML SERVICES IN BACKGROUND (NON-BLOCKING)
  private async initializeMLServicesInBackground(): Promise<void> {
    console.log('🤖 Starting ML services initialization in background...');
    
    const mlServices = [
      'mlCategorizationService',
      'mlNaturalLanguageService', 
      'mlPredictiveAnalyticsService'
    ];

    // Initialize each ML service with a delay to prevent blocking
    for (const serviceName of mlServices) {
      setTimeout(async () => {
        try {
          const service = this.services.get(serviceName)?.service;
          if (service && typeof service.ensureInitialized === 'function') {
            console.log(`🔧 Background initializing ${serviceName}...`);
            await service.ensureInitialized();
            console.log(`✅ ${serviceName} background initialization complete`);
          }
        } catch (error) {
          console.warn(`⚠️ ${serviceName} background initialization failed:`, error);
        }
      }, Math.random() * 2000); // Stagger initialization with random delay
    }
  }

  // SETUP GLOBAL HANDLERS
  private setupGlobalHandlers(): void {
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
  async restartService(serviceName: string): Promise<boolean> {
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
      
    } catch (error) {
      console.error(`Failed to restart service ${serviceName}:`, error);
      return false;
    }
  }

  // GET SERVICE HEALTH REPORT
  getHealthReport(): {
    overall: string;
    services: Array<{
      name: string;
      status: string;
      healthStatus: string;
      uptime?: number;
      error?: string;
    }>;
    recommendations: string[];
  } {
    const systemStatus = this.getSystemStatus();
    const now = Date.now();
    
    const services = Array.from(systemStatus.services.values()).map(status => ({
      name: status.name,
      status: status.status,
      healthStatus: status.healthStatus,
      uptime: status.readyTime ? now - status.readyTime : undefined,
      error: status.error
    }));

    const recommendations: string[] = [];
    
    const failedServices = services.filter(s => s.status === 'failed');
    if (failedServices.length > 0) {
      recommendations.push(`${failedServices.length} services failed to initialize - consider restarting`);
    }
    
    const degradedServices = services.filter(s => s.healthStatus === 'degraded');
    if (degradedServices.length > 0) {
      recommendations.push(`${degradedServices.length} services are degraded - monitor closely`);
    }

    if (systemStatus.overall === 'failed') {
      recommendations.push('System is in failed state - immediate attention required');
    } else if (systemStatus.overall === 'degraded') {
      recommendations.push('System is degraded - some functionality may be limited');
    }

    return {
      overall: systemStatus.overall,
      services,
      recommendations
    };
  }
}

// Create and export singleton instance
export const serviceOrchestrator = new ServiceOrchestrator();
export default serviceOrchestrator; 