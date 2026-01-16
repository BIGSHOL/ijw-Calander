import React from 'react';
import { X, DollarSign } from 'lucide-react';
import { Teacher } from '../../types';
import SalarySettingsTab from './components/SalarySettingsTab';

interface AttendanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers?: Teacher[];
}

const AttendanceSettingsModal: React.FC<AttendanceSettingsModalProps> = ({
  isOpen,
  onClose,
  teachers = [],
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#081429] p-5 flex justify-between items-center text-white shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign size={24} className="text-[#fdb813]" />
            출석부 설정
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <SalarySettingsTab teachers={teachers} />
        </div>
      </div>
    </div>
  );
};

export default AttendanceSettingsModal;
