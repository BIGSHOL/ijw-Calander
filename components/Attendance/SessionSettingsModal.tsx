import React from 'react';
import { X, Calendar } from 'lucide-react';
import SessionSettingsTab from './components/SessionSettingsTab';

interface SessionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SessionSettingsModal: React.FC<SessionSettingsModalProps> = ({
  isOpen,
  onClose,
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
            <Calendar size={16} className="text-[#fdb813]" />
            세션 기간 설정
            <span className="ml-2 px-1.5 py-0.5 bg-yellow-500 text-xxs font-bold rounded">관리자</span>
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
          <SessionSettingsTab />
        </div>
      </div>
    </div>
  );
};

export default SessionSettingsModal;
