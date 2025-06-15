import React, { useState, useEffect, useRef } from 'react';
import { localOllamaIntegration } from '../services/localOllamaIntegration';
import './OllamaChat.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  error?: boolean;
}

export const OllamaChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOllamaAvailable, setIsOllamaAvailable] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkOllamaStatus();
    
    // Add welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant powered by Ollama. I can help you with questions about your financial data, provide insights, or just have a conversation. What would you like to know?',
      timestamp: new Date()
    }]);

    // Check status every 5 seconds
    const statusInterval = setInterval(() => {
      checkOllamaStatus();
    }, 5000);

    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkOllamaStatus = async () => {
    try {
      const health = await localOllamaIntegration.checkOllamaHealth();
      setIsOllamaAvailable(health.isReachable);
      setCurrentModel(health.preferredModel);
    } catch (error) {
      setIsOllamaAvailable(false);
      console.error('Failed to check Ollama status:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      if (!isOllamaAvailable) {
        throw new Error('Ollama is not available. Please start Ollama using the control widget above.');
      }

      const response = await localOllamaIntegration.generateText(userMessage.content, {
        temperature: 0.7,
        system: 'You are a helpful AI assistant for a treasury management system. Be concise but informative. If asked about financial data, remind users that you can\'t access their actual data but can provide general financial advice and explanations.'
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error while processing your request.',
        timestamp: new Date(),
        error: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Chat cleared! How can I help you today?',
      timestamp: new Date()
    }]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="ollama-chat">
      <div className="chat-header">
        <div className="chat-title">
          <h2>💬 AI Chat Assistant</h2>
          <div className="chat-status">
            <span className={`status-indicator ${isOllamaAvailable ? 'online' : 'offline'}`}></span>
            <span className="status-text">
              {isOllamaAvailable 
                ? `Connected to ${currentModel || 'Ollama'}` 
                : 'Ollama Offline - Start using control widget above'
              }
            </span>
            <button 
              onClick={checkOllamaStatus}
              className="refresh-status-btn"
              title="Refresh Ollama status"
            >
              🔄
            </button>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="clear-chat-btn"
          title="Clear chat history"
        >
          🗑️ Clear
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.role} ${message.error ? 'error' : ''}`}
          >
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-time">{formatTime(message.timestamp)}</div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message assistant loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isOllamaAvailable ? "Type your message..." : "Start Ollama to enable chat..."}
            disabled={!isOllamaAvailable || isLoading}
            autoFocus
          />
          <button 
            onClick={sendMessage}
            disabled={!inputValue.trim() || !isOllamaAvailable || isLoading}
            className="send-btn"
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
        <div className="chat-help">
          <small>
            Press Enter to send • Shift+Enter for new line • 
            {isOllamaAvailable ? ` Model: ${currentModel}` : ' Start Ollama first'}
          </small>
        </div>
      </div>
    </div>
  );
}; 