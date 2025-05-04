'use client';

import React, { useEffect, useState } from 'react';
import { autoComparisonService } from '@/services/autoComparisonService';

interface ComparisonProgress {
  sourceBookId: string;
  targetBookId: string;
  progress: number;
  message: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  error?: string;
}

export default function AutoComparisonProgress() {
  const [comparisons, setComparisons] = useState<ComparisonProgress[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  
  useEffect(() => {
    // Function to handle progress updates
    const handleProgress = (progress: ComparisonProgress) => {
      setComparisons(prev => {
        // Find if we already have this comparison
        const existingIndex = prev.findIndex(
          c => c.sourceBookId === progress.sourceBookId && c.targetBookId === progress.targetBookId
        );
        
        if (existingIndex >= 0) {
          // Update existing comparison
          const updated = [...prev];
          updated[existingIndex] = progress;
          return updated;
        } else {
          // Add new comparison
          return [...prev, progress];
        }
      });
    };
    
    // Register the progress callback
    autoComparisonService.addProgressCallback(handleProgress);
    
    // Load initial comparisons
    setComparisons(autoComparisonService.getCurrentComparisons());
    
    // Cleanup on unmount
    return () => {
      autoComparisonService.removeProgressCallback(handleProgress);
    };
  }, []);
  
  // Filter comparisons based on showCompleted state
  const filteredComparisons = showCompleted 
    ? comparisons 
    : comparisons.filter(c => c.status === 'running' || c.status === 'pending' || c.status === 'error');
  
  // Check if we have any comparisons to show
  if (filteredComparisons.length === 0) {
    return null;
  }
  
  // Get counts by status
  const pendingCount = comparisons.filter(c => c.status === 'pending').length;
  const runningCount = comparisons.filter(c => c.status === 'running').length;
  const completedCount = comparisons.filter(c => c.status === 'complete').length;
  const errorCount = comparisons.filter(c => c.status === 'error').length;
  
  return (
    <div className="fixed bottom-0 right-0 w-96 max-h-96 z-50 bg-white border border-gray-200 shadow-lg rounded-tl-md overflow-hidden flex flex-col">
      <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
        <h3 className="font-medium text-sm">Automatic Book Comparisons</h3>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-xs text-blue-100 hover:text-white"
          >
            {showCompleted ? 'Hide Completed' : 'Show Completed'}
          </button>
          <button 
            onClick={() => setComparisons([])}
            className="text-xs text-blue-100 hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="flex justify-around p-2 text-xs border-b">
        <div className="flex items-center">
          <span className={`w-2 h-2 rounded-full mr-1 ${runningCount > 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></span>
          <span>Running: {runningCount}</span>
        </div>
        <div className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
          <span>Completed: {completedCount}</span>
        </div>
        <div className="flex items-center">
          <span className={`w-2 h-2 rounded-full mr-1 ${errorCount > 0 ? 'bg-red-500' : 'bg-gray-300'}`}></span>
          <span>Errors: {errorCount}</span>
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1 max-h-72">
        {filteredComparisons.map((comparison, index) => (
          <div 
            key={`${comparison.sourceBookId}_${comparison.targetBookId}_${index}`}
            className={`p-3 border-b text-sm ${
              comparison.status === 'error' 
                ? 'bg-red-50' 
                : comparison.status === 'complete' 
                  ? 'bg-green-50' 
                  : 'bg-white'
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="font-medium text-gray-800 text-xs">
                Comparing Books
              </div>
              <div className={`text-xs px-1.5 py-0.5 rounded ${
                comparison.status === 'running' 
                  ? 'bg-blue-100 text-blue-800' 
                  : comparison.status === 'complete' 
                    ? 'bg-green-100 text-green-800' 
                    : comparison.status === 'error' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-gray-100 text-gray-800'
              }`}>
                {comparison.status.charAt(0).toUpperCase() + comparison.status.slice(1)}
              </div>
            </div>
            
            <div className="text-xs text-gray-600 mb-2">
              {comparison.message}
            </div>
            
            {comparison.status === 'running' && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full" 
                  style={{ width: `${comparison.progress}%` }}
                ></div>
              </div>
            )}
            
            {comparison.status === 'error' && comparison.error && (
              <div className="text-xs text-red-600 mt-1">
                Error: {comparison.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 