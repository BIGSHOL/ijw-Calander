import React, { useState, useRef, useEffect } from 'react';
import { TabGroup, TAB_META, AppTab } from '../../types';
import { ChevronDown } from 'lucide-react';

interface TabGroupDropdownProps {
  group: TabGroup;
  currentTab: AppTab | null;
  accessibleTabs: AppTab[]; // 권한이 있는 탭만
  onTabSelect: (tab: AppTab) => void;
}

const TabGroupDropdown: React.FC<TabGroupDropdownProps> = ({
  group,
  currentTab,
  accessibleTabs,
  onTabSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 이 그룹에서 접근 가능한 탭 필터링
  const visibleTabs = group.tabs.filter(tab => accessibleTabs.includes(tab));

  // 접근 가능한 탭이 없으면 그룹 자체를 숨김
  if (visibleTabs.length === 0) return null;

  // 현재 탭이 이 그룹에 속하는지 확인
  const isActive = currentTab && visibleTabs.includes(currentTab);

  // 외부 클릭 시 드롭다운 닫기
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

  // Escape 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen]);

  // 탭이 1개만 있으면 드롭다운 없이 바로 버튼으로 표시
  if (visibleTabs.length === 1) {
    const singleTab = visibleTabs[0];
    const meta = TAB_META[singleTab];
    const active = currentTab === singleTab;

    return (
      <button
        onClick={() => onTabSelect(singleTab)}
        className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 ${
          active
            ? 'bg-accent text-primary shadow-sm'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
        aria-label={`${meta.label} 탭으로 이동`}
        aria-current={active ? 'page' : undefined}
      >
        {meta.icon} {meta.label}
      </button>
    );
  }

  // 마우스 이벤트 핸들러
  const handleMouseEnter = () => {
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  // 2개 이상이면 드롭다운
  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 ${
          isActive
            ? 'bg-accent text-primary shadow-sm'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`${group.label} 메뉴`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {group.icon} {group.label}
        <ChevronDown
          size={12}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 min-w-[140px] bg-[#1e293b] border border-white/10 rounded-sm shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
          aria-label={`${group.label} 하위 메뉴`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {visibleTabs.map(tab => {
            const meta = TAB_META[tab];
            const active = currentTab === tab;

            return (
              <button
                key={tab}
                onClick={() => {
                  onTabSelect(tab);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-xs font-medium transition-colors flex items-center gap-2 ${
                  active
                    ? 'bg-accent/20 text-accent'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
                role="menuitem"
                aria-label={`${meta.label} 탭으로 이동`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="text-base" aria-hidden="true">{meta.icon}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TabGroupDropdown;
