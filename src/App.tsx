import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SystemInitializer } from './components/SystemInitializer';
import { initializeSystemSafety } from './utils/systemSafetyManager';
import { shouldReinitializeServices } from './utils/stateManager';
import { dataFixerService } from './services/dataFixer';
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
        
        // Run data fixes after safety system is ready
        setTimeout(() => {
          try {
            dataFixerService.runAllFixes();
          } catch (error) {
            console.error('❌ Data fixer error during initialization:', error);
          }
        }, 500); // Small delay to ensure safety system is fully ready
        
      } catch (error) {
        console.error('❌ CRITICAL: Safety system failed to initialize:', error);
      }
    };
    
    initSafety();
  }, [canUseInstantRefresh]);

  // Run data fixes for instant refresh mode
  React.useEffect(() => {
    if (canUseInstantRefresh) {
      setTimeout(() => {
        try {
          dataFixerService.runAllFixes();
        } catch (error) {
          console.error('❌ Data fixer error in instant refresh mode:', error);
        }
      }, 100); // Small delay to avoid blocking initial render
    }
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