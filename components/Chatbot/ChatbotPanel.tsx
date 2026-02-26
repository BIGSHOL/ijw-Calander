import React, { useEffect, useRef } from 'react';
import { Trash2, Bot, X } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types/chatbot';
import ChatMessageBubble from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatbotPanelProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  isOpen: boolean;
  onSend: (message: string) => void;
  onClear: () => void;
  onClose: () => void;
}

const ChatbotPanel: React.FC<ChatbotPanelProps> = ({
  messages,
  isLoading,
  isOpen,
  onSend,
  onClear,
  onClose,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="
      fixed bottom-6 right-6 z-[90]
      w-[360px] max-w-[calc(100vw-3rem)]
      h-[500px] max-h-[calc(100vh-8rem)]
      bg-white rounded-lg shadow-2xl
      flex flex-col overflow-hidden
      border border-gray-200
    ">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#081429] text-white">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-[#fdb813]" />
          <span className="text-sm font-bold">AI 어시스턴트</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClear}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="대화 내역 초기화"
            title="대화 내역 초기화"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="챗봇 닫기"
            title="닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <div className="w-10 h-10 rounded-full bg-[#081429]/5 flex items-center justify-center mb-3">
              <Bot size={20} className="text-[#081429]" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-3">무엇을 도와드릴까요?</p>
            <div className="w-full text-left space-y-1.5 text-xs text-gray-500">
              <p className="font-medium text-gray-600 mb-1">이런 질문을 해보세요:</p>
              <p>👩‍🎓 "재원생 몇 명이야?" · "고등학생 목록"</p>
              <p>📚 "영어 수강생 누구야?" · "김민수 수강 과목"</p>
              <p>✅ "김민수 출석률" · "이번 달 결석 현황"</p>
              <p>📝 "다음 시험 언제?" · "숙제 현황"</p>
              <p>💰 "이번 달 수납률" · "미납 학생"</p>
              <p>👨‍🏫 "수학 선생님 목록" · "김선생님 담당 반"</p>
              <p>📊 "이번 달 신규/퇴원 통계" · "상담 내역"</p>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex gap-2 mb-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
              <Bot size={14} className="text-[#081429]" />
            </div>
            <div className="bg-gray-100 rounded-lg px-3 py-2 rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={onSend} isLoading={isLoading} />
    </div>
  );
};

export default ChatbotPanel;
