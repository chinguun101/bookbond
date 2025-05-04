'use client';

import React, { useState, useEffect } from 'react';
import { useBookStore } from '@/store/bookStore';
import { useComparisonStore } from '@/store/comparisonStore';
import { Passage } from '@/lib/textProcessing';
import { PassageRelation, passageComparisonService, RelationType } from '@/services/passageComparisonService';

// Llama API key from environment variables
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_LLAMA_API_KEY || "LLM|24233636562905000|uj_EryBhhQK5JGIkJYaXt0_T2eY";

export default function BookComparison() {
  const { books, getBook, getPassages } = useBookStore();
  const { 
    addComparison, 
    getComparison, 
    isBookIndexed, 
    addIndexedBook,
    addBulkComparisons,
    getBookComparisonStatus,
    setSimilarityThreshold,
    getSimilarityThreshold 
  } = useComparisonStore();
  
  const [sourceBookId, setSourceBookId] = useState<string>('');
  const [targetBookId, setTargetBookId] = useState<string>('');
  const [selectedPassageId, setSelectedPassageId] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(DEFAULT_API_KEY);
  const [openaiApiKey, setOpenaiApiKey] = useState<string>(process.env.NEXT_PUBLIC_OPENAI_API_KEY || '');
  const [isComparing, setIsComparing] = useState(false);
  const [isFullBookComparing, setIsFullBookComparing] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relations, setRelations] = useState<PassageRelation[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [similarityThreshold, setSimilarityThresholdState] = useState<number>(getSimilarityThreshold());
  const [isShowingAllRelations, setIsShowingAllRelations] = useState(false);
  const [allRelations, setAllRelations] = useState<Map<string, PassageRelation[]>>(new Map());
  
  // Listen for changes to the selected passage
  useEffect(() => {
    if (!selectedPassageId) {
      setRelations([]);
      return;
    }
    
    // Check if we already have comparison results for this passage
    const existingComparison = getComparison(selectedPassageId);
    if (existingComparison) {
      setRelations(existingComparison);
    }
  }, [selectedPassageId, getComparison]);
  
  // Set the passage to the first one when a source book is selected
  useEffect(() => {
    if (sourceBookId) {
      const passages = getPassages(sourceBookId);
      if (passages.length > 0) {
        setSelectedPassageId(passages[0].id);
      }
    }
  }, [sourceBookId, getPassages]);
  
  const handleSourceBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSourceBookId(e.target.value);
    setSelectedPassageId('');
    setRelations([]);
    setIsShowingAllRelations(false);
    setAllRelations(new Map());
  };
  
  const handleTargetBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTargetBookId(e.target.value);
    setRelations([]);
    setIsShowingAllRelations(false);
    setAllRelations(new Map());
  };
  
  const handlePassageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPassageId(e.target.value);
    setIsShowingAllRelations(false);
  };
  
  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSimilarityThresholdState(value);
    setSimilarityThreshold(value);
    passageComparisonService.setSimilarityThreshold(value);
  };
  
  const handleCompare = async () => {
    if (!sourceBookId || !targetBookId || !selectedPassageId) {
      setError('Please select source book, target book, and passage');
      return;
    }
    
    if (sourceBookId === targetBookId) {
      setError('Source and target books must be different');
      return;
    }
    
    setIsComparing(true);
    setError(null);
    setRelations([]);
    setLogs([]);
    setProgress(0);
    
    try {
      // Set both API keys
      passageComparisonService.setApiKey(apiKey, openaiApiKey);
      
      // Get the selected passage
      const passages = getPassages(sourceBookId);
      const selectedPassage = passages.find(p => p.id === selectedPassageId);
      
      if (!selectedPassage) {
        throw new Error('Selected passage not found');
      }
      
      setLogs(prev => [...prev, `Starting comparison of passage from book ${sourceBookId} with book ${targetBookId}`]);
      
      // Check if target book is indexed
      if (!isBookIndexed(targetBookId)) {
        setLogs(prev => [...prev, `Target book ${targetBookId} not indexed yet, indexing now...`]);
        setIsIndexing(true);
        
        // Index the target book
        await passageComparisonService.indexBook(targetBookId);
        
        setLogs(prev => [...prev, `Successfully indexed book ${targetBookId}`]);
        addIndexedBook(targetBookId);
        setIsIndexing(false);
      }
      
      setLogs(prev => [...prev, `Finding related passages in target book...`]);
      setProgress(30);
      
      // Compare the passage with the target book
      const results = await passageComparisonService.compareWithBook(
        selectedPassage,
        targetBookId
      );
      
      setLogs(prev => [...prev, `Found ${results.length} related passages`]);
      setProgress(100);
      
      // Store the results
      addComparison(selectedPassageId, results);
      
      // Update the UI
      setRelations(results);
      
      setLogs(prev => [...prev, `Comparison complete`]);
    } catch (err) {
      console.error('Error comparing books:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during comparison';
      setError(errorMessage);
      setLogs(prev => [...prev, `ERROR: ${errorMessage}`]);
    } finally {
      setIsComparing(false);
      setIsIndexing(false);
    }
  };
  
  const handleCompareAllPassages = async () => {
    if (!sourceBookId || !targetBookId) {
      setError('Please select source book and target book');
      return;
    }
    
    if (sourceBookId === targetBookId) {
      setError('Source and target books must be different');
      return;
    }
    
    setIsFullBookComparing(true);
    setError(null);
    setRelations([]);
    setLogs([]);
    setProgress(0);
    setAllRelations(new Map());
    
    try {
      // Set both API keys
      passageComparisonService.setApiKey(apiKey, openaiApiKey);
      
      const sourceBook = getBook(sourceBookId);
      const targetBook = getBook(targetBookId);
      
      if (!sourceBook || !targetBook) {
        throw new Error('Source or target book not found');
      }
      
      setLogs(prev => [...prev, `Starting full comparison of "${sourceBook.title}" with "${targetBook.title}"`]);
      
      // Progress callback function
      const updateProgress = (progress: number, message: string) => {
        setProgress(progress);
        setLogs(prev => [...prev, `[${progress.toFixed(0)}%] ${message}`]);
      };
      
      // Compare all passages
      const results = await passageComparisonService.compareAllPassages(
        sourceBookId,
        targetBookId,
        3, // topK
        5, // batchSize
        updateProgress
      );
      
      // Store the results
      addBulkComparisons(results, sourceBookId, targetBookId);
      
      // Update the UI
      setAllRelations(results);
      setIsShowingAllRelations(true);
      
      setLogs(prev => [...prev, `Full book comparison complete`]);
      
      // Count the number of relations
      let relationCount = 0;
      results.forEach(relations => {
        relationCount += relations.length;
      });
      
      setLogs(prev => [...prev, `Found ${relationCount} relations across ${results.size} passages`]);
    } catch (err) {
      console.error('Error comparing all passages:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during comparison';
      setError(errorMessage);
      setLogs(prev => [...prev, `ERROR: ${errorMessage}`]);
    } finally {
      setIsFullBookComparing(false);
    }
  };
  
  // Get relevant data
  const selectedPassage = selectedPassageId ? 
    getPassages(sourceBookId).find(p => p.id === selectedPassageId) : 
    undefined;
  
  const sourceBook = sourceBookId ? getBook(sourceBookId) : undefined;
  const targetBook = targetBookId ? getBook(targetBookId) : undefined;
  
  // Helper to get a passage by ID
  const getPassageById = (passageId: string): Passage | undefined => {
    for (const book of books) {
      const passage = book.passages.find(p => p.id === passageId);
      if (passage) return passage;
    }
    return undefined;
  };
  
  // Get relation color
  const getRelationColor = (type: RelationType): string => {
    switch (type) {
      case 'supports': return 'bg-green-100 text-green-800';
      case 'contradicts': return 'bg-red-100 text-red-800';
      case 'extends': return 'bg-blue-100 text-blue-800';
      case 'analogous': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Check if the full book comparison has been done
  const isFullBookComparisonDone = sourceBookId && targetBookId && 
    getBookComparisonStatus(sourceBookId, targetBookId) !== undefined;
  
  return (
    <div className="mt-8 p-6 border rounded-lg shadow-sm bg-white">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Compare Books</h2>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Book (Focus)
            </label>
            <select
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              value={sourceBookId}
              onChange={handleSourceBookChange}
              disabled={isComparing || isFullBookComparing}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Book (To Compare With)
            </label>
            <select
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              value={targetBookId}
              onChange={handleTargetBookChange}
              disabled={isComparing || isFullBookComparing}
            >
              <option value="">Select a book...</option>
              {books.map((book) => (
                <option 
                  key={book.id} 
                  value={book.id}
                  disabled={book.id === sourceBookId}
                >
                  {book.title} ({book.passages.length} passages)
                  {book.id === sourceBookId ? ' (Same as source)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {sourceBookId && targetBookId && (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <label htmlFor="threshold" className="text-gray-700 font-medium">
                Similarity Threshold: {similarityThreshold.toFixed(2)}
              </label>
              <input
                id="threshold"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={similarityThreshold}
                onChange={handleThresholdChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                disabled={isComparing || isFullBookComparing}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span>0.5</span>
                <span>1</span>
              </div>
            </div>
            
            {isFullBookComparisonDone && (
              <button
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => setIsShowingAllRelations(!isShowingAllRelations)}
                disabled={isComparing || isFullBookComparing}
              >
                {isShowingAllRelations ? 'Hide Book Analysis' : 'Show Book Analysis'}
              </button>
            )}
          </div>
        )}
        
        {/* Single passage comparison */}
        {sourceBookId && !isShowingAllRelations && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Passage from {sourceBook?.title}
            </label>
            <select
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              value={selectedPassageId}
              onChange={handlePassageChange}
              disabled={isComparing || isFullBookComparing}
            >
              <option value="">Select a passage...</option>
              {getPassages(sourceBookId).map((passage, index) => (
                <option key={passage.id} value={passage.id}>
                  Passage {index + 1} ({passage.text.slice(0, 50)}...)
                </option>
              ))}
            </select>
          </div>
        )}
        
        {selectedPassageId && !isShowingAllRelations && (
          <div className="p-3 border rounded bg-gray-50">
            <div className="text-sm font-medium text-gray-700 mb-1">
              Selected Passage:
            </div>
            <p className="text-gray-800 text-sm">
              {selectedPassage?.text}
            </p>
          </div>
        )}
        
        {error && (
          <div className="text-red-600 text-sm font-medium p-3 border border-red-200 bg-red-50 rounded">
            <div className="font-bold mb-1">Error:</div>
            {error}
          </div>
        )}
        
        {!openaiApiKey && (
          <div className="text-amber-600 text-sm font-medium p-3 border border-amber-200 bg-amber-50 rounded">
            <div className="font-bold mb-1">Warning:</div>
            <p>OpenAI API key is required for embedding generation and passage similarity search.</p>
            <p>Please provide your OpenAI API key in the API Settings section below.</p>
          </div>
        )}
        
        {/* API Settings */}
        <div>
          <button
            onClick={() => setShowApiSettings(!showApiSettings)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-2"
          >
            {showApiSettings ? 'Hide API Settings' : 'Show API Settings'}
          </button>
          
          {showApiSettings && (
            <div className="p-3 border rounded bg-gray-50 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Llama API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Llama API key"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
                  disabled={isComparing || isFullBookComparing}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used for analyzing the relationships between passages.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI API Key
                </label>
                <input
                  type="text"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="Enter your OpenAI API key"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
                  disabled={isComparing || isFullBookComparing}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used for generating embeddings to find similar passages.
                </p>
              </div>
              
              <div className="text-xs text-amber-600 mt-1">
                Note: Your API keys are used client-side and not stored on any server. 
                They are saved in your browser's local storage.
              </div>
            </div>
          )}
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          <button
            className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:bg-gray-400 flex-1"
            onClick={handleCompare}
            disabled={isComparing || isFullBookComparing || !sourceBookId || !targetBookId || !selectedPassageId || !openaiApiKey}
          >
            {isComparing ? (isIndexing ? 'Indexing Target Book...' : 'Comparing...') : 'Compare Passage'}
          </button>
          
          <button
            className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors disabled:bg-gray-400 flex-1"
            onClick={handleCompareAllPassages}
            disabled={isComparing || isFullBookComparing || !sourceBookId || !targetBookId || !openaiApiKey}
          >
            {isFullBookComparing ? 'Analyzing All Passages...' : 'Analyze All Passages'}
          </button>
        </div>
      </div>
      
      {(isComparing || isFullBookComparing) && (
        <div className="mt-4">
          <div className="text-center text-blue-600">
            <p className="animate-pulse">
              {isFullBookComparing 
                ? 'Analyzing all passages... This may take several minutes.' 
                : isIndexing 
                  ? 'Indexing target book... This may take a few minutes.' 
                  : 'Comparing passages... This may take a moment.'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {isFullBookComparing
                ? 'Finding and analyzing all relationships between books.'
                : isIndexing 
                  ? 'We only need to index each book once.' 
                  : 'Finding related passages and analyzing relationships.'}
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
                    ? logs.map((log, i) => <div key={i} className={`${log.includes('ERROR') ? 'text-red-600' : 'text-gray-800'}`}>{log}</div>)
                    : 'No logs yet...'}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Single passage comparison results */}
      {relations.length > 0 && !isComparing && !isFullBookComparing && !isShowingAllRelations && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-900">Related Passages in {targetBook?.title}</h3>
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
          </div>
          
          {showLogs && (
            <div className="mb-4 p-3 bg-gray-50 border rounded max-h-60 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800">
                {logs.map((log, i) => (
                  <div key={i} className={log.includes('ERROR') ? 'text-red-600' : 'text-gray-800'}>
                    {log}
                  </div>
                ))}
              </pre>
            </div>
          )}
          
          <p className="text-green-600 mb-4 font-medium">
            Found {relations.length} related passages in {targetBook?.title}
          </p>
          
          <div className="space-y-4">
            {relations.map((relation) => {
              const relatedPassage = getPassageById(relation.relatedPassageId);
              
              return (
                <div key={relation.relatedPassageId} className="border p-4 rounded shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs px-2 py-1 rounded ${getRelationColor(relation.relationType)}`}>
                      {relation.relationType.charAt(0).toUpperCase() + relation.relationType.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      Similarity: {(relation.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2 italic">
                    {relation.evidence}
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded text-sm">
                    {relatedPassage?.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Full book comparison results */}
      {isShowingAllRelations && !isComparing && !isFullBookComparing && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-900">
              Book Comparison: {sourceBook?.title} → {targetBook?.title}
            </h3>
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
          </div>
          
          {showLogs && (
            <div className="mb-4 p-3 bg-gray-50 border rounded max-h-60 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800">
                {logs.map((log, i) => (
                  <div key={i} className={log.includes('ERROR') ? 'text-red-600' : 'text-gray-800'}>
                    {log}
                  </div>
                ))}
              </pre>
            </div>
          )}
          
          {/* Summary statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-3 rounded border border-blue-100">
              <div className="text-sm text-blue-800 font-medium">Total Passages</div>
              <div className="text-2xl text-blue-900">{allRelations.size}</div>
            </div>
            
            <div className="bg-green-50 p-3 rounded border border-green-100">
              <div className="text-sm text-green-800 font-medium">Supports</div>
              <div className="text-2xl text-green-900">
                {Array.from(allRelations.values()).flat().filter(r => r.relationType === 'supports').length}
              </div>
            </div>
            
            <div className="bg-red-50 p-3 rounded border border-red-100">
              <div className="text-sm text-red-800 font-medium">Contradicts</div>
              <div className="text-2xl text-red-900">
                {Array.from(allRelations.values()).flat().filter(r => r.relationType === 'contradicts').length}
              </div>
            </div>
            
            <div className="bg-purple-50 p-3 rounded border border-purple-100">
              <div className="text-sm text-purple-800 font-medium">Extends/Analogous</div>
              <div className="text-2xl text-purple-900">
                {Array.from(allRelations.values()).flat().filter(r => 
                  r.relationType === 'extends' || r.relationType === 'analogous'
                ).length}
              </div>
            </div>
          </div>
          
          {/* Passage relationships */}
          <div className="space-y-6">
            {Array.from(allRelations.entries()).map(([passageId, relations]) => {
              const sourcePassage = getPassageById(passageId);
              
              if (!sourcePassage || relations.length === 0) return null;
              
              return (
                <div key={passageId} className="border p-4 rounded shadow-sm">
                  <div className="mb-3">
                    <div className="font-medium text-gray-900 mb-1">Source Passage:</div>
                    <div className="p-3 bg-gray-50 rounded text-sm mb-3">
                      {sourcePassage.text}
                    </div>
                    
                    <div className="font-medium text-gray-900 mb-2">Related Passages:</div>
                    <div className="space-y-3">
                      {relations.map((relation) => {
                        const relatedPassage = getPassageById(relation.relatedPassageId);
                        
                        return (
                          <div key={relation.relatedPassageId} className="pl-4 border-l-2 border-gray-200">
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-xs px-2 py-1 rounded ${getRelationColor(relation.relationType)}`}>
                                {relation.relationType.charAt(0).toUpperCase() + relation.relationType.slice(1)}
                              </span>
                              <span className="text-xs text-gray-500">
                                Similarity: {(relation.similarity * 100).toFixed(1)}%
                              </span>
                            </div>
                            
                            <div className="text-sm text-gray-600 mb-2 italic">
                              {relation.evidence}
                            </div>
                            
                            <div className="p-3 bg-gray-50 rounded text-sm">
                              {relatedPassage?.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 