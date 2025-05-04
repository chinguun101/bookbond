import type { Metadata } from 'next';
import AutoComparisonProgress from '../components/AutoComparisonProgress';

export const metadata: Metadata = {
  title: 'AI Reading Companion | Reader',
  description: 'Read and discover connections between books',
};

export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="py-3 px-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <a href="/" className="text-blue-600 font-medium">
          ← Back to Library
        </a>
        <h1 className="text-lg font-medium text-gray-800">AI Reading Companion</h1>
        <div className="w-20"></div>  {/* Spacer for alignment */}
      </header>
      <main className="flex-1">{children}</main>
      <AutoComparisonProgress />
    </div>
  );
} 