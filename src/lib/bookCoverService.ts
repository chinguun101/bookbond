// Types for better type safety
interface CacheEntry {
  url: string | null;
  timestamp: number;
}

interface OpenLibraryResponse {
  docs?: {
    cover_i?: number;
    title?: string;
  }[];
}

interface GoogleBooksResponse {
  items?: {
    volumeInfo?: {
      imageLinks?: {
        thumbnail?: string;
      };
    };
  }[];
}

// Cache implementation
const coverCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Try Open Library API
async function tryOpenLibrary(bookTitle: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(bookTitle);
    const searchUrl = `https://openlibrary.org/search.json?q=${query}&limit=1`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) return null;
    
    const data: OpenLibraryResponse = await response.json();
    
    if (data.docs && data.docs.length > 0) {
      const book = data.docs[0];
      if (book.cover_i) {
        return `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`;
      }
    }
    return null;
  } catch (error) {
    console.error('Open Library API error:', error);
    return null;
  }
}

// Try Google Books API
async function tryGoogleBooks(bookTitle: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(bookTitle);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data: GoogleBooksResponse = await response.json();
    
    if (data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail) {
      return data.items[0].volumeInfo.imageLinks.thumbnail
        .replace('http://', 'https://')
        .replace('zoom=1', 'zoom=3');
    }
    return null;
  } catch (error) {
    console.error('Google Books API error:', error);
    return null;
  }
}

export async function getBookCoverUrl(bookTitle: string): Promise<string | null> {
  // Normalize book title for caching
  const normalizedTitle = bookTitle.trim().toLowerCase();
  
  // Check cache first
  const cached = coverCache.get(normalizedTitle);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.url;
  }
  
  // Try Open Library first
  const openLibraryCover = await tryOpenLibrary(normalizedTitle);
  if (openLibraryCover) {
    coverCache.set(normalizedTitle, {
      url: openLibraryCover,
      timestamp: Date.now()
    });
    return openLibraryCover;
  }
  
  // Try Google Books as fallback
  const googleBooksCover = await tryGoogleBooks(normalizedTitle);
  coverCache.set(normalizedTitle, {
    url: googleBooksCover,
    timestamp: Date.now()
  });
  
  return googleBooksCover;
} 