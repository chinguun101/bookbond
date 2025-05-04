'use client';

import React, { useState, useEffect } from 'react';
import { getBookCoverUrl } from '@/lib/bookCoverService';

interface BookCoverProps {
  bookTitle: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function BookCover({ 
  bookTitle, 
  className = '', 
  size = 'medium' 
}: BookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    async function fetchCover() {
      if (!bookTitle) return;
      
      setIsLoading(true);
      setError(false);
      
      try {
        const url = await getBookCoverUrl(bookTitle);
        if (mounted) {
          setCoverUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error loading book cover:', err);
          setError(true);
          setIsLoading(false);
        }
      }
    }

    fetchCover();

    return () => {
      mounted = false;
    };
  }, [bookTitle]);

  const sizeClasses = {
    small: 'h-32',
    medium: 'h-48',
    large: 'h-64'
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded-lg ${sizeClasses[size]} ${className}`}>
        <div className="w-full h-full" style={{ aspectRatio: '2/3' }}></div>
      </div>
    );
  }

  if (error || !coverUrl) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${sizeClasses[size]} ${className}`}>
        <div className="text-center p-4">
          <svg 
            className="w-12 h-12 text-gray-400 mx-auto mb-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" 
            />
          </svg>
          <p className="text-xs text-gray-500">No cover available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden ${sizeClasses[size]} ${className}`}>
      <img 
        src={coverUrl} 
        alt={`${bookTitle} cover`}
        className="w-full h-full object-cover"
        onError={() => {
          setError(true);
          setCoverUrl(null);
        }}
      />
    </div>
  );
} 