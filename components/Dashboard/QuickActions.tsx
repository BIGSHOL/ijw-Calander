import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  color?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

/**
 * 빠른 작업 버튼 컴포넌트
 */
const QuickActions: React.FC<QuickActionsProps> = ({ actions }) => {
  if (actions.length === 0) return null;

  return (
    <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-bold text-primary">📝 빠른 작업</h3>
        <div className="flex flex-wrap gap-1.5">
          {actions.map((action) => {
            const Icon = action.icon;
            const bgColor = action.color || '#081429';

            return (
              <button
                key={action.id}
                onClick={action.onClick}
                className="flex items-center gap-1 px-2 py-1 text-xxs font-medium text-white rounded-sm transition-all hover:opacity-90 hover:shadow-sm"
                style={{ backgroundColor: bgColor }}
              >
                <Icon className="w-3 h-3" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
