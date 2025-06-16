"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
class EventBus {
    constructor() {
        this.listeners = new Map();
        this.errorHandlers = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
        this.maxRetries = 3;
        this.deliveryQueue = [];
        this.isProcessingQueue = false;
    }
    // Subscribe to events
    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
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
    emit(type, payload, source = 'unknown') {
        const event = {
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
    emitLegacy(type, payload, source = 'unknown') {
        this.emit(type, payload, source);
    }
    // Enhanced event delivery with error handling
    deliverEvent(event) {
        const result = {
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
            }
            catch (error) {
                result.failed++;
                result.success = false;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push({
                    callback: `callback_${index}`,
                    error: errorMessage
                });
                // Handle callback error
                this.handleCallbackError(error, event, `callback_${index}`);
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
    onError(eventType, callback) {
        if (!this.errorHandlers.has(eventType)) {
            this.errorHandlers.set(eventType, []);
        }
        this.errorHandlers.get(eventType).push(callback);
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
    handleCallbackError(error, event, callbackId) {
        var _a;
        console.error(`Event callback error for ${event.type}:`, error);
        // Notify error handlers
        const errorHandlers = this.errorHandlers.get(event.type) || [];
        errorHandlers.forEach(handler => {
            try {
                handler(error, event);
            }
            catch (handlerError) {
                console.error('Error in error handler:', handlerError);
            }
        });
        // Emit system error event
        const systemErrorEvent = {
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
        if (event.type !== 'DATA_CLEARED' || !((_a = event.payload) === null || _a === void 0 ? void 0 : _a.eventError)) {
            this.eventHistory.push(systemErrorEvent);
        }
    }
    // Retry mechanism
    scheduleRetry(event) {
        const retryEvent = {
            ...event,
            retry: (event.retry || 0) + 1,
            timestamp: Date.now() + (1000 * Math.pow(2, event.retry || 0)) // Exponential backoff
        };
        this.deliveryQueue.push(retryEvent);
        this.processQueue();
    }
    // Queue processing
    async processQueue() {
        if (this.isProcessingQueue || this.deliveryQueue.length === 0) {
            return;
        }
        this.isProcessingQueue = true;
        while (this.deliveryQueue.length > 0) {
            const event = this.deliveryQueue.shift();
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
    getRecentEvents(count = 10) {
        return this.eventHistory.slice(-count);
    }
    // Generate unique event ID
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // Clear all listeners
    clearAll() {
        this.listeners.clear();
        this.errorHandlers.clear();
        this.eventHistory = [];
        this.deliveryQueue = [];
    }
}
exports.eventBus = new EventBus();
