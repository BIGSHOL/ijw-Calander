import React from 'react';

interface TabSubNavigationProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * TabSubNavigation - 모든 탭에서 사용하는 공통 서브 네비게이션 컨테이너
 *
 * 디자인 토큰:
 * - 배경: bg-[#081429] (어두운 네이비)
 * - 경계선: border-t border-white/10
 * - 높이: h-10 (40px)
 * - 간격: px-6 (좌우 패딩)
 * - 텍스트: text-xs (작은 텍스트)
 */
export const TabSubNavigation: React.FC<TabSubNavigationProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`
      bg-[#081429]
      border-t border-white/10
      px-6
      h-10
      flex items-center
      gap-3
      text-xs
      shadow-md
      z-20
      ${className}
    `}>
      {children}
    </div>
  );
};

export default TabSubNavigation;
