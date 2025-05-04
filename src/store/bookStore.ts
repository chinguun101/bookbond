import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Book, Passage } from '@/lib/textProcessing';

interface BookState {
  books: Book[];
  addBook: (book: Book) => void;
  removeBook: (bookId: string) => void;
  getBook: (bookId: string) => Book | undefined;
  getPassages: (bookId: string) => Passage[];
  getAllPassages: () => Passage[];
}

export const useBookStore = create<BookState>()(
  persist(
    (set, get) => ({
      books: [],
      
      addBook: (book) => {
        set((state) => {
          // Check if we already have this book
          const existingIndex = state.books.findIndex(b => b.fileName === book.fileName);
          if (existingIndex >= 0) {
            // Replace the existing book
            const updatedBooks = [...state.books];
            updatedBooks[existingIndex] = book;
            return { books: updatedBooks };
          }
          
          // Add the new book
          return { books: [...state.books, book] };
        });
      },
      
      removeBook: (bookId) => {
        set((state) => ({
          books: state.books.filter(book => book.id !== bookId)
        }));
      },
      
      getBook: (bookId) => {
        return get().books.find(book => book.id === bookId);
      },
      
      getPassages: (bookId) => {
        const book = get().books.find(book => book.id === bookId);
        return book ? book.passages : [];
      },
      
      getAllPassages: () => {
        return get().books.flatMap(book => book.passages);
      }
    }),
    {
      name: 'book-storage',
    }
  )
); 