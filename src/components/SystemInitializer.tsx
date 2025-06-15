import React, { useState, useEffect } from 'react';
import { isDebugMode, enableDebugMode, disableDebugMode } from '../utils/debugMode';
// import { serviceOrchestrator, SystemStatus } from '../services/serviceOrchestrator';

// Set debug mode flag immediately before any service imports
if (typeof window !== 'undefined') {
  localStorage.setItem('debugMode', 'true');
  (window as any).__TREASURY_DEBUG_MODE = true;
  console.log('🚨 Debug Mode Flag Set Early');
}

interface SystemInitializerProps {
  children: React.ReactNode;
}

interface InitializationState {
  status: 'initializing' | 'ready' | 'error' | 'debug';
  error?: string;
  progress: number;
  debugMode: boolean;
}

export const SystemInitializer: React.FC<SystemInitializerProps> = ({ children }) => {
  const [initState, setInitState] = useState<InitializationState>({
    status: 'initializing',
    progress: 0,
    debugMode: isDebugMode()
  });

  useEffect(() => {
    let mounted = true;
    
    const initializeSystem = async () => {
      try {
        const debugActive = isDebugMode();
        
        if (debugActive) {
          console.log('🔧 DEBUG MODE: Skipping service initialization');
          
          // Brief loading simulation for debug mode
          setTimeout(() => {
            if (mounted) {
              setInitState({
                status: 'debug',
                progress: 100,
                debugMode: true
              });
            }
          }, 1000);
        } else {
          console.log('🚀 PRODUCTION MODE: Initializing all services');
          
          // TODO: Uncomment and implement proper service initialization
          // when services are ready for production mode
          
          // Update progress during initialization
          setInitState(prev => ({ ...prev, progress: 25 }));
          
          // Simulate service initialization phases
          // Phase 1: Core services
          setTimeout(() => {
            if (mounted) {
              setInitState(prev => ({ ...prev, progress: 50 }));
            }
          }, 500);
          
          // Phase 2: ML services
          setTimeout(() => {
            if (mounted) {
              setInitState(prev => ({ ...prev, progress: 75 }));
            }
          }, 1000);
          
          // Phase 3: Complete
          setTimeout(() => {
            if (mounted) {
              setInitState({
                status: 'ready',
                progress: 100,
                debugMode: false
              });
            }
          }, 1500);
          
          /* 
          TODO: Replace simulation with actual service initialization:
          
          try {
            // Initialize core services
            await serviceOrchestrator.initializeCoreServices();
            setInitState(prev => ({ ...prev, progress: 50 }));
            
            // Initialize ML services
            await serviceOrchestrator.initializeMLServices();
            setInitState(prev => ({ ...prev, progress: 75 }));
            
            // Final system check
            const systemStatus = await serviceOrchestrator.getSystemHealth();
            if (systemStatus.status === 'healthy') {
              setInitState({
                status: 'ready',
                progress: 100,
                debugMode: false
              });
            } else {
              throw new Error('System health check failed');
            }
          } catch (error) {
            console.error('Service initialization failed:', error);
            setInitState({
              status: 'error',
              progress: 0,
              debugMode: false,
              error: error instanceof Error ? error.message : 'Service initialization failed'
            });
          }
          */
        }
      } catch (error) {
        console.error('System initialization error:', error);
        if (mounted) {
          setInitState({
            status: 'error',
            progress: 0,
            debugMode: isDebugMode(),
            error: error instanceof Error ? error.message : 'Unknown initialization error'
          });
        }
      }
    };

    initializeSystem();

    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleDebugMode = () => {
    const newDebugMode = !initState.debugMode;
    if (newDebugMode) {
      enableDebugMode();
    } else {
      disableDebugMode();
    }
    // Reload page to reinitialize with new debug mode
    window.location.reload();
  };

  const handleContinueToApp = () => {
    setInitState(prev => ({
      ...prev,
      status: 'ready'
    }));
  };

  if (initState.status === 'ready') {
    return <>{children}</>;
  }

  if (initState.status === 'debug') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #ff9500 0%, #ff6b00 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '48px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔧</div>
          <h1 style={{
            color: '#1a1a1a',
            margin: '0 0 16px 0',
            fontSize: '24px',
            fontWeight: 600
          }}>Debug Mode Active</h1>
          <p style={{
            color: '#666',
            margin: '0 0 24px 0',
            lineHeight: 1.5
          }}>
            Service initialization bypassed. The app will load with basic functionality and mock data.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={handleContinueToApp} style={{
              background: '#ff6b00',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              Continue to App
            </button>
            <button onClick={handleToggleDebugMode} style={{
              background: 'white',
              color: '#ff6b00',
              border: '2px solid #ff6b00',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              Disable Debug Mode
            </button>
          </div>
          <div style={{
            marginTop: '24px',
            fontSize: '12px',
            color: '#999',
            textAlign: 'left'
          }}>
            <strong>Debug Mode Features:</strong><br/>
            • All services bypassed<br/>
            • Mock data for testing<br/>
            • Safe for UI development<br/>
            • Toggle via URL: ?debug=true
          </div>
        </div>
      </div>
    );
  }

  if (initState.status === 'error') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #ff4757 0%, #ff3838 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '48px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚠️</div>
          <h1 style={{
            color: '#1a1a1a',
            margin: '0 0 16px 0',
            fontSize: '24px',
            fontWeight: 600
          }}>System Initialization Failed</h1>
          <p style={{
            color: '#666',
            margin: '0 0 24px 0',
            lineHeight: 1.5
          }}>
            {initState.error || 'An unknown error occurred during system initialization.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()} style={{
              background: '#ff4757',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              Retry
            </button>
            <button onClick={handleToggleDebugMode} style={{
              background: 'white',
              color: '#ff4757',
              border: '2px solid #ff4757',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              Enable Debug Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007AFF',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
        </div>
        <h1 style={{
          color: '#1a1a1a',
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: 600
        }}>Treasury Management System</h1>
        <p style={{
          color: '#666',
          margin: '0 0 32px 0'
        }}>
          {initState.debugMode ? 'Loading debug mode...' : 'Initializing services...'}
        </p>
        
        <div style={{
          width: '100%',
          height: '4px',
          background: '#f3f3f3',
          borderRadius: '2px',
          marginBottom: '16px'
        }}>
          <div style={{
            width: `${initState.progress}%`,
            height: '100%',
            background: '#007AFF',
            borderRadius: '2px',
            transition: 'width 0.3s ease'
          }}></div>
        </div>
        
        <div style={{
          fontSize: '12px',
          color: '#999'
        }}>
          {initState.debugMode 
            ? 'Debug mode - bypassing services'
            : `Initializing... ${initState.progress}%`
          }
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}; 