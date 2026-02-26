import React from 'react';
import { Bot, User } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types/chatbot';

/** 간단한 마크다운 → React 변환 (bold, 줄바꿈) */
function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    // **bold** 처리
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    while (remaining) {
      const boldStart = remaining.indexOf('**');
      if (boldStart === -1) {
        parts.push(remaining);
        break;
      }
      const boldEnd = remaining.indexOf('**', boldStart + 2);
      if (boldEnd === -1) {
        parts.push(remaining);
        break;
      }
      if (boldStart > 0) parts.push(remaining.slice(0, boldStart));
      parts.push(<strong key={key++} className="font-semibold">{remaining.slice(boldStart + 2, boldEnd)}</strong>);
      remaining = remaining.slice(boldEnd + 2);
    }
    return (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {parts}
      </React.Fragment>
    );
  });
}

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessageBubble: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-3`}>
      <div className={`
        flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
        ${isUser ? 'bg-[#fdb813]' : message.isError ? 'bg-red-100' : 'bg-blue-50'}
      `}>
        {isUser ? (
          <User size={14} className="text-[#081429]" />
        ) : (
          <Bot size={14} className={message.isError ? 'text-red-500' : 'text-[#081429]'} />
        )}
      </div>

      <div className={`
        max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed
        ${isUser
          ? 'bg-[#fdb813] text-[#081429] rounded-br-none'
          : message.isError
            ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-none'
            : 'bg-gray-100 text-gray-800 rounded-bl-none'
        }
      `}>
        {isUser ? message.content : renderMarkdown(message.content)}
      </div>
    </div>
  );
};

export default ChatMessageBubble;
