import OpenAI from 'openai';
import { Passage } from '@/lib/textProcessing';

// OpenAI API key
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

// Default config for embedding
interface EmbeddingServiceConfig {
  apiKey: string;
  model: string;
}

// Default config
const DEFAULT_CONFIG: EmbeddingServiceConfig = {
  apiKey: OPENAI_API_KEY,
  model: 'text-embedding-3-large',
};

// Vector storage interface
interface PassageVector {
  passageId: string;
  bookId: string;
  vector: number[];
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Service for generating and storing embeddings
 */
export class EmbeddingService {
  private config: EmbeddingServiceConfig;
  private openai: OpenAI;
  private passageVectors: Map<string, PassageVector> = new Map();
  
  constructor(config: Partial<EmbeddingServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.openai = new OpenAI({
      apiKey: this.config.apiKey || '',
      dangerouslyAllowBrowser: true // Enable client-side usage
    });
  }
  
  /**
   * Set OpenAI API key
   */
  setApiKey(apiKey: string) {
    this.config.apiKey = apiKey;
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true // Enable client-side usage
    });
  }
  
  /**
   * Generate embedding for a passage
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenAI API key is required. Please set your API key in .env.local file or via the UI.');
      }
      
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }
  
  /**
   * Process and store embeddings for multiple passages
   */
  async processPassages(passages: Passage[]): Promise<void> {
    console.log(`Processing embeddings for ${passages.length} passages`);
    
    // Generate embeddings for each passage
    const results = await Promise.all(
      passages.map(async (passage) => {
        try {
          const vector = await this.generateEmbedding(passage.text);
          return {
            passageId: passage.id,
            bookId: passage.bookId,
            vector,
          };
        } catch (error) {
          console.error(`Error processing passage ${passage.id}:`, error);
          return null;
        }
      })
    );
    
    // Store the valid results
    results.filter(Boolean).forEach((result) => {
      if (result) {
        this.passageVectors.set(result.passageId, result);
      }
    });
    
    console.log(`Successfully processed embeddings for ${results.filter(Boolean).length} passages`);
  }
  
  /**
   * Find similar passages to the query passage
   */
  async findSimilarPassages(
    queryPassage: Passage,
    targetBookId: string,
    topK: number = 5
  ): Promise<{passage: Passage, similarity: number}[]> {
    try {
      // Get the embedding for the query passage
      const queryVector = await this.generateEmbedding(queryPassage.text);
      
      // Find passages from the target book
      const targetPassageVectors = Array.from(this.passageVectors.values())
        .filter(pv => pv.bookId === targetBookId);
      
      if (targetPassageVectors.length === 0) {
        throw new Error(`No passages found for book ${targetBookId}`);
      }
      
      // Calculate similarities
      const similarities = targetPassageVectors.map(passageVector => {
        const similarity = cosineSimilarity(queryVector, passageVector.vector);
        return {
          passageId: passageVector.passageId,
          similarity,
        };
      });
      
      // Sort by similarity and take top K
      const topResults = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
      
      return topResults.map(result => ({
        passage: {
          id: result.passageId,
          text: '', // This needs to be filled from the book store
          start: 0,
          end: 0,
          bookId: targetBookId,
        },
        similarity: result.similarity,
      }));
    } catch (error) {
      console.error('Error finding similar passages:', error);
      throw error;
    }
  }
  
  /**
   * Clear all stored vectors
   */
  clearVectors(): void {
    this.passageVectors.clear();
  }
  
  /**
   * Get all passage vectors for a specific book
   */
  getBookVectors(bookId: string): PassageVector[] {
    return Array.from(this.passageVectors.values())
      .filter(pv => pv.bookId === bookId);
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService(); 