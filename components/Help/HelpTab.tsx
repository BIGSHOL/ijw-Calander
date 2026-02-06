import React, { useState, useMemo, useRef } from 'react';
import { Search, Printer, ChevronRight, ChevronDown, BookOpen, X } from 'lucide-react';
import { TAB_GROUPS, UserProfile } from '../../types';
import { useTabPermissions } from '../../hooks/useTabPermissions';
import { usePermissions } from '../../hooks/usePermissions';
import { HELP_ENTRIES, searchHelp, HelpEntry, HelpSubSection } from './helpContent';

interface HelpTabProps {
  currentUser?: UserProfile | null;
}

const HelpTab: React.FC<HelpTabProps> = ({ currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);

  // 사용자 탭 권한에 따른 도움말 필터링
  const { accessibleTabs } = useTabPermissions(currentUser || null);
  const { hasPermission } = usePermissions(currentUser || null);

  // 세부 권한 기반 섹션 필터링
  const filterSections = (sections: HelpSubSection[]): HelpSubSection[] => {
    return sections.filter(section => {
      if (!section.requiredPermissions || section.requiredPermissions.length === 0) return true;
      return section.requiredPermissions.some(p => hasPermission(p));
    });
  };

  // 접근 가능한 탭의 도움말만 필터링
  const accessibleEntries = useMemo(() => {
    return HELP_ENTRIES.filter(entry => {
      if (entry.tab === 'overview') return true; // 시스템 개요는 항상 표시
      return accessibleTabs.includes(entry.tab as any);
    });
  }, [accessibleTabs]);

  const filtered = useMemo(() => searchHelp(accessibleEntries, searchQuery), [accessibleEntries, searchQuery]);
  const selectedEntry = filtered[selectedIndex] || filtered[0];

  const handleSelect = (idx: number) => {
    setSelectedIndex(idx);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  // 그룹별로 항목 묶기
  const groupedEntries = useMemo(() => {
    const groups: { label: string; icon: string; entries: { entry: HelpEntry; globalIndex: number }[] }[] = [];
    let currentGroup: typeof groups[0] | null = null;

    filtered.forEach((entry, idx) => {
      if (entry.tab === 'overview') {
        groups.push({ label: '개요', icon: '📖', entries: [{ entry, globalIndex: idx }] });
        return;
      }

      const tabGroup = TAB_GROUPS.find((g) => g.tabs.includes(entry.tab as any));
      const groupLabel = tabGroup?.label || entry.group || '기타';
      const groupIcon = tabGroup?.icon || '📁';

      if (!currentGroup || currentGroup.label !== groupLabel) {
        currentGroup = { label: groupLabel, icon: groupIcon, entries: [] };
        groups.push(currentGroup);
      }
      currentGroup.entries.push({ entry, globalIndex: idx });
    });

    return groups;
  }, [filtered]);

  return (
    <div className="flex h-full bg-white print:block">
      {/* 좌측 사이드바 */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50 print:hidden">
        {/* 검색 */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="기능 검색..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedIndex(0); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 목차 */}
        <nav className="flex-1 overflow-y-auto py-2">
          {groupedEntries.map((group) => {
            const isCollapsed = collapsedGroups.has(group.label);
            const hasSelectedEntry = group.entries.some(({ entry }) => selectedEntry?.tab === entry.tab);

            return (
              <div key={group.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-gray-200 rounded-sm ${
                    hasSelectedEntry && isCollapsed ? 'text-blue-600' : 'text-gray-500'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {group.icon} {group.label}
                    <span className="text-gray-400 font-normal normal-case tracking-normal">({group.entries.length})</span>
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </button>
                {!isCollapsed && group.entries.map(({ entry, globalIndex }) => (
                  <button
                    key={entry.tab}
                    onClick={() => handleSelect(globalIndex)}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                      selectedEntry?.tab === entry.tab
                        ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base leading-none">{entry.icon}</span>
                    <span className="truncate">{entry.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              검색 결과가 없습니다.
            </div>
          )}
        </nav>
      </aside>

      {/* 우측 콘텐츠 */}
      <main ref={contentRef} className="flex-1 overflow-y-auto print:overflow-visible">
        {/* 인쇄 시 제목 */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-2xl font-bold">인재원 학원 관리 시스템 사용설명서</h1>
          <p className="text-sm text-gray-500 mt-1">인쇄일: {new Date().toLocaleDateString('ko-KR')}</p>
        </div>

        {selectedEntry ? (
          <div className="max-w-3xl mx-auto px-6 py-6 print:max-w-none print:px-0">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6 print:mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedEntry.icon}</span>
                <div>
                  {selectedEntry.group && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                      <span>{selectedEntry.group}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-gray-900">{selectedEntry.title}</h2>
                </div>
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors print:hidden"
                title="인쇄 / PDF 저장"
              >
                <Printer className="w-4 h-4" />
                <span>인쇄</span>
              </button>
            </div>

            {/* 개요 */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 print:bg-white print:border-gray-300">
              <p className="text-sm text-blue-800 print:text-gray-700">{selectedEntry.overview}</p>
            </div>

            {/* 섹션들 (권한 기반 필터링) */}
            {filterSections(selectedEntry.sections).map((section, sIdx) => (
              <div key={sIdx} className="mb-6 print:mb-4">
                <h3 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  {section.title}
                </h3>
                <ul className="space-y-1.5 ml-4">
                  {section.items.map((item, iIdx) => {
                    const dashIdx = item.indexOf(' — ');
                    if (dashIdx > 0) {
                      const label = item.substring(0, dashIdx);
                      const desc = item.substring(dashIdx + 3);
                      return (
                        <li key={iIdx} className="text-sm text-gray-700">
                          <span className="font-medium text-gray-900">{label}</span>
                          <span className="text-gray-400 mx-1">—</span>
                          <span>{desc}</span>
                        </li>
                      );
                    }
                    return (
                      <li key={iIdx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-gray-300 mt-1.5 flex-shrink-0">&#8226;</span>
                        <span>{item}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {/* 전체 인쇄 모드: 접근 가능한 항목만 출력 */}
            <div className="hidden print:block">
              {accessibleEntries.filter((e) => e.tab !== selectedEntry.tab).map((entry) => (
                <div key={entry.tab} className="mt-8 break-before-page">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{entry.icon}</span>
                    <div>
                      {entry.group && (
                        <div className="text-xs text-gray-400 mb-0.5">{entry.group}</div>
                      )}
                      <h2 className="text-lg font-bold text-gray-900">{entry.title}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{entry.overview}</p>
                  {filterSections(entry.sections).map((section, sIdx) => (
                    <div key={sIdx} className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-1">{section.title}</h3>
                      <ul className="space-y-1 ml-4">
                        {section.items.map((item, iIdx) => (
                          <li key={iIdx} className="text-sm text-gray-700">&#8226; {item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">좌측 목차에서 항목을 선택하세요.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HelpTab;
