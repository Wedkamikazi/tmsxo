// Core module exports
export { eventBus } from './orchestration/EventBus';
export { serviceOrchestrator } from './orchestration/ServiceOrchestrator';
export { performanceManager } from './performance/PerformanceManager';
export { 
  stateManager, 
  saveActiveTab, 
  getActiveTab, 
  shouldReinitializeServices, 
  markServicesInitialized,
  incrementDataRefresh,
  getDataRefreshTrigger,
  registerGlobalRefresh,
  unregisterGlobalRefresh,
  clearComponentStates,
  getStateStorageUsage
} from './performance/StateManager';
export { systemSafetyManager, initializeSystemSafety } from './safety/SystemSafetyManager';
export { systemTerminator } from './safety/SystemTerminator';
export { infiniteLoopProtection } from './safety/InfiniteLoopProtection'; 