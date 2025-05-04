/**
 * Types for book processing
 */
export interface Passage {
  id: string;
  text: string;
  start: number;
  end: number;
  bookId: string;
}

export interface Book {
  id: string;
  title: string;
  fileName: string;
  rawContent: string;
  passages: Passage[];
  uploadedAt: Date;
}

/**
 * Generate a unique ID for books and passages
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

/**
 * Extract a title from the file name
 */
export const extractTitleFromFileName = (fileName: string): string => {
  // Remove the .txt extension
  let title = fileName.replace(/\.txt$/, '');
  
  // Replace underscores and hyphens with spaces
  title = title.replace(/[_-]/g, ' ');
  
  // Capitalize words
  title = title.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  return title;
};

/**
 * Split text into passages of reasonable size
 * This is a simple implementation that splits by paragraphs and then
 * combines them to create passages of around 1000-1500 characters
 */
export const splitIntoPassages = (text: string, bookId: string): Passage[] => {
  // First split by paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  
  const passages: Passage[] = [];
  let currentPassage = '';
  let currentStart = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (!paragraph) continue;
    
    // If adding this paragraph would make the passage too long, save the current one
    if (currentPassage.length > 0 && currentPassage.length + paragraph.length > 1500) {
      passages.push({
        id: generateId(),
        text: currentPassage,
        start: currentStart,
        end: currentStart + currentPassage.length,
        bookId
      });
      
      currentPassage = paragraph;
      currentStart = text.indexOf(paragraph);
    } else {
      // Add this paragraph to the current passage
      if (currentPassage.length > 0) {
        currentPassage += '\n\n';
      }
      currentPassage += paragraph;
      
      // Set the start position if this is the first paragraph in the passage
      if (currentPassage.length === paragraph.length) {
        currentStart = text.indexOf(paragraph);
      }
    }
  }
  
  // Add the last passage if there's anything left
  if (currentPassage.length > 0) {
    passages.push({
      id: generateId(),
      text: currentPassage,
      start: currentStart,
      end: currentStart + currentPassage.length,
      bookId
    });
  }
  
  return passages;
};

/**
 * Process a text file into a Book object with passages
 */
export const processTextFile = (text: string, fileName: string): Book => {
  const bookId = generateId();
  const title = extractTitleFromFileName(fileName);
  
  const book: Book = {
    id: bookId,
    title,
    fileName,
    rawContent: text,
    passages: splitIntoPassages(text, bookId),
    uploadedAt: new Date()
  };
  
  return book;
}; 