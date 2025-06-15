import React, { useState, useEffect } from 'react';
// import { serviceOrchestrator, SystemStatus } from '../services/serviceOrchestrator';

interface SystemInitializerProps {
  children: React.ReactNode;
}

interface InitializationState {
  status: 'initializing' | 'ready' | 'emergency';
  error?: string;
  progress: number;
}

export const SystemInitializer: React.FC<SystemInitializerProps> = ({ children }) => {
  const [initState, setInitState] = useState<InitializationState>({
    status: 'initializing',
    progress: 0
  });

  useEffect(() => {
    let mounted = true;
    
    // TEMPORARY DEBUG MODE - Skip all service initialization
    console.log('🚨 DEBUG MODE: Skipping service initialization');
    
    // Set debug mode flag for other components
    localStorage.setItem('debugMode', 'true');
    
    // Simulate brief loading then go to emergency mode
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        setInitState({
          status: 'emergency',
          progress: 100,
          error: 'Debug mode - services bypassed'
        });
        
        // Auto-continue after 2 seconds
        setTimeout(() => {
          if (mounted) {
            setInitState(prev => ({
              ...prev,
              status: 'ready'
            }));
          }
        }, 2000);
      }
    }, 1000);

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
    };
  }, []);

  const handleEmergencyMode = () => {
    setInitState(prev => ({
      ...prev,
      status: 'ready',
      progress: 100
    }));
  };

  if (initState.status === 'ready') {
    return <>{children}</>;
  }

  if (initState.status === 'emergency') {
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
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚨</div>
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
            Service initialization bypassed. The app will load with basic functionality only.
            {initState.error && (
              <><br/><br/>
              <span style={{ fontSize: '14px', color: '#ff6b00' }}>
                {initState.error}
              </span>
              </>
            )}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={handleEmergencyMode} style={{
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
          </div>
          <div style={{
            marginTop: '24px',
            fontSize: '12px',
            color: '#999',
            textAlign: 'left'
          }}>
            <strong>Debug Mode:</strong><br/>
            • All services bypassed<br/>
            • Basic functionality only<br/>
            • Safe for testing UI components
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
        }}>Loading debug mode...</p>
        
        <div style={{
          fontSize: '12px',
          color: '#999'
        }}>
          Debug mode - bypassing services
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