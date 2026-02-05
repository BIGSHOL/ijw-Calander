import React from 'react';
import { useHeaderCollapse } from '../../contexts/HeaderCollapseContext';

interface TabSubNavigationProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'compact' | 'normal';
  showBorder?: boolean;
  ignoreCollapse?: boolean; // 접기 무시 옵션 (특정 네비게이션에만 적용)
}

/**
 * TabSubNavigation - 모든 탭에서 사용하는 공통 서브 네비게이션 컨테이너
 *
 * 디자인 규격 (DESIGN_SYSTEM.md 준수):
 * - 배경: bg-primary (어두운 네이비)
 * - 경계선: border-t border-white/10 (선택적)
 * - 텍스트: text-xs (12px)
 *
 * Variants:
 * - compact (기본): h-10 px-4 gap-2 - 대부분의 Manager용
 * - normal: h-12 px-6 gap-3 - 메인 헤더용
 *
 * @example
 * // 기본 사용 (compact)
 * <TabSubNavigation>
 *   <FilterButtons />
 *   <SearchBar />
 * </TabSubNavigation>
 *
 * @example
 * // 큰 헤더 (normal)
 * <TabSubNavigation variant="normal">
 *   <MainNavigation />
 * </TabSubNavigation>
 */
export const TabSubNavigation: React.FC<TabSubNavigationProps> = ({
  children,
  className = '',
  variant = 'compact',
  showBorder = true,
  ignoreCollapse = false
}) => {
  const { isHeaderCollapsed } = useHeaderCollapse();

  // 헤더가 접혀있고 ignoreCollapse가 false이면 숨김
  if (isHeaderCollapsed && !ignoreCollapse) {
    return null;
  }

  const variantClasses = {
    compact: 'h-10 px-4 gap-2',
    normal: 'h-12 px-6 gap-3'
  };

  return (
    <nav
      role="navigation"
      aria-label="필터 및 보기 옵션"
      className={`
        bg-primary
        ${showBorder ? 'border-t border-white/10' : ''}
        ${variantClasses[variant]}
        flex items-center
        text-xs
        shadow-md
        z-20
        ${className}
      `}
    >
      {children}
    </nav>
  );
};

export default TabSubNavigation;
