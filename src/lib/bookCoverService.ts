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

// Cache implementation - using both memory and localStorage
const coverCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days cache duration
const CACHE_KEY_PREFIX = 'book_cover_cache_';

// Initialize cache from localStorage
function initCacheFromStorage() {
  try {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const now = Date.now();
      
      // Find all localStorage keys that match our prefix
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          const bookTitle = key.substring(CACHE_KEY_PREFIX.length);
          const storedItem = localStorage.getItem(key);
          
          if (storedItem) {
            try {
              const cacheEntry: CacheEntry = JSON.parse(storedItem);
              
              // Only restore if cache hasn't expired
              if (cacheEntry && now - cacheEntry.timestamp < CACHE_DURATION) {
                coverCache.set(bookTitle, cacheEntry);
              } else {
                // Clean up expired items
                localStorage.removeItem(key);
              }
            } catch (e) {
              console.warn('Failed to parse cached cover data', e);
              localStorage.removeItem(key);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error initializing cover cache from localStorage:', error);
  }
}

// Initialize cache on module load
initCacheFromStorage();

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

// Helper function to save cache entry to localStorage
function saveCacheToStorage(key: string, entry: CacheEntry) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
    }
  } catch (error) {
    console.warn('Error saving cover to localStorage:', error);
  }
}

export async function getBookCoverUrl(bookTitle: string): Promise<string | null> {
  // Normalize book title for caching
  const normalizedTitle = bookTitle.trim().toLowerCase();
  
  // Check memory cache first
  const cached = coverCache.get(normalizedTitle);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.url;
  }
  
  // Check localStorage as fallback
  if (typeof window !== 'undefined') {
    try {
      const storedItem = localStorage.getItem(CACHE_KEY_PREFIX + normalizedTitle);
      if (storedItem) {
        const cacheEntry: CacheEntry = JSON.parse(storedItem);
        if (Date.now() - cacheEntry.timestamp < CACHE_DURATION) {
          // Also update memory cache
          coverCache.set(normalizedTitle, cacheEntry);
          return cacheEntry.url;
        }
      }
    } catch (error) {
      console.warn('Error reading from localStorage:', error);
    }
  }
  
  // Try Open Library first
  const openLibraryCover = await tryOpenLibrary(normalizedTitle);
  if (openLibraryCover) {
    const cacheEntry = {
      url: openLibraryCover,
      timestamp: Date.now()
    };
    coverCache.set(normalizedTitle, cacheEntry);
    saveCacheToStorage(normalizedTitle, cacheEntry);
    return openLibraryCover;
  }
  
  // Try Google Books as fallback
  const googleBooksCover = await tryGoogleBooks(normalizedTitle);
  const cacheEntry = {
    url: googleBooksCover,
    timestamp: Date.now()
  };
  coverCache.set(normalizedTitle, cacheEntry);
  saveCacheToStorage(normalizedTitle, cacheEntry);
  
  return googleBooksCover;
} 