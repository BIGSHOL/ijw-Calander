import React from 'react';
import { Check, X, AlertTriangle, Info, Circle } from 'lucide-react';

/**
 * Accessible Badge Component
 * Addresses Issue #43: Color-only indicators
 * 
 * Provides visual indicators beyond just color for accessibility
 */

export type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'primary' | 'secondary';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
  showDefaultIcon?: boolean;
  dot?: boolean;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  icon,
  showDefaultIcon = true,
  dot = false,
  className = '',
}) => {
  // Variant styles with icons for accessibility
  const variantConfig = {
    success: {
      className: 'bg-success-light text-success-dark border-success',
      icon: <Check size={12} />,
      dotColor: 'bg-success',
    },
    error: {
      className: 'bg-error-light text-error-dark border-error',
      icon: <X size={12} />,
      dotColor: 'bg-error',
    },
    warning: {
      className: 'bg-warning-light text-warning-dark border-warning',
      icon: <AlertTriangle size={12} />,
      dotColor: 'bg-warning',
    },
    info: {
      className: 'bg-info-light text-info-dark border-info',
      icon: <Info size={12} />,
      dotColor: 'bg-info',
    },
    neutral: {
      className: 'bg-gray-200 text-gray-800 border-gray-400',
      icon: <Circle size={12} />,
      dotColor: 'bg-gray-600',
    },
    primary: {
      className: 'bg-primary-100 text-primary-800 border-primary-300',
      icon: <Circle size={12} />,
      dotColor: 'bg-primary',
    },
    secondary: {
      className: 'bg-accent-100 text-accent-800 border-accent-300',
      icon: <Circle size={12} />,
      dotColor: 'bg-accent',
    },
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-0.5 text-sm gap-1.5',
    lg: 'px-3 py-1 text-base gap-2',
  };

  const config = variantConfig[variant];
  const displayIcon = icon || (showDefaultIcon ? config.icon : null);

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium border
        ${config.className}
        ${sizeClasses[size]}
        ${className}
      `}
      role="status"
    >
      {dot && (
        <span
          className={`w-2 h-2 rounded-full ${config.dotColor}`}
          aria-hidden="true"
        />
      )}
      {displayIcon && (
        <span aria-hidden="true">
          {displayIcon}
        </span>
      )}
      {children}
    </span>
  );
};

export default Badge;