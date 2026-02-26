import React from 'react';
import type { UserProfile, PermissionId } from '../../types';
import { useChatbot } from '../../hooks/useChatbot';
import ChatbotFAB from './ChatbotFAB';
import ChatbotPanel from './ChatbotPanel';

interface ChatbotProps {
  userProfile: UserProfile | null;
  hasPermission: (p: PermissionId) => boolean;
}

const Chatbot: React.FC<ChatbotProps> = ({ userProfile, hasPermission }) => {
  const {
    messages,
    isLoading,
    isOpen,
    setIsOpen,
    sendMessage,
    clearHistory,
  } = useChatbot({ userProfile, hasPermission });

  if (!userProfile) return null;
  if (!hasPermission('chatbot.access')) return null;

  return (
    <>
      <ChatbotPanel
        messages={messages}
        isLoading={isLoading}
        isOpen={isOpen}
        onSend={sendMessage}
        onClear={clearHistory}
      />
      <ChatbotFAB
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />
    </>
  );
};

export default Chatbot;
