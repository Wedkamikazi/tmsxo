
#!/usr/bin/env node

/**
 * EMERGENCY SYSTEM TERMINATION SCRIPT
 * Terminates all active servers, nodes, and processes for the Treasury Management System
 * 
 * Usage: node terminate-all.js
 */

const { exec, spawn } = require('child_process');
const os = require('os');

console.log('🚨 EMERGENCY SYSTEM TERMINATION INITIATED');
console.log('🛑 Terminating all Treasury Management System processes...\n');

const isWindows = os.platform() === 'win32';

// List of processes to terminate
const processesToKill = [
  'node.exe',
  'npm.exe', 
  'ollama.exe',
  'react-scripts'
];

// List of ports to free up
const portsToFree = [3000, 3001, 11434];

async function killProcessesByName(processName) {
  return new Promise((resolve) => {
    const command = isWindows 
      ? `taskkill /F /IM ${processName} /T`
      : `pkill -f ${processName}`;
    
    console.log(`🛑 Terminating ${processName}...`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        if (error.message.includes('not found') || error.message.includes('No such process')) {
          console.log(`   ✅ No ${processName} processes found`);
        } else {
          console.log(`   ⚠️ ${processName}: ${error.message}`);
        }
      } else {
        console.log(`   ✅ ${processName} terminated successfully`);
      }
      resolve();
    });
  });
}

async function killProcessesByPort(port) {
  return new Promise((resolve) => {
    const command = isWindows
      ? `netstat -ano | findstr :${port}`
      : `lsof -ti:${port}`;
    
    console.log(`🛑 Freeing port ${port}...`);
    
    exec(command, (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        console.log(`   ✅ Port ${port} is already free`);
        resolve();
        return;
      }
      
      if (isWindows) {
        // Parse Windows netstat output to get PID
        const lines = stdout.trim().split('\n');
        const pids = lines.map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1];
        }).filter(pid => pid && pid !== '0');
        
        if (pids.length > 0) {
          const killCommand = `taskkill /F /PID ${pids.join(' /PID ')}`;
          exec(killCommand, (killError) => {
            if (killError) {
              console.log(`   ⚠️ Port ${port}: ${killError.message}`);
            } else {
              console.log(`   ✅ Port ${port} freed successfully`);
            }
            resolve();
          });
        } else {
          console.log(`   ✅ Port ${port} is already free`);
          resolve();
        }
      } else {
        // Unix/Linux - kill processes using the port
        const pids = stdout.trim().split('\n').filter(pid => pid);
        if (pids.length > 0) {
          const killCommand = `kill -9 ${pids.join(' ')}`;
          exec(killCommand, (killError) => {
            if (killError) {
              console.log(`   ⚠️ Port ${port}: ${killError.message}`);
            } else {
              console.log(`   ✅ Port ${port} freed successfully`);
            }
            resolve();
          });
        } else {
          console.log(`   ✅ Port ${port} is already free`);
          resolve();
        }
      }
    });
  });
}

async function terminateAll() {
  const startTime = Date.now();
  
  try {
    console.log('STEP 1: Terminating processes by name...');
    for (const processName of processesToKill) {
      await killProcessesByName(processName);
    }
    
    console.log('\nSTEP 2: Freeing up ports...');
    for (const port of portsToFree) {
      await killProcessesByPort(port);
    }
    
    console.log('\nSTEP 3: Additional cleanup...');
    
    // Kill any remaining Node.js processes
    if (isWindows) {
      await new Promise(resolve => {
        exec('wmic process where "name=\'node.exe\'" delete', (error) => {
          if (error && !error.message.includes('No Instance(s) Available')) {
            console.log('   ⚠️ Additional Node.js cleanup:', error.message);
          } else {
            console.log('   ✅ Additional Node.js processes cleaned');
          }
          resolve();
        });
      });
    }
    
    // Clear npm cache if needed
    console.log('   🧹 Clearing npm cache...');
    await new Promise(resolve => {
      exec('npm cache clean --force', (error) => {
        if (error) {
          console.log('   ⚠️ npm cache clean:', error.message);
        } else {
          console.log('   ✅ npm cache cleared');
        }
        resolve();
      });
    });
    
    const duration = Date.now() - startTime;
    
    console.log('\n✅ SYSTEM TERMINATION COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`Duration: ${duration}ms`);
    console.log('All Treasury Management System processes terminated');
    console.log('Ports 3000, 3001, and 11434 are now free');
    console.log('System is ready for fresh restart');
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR during termination:', error);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Termination interrupted by user');
  process.exit(0);
});

// Start termination
terminateAll().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
