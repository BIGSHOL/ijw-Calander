import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface GridDropdownOption<T = string> {
  id: string;
  label: string;
  value: T;
  bgColor?: string;
  textColor?: string;
  disabled?: boolean;
}

interface GridDropdownProps<T = string> {
  options: GridDropdownOption<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  placeholder?: string;
  columns?: 2 | 3 | 4 | 5;
  renderTrigger?: (selected: GridDropdownOption<T> | null, isOpen: boolean) => React.ReactNode;
  className?: string;
}

/**
 * GridDropdown - 그리드 형태의 드롭다운 컴포넌트
 *
 * 디자인 규격 (DESIGN_SYSTEM.md 준수):
 * - 6개 이상: grid 레이아웃
 * - 5개 이하: 수직 리스트
 * - 그리드: grid-cols-3 sm:grid-cols-4 gap-1.5
 * - 아이템: p-1.5 rounded border shadow-sm hover:shadow-md
 * - 텍스트: text-xs block truncate
 *
 * @example
 * // 기본 사용
 * <GridDropdown
 *   options={[
 *     { id: '1', label: '수학', value: 'math' },
 *     { id: '2', label: '영어', value: 'english' }
 *   ]}
 *   selected={selectedSubject}
 *   onSelect={setSelectedSubject}
 *   placeholder="과목 선택"
 *   columns={4}
 * />
 *
 * @example
 * // 색상 있는 옵션
 * <GridDropdown
 *   options={teachers.map(t => ({
 *     id: t.id,
 *     label: t.name,
 *     value: t.id,
 *     bgColor: t.color,
 *     textColor: '#fff'
 *   }))}
 *   selected={selectedTeacher}
 *   onSelect={setTeacher}
 *   columns={3}
 * />
 */
export function GridDropdown<T = string>({
  options,
  selected,
  onSelect,
  placeholder = '선택하세요',
  columns = 4,
  renderTrigger,
  className = ''
}: GridDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === selected) || null;
  const useGridLayout = options.length >= 6;

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (value: T) => {
    onSelect(value);
    setIsOpen(false);
  };

  // 기본 트리거 버튼
  const defaultTrigger = (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={`
        flex items-center justify-between gap-1.5
        px-3 py-1.5
        bg-[#1e293b] border border-gray-700 rounded-lg
        text-xs font-medium text-white
        hover:border-gray-500
        focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813]
        transition-colors
        ${className}
      `}
    >
      <span className="truncate">
        {selectedOption?.label || placeholder}
      </span>
      <ChevronDown
        size={14}
        className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
  );

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger */}
      {renderTrigger ? renderTrigger(selectedOption, isOpen) : defaultTrigger}

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="
            absolute top-full left-0 mt-1 z-50
            bg-white border border-gray-200 rounded-lg shadow-lg
            p-2
            min-w-[200px] max-w-[400px]
            animate-in fade-in duration-200
          "
        >
          {useGridLayout ? (
            /* Grid Layout (6개 이상) */
            <div className={`grid grid-cols-${columns} gap-1.5`}>
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  disabled={option.disabled}
                  className={`
                    relative p-1.5 rounded border
                    ${option.value === selected
                      ? 'border-[#fdb813] shadow-md'
                      : 'border-gray-200 shadow-sm hover:shadow-md'
                    }
                    ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    transition-shadow
                  `}
                  style={
                    option.bgColor && option.textColor
                      ? { backgroundColor: option.bgColor, color: option.textColor }
                      : undefined
                  }
                >
                  <span className="text-xs block truncate">
                    {option.label}
                  </span>
                  {option.value === selected && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#fdb813] rounded-full border border-white" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            /* List Layout (5개 이하) */
            <div className="flex flex-col gap-1">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  disabled={option.disabled}
                  className={`
                    text-left px-3 py-1.5 rounded text-xs font-medium
                    ${option.value === selected
                      ? 'bg-[#081429] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                    ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    transition-colors
                  `}
                  style={
                    option.bgColor && option.textColor && option.value !== selected
                      ? { backgroundColor: option.bgColor, color: option.textColor }
                      : undefined
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GridDropdown;
