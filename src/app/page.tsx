'use client';

import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import BookList from './components/BookList';
import PassageList from './components/PassageList';
import BookAnalyzer from './components/BookAnalyzer';
import BookComparison from './components/BookComparison';
import AutoComparisonProgress from './components/AutoComparisonProgress';
import { processTextFile } from '@/lib/textProcessing';
import { useBookStore } from '@/store/bookStore';
import { autoComparisonService } from '@/services/autoComparisonService';

// Default API keys
const DEFAULT_LLAMA_API_KEY = process.env.NEXT_PUBLIC_LLAMA_API_KEY || "LLM|24233636562905000|uj_EryBhhQK5JGIkJYaXt0_T2eY";
const DEFAULT_OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

export default function Home() {
  const { addBook, getBook, getPassages } = useBookStore();
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'analyze' | 'compare'>('upload');
  const [apiKeys, setApiKeys] = useState({
    llamaApiKey: DEFAULT_LLAMA_API_KEY,
    openaiApiKey: DEFAULT_OPENAI_API_KEY,
  });

  // Initialize auto comparison service with API keys
  useEffect(() => {
    // Try to load API keys from localStorage
    const savedLlamaKey = localStorage.getItem('llamaApiKey');
    const savedOpenAiKey = localStorage.getItem('openaiApiKey');
    
    if (savedLlamaKey && savedOpenAiKey) {
      setApiKeys({
        llamaApiKey: savedLlamaKey,
        openaiApiKey: savedOpenAiKey,
      });
      
      // Initialize auto comparison service with API keys and fixed 50% threshold
      autoComparisonService.setApiKeys(savedLlamaKey, savedOpenAiKey);
      autoComparisonService.setAutoSimilarityThreshold(0.5);
    }
  }, []);

  // Save API keys when they change
  useEffect(() => {
    localStorage.setItem('llamaApiKey', apiKeys.llamaApiKey);
    localStorage.setItem('openaiApiKey', apiKeys.openaiApiKey);
    
    // Update the auto comparison service
    autoComparisonService.setApiKeys(apiKeys.llamaApiKey, apiKeys.openaiApiKey);
  }, [apiKeys]);

  const handleFileProcess = async (text: string, fileName: string) => {
    setProcessing(true);
    
    try {
      // Process the text file into a book with passages
      const book = processTextFile(text, fileName);
      
      // Add the book to our store
      addBook(book);
      
      // Select the newly added book
      setSelectedBookId(book.id);
      
      // Start automatic comparison with existing books
      if (apiKeys.openaiApiKey) {
        console.log('Starting automatic comparison for new book:', book.title);
        autoComparisonService.compareWithAllBooks(book)
          .catch(error => {
            console.error('Error during automatic comparison:', error);
          });
      } else {
        console.warn('OpenAI API key not set. Skipping automatic comparison.');
      }
    } catch (err) {
      console.error('Error processing file:', err);
      alert('Failed to process the file. Please try again with a different file.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
  };

  const handleApiKeyChange = (keyType: 'llamaApiKey' | 'openaiApiKey', value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [keyType]: value
    }));
  };

  const selectedBook = selectedBookId ? getBook(selectedBookId) : null;
  const passages = selectedBookId ? getPassages(selectedBookId) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-center">AI Reading Companion</h1>
        <p className="text-gray-600 text-center mt-2 mb-4">
          Upload books, analyze passages, and discover connections
        </p>
        
        <a 
          href="/reader" 
          className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Open Reader Mode
        </a>
      </header>
      
      {/* API Key Settings */}
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <div className="text-sm font-medium mb-3">API Keys for Auto-Comparison</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Llama API Key
            </label>
            <input
              type="text"
              value={apiKeys.llamaApiKey}
              onChange={(e) => handleApiKeyChange('llamaApiKey', e.target.value)}
              placeholder="Enter Llama API key"
              className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              OpenAI API Key (Required for auto-comparison)
            </label>
            <input
              type="text"
              value={apiKeys.openaiApiKey}
              onChange={(e) => handleApiKeyChange('openaiApiKey', e.target.value)}
              placeholder="Enter OpenAI API key"
              className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Your API keys are stored locally in your browser and used for automatic book comparisons.
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Upload & Manage Books
          </button>
          <button
            onClick={() => setActiveTab('analyze')}
            className={`${
              activeTab === 'analyze'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Analyze with AI
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`${
              activeTab === 'compare'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Compare Books
          </button>
        </nav>
      </div>

      {activeTab === 'upload' ? (
        // Upload & Manage Content
        <>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Upload a Book</h2>
            <FileUpload onFileProcess={handleFileProcess} />
            {processing && (
              <div className="mt-4 text-center text-blue-600">
                Processing your book... This may take a moment.
              </div>
            )}
            
            {!apiKeys.openaiApiKey && (
              <div className="mt-4 text-sm text-amber-600 p-3 border border-amber-200 bg-amber-50 rounded">
                <strong>Note:</strong> OpenAI API key is required for automatic book comparison. 
                Please add your API key above to enable this feature.
              </div>
            )}
          </div>

          {selectedBook ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Book Details</h2>
                <button 
                  onClick={() => setSelectedBookId(null)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Back to All Books
                </button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-medium text-lg">{selectedBook.title}</h3>
                <p className="text-sm text-gray-500">File: {selectedBook.fileName}</p>
                <p className="text-sm text-gray-500">
                  Uploaded: {new Date(selectedBook.uploadedAt).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">
                  Total Passages: {selectedBook.passages.length}
                </p>
              </div>
              
              <PassageList 
                passages={passages} 
                bookTitle={selectedBook.title} 
              />
            </div>
          ) : (
            <BookList onSelectBook={handleSelectBook} />
          )}
        </>
      ) : activeTab === 'analyze' ? (
        // Analyze Content
        <BookAnalyzer />
      ) : (
        // Compare Books
        <BookComparison />
      )}
      
      {/* Progress component for auto-comparison */}
      <AutoComparisonProgress />
    </div>
  );
}
