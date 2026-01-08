import React, { useMemo } from 'react';
import { TAB_GROUPS, AppTab } from '../../types';
import TabGroupDropdown from './TabGroupDropdown';

interface NavigationBarProps {
  currentTab: AppTab | null;
  accessibleTabs: AppTab[];
  onTabSelect: (tab: AppTab) => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({
  currentTab,
  accessibleTabs,
  onTabSelect,
}) => {
  // 그룹을 order 순서대로 정렬
  const sortedGroups = useMemo(() => {
    return [...TAB_GROUPS].sort((a, b) => a.order - b.order);
  }, []);

  // 접근 가능한 그룹만 필터링 (그룹 내 접근 가능한 탭이 1개 이상)
  const visibleGroups = useMemo(() => {
    return sortedGroups.filter(group => {
      const accessibleTabsInGroup = group.tabs.filter(tab =>
        accessibleTabs.includes(tab)
      );
      return accessibleTabsInGroup.length > 0;
    });
  }, [sortedGroups, accessibleTabs]);

  return (
    <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5">
      {visibleGroups.map(group => (
        <TabGroupDropdown
          key={group.id}
          group={group}
          currentTab={currentTab}
          accessibleTabs={accessibleTabs}
          onTabSelect={onTabSelect}
        />
      ))}
    </div>
  );
};

export default NavigationBar;
