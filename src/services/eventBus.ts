// EVENT BUS FOR REAL-TIME COMPONENT SYNCHRONIZATION - ENHANCED
type EventCallback = (data?: any) => void;
type ErrorCallback = (error: Error, event: DataEvent) => void;

export interface DataEvent {
  type: 'TRANSACTIONS_UPDATED' | 'FILE_UPLOADED' | 'FILE_DELETED' | 'ACCOUNT_UPDATED' | 'DATA_CLEARED' | 'ACCOUNTS_UPDATED' | 'FILES_UPDATED' | 'CATEGORIES_UPDATED';
  payload?: any;
  timestamp: number;
  source: string;
  id?: string; // For delivery tracking
  retry?: number; // Retry count
}

export interface EventDeliveryResult {
  success: boolean;
  delivered: number;
  failed: number;
  errors: Array<{ callback: string; error: string }>;
}

class EventBus {
  private listeners: Map<string, EventCallback[]> = new Map();
  private eventHistory: DataEvent[] = [];
  private maxHistorySize = 100;

  // Subscribe to events
  on(eventType: string, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Emit events
  emit(type: DataEvent['type'], payload?: any, source: string = 'unknown'): void {
    const event: DataEvent = {
      type,
      payload,
      timestamp: Date.now(),
      source
    };

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in event callback for ${type}:`, error);
        }
      });
    }

    console.log(`Event emitted: ${type}`, payload);
  }

  // Get recent events
  getRecentEvents(count: number = 10): DataEvent[] {
    return this.eventHistory.slice(-count);
  }

  // Clear all listeners
  clearAll(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }
}

export const eventBus = new EventBus(); 