import React, { useState, useEffect } from 'react';
import { isDebugMode, enableDebugMode, disableDebugMode } from '../utils/debugMode';
import { systemSafetyManager, initializeSystemSafety } from '../utils/systemSafetyManager';
import { storageQuotaManager } from '../services/storageQuotaManager';
import { shouldReinitializeServices } from '../utils/stateManager';
import { fixInvalidTransactionDatesAdvanced, validateTransactionDates } from '../utils/dataFixUtility';
// import { serviceOrchestrator, SystemStatus } from '../services/serviceOrchestrator';

interface SystemInitializerProps {
  children: React.ReactNode;
}

export const SystemInitializer: React.FC<SystemInitializerProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(() => {
    // INSTANT REFRESH: If services are cached, bypass initialization screen
    const canUseCache = !shouldReinitializeServices();
    if (canUseCache) {
      console.log('🚀 INSTANT REFRESH: Bypassing initialization screen - using cached state');
      return true;
    }
    return false;
  });
  
  const [initializationStatus, setInitializationStatus] = useState('Starting...');
  const [debugMode, setDebugMode] = useState(isDebugMode());
  const [safetyStatus, setSafetyStatus] = useState('Initializing...');
  const [dataFixStatus, setDataFixStatus] = useState('');
  const [showDataFix, setShowDataFix] = useState(false);

  useEffect(() => {
    // If already initialized (using cache), skip initialization
    if (isInitialized) {
      console.log('✅ Using cached state - no initialization needed');
      return;
    }
    
    initializeSystem();
  }, [isInitialized]);

  const initializeSystem = async () => {
    try {
      // STEP 1: CRITICAL - Initialize Safety System FIRST (only once)
      setInitializationStatus('🛡️ Initializing System Safety Manager...');
      setSafetyStatus('Enforcing safety rules...');
      
      await initializeSystemSafety();
      setSafetyStatus('✅ Safety system active - No duplicates allowed');
      
      // STEP 2: Register Treasury System process (allow duplicates in dev mode)
      const canStartTreasury = systemSafetyManager.registerProcess('treasury-system', 3000);
      if (canStartTreasury) {
        console.log('✅ Treasury system registered successfully');
      }

      // STEP 3: Initialize Storage Quota Manager (fast)
      setInitializationStatus('📊 Initializing Storage Quota Manager...');
      console.log('📊 Starting Storage Quota Manager...');
      
      // Make services available globally for testing (no delays needed)
      if (typeof window !== 'undefined') {
        (window as any).storageQuotaManager = storageQuotaManager;
        
        // Import other services for testing (parallel imports)
        const [unifiedDataServiceModule, eventBusModule] = await Promise.all([
          import('../services/unifiedDataService'),
          import('../services/eventBus')
        ]);
        
        (window as any).unifiedDataService = unifiedDataServiceModule.unifiedDataService;
        (window as any).eventBus = eventBusModule.eventBus;
        
        console.log('✅ Storage Quota Manager ready and available globally');
        console.log('🧪 Test suite available in browser console');
        console.log('📋 Open http://localhost:3000/test-quota-management.html for test interface');
      }

      // STEP 4: Continue with normal initialization
      setInitializationStatus('Initializing services...');
      
      const currentDebugMode = isDebugMode();
      setDebugMode(currentDebugMode);

      if (currentDebugMode) {
        setInitializationStatus('🔧 Debug Mode: Initializing mock services...');
        // Initialize mock services (fast)
        await new Promise(resolve => setTimeout(resolve, 200));
        setInitializationStatus('✅ Debug services initialized');
      } else {
        setInitializationStatus('🚀 Production Mode: Initializing full services...');
        // Initialize production services (fast)
        await new Promise(resolve => setTimeout(resolve, 300));
        setInitializationStatus('✅ Production services initialized');
      }

      setIsInitialized(true);
      setInitializationStatus('✅ System ready');
      
    } catch (error) {
      console.error('❌ System initialization failed:', error);
      setInitializationStatus('❌ Initialization failed');
    }
  };

  const getSystemStatus = () => {
    return systemSafetyManager.getSystemStatus();
  };

  const handleDebugToggle = () => {
    if (debugMode) {
      disableDebugMode();
    } else {
      enableDebugMode();
    }
    setDebugMode(!debugMode);
  };

  const handleEmergencyStop = () => {
    systemSafetyManager.emergencyStop();
  };

  const handleDataFix = async () => {
    setDataFixStatus('🔧 Checking transaction dates...');
    
    // First validate to see if there are any issues
    const validation = validateTransactionDates();
    
    if (validation.invalid === 0) {
      setDataFixStatus('✅ All transaction dates are valid - no fix needed');
      return;
    }
    
    setDataFixStatus(`⚠️ Found ${validation.invalid} invalid dates. Fixing...`);
    
    // Run the advanced fix
    const result = fixInvalidTransactionDatesAdvanced();
    
    if (result.fixed > 0) {
      setDataFixStatus(`✅ Fixed ${result.fixed} transactions with invalid dates`);
    } else {
      setDataFixStatus('❌ Could not fix invalid dates - check console for details');
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setDataFixStatus('');
    }, 5000);
  };

  // INSTANT REFRESH: If initialized immediately (using cache), render children directly
  if (isInitialized && !shouldReinitializeServices()) {
    const systemStatus = getSystemStatus();
    return (
      <>
        {/* PERMANENT SAFETY DASHBOARD */}
        <div className="safety-dashboard" style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '10px',
          backgroundColor: systemStatus.isHealthy ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${systemStatus.isHealthy ? '#4CAF50' : '#f44336'}`,
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          <div><strong>🛡️ Safety:</strong> {systemStatus.isHealthy ? '✅' : '⚠️'}</div>
          <div><strong>Processes:</strong> {systemStatus.runningProcesses.length}</div>
          <div><strong>Memory:</strong> {systemStatus.memoryUsage.toFixed(1)}MB</div>
          <button 
            onClick={handleEmergencyStop}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '2px 8px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px',
              marginTop: '5px'
            }}
          >
            🚨 STOP
          </button>
        </div>

        {/* RENDER CHILDREN (MAIN APP) */}
        {children}

        {/* DEBUG CONTROLS */}
        <div className="debug-controls" style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          padding: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid #ccc',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          <div><strong>Debug Mode:</strong> {debugMode ? '🔧 ON' : '🚀 OFF'}</div>
          <button onClick={handleDebugToggle} style={{
            padding: '5px 10px',
            marginTop: '5px',
            fontSize: '11px',
            cursor: 'pointer'
          }}>
            {debugMode ? 'Switch to Production' : 'Switch to Debug'}
          </button>
        </div>
      </>
    );
  }

  // FULL INITIALIZATION: Show loading screen only when necessary
  if (!isInitialized) {
    const systemStatus = getSystemStatus();
    
    return (
      <div className="system-initializer">
        <div className="initialization-screen">
          <h2>🏦 Treasury Management System</h2>
          
          {/* SAFETY STATUS - ALWAYS VISIBLE */}
          <div className="safety-status" style={{
            padding: '15px',
            margin: '10px 0',
            border: `2px solid ${systemStatus.isHealthy ? '#4CAF50' : '#f44336'}`,
            borderRadius: '8px',
            backgroundColor: systemStatus.isHealthy ? '#e8f5e9' : '#ffebee'
          }}>
            <h3>🛡️ System Safety Status</h3>
            <p><strong>Status:</strong> {safetyStatus}</p>
            <p><strong>Health:</strong> {systemStatus.isHealthy ? '✅ Healthy' : '⚠️ Issues Detected'}</p>
            <p><strong>Running Processes:</strong> {systemStatus.runningProcesses.length}</p>
            <p><strong>Memory Usage:</strong> {systemStatus.memoryUsage.toFixed(2)}MB</p>
            {systemStatus.warnings.length > 0 && (
              <div style={{ color: '#f44336', marginTop: '10px' }}>
                <strong>⚠️ Warnings:</strong>
                <ul>
                  {systemStatus.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="status-display">
            <p>{initializationStatus}</p>
            <div className="loading-spinner">⏳</div>
          </div>

          <div className="debug-controls">
            <p>Debug Mode: {debugMode ? '🔧 ON (Mock Services)' : '🚀 OFF (Production Services)'}</p>
            <button onClick={handleDebugToggle} disabled={true}>
              Toggle Debug Mode (Disabled during initialization)
            </button>
          </div>

          {/* EMERGENCY STOP BUTTON */}
          <div className="emergency-controls">
            <button 
              onClick={handleEmergencyStop}
              style={{
                backgroundColor: '#f44336',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              🚨 EMERGENCY STOP
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FULLY INITIALIZED: Render children with safety dashboard
  const systemStatus = getSystemStatus();
  
  return (
    <>
      {/* PERMANENT SAFETY DASHBOARD */}
      <div className="safety-dashboard" style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '10px',
        backgroundColor: systemStatus.isHealthy ? '#e8f5e9' : '#ffebee',
        border: `1px solid ${systemStatus.isHealthy ? '#4CAF50' : '#f44336'}`,
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 1000
      }}>
        <div><strong>🛡️ Safety:</strong> {systemStatus.isHealthy ? '✅' : '⚠️'}</div>
        <div><strong>Processes:</strong> {systemStatus.runningProcesses.length}</div>
        <div><strong>Memory:</strong> {systemStatus.memoryUsage.toFixed(1)}MB</div>
        <button 
          onClick={handleEmergencyStop}
          style={{
            backgroundColor: '#f44336',
            color: 'white',
            padding: '2px 8px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            marginTop: '5px'
          }}
        >
          🚨 STOP
        </button>
      </div>

      {/* RENDER CHILDREN (MAIN APP) */}
      {children}

      {/* DEBUG CONTROLS */}
      <div className="debug-controls" style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        padding: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        border: '1px solid #ccc',
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 1000
      }}>
        <div><strong>Debug Mode:</strong> {debugMode ? '🔧 ON' : '🚀 OFF'}</div>
        <button onClick={handleDebugToggle} style={{
          padding: '5px 10px',
          marginTop: '5px',
          fontSize: '11px',
          cursor: 'pointer'
        }}>
          {debugMode ? 'Switch to Production' : 'Switch to Debug'}
        </button>
      </div>
    </>
  );
}; 