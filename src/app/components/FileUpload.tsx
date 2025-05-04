'use client';

import React, { useState } from 'react';

interface FileUploadProps {
  onFileProcess: (text: string, fileName: string) => void;
}

export default function FileUpload({ onFileProcess }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.txt')) {
      setError('Only .txt files are supported');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const text = await file.text();
      onFileProcess(text, file.name);
    } catch (err) {
      setError('Failed to read file content');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div 
        className={`relative p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".txt"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
          disabled={loading}
        />
        <div className="space-y-4">
          <div className="flex justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            {loading ? (
              <p className="text-sm text-gray-500">Processing...</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">Drag and drop your .txt file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">Only .txt files are supported</p>
              </>
            )}
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 text-sm text-red-500 text-center">
          {error}
        </div>
      )}
    </div>
  );
} 