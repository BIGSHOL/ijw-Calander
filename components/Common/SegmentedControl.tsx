import React from 'react';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * SegmentedControl - iOS 스타일의 세그먼트 컨트롤
 *
 * 사용 예시:
 * ```tsx
 * <SegmentedControl
 *   options={[
 *     { value: 'math', label: '수학' },
 *     { value: 'english', label: '영어' }
 *   ]}
 *   value={selectedSubject}
 *   onChange={setSelectedSubject}
 * />
 * ```
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm'
  };

  return (
    <div className={`
      inline-flex
      bg-white/10
      rounded-lg
      p-0.5
      border border-white/10
      shadow-sm
      ${className}
    `}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => !option.disabled && onChange(option.value)}
          disabled={option.disabled}
          className={`
            flex items-center gap-1.5
            ${sizeClasses[size]}
            rounded-md
            font-bold
            transition-all
            ${value === option.value
              ? 'bg-[#fdb813] text-[#081429] shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
            ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {option.icon && <span>{option.icon}</span>}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default SegmentedControl;
