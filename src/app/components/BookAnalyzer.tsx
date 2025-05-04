'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useBookStore } from '@/store/bookStore';
import { useConceptStore } from '@/store/conceptStore';
import { LLMService } from '@/services/llmService';
import { PassageSummary } from '@/lib/conceptProcessing';

// Pre-set API key from environment variables
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_LLAMA_API_KEY || "LLM|24233636562905000|uj_EryBhhQK5JGIkJYaXt0_T2eY";

export default function BookAnalyzer() {
  const { books, getBook, getPassages } = useBookStore();
  const { addPassageSummariesBatch } = useConceptStore();
  
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(DEFAULT_API_KEY);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PassageSummary[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [showAllPassages, setShowAllPassages] = useState(false);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [progress, setProgress] = useState(0);
  
  const llmServiceRef = useRef(new LLMService());
  
  // Listen for batch processing progress
  useEffect(() => {
    const handleProgress = (event: CustomEvent) => {
      setProgress(event.detail.progress);
      setLogs(prev => [...prev, `[LOG] Progress: ${event.detail.progress.toFixed(2)}% - ${event.detail.message}`]);
    };
    
    window.addEventListener('llm-progress', handleProgress as any);
    
    return () => {
      window.removeEventListener('llm-progress', handleProgress as any);
    };
  }, []);
  
  // Capture console logs
  useEffect(() => {
    if (!isAnalyzing) return;
    
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    console.log = (...args) => {
      originalConsoleLog(...args);
      setLogs(prev => [...prev, `[LOG] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`]);
    };
    
    console.error = (...args) => {
      originalConsoleError(...args);
      setLogs(prev => [...prev, `[ERROR] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`]);
    };
    
    console.warn = (...args) => {
      originalConsoleWarn(...args);
      setLogs(prev => [...prev, `[WARN] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`]);
    };
    
    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, [isAnalyzing]);
  
  const handleAnalyzeBook = async () => {
    if (!selectedBookId) {
      setError('Please select a book to analyze');
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    setResults([]);
    setLogs([]);
    setRawResponse('');
    setProgress(0);
    
    try {
      // Get all passages for the selected book
      const passages = getPassages(selectedBookId);
      
      if (passages.length === 0) {
        throw new Error('No passages found in this book');
      }
      
      // Set API key
      llmServiceRef.current.setApiKey(apiKey);
      
      // Log the start of analysis
      setLogs(prev => [...prev, `Starting analysis of book with ID: ${selectedBookId}`]);
      setLogs(prev => [...prev, `Processing ${passages.length} passages`]);
      
      // Warn if the book is large
      if (passages.length > 10) {
        setLogs(prev => [...prev, `[WARN] This book has ${passages.length} passages. Analysis may take several minutes and will be processed in batches.`]);
      }
      
      // Analyze passages
      const summaries = await llmServiceRef.current.analyzePassages(passages);
      
      // Store the raw response for debugging
      setRawResponse(llmServiceRef.current.getLastFullResponse());
      
      // Store the results
      addPassageSummariesBatch(summaries);
      
      // Display the results
      setResults(summaries);
      setProgress(100);
      setLogs(prev => [...prev, `Analysis complete. Processed ${summaries.length} passages successfully.`]);
    } catch (err) {
      console.error('Error analyzing book:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during analysis';
      setError(errorMessage);
      setLogs(prev => [...prev, `ERROR: ${errorMessage}`]);
      
      // Add more context for certain errors
      if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
        setLogs(prev => [...prev, `[INFO] The request timed out. This usually happens when the API is overloaded or when processing a large amount of text.`]);
        setLogs(prev => [...prev, `[INFO] Try again with a smaller book or wait a few minutes before retrying.`]);
      }
      
      if (errorMessage.includes('HTML')) {
        setLogs(prev => [...prev, `[INFO] The server returned an HTML error page instead of a JSON response. This suggests the API endpoint might be unavailable.`]);
      }
      
      // Try to get the raw response even if there was an error
      setRawResponse(llmServiceRef.current.getLastFullResponse());
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  return (
    <div className="mt-8 p-6 border rounded-lg shadow-sm bg-white">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Analyze Book with AI</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Book
          </label>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
            value={selectedBookId}
            onChange={(e) => setSelectedBookId(e.target.value)}
            disabled={isAnalyzing}
          >
            <option value="">Select a book...</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title} ({book.passages.length} passages)
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <div className="text-sm text-gray-700 mb-2">
            Model: <span className="font-medium">Llama-4-Maverick-17B-128E-Instruct-FP8</span>
          </div>
          <p className="text-xs text-gray-600">
            Using Llama's powerful language model for analyzing book passages.
          </p>
        </div>
        
        {error && (
          <div className="text-red-600 text-sm font-medium p-3 border border-red-200 bg-red-50 rounded">
            <div className="font-bold mb-1">Error:</div>
            {error}
          </div>
        )}
        
        <button
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:bg-gray-400"
          onClick={handleAnalyzeBook}
          disabled={isAnalyzing || !selectedBookId}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Book'}
        </button>
      </div>
      
      {isAnalyzing && (
        <div className="mt-4">
          <div className="text-center text-blue-600">
            <p className="animate-pulse">Analyzing book passages... This may take a few minutes.</p>
            <p className="text-sm text-gray-600 mt-1">
              The time required depends on the size of your book and the LLM being used.
            </p>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 mt-4">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
          
          <div className="mt-4">
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showLogs ? 'Hide Processing Logs' : 'Show Processing Logs'}
            </button>
            
            {showLogs && (
              <div className="mt-2 p-3 bg-gray-50 border rounded max-h-60 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800">
                  {logs.length > 0 
                    ? logs.map((log, i) => <div key={i} className={`${log.includes('[ERROR]') ? 'text-red-600' : log.includes('[WARN]') ? 'text-amber-600' : log.includes('[INFO]') ? 'text-blue-600' : 'text-gray-800'}`}>{log}</div>)
                    : 'No logs yet. Analysis will begin soon...'}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
      
      {results.length > 0 && !isAnalyzing && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-900">Analysis Results</h3>
            <div className="space-x-3">
              <button 
                onClick={() => setShowLogs(!showLogs)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showLogs ? 'Hide Logs' : 'Show Logs'}
              </button>
              <button 
                onClick={() => setShowRawResponse(!showRawResponse)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showRawResponse ? 'Hide Raw Response' : 'Show Raw Response'}
              </button>
              <button 
                onClick={() => setShowAllPassages(!showAllPassages)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showAllPassages ? 'Show Sample Passages' : 'Show All Passages'}
              </button>
            </div>
          </div>
          
          {showLogs && (
            <div className="mb-4 p-3 bg-gray-50 border rounded max-h-60 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800">
                {logs.map((log, i) => <div key={i} className={`${log.includes('[ERROR]') ? 'text-red-600' : log.includes('[WARN]') ? 'text-amber-600' : log.includes('[INFO]') ? 'text-blue-600' : 'text-gray-800'}`}>{log}</div>)}
              </pre>
            </div>
          )}
          
          {showRawResponse && (
            <div className="mb-4 p-3 bg-gray-50 border rounded max-h-96 overflow-y-auto">
              <h4 className="font-medium text-sm mb-2 text-gray-900">Raw LLM Response:</h4>
              <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto text-gray-800">
                {rawResponse || 'No raw response available'}
              </pre>
            </div>
          )}
          
          <p className="text-green-600 mb-4 font-medium">
            Successfully analyzed {results.length} passages!
          </p>
          
          <div className="space-y-3 max-h-96 overflow-y-auto p-2">
            {(showAllPassages ? results : results.slice(0, 3)).map((summary) => (
              <div key={summary.passageId} className="border p-3 rounded text-sm bg-white shadow-sm">
                <div className="font-medium text-gray-900">Passage Summary:</div>
                <p className="text-gray-800">{summary.summary}</p>
                
                {summary.concepts.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium text-gray-900">Key Concepts:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {summary.concepts.map((concept, i) => (
                        <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {summary.keyPoints.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium text-gray-900">Key Points:</div>
                    <ul className="list-disc list-inside text-xs text-gray-800 mt-1">
                      {summary.keyPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            
            {!showAllPassages && results.length > 3 && (
              <button 
                onClick={() => setShowAllPassages(true)}
                className="w-full py-2 text-center text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Show all {results.length} passages
              </button>
            )}
          </div>
        </div>
      )}
      
      {rawResponse && !results.length && !isAnalyzing && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-amber-600">Analysis Completed with Errors</h3>
            <div className="space-x-3">
              <button 
                onClick={() => setShowLogs(!showLogs)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showLogs ? 'Hide Logs' : 'Show Logs'}
              </button>
              <button 
                onClick={() => setShowRawResponse(!showRawResponse)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showRawResponse ? 'Hide Raw Response' : 'Show Raw Response'}
              </button>
            </div>
          </div>
          
          {showLogs && (
            <div className="mb-4 p-3 bg-gray-50 border rounded max-h-60 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800">
                {logs.map((log, i) => <div key={i} className={`${log.includes('[ERROR]') ? 'text-red-600' : log.includes('[WARN]') ? 'text-amber-600' : log.includes('[INFO]') ? 'text-blue-600' : 'text-gray-800'}`}>{log}</div>)}
              </pre>
            </div>
          )}
          
          {showRawResponse && (
            <div className="mb-4 p-3 bg-gray-50 border rounded max-h-96 overflow-y-auto">
              <h4 className="font-medium text-sm mb-2 text-gray-900">Raw LLM Response:</h4>
              <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto text-gray-800">
                {rawResponse || 'No raw response available'}
              </pre>
            </div>
          )}
          
          <div className="p-3 border border-amber-200 bg-amber-50 rounded text-amber-800">
            <p className="font-medium mb-2">
              The LLM returned a response, but we couldn't parse it into the expected format.
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Try selecting a smaller book with fewer passages</li>
              <li>The Llama API may be experiencing high load or connectivity issues</li>
              <li>Check the logs for more detailed error information</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
} 