import React from 'react';

interface TabFilterBarProps {
  children: React.ReactNode;
  align?: 'left' | 'between' | 'right' | 'center';
  wrap?: boolean;
  className?: string;
}

/**
 * TabFilterBar - 탭 내부 필터 영역 래퍼 컴포넌트
 *
 * 디자인 규격 (DESIGN_SYSTEM.md 준수):
 * - 간격: gap-2 (8px)
 * - 반응형: wrap 옵션으로 모바일 대응
 *
 * @example
 * // 좌측 정렬
 * <TabFilterBar align="left">
 *   <SearchBar />
 *   <FilterButtons />
 * </TabFilterBar>
 *
 * @example
 * // 양쪽 배치
 * <TabFilterBar align="between" wrap>
 *   <div className="flex gap-2">
 *     <StatusButtons />
 *     <SearchBar />
 *   </div>
 *   <ActionButtons />
 * </TabFilterBar>
 *
 * @example
 * // 우측 정렬
 * <TabFilterBar align="right">
 *   <ExportButton />
 *   <SettingsButton />
 * </TabFilterBar>
 */
export const TabFilterBar: React.FC<TabFilterBarProps> = ({
  children,
  align = 'left',
  wrap = false,
  className = ''
}) => {
  const alignClasses = {
    left: 'justify-start',
    between: 'justify-between',
    right: 'justify-end',
    center: 'justify-center'
  };

  return (
    <div
      className={`
        flex items-center
        gap-2
        ${alignClasses[align]}
        ${wrap ? 'flex-wrap' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default TabFilterBar;
