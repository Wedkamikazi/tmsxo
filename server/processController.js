const express = require('express');
const { spawn, exec } = require('child_process');
const cors = require('cors');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

let ollamaProcess = null;

// Root route to prevent 404 when accessing localhost:3001
app.get('/', (req, res) => {
  res.json({ 
    message: 'Treasury Process Controller Server',
    status: 'running',
    endpoints: {
      status: 'GET /api/ollama/status',
      start: 'POST /api/ollama/start',
      stop: 'POST /api/ollama/stop'
    }
  });
});

// Start Ollama
app.post('/api/ollama/start', (req, res) => {
  if (ollamaProcess) {
    return res.json({ success: false, message: 'Ollama is already running' });
  }

  try {
    // Set environment variables and start Ollama
    const env = {
      ...process.env,
      OLLAMA_ORIGINS: '*',
      OLLAMA_NUM_PARALLEL: '1',
      OLLAMA_MAX_LOADED_MODELS: '1',
      OLLAMA_GPU_OVERHEAD: '2048'
    };

    ollamaProcess = spawn('ollama', ['serve'], { 
      env,
      detached: false,
      stdio: 'pipe'
    });

    ollamaProcess.on('error', (error) => {
      console.error('Failed to start Ollama:', error);
      ollamaProcess = null;
      res.json({ success: false, message: `Failed to start Ollama: ${error.message}` });
    });

    ollamaProcess.on('exit', (code) => {
      console.log(`Ollama process exited with code ${code}`);
      ollamaProcess = null;
    });

    // Give it a moment to start
    setTimeout(() => {
      if (ollamaProcess && !ollamaProcess.killed) {
        res.json({ 
          success: true, 
          message: 'Ollama started successfully',
          pid: ollamaProcess.pid 
        });
      }
    }, 1000);

  } catch (error) {
    console.error('Error starting Ollama:', error);
    res.json({ success: false, message: `Error starting Ollama: ${error.message}` });
  }
});

// Stop Ollama
app.post('/api/ollama/stop', (req, res) => {
  try {
    // Kill any existing Ollama processes
    exec('taskkill /F /IM ollama.exe', (error, stdout, stderr) => {
      if (error && !error.message.includes('not found')) {
        console.error('Error stopping Ollama:', error);
        return res.json({ success: false, message: `Error stopping Ollama: ${error.message}` });
      }
      
      if (ollamaProcess) {
        ollamaProcess.kill('SIGTERM');
        ollamaProcess = null;
      }
      
      res.json({ 
        success: true, 
        message: 'Ollama stopped successfully' 
      });
    });
  } catch (error) {
    console.error('Error stopping Ollama:', error);
    res.json({ success: false, message: `Error stopping Ollama: ${error.message}` });
  }
});

// Check Ollama status
app.get('/api/ollama/status', async (req, res) => {
  try {
    // Use built-in fetch in newer Node.js or fallback to simple HTTP check
    const http = require('http');
    
    const checkOllama = () => {
      return new Promise((resolve) => {
        const req = http.get('http://localhost:11434/api/tags', (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve({ success: true, data: parsed });
            } catch (e) {
              resolve({ success: false, error: 'Invalid JSON' });
            }
          });
        });
        
        req.on('error', () => {
          resolve({ success: false, error: 'Connection failed' });
        });
        
        req.setTimeout(2000, () => {
          req.destroy();
          resolve({ success: false, error: 'Timeout' });
        });
      });
    };
    
    const result = await checkOllama();
    
    if (result.success) {
      res.json({ 
        isRunning: true, 
        models: result.data.models || [],
        processRunning: ollamaProcess !== null
      });
    } else {
      res.json({ 
        isRunning: false,
        processRunning: ollamaProcess !== null,
        error: result.error
      });
    }
  } catch (error) {
    res.json({ 
      isRunning: false,
      processRunning: ollamaProcess !== null,
      error: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Process Controller Server running on http://localhost:${port}`);
  console.log('🛡️ Ready to control Ollama processes safely');
}); 