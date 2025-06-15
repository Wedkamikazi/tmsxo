/**
 * PROFESSIONAL STATE MANAGER
 * Persistent state management for Treasury Management System
 * Prevents unnecessary reinitialization and maintains user context
 */

interface AppState {
  activeTab: string;
  servicesInitialized: boolean;
  lastInitializationTime: number;
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
const STATE_VERSION = '1.0';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

class StateManager {
  private static instance: StateManager;
  private state: AppState;
  private initialized = false;

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
          console.log('✅ State restored from cache:', {
            activeTab: this.state.activeTab,
            servicesInitialized: this.state.servicesInitialized,
            cacheAge: Math.round((now - parsed.timestamp) / 1000) + 's'
          });
        } else {
          console.log('⏰ State cache expired or version mismatch, using defaults');
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

  // Public methods for state management
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
    console.log('📂 Active tab saved:', tab);
  }

  public getActiveTab(): string {
    return this.state.activeTab;
  }

  public markServicesInitialized(): void {
    this.state.servicesInitialized = true;
    this.state.lastInitializationTime = Date.now();
    this.saveState();
    console.log('✅ Services initialization state saved');
  }

  public shouldReinitializeServices(): boolean {
    const now = Date.now();
    const timeSinceInit = now - this.state.lastInitializationTime;
    
    // Only reinitialize if more than 5 minutes have passed or never initialized
    const shouldReinit = !this.state.servicesInitialized || timeSinceInit > (5 * 60 * 1000);
    
    if (!shouldReinit) {
      console.log('⚡ Skipping service reinitialization - still fresh:', {
        lastInit: Math.round(timeSinceInit / 1000) + 's ago',
        servicesInitialized: this.state.servicesInitialized
      });
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

  public setUserPreference(key: keyof AppState['userPreferences'], value: any): void {
    this.state.userPreferences[key] = value;
    this.saveState();
  }

  public getUserPreference(key: keyof AppState['userPreferences']): any {
    return this.state.userPreferences[key];
  }

  public clearState(): void {
    localStorage.removeItem(STATE_STORAGE_KEY);
    this.state = this.getDefaultState();
    console.log('🗑️ Application state cleared');
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
  public exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }
}

// Singleton instance
export const stateManager = StateManager.getInstance();

// Convenience functions
export const saveActiveTab = (tab: string) => stateManager.setActiveTab(tab);
export const getActiveTab = () => stateManager.getActiveTab();
export const shouldReinitializeServices = () => stateManager.shouldReinitializeServices();
export const markServicesInitialized = () => stateManager.markServicesInitialized();
export const incrementDataRefresh = () => stateManager.incrementDataRefreshTrigger();
export const getDataRefreshTrigger = () => stateManager.getDataRefreshTrigger(); 