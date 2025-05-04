'use client';

import { useState, useEffect } from 'react';
import { useBookStore } from '@/store/bookStore';
import BookReader from '../components/BookReader';

export default function ReaderPage() {
  const { books } = useBookStore();
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [showBookSelection, setShowBookSelection] = useState<boolean>(true);
  
  // Try to load last selected book from localStorage
  useEffect(() => {
    const savedBookId = localStorage.getItem('lastReadBookId');
    
    if (savedBookId && books.some(book => book.id === savedBookId)) {
      setSelectedBookId(savedBookId);
      setShowBookSelection(false);
    } else if (books.length > 0) {
      // Default to first book if no saved book or saved book not found
      setSelectedBookId(books[0].id);
    }
  }, [books]);
  
  // Save selected book to localStorage
  useEffect(() => {
    if (selectedBookId) {
      localStorage.setItem('lastReadBookId', selectedBookId);
    }
  }, [selectedBookId]);
  
  const handleBookSelect = (bookId: string) => {
    setSelectedBookId(bookId);
    setShowBookSelection(false);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {showBookSelection ? (
        <div className="max-w-md mx-auto py-16 px-4">
          <h1 className="text-2xl font-bold text-center mb-8 text-gray-800">Select a Book to Read</h1>
          
          {books.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-gray-600">No books uploaded yet. Please upload a book first.</p>
              <a href="/" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors">
                Go to Upload Page
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {books.map(book => (
                <button
                  key={book.id}
                  className="w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-left flex items-start"
                  onClick={() => handleBookSelect(book.id)}
                >
                  <div className="flex-shrink-0 w-10 h-12 mr-4 bg-blue-50 rounded flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-lg text-gray-800">{book.title}</h3>
                    <p className="text-sm text-gray-600">{book.passages.length} passages</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <BookReader bookId={selectedBookId} />
      )}
    </div>
  );
} 