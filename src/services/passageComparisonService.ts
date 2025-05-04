import { Passage } from '@/lib/textProcessing';
import { LLMService } from './llmService';
import { embeddingService } from './embeddingService';
import { useBookStore } from '@/store/bookStore';

/**
 * Types for passage comparisons
 */
export type RelationType = 'supports' | 'contradicts' | 'extends' | 'analogous';

export interface PassageRelation {
  focusPassageId: string;
  relatedPassageId: string;
  relationType: RelationType;
  evidence: string;
  similarity: number;
}

// Default threshold for similarity
const DEFAULT_SIMILARITY_THRESHOLD = 0.75;

/**
 * Service for comparing passages between books
 */
export class PassageComparisonService {
  private llmService: LLMService;
  private similarityThreshold: number;
  
  constructor(similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD) {
    this.llmService = new LLMService();
    this.similarityThreshold = similarityThreshold;
  }
  
  /**
   * Set the similarity threshold
   */
  setSimilarityThreshold(threshold: number) {
    this.similarityThreshold = threshold;
  }
  
  /**
   * Set API key for the underlying services
   */
  setApiKey(llamaApiKey: string, openaiApiKey?: string) {
    this.llmService.setApiKey(llamaApiKey);
    // If OpenAI API key is provided, set it for the embedding service
    if (openaiApiKey) {
      embeddingService.setApiKey(openaiApiKey);
    }
  }
  
  /**
   * Process all passages in a book to generate embeddings
   */
  async indexBook(bookId: string): Promise<void> {
    const bookStore = useBookStore.getState();
    const passages = bookStore.getPassages(bookId);
    
    if (passages.length === 0) {
      throw new Error(`No passages found for book ${bookId}`);
    }
    
    console.log(`Indexing book ${bookId} with ${passages.length} passages`);
    
    // Process all passages to generate embeddings
    await embeddingService.processPassages(passages);
    
    console.log(`Successfully indexed book ${bookId}`);
  }
  
  /**
   * Compare a focus passage with passages from another book
   */
  async compareWithBook(
    focusPassage: Passage,
    targetBookId: string,
    topK: number = 5
  ): Promise<PassageRelation[]> {
    const bookStore = useBookStore.getState();
    
    // Ensure the target book is indexed
    const targetBookVectors = embeddingService.getBookVectors(targetBookId);
    if (targetBookVectors.length === 0) {
      // Book not indexed yet, do it now
      await this.indexBook(targetBookId);
    }
    
    // Find similar passages using embeddings
    const similarPassages = await embeddingService.findSimilarPassages(
      focusPassage,
      targetBookId,
      topK
    );
    
    // Filter by similarity threshold
    const thresholdPassages = similarPassages.filter(p => p.similarity >= this.similarityThreshold);
    
    // If no passages meet the threshold, return empty array
    if (thresholdPassages.length === 0) {
      return [];
    }
    
    // Fill in the passage texts
    const passagesWithText = thresholdPassages.map(result => {
      const passage = bookStore.getPassages(targetBookId)
        .find(p => p.id === result.passage.id);
      
      if (!passage) {
        throw new Error(`Passage ${result.passage.id} not found in book ${targetBookId}`);
      }
      
      return {
        passage,
        similarity: result.similarity
      };
    });
    
    // Generate the prompt for the LLM to analyze relationships
    const relations = await this.analyzeRelationships(
      focusPassage,
      passagesWithText.map(p => p.passage),
      passagesWithText.map(p => p.similarity)
    );
    
    return relations;
  }
  
  /**
   * Compare all passages from source book with passages from target book
   */
  async compareAllPassages(
    sourceBookId: string,
    targetBookId: string,
    topK: number = 3,
    batchSize: number = 5,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<Map<string, PassageRelation[]>> {
    const bookStore = useBookStore.getState();
    const sourceBook = bookStore.getBook(sourceBookId);
    const targetBook = bookStore.getBook(targetBookId);
    
    if (!sourceBook || !targetBook) {
      throw new Error('Source or target book not found');
    }
    
    // Ensure both books are indexed
    const sourceBookVectors = embeddingService.getBookVectors(sourceBookId);
    if (sourceBookVectors.length === 0) {
      progressCallback?.(5, `Indexing source book: ${sourceBook.title}`);
      await this.indexBook(sourceBookId);
    }
    
    const targetBookVectors = embeddingService.getBookVectors(targetBookId);
    if (targetBookVectors.length === 0) {
      progressCallback?.(10, `Indexing target book: ${targetBook.title}`);
      await this.indexBook(targetBookId);
    }
    
    progressCallback?.(15, `Starting comparison of all passages`);
    
    // Get all passages from source book
    const sourcePassages = bookStore.getPassages(sourceBookId);
    
    // Create batches of passages to process
    const batches: Passage[][] = [];
    for (let i = 0; i < sourcePassages.length; i += batchSize) {
      batches.push(sourcePassages.slice(i, i + batchSize));
    }
    
    // Map to store all relations by passage ID
    const allRelations = new Map<string, PassageRelation[]>();
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchProgress = i / batches.length;
      const progressStart = 15 + batchProgress * 85;
      progressCallback?.(
        progressStart, 
        `Processing batch ${i+1}/${batches.length} (${batch.length} passages)`
      );
      
      // Process passages in batch concurrently
      const results = await Promise.all(
        batch.map(async (passage) => {
          try {
            const relations = await this.compareWithBook(passage, targetBookId, topK);
            return { passageId: passage.id, relations };
          } catch (error) {
            console.error(`Error comparing passage ${passage.id}:`, error);
            return { passageId: passage.id, relations: [] };
          }
        })
      );
      
      // Store results from this batch
      results.forEach(({ passageId, relations }) => {
        allRelations.set(passageId, relations);
      });
      
      const progressEnd = 15 + ((i + 1) / batches.length) * 85;
      progressCallback?.(
        progressEnd, 
        `Completed batch ${i+1}/${batches.length}`
      );
    }
    
    progressCallback?.(100, `Comparison complete`);
    
    return allRelations;
  }
  
  /**
   * Use LLM to analyze relationships between passages
   */
  private async analyzeRelationships(
    focusPassage: Passage,
    candidatePassages: Passage[],
    similarities: number[]
  ): Promise<PassageRelation[]> {
    // Create the prompt
    const prompt = this.createRelationshipPrompt(focusPassage, candidatePassages);
    
    try {
      // Get response from LLM
      const rawResponse = await this.llmService.getCustomLLMResponse(prompt);
      
      // Parse the response
      const relations = this.parseRelationsFromResponse(
        rawResponse,
        focusPassage.id,
        candidatePassages,
        similarities
      );
      
      return relations;
    } catch (error) {
      console.error('Error analyzing relationships:', error);
      throw error;
    }
  }
  
  /**
   * Create a prompt for the LLM to analyze relationships
   */
  private createRelationshipPrompt(
    focusPassage: Passage,
    candidatePassages: Passage[]
  ): string {
    const relationTypes: RelationType[] = ['supports', 'contradicts', 'extends', 'analogous'];
    
    // Format the JSON input for the LLM
    const inputJson = {
      focus_passage: focusPassage.text,
      candidate_passages: candidatePassages.map(p => p.text),
      relation_types: relationTypes,
      passage_ids: candidatePassages.map(p => p.id)
    };
    
    return `You are an expert in textual analysis and identifying relationships between passages.
    
System: Return valid JSON only, no markdown formatting, no explanations outside the JSON.

User: ${JSON.stringify(inputJson, null, 2)}

The output must be a valid JSON array where each object has:
- passage_id: The ID of the candidate passage
- relation: One of the relation types from the input
- evidence: Brief explanation (1-2 sentences) of why this relation was chosen

Example output format:
[
  {
    "passage_id": "${candidatePassages[0]?.id || 'example-id-1'}",
    "relation": "supports",
    "evidence": "Both passages argue that..."
  },
  {
    "passage_id": "${candidatePassages[1]?.id || 'example-id-2'}",
    "relation": "contradicts",
    "evidence": "While the focus passage states X, this passage claims Y instead."
  }
]`;
  }
  
  /**
   * Parse the LLM response into structured relations
   */
  private parseRelationsFromResponse(
    response: string,
    focusPassageId: string,
    candidatePassages: Passage[],
    similarities: number[]
  ): PassageRelation[] {
    try {
      // Try to parse as JSON
      let jsonResponse;
      
      // Check if response is wrapped in markdown code blocks
      const markdownMatch = response.match(/```(?:json)?\s+([\s\S]+?)\s+```/);
      if (markdownMatch) {
        // Extract the content inside the code blocks
        jsonResponse = JSON.parse(markdownMatch[1]);
      } else {
        // Try to parse the raw response
        jsonResponse = JSON.parse(response);
      }
      
      // Ensure it's an array
      if (!Array.isArray(jsonResponse)) {
        throw new Error('Response is not a valid array');
      }
      
      // Map to our internal structure
      return jsonResponse.map((item: any, index: number) => {
        const passageId = item.passage_id;
        const passage = candidatePassages.find(p => p.id === passageId);
        
        if (!passage) {
          throw new Error(`Passage ${passageId} not found in candidates`);
        }
        
        return {
          focusPassageId,
          relatedPassageId: passageId,
          relationType: item.relation as RelationType,
          evidence: item.evidence,
          similarity: similarities[index] || 0
        };
      });
    } catch (error) {
      console.error('Error parsing relations from response:', error);
      console.error('Raw response:', response);
      
      // Return an empty array if parsing fails
      return [];
    }
  }
}

// Extend the LLMService with a custom response method
declare module './llmService' {
  interface LLMService {
    getCustomLLMResponse(prompt: string): Promise<string>;
  }
}

// Add custom method to LLMService
LLMService.prototype.getCustomLLMResponse = async function(prompt: string): Promise<string> {
  try {
    // Send request to LLM
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: 'You are an expert in textual analysis. Return JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error getting custom LLM response:', error);
    throw error;
  }
};

// Singleton instance
export const passageComparisonService = new PassageComparisonService(); 