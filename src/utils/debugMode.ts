// Debug Mode Configuration
// This file sets the debug mode flag as early as possible

// FORCE DEBUG MODE ALWAYS (for development)
if (typeof window !== 'undefined') {
  (window as any).__TREASURY_DEBUG_MODE = true;
  localStorage.setItem('debugMode', 'true'); 
  console.log('🚨 Treasury Debug Mode FORCED ON (Development Mode)');
}

// Export function to check debug mode
export const isDebugMode = (): boolean => {
  return true; // Always true for now
};

// Export debug mode flag as constant for use in service checks
export const DEBUG_MODE_ACTIVE = true; // Always true for now 