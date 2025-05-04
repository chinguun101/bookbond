import { Passage } from '@/lib/textProcessing';
import { LLMService } from './llmService';
import { embeddingService } from './embeddingService';
import { useBookStore } from '@/store/bookStore';
import { TimeoutController } from '@/utils/timeoutController';

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
const DEFAULT_SIMILARITY_THRESHOLD = 0.50;

// Define type for the LLM response callback
type LLMResponseCallback = (prompt: string) => Promise<string>;

/**
 * Service for comparing passages between books
 */
export class PassageComparisonService {
  private llmService: LLMService;
  private similarityThreshold: number;
  private llamaApiKey: string = '';
  
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
    this.llamaApiKey = llamaApiKey;
    
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
    
    // Map to store all relations by passage ID
    const allRelations = new Map<string, PassageRelation[]>();
    
    // Process all passages at once instead of in batches
    progressCallback?.(20, `Finding similar passages for all ${sourcePassages.length} passages at once`);
    
    // Find similar passages for all source passages at once using embeddings
    const allSimilarPassages = await Promise.all(
      sourcePassages.map(async (passage) => {
        try {
          // Find similar passages using embeddings
          const similarPassages = await embeddingService.findSimilarPassages(
            passage,
            targetBookId,
            topK
          );
          
          // Filter by similarity threshold
          const thresholdPassages = similarPassages.filter(p => p.similarity >= this.similarityThreshold);
          
          return {
            passageId: passage.id,
            passage: passage,
            similarPassages: thresholdPassages,
          };
        } catch (error) {
          console.error(`Error finding similar passages for ${passage.id}:`, error);
          return {
            passageId: passage.id,
            passage: passage,
            similarPassages: [],
          };
        }
      })
    );
    
    progressCallback?.(60, `Found similar passages, now analyzing relationships`);
    
    // Filter out passages with no similar passages
    const passagesWithSimilarities = allSimilarPassages.filter(
      result => result.similarPassages.length > 0
    );
    
    if (passagesWithSimilarities.length === 0) {
      progressCallback?.(100, `No similar passages found above threshold`);
      return allRelations;
    }
    
    // For each passage with similar passages, analyze the relationships
    for (const result of passagesWithSimilarities) {
      const { passageId, passage, similarPassages } = result;
      
      // Fill in the passage texts
      const passagesWithText = similarPassages.map(similar => {
        const relatedPassage = bookStore.getPassages(targetBookId)
          .find(p => p.id === similar.passage.id);
        
        if (!relatedPassage) {
          throw new Error(`Passage ${similar.passage.id} not found in book ${targetBookId}`);
        }
        
        return {
          passage: relatedPassage,
          similarity: similar.similarity
        };
      });
      
      // Generate the prompt for the LLM to analyze relationships
      const relations = await this.analyzeRelationships(
        passage,
        passagesWithText.map(p => p.passage),
        passagesWithText.map(p => p.similarity)
      );
      
      allRelations.set(passageId, relations);
    }
    
    progressCallback?.(100, `Comparison complete`);
    
    return allRelations;
  }
  
  /**
   * Direct call to LLama API for relationship analysis
   */
  private async callLlamaDirectly(prompt: string): Promise<string> {
    try {
      console.log('Making direct Llama API call for relationship analysis');
      
      const response = await fetch('https://api.llama.com/compat/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llamaApiKey}`
        },
        body: JSON.stringify({
          model: 'Llama-4-Maverick-17B-128E-Instruct-FP8',
          messages: [
            { role: 'system', content: 'You are an expert in textual analysis. Return valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 4000,
          stream: false,
          top_p: 0.95
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error: ${response.status} ${response.statusText}. Details: ${errorText}`);
      }
      
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error calling Llama API directly:', error);
      throw error;
    }
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
      // Call Llama directly
      const rawResponse = await this.callLlamaDirectly(prompt);
      
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
    
    // Format the JSON input for the LLM, but avoid stringifying the full passages
    // to keep the prompt more concise and focused
    return `You are an expert in analyzing relationships between text passages. Analyze the following focus passage and its relationship to candidate passages.

FOCUS PASSAGE:
"""
${focusPassage.text}
"""

CANDIDATE PASSAGES:
${candidatePassages.map((p, i) => `
PASSAGE #${i+1} [ID: ${p.id}]:
"""
${p.text}
"""
`).join('\n')}

TASK:
For each candidate passage, determine its relationship to the focus passage. The relationship must be one of: supports, contradicts, extends, analogous.

- supports: The candidate passage provides evidence or arguments that strengthen the focus passage's claims
- contradicts: The candidate passage presents claims, facts, or views that oppose those in the focus passage
- extends: The candidate passage builds upon, elaborates, or provides additional context for the focus passage
- analogous: The candidate passage presents similar ideas in a different context or domain

OUTPUT FORMAT:
Return a JSON array where each object contains:
1. "passage_id": The ID of the candidate passage
2. "relation": The relationship type (supports, contradicts, extends, analogous)
3. "evidence": A brief explanation (1-2 sentences) justifying why this relationship was chosen

IMPORTANT: Return ONLY valid JSON with no markdown formatting, no explanations outside the JSON. Each candidate passage must have one entry in the results.

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
        // Try to clean up the response before parsing
        // Remove any extra text before the first '[' and after the last ']'
        const jsonMatch = response.match(/(\[[\s\S]*\])/);
        if (jsonMatch) {
          jsonResponse = JSON.parse(jsonMatch[1]);
        } else {
          // Try to parse the raw response
          jsonResponse = JSON.parse(response);
        }
      }
      
      // Ensure it's an array
      if (!Array.isArray(jsonResponse)) {
        throw new Error('Response is not a valid array');
      }
      
      // Map to our internal structure
      return jsonResponse.map((item: any) => {
        const passageId = item.passage_id;
        const passage = candidatePassages.find(p => p.id === passageId);
        
        if (!passage) {
          console.warn(`Passage ${passageId} not found in candidates, skipping`);
          return null;
        }
        
        // Find the similarity score for this passage
        const passageIndex = candidatePassages.findIndex(p => p.id === passageId);
        const similarity = passageIndex >= 0 && passageIndex < similarities.length 
          ? similarities[passageIndex] 
          : 0;
        
        return {
          focusPassageId,
          relatedPassageId: passageId,
          relationType: item.relation as RelationType,
          evidence: item.evidence,
          similarity
        };
      }).filter(Boolean) as PassageRelation[]; // Filter out null values
    } catch (error) {
      console.error('Error parsing relations from response:', error);
      console.error('Raw response:', response);
      
      // Return an empty array if parsing fails
      return [];
    }
  }
}

// Singleton instance
export const passageComparisonService = new PassageComparisonService(); 