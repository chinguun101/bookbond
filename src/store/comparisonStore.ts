import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PassageRelation } from '@/services/passageComparisonService';
import { Passage } from '@/lib/textProcessing';

interface ComparisonState {
  comparisons: Record<string, PassageRelation[]>; // focusPassageId -> relations
  bookComparisons: Record<string, string>; // sourceBookId_targetBookId -> completed (timestamp)
  indexedBooks: string[]; // Books that have been processed for embeddings
  similarityThreshold: number; // Threshold for considering passages similar
  
  // Comparison operations
  addComparison: (focusPassageId: string, relations: PassageRelation[]) => void;
  getComparison: (focusPassageId: string) => PassageRelation[] | undefined;
  clearComparisons: () => void;
  
  // Bulk comparison operations
  addBulkComparisons: (passageRelations: Map<string, PassageRelation[]>, sourceBookId: string, targetBookId: string) => void;
  getBookComparisonStatus: (sourceBookId: string, targetBookId: string) => string | undefined;
  clearBookComparison: (sourceBookId: string, targetBookId: string) => void;
  
  // Indexed books operations
  addIndexedBook: (bookId: string) => void;
  isBookIndexed: (bookId: string) => boolean;
  
  // Threshold operations
  setSimilarityThreshold: (threshold: number) => void;
  getSimilarityThreshold: () => number;
  
  // Helper methods
  getRelatedPassagesForPassage: (passageId: string, relationType?: string) => PassageRelation[];
  findComparisonKey: (focusPassageId: string, targetBookId: string) => string | undefined;
  getAllRelationsForBooks: (sourceBookId: string, targetBookId: string) => Map<string, PassageRelation[]>;
}

export const useComparisonStore = create<ComparisonState>()(
  persist(
    (set, get) => ({
      comparisons: {},
      bookComparisons: {},
      indexedBooks: [],
      similarityThreshold: 0.75, // Default threshold
      
      // Comparison operations
      addComparison: (focusPassageId, relations) => {
        set((state) => ({
          comparisons: {
            ...state.comparisons,
            [focusPassageId]: relations
          }
        }));
      },
      
      getComparison: (focusPassageId) => {
        return get().comparisons[focusPassageId];
      },
      
      clearComparisons: () => {
        set({ comparisons: {} });
      },
      
      // Bulk comparison operations
      addBulkComparisons: (passageRelations, sourceBookId, targetBookId) => {
        const timestamp = new Date().toISOString();
        const bookComparisonKey = `${sourceBookId}_${targetBookId}`;
        
        set((state) => {
          // Convert Map to Object for state update
          const newComparisons = { ...state.comparisons };
          
          passageRelations.forEach((relations, passageId) => {
            newComparisons[passageId] = relations;
          });
          
          return {
            comparisons: newComparisons,
            bookComparisons: {
              ...state.bookComparisons,
              [bookComparisonKey]: timestamp
            }
          };
        });
      },
      
      getBookComparisonStatus: (sourceBookId, targetBookId) => {
        const bookComparisonKey = `${sourceBookId}_${targetBookId}`;
        return get().bookComparisons[bookComparisonKey];
      },
      
      clearBookComparison: (sourceBookId, targetBookId) => {
        const bookComparisonKey = `${sourceBookId}_${targetBookId}`;
        
        set((state) => {
          const newBookComparisons = { ...state.bookComparisons };
          delete newBookComparisons[bookComparisonKey];
          
          // Also remove all passage comparisons related to these books
          const newComparisons = { ...state.comparisons };
          Object.keys(newComparisons).forEach(passageId => {
            if (passageId.includes(sourceBookId)) {
              delete newComparisons[passageId];
            }
          });
          
          return {
            bookComparisons: newBookComparisons,
            comparisons: newComparisons
          };
        });
      },
      
      // Indexed books operations
      addIndexedBook: (bookId) => {
        set((state) => {
          if (state.indexedBooks.includes(bookId)) {
            return state;
          }
          return {
            indexedBooks: [...state.indexedBooks, bookId]
          };
        });
      },
      
      isBookIndexed: (bookId) => {
        return get().indexedBooks.includes(bookId);
      },
      
      // Threshold operations
      setSimilarityThreshold: (threshold) => {
        set({ similarityThreshold: threshold });
      },
      
      getSimilarityThreshold: () => {
        return get().similarityThreshold;
      },
      
      // Helper methods
      getRelatedPassagesForPassage: (passageId, relationType) => {
        // Find all relations where this passage is the focus
        const relations = get().comparisons[passageId] || [];
        
        // Filter by relation type if specified
        if (relationType) {
          return relations.filter(r => r.relationType === relationType);
        }
        
        return relations;
      },
      
      findComparisonKey: (focusPassageId, targetBookId) => {
        // Look through all comparisons to find one with the given focus passage and target book
        const comparisons = get().comparisons;
        const keys = Object.keys(comparisons);
        
        for (const key of keys) {
          if (key === focusPassageId) {
            // Check if any relations in this comparison are from the target book
            const relations = comparisons[key];
            if (relations.some(r => r.relatedPassageId.includes(targetBookId))) {
              return key;
            }
          }
        }
        
        return undefined;
      },
      
      getAllRelationsForBooks: (sourceBookId, targetBookId) => {
        const allComparisons = get().comparisons;
        const result = new Map<string, PassageRelation[]>();
        
        // Filter relations for passages from the source book that reference passages from the target book
        Object.entries(allComparisons).forEach(([passageId, relations]) => {
          if (passageId.includes(sourceBookId)) {
            const targetRelations = relations.filter(r => r.relatedPassageId.includes(targetBookId));
            if (targetRelations.length > 0) {
              result.set(passageId, targetRelations);
            }
          }
        });
        
        return result;
      }
    }),
    {
      name: 'comparison-storage',
    }
  )
); 