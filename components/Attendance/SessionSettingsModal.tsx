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
      className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
            <Calendar size={16} className="text-accent" />
            세션 기간 설정
            <span className="ml-2 px-1.5 py-0.5 bg-yellow-500 text-xxs font-bold rounded">관리자</span>
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
          <SessionSettingsTab />
        </div>
      </div>
    </div>
  );
};

export default SessionSettingsModal;
