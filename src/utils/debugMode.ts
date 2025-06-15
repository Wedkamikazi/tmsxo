// Debug Mode Configuration
// This file sets the debug mode flag as early as possible

// Set debug mode flag immediately when this module loads
if (typeof window !== 'undefined') {
  (window as any).__TREASURY_DEBUG_MODE = true;
  localStorage.setItem('debugMode', 'true'); 
  console.log('🚨 Treasury Debug Mode Activated (Early Setup)');
}

// Export function to check debug mode
export const isDebugMode = (): boolean => {
  return typeof window !== 'undefined' && (
    window.location.search.includes('debug') || 
    localStorage.getItem('debugMode') === 'true' ||
    (window as any).__TREASURY_DEBUG_MODE === true
  );
};

// Export debug mode flag as constant for use in service checks
export const DEBUG_MODE_ACTIVE = typeof window !== 'undefined' && (
  window.location.search.includes('debug') || 
  localStorage.getItem('debugMode') === 'true' ||
  (window as any).__TREASURY_DEBUG_MODE === true
); 