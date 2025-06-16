import React, { useState, useEffect, useRef } from 'react';
import { localOllamaIntegration } from './LocalOllamaIntegration';
import { localStorageManager } from '../../data/storage/LocalStorageManager';
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
      console.log('🔄 Checking Ollama status...');
      const health = await localOllamaIntegration.checkOllamaHealth();
      console.log('📊 Ollama health check result:', health);
      setIsOllamaAvailable(health.isReachable);
      setCurrentModel(health.preferredModel);
      
      if (health.isReachable) {
        console.log('✅ Ollama is available');
      } else {
        console.log('❌ Ollama is not available');
      }
    } catch (error) {
      console.error('Failed to check Ollama status:', error);
      setIsOllamaAvailable(false);
    }
  };

  // Search for transactions based on user query
  const searchTransactions = (query: string) => {
    const transactions = localStorageManager.getAllTransactions();
    const searchTerm = query.toLowerCase();
    
    return transactions.filter(transaction => 
      transaction.description.toLowerCase().includes(searchTerm) ||
      (transaction.reference && transaction.reference.toLowerCase().includes(searchTerm))
    );
  };

  // Get transaction statistics
  const getTransactionStats = () => {
    const transactions = localStorageManager.getAllTransactions();
    const accounts = localStorageManager.getAllAccounts();
    
    return {
      totalTransactions: transactions.length,
      totalAccounts: accounts.length,
      totalDebitAmount: transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0),
      totalCreditAmount: transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0),
    };
  };

  // Process transaction-related queries
  const processTransactionQuery = async (userMessage: string): Promise<string | null> => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Check if user is looking for specific transactions
    const searchPatterns = [
      /find.*(transaction|payment).*"([^"]+)"/i,
      /search.*"([^"]+)"/i,
      /look.*for.*"([^"]+)"/i,
      /show.*transactions.*"([^"]+)"/i,
      /(sadeem|technology|company)/i
    ];
    
    for (const pattern of searchPatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        const searchTerm = match[1] || match[0];
        const foundTransactions = searchTransactions(searchTerm);
        
        if (foundTransactions.length > 0) {
          const transactionList = foundTransactions.slice(0, 5).map(t => 
            `• ${new Date(t.postDateTime).toLocaleDateString()}: ${t.description} - ${t.debitAmount ? `-$${t.debitAmount.toFixed(2)}` : `+$${(t.creditAmount || 0).toFixed(2)}`} (Ref: ${t.reference || 'N/A'})`
          ).join('\n');
          
          return `I found ${foundTransactions.length} transaction(s) matching "${searchTerm}":\n\n${transactionList}${foundTransactions.length > 5 ? '\n\n...and ' + (foundTransactions.length - 5) + ' more.' : ''}`;
        } else {
          return `I searched through your ${getTransactionStats().totalTransactions} transactions but couldn't find any containing "${searchTerm}". You might want to check the spelling or try a different search term.`;
        }
      }
    }
    
    // Check for general transaction queries
    if (lowerMessage.includes('transaction') && (lowerMessage.includes('how many') || lowerMessage.includes('total'))) {
      const stats = getTransactionStats();
      return `You have ${stats.totalTransactions} transactions across ${stats.totalAccounts} accounts. Total debits: $${stats.totalDebitAmount.toFixed(2)}, Total credits: $${stats.totalCreditAmount.toFixed(2)}.`;
    }
    
    return null; // No transaction-specific query detected
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

      // First check if this is a transaction-specific query
      const transactionResponse = await processTransactionQuery(userMessage.content);
      
      if (transactionResponse) {
        // If we found transaction data, provide that response
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: transactionResponse,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Otherwise, use Ollama for general conversation
        const stats = getTransactionStats();
        const systemPrompt = `You are a helpful AI assistant for a treasury management system. The user has ${stats.totalTransactions} transactions across ${stats.totalAccounts} accounts. You can help with financial analysis, categorization suggestions, and general treasury management advice. Be concise but informative. If users ask about specific transactions, help them understand how to search their data.`;

        const response = await localOllamaIntegration.generateText(userMessage.content, {
          temperature: 0.7,
          system: systemPrompt
        });

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.response,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
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