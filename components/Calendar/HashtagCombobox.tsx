import React, { useState, useRef, useEffect } from 'react';
import { Hash, X, Plus, ChevronDown } from 'lucide-react';
import { EventTag } from '../../types';

interface HashtagComboboxProps {
  availableTags: EventTag[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled?: boolean;
  maxTags?: number;
}

interface RecentTag {
  id: string;
  name: string;
  count: number;
  lastUsed: number;
}

const STORAGE_KEY = 'ijw_recent_hashtags';
const MAX_RECENT_TAGS = 20;
const MAX_TAG_LENGTH = 15;

const HashtagCombobox: React.FC<HashtagComboboxProps> = ({
  availableTags,
  selectedTags,
  onTagsChange,
  disabled = false,
  maxTags = 10
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [recentTags, setRecentTags] = useState<RecentTag[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent tags from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentTags(parsed);
      }
    } catch (error) {
      console.error('Failed to load recent tags:', error);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setInputValue('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Save recent tag to localStorage
  const saveRecentTag = (tagId: string, tagName: string) => {
    try {
      let updated = [...recentTags];
      const existingIndex = updated.findIndex(t => t.id === tagId);

      if (existingIndex >= 0) {
        // Update count and lastUsed
        updated[existingIndex].count += 1;
        updated[existingIndex].lastUsed = Date.now();
      } else {
        // Add new recent tag
        updated.push({
          id: tagId,
          name: tagName,
          count: 1,
          lastUsed: Date.now()
        });
      }

      // Sort by lastUsed (most recent first) and limit to MAX_RECENT_TAGS
      updated = updated
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, MAX_RECENT_TAGS);

      setRecentTags(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent tag:', error);
    }
  };

  // Validate tag input
  const validateTag = (tag: string): { valid: boolean; error?: string } => {
    const cleanTag = tag.trim();

    if (cleanTag.length === 0) {
      return { valid: false, error: '태그를 입력하세요' };
    }

    if (cleanTag.length > MAX_TAG_LENGTH) {
      return { valid: false, error: `최대 ${MAX_TAG_LENGTH}자까지 입력 가능합니다` };
    }

    // Allow Korean, English, numbers, spaces
    if (!/^[가-힣a-zA-Z0-9\s]+$/.test(cleanTag)) {
      return { valid: false, error: '한글, 영문, 숫자만 입력 가능합니다' };
    }

    return { valid: true };
  };

  // Add tag
  const addTag = (tagId: string, tagName: string) => {
    if (disabled || selectedTags.length >= maxTags) {
      return;
    }

    // Check if already selected
    if (selectedTags.includes(tagId)) {
      return;
    }

    const newTags = [...selectedTags, tagId];
    onTagsChange(newTags);
    saveRecentTag(tagId, tagName);
    setInputValue('');
    setHighlightedIndex(-1);

    // Keep focus on input for quick multiple tag addition
    inputRef.current?.focus();
  };

  // Remove tag
  const removeTag = (tagId: string) => {
    if (disabled) return;
    const newTags = selectedTags.filter(id => id !== tagId);
    onTagsChange(newTags);
  };

  // Create custom tag
  const createCustomTag = (name: string) => {
    const validation = validateTag(name);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const customId = `custom_${name.trim().toLowerCase().replace(/\s+/g, '_')}`;

    // Check if this custom tag already exists in selected tags
    if (selectedTags.includes(customId)) {
      alert('이미 추가된 태그입니다');
      return;
    }

    addTag(customId, name.trim());
  };

  // Get filtered suggestions
  const getFilteredSuggestions = () => {
    const query = inputValue.toLowerCase().trim();

    if (!query) {
      // Show all available tags + recent tags when input is empty
      const defaultTagIds = availableTags.map(t => t.id);
      const recentUnselected = recentTags.filter(
        rt => !selectedTags.includes(rt.id) && !defaultTagIds.includes(rt.id)
      );

      return {
        defaultTags: availableTags.filter(t => !selectedTags.includes(t.id)),
        recentTags: recentUnselected,
        showCreateOption: false
      };
    }

    // Filter default tags
    const matchedDefaultTags = availableTags.filter(
      t => !selectedTags.includes(t.id) && t.name.toLowerCase().includes(query)
    );

    // Filter recent tags
    const defaultTagIds = availableTags.map(t => t.id);
    const matchedRecentTags = recentTags.filter(
      rt => !selectedTags.includes(rt.id) &&
           !defaultTagIds.includes(rt.id) &&
           rt.name.toLowerCase().includes(query)
    );

    // Check if we should show "create custom" option
    const exactMatch = [...matchedDefaultTags, ...matchedRecentTags].some(
      t => t.name.toLowerCase() === query
    );
    const showCreateOption = !exactMatch && query.length > 0;

    return {
      defaultTags: matchedDefaultTags,
      recentTags: matchedRecentTags,
      showCreateOption
    };
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const { defaultTags, recentTags, showCreateOption } = getFilteredSuggestions();
    const allOptions = [...defaultTags, ...recentTags];
    const totalOptions = allOptions.length + (showCreateOption ? 1 : 0);

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allOptions.length) {
          // Select highlighted option
          const selected = allOptions[highlightedIndex];
          addTag(selected.id, selected.name);
        } else if (highlightedIndex === allOptions.length && showCreateOption) {
          // Create custom tag
          createCustomTag(inputValue.trim());
        } else if (inputValue.trim()) {
          // Create custom tag if no option is highlighted
          createCustomTag(inputValue.trim());
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < totalOptions - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : totalOptions - 1
        );
        break;

      case 'Escape':
        setIsOpen(false);
        setInputValue('');
        setHighlightedIndex(-1);
        break;

      case 'Backspace':
        if (!inputValue && selectedTags.length > 0) {
          // Remove last tag when backspace on empty input
          removeTag(selectedTags[selectedTags.length - 1]);
        }
        break;
    }
  };

  const { defaultTags, recentTags: filteredRecentTags, showCreateOption } = getFilteredSuggestions();

  // Get tag display name
  const getTagDisplayName = (tagId: string): string => {
    const defaultTag = availableTags.find(t => t.id === tagId);
    if (defaultTag) return defaultTag.name;

    const recentTag = recentTags.find(t => t.id === tagId);
    if (recentTag) return recentTag.name;

    // Extract custom tag name from ID
    if (tagId.startsWith('custom_')) {
      return tagId.replace('custom_', '').replace(/_/g, ' ');
    }

    return tagId;
  };

  // Get tag color
  const getTagColor = (tagId: string): string => {
    const defaultTag = availableTags.find(t => t.id === tagId);
    return defaultTag?.color || '#9CA3AF';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Input Area */}
      <div
        className={`
          w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-xl
          focus-within:ring-2 focus-within:ring-[#fdb813] focus-within:border-[#fdb813]
          transition-all cursor-text
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
        `}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Selected Tags */}
          {selectedTags.map(tagId => (
            <span
              key={tagId}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
              style={{
                backgroundColor: `${getTagColor(tagId)}20`,
                color: getTagColor(tagId),
                border: `1px solid ${getTagColor(tagId)}40`
              }}
            >
              <Hash size={12} />
              {getTagDisplayName(tagId)}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tagId);
                  }}
                  className="hover:bg-black/10 rounded p-0.5 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}

          {/* Input */}
          {!disabled && selectedTags.length < maxTags && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setIsOpen(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={selectedTags.length === 0 ? '해시태그 입력 또는 선택...' : ''}
              className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
            />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto">
          {/* Default Tags Section */}
          {defaultTags.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">기본 태그</span>
              </div>
              {defaultTags.map((tag, index) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => addTag(tag.id, tag.name)}
                  className={`
                    w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors
                    flex items-center gap-2
                    ${highlightedIndex === index ? 'bg-blue-50' : ''}
                  `}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm font-medium text-gray-700"># {tag.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recent Tags Section */}
          {filteredRecentTags.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">최근 사용</span>
              </div>
              {filteredRecentTags.map((tag, index) => {
                const adjustedIndex = defaultTags.length + index;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => addTag(tag.id, tag.name)}
                    className={`
                      w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors
                      flex items-center gap-2 justify-between
                      ${highlightedIndex === adjustedIndex ? 'bg-blue-50' : ''}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <Hash size={14} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{tag.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{tag.count}회</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Create Custom Tag Option */}
          {showCreateOption && (
            <div>
              <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">직접 추가</span>
              </div>
              <button
                type="button"
                onClick={() => createCustomTag(inputValue.trim())}
                className={`
                  w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors
                  flex items-center gap-2 text-amber-700
                  ${highlightedIndex === defaultTags.length + filteredRecentTags.length ? 'bg-amber-50' : ''}
                `}
              >
                <Plus size={16} className="text-amber-600" />
                <span className="text-sm font-bold">"{inputValue.trim()}" 태그 추가</span>
              </button>
            </div>
          )}

          {/* Empty State */}
          {defaultTags.length === 0 && filteredRecentTags.length === 0 && !showCreateOption && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      )}

      {/* Helper Text */}
      {selectedTags.length >= maxTags && (
        <p className="text-xs text-red-500 mt-1">
          최대 {maxTags}개까지 선택 가능합니다
        </p>
      )}
    </div>
  );
};

export default HashtagCombobox;
