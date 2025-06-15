import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SystemInitializer } from './components/SystemInitializer';
import { initializeSystemSafety } from './utils/systemSafetyManager';
import { shouldReinitializeServices } from './utils/stateManager';
import { DataHub } from './components/DataHub'; // Direct import for instant refresh
import './styles/globals.css';

// Import DataHub conditionally only for full initialization
const LazyDataHub = React.lazy(() => import('./components/DataHub').then(module => ({ default: module.DataHub })));

function App(): React.ReactElement {
  // Check if we can use instant refresh
  const canUseInstantRefresh = !shouldReinitializeServices();
  
  // Initialize safety system immediately when App loads (only if not using instant refresh)
  React.useEffect(() => {
    if (canUseInstantRefresh) {
      console.log('🚀 INSTANT REFRESH: Skipping safety system init - using cached state');
      return;
    }
    
    const initSafety = async () => {
      try {
        console.log('🛡️ App starting - Initializing safety system...');
        await initializeSystemSafety();
        console.log('✅ Safety system ready - App can proceed safely');
      } catch (error) {
        console.error('❌ CRITICAL: Safety system failed to initialize:', error);
      }
    };
    
    initSafety();
  }, [canUseInstantRefresh]);

  // INSTANT REFRESH: If we can use cached state, skip SystemInitializer entirely
  if (canUseInstantRefresh) {
    console.log('🚀 INSTANT REFRESH: Bypassing SystemInitializer completely');
    return (
      <ErrorBoundary componentName="App">
        <div className="App">
          <ErrorBoundary componentName="DataHub">
            <React.Suspense fallback={
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    margin: '0 auto 8px'
                  }}></div>
                  <div style={{ fontSize: '14px', fontWeight: 500, opacity: 0.9 }}>Instant loading...</div>
                </div>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            }>
              <DataHub />
            </React.Suspense>
          </ErrorBoundary>
        </div>
      </ErrorBoundary>
    );
  }

  // FULL INITIALIZATION: Use SystemInitializer for first-time or expired cache
  return (
    <ErrorBoundary componentName="App">
      <SystemInitializer>
        <div className="App">
          <ErrorBoundary componentName="DataHub">
            <React.Suspense fallback={
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    border: '4px solid rgba(255,255,255,0.3)',
                    borderTop: '4px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px'
                  }}></div>
                  <div style={{ fontSize: '18px', fontWeight: 500 }}>Loading Treasury Management System...</div>
                </div>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            }>
              <DataHub />
            </React.Suspense>
          </ErrorBoundary>
        </div>
      </SystemInitializer>
    </ErrorBoundary>
  );
}

export default App; 