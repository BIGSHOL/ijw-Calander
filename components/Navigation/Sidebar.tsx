import React, { useState } from 'react';
import { TAB_GROUPS, TAB_META, AppTab } from '../../types';
import { ChevronLeft, ChevronRight, ExternalLink, MessageCircle, Mic, Calculator } from 'lucide-react';

interface SidebarProps {
  currentTab: AppTab | null;
  accessibleTabs: AppTab[];
  onTabSelect: (tab: AppTab) => void;
  logoUrl?: string;
  isChatbotOpen?: boolean;
  onChatbotToggle?: () => void;
  hasChatbotAccess?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  accessibleTabs,
  onTabSelect,
  logoUrl,
  isChatbotOpen,
  onChatbotToggle,
  hasChatbotAccess,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sort groups by order
  const sortedGroups = [...TAB_GROUPS].sort((a, b) => a.order - b.order);

  // Filter groups that have at least one accessible tab
  const visibleGroups = sortedGroups.filter(group => {
    const accessibleTabsInGroup = group.tabs.filter(tab =>
      accessibleTabs.includes(tab)
    );
    return accessibleTabsInGroup.length > 0;
  });

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const sidebarContent = (
    <>
      {/* Sidebar Header - 컴팩트 */}
      <div className="bg-primary text-white border-b border-white/10 px-2 py-2 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded object-contain" />
            ) : (
              <div className="w-8 h-8 bg-accent rounded flex items-center justify-center font-bold text-primary text-sm">
                IW
              </div>
            )}
            <div>
              <h1 className="text-xs font-bold leading-tight">Injaewon</h1>
              <p className="text-xxs text-gray-400 leading-tight">Eywa</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="w-full flex justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded object-contain" />
            ) : (
              <div className="w-8 h-8 bg-accent rounded flex items-center justify-center font-bold text-primary text-sm">
                IW
              </div>
            )}
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation Groups - 컴팩트 */}
      <nav
        className="flex-1 overflow-y-auto p-2"
        role="navigation"
        aria-label="주 메뉴 탐색"
      >
        {visibleGroups.map(group => {
          const accessibleTabsInGroup = group.tabs.filter(tab =>
            accessibleTabs.includes(tab)
          );

          return (
            <div key={group.id} className="mb-4">
              {/* Group Title */}
              {!isCollapsed && (
                <div className="px-2 py-1 text-xxs font-bold text-gray-500 uppercase tracking-wider">
                  {group.label}
                </div>
              )}

              {isCollapsed && (
                <div className="w-full h-px bg-gray-200 mb-1" aria-hidden="true" />
              )}

              {/* Group Items */}
              <div className="space-y-0.5">
                {accessibleTabsInGroup.map(tab => {
                  const meta = TAB_META[tab];
                  const isActive = currentTab === tab;

                  // 수강료 계산 탭은 관리 그룹 최상단에서 테두리로 구분
                  const isTuitionCalc = tab === 'tuition-calculator';

                  return (
                    <React.Fragment key={tab}>
                    <button
                      onClick={() => onTabSelect(tab)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-all ${isActive
                        ? 'bg-accent text-primary shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        } ${isCollapsed ? 'justify-center' : ''} ${isTuitionCalc ? 'border border-gray-300 border-dashed' : ''}`}
                      aria-label={`${meta.label} 탭으로 이동`}
                      aria-current={isActive ? 'page' : undefined}
                      title={isCollapsed ? meta.label : undefined}
                    >
                      <span className="text-sm flex-shrink-0" aria-hidden="true">
                        {meta.icon}
                      </span>
                      {!isCollapsed && (
                        <span className="flex items-center gap-1 flex-1">
                          {meta.label}
                          {(tab === 'consultation' || tab === 'student-consultations' || tab === 'meeting-minutes') && (
                            <Mic size={11} className="text-red-400 flex-shrink-0 ml-auto" />
                          )}
                          {(tab === 'tuition-calculator' || tab === 'textbooks') && (
                            <Calculator size={11} className="text-blue-400 flex-shrink-0 ml-auto" />
                          )}
                        </span>
                      )}
                    </button>
                    {isTuitionCalc && !isCollapsed && <div className="w-full h-px bg-gray-300 my-0.5" />}
                    </React.Fragment>
                  );
                })}

                {/* 수업 그룹 하단에 수업보고서 외부 링크 추가 */}
                {group.id === 'class' && (
                  <a
                    href="https://edutrix.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-all text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? '수업보고서' : undefined}
                  >
                    <span className="text-sm flex-shrink-0" aria-hidden="true">📋</span>
                    {!isCollapsed && (
                      <span className="flex items-center gap-1">
                        수업보고서
                        <ExternalLink size={10} className="text-gray-400" />
                      </span>
                    )}
                  </a>
                )}

                {/* 관리 그룹 하단에 세션 계산기 새 창 바로가기 추가 */}
                {group.id === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      window.open(
                        '/tools/session-calculator.html',
                        'sessionCalculator',
                        'width=1100,height=900,scrollbars=yes,resizable=yes,noopener,noreferrer'
                      );
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-all text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? '세션 계산기 (새 창)' : undefined}
                    aria-label="세션 계산기 새 창에서 열기"
                  >
                    <span className="text-sm flex-shrink-0" aria-hidden="true">🧮</span>
                    {!isCollapsed && (
                      <span className="flex items-center gap-1 flex-1">
                        세션 계산기
                        <ExternalLink size={10} className="text-gray-400 ml-auto" />
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* AI Chatbot Button */}
      {hasChatbotAccess && onChatbotToggle && (
        <div className="border-t border-gray-200 p-2">
          <button
            onClick={onChatbotToggle}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-all ${
              isChatbotOpen
                ? 'bg-accent text-primary shadow-sm'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? 'AI 챗봇' : undefined}
          >
            <span className="text-sm flex-shrink-0">🤖</span>
            {!isCollapsed && <span>AI 챗봇</span>}
          </button>
        </div>
      )}

      {/* Sidebar Footer - Optional */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 p-2">
          <p className="text-xxs text-gray-400 text-center">
            © 2026 Injaewon Eywa
          </p>
        </div>
      )}
    </>
  );

  return (
    <aside
      className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 sticky top-0 h-screen flex-shrink-0 ${isCollapsed ? 'w-[56px]' : 'w-[160px]'
        }`}
      aria-label="사이드바 메뉴"
    >
      {sidebarContent}
    </aside>
  );
};

export default Sidebar;