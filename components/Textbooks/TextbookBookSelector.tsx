import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { TextbookCatalogItem } from '../../data/textbookCatalog';

interface TextbookBookSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (book: TextbookCatalogItem) => void;
  books: TextbookCatalogItem[];
}

type CategoryTab = 'elementary' | 'middle' | 'high';

const TABS: { key: CategoryTab; label: string }[] = [
  { key: 'elementary', label: '초등과정' },
  { key: 'middle', label: '중등과정' },
  { key: 'high', label: '고등과정' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  기본: 'bg-green-50 text-green-700',
  발전: 'bg-blue-50 text-blue-700',
  심화: 'bg-purple-50 text-purple-700',
  최상위: 'bg-red-50 text-red-700',
  개념연산: 'bg-yellow-50 text-yellow-700',
  시그마: 'bg-cyan-50 text-cyan-700',
  '시그마(22개정)': 'bg-cyan-50 text-cyan-700',
  가우스: 'bg-indigo-50 text-indigo-700',
  '가우스(22개정)': 'bg-indigo-50 text-indigo-700',
  다빈치: 'bg-orange-50 text-orange-700',
  오일러: 'bg-teal-50 text-teal-700',
  파스칼: 'bg-rose-50 text-rose-700',
  '중등 오끝': 'bg-slate-100 text-slate-700',
};

function getDifficultyColor(difficulty: string): string {
  return DIFFICULTY_COLORS[difficulty] ?? 'bg-gray-100 text-gray-600';
}

const TextbookBookSelector: React.FC<TextbookBookSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  books,
}) => {
  const [activeTab, setActiveTab] = useState<CategoryTab>('elementary');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBooks = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return books.filter((book) => {
      if (book.category !== activeTab) return false;
      if (!lowerQuery) return true;
      return (
        book.name.toLowerCase().includes(lowerQuery) ||
        book.grade.toLowerCase().includes(lowerQuery) ||
        book.difficulty.toLowerCase().includes(lowerQuery)
      );
    });
  }, [activeTab, searchQuery, books]);

  if (!isOpen) return null;

  const handleSelect = (book: TextbookCatalogItem) => {
    onSelect(book);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="교재 선택"
    >
      <div className="bg-white w-full max-w-2xl rounded-sm shadow-xl flex flex-col max-h-[82vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-900">교재 선택</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs and Search */}
        <div className="px-4 pt-3 pb-2 space-y-3 border-b border-gray-100">
          {/* Category tabs */}
          <div className="flex bg-gray-100 rounded p-0.5 gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery('');
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              size={15}
            />
            <input
              type="text"
              placeholder="교재명, 학년 또는 난이도로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              autoFocus
            />
          </div>
        </div>

        {/* Book list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredBooks.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredBooks.map((book) => (
                <button
                  key={`${book.category}-${book.grade}-${book.name}`}
                  onClick={() => handleSelect(book)}
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-yellow-50 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xxs font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 whitespace-nowrap">
                        {book.grade}
                      </span>
                      <span
                        className={`text-xxs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${getDifficultyColor(book.difficulty)}`}
                      >
                        {book.difficulty}
                      </span>
                    </div>
                    <div className="text-sm text-gray-800 font-medium group-hover:text-gray-900 truncate pr-4">
                      {book.name}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-700 whitespace-nowrap ml-4 shrink-0">
                    {book.price.toLocaleString()}원
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Search size={40} className="mb-2 opacity-20" />
              <p className="text-sm">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>

        {/* Footer count */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            {filteredBooks.length}개 교재
          </p>
        </div>
      </div>
    </div>
  );
};

export default TextbookBookSelector;
