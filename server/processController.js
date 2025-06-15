const express = require('express');
const { spawn, exec } = require('child_process');
const cors = require('cors');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

let ollamaProcess = null;

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
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:11434/api/tags');
    
    if (response.ok) {
      const data = await response.json();
      res.json({ 
        isRunning: true, 
        models: data.models || [],
        processRunning: ollamaProcess !== null
      });
    } else {
      res.json({ 
        isRunning: false,
        processRunning: ollamaProcess !== null
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