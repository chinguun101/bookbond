'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useBookStore } from '@/store/bookStore';
import { useComparisonStore } from '@/store/comparisonStore';
import { Passage } from '@/lib/textProcessing';

export default function BookReader({ bookId: initialBookId }: { bookId: string }) {
  const { getBook, getPassages, books } = useBookStore();
  const { getComparison } = useComparisonStore();
  
  const [bookId, setBookId] = useState<string>(initialBookId);
  const [activePassageIndex, setActivePassageIndex] = useState<number>(-1);
  const [showRelationCard, setShowRelationCard] = useState(false);
  const [fontSize, setFontSize] = useState<number>(18);
  const [showBookSelector, setShowBookSelector] = useState(false);
  const bookContentRef = useRef<HTMLDivElement>(null);
  
  const book = getBook(bookId);
  const passages = bookId ? getPassages(bookId) : [];
  
  // Get the active passage ID based on index
  const activePassageId = activePassageIndex >= 0 && activePassageIndex < passages.length 
    ? passages[activePassageIndex].id 
    : null;
  
  // Get relations for the current passage
  const currentRelations = activePassageId ? getComparison(activePassageId) || [] : [];
  
  // Create intersection observer to detect which passage is currently in view
  useEffect(() => {
    if (!bookContentRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const passageIndexStr = entry.target.getAttribute('data-passage-index');
            if (passageIndexStr) {
              const passageIndex = parseInt(passageIndexStr, 10);
              setActivePassageIndex(passageIndex);
              
              // Check if this passage has relations
              const passageId = passages[passageIndex]?.id;
              if (passageId) {
                const relations = getComparison(passageId) || [];
                setShowRelationCard(relations.length > 0);
              }
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.5
      }
    );
    
    // Get all passage elements
    const passageElements = bookContentRef.current.querySelectorAll('.passage');
    passageElements.forEach(element => {
      observer.observe(element);
    });
    
    return () => {
      passageElements.forEach(element => {
        observer.unobserve(element);
      });
    };
  }, [bookId, getComparison, passages]);
  
  if (!book) {
    return <div className="text-center my-8">Book not found</div>;
  }
  
  // Function to get relation type color
  const getRelationColor = (type: string): string => {
    switch (type) {
      case 'supports': return 'bg-green-100 text-green-800 border-green-200';
      case 'contradicts': return 'bg-red-100 text-red-800 border-red-200';
      case 'extends': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'analogous': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  // Function to get related passage text and book information
  const getRelatedPassageInfo = (passageId: string): { text: string, bookTitle: string } => {
    // Look through all books to find the passage
    for (const book of books) {
      const passage = book.passages.find(p => p.id === passageId);
      if (passage) {
        return {
          text: passage.text,
          bookTitle: book.title
        };
      }
    }
    
    // Default if passage not found
    return {
      text: "Passage not found",
      bookTitle: "Unknown Book"
    };
  };
  
  const increaseFontSize = () => {
    if (fontSize < 24) {
      setFontSize(prev => prev + 1);
    }
  };
  
  const decreaseFontSize = () => {
    if (fontSize > 14) {
      setFontSize(prev => prev - 1);
    }
  };
  
  // Helper to check if a passage has relations
  const hasRelations = (passageId: string): boolean => {
    const relations = getComparison(passageId);
    return relations !== undefined && relations.length > 0;
  };
  
  // Helper to get relation count
  const getRelationCount = (passageId: string): number => {
    const relations = getComparison(passageId);
    return relations?.length || 0;
  };
  
  // Handle book change
  const handleBookChange = (newBookId: string) => {
    setBookId(newBookId);
    setActivePassageIndex(-1);
    setShowRelationCard(false);
    setShowBookSelector(false);
    
    // Scroll to top when changing books
    if (bookContentRef.current) {
      bookContentRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };
  
  return (
    <div className="flex h-screen overflow-hidden bg-amber-50">
      {/* Reading controls */}
      <div className="fixed top-16 right-4 z-10 flex items-center space-x-2 p-2 bg-white rounded-md shadow-md">
        <button 
          onClick={decreaseFontSize}
          className="p-1 rounded hover:bg-gray-100"
          aria-label="Decrease font size"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <span className="text-sm">{fontSize}px</span>
        <button 
          onClick={increaseFontSize}
          className="p-1 rounded hover:bg-gray-100"
          aria-label="Increase font size"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      
      {/* Book selector button */}
      <div className="fixed top-16 left-4 z-10">
        <button 
          onClick={() => setShowBookSelector(!showBookSelector)}
          className="flex items-center p-2 bg-white rounded-md shadow-md hover:bg-gray-50"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          <span className="text-sm font-medium">Switch Book</span>
        </button>
        
        {/* Book selector dropdown */}
        {showBookSelector && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 max-h-80 overflow-y-auto">
            <div className="p-2 border-b">
              <h3 className="text-sm font-medium">Available Books</h3>
            </div>
            <div className="p-2">
              {books.length === 0 ? (
                <p className="text-sm text-gray-500">No books available</p>
              ) : (
                <div className="space-y-1">
                  {books.map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleBookChange(b.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded ${b.id === bookId ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
                    >
                      <div className="font-medium truncate">{b.title}</div>
                      <div className="text-xs text-gray-500">{b.passages.length} passages</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Main book content */}
      <div className="flex-1 overflow-y-auto p-8 pb-32 bg-amber-50" ref={bookContentRef}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">{book.title}</h1>
          
          {passages.map((passage, index) => (
            <div
              key={passage.id}
              className="passage mb-8 leading-relaxed"
              data-passage-index={index}
            >
              <p 
                className="text-gray-800" 
                style={{ 
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.6',
                  fontFamily: '"Georgia", serif'
                }}
              >
                {passage.text}
              </p>
              
              {/* Indicator for passages with relations */}
              {hasRelations(passage.id) && (
                <div className="mt-2 text-xs flex items-center text-blue-600 justify-end">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>
                    {getRelationCount(passage.id)} related {getRelationCount(passage.id) === 1 ? 'passage' : 'passages'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Side panel for relation cards */}
      <div 
        className={`w-96 bg-white border-l border-gray-200 shadow-xl transition-all duration-300 overflow-y-auto 
                    ${showRelationCard ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {showRelationCard && currentRelations.length > 0 && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-lg text-gray-800">Related Passages</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowRelationCard(false)}
                aria-label="Close panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {currentRelations.map((relation, relationIndex) => {
                const { text: passageText, bookTitle } = getRelatedPassageInfo(relation.relatedPassageId);
                
                return (
                  <div 
                    key={relationIndex}
                    className={`border rounded-md p-3 shadow-sm ${getRelationColor(relation.relationType)}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">
                        {relation.relationType.charAt(0).toUpperCase() + relation.relationType.slice(1)}
                      </span>
                      <span className="text-xs opacity-75">
                        {(relation.similarity * 100).toFixed(0)}% match
                      </span>
                    </div>
                    
                    <p className="text-sm mb-3 italic">{relation.evidence}</p>
                    
                    <div className="text-sm bg-white bg-opacity-70 rounded p-3">
                      {passageText !== "Passage not found" ? (
                        passageText.length > 200 ? `${passageText.slice(0, 200)}...` : passageText
                      ) : (
                        <span className="text-gray-500 italic">Passage not found</span>
                      )}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-600">
                      From: {bookTitle}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 