import React from 'react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Pause,
  Eye,
  Edit,
  Shield,
  ShieldAlert,
  LucideIcon,
} from 'lucide-react';

/**
 * Accessible Status Badge Component
 * Addresses Issue #43: Color-only indicators for colorblind accessibility
 *
 * Features:
 * - Combines color, icon, and text label
 * - ARIA label for screen readers
 * - Consistent styling across the app
 * - Supports multiple status types
 */

export type StatusVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'pending'
  | 'active'
  | 'inactive'
  | 'paid'
  | 'unpaid'
  | 'overdue'
  | 'withdrawn'
  | 'on-hold';

export type RoleVariant = 'master' | 'admin' | 'editor' | 'viewer' | 'teacher';

interface BadgeConfig {
  icon: LucideIcon;
  color: string; // Tailwind classes
  ariaLabel: string;
}

const STATUS_CONFIGS: Record<StatusVariant, BadgeConfig> = {
  success: {
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 border-green-300',
    ariaLabel: '성공',
  },
  error: {
    icon: XCircle,
    color: 'bg-red-100 text-red-800 border-red-300',
    ariaLabel: '오류',
  },
  warning: {
    icon: AlertCircle,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ariaLabel: '경고',
  },
  info: {
    icon: AlertCircle,
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    ariaLabel: '정보',
  },
  pending: {
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ariaLabel: '대기 중',
  },
  active: {
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 border-green-300',
    ariaLabel: '활성',
  },
  inactive: {
    icon: Pause,
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    ariaLabel: '비활성',
  },
  paid: {
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 border-green-300',
    ariaLabel: '완납',
  },
  unpaid: {
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ariaLabel: '미납',
  },
  overdue: {
    icon: AlertCircle,
    color: 'bg-red-100 text-red-800 border-red-300',
    ariaLabel: '연체',
  },
  withdrawn: {
    icon: XCircle,
    color: 'bg-red-100 text-red-800 border-red-300',
    ariaLabel: '퇴원',
  },
  'on-hold': {
    icon: Pause,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ariaLabel: '보류',
  },
};

const ROLE_CONFIGS: Record<RoleVariant, BadgeConfig> = {
  master: {
    icon: Shield,
    color: 'bg-red-100 text-red-800 border-red-300',
    ariaLabel: '마스터',
  },
  admin: {
    icon: ShieldAlert,
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    ariaLabel: '관리자',
  },
  editor: {
    icon: Edit,
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    ariaLabel: '편집자',
  },
  viewer: {
    icon: Eye,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ariaLabel: '관찰자',
  },
  teacher: {
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 border-green-300',
    ariaLabel: '선생님',
  },
};

interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

interface RoleBadgeProps {
  role: RoleVariant;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

const ICON_SIZES = {
  sm: 12,
  md: 14,
  lg: 16,
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  size = 'sm',
  showIcon = true,
  className = '',
}) => {
  const config = STATUS_CONFIGS[variant];
  const Icon = config.icon;
  const displayLabel = label || config.ariaLabel;

  return (
    <span
      className={`
        inline-flex items-center gap-1
        rounded-sm border font-semibold
        ${config.color}
        ${SIZE_CLASSES[size]}
        ${className}
      `}
      role="status"
      aria-label={config.ariaLabel}
    >
      {showIcon && <Icon size={ICON_SIZES[size]} aria-hidden="true" />}
      {displayLabel}
    </span>
  );
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  label,
  size = 'sm',
  showIcon = true,
  className = '',
}) => {
  const config = ROLE_CONFIGS[role];
  const Icon = config.icon;
  const displayLabel = label || config.ariaLabel;

  return (
    <span
      className={`
        inline-flex items-center gap-1
        rounded-sm border font-semibold
        ${config.color}
        ${SIZE_CLASSES[size]}
        ${className}
      `}
      role="status"
      aria-label={config.ariaLabel}
    >
      {showIcon && <Icon size={ICON_SIZES[size]} aria-hidden="true" />}
      {displayLabel}
    </span>
  );
};

export default StatusBadge;
