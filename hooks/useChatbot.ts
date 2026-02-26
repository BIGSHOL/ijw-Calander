import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types/chatbot';
import type { UserProfile, PermissionId } from '../types';
import { ChatbotService } from '../services/chatbotService';

interface UseChatbotParams {
  userProfile: UserProfile | null;
  hasPermission: (p: PermissionId) => boolean;
  isOpen?: boolean;
}

interface UseChatbotReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
}

let messageIdCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageIdCounter}`;
}

export function useChatbot({ userProfile, isOpen }: UseChatbotParams): UseChatbotReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const serviceRef = useRef<ChatbotService | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isOpen && userProfile && !isInitializedRef.current) {
      serviceRef.current = new ChatbotService(userProfile);
      isInitializedRef.current = true;

      setMessages([{
        id: generateMessageId(),
        role: 'assistant',
        content: `안녕하세요, ${userProfile.displayName || userProfile.name || ''}님! 학원 데이터에 대해 궁금한 점을 질문해주세요.\n\n예시:\n- "김민수 학생 출석률은?"\n- "이번 달 수납률은?"\n- "수학 반 목록 보여줘"`,
        timestamp: Date.now(),
      }]);
    }
  }, [isOpen, userProfile]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !serviceRef.current || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const responseText = await serviceRef.current.processMessage(content.trim());

      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';

      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: `오류가 발생했습니다: ${errorMessage}\n\n다시 시도해주세요.`,
        timestamp: Date.now(),
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    isInitializedRef.current = false;
    serviceRef.current?.resetSession();
    serviceRef.current = null;

    if (isOpen && userProfile) {
      serviceRef.current = new ChatbotService(userProfile);
      isInitializedRef.current = true;

      setMessages([{
        id: generateMessageId(),
        role: 'assistant',
        content: '대화가 초기화되었습니다. 새로운 질문을 해주세요!',
        timestamp: Date.now(),
      }]);
    }
  }, [isOpen, userProfile]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
  };
}
