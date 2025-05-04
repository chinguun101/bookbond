'use client';

import React from 'react';
import { Book } from '@/lib/textProcessing';
import { useBookStore } from '@/store/bookStore';

interface BookListProps {
  onSelectBook: (bookId: string) => void;
}

export default function BookList({ onSelectBook }: BookListProps) {
  const { books, removeBook } = useBookStore();

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
      <h2 className="text-xl font-semibold mb-4">Your Books ({books.length})</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedBooks.map((book) => (
          <div 
            key={book.id} 
            className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between mb-2">
              <h3 className="font-medium text-gray-900 truncate">{book.title}</h3>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to remove "${book.title}"?`)) {
                    removeBook(book.id);
                  }
                }}
                className="text-red-500 hover:text-red-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
            <div className="text-sm text-gray-500 mb-2">
              {book.passages.length} passages
            </div>
            
            <div className="text-xs text-gray-400 mb-4">
              Uploaded: {new Date(book.uploadedAt).toLocaleDateString()}
            </div>
            
            <button 
              onClick={() => onSelectBook(book.id)}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              View Passages
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 