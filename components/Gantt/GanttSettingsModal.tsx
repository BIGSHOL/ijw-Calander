import React, { useState } from 'react';
import { X, Building2, Tag } from 'lucide-react';
import { UserProfile } from '../../types';
import DepartmentsTab from '../Settings/DepartmentsTab';
import GanttCategoriesTab from '../Settings/GanttCategoriesTab';

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
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
            <span className="text-accent">⚙️</span>
            간트 차트 설정
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
                ? 'border-accent text-primary'
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
                ? 'border-accent text-primary'
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
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <Building2 className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">부서 관리</h3>
              </div>
              <div className="p-2">
                <DepartmentsTab isMaster={currentUser?.role === 'master'} />
              </div>
            </div>
          )}
          {activeTab === 'categories' && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <Tag className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">카테고리 관리</h3>
              </div>
              <div className="p-2">
                <GanttCategoriesTab isMaster={currentUser?.role === 'master'} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GanttSettingsModal;
