import React from 'react';
import { MessageCircle, X } from 'lucide-react';

interface ChatbotFABProps {
  isOpen: boolean;
  onClick: () => void;
}

const ChatbotFAB: React.FC<ChatbotFABProps> = ({ isOpen, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-20 right-6 z-[90]
        w-14 h-14 rounded-full shadow-lg
        flex items-center justify-center
        transition-all duration-300 ease-in-out
        ${isOpen
          ? 'bg-gray-600 hover:bg-gray-700'
          : 'bg-[#fdb813] hover:bg-[#e5a611]'
        }
        focus:outline-none focus:ring-2 focus:ring-[#fdb813] focus:ring-offset-2
      `}
      aria-label={isOpen ? 'AI 어시스턴트 닫기' : 'AI 어시스턴트 열기'}
    >
      {isOpen ? (
        <X size={24} className="text-white" />
      ) : (
        <MessageCircle size={24} className="text-[#081429]" />
      )}
    </button>
  );
};

export default ChatbotFAB;
