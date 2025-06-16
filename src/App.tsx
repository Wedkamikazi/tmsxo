import React from 'react';
import { ErrorBoundary, SystemInitializer, DataHub } from '@/ui';
import { initializeSystemSafety, shouldReinitializeServices } from '@/core';
import { isDebugMode } from '@/shared/utils/debugging/DebugMode';
import './ui/styles/globals.css';

// Import DataHub conditionally only for full initialization
const LazyDataHub = React.lazy(() => import('@/ui').then(module => ({ default: module.DataHub })));

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
        
        // CRITICAL: Set debug mode for safer initialization
        if (!isDebugMode()) {
          console.log('⚠️ BROWSER HANG PREVENTION: Enabling debug mode for safer startup');
          localStorage.setItem('treasury_debug_mode', 'true');
          window.location.reload(); // Reload to apply debug mode
          return;
        }
        
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
    console.log('🚀 INSTANT REFRESH: No loading, no delays - direct render like normal web apps');
    return (
      <ErrorBoundary componentName="App">
        <div className="App">
          <ErrorBoundary componentName="DataHub">
            <DataHub />
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
                  <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.8 }}>
                    {isDebugMode() ? '🔧 Debug Mode: Lightweight initialization' : '🚀 Production Mode: Full features'}
                  </div>
                </div>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            }>
              <LazyDataHub />
            </React.Suspense>
          </ErrorBoundary>
        </div>
      </SystemInitializer>
    </ErrorBoundary>
  );
}

export default App; 