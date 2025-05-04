'use client';

import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import BookList from './components/BookList';
import PassageList from './components/PassageList';
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

  const selectedBook = selectedBookId ? getBook(selectedBookId) : null;
  const passages = selectedBookId ? getPassages(selectedBookId) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-12 flex flex-col items-center">
        <h1 className="text-4xl font-bold text-center text-white-800">Book Bond</h1>

        
        <a 
          href="/reader" 
          className="mt-4 inline-flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors shadow-sm"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Open Reader Mode
        </a>
      </header>

      <div className="mb-12 bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload a Book</h2>
        <FileUpload onFileProcess={handleFileProcess} />
        {processing && (
          <div className="mt-4 text-center text-blue-600 flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing your book... This may take a moment.
          </div>
        )}
      </div>

      {selectedBook ? (
        <div className="mb-8 bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Book Details</h2>
            <button 
              onClick={() => setSelectedBookId(null)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to All Books
            </button>
          </div>
          
          <div className="bg-gray-50 p-5 rounded-lg mb-6 border border-gray-100">
            <h3 className="font-medium text-lg text-gray-800">{selectedBook.title}</h3>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <p className="text-sm text-gray-600 flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                File: {selectedBook.fileName}
              </p>
              <p className="text-sm text-gray-600 flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                Uploaded: {new Date(selectedBook.uploadedAt).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Total Passages: {selectedBook.passages.length}
              </p>
            </div>
          </div>
          
          <PassageList 
            passages={passages} 
            bookTitle={selectedBook.title} 
          />
        </div>
      ) : (
        <BookList onSelectBook={handleSelectBook} />
      )}
      
      {/* Progress component for auto-comparison */}
      <AutoComparisonProgress />
    </div>
  );
}
