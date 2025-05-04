'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LLMService } from '@/services/llmService';
import { Passage } from '@/lib/textProcessing';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface BookChatProps {
  currentPassage: Passage;
  bookContent: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function BookChat({ currentPassage, bookContent, isVisible, onClose }: BookChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'Hello! I can help you understand this book and answer questions about it. What would you like to know?'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const llmService = new LLMService();
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Format chat history for the LLM
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Send to LLM
      const response = await llmService.chatWithBook(
        input, 
        currentPassage, 
        bookContent,
        chatHistory
      );

      // Add response to chat
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: response }
      ]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'I apologize, but I encountered an error while processing your question. Please try again.' 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-blue-50 flex justify-between items-center">
        <h3 className="font-medium text-gray-800">Book Assistant</h3>
        <button 
          onClick={onClose}
          className="text-black-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
          aria-label="Close chat"
        >
          <svg className="w-5 h-5" fill="none" stroke="gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`mb-4 ${message.role === 'user' ? 'text-right' : ''}`}
          >
            <div 
              className={`inline-block max-w-[85%] p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="mb-4">
            <div className="inline-block max-w-[85%] p-3 rounded-lg bg-white text-gray-800 border border-gray-200 rounded-tl-none">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse delay-150"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse delay-300"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef}></div>
      </div>
      
      {/* Input area */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex items-end space-x-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this book..."
            className="flex-1 border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-32 text-gray-700"
            rows={1}
            style={{
              minHeight: '2.5rem',
              height: 'auto'
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className={`p-2 rounded-full ${
              isLoading || !input.trim() 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
} 