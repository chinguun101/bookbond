'use client';

import React from 'react';
import { Book } from '@/lib/textProcessing';
import { useBookStore } from '@/store/bookStore';
import BookCover from './BookCover';

interface BookListProps {
  onSelectBook: (bookId: string) => void;
}

export default function BookList({ onSelectBook }: BookListProps) {
  const { books, removeBook } = useBookStore();

  // Preload book covers in the background
  React.useEffect(() => {
    // Use a small timeout to allow the initial render first
    const timer = setTimeout(() => {
      if (books.length > 0) {
        const { getBookCoverUrl } = require('@/lib/bookCoverService');
        
        // Preload covers in the background
        books.forEach(book => {
          getBookCoverUrl(book.title)
            .catch((err: Error) => console.warn('Error preloading book cover:', err));
        });
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [books]);

  if (books.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No books uploaded yet. Use the upload button to add your first book.
      </div>
    );
  }

  // Sort books by upload date (newest first)
  const sortedBooks = [...books].sort((a, b) => {
    return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
  });

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Books ({books.length})</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedBooks.map((book) => (
          <div 
            key={book.id} 
            className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col"
          >
            <div className="p-5 flex-1">
              <div className="flex justify-between mb-3">
                <h3 className="font-medium text-gray-900 truncate text-lg">{book.title}</h3>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to remove "${book.title}"?`)) {
                      removeBook(book.id);
                    }
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                  aria-label="Remove book"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              
              <div className="text-sm text-gray-600 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {book.passages.length} passages
              </div>
              
              <div className="text-xs text-gray-500 mb-4 flex items-center">
                <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                Uploaded: {new Date(book.uploadedAt).toLocaleDateString()}
              </div>
            </div>
            
            <div className="flex">
              <div className="w-1/3">
                <BookCover bookTitle={book.title} size="medium" className="rounded-bl-lg" />
              </div>
              
              <button 
                onClick={() => onSelectBook(book.id)}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors duration-200 flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Passages
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 