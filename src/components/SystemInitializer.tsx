import React, { useState, useEffect } from 'react';
import { serviceOrchestrator, SystemStatus } from '../services/serviceOrchestrator';

interface SystemInitializerProps {
  children: React.ReactNode;
}

interface InitializationState {
  status: 'initializing' | 'ready' | 'error';
  systemStatus?: SystemStatus;
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
    
    const initializeSystem = async () => {
      try {
        console.log('🚀 Starting Treasury Management System...');
        
        // Start system initialization
        const systemStatus = await serviceOrchestrator.initializeSystem();
        
        if (!mounted) return;
        
        setInitState({
          status: 'ready',
          systemStatus,
          progress: 100
        });
        
        console.log('✅ Treasury Management System Ready');
        
      } catch (error) {
        console.error('❌ System initialization failed:', error);
        
        if (!mounted) return;
        
        setInitState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown initialization error',
          progress: 0
        });
      }
    };

    // Start initialization
    initializeSystem();
    
    // Simulate progress updates during initialization
    const progressInterval = setInterval(() => {
      setInitState(prev => {
        if (prev.status !== 'initializing' || prev.progress >= 90) {
          return prev;
        }
        return {
          ...prev,
          progress: Math.min(prev.progress + Math.random() * 15, 90)
        };
      });
    }, 500);

    return () => {
      mounted = false;
      clearInterval(progressInterval);
    };
  }, []);

  const handleRetry = () => {
    setInitState({
      status: 'initializing',
      progress: 0
    });
    
    // Trigger re-initialization
    window.location.reload();
  };

  if (initState.status === 'ready') {
    return <>{children}</>;
  }

  if (initState.status === 'error') {
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
            margin: '0 0 32px 0',
            lineHeight: 1.5
          }}>{initState.error}</p>
          <div>
            <button onClick={handleRetry} style={{
              background: '#007AFF',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              🔄 Retry Initialization
            </button>
          </div>
          <details style={{ marginTop: '24px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', color: '#666', fontSize: '14px' }}>
              Technical Details
            </summary>
            <pre style={{
              background: '#f5f5f5',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '12px',
              overflowX: 'auto',
              marginTop: '8px'
            }}>{initState.error}</pre>
          </details>
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
        }}>Initializing services and components...</p>
        
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '100%',
            height: '8px',
            background: '#f0f0f0',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '8px'
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #007AFF, #5856D6)',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
              width: `${initState.progress}%`
            }}></div>
          </div>
          <div style={{
            color: '#666',
            fontSize: '14px',
            fontWeight: 500
          }}>{Math.round(initState.progress)}%</div>
        </div>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#666',
            fontSize: '14px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#007AFF',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}></span>
            <span>Starting core services...</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#666',
            fontSize: '14px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#007AFF',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}></span>
            <span>Initializing ML models...</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#666',
            fontSize: '14px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#007AFF',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}></span>
            <span>Validating data integrity...</span>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}; 