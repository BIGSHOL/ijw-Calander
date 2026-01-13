import React from 'react';

/**
 * Empty State Component
 * Addresses Issue #29: Empty state illustrations and messages
 * 
 * Provides helpful empty states with icons and CTAs
 */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {icon && (
        <div className="w-16 h-16 mb-4 flex items-center justify-center text-gray-400">
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-gray-500 mb-6 max-w-md">
          {description}
        </p>
      )}
      
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-primary rounded-md font-medium hover:bg-accent-600 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;