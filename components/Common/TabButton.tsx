import React from 'react';

export type TabButtonVariant =
  | 'tab-active'
  | 'tab-inactive'
  | 'tab-toggle'
  | 'tab-filter'
  | 'tab-status-active'
  | 'tab-status-pending'
  | 'tab-status-completed'
  | 'tab-status-cancelled'
  // 라이트 테마용 (수학 시간표 스타일)
  | 'tab-light-active'
  | 'tab-light-inactive'
  | 'tab-light-toggle';

export type TabButtonSize = 'xs' | 'sm';

export interface TabButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TabButtonVariant;
  size?: TabButtonSize;
  active?: boolean;
  theme?: 'dark' | 'light'; // 다크(기본) vs 라이트(수학시간표 스타일)
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children?: React.ReactNode;
  /**
   * ARIA 접근성 속성
   */
  role?: 'tab' | 'button';
  'aria-selected'?: boolean;
  'aria-pressed'?: boolean;
  'aria-label'?: string;
}

/**
 * TabButton - 탭 헤더 전용 버튼 컴포넌트
 *
 * 디자인 규격 (DESIGN_SYSTEM.md 준수):
 * - 텍스트: text-xs font-bold
 * - 패딩: px-3 py-1.5
 * - 모서리: rounded-sm
 * - 간격: gap-1.5 (아이콘과 텍스트)
 *
 * Variants:
 * - tab-active: 활성 탭 (노란색 배경)
 * - tab-inactive: 비활성 탭 (회색 텍스트)
 * - tab-toggle: 토글 버튼 (반투명 배경)
 * - tab-filter: 필터 버튼 (어두운 배경)
 * - tab-status-*: 상태별 색상 버튼
 *
 * @example
 * // 활성/비활성 탭
 * <TabButton variant={isActive ? 'tab-active' : 'tab-inactive'}>
 *   대시보드
 * </TabButton>
 *
 * @example
 * // 아이콘과 함께
 * <TabButton variant="tab-filter" icon={<Search size={14} />}>
 *   검색
 * </TabButton>
 */
export const TabButton = React.forwardRef<HTMLButtonElement, TabButtonProps>(
  (
    {
      variant = 'tab-inactive',
      size = 'xs',
      active,
      theme = 'dark',
      icon,
      iconPosition = 'left',
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // active prop이 있으면 variant 자동 결정 (테마에 따라 다른 스타일)
    const effectiveVariant = active !== undefined
      ? theme === 'light'
        ? (active ? 'tab-light-active' : 'tab-light-inactive')
        : (active ? 'tab-active' : 'tab-inactive')
      : variant;

    const baseStyles = 'inline-flex items-center justify-center font-bold rounded-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles: Record<TabButtonVariant, string> = {
      'tab-active': 'bg-accent text-primary shadow-sm hover:bg-accent/90',
      'tab-inactive': 'text-gray-400 hover:text-white hover:bg-white/10',
      'tab-toggle': 'bg-white/10 border border-white/10 text-white hover:bg-white/20',
      'tab-filter': 'bg-[#1e293b] border border-gray-700 text-white hover:border-gray-500',
      'tab-status-active': 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
      'tab-status-pending': 'bg-yellow-500 text-primary hover:bg-yellow-600 shadow-sm',
      'tab-status-completed': 'bg-green-600 text-white hover:bg-green-700 shadow-sm',
      'tab-status-cancelled': 'bg-gray-500 text-white hover:bg-gray-600 shadow-sm',
      // 라이트 테마용 (수학 시간표 스타일)
      'tab-light-active': 'bg-white text-gray-800 shadow-sm border border-gray-300',
      'tab-light-inactive': 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
      'tab-light-toggle': 'bg-gray-100 border border-gray-300 text-gray-600 hover:bg-gray-200',
    };

    const sizeStyles: Record<TabButtonSize, string> = {
      xs: 'px-3 py-1.5 text-xs gap-1.5',
      sm: 'px-4 py-2 text-sm gap-2',
    };

    const iconSizeClass: Record<TabButtonSize, string> = {
      xs: 'w-3.5 h-3.5',
      sm: 'w-4 h-4',
    };

    const combinedClassName = `
      ${baseStyles}
      ${variantStyles[effectiveVariant]}
      ${sizeStyles[size]}
      ${className}
    `.trim();

    const iconElement = icon ? (
      <span className={iconSizeClass[size]} aria-hidden="true">
        {icon}
      </span>
    ) : null;

    // 접근성 속성 자동 설정
    const accessibilityProps: React.ButtonHTMLAttributes<HTMLButtonElement> = {};

    // role이 명시되지 않은 경우 기본값 설정
    if (!props.role) {
      accessibilityProps.role = 'button';
    }

    // active prop이 있고 role이 tab인 경우 aria-selected 자동 설정
    if (props.role === 'tab' && active !== undefined && !props['aria-selected']) {
      accessibilityProps['aria-selected'] = active;
    }

    // active prop이 있고 토글 버튼인 경우 aria-pressed 자동 설정
    if (variant === 'tab-toggle' && active !== undefined && !props['aria-pressed']) {
      accessibilityProps['aria-pressed'] = active;
    }

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled}
        {...accessibilityProps}
        {...props}
      >
        {iconElement && iconPosition === 'left' && iconElement}
        {children}
        {iconElement && iconPosition === 'right' && iconElement}
      </button>
    );
  }
);

TabButton.displayName = 'TabButton';

export default TabButton;
