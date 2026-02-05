import React, { useState, createContext, useContext, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface TabFilterGroupContextType {
  isAdvancedOpen: boolean;
  setIsAdvancedOpen: (open: boolean) => void;
  activeFilterCount: number;
  setActiveFilterCount: (count: number) => void;
}

const TabFilterGroupContext = createContext<TabFilterGroupContextType | null>(null);

const useTabFilterGroup = () => {
  const context = useContext(TabFilterGroupContext);
  if (!context) {
    throw new Error('TabFilterGroup 컴포넌트 내에서만 사용 가능합니다.');
  }
  return context;
};

interface TabFilterGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * TabFilterGroup - 필터를 Primary/Advanced로 구분하여 표시하는 컴포넌트
 *
 * 사용 예시:
 * <TabFilterGroup>
 *   <TabFilterGroup.Primary>
 *     <SubjectFilter />
 *     <StatusFilter />
 *     <SearchBar />
 *   </TabFilterGroup.Primary>
 *
 *   <TabFilterGroup.Advanced label="고급 필터">
 *     <GradeFilter />
 *     <TeacherFilter />
 *     <SortSelect />
 *   </TabFilterGroup.Advanced>
 * </TabFilterGroup>
 */
export const TabFilterGroup: React.FC<TabFilterGroupProps> & {
  Primary: typeof Primary;
  Advanced: typeof Advanced;
  Badge: typeof Badge;
} = ({ children, className = '' }) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  return (
    <TabFilterGroupContext.Provider
      value={{
        isAdvancedOpen,
        setIsAdvancedOpen,
        activeFilterCount,
        setActiveFilterCount
      }}
    >
      <div className={`flex items-center gap-3 flex-1 ${className}`}>
        {children}
      </div>
    </TabFilterGroupContext.Provider>
  );
};

interface PrimaryProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * TabFilterGroup.Primary - 항상 보이는 주요 필터
 */
const Primary: React.FC<PrimaryProps> = ({ children, className = '' }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {children}
    </div>
  );
};

interface AdvancedProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

/**
 * TabFilterGroup.Advanced - 드롭다운으로 숨겨지는 고급 필터
 */
const Advanced: React.FC<AdvancedProps> = ({
  children,
  label = '고급 필터',
  className = ''
}) => {
  const { isAdvancedOpen, setIsAdvancedOpen, activeFilterCount } = useTabFilterGroup();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Esc 키로 드롭다운 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAdvancedOpen) {
        setIsAdvancedOpen(false);
        buttonRef.current?.focus(); // 포커스를 버튼으로 되돌림
      }
    };

    if (isAdvancedOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isAdvancedOpen, setIsAdvancedOpen]);

  // 드롭다운 열릴 때 첫 번째 포커스 가능한 요소로 포커스 이동
  useEffect(() => {
    if (isAdvancedOpen && panelRef.current) {
      const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        // 닫기 버튼을 제외한 첫 번째 요소로 포커스
        const firstInput = Array.from(focusableElements).find(
          el => !el.getAttribute('aria-label')?.includes('닫기')
        );
        (firstInput || focusableElements[0])?.focus();
      }
    }
  }, [isAdvancedOpen]);

  return (
    <div className="relative">
      {/* 고급 필터 토글 버튼 */}
      <button
        ref={buttonRef}
        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-sm border transition-all
          ${isAdvancedOpen || activeFilterCount > 0
            ? 'bg-accent border-accent text-primary font-bold shadow-sm'
            : 'bg-white/10 border-white/10 text-white hover:border-white/30'
          }
        `}
        aria-expanded={isAdvancedOpen}
        aria-controls="advanced-filters-panel"
        aria-label={`${label} ${activeFilterCount > 0 ? `(${activeFilterCount}개 활성)` : ''}`}
      >
        <span className="text-xs font-bold">{label}</span>
        {activeFilterCount > 0 && (
          <span className={`
            inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full
            text-xxs font-bold
            ${isAdvancedOpen || activeFilterCount > 0
              ? 'bg-primary text-accent'
              : 'bg-accent text-primary'
            }
          `} aria-label={`${activeFilterCount}개 필터 활성`}>
            {activeFilterCount}
          </span>
        )}
        {isAdvancedOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>

      {/* 드롭다운 패널 */}
      {isAdvancedOpen && (
        <>
          {/* 배경 오버레이 (클릭 시 닫힘) */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsAdvancedOpen(false)}
            aria-hidden="true"
          />

          {/* 드롭다운 컨텐츠 */}
          <div
            ref={panelRef}
            id="advanced-filters-panel"
            role="dialog"
            aria-label={label}
            aria-modal="false"
            className={`
              absolute top-full left-0 mt-2
              bg-[#1e293b] border border-white/20 rounded-md shadow-2xl
              p-4 z-50 min-w-[400px]
              ${className}
            `}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-white">{label}</span>
              <button
                onClick={() => setIsAdvancedOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 focus:outline-none focus:ring-2 focus:ring-accent/50 rounded"
                aria-label="고급 필터 닫기"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            {/* 필터 컨텐츠 */}
            <div className="flex flex-col gap-3" role="group" aria-label="고급 필터 옵션">
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface BadgeProps {
  children: React.ReactNode;
  onRemove?: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

/**
 * TabFilterGroup.Badge - 활성 필터를 표시하는 뱃지
 */
const Badge: React.FC<BadgeProps> = ({
  children,
  onRemove,
  variant = 'default'
}) => {
  const variantStyles = {
    default: 'bg-white/10 border-white/20 text-gray-300',
    primary: 'bg-accent/20 border-accent/30 text-accent',
    success: 'bg-green-500/20 border-green-500/30 text-green-400',
    warning: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
    danger: 'bg-red-500/20 border-red-500/30 text-red-400',
  };

  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border text-xs
      ${variantStyles[variant]}
    `}>
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-70 transition-opacity"
          aria-label="필터 제거"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
};

TabFilterGroup.Primary = Primary;
TabFilterGroup.Advanced = Advanced;
TabFilterGroup.Badge = Badge;

export default TabFilterGroup;
