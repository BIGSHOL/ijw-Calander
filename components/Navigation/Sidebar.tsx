import React, { useState, useEffect } from 'react';
import { TAB_GROUPS, TAB_META, AppTab } from '../../types';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';

interface SidebarProps {
  currentTab: AppTab | null;
  accessibleTabs: AppTab[];
  onTabSelect: (tab: AppTab) => void;
  logoUrl?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  accessibleTabs,
  onTabSelect,
  logoUrl,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  }, [currentTab, isMobile]);

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
    if (!isMobile) {
      setIsCollapsed(!isCollapsed);
    }
  };

  const toggleMobileMenu = () => {
    if (isMobile) {
      setIsMobileOpen(!isMobileOpen);
    }
  };

  // Mobile hamburger button
  const MobileMenuButton = () => (
    <button
      onClick={toggleMobileMenu}
      className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#081429] text-white rounded-lg shadow-lg border border-white/10 hover:bg-[#0a1633] transition-colors"
      aria-label={isMobileOpen ? '메뉴 닫기' : '메뉴 열기'}
    >
      {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
  );

  const sidebarContent = (
    <>
      {/* Sidebar Header */}
      <div className="bg-[#081429] text-white border-b border-white/10 p-4 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-md object-contain" />
            ) : (
              <div className="w-10 h-10 bg-[#fdb813] rounded-md flex items-center justify-center font-bold text-[#081429] text-xl">
                IW
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold">InjaeWon</h1>
              <p className="text-xs text-gray-400">Calendar</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="w-full flex justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-md object-contain" />
            ) : (
              <div className="w-10 h-10 bg-[#fdb813] rounded-md flex items-center justify-center font-bold text-[#081429] text-xl">
                IW
              </div>
            )}
          </div>
        )}
        {!isMobile && (
          <button
            onClick={toggleCollapse}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav
        className="flex-1 overflow-y-auto p-3"
        role="navigation"
        aria-label="주 메뉴 탐색"
      >
        {visibleGroups.map(group => {
          const accessibleTabsInGroup = group.tabs.filter(tab =>
            accessibleTabs.includes(tab)
          );

          return (
            <div key={group.id} className="mb-6">
              {/* Group Title */}
              {!isCollapsed && (
                <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {group.label}
                </div>
              )}

              {isCollapsed && (
                <div className="w-full h-px bg-gray-200 mb-2" aria-hidden="true" />
              )}

              {/* Group Items */}
              <div className="space-y-1">
                {accessibleTabsInGroup.map(tab => {
                  const meta = TAB_META[tab];
                  const isActive = currentTab === tab;

                  return (
                    <button
                      key={tab}
                      onClick={() => onTabSelect(tab)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                          ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        } ${isCollapsed ? 'justify-center' : ''}`}
                      aria-label={`${meta.label} 탭으로 이동`}
                      aria-current={isActive ? 'page' : undefined}
                      title={isCollapsed ? meta.label : undefined}
                    >
                      <span className="text-lg flex-shrink-0" aria-hidden="true">
                        {meta.icon}
                      </span>
                      {!isCollapsed && <span>{meta.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer - Optional */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 p-4">
          <p className="text-xs text-gray-500 text-center">
            © 2026 InjaeWon
          </p>
        </div>
      )}
    </>
  );

  return (
    <>
      <MobileMenuButton />

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 sticky top-0 h-screen ${isCollapsed ? 'w-[72px]' : 'w-[280px]'
          }`}
        aria-label="사이드바 메뉴"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobile && isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`md:hidden fixed left-0 top-0 bottom-0 w-[280px] bg-white z-40 flex flex-col transform transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        aria-label="모바일 사이드바 메뉴"
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;