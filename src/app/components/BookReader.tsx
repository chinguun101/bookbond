'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBookStore } from '@/store/bookStore';
import { useComparisonStore } from '@/store/comparisonStore';
import { Passage } from '@/lib/textProcessing';
import BookChat from './BookChat';
import BookCover from '@/components/BookCover';

export default function BookReader({ bookId: initialBookId }: { bookId: string }) {
  const { getBook, getPassages, books } = useBookStore();
  const { getComparison } = useComparisonStore();
  
  const [bookId, setBookId] = useState<string>(initialBookId);
  const [activePassageIndex, setActivePassageIndex] = useState<number>(-1);
  const [showRelationCard, setShowRelationCard] = useState(false);
  const [fontSize, setFontSize] = useState<number>(18);
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [expandedPassages, setExpandedPassages] = useState<Set<string>>(new Set());
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
      case 'supports': return 'bg-green-50 border-green-200 text-green-700';
      case 'contradicts': return 'bg-red-50 border-red-200 text-red-700';
      case 'extends': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'analogous': return 'bg-purple-50 border-purple-200 text-purple-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
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
  
  // Handle chat toggle
  const toggleChat = () => {
    setShowChat(!showChat);
  };
  
  // Helper to toggle passage expansion
  const togglePassageExpand = useCallback((passageId: string) => {
    setExpandedPassages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(passageId)) {
        newSet.delete(passageId);
      } else {
        newSet.add(passageId);
      }
      return newSet;
    });
  }, []);
  
  // Function to handle expanding/collapsing all passages
  const toggleAllPassages = useCallback(() => {
    setExpandedPassages(prev => {
      const currentPassageIds = currentRelations.map(r => r.relatedPassageId);
      const allExpanded = currentPassageIds.every(id => prev.has(id));
      
      if (allExpanded) {
        // If all are expanded, collapse all by creating a new empty set
        return new Set();
      } else {
        // Otherwise expand all by adding all passage IDs to the set
        const newSet = new Set(prev);
        currentPassageIds.forEach(id => newSet.add(id));
        return newSet;
      }
    });
  }, [currentRelations]);
  
  // Add these styles to the head section of the component
  const customScrollbarStyle = {
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(156, 163, 175, 0.5) rgba(249, 250, 251, 0.1)',
    msOverflowStyle: 'none'
  } as React.CSSProperties;
  
  const customScrollbarStyleWebkit = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(249, 250, 251, 0.1);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: rgba(156, 163, 175, 0.5);
      border-radius: 20px;
      border: 3px solid transparent;
    }
  `;
  
  return (
    <>
      <style>{customScrollbarStyleWebkit}</style>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Reading controls */}
        <div className="fixed top-15 right-6 z-10 flex items-center space-x-2 p-3 bg-gray-50 rounded-lg shadow-md border border-gray-100">
          <button 
            onClick={decreaseFontSize}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-800"
            aria-label="Decrease font size"
          >
            <svg className="w-5 h-5" fill="none" stroke="gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-800">{fontSize}px</span>
          <button 
            onClick={increaseFontSize}
            className="p-2 rounded-md hover:bg-gray-100 text-black-800"
            aria-label="Increase font size"
          >
            <svg className="w-5 h-5" fill="none" stroke="gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button 
            onClick={toggleChat}
            className={`p-2 rounded-md hover:bg-gray-100 ${showChat ? 'text-blue-600' : 'text-gray-800'}`}
            aria-label="Chat with book"
          >
            <svg className="w-5 h-5" fill="none" stroke="gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
        </div>
        
        {/* Book selector button */}
        <div className="fixed top-15 left-6 z-10">
          <button 
            onClick={() => setShowBookSelector(!showBookSelector)}
            className="flex items-center p-3 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-100 text-gray-800"
          >
            <svg className="w-5 h-5 mr-2 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            <span className="text-sm text-gray-800 font-medium">Books</span>
          </button>
          
          {/* Book selector dropdown */}
          {showBookSelector && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white shadow-xl rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
              <div className="p-3 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-800">Available Books</h3>
              </div>
              <div className="p-2">
                {books.length === 0 ? (
                  <p className="text-sm text-gray-600 p-2">No books available</p>
                ) : (
                  <div className="space-y-1">
                    {books.map(b => (
                      <button
                        key={b.id}
                        onClick={() => handleBookChange(b.id)}
                        className={`w-full text-left px-4 py-3 text-sm rounded-md transition-colors duration-200 flex items-center ${
                          b.id === bookId 
                            ? 'bg-blue-50 text-blue-700 font-medium' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-10 h-14 mr-3 flex-shrink-0 overflow-hidden rounded">
                          <BookCover bookTitle={b.title} size="small" className="w-full h-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-gray-800">{b.title}</div>
                          <div className="text-xs text-gray-600 mt-1">{b.passages.length} passages</div>
                        </div>
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
          <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 rounded-lg shadow-md border border-amber-100" 
               style={{ 
                 background: 'linear-gradient(to right, #f8f5f0, #fff, #f8f5f0)',
                 boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05)'
               }}>
            <div className="mb-8 flex flex-col items-center">
              <div className="mb-6 w-36">
                <BookCover bookTitle={book.title} size="large" className="shadow-md" />
              </div>
              <h1 className="text-3xl font-bold text-center text-gray-800">{book.title}</h1>
            </div>
            
            <div className="book-content">
              {passages.map((passage, index) => (
                <div
                  key={passage.id}
                  className="passage mb-6 leading-relaxed"
                  data-passage-index={index}
                  id={`passage-${passage.id}`}
                >
                  <p 
                    className="text-gray-800" 
                    style={{ 
                      fontSize: `${fontSize}px`,
                      lineHeight: '1.7',
                      fontFamily: '"Georgia", serif',
                      textIndent: '1.5em',
                      marginBottom: '0.5em',
                      textAlign: 'justify',
                      hyphens: 'auto',
                      color: '#2d2d2d'
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
                      <span className="font-medium">
                        {getRelationCount(passage.id)} related {getRelationCount(passage.id) === 1 ? 'passage' : 'passages'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                <div className="flex items-center">
                  <h3 className="font-medium text-lg text-gray-800 mr-3">Related</h3>
                  {currentRelations.length > 0 && (
                    <button 
                      onClick={toggleAllPassages}
                      className="text-sm flex items-center text-gray-600 hover:text-blue-800"
                      title="Expand or collapse all passages"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" />
                      </svg>
                      <span className="text-gray-600">
                        {currentRelations.every(r => expandedPassages.has(r.relatedPassageId)) 
                          ? 'Collapse All' 
                          : 'Expand All'}
                      </span>
                    </button>
                  )}
                </div>
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
              
              <div className="space-y-6">
                {currentRelations.map((relation, relationIndex) => {
                  const { text: passageText, bookTitle } = getRelatedPassageInfo(relation.relatedPassageId);
                  const isExpanded = expandedPassages.has(relation.relatedPassageId);
                  const shouldTruncate = passageText && passageText.length > 250;
                  const displayText = shouldTruncate && !isExpanded
                    ? `${passageText.slice(0, 250)}...`
                    : passageText;
                  
                  return (
                    <div 
                      key={relationIndex}
                      className={`rounded-lg shadow-md overflow-hidden ${getRelationColor(relation.relationType)}`}
                    >
                      {/* Book cover and type header */}
                      <div className="flex items-center p-3 border-b">
                        <div className="w-12 h-16 mr-3 flex-shrink-0 overflow-hidden rounded">
                          <BookCover bookTitle={bookTitle} size="small" className="w-full h-full" />
                        </div>
                        <div className="flex-1">
                          <span className="font-medium text-sm">
                            {relation.relationType.charAt(0).toUpperCase() + relation.relationType.slice(1)}
                          </span>
                          <div className="text-xs text-gray-600 truncate mt-1">
                            From: {bookTitle}
                          </div>
                        </div>
                      </div>
                      
                      {/* Evidence/reason */}
                      <div className="p-3 italic text-sm bg-white bg-opacity-70 border-b">
                        {relation.evidence}
                      </div>
                      
                      {/* Book-like passage display */}
                      <div className="p-4 bg-amber-50 font-serif text-sm">
                        {passageText !== "Passage not found" ? (
                          <div className="leading-relaxed">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs uppercase tracking-wider text-gray-500 font-sans">Excerpt</span>
                            </div>
                            <div 
                              style={{ 
                                textIndent: '1.5em',
                                fontFamily: '"Georgia", serif',
                                fontSize: '0.95rem',
                                lineHeight: '1.6',
                                maxHeight: isExpanded ? '300px' : 'none', 
                                overflowY: isExpanded ? 'auto' : 'visible',
                                scrollBehavior: 'smooth',
                                paddingRight: isExpanded ? '8px' : '0',
                                ...customScrollbarStyle,
                                position: 'relative',
                                paddingLeft: '8px',
                                borderLeft: '3px solid rgba(209, 213, 219, 0.5)' 
                              }}
                              className={isExpanded ? "custom-scrollbar" : ""}
                            >
                              <span className="absolute left-2 top-0 text-gray-400 text-xl" style={{ lineHeight: 0 }}>"</span>
                              {displayText}
                              <span className="text-gray-400 text-xl">"</span>
                            </div>
                            
                            {shouldTruncate && (
                              <button 
                                onClick={() => togglePassageExpand(relation.relatedPassageId)}
                                className="mt-2 text-gray-600 hover:text-blue-800 text-sm font-medium flex items-center "
                              >
                                {isExpanded ? (
                                  <>
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                    <span className="text-gray-600">Show Less</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                    <span className="text-gray-600">Show More</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">Passage not found</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Add BookChat component */}
        {activePassageIndex >= 0 && passages.length > 0 && (
          <BookChat
            currentPassage={passages[activePassageIndex]}
            bookContent={book.rawContent || ''}
            isVisible={showChat}
            onClose={toggleChat}
          />
        )}
      </div>
    </>
  );
} 