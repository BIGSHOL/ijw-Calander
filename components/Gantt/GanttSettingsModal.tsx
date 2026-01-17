import React, { useState } from 'react';
import { X, Building2, Tag } from 'lucide-react';
import { UserProfile } from '../../types';
import DepartmentsTab from '../settings/DepartmentsTab';
import GanttCategoriesTab from '../settings/GanttCategoriesTab';

interface GanttSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
}

type TabType = 'departments' | 'categories';

const GanttSettingsModal: React.FC<GanttSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('departments');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#081429] px-4 py-2.5 flex justify-between items-center text-white shrink-0">
          <h2 className="text-sm font-bold flex items-center gap-1.5">
            <span className="text-[#fdb813]">⚙️</span>
            간트 차트 설정
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-3 shrink-0">
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 font-bold text-xs transition-all border-b-2 ${
              activeTab === 'departments'
                ? 'border-[#fdb813] text-[#081429]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Building2 size={14} />
              간트 부서 관리
            </div>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 font-bold text-xs transition-all border-b-2 ${
              activeTab === 'categories'
                ? 'border-[#fdb813] text-[#081429]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Tag size={14} />
              간트 카테고리 관리
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'departments' && (
            <DepartmentsTab isMaster={currentUser?.role === 'master'} />
          )}
          {activeTab === 'categories' && (
            <GanttCategoriesTab isMaster={currentUser?.role === 'master'} />
          )}
        </div>
      </div>
    </div>
  );
};

export default GanttSettingsModal;
