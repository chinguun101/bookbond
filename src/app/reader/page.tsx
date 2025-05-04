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
    <div className="min-h-screen bg-white">
      {showBookSelection ? (
        <div className="max-w-md mx-auto py-16 px-4">
          <h1 className="text-2xl font-bold text-center mb-8">Select a Book to Read</h1>
          
          {books.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No books uploaded yet. Please upload a book first.
            </div>
          ) : (
            <div className="space-y-4">
              {books.map(book => (
                <button
                  key={book.id}
                  className="w-full p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow text-left"
                  onClick={() => handleBookSelect(book.id)}
                >
                  <h3 className="font-medium text-lg">{book.title}</h3>
                  <p className="text-sm text-gray-500">{book.passages.length} passages</p>
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