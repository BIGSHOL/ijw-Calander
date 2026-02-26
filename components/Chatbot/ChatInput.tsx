import React, { useState, useRef, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  return (
    <div className="flex items-end gap-2 p-3 border-t border-gray-200 bg-white">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="질문을 입력하세요..."
        disabled={isLoading}
        rows={1}
        className="
          flex-1 resize-none rounded-lg border border-gray-300
          px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813]
          disabled:opacity-50 disabled:cursor-not-allowed
          max-h-[120px]
        "
      />
      <button
        onClick={handleSend}
        disabled={!input.trim() || isLoading}
        className="
          flex-shrink-0 w-9 h-9 rounded-lg
          bg-[#fdb813] hover:bg-[#e5a611] disabled:bg-gray-200
          flex items-center justify-center
          transition-colors
          disabled:cursor-not-allowed
        "
        aria-label="전송"
      >
        {isLoading ? (
          <Loader2 size={16} className="text-gray-500 animate-spin" />
        ) : (
          <Send size={16} className="text-[#081429]" />
        )}
      </button>
    </div>
  );
};

export default ChatInput;
