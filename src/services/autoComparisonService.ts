'use client';

import { Book } from '@/lib/textProcessing';
import { useBookStore } from '@/store/bookStore';
import { useComparisonStore } from '@/store/comparisonStore';
import { passageComparisonService } from './passageComparisonService';

interface ComparisonProgress {
  sourceBookId: string;
  targetBookId: string;
  progress: number;
  message: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  error?: string;
}

class AutoComparisonService {
  private apiKeysSet = false;
  private llamaApiKey: string = '';
  private openaiApiKey: string = '';
  private progressCallbacks: ((progress: ComparisonProgress) => void)[] = [];
  private currentComparisons: Map<string, ComparisonProgress> = new Map();
  private autoSimilarityThreshold: number = 0.5; // Higher default threshold for auto-comparison
  
  /**
   * Set API keys for the comparison service
   */
  setApiKeys(llamaApiKey: string, openaiApiKey: string) {
    this.llamaApiKey = llamaApiKey;
    this.openaiApiKey = openaiApiKey;
    this.apiKeysSet = true;
    passageComparisonService.setApiKey(llamaApiKey, openaiApiKey);
  }
  
  /**
   * Set the similarity threshold specifically for auto-comparison
   */
  setAutoSimilarityThreshold(threshold: number) {
    if (threshold >= 0 && threshold <= 1) {
      this.autoSimilarityThreshold = threshold;
    }
  }
  
  /**
   * Get the current auto-comparison similarity threshold
   */
  getAutoSimilarityThreshold(): number {
    return this.autoSimilarityThreshold;
  }
  
  /**
   * Add a progress callback function
   */
  addProgressCallback(callback: (progress: ComparisonProgress) => void) {
    this.progressCallbacks.push(callback);
  }
  
  /**
   * Remove a progress callback function
   */
  removeProgressCallback(callback: (progress: ComparisonProgress) => void) {
    this.progressCallbacks = this.progressCallbacks.filter(cb => cb !== callback);
  }
  
  /**
   * Check if API keys are set
   */
  areApiKeysSet(): boolean {
    return this.apiKeysSet && !!this.openaiApiKey;
  }
  
  /**
   * Compare a newly uploaded book with all existing books
   */
  async compareWithAllBooks(newBook: Book): Promise<void> {
    if (!this.areApiKeysSet()) {
      console.warn('API keys not set for automatic comparison. Skipping comparison.');
      return;
    }
    
    const bookStore = useBookStore.getState();
    const comparisonStore = useComparisonStore.getState();
    
    // Get all existing books except the new one
    const existingBooks = bookStore.books.filter(book => book.id !== newBook.id);
    
    if (existingBooks.length === 0) {
      console.log('No existing books to compare with.');
      return;
    }
    
    // Use a higher threshold specifically for automatic comparisons to reduce noise
    console.log(`Using similarity threshold of ${this.autoSimilarityThreshold} for automatic comparison`);
    passageComparisonService.setSimilarityThreshold(this.autoSimilarityThreshold);
    
    // Set API keys
    passageComparisonService.setApiKey(this.llamaApiKey, this.openaiApiKey);
    
    // First index the new book
    try {
      await passageComparisonService.indexBook(newBook.id);
      comparisonStore.addIndexedBook(newBook.id);
    } catch (error) {
      console.error(`Error indexing new book ${newBook.title}:`, error);
      return;
    }
    
    // Compare with each existing book
    for (const existingBook of existingBooks) {
      const comparisonKey = `${newBook.id}_${existingBook.id}`;
      
      // Update progress state
      this.currentComparisons.set(comparisonKey, {
        sourceBookId: newBook.id,
        targetBookId: existingBook.id,
        progress: 0,
        message: `Starting comparison of "${newBook.title}" with "${existingBook.title}"`,
        status: 'running'
      });
      this.updateProgress(comparisonKey);
      
      try {
        // Check if target book is already indexed
        if (!comparisonStore.isBookIndexed(existingBook.id)) {
          this.updateComparisonProgress(comparisonKey, 5, `Indexing target book: ${existingBook.title}`, 'running');
          await passageComparisonService.indexBook(existingBook.id);
          comparisonStore.addIndexedBook(existingBook.id);
        }
        
        // Custom progress callback for this comparison
        const progressCallback = (progress: number, message: string) => {
          this.updateComparisonProgress(comparisonKey, progress, message, 'running');
        };
        
        // Compare all passages between the two books at once
        // Using topK=2 to limit the number of relationships
        const results = await passageComparisonService.compareAllPassages(
          newBook.id,
          existingBook.id,
          2, // topK - reduced from 3 to 2 to limit relationships
          undefined, // batchSize is no longer used
          progressCallback
        );
        
        // Save the results
        comparisonStore.addBulkComparisons(results, newBook.id, existingBook.id);
        
        // Also compare in the reverse direction
        const reverseComparisonKey = `${existingBook.id}_${newBook.id}`;
        this.currentComparisons.set(reverseComparisonKey, {
          sourceBookId: existingBook.id,
          targetBookId: newBook.id,
          progress: 0,
          message: `Starting comparison of "${existingBook.title}" with "${newBook.title}"`,
          status: 'running'
        });
        this.updateProgress(reverseComparisonKey);
        
        // Using the same higher threshold and topK=2 for reverse comparison
        const reverseResults = await passageComparisonService.compareAllPassages(
          existingBook.id,
          newBook.id,
          2, // topK - reduced from 3 to 2 to limit relationships
          undefined, // batchSize is no longer used
          (progress, message) => {
            this.updateComparisonProgress(reverseComparisonKey, progress, message, 'running');
          }
        );
        
        // Save the reverse results
        comparisonStore.addBulkComparisons(reverseResults, existingBook.id, newBook.id);
        
        // Mark both comparisons as complete
        this.updateComparisonProgress(comparisonKey, 100, `Completed comparison of "${newBook.title}" with "${existingBook.title}"`, 'complete');
        this.updateComparisonProgress(reverseComparisonKey, 100, `Completed comparison of "${existingBook.title}" with "${newBook.title}"`, 'complete');
        
      } catch (error) {
        console.error(`Error comparing books ${newBook.title} and ${existingBook.title}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.updateComparisonProgress(comparisonKey, 0, errorMessage, 'error', errorMessage);
      }
    }
    
    // Restore the user's chosen threshold after automatic comparison
    const userThreshold = comparisonStore.getSimilarityThreshold();
    passageComparisonService.setSimilarityThreshold(userThreshold);
  }
  
  /**
   * Update progress for a specific comparison
   */
  private updateComparisonProgress(
    comparisonKey: string, 
    progress: number, 
    message: string, 
    status: ComparisonProgress['status'], 
    error?: string
  ) {
    const comparison = this.currentComparisons.get(comparisonKey);
    if (comparison) {
      comparison.progress = progress;
      comparison.message = message;
      comparison.status = status;
      comparison.error = error;
      this.updateProgress(comparisonKey);
    }
  }
  
  /**
   * Trigger progress callbacks
   */
  private updateProgress(comparisonKey: string) {
    const comparison = this.currentComparisons.get(comparisonKey);
    if (comparison) {
      this.progressCallbacks.forEach(callback => {
        callback(comparison);
      });
    }
  }
  
  /**
   * Get current comparisons
   */
  getCurrentComparisons(): ComparisonProgress[] {
    return Array.from(this.currentComparisons.values());
  }
}

// Singleton instance
export const autoComparisonService = new AutoComparisonService(); 