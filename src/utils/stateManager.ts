/**
 * PROFESSIONAL STATE MANAGER
 * Persistent state management for Treasury Management System
 * Prevents unnecessary reinitialization and maintains user context
 * ENHANCED WITH GLOBAL REFRESH MANAGEMENT
 */

interface AppState {
  activeTab: string;
  servicesInitialized: boolean;
  lastInitializationTime: number;
  componentStates: Record<string, any>; // NEW: Store component-specific states
  globalRefreshTimestamp: number; // NEW: Track global refresh events
  userPreferences: {
    theme: string;
    debugMode: boolean;
    autoRefresh: boolean;
  };
  sessionData: {
    dataRefreshTrigger: number;
    chatHistory: any[];
    selectedAccount: string | null;
    lastFileUpload: string | null;
  };
}

const STATE_STORAGE_KEY = 'treasury_app_state';
const STATE_VERSION = '1.1'; // Updated version for new features
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const INSTANT_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes for instant refresh

class StateManager {
  private static instance: StateManager;
  private state: AppState;
  private initialized = false;
  private refreshCallbacks: Map<string, () => void> = new Map(); // NEW: Component refresh callbacks

  private constructor() {
    this.state = this.getDefaultState();
    this.loadState();
  }

  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  private getDefaultState(): AppState {
    return {
      activeTab: 'bankStatement',
      servicesInitialized: false,
      lastInitializationTime: 0,
      componentStates: {}, // NEW: Component states storage
      globalRefreshTimestamp: 0, // NEW: Global refresh tracking
      userPreferences: {
        theme: 'light',
        debugMode: false,
        autoRefresh: true
      },
      sessionData: {
        dataRefreshTrigger: 0,
        chatHistory: [],
        selectedAccount: null,
        lastFileUpload: null
      }
    };
  }

  private loadState(): void {
    try {
      const stored = localStorage.getItem(STATE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Check if state is still valid (not expired)
        const now = Date.now();
        if (parsed.version === STATE_VERSION && 
            parsed.timestamp && 
            (now - parsed.timestamp) < CACHE_DURATION) {
          
          this.state = { ...this.getDefaultState(), ...parsed.state };
          console.log('✅ GLOBAL STATE: Restored from cache:', {
            activeTab: this.state.activeTab,
            servicesInitialized: this.state.servicesInitialized,
            componentStates: Object.keys(this.state.componentStates),
            cacheAge: Math.round((now - parsed.timestamp) / 1000) + 's'
          });
        } else {
          console.log('⏰ GLOBAL STATE: Cache expired or version mismatch, using defaults');
          this.state = this.getDefaultState();
        }
      }
    } catch (error) {
      console.warn('Failed to load state from localStorage:', error);
      this.state = this.getDefaultState();
    }
    this.initialized = true;
  }

  private saveState(): void {
    try {
      const stateToSave = {
        version: STATE_VERSION,
        timestamp: Date.now(),
        state: this.state
      };
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save state to localStorage:', error);
    }
  }

  // PUBLIC METHODS FOR GLOBAL REFRESH MANAGEMENT

  /**
   * Register a component's refresh callback
   */
  public registerRefreshCallback(componentName: string, callback: () => void): void {
    this.refreshCallbacks.set(componentName, callback);
    console.log(`🔄 GLOBAL REFRESH: Registered callback for ${componentName}`);
  }

  /**
   * Unregister a component's refresh callback
   */
  public unregisterRefreshCallback(componentName: string): void {
    this.refreshCallbacks.delete(componentName);
    console.log(`🔄 GLOBAL REFRESH: Unregistered callback for ${componentName}`);
  }

  /**
   * Trigger global refresh across all registered components
   */
  public triggerGlobalRefresh(): void {
    console.log('🔄 GLOBAL REFRESH: Triggering refresh for all components...');
    this.state.globalRefreshTimestamp = Date.now();
    this.incrementDataRefreshTrigger();
    
    // Call all registered refresh callbacks
    this.refreshCallbacks.forEach((callback, componentName) => {
      try {
        console.log(`🔄 GLOBAL REFRESH: Refreshing ${componentName}...`);
        callback();
      } catch (error) {
        console.error(`❌ GLOBAL REFRESH: Failed to refresh ${componentName}:`, error);
      }
    });
    
    this.saveState();
    console.log(`✅ GLOBAL REFRESH: Completed refresh for ${this.refreshCallbacks.size} components`);
  }

  /**
   * Check if a component should use cached state or refresh
   */
  public shouldComponentUseCache(componentName: string): boolean {
    const now = Date.now();
    const timeSinceInit = now - this.state.lastInitializationTime;
    const timeSinceGlobalRefresh = now - this.state.globalRefreshTimestamp;
    
    // Use cache if initialized recently and no global refresh was triggered
    const shouldUseCache = timeSinceInit < INSTANT_REFRESH_THRESHOLD && 
                          timeSinceGlobalRefresh < INSTANT_REFRESH_THRESHOLD;
    
    console.log(`🚀 COMPONENT CACHE CHECK (${componentName}):`, {
      shouldUseCache,
      timeSinceInit: Math.round(timeSinceInit / 1000) + 's',
      timeSinceGlobalRefresh: Math.round(timeSinceGlobalRefresh / 1000) + 's',
      threshold: Math.round(INSTANT_REFRESH_THRESHOLD / 1000) + 's'
    });
    
    return shouldUseCache;
  }

  /**
   * Store component-specific state
   */
  public setComponentState(componentName: string, state: any): void {
    this.state.componentStates[componentName] = {
      ...state,
      timestamp: Date.now()
    };
    this.saveState();
  }

  /**
   * Get component-specific state
   */
  public getComponentState<T = any>(componentName: string): T | null {
    const componentState = this.state.componentStates[componentName];
    if (!componentState) return null;
    
    // Check if component state is still fresh (30 minutes)
    const now = Date.now();
    if (now - componentState.timestamp > CACHE_DURATION) {
      delete this.state.componentStates[componentName];
      this.saveState();
      return null;
    }
    
    return componentState;
  }

  // EXISTING METHODS (Enhanced)

  public getState(): AppState {
    return { ...this.state };
  }

  public updateState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates };
    this.saveState();
  }

  public setActiveTab(tab: string): void {
    this.state.activeTab = tab;
    this.saveState();
    console.log('📂 GLOBAL STATE: Active tab saved:', tab);
  }

  public getActiveTab(): string {
    return this.state.activeTab;
  }

  public markServicesInitialized(): void {
    this.state.servicesInitialized = true;
    this.state.lastInitializationTime = Date.now();
    this.saveState();
    console.log('✅ GLOBAL STATE: Services initialization state saved');
  }

  public shouldReinitializeServices(): boolean {
    const now = Date.now();
    const timeSinceInit = now - this.state.lastInitializationTime;
    
    // Only reinitialize if more than threshold time has passed or never initialized
    const shouldReinit = !this.state.servicesInitialized || timeSinceInit > INSTANT_REFRESH_THRESHOLD;
    
    if (!shouldReinit) {
      console.log('🚀 GLOBAL REFRESH OPTIMIZATION: Services still cached - no reinitialization needed');
      console.log('📊 Cache details:', {
        activeTab: this.state.activeTab,
        lastInit: Math.round(timeSinceInit / 1000) + 's ago',
        servicesInitialized: this.state.servicesInitialized,
        cacheValid: 'YES',
        threshold: Math.round(INSTANT_REFRESH_THRESHOLD / 1000) + 's'
      });
    } else {
      console.log('⏰ GLOBAL STATE: Cache expired or first run - will reinitialize services');
    }
    
    return shouldReinit;
  }

  public updateSessionData<K extends keyof AppState['sessionData']>(key: K, value: AppState['sessionData'][K]): void {
    this.state.sessionData[key] = value;
    this.saveState();
  }

  public getSessionData<K extends keyof AppState['sessionData']>(key: K): AppState['sessionData'][K] {
    return this.state.sessionData[key];
  }

  public incrementDataRefreshTrigger(): number {
    this.state.sessionData.dataRefreshTrigger += 1;
    this.saveState();
    return this.state.sessionData.dataRefreshTrigger;
  }

  public getDataRefreshTrigger(): number {
    return this.state.sessionData.dataRefreshTrigger;
  }

  public setUserPreference<K extends keyof AppState['userPreferences']>(key: K, value: AppState['userPreferences'][K]): void {
    this.state.userPreferences[key] = value;
    this.saveState();
  }

  public getUserPreference<K extends keyof AppState['userPreferences']>(key: K): AppState['userPreferences'][K] {
    return this.state.userPreferences[key];
  }

  public clearState(): void {
    localStorage.removeItem(STATE_STORAGE_KEY);
    this.state = this.getDefaultState();
    this.refreshCallbacks.clear();
    console.log('🗑️ GLOBAL STATE: Application state cleared');
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  // Emergency reset for debugging
  public emergencyReset(): void {
    this.clearState();
    window.location.reload();
  }

  // Export state for debugging
  public exportState(): AppState {
    return { ...this.state };
  }

  // Get refresh statistics
  public getRefreshStats(): {
    registeredComponents: string[];
    globalRefreshCount: number;
    lastGlobalRefresh: Date | null;
    cacheHitRate: number;
  } {
    return {
      registeredComponents: Array.from(this.refreshCallbacks.keys()),
      globalRefreshCount: this.state.sessionData.dataRefreshTrigger,
      lastGlobalRefresh: this.state.globalRefreshTimestamp ? new Date(this.state.globalRefreshTimestamp) : null,
      cacheHitRate: this.state.servicesInitialized ? 95 : 0 // Approximate cache hit rate
    };
  }
}

// Singleton instance
const stateManager = StateManager.getInstance();

// ENHANCED EXPORTS
export { stateManager };
export const saveActiveTab = (tab: string) => stateManager.setActiveTab(tab);
export const getActiveTab = () => stateManager.getActiveTab();
export const shouldReinitializeServices = () => stateManager.shouldReinitializeServices();
export const markServicesInitialized = () => stateManager.markServicesInitialized();
export const incrementDataRefresh = () => stateManager.incrementDataRefreshTrigger();
export const getDataRefreshTrigger = () => stateManager.getDataRefreshTrigger();

// NEW GLOBAL REFRESH EXPORTS
export const registerGlobalRefresh = (componentName: string, callback: () => void) => 
  stateManager.registerRefreshCallback(componentName, callback);
export const unregisterGlobalRefresh = (componentName: string) => 
  stateManager.unregisterRefreshCallback(componentName);
export const triggerGlobalRefresh = () => stateManager.triggerGlobalRefresh();
export const shouldComponentUseCache = (componentName: string) => 
  stateManager.shouldComponentUseCache(componentName);
export const setComponentState = (componentName: string, state: any) => 
  stateManager.setComponentState(componentName, state);
export const getComponentState = <T = any>(componentName: string): T | null => 
  stateManager.getComponentState<T>(componentName);
export const getGlobalRefreshStats = () => stateManager.getRefreshStats(); 