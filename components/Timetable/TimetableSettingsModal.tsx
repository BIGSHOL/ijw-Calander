import React, { useState } from 'react';
import { X, Settings, Users } from 'lucide-react';
import ClassSettingsModal from '../ClassManagement/ClassSettingsModal';
import TeachersTab from '../Settings/TeachersTab';
import { Teacher } from '../../types';

interface TimetableSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  canEdit?: boolean;
  isMaster?: boolean;
  teachers?: Teacher[];
  canViewMath?: boolean;
  canViewEnglish?: boolean;
}

type TabMode = 'general' | 'teachers';

const TimetableSettingsModal: React.FC<TimetableSettingsModalProps> = ({
  isOpen,
  onClose,
  canEdit = true,
  isMaster = false,
  teachers = [],
  canViewMath = true,
  canViewEnglish = true,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('general');

  if (!isOpen) return null;

  // 강사 관리 권한이 없으면 일반 설정만 표시
  const showTeachersTab = isMaster || canEdit;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#081429]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#fdb813] rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#081429]" />
              </div>
              <h2 className="text-lg font-bold text-white">시간표 설정</h2>
            </div>

            {/* Tab Selector */}
            {showTeachersTab && (
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    activeTab === 'general'
                      ? 'bg-[#fdb813] text-[#081429]'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  일반 설정
                </button>
                <button
                  onClick={() => setActiveTab('teachers')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'teachers'
                      ? 'bg-[#fdb813] text-[#081429]'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  강사 관리
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {activeTab === 'general' ? (
            <div className="p-6">
              <ClassSettingsModal
                isOpen={true}
                onClose={() => {}} // 내부 닫기는 무시, 외부에서만 닫기
                canEdit={canEdit}
              />
            </div>
          ) : activeTab === 'teachers' ? (
            <div className="p-6">
              <TeachersTab
                teachers={teachers}
                isMaster={isMaster}
                canEdit={canEdit}
                canViewMath={canViewMath}
                canViewEnglish={canViewEnglish}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TimetableSettingsModal;
