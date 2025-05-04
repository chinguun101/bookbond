# AI Reading Companion

An AI-powered application for analyzing and comparing books.

## Features

- **Upload Books**: Upload .txt files and automatically split them into passages
- **Analyze with AI**: Process book passages with LLM to extract summaries, key concepts, and points
- **Compare Books**: Find relationships between passages from different books

## Book Comparison

The new book comparison feature allows you to:

1. Select a source book and specific passage
2. Select a target book to compare with
3. Find passages in the target book that relate to your selected passage
4. Analyze relationships (supports, contradicts, extends, analogous) between passages

### How it works

1. **Embedding Generation**: Each book is processed to generate embeddings for passages
2. **Semantic Search**: Finds similar passages across books based on embeddings
3. **LLM Analysis**: Analyzes the specific relationships between passages
4. **Visualization**: Results are displayed with relevant passages and relationship types

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env.local` file with your API keys:
   ```
   NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
   NEXT_PUBLIC_LLAMA_API_KEY=LLM|24233636562905000|uj_EryBhhQK5JGIkJYaXt0_T2eY
   ```
4. Run the development server:
   ```
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Upload a Book**: Go to the "Upload & Manage Books" tab and upload .txt files
2. **Analyze a Book**: Go to the "Analyze with AI" tab to process books with AI
3. **Compare Books**: Go to the "Compare Books" tab to find relationships between books

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
