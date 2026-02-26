import React from 'react';
import type { UserProfile, PermissionId } from '../../types';
import { useChatbot } from '../../hooks/useChatbot';
import ChatbotPanel from './ChatbotPanel';

interface ChatbotProps {
  userProfile: UserProfile | null;
  hasPermission: (p: PermissionId) => boolean;
  isOpen: boolean;
  onClose: () => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ userProfile, hasPermission, isOpen, onClose }) => {
  const {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
  } = useChatbot({ userProfile, hasPermission, isOpen });

  if (!userProfile || !hasPermission('chatbot.access') || !isOpen) return null;

  return (
    <ChatbotPanel
      messages={messages}
      isLoading={isLoading}
      isOpen={isOpen}
      onSend={sendMessage}
      onClear={clearHistory}
      onClose={onClose}
    />
  );
};

export default Chatbot;
