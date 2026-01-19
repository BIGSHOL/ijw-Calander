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
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#081429] px-4 py-2.5 flex justify-between items-center text-white shrink-0">
          <h2 className="text-sm font-bold flex items-center gap-1.5">
            <DollarSign size={16} className="text-[#fdb813]" />
            출석부 설정
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
          <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-blue-800">데이터베이스 최적화</h3>
              <p className="text-xs text-blue-600 mt-1">출석부 로딩 속도가 느리다면 최적화를 진행하세요.</p>
            </div>
            <button
              onClick={() => setIsMigrationOpen(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors shadow-sm"
            >
              최적화 도구 열기
            </button>
          </div>
          <SalarySettingsTab teachers={teachers} />
        </div>

        <AttendanceMigrationModal isOpen={isMigrationOpen} onClose={() => setIsMigrationOpen(false)} />
      </div>
    </div>
  );
};

export default AttendanceSettingsModal;
