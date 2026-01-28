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
            <DollarSign size={16} className="text-[#fdb813]" />
            급여 설정
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
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
