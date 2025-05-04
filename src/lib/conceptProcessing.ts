import { Passage } from './textProcessing';

/**
 * Types for concept modeling
 */
export interface Concept {
  id: string;
  name: string; 
  description: string;
  passages: string[]; // Array of passage IDs that mention this concept
}

export interface PassageSummary {
  passageId: string;
  bookId: string;
  summary: string;
  concepts: string[]; // Array of concept IDs associated with this passage
  keyPoints: string[];
}

export interface ConceptRelation {
  type: 'supports' | 'contradicts' | 'extends' | 'analogous';
  fromPassageId: string;
  toPassageId: string;
  explanation: string;
}

/**
 * Interface for raw LLM response items
 */
interface LLMResponseItem {
  passageId: string;
  summary: string;
  concepts: string[];
  keyPoints: string[];
  potentialRelations?: string;
  [key: string]: any; // Allow for additional properties
}

/**
 * Formats passages for LLM processing
 */
export function formatPassagesForLLM(passages: Passage[]): string {
  return passages.map(passage => {
    return `PASSAGE ID: ${passage.id}\n\n${passage.text}\n\n---\n\n`;
  }).join('');
}

/**
 * Format a request to the LLM to analyze book passages
 */
export function createPassageAnalysisPrompt(passages: Passage[]): string {
  const formattedPassages = formatPassagesForLLM(passages);
  
  return `You are an expert in textual analysis and concept extraction. I'm going to provide you with passages from a book. For each passage, I need you to:

1. Create a concise summary (1-2 sentences)
2. Extract 3-5 key concepts discussed in the passage
3. Identify 2-3 key points or arguments made
4. Note how each concept might relate to other ideas (for future comparison)

The output should be in JSON format with the following structure for each passage:

{
  "passageId": "the ID provided at the beginning of each passage",
  "summary": "concise summary",
  "concepts": ["concept1", "concept2", "concept3"],
  "keyPoints": ["key point 1", "key point 2"],
  "potentialRelations": "brief notes on how concepts might relate to other ideas"
}

Please respond with an array of these objects, one for each passage.

Here are the passages:

${formattedPassages}`;
}

/**
 * Strip markdown code blocks from LLM response
 */
function stripMarkdownCodeBlocks(text: string): string {
  // Remove markdown code block markers like ```json or ``` at the beginning and end
  return text.replace(/^```(?:json)?\s+/, '')
             .replace(/\s+```$/, '')
             .trim();
}

/**
 * Parses LLM response into structured passage summaries
 */
export function parsePassageSummariesFromLLM(llmResponse: string): PassageSummary[] {
  console.log('===== PARSING LLM RESPONSE =====');
  console.log('Response length:', llmResponse.length, 'characters');
  
  // First, check if the response is wrapped in markdown code blocks
  const markdownMatch = llmResponse.match(/```(?:json)?\s+([\s\S]+?)\s+```/);
  if (markdownMatch) {
    console.log('Detected markdown code blocks in the response');
    // Extract the content inside the code blocks
    llmResponse = markdownMatch[1];
    console.log('Extracted code block content of length:', llmResponse.length);
  } else {
    console.log('No markdown code blocks detected');
  }
  
  try {
    console.log('Attempting to parse response as JSON...');
    // Try to parse the response as JSON
    const parsedData = JSON.parse(llmResponse);
    
    if (Array.isArray(parsedData)) {
      console.log('Success! Response is a valid JSON array with', parsedData.length, 'items');
      
      // Map to our internal structure
      const result = parsedData.map((item: LLMResponseItem) => {
        console.log('Processing item with passageId:', item.passageId);
        console.log('Item has summary:', !!item.summary);
        console.log('Item has concepts:', Array.isArray(item.concepts) ? item.concepts.length : 'not an array');
        console.log('Item has keyPoints:', Array.isArray(item.keyPoints) ? item.keyPoints.length : 'not an array');
        
        return {
          passageId: item.passageId,
          bookId: '', // This will need to be filled in from the original passage data
          summary: item.summary,
          concepts: item.concepts || [], // Ensure concepts is always an array
          keyPoints: item.keyPoints || []
        };
      });
      
      console.log('Successfully mapped', result.length, 'passages');
      return result;
    } else {
      console.warn('Parsed data is not an array, but a', typeof parsedData);
    }
  } catch (error: any) {
    console.error('Failed to parse response as JSON:', error.message);
    
    // Try more aggressive extraction methods
    
    // Method 1: Try to find anything that looks like a JSON array
    const arrayMatch = llmResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      console.log('Found potential JSON array');
      try {
        const extractedJson = arrayMatch[0];
        console.log('Extracted JSON array of length:', extractedJson.length);
        
        const parsedData = JSON.parse(extractedJson);
        console.log('Successfully parsed extracted JSON array');
        
        if (Array.isArray(parsedData)) {
          console.log('Extracted JSON is an array with', parsedData.length, 'items');
          
          const result = parsedData.map((item: LLMResponseItem) => {
            // Log details about each item
            console.log('Extracted item with passageId:', item.passageId);
            
            return {
              passageId: item.passageId,
              bookId: '',
              summary: item.summary,
              concepts: item.concepts || [],
              keyPoints: item.keyPoints || []
            };
          });
          
          console.log('Successfully mapped', result.length, 'passages from extracted JSON');
          return result;
        }
      } catch (e: any) {
        console.error('Failed to parse extracted JSON array:', e.message);
      }
    }
    
    // Method 2: Try a more lenient approach to find individual JSON objects
    console.log('Attempting to extract individual JSON objects...');
    const objectMatches = Array.from(llmResponse.matchAll(/\{\s*"passageId"\s*:\s*"([^"]+)"[\s\S]*?\}/g));
    
    if (objectMatches.length > 0) {
      console.log('Found', objectMatches.length, 'potential JSON objects');
      
      const results: PassageSummary[] = [];
      
      for (const match of objectMatches) {
        try {
          const objectStr = match[0];
          console.log('Processing object:', objectStr.substring(0, 50) + '...');
          
          // Try to parse each object
          const item = JSON.parse(objectStr);
          
          results.push({
            passageId: item.passageId,
            bookId: '',
            summary: item.summary || '',
            concepts: item.concepts || [],
            keyPoints: item.keyPoints || []
          });
          
          console.log('Successfully parsed object for passage:', item.passageId);
        } catch (e: any) {
          console.error('Failed to parse individual object:', e.message);
        }
      }
      
      if (results.length > 0) {
        console.log('Successfully extracted', results.length, 'passages using regex');
        return results;
      }
    }
    
    // If we're still here, show the full response for debugging
    console.log('All parsing methods failed. Full response:');
    console.log(llmResponse);
  }
  
  console.warn('All parsing attempts failed, returning empty array');
  console.log('================================');
  // Return empty array if all parsing attempts fail
  return [];
} 