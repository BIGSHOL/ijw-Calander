import React from 'react';
import { X, DollarSign, Settings } from 'lucide-react';
import { Teacher } from '../../types';
import SalarySettingsTab from './components/SalarySettingsTab';

interface AttendanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers?: Teacher[];
  canEdit?: boolean;  // 권한 체크: false이면 읽기 전용
}

const AttendanceSettingsModal: React.FC<AttendanceSettingsModalProps> = ({
  isOpen,
  onClose,
  teachers = [],
  canEdit = true,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-[#081429] flex items-center gap-1.5">
            <DollarSign size={16} className="text-[#fdb813]" />
            급여 설정
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          <SalarySettingsTab teachers={teachers} canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
};

export default AttendanceSettingsModal;
