import { Passage } from '@/lib/textProcessing';
import { 
  createPassageAnalysisPrompt, 
  parsePassageSummariesFromLLM, 
  PassageSummary 
} from '@/lib/conceptProcessing';

// Default API key from environment variables
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_LLAMA_API_KEY || "LLM|24233636562905000|uj_EryBhhQK5JGIkJYaXt0_T2eY";

/**
 * Configuration for LLM service
 */
interface LLMServiceConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  timeoutMs?: number; // Request timeout in milliseconds
}

/**
 * Default configuration using Llama API
 */
const DEFAULT_CONFIG: LLMServiceConfig = {
  apiKey: DEFAULT_API_KEY, // Pre-set API key
  endpoint: 'https://api.llama.com/compat/v1/chat/completions',
  model: 'Llama-4-Maverick-17B-128E-Instruct-FP8', // Using Llama's powerful model for text analysis
  timeoutMs: 180000 // 3 minutes timeout
};

/**
 * Timeout controller for fetch requests
 */
class TimeoutController {
  controller: AbortController;
  timeoutId: number | null = null;
  
  constructor(timeoutMs: number = 60000) {
    this.controller = new AbortController();
    
    this.timeoutId = window.setTimeout(() => {
      this.controller.abort();
    }, timeoutMs);
  }
  
  clear() {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * LLM Service for analyzing book passages
 */
export class LLMService {
  private config: LLMServiceConfig;
  private lastFullResponse: string = '';
  
  constructor(config: Partial<LLMServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Update service configuration
   */
  updateConfig(config: Partial<LLMServiceConfig>) {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Set API key
   */
  setApiKey(apiKey: string) {
    this.config.apiKey = apiKey;
  }
  
  /**
   * Get the last full response from the LLM
   */
  getLastFullResponse(): string {
    return this.lastFullResponse;
  }
  
  /**
   * Process smaller batches of passages to avoid timeouts
   */
  private async processBatch(passages: Passage[], batchSize: number = 3): Promise<PassageSummary[]> {
    const batches: Passage[][] = [];
    for (let i = 0; i < passages.length; i += batchSize) {
      batches.push(passages.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${passages.length} passages in ${batches.length} batches of ${batchSize}`);
    
    const results: PassageSummary[] = [];
    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i+1}/${batches.length} with ${batches[i].length} passages`);
      const batchResults = await this.analyzeSingleBatch(batches[i]);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * Analyze a single batch of passages
   */
  private async analyzeSingleBatch(passages: Passage[]): Promise<PassageSummary[]> {
    try {
      const prompt = createPassageAnalysisPrompt(passages);
      
      // Log what we're sending to the LLM
      console.log('===== LLM REQUEST =====');
      console.log(`Endpoint: ${this.config.endpoint}`);
      console.log(`Model: ${this.config.model}`);
      console.log('Passages being analyzed:', passages.length);
      console.log('First few passages IDs:', passages.slice(0, 3).map(p => p.id));
      console.log('Request body structure:');
      const requestBody = {
        model: this.config.model,
        messages: [
          { role: 'system', content: 'You are an expert in textual analysis and concept extraction. Your responses must be in valid JSON format without any markdown formatting or explanation. Respond with raw JSON only.' },
          { role: 'user', content: '(Prompt content omitted for brevity)' }
        ],
        temperature: 0.2,
        max_tokens: 10000
      };
      console.log(JSON.stringify(requestBody, null, 2));
      console.log('========================');
      
      // For Llama, modify the system message to emphasize raw JSON output
      const systemMessage = 'You are an expert in textual analysis and concept extraction. Your responses must be in valid JSON format without any markdown formatting. You MUST return a JSON array where each item contains passageId, summary, concepts, and keyPoints.';
      
      // Setup timeout controller
      const timeoutController = new TimeoutController(this.config.timeoutMs || 180000);
      
      try {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2, // Lower temperature for more consistent, structured output
            max_tokens: 10000 // Ensure we have enough tokens for complex analysis
          }),
          signal: timeoutController.controller.signal
        });
        
        // Clear the timeout now that we have a response
        timeoutController.clear();
        
        // Check if response is HTML instead of JSON (usually error pages)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Received HTML response instead of JSON. The API might be down or returning an error page.');
        }
        
        if (!response.ok) {
          let errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage += ` - ${JSON.stringify(errorData)}`;
            console.error('LLM API Error Response:', errorData);
          } catch (e) {
            console.error('Could not parse error response as JSON');
          }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // Log the response from the LLM
        console.log('===== LLM RESPONSE =====');
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        console.log('Response data structure:', Object.keys(data));
        console.log('Usage information:', data.usage);
        
        const llmResponse = data.choices[0]?.message?.content;
        this.lastFullResponse = llmResponse || '';
        
        // Log a preview of the content
        if (llmResponse) {
          console.log('Content preview (first 500 chars):', llmResponse.substring(0, 500) + '...');
          console.log('Content preview (last 500 chars):', '...' + llmResponse.substring(llmResponse.length - 500));
          
          // Try to validate if it's proper JSON
          try {
            const jsonTest = JSON.parse(llmResponse);
            console.log('Response is valid JSON:', typeof jsonTest === 'object');
            console.log('Number of items in response array:', Array.isArray(jsonTest) ? jsonTest.length : 'Not an array');
          } catch (error: any) {
            console.warn('Response is not valid JSON:', error.message);
            
            // Check if response is wrapped in markdown
            if (llmResponse.includes('```json') || llmResponse.includes('```')) {
              console.log('Response appears to contain markdown code blocks');
            }
          }
        } else {
          console.warn('No content in LLM response');
        }
        console.log('==========================');
        
        if (!llmResponse) {
          throw new Error('Empty response from LLM');
        }
        
        // Parse the LLM response into structured summaries
        const summaries = parsePassageSummariesFromLLM(llmResponse);
        
        // Log the parsed summaries
        console.log('===== PARSED SUMMARIES =====');
        console.log('Number of summaries extracted:', summaries.length);
        if (summaries.length > 0) {
          console.log('First summary example:', JSON.stringify(summaries[0], null, 2));
        } else {
          console.error('Failed to extract any summaries from the response');
          // Save the full response to a global variable for debugging
          (window as any).lastLLMResponse = llmResponse;
          console.log('Full LLM response saved to window.lastLLMResponse for debugging');
        }
        console.log('============================');
        
        // Add book IDs from the original passages
        const passageIdToBookId = new Map<string, string>();
        passages.forEach(passage => {
          passageIdToBookId.set(passage.id, passage.bookId);
        });
        
        // Update summaries with book IDs
        summaries.forEach(summary => {
          summary.bookId = passageIdToBookId.get(summary.passageId) || '';
        });
        
        return summaries;
      } catch (error: any) {
        // Clear the timeout if there's an error
        timeoutController.clear();
        
        if (error.name === 'AbortError') {
          throw new Error(`Request timed out after ${this.config.timeoutMs || 180000}ms. The API might be overloaded.`);
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error analyzing passage batch:', error);
      throw error;
    }
  }
  
  /**
   * Analyze passages with the LLM
   */
  async analyzePassages(passages: Passage[]): Promise<PassageSummary[]> {
    try {
      // For larger books, process in smaller batches to avoid timeouts
      if (passages.length > 10) {
        return this.processBatch(passages, 5);
      } else {
        return this.analyzeSingleBatch(passages);
      }
    } catch (error) {
      console.error('Error analyzing passages:', error);
      throw error;
    }
  }
  
  /**
   * Generate concept relationships between passages
   */
  async findConceptRelations(fromPassage: Passage, toPassages: Passage[]) {
    // This will be implemented in the next phase
    // The implementation will:
    // 1. Format the fromPassage and toPassages for comparison
    // 2. Create a prompt that asks the LLM to identify relationships 
    //    (supports, contradicts, extends, analogous)
    // 3. Parse the response and return structured relation data
    
    // Placeholder for future implementation
    return [];
  }
} 