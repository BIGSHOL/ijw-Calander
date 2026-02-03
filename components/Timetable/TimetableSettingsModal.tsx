import React from 'react';
import { X, Settings } from 'lucide-react';
import ClassSettingsModal from '../ClassManagement/ClassSettingsModal';
import { UserProfile } from '../../types';
// TeachersTab 제거됨 - 강사 관리는 시스템 관리의 사용자 관리(staff 컬렉션)에서 통합 관리

interface TimetableSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  canEdit?: boolean;
  currentUser: UserProfile | null;
}

const TimetableSettingsModal: React.FC<TimetableSettingsModalProps> = ({
  isOpen,
  onClose,
  canEdit = true,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-[#081429] flex items-center gap-1.5">
            <Settings size={16} />
            수업 설정
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content - 수업 설정만 표시 */}
        <div className="flex-1 overflow-y-auto p-3">
          <ClassSettingsModal
            isOpen={true}
            onClose={() => {}}
            canEdit={canEdit}
            embedded={true}
          />
        </div>
      </div>
    </div>
  );
};

export default TimetableSettingsModal;
