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
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-[#081429] mb-4">📝 빠른 작업</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const bgColor = action.color || '#081429';

          return (
            <button
              key={action.id}
              onClick={action.onClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90 hover:shadow-md"
              style={{ backgroundColor: bgColor }}
            >
              <Icon className="w-4 h-4" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActions;
