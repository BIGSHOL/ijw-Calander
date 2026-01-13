import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, Users, BookOpen, Building, X } from 'lucide-react';
import Modal from './Modal';

/**
 * Global Search Component
 * Addresses Issue #10: Global search functionality
 * 
 * Features:
 * - Cmd/Ctrl+K keyboard shortcut
 * - Search across students, events, classes
 * - Keyboard navigation
 * - Categories with icons
 */

export interface SearchResult {
  id: string;
  type: 'student' | 'event' | 'class' | 'teacher';
  title: string;
  subtitle?: string;
  metadata?: string;
}

export interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  onSelect: (result: SearchResult) => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  onClose,
  onSearch,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const searchResults = await onSearch(query);
        setResults(searchResults);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            onSelect(results[selectedIndex]);
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onSelect, onClose]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      student: [],
      event: [],
      class: [],
      teacher: [],
    };

    results.forEach((result) => {
      groups[result.type].push(result);
    });

    return groups;
  }, [results]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'student':
        return <Users size={16} className="text-blue-500" />;
      case 'event':
        return <Calendar size={16} className="text-green-500" />;
      case 'class':
        return <BookOpen size={16} className="text-purple-500" />;
      case 'teacher':
        return <Building size={16} className="text-orange-500" />;
      default:
        return <Search size={16} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'student':
        return '학생';
      case 'event':
        return '일정';
      case 'class':
        return '수업';
      case 'teacher':
        return '강사';
      default:
        return '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      showCloseButton={false}
      className="!p-0"
    >
      <div className="flex flex-col max-h-[600px]">
        {/* Search Input */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="학생, 일정, 수업 검색... (Cmd+K)"
              className="w-full pl-10 pr-10 py-3 text-base border-0 focus:ring-0 focus:outline-none"
              autoFocus
              aria-label="전역 검색"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="검색어 지우기"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="text-center py-8 text-gray-500">
              검색 중...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              검색 결과가 없습니다
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-4">
              {Object.entries(groupedResults).map(
                ([type, items]) =>
                  items.length > 0 && (
                    <div key={type}>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                        {getTypeLabel(type)}
                      </div>
                      <div className="space-y-1">
                        {items.map((result, index) => {
                          const globalIndex = results.indexOf(result);
                          const isSelected = globalIndex === selectedIndex;

                          return (
                            <button
                              key={result.id}
                              onClick={() => {
                                onSelect(result);
                                onClose();
                              }}
                              className={`
                                w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors
                                ${
                                  isSelected
                                    ? 'bg-accent text-primary'
                                    : 'hover:bg-gray-100'
                                }
                              `}
                            >
                              {getIcon(result.type)}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {result.title}
                                </div>
                                {result.subtitle && (
                                  <div className="text-sm text-gray-500 truncate">
                                    {result.subtitle}
                                  </div>
                                )}
                              </div>
                              {result.metadata && (
                                <div className="text-xs text-gray-400">
                                  {result.metadata}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span>↑↓ 이동</span>
          <span>Enter 선택</span>
          <span>Esc 닫기</span>
        </div>
      </div>
    </Modal>
  );
};

export default GlobalSearch;