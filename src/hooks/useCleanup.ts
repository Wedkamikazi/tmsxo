/**
 * REACT CLEANUP HOOK
 * Provides convenient cleanup functionality for React components
 * Automatically handles resource registration and cleanup on unmount
 */

import { useEffect, useRef, useCallback } from 'react';
import { cleanupManager } from '../services/cleanupManager';

interface UseCleanupOptions {
  componentName?: string;
  enableLogging?: boolean;
}

interface CleanupActions {
  registerTimer: (id: string, timer: NodeJS.Timeout) => void;
  registerInterval: (id: string, interval: NodeJS.Timeout) => void;
  registerEventListener: (id: string, element: EventTarget, event: string, listener: EventListener) => void;
  registerTensorFlowModel: (id: string, model: any) => void;
  registerWebWorker: (id: string, worker: Worker) => void;
  registerCustomResource: (id: string, resource: any, disposer: () => void, priority?: 'high' | 'medium' | 'low') => void;
  unregisterResource: (id: string) => void;
  markResourceAccessed: (id: string) => void;
  cleanup: () => void;
}

/**
 * Custom hook for managing component resources and cleanup
 */
export function useCleanup(options: UseCleanupOptions = {}): CleanupActions {
  const { componentName = 'UnknownComponent', enableLogging = false } = options;
  const componentRef = useRef<string>(componentName);
  const mountedRef = useRef<boolean>(true);

  // Update component name if it changes
  componentRef.current = componentName;

  // Cleanup function
  const cleanup = useCallback(() => {
    if (enableLogging) {
      console.log(`🧹 Cleaning up resources for ${componentRef.current}`);
    }
    cleanupManager.cleanupComponent(componentRef.current);
  }, [enableLogging]);

  // Register timer with automatic cleanup
  const registerTimer = useCallback((id: string, timer: NodeJS.Timeout) => {
    if (!mountedRef.current) return;
    
    const fullId = `${componentRef.current}-timer-${id}`;
    cleanupManager.registerTimer(fullId, timer, componentRef.current);
    
    if (enableLogging) {
      console.log(`📝 Registered timer: ${fullId}`);
    }
  }, [enableLogging]);

  // Register interval with automatic cleanup
  const registerInterval = useCallback((id: string, interval: NodeJS.Timeout) => {
    if (!mountedRef.current) return;
    
    const fullId = `${componentRef.current}-interval-${id}`;
    cleanupManager.registerInterval(fullId, interval, componentRef.current);
    
    if (enableLogging) {
      console.log(`📝 Registered interval: ${fullId}`);
    }
  }, [enableLogging]);

  // Register event listener with automatic cleanup
  const registerEventListener = useCallback((
    id: string, 
    element: EventTarget, 
    event: string, 
    listener: EventListener
  ) => {
    if (!mountedRef.current) return;
    
    const fullId = `${componentRef.current}-listener-${id}`;
    cleanupManager.registerEventListener(fullId, element, event, listener, componentRef.current);
    
    if (enableLogging) {
      console.log(`📝 Registered event listener: ${fullId} (${event})`);
    }
  }, [enableLogging]);

  // Register TensorFlow model with automatic cleanup
  const registerTensorFlowModel = useCallback((id: string, model: any) => {
    if (!mountedRef.current) return;
    
    const fullId = `${componentRef.current}-model-${id}`;
    cleanupManager.registerTensorFlowModel(fullId, model, componentRef.current);
    
    if (enableLogging) {
      console.log(`📝 Registered TensorFlow model: ${fullId}`);
    }
  }, [enableLogging]);

  // Register Web Worker with automatic cleanup
  const registerWebWorker = useCallback((id: string, worker: Worker) => {
    if (!mountedRef.current) return;
    
    const fullId = `${componentRef.current}-worker-${id}`;
    cleanupManager.registerWebWorker(fullId, worker, componentRef.current);
    
    if (enableLogging) {
      console.log(`📝 Registered Web Worker: ${fullId}`);
    }
  }, [enableLogging]);

  // Register custom resource with automatic cleanup
  const registerCustomResource = useCallback((
    id: string, 
    resource: any, 
    disposer: () => void,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ) => {
    if (!mountedRef.current) return;
    
    const fullId = `${componentRef.current}-custom-${id}`;
    cleanupManager.registerResource(fullId, 'custom', resource, disposer, componentRef.current, priority);
    
    if (enableLogging) {
      console.log(`📝 Registered custom resource: ${fullId}`);
    }
  }, [enableLogging]);

  // Unregister specific resource
  const unregisterResource = useCallback((id: string) => {
    const fullId = `${componentRef.current}-${id}`;
    const success = cleanupManager.unregisterResource(fullId);
    
    if (enableLogging) {
      console.log(`${success ? '✅' : '❌'} Unregistered resource: ${fullId}`);
    }
  }, [enableLogging]);

  // Mark resource as accessed (for LRU cleanup)
  const markResourceAccessed = useCallback((id: string) => {
    const fullId = `${componentRef.current}-${id}`;
    cleanupManager.markResourceAccessed(fullId);
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    registerTimer,
    registerInterval,
    registerEventListener,
    registerTensorFlowModel,
    registerWebWorker,
    registerCustomResource,
    unregisterResource,
    markResourceAccessed,
    cleanup
  };
}

/**
 * Specialized hook for TensorFlow.js models
 */
export function useTensorFlowCleanup(componentName?: string): {
  registerModel: (id: string, model: any) => void;
  unregisterModel: (id: string) => void;
  cleanup: () => void;
} {
  const { registerTensorFlowModel, unregisterResource, cleanup } = useCleanup({
    componentName: componentName || 'TensorFlowComponent',
    enableLogging: true
  });

  const registerModel = useCallback((id: string, model: any) => {
    registerTensorFlowModel(id, model);
  }, [registerTensorFlowModel]);

  const unregisterModel = useCallback((id: string) => {
    unregisterResource(`model-${id}`);
  }, [unregisterResource]);

  return {
    registerModel,
    unregisterModel,
    cleanup
  };
}

/**
 * Specialized hook for timers and intervals
 */
export function useTimerCleanup(componentName?: string): {
  createTimer: (id: string, callback: () => void, delay: number) => NodeJS.Timeout;
  createInterval: (id: string, callback: () => void, delay: number) => NodeJS.Timeout;
  clearTimer: (id: string) => void;
  clearInterval: (id: string) => void;
  cleanup: () => void;
} {
  const { registerTimer, registerInterval, unregisterResource, cleanup } = useCleanup({
    componentName: componentName || 'TimerComponent',
    enableLogging: false
  });

  const createTimer = useCallback((id: string, callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    registerTimer(id, timer);
    return timer;
  }, [registerTimer]);

  const createInterval = useCallback((id: string, callback: () => void, delay: number) => {
    const interval = setInterval(callback, delay);
    registerInterval(id, interval);
    return interval;
  }, [registerInterval]);

  const clearTimer = useCallback((id: string) => {
    unregisterResource(`timer-${id}`);
  }, [unregisterResource]);

  const clearIntervalFunc = useCallback((id: string) => {
    unregisterResource(`interval-${id}`);
  }, [unregisterResource]);

  return {
    createTimer,
    createInterval,
    clearTimer,
    clearInterval: clearIntervalFunc,
    cleanup
  };
}

/**
 * Specialized hook for event listeners
 */
export function useEventListenerCleanup(componentName?: string): {
  addEventListener: (id: string, element: EventTarget, event: string, listener: EventListener) => void;
  removeEventListener: (id: string) => void;
  cleanup: () => void;
} {
  const { registerEventListener, unregisterResource, cleanup } = useCleanup({
    componentName: componentName || 'EventComponent',
    enableLogging: false
  });

  const addEventListener = useCallback((
    id: string, 
    element: EventTarget, 
    event: string, 
    listener: EventListener
  ) => {
    // Add the event listener immediately
    element.addEventListener(event, listener);
    // Register for cleanup
    registerEventListener(id, element, event, listener);
  }, [registerEventListener]);

  const removeEventListener = useCallback((id: string) => {
    unregisterResource(`listener-${id}`);
  }, [unregisterResource]);

  return {
    addEventListener,
    removeEventListener,
    cleanup
  };
} 