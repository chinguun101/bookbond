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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Reading controls */}
      <div className="fixed top-6 right-6 z-10 flex items-center space-x-2 p-3 bg-white rounded-lg shadow-md border border-gray-100">
        <button 
          onClick={decreaseFontSize}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
          aria-label="Decrease font size"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700">{fontSize}px</span>
        <button 
          onClick={increaseFontSize}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
          aria-label="Increase font size"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      
      {/* Book selector button */}
      <div className="fixed top-6 left-6 z-10">
        <button 
          onClick={() => setShowBookSelector(!showBookSelector)}
          className="flex items-center p-3 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-100 text-gray-700"
        >
          <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          <span className="text-sm text-gray-700 font-medium">Switch Book</span>
        </button>
        
        {/* Book selector dropdown */}
        {showBookSelector && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-white shadow-xl rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">Available Books</h3>
            </div>
            <div className="p-2">
              {books.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No books available</p>
              ) : (
                <div className="space-y-1">
                  {books.map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleBookChange(b.id)}
                      className={`w-full text-left px-4 py-3 text-sm rounded-md transition-colors duration-200 ${b.id === bookId ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                      <div className="font-medium truncate text-gray-800">{b.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{b.passages.length} passages</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Main book content */}
      <div className="flex-1 overflow-y-auto px-8 py-20 bg-amber-50 scroll-smooth" ref={bookContentRef}>
        <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 rounded-lg shadow-sm border border-amber-100">
          <h1 className="text-3xl font-bold mb-10 text-center text-gray-800">{book.title}</h1>
          
          {passages.map((passage, index) => (
            <div
              key={passage.id}
              className="passage mb-10 leading-relaxed"
              data-passage-index={index}
              id={`passage-${passage.id}`}
            >
              <p 
                className="text-gray-800" 
                style={{ 
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.7',
                  fontFamily: '"Georgia", serif'
                }}
              >
                {passage.text}
              </p>
              
              {/* Indicator for passages with relations */}
              {hasRelations(passage.id) && (
                <div className="mt-3 text-xs flex items-center text-blue-600 justify-end">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-medium">
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
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-lg text-gray-800">Related Passages</h3>
              <button
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                onClick={() => setShowRelationCard(false)}
                aria-label="Close panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-5">
              {currentRelations.map((relation, relationIndex) => {
                const { text: passageText, bookTitle } = getRelatedPassageInfo(relation.relatedPassageId);
                
                return (
                  <div 
                    key={relationIndex}
                    className={`border rounded-lg p-4 shadow-sm ${getRelationColor(relation.relationType)}`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium text-sm rounded-full px-3 py-1 bg-white bg-opacity-60">
                        {relation.relationType.charAt(0).toUpperCase() + relation.relationType.slice(1)}
                      </span>
                      <span className="text-xs font-medium bg-white bg-opacity-60 rounded-full px-2 py-1">
                        {(relation.similarity * 100).toFixed(0)}% match
                      </span>
                    </div>
                    
                    <p className="text-sm mb-3 italic bg-white bg-opacity-50 p-2 rounded">{relation.evidence}</p>
                    
                    <div className="text-sm bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                      {passageText !== "Passage not found" ? (
                        passageText.length > 200 ? `${passageText.slice(0, 200)}...` : passageText
                      ) : (
                        <span className="text-gray-500 italic">Passage not found</span>
                      )}
                    </div>
                    
                    <div className="mt-3 text-xs font-medium text-gray-600 flex items-center">
                      <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
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