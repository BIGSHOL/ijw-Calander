import React from 'react';

interface RadialProgressProps {
  percentage: number;
  color: string;
  trackColor?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  subLabel?: string;
}

/**
 * 원형 진행도 컴포넌트
 * - SVG 기반 구현
 * - 부드러운 애니메이션
 */
const RadialProgress: React.FC<RadialProgressProps> = ({
  percentage,
  color,
  trackColor = "#e2e8f0",
  size = 120,
  strokeWidth = 10,
  label,
  subLabel
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Center Text */}
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-800">{percentage}%</span>
        </div>
      </div>
      {label && <div className="mt-2 text-sm font-medium text-gray-700">{label}</div>}
      {subLabel && <div className="text-xs text-gray-500">{subLabel}</div>}
    </div>
  );
};

export default RadialProgress;
