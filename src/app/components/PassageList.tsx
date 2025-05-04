'use client';

import React from 'react';
import { Passage } from '@/lib/textProcessing';

interface PassageListProps {
  passages: Passage[];
  bookTitle: string;
}

export default function PassageList({ passages, bookTitle }: PassageListProps) {
  if (passages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No passages found. Please check the file format.
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">{bookTitle} - {passages.length} Passages</h2>
      
      <div className="space-y-4">
        {passages.map((passage, index) => (
          <div 
            key={passage.id} 
            className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between mb-2">
              <h3 className="font-medium text-gray-900">Passage {index + 1}</h3>
              <span className="text-xs text-gray-500">
                Characters: {passage.end - passage.start}
              </span>
            </div>
            
            <p className="text-gray-600 whitespace-pre-line">
              {passage.text.length > 300 
                ? `${passage.text.substring(0, 300)}...` 
                : passage.text}
            </p>
            
            {passage.text.length > 300 && (
              <button 
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                onClick={() => alert(passage.text)}
              >
                Read More
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 