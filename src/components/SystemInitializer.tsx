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
      <div className="system-error">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h1>System Initialization Failed</h1>
          <p className="error-message">{initState.error}</p>
          <div className="error-actions">
            <button onClick={handleRetry} className="retry-button">
              🔄 Retry Initialization
            </button>
          </div>
          <details className="error-details">
            <summary>Technical Details</summary>
            <pre>{initState.error}</pre>
          </details>
        </div>
        
        <style jsx>{`
          .system-error {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          .error-container {
            background: white;
            border-radius: 16px;
            padding: 48px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          }
          
          .error-icon {
            font-size: 64px;
            margin-bottom: 24px;
          }
          
          h1 {
            color: #1a1a1a;
            margin: 0 0 16px 0;
            font-size: 24px;
            font-weight: 600;
          }
          
          .error-message {
            color: #666;
            margin: 0 0 32px 0;
            line-height: 1.5;
          }
          
          .retry-button {
            background: #007AFF;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          
          .retry-button:hover {
            background: #0056CC;
            transform: translateY(-1px);
          }
          
          .error-details {
            margin-top: 24px;
            text-align: left;
          }
          
          .error-details summary {
            cursor: pointer;
            color: #666;
            font-size: 14px;
          }
          
          .error-details pre {
            background: #f5f5f5;
            padding: 16px;
            border-radius: 8px;
            font-size: 12px;
            overflow-x: auto;
            margin-top: 8px;
          }
        `}</style>
      </div>
    );
  }

  // Loading state
  return (
    <div className="system-loading">
      <div className="loading-container">
        <div className="loading-icon">
          <div className="spinner"></div>
        </div>
        <h1>Treasury Management System</h1>
        <p>Initializing services and components...</p>
        
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${initState.progress}%` }}
            ></div>
          </div>
          <div className="progress-text">{Math.round(initState.progress)}%</div>
        </div>
        
        <div className="loading-details">
          <div className="service-status">
            <span className="status-dot loading"></span>
            <span>Starting core services...</span>
          </div>
          <div className="service-status">
            <span className="status-dot loading"></span>
            <span>Initializing ML models...</span>
          </div>
          <div className="service-status">
            <span className="status-dot loading"></span>
            <span>Validating data integrity...</span>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .system-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .loading-container {
          background: white;
          border-radius: 16px;
          padding: 48px;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .loading-icon {
          margin-bottom: 24px;
        }
        
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007AFF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        h1 {
          color: #1a1a1a;
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
        }
        
        p {
          color: #666;
          margin: 0 0 32px 0;
        }
        
        .progress-container {
          margin-bottom: 32px;
        }
        
        .progress-bar {
          width: 100%;
          height: 8px;
          background: #f0f0f0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007AFF, #5856D6);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        
        .progress-text {
          color: #666;
          font-size: 14px;
          font-weight: 500;
        }
        
        .loading-details {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .service-status {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #666;
          font-size: 14px;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ccc;
        }
        
        .status-dot.loading {
          background: #007AFF;
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}; 