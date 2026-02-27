import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatbot } from '../../hooks/useChatbot';

// Firebase 모킹 (chatbotService 내부 의존성)
vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn()),
}));

// ChatbotService를 클래스 생성자로 올바르게 모킹
// vi.mock 팩토리는 호이스팅되므로 외부 변수 참조 불가 → 내부에서 vi.fn() 생성
vi.mock('../../services/chatbotService', () => {
  const MockChatbotService = vi.fn();
  MockChatbotService.prototype.processMessage = vi.fn();
  MockChatbotService.prototype.resetSession = vi.fn();
  return { ChatbotService: MockChatbotService };
});

import { ChatbotService } from '../../services/chatbotService';

const MockedChatbotService = vi.mocked(ChatbotService);

const mockUserProfile = {
  uid: 'user-001',
  email: 'test@test.com',
  role: 'teacher' as const,
  displayName: '홍길동',
  name: '홍길동',
  staffId: 'staff-001',
  status: 'approved' as const,
};

describe('useChatbot Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 각 테스트 전 prototype 메서드 기본 동작 설정
    MockedChatbotService.prototype.processMessage = vi.fn().mockResolvedValue('AI 응답 메시지입니다.');
    MockedChatbotService.prototype.resetSession = vi.fn();
  });

  describe('기본 초기화', () => {
    it('초기 상태에서 messages가 빈 배열이고 isLoading이 false이다', () => {
      // Given: useChatbot 훅이 isOpen=false로 호출되면
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: false,
        })
      );

      // Then: 초기 상태가 올바르다
      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('필수 반환값(messages, isLoading, sendMessage, clearHistory)을 모두 반환한다', () => {
      // Given: useChatbot 훅이 호출되면
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
        })
      );

      // Then: 모든 반환값이 존재한다
      expect(result.current.messages).toBeDefined();
      expect(result.current.isLoading).toBeDefined();
      expect(result.current.sendMessage).toBeInstanceOf(Function);
      expect(result.current.clearHistory).toBeInstanceOf(Function);
    });

    it('isOpen이 true이고 userProfile이 있을 때 환영 메시지가 추가된다', () => {
      // Given: isOpen=true, userProfile 있는 상태로 훅이 렌더링되면
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      // Then: 환영 메시지가 메시지 목록에 추가된다
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('assistant');
      expect(result.current.messages[0].content).toContain('홍길동');
    });

    it('isOpen이 true이지만 userProfile이 null이면 메시지가 추가되지 않는다', () => {
      // Given: isOpen=true이지만 userProfile이 null인 상태로 훅이 렌더링되면
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: null,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      // Then: 메시지가 추가되지 않는다
      expect(result.current.messages).toHaveLength(0);
    });

    it('isOpen이 false이면 ChatbotService 인스턴스가 생성되지 않는다', () => {
      // Given: isOpen=false로 훅이 렌더링되면
      renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: false,
        })
      );

      // Then: ChatbotService 생성자가 호출되지 않는다
      expect(MockedChatbotService).not.toHaveBeenCalled();
    });

    it('isOpen이 true이면 ChatbotService 인스턴스가 생성된다', () => {
      // Given: isOpen=true로 훅이 렌더링되면
      renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      // Then: ChatbotService 생성자가 userProfile과 함께 호출된다
      expect(MockedChatbotService).toHaveBeenCalledWith(mockUserProfile);
    });
  });

  describe('메시지 전송 (sendMessage)', () => {
    it('메시지 전송 시 사용자 메시지와 AI 응답이 messages에 추가된다', async () => {
      // Given: 챗봇이 열린 상태이고
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      const initialMessageCount = result.current.messages.length;

      // When: 메시지를 전송하면
      await act(async () => {
        await result.current.sendMessage('학생 출석률 알려줘');
      });

      // Then: 사용자 메시지와 AI 응답이 추가된다
      expect(result.current.messages).toHaveLength(initialMessageCount + 2);
      expect(result.current.messages[initialMessageCount].role).toBe('user');
      expect(result.current.messages[initialMessageCount].content).toBe('학생 출석률 알려줘');
      expect(result.current.messages[initialMessageCount + 1].role).toBe('assistant');
    });

    it('메시지 전송 중 isLoading이 true가 된다', async () => {
      // Given: 응답이 지연되는 상황이고
      let resolveMessage: (value: string) => void;
      MockedChatbotService.prototype.processMessage = vi.fn().mockReturnValue(
        new Promise<string>((resolve) => { resolveMessage = resolve; })
      );

      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      // When: 메시지를 전송하면
      act(() => {
        result.current.sendMessage('질문입니다');
      });

      // Then: isLoading이 true가 된다
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Cleanup: 응답을 완료시킨다
      await act(async () => {
        resolveMessage!('응답');
      });
    });

    it('메시지 전송 완료 후 isLoading이 false가 된다', async () => {
      // Given: 챗봇이 열린 상태이고
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      // When: 메시지를 전송하고 완료되면
      await act(async () => {
        await result.current.sendMessage('질문입니다');
      });

      // Then: isLoading이 false로 돌아온다
      expect(result.current.isLoading).toBe(false);
    });

    it('빈 문자열 메시지는 전송되지 않는다', async () => {
      // Given: 챗봇이 열린 상태이고
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      const initialMessageCount = result.current.messages.length;

      // When: 빈 문자열(공백만)을 전송하면
      await act(async () => {
        await result.current.sendMessage('   ');
      });

      // Then: 메시지가 추가되지 않는다
      expect(result.current.messages).toHaveLength(initialMessageCount);
      expect(MockedChatbotService.prototype.processMessage).not.toHaveBeenCalled();
    });

    it('AI 응답 오류 시 에러 메시지가 추가된다', async () => {
      // Given: processMessage가 오류를 던지도록 설정하고
      MockedChatbotService.prototype.processMessage = vi.fn().mockRejectedValue(new Error('서버 오류'));

      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      const initialMessageCount = result.current.messages.length;

      // When: 메시지를 전송하면
      await act(async () => {
        await result.current.sendMessage('질문입니다');
      });

      // Then: 에러 메시지가 추가되고 isError가 true이다
      const errorMessage = result.current.messages[initialMessageCount + 1];
      expect(errorMessage.role).toBe('assistant');
      expect(errorMessage.isError).toBe(true);
      expect(errorMessage.content).toContain('서버 오류');
    });

    it('서비스가 초기화되지 않은 상태(isOpen=false)에서는 메시지 전송이 무시된다', async () => {
      // Given: 챗봇이 닫힌 상태이고 (serviceRef.current가 null)
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: false,
        })
      );

      // When: 메시지를 전송하려 하면
      await act(async () => {
        await result.current.sendMessage('질문입니다');
      });

      // Then: processMessage가 호출되지 않는다
      expect(MockedChatbotService.prototype.processMessage).not.toHaveBeenCalled();
    });
  });

  describe('대화 초기화 (clearHistory)', () => {
    it('clearHistory 호출 시 메시지가 초기화된다', async () => {
      // Given: 챗봇이 열린 상태에서 메시지를 주고받고
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      await act(async () => {
        await result.current.sendMessage('첫 번째 질문');
      });

      expect(result.current.messages.length).toBeGreaterThan(1);

      // When: clearHistory를 호출하면
      act(() => {
        result.current.clearHistory();
      });

      // Then: isOpen=true이므로 재초기화 메시지 1개로 줄어든다
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toContain('초기화');
    });

    it('clearHistory 호출 시 resetSession이 호출된다', () => {
      // Given: 챗봇이 열린 상태이고
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      // When: clearHistory를 호출하면
      act(() => {
        result.current.clearHistory();
      });

      // Then: resetSession이 호출된다
      expect(MockedChatbotService.prototype.resetSession).toHaveBeenCalledTimes(1);
    });

    it('isOpen이 false인 상태에서 clearHistory 호출 시 메시지가 빈 배열이 된다', () => {
      // Given: 챗봇이 닫힌 상태이고
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: false,
        })
      );

      // When: clearHistory를 호출하면
      act(() => {
        result.current.clearHistory();
      });

      // Then: 메시지 목록이 비어 있다 (isOpen=false이므로 재초기화 없음)
      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('메시지 ID 생성', () => {
    it('각 메시지는 고유한 id를 가진다', async () => {
      // Given: 챗봇이 열린 상태이고
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      // When: 메시지를 전송하면
      await act(async () => {
        await result.current.sendMessage('첫 번째 질문');
      });

      // Then: 모든 메시지 id가 고유하다
      const ids = result.current.messages.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('메시지 id는 "msg_" 접두사로 시작한다', () => {
      // Given: 챗봇이 열린 상태이고 환영 메시지가 있을 때
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      // Then: 메시지 id가 올바른 형식이다
      expect(result.current.messages[0].id).toMatch(/^msg_/);
    });
  });

  describe('메시지 구조', () => {
    it('사용자 메시지는 role이 "user"이고 content, timestamp를 가진다', async () => {
      // Given: 챗봇이 열린 상태이고
      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      const before = Date.now();

      // When: 메시지를 전송하면
      await act(async () => {
        await result.current.sendMessage('테스트 질문');
      });

      const after = Date.now();

      // Then: 사용자 메시지 구조가 올바르다
      const userMsg = result.current.messages.find((m) => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg!.content).toBe('테스트 질문');
      expect(userMsg!.timestamp).toBeGreaterThanOrEqual(before);
      expect(userMsg!.timestamp).toBeLessThanOrEqual(after);
    });

    it('AI 응답 메시지는 role이 "assistant"이고 content를 가진다', async () => {
      // Given: 특정 응답을 반환하도록 설정하고
      MockedChatbotService.prototype.processMessage = vi.fn().mockResolvedValue('테스트 AI 응답');

      const { result } = renderHook(() =>
        useChatbot({
          userProfile: mockUserProfile,
          hasPermission: vi.fn(() => true),
          isOpen: true,
        })
      );

      // When: 메시지를 전송하면
      await act(async () => {
        await result.current.sendMessage('질문');
      });

      // Then: AI 응답 메시지가 올바른 구조를 가진다
      const assistantMsgs = result.current.messages.filter((m) => m.role === 'assistant');
      const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
      expect(lastAssistant.content).toBe('테스트 AI 응답');
      expect(lastAssistant.isError).toBeUndefined();
    });
  });

  describe('isOpen 상태 변경', () => {
    it('isOpen이 false → true로 변경될 때 환영 메시지가 추가된다', () => {
      // Given: 챗봇이 닫힌 상태로 시작하고
      const { result, rerender } = renderHook(
        ({ isOpen }) =>
          useChatbot({
            userProfile: mockUserProfile,
            hasPermission: vi.fn(() => true),
            isOpen,
          }),
        { initialProps: { isOpen: false } }
      );

      expect(result.current.messages).toHaveLength(0);

      // When: isOpen이 true로 변경되면
      rerender({ isOpen: true });

      // Then: 환영 메시지가 추가된다
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('assistant');
    });

    it('isOpen이 true일 때 ChatbotService가 한 번만 생성된다', () => {
      // Given: 챗봇이 열린 상태에서
      const { rerender } = renderHook(
        ({ isOpen }) =>
          useChatbot({
            userProfile: mockUserProfile,
            hasPermission: vi.fn(() => true),
            isOpen,
          }),
        { initialProps: { isOpen: true } }
      );

      // 이미 초기화됨
      expect(MockedChatbotService).toHaveBeenCalledTimes(1);

      // When: 동일한 props로 리렌더링해도
      rerender({ isOpen: true });

      // Then: 서비스가 재생성되지 않는다 (isInitializedRef.current가 true)
      expect(MockedChatbotService).toHaveBeenCalledTimes(1);
    });
  });
});
