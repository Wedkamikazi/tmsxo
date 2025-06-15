// EVENT BUS FOR REAL-TIME COMPONENT SYNCHRONIZATION - ENHANCED
type EventCallback = (data?: any) => void;
type ErrorCallback = (error: Error, event: DataEvent) => void;

export interface DataEvent {
  type: 'TRANSACTIONS_UPDATED' | 'FILE_UPLOADED' | 'FILE_DELETED' | 'ACCOUNT_UPDATED' | 'DATA_CLEARED' | 'ACCOUNTS_UPDATED' | 'FILES_UPDATED' | 'CATEGORIES_UPDATED' | 'MEMORY_EMERGENCY' | 'MEMORY_CRITICAL';
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
  private errorHandlers: Map<string, ErrorCallback[]> = new Map();
  private eventHistory: DataEvent[] = [];
  private maxHistorySize = 100;
  private maxRetries = 3;
  private deliveryQueue: DataEvent[] = [];
  private isProcessingQueue = false;

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

  // Enhanced emit with delivery guarantees
  emit(type: DataEvent['type'], payload?: any, source: string = 'unknown'): EventDeliveryResult {
    const event: DataEvent = {
      type,
      payload,
      timestamp: Date.now(),
      source,
      id: this.generateEventId(),
      retry: 0
    };

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    return this.deliverEvent(event);
  }

  // Legacy emit method for backward compatibility
  emitLegacy(type: DataEvent['type'], payload?: any, source: string = 'unknown'): void {
    this.emit(type, payload, source);
  }

  // Enhanced event delivery with error handling
  private deliverEvent(event: DataEvent): EventDeliveryResult {
    const result: EventDeliveryResult = {
      success: true,
      delivered: 0,
      failed: 0,
      errors: []
    };

    const callbacks = this.listeners.get(event.type);
    if (!callbacks || callbacks.length === 0) {
      console.log(`Event emitted: ${event.type}`, event.payload);
      return result;
    }

    callbacks.forEach((callback, index) => {
      try {
        callback(event.payload);
        result.delivered++;
      } catch (error) {
        result.failed++;
        result.success = false;
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          callback: `callback_${index}`,
          error: errorMessage
        });

        // Handle callback error
        this.handleCallbackError(error as Error, event, `callback_${index}`);
        
        // Retry if configured
        if ((event.retry || 0) < this.maxRetries) {
          this.scheduleRetry(event);
        }
      }
    });

    console.log(`Event delivered: ${event.type} (${result.delivered}/${result.delivered + result.failed})`, event.payload);
    return result;
  }

  // Subscribe to error events
  onError(eventType: string, callback: ErrorCallback): () => void {
    if (!this.errorHandlers.has(eventType)) {
      this.errorHandlers.set(eventType, []);
    }
    
    this.errorHandlers.get(eventType)!.push(callback);
    
    return () => {
      const callbacks = this.errorHandlers.get(eventType);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Enhanced error handling
  private handleCallbackError(error: Error, event: DataEvent, callbackId: string): void {
    console.error(`Event callback error for ${event.type}:`, error);
    
    // Notify error handlers
    const errorHandlers = this.errorHandlers.get(event.type) || [];
    errorHandlers.forEach(handler => {
      try {
        handler(error, event);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });

    // Emit system error event
    const systemErrorEvent: DataEvent = {
      type: 'DATA_CLEARED',
      payload: {
        eventError: {
          originalEvent: event.type,
          callbackId,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      },
      timestamp: Date.now(),
      source: 'EventBus',
      id: this.generateEventId()
    };

    // Prevent infinite loops by checking if this is already an error event
    if (event.type !== 'DATA_CLEARED' || !event.payload?.eventError) {
      this.eventHistory.push(systemErrorEvent);
    }
  }

  // Retry mechanism
  private scheduleRetry(event: DataEvent): void {
    const retryEvent = {
      ...event,
      retry: (event.retry || 0) + 1,
      timestamp: Date.now() + (1000 * Math.pow(2, event.retry || 0)) // Exponential backoff
    };

    this.deliveryQueue.push(retryEvent);
    this.processQueue();
  }

  // Queue processing
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.deliveryQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.deliveryQueue.length > 0) {
      const event = this.deliveryQueue.shift()!;
      
      // Wait for scheduled time
      if (event.timestamp > Date.now()) {
        this.deliveryQueue.unshift(event); // Put it back
        setTimeout(() => this.processQueue(), event.timestamp - Date.now());
        break;
      }

      // Deliver the retry
      this.deliverEvent(event);
    }

    this.isProcessingQueue = false;
  }

  // Get recent events
  getRecentEvents(count: number = 10): DataEvent[] {
    return this.eventHistory.slice(-count);
  }

  // Generate unique event ID
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clear all listeners
  clearAll(): void {
    this.listeners.clear();
    this.errorHandlers.clear();
    this.eventHistory = [];
    this.deliveryQueue = [];
  }
}

export const eventBus = new EventBus(); 