import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import type { ChatMessage } from '../types/chatbot';
import type { UserProfile } from '../types';

const functions = getFunctions(getApp(), 'asia-northeast3');
const chatWithAI = httpsCallable<
  { message: string; history: { role: string; content: string }[]; userName: string; userRole: string },
  { response: string }
>(functions, 'chatWithAI');

export class ChatbotService {
  private userName: string;
  private userRole: string;
  private history: { role: string; content: string }[] = [];

  constructor(userProfile: UserProfile) {
    this.userName = userProfile.displayName || userProfile.name || '사용자';
    this.userRole = userProfile.role;
  }

  async processMessage(userMessage: string): Promise<string> {
    try {
      const result = await chatWithAI({
        message: userMessage,
        history: this.history,
        userName: this.userName,
        userRole: this.userRole,
      });

      // Update history for multi-turn conversation
      this.history.push({ role: 'user', content: userMessage });
      this.history.push({ role: 'assistant', content: result.data.response });

      // Keep last 20 messages
      if (this.history.length > 20) {
        this.history = this.history.slice(-20);
      }

      return result.data.response;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'functions/unauthenticated') {
        throw new Error('로그인이 필요합니다.');
      }
      if (err.code === 'functions/failed-precondition') {
        throw new Error('AI 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.');
      }
      throw new Error(err.message || 'AI 응답 생성 중 오류가 발생했습니다.');
    }
  }

  resetSession(): void {
    this.history = [];
  }
}
