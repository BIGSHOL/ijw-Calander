/**
 * Comprehensive tests for useEventCrud hook
 *
 * Tests cover:
 * - safeDeptId utility function
 * - handleSaveEvent (single, multi-dept, recurring, archive restore, bucket conversion)
 * - handleDeleteEvent (single, recurring, linked events)
 * - handleBatchUpdateAttendance
 * - Error handling scenarios
 */

import { useEventCrud, safeDeptId } from '../../hooks/useEventCrud';
import { doc, collection, query, where, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { CalendarEvent } from '../../types';

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));
vi.mock('../../converters', () => ({ eventConverter: {} }));

describe('useEventCrud', () => {
  let mockBatch: any;
  let alertSpy: ReturnType<typeof vi.fn>;
  let confirmSpy: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let mockOnDeleteBucketItem: ReturnType<typeof vi.fn>;
  let mockOnResetBucketState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup batch mock
    mockBatch = {
      set: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(writeBatch).mockReturnValue(mockBatch);

    // Setup global functions
    alertSpy = vi.fn();
    confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('alert', alertSpy);
    vi.stubGlobal('confirm', confirmSpy);

    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup callbacks
    mockOnDeleteBucketItem = vi.fn().mockResolvedValue(undefined);
    mockOnResetBucketState = vi.fn();

    // Setup Firebase mocks
    const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
    vi.mocked(doc).mockReturnValue(mockDocRef as any);

    const mockCollectionRef = { withConverter: vi.fn().mockReturnThis() };
    vi.mocked(collection).mockReturnValue(mockCollectionRef as any);

    vi.mocked(query).mockReturnValue({} as any);
    vi.mocked(where).mockReturnValue({} as any);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ============================================================================
  // 1. safeDeptId - Exported utility function
  // ============================================================================

  describe('safeDeptId', () => {
    it('슬래시를 언더스코어로 치환한다', () => {
      expect(safeDeptId('dept/sub')).toBe('dept_sub');
    });

    it('슬래시가 없으면 그대로 반환한다', () => {
      expect(safeDeptId('dept')).toBe('dept');
    });

    it('여러 개의 슬래시를 모두 치환한다', () => {
      expect(safeDeptId('a/b/c')).toBe('a_b_c');
    });

    it('빈 문자열을 처리한다', () => {
      expect(safeDeptId('')).toBe('');
    });
  });

  // ============================================================================
  // 2. handleSaveEvent - Single event (no recurrence, single dept)
  // ============================================================================

  describe('handleSaveEvent - Single event', () => {
    it('단일 부서 단일 일정을 저장한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        createdAt: Date.now(),
      };

      await handleSaveEvent(event);

      expect(mockBatch.set).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('version을 1 증가시킨다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        version: 5,
      };

      await handleSaveEvent(event);

      const setCall = mockBatch.set.mock.calls[0];
      const savedEvent = setCall[1];
      expect(savedEvent.version).toBe(6);
    });

    it('departmentId 변경 시 기존 이벤트를 삭제한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      // departmentId(원래 부서)와 departmentIds(새 대상 부서)가 다르면
      // isPrimary가 false → finalId가 event.id와 달라짐 → 기존 event.id 삭제
      const event: CalendarEvent = {
        id: 'event1',
        title: '미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        departmentIds: ['dept2'],
        createdAt: Date.now(),
      };

      await handleSaveEvent(event);

      // dept2로 새 이벤트(event1_dept2) 생성, 기존 event1 삭제
      expect(mockBatch.set).toHaveBeenCalledTimes(1);
      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // 3. handleSaveEvent - Multi-dept with relatedGroupId (update existing)
  // ============================================================================

  describe('handleSaveEvent - Multi-dept with relatedGroupId', () => {
    it('기존 연동 그룹을 업데이트한다', async () => {
      const relatedGroupId = 'group_123';

      // Mock existing siblings
      const mockSnapshot = {
        empty: false,
        docs: [
          { id: 'event1', data: () => ({ id: 'event1', departmentId: 'dept1' }) },
          { id: 'event1_dept2', data: () => ({ id: 'event1_dept2', departmentId: 'dept2' }) },
        ],
        forEach: function(callback: any) {
          this.docs.forEach(callback);
        },
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '연동 미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        departmentIds: ['dept1', 'dept2'],
        relatedGroupId,
        version: 1,
      };

      await handleSaveEvent(event);

      // Updates both dept events
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('relatedGroupId가 있지만 DB에 없으면 새로 생성한다', async () => {
      const relatedGroupId = 'group_nonexistent';

      // Mock empty snapshot
      const mockSnapshot = {
        empty: true,
        docs: [],
        forEach: vi.fn(),
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '연동 미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        departmentIds: ['dept1', 'dept2'],
        relatedGroupId,
      };

      await handleSaveEvent(event);

      // Creates new events for both depts
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('departmentIds에서 제거된 부서의 이벤트를 삭제한다', async () => {
      const relatedGroupId = 'group_123';

      // Mock existing 3 siblings
      const mockSnapshot = {
        empty: false,
        docs: [
          { id: 'event1', data: () => ({ id: 'event1', departmentId: 'dept1' }) },
          { id: 'event1_dept2', data: () => ({ id: 'event1_dept2', departmentId: 'dept2' }) },
          { id: 'event1_dept3', data: () => ({ id: 'event1_dept3', departmentId: 'dept3' }) },
        ],
        forEach: function(callback: any) {
          this.docs.forEach(callback);
        },
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '연동 미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        departmentIds: ['dept1', 'dept2'], // dept3 removed
        relatedGroupId,
      };

      await handleSaveEvent(event);

      // Sets dept1, dept2 and deletes dept3
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // 4. handleSaveEvent - Multi-dept new event
  // ============================================================================

  describe('handleSaveEvent - Multi-dept new event', () => {
    it('여러 부서에 대해 이벤트를 생성한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '전체 미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        departmentIds: ['dept1', 'dept2', 'dept3'],
      };

      await handleSaveEvent(event);

      // Creates 3 events (one per dept)
      expect(mockBatch.set).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);

      // Verify relatedGroupId is set
      const firstCall = mockBatch.set.mock.calls[0];
      const savedEvent = firstCall[1];
      expect(savedEvent.relatedGroupId).toMatch(/^group_/);
    });

    it('safeDeptId를 사용하여 비주요 부서 ID를 생성한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        departmentIds: ['dept1', 'dept/sub'],
      };

      await handleSaveEvent(event);

      // Verify the second event ID uses safeDeptId
      const calls = mockBatch.set.mock.calls;
      const secondEventId = calls[1][1].id;
      expect(secondEventId).toBe('event1_dept_sub');
    });

    it('relatedGroupId를 자동 생성한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        departmentIds: ['dept1', 'dept2'],
      };

      await handleSaveEvent(event);

      const firstEvent = mockBatch.set.mock.calls[0][1];
      const secondEvent = mockBatch.set.mock.calls[1][1];

      expect(firstEvent.relatedGroupId).toBeTruthy();
      expect(firstEvent.relatedGroupId).toBe(secondEvent.relatedGroupId);
    });
  });

  // ============================================================================
  // 5. handleSaveEvent - Recurring events
  // ============================================================================

  describe('handleSaveEvent - Recurring events', () => {
    it('daily 반복으로 여러 일정을 생성한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event = {
        id: 'event1',
        title: '일일 미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        recurrenceType: 'daily',
        _recurrenceCount: 3,
      } as any;

      await handleSaveEvent(event);

      // Creates 3 events
      expect(mockBatch.set).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('3개의 반복 일정이 생성되었습니다.');
    });

    it('weekdays 반복으로 평일만 생성한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event = {
        id: 'event1',
        title: '평일 미팅',
        startDate: '2024-03-18', // Monday
        endDate: '2024-03-18',
        departmentId: 'dept1',
        recurrenceType: 'weekdays',
        _recurrenceCount: 5,
      } as any;

      await handleSaveEvent(event);

      expect(mockBatch.set).toHaveBeenCalledTimes(5);
      expect(alertSpy).toHaveBeenCalledWith('5개의 반복 일정이 생성되었습니다.');
    });

    it('weekends 반복으로 주말만 생성한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event = {
        id: 'event1',
        title: '주말 미팅',
        startDate: '2024-03-16', // Saturday
        endDate: '2024-03-16',
        departmentId: 'dept1',
        recurrenceType: 'weekends',
        _recurrenceCount: 4,
      } as any;

      await handleSaveEvent(event);

      expect(mockBatch.set).toHaveBeenCalledTimes(4);
      expect(alertSpy).toHaveBeenCalledWith('4개의 반복 일정이 생성되었습니다.');
    });

    it('weekly 반복으로 매주 생성한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event = {
        id: 'event1',
        title: '주간 미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        recurrenceType: 'weekly',
        _recurrenceCount: 4,
      } as any;

      await handleSaveEvent(event);

      expect(mockBatch.set).toHaveBeenCalledTimes(4);
      expect(alertSpy).toHaveBeenCalledWith('4개의 반복 일정이 생성되었습니다.');
    });

    it('monthly 반복으로 매월 생성한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event = {
        id: 'event1',
        title: '월간 미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        recurrenceType: 'monthly',
        _recurrenceCount: 3,
      } as any;

      await handleSaveEvent(event);

      expect(mockBatch.set).toHaveBeenCalledTimes(3);
      expect(alertSpy).toHaveBeenCalledWith('3개의 반복 일정이 생성되었습니다.');
    });

    it('yearly 반복으로 매년 생성한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event = {
        id: 'event1',
        title: '연간 행사',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        recurrenceType: 'yearly',
        _recurrenceCount: 3,
      } as any;

      await handleSaveEvent(event);

      expect(mockBatch.set).toHaveBeenCalledTimes(3);
      expect(alertSpy).toHaveBeenCalledWith('3개의 반복 일정이 생성되었습니다.');
    });

    it('recurrenceGroupId를 설정한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event = {
        id: 'event1',
        title: '반복 미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        recurrenceType: 'daily',
        _recurrenceCount: 3,
      } as any;

      await handleSaveEvent(event);

      const firstEvent = mockBatch.set.mock.calls[0][1];
      const secondEvent = mockBatch.set.mock.calls[1][1];

      expect(firstEvent.recurrenceGroupId).toBe('event1');
      expect(secondEvent.recurrenceGroupId).toBe('event1');
      expect(firstEvent.recurrenceIndex).toBe(1);
      expect(secondEvent.recurrenceIndex).toBe(2);
    });

    it('반복 일정과 다중 부서를 함께 처리한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event = {
        id: 'event1',
        title: '반복 연동 미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        departmentIds: ['dept1', 'dept2'],
        recurrenceType: 'daily',
        _recurrenceCount: 2,
      } as any;

      await handleSaveEvent(event);

      // 2 recurrences × 2 depts = 4 events
      expect(mockBatch.set).toHaveBeenCalledTimes(4);
      expect(alertSpy).toHaveBeenCalledWith('4개의 반복 일정이 생성되었습니다.');
    });

    it('배치 크기 제한(499)을 초과하면 여러 배치로 나눈다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event = {
        id: 'event1',
        title: '대량 반복 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        recurrenceType: 'daily',
        _recurrenceCount: 600,
      } as any;

      await handleSaveEvent(event);

      // Should commit multiple batches
      expect(mockBatch.commit).toHaveBeenCalledTimes(2);
      expect(mockBatch.set).toHaveBeenCalledTimes(600);
      expect(alertSpy).toHaveBeenCalledWith('600개의 반복 일정이 생성되었습니다.');
    });
  });

  // ============================================================================
  // 6. handleSaveEvent - Auto-restore from archive
  // ============================================================================

  describe('handleSaveEvent - Auto-restore from archive', () => {
    it('isArchived가 true이면 archived_events에서 삭제한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '보관된 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        isArchived: true,
      };

      await handleSaveEvent(event);

      expect(deleteDoc).toHaveBeenCalledWith(
        expect.objectContaining({ withConverter: expect.any(Function) })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('복원 후 isArchived 속성을 제거한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '보관된 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        isArchived: true,
      };

      await handleSaveEvent(event);

      const savedEvent = mockBatch.set.mock.calls[0][1];
      expect(savedEvent.isArchived).toBeUndefined();
    });
  });

  // ============================================================================
  // 7. handleSaveEvent - Bucket conversion
  // ============================================================================

  describe('handleSaveEvent - Bucket conversion', () => {
    it('pendingBucketId가 있으면 버킷 아이템을 삭제한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: 'bucket123',
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '버킷에서 변환',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
      };

      await handleSaveEvent(event);

      expect(mockOnDeleteBucketItem).toHaveBeenCalledWith('bucket123');
      expect(mockOnResetBucketState).toHaveBeenCalled();
    });

    it('저장 성공 후에만 버킷을 삭제한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: 'bucket123',
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '버킷에서 변환',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
      };

      await handleSaveEvent(event);

      // Verify order: commit first, then delete bucket
      const commitCallOrder = mockBatch.commit.mock.invocationCallOrder[0];
      const deleteCallOrder = mockOnDeleteBucketItem.mock.invocationCallOrder[0];
      expect(commitCallOrder).toBeLessThan(deleteCallOrder);
    });
  });

  // ============================================================================
  // 8. handleSaveEvent - Error handling
  // ============================================================================

  describe('handleSaveEvent - Error handling', () => {
    it('에러 발생 시 콘솔에 로그하고 알림을 표시한다', async () => {
      mockBatch.commit.mockRejectedValue(new Error('Firebase error'));

      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '실패할 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
      };

      await handleSaveEvent(event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error saving event: ',
        expect.any(Error)
      );
      expect(alertSpy).toHaveBeenCalledWith('일정 저장 실패');
    });

    it('에러 발생 시 버킷 상태를 리셋한다', async () => {
      mockBatch.commit.mockRejectedValue(new Error('Firebase error'));

      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: 'bucket123',
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '실패할 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
      };

      await handleSaveEvent(event);

      expect(mockOnResetBucketState).toHaveBeenCalled();
      expect(mockOnDeleteBucketItem).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 9. handleDeleteEvent - Single event
  // ============================================================================

  describe('handleDeleteEvent - Single event', () => {
    it('단일 일정을 삭제한다', async () => {
      const { handleDeleteEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1');

      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('event 객체 없이 ID만으로 삭제한다', async () => {
      const { handleDeleteEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1');

      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 10. handleDeleteEvent - Recurring event (delete all)
  // ============================================================================

  describe('handleDeleteEvent - Recurring event (delete all)', () => {
    it('confirm이 true이면 현재 이후 모든 반복 일정을 삭제한다', async () => {
      confirmSpy.mockReturnValue(true);

      const events: CalendarEvent[] = [
        {
          id: 'event1',
          title: '반복 1',
          startDate: '2024-03-15',
          endDate: '2024-03-15',
          departmentId: 'dept1',
          recurrenceGroupId: 'group1',
          recurrenceIndex: 1,
        },
        {
          id: 'event1_r2',
          title: '반복 2',
          startDate: '2024-03-16',
          endDate: '2024-03-16',
          departmentId: 'dept1',
          recurrenceGroupId: 'group1',
          recurrenceIndex: 2,
        },
        {
          id: 'event1_r3',
          title: '반복 3',
          startDate: '2024-03-17',
          endDate: '2024-03-17',
          departmentId: 'dept1',
          recurrenceGroupId: 'group1',
          recurrenceIndex: 3,
        },
      ];

      const { handleDeleteEvent } = useEventCrud({
        events,
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1_r2', events[1]);

      // Deletes event 2 and 3 (index >= 2)
      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(alertSpy).toHaveBeenCalledWith('2개의 반복 일정이 삭제되었습니다.');
    });

    it('confirm 대화상자를 표시한다', async () => {
      confirmSpy.mockReturnValue(true);

      const event: CalendarEvent = {
        id: 'event1',
        title: '반복 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        recurrenceGroupId: 'group1',
        recurrenceIndex: 1,
      };

      const { handleDeleteEvent } = useEventCrud({
        events: [event],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1', event);

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('이 일정은 반복 일정입니다')
      );
    });
  });

  // ============================================================================
  // 11. handleDeleteEvent - Recurring event (delete single)
  // ============================================================================

  describe('handleDeleteEvent - Recurring event (delete single)', () => {
    it('confirm이 false이면 단일 일정만 삭제한다', async () => {
      confirmSpy.mockReturnValueOnce(false);

      const mockSnapshot = {
        docs: [],
        forEach: vi.fn(),
      };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const event: CalendarEvent = {
        id: 'event1_r2',
        title: '반복 2',
        startDate: '2024-03-16',
        endDate: '2024-03-16',
        departmentId: 'dept1',
        recurrenceGroupId: 'group1',
        recurrenceIndex: 2,
      };

      const { handleDeleteEvent } = useEventCrud({
        events: [event],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1_r2', event);

      // Only deletes the single event
      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 12. handleDeleteEvent - Linked event (delete all)
  // ============================================================================

  describe('handleDeleteEvent - Linked event (delete all)', () => {
    it('confirm이 true이면 연동된 모든 부서의 일정을 삭제한다', async () => {
      confirmSpy.mockReturnValue(true);

      const mockSnapshot = {
        docs: [
          { id: 'event1', data: () => ({ id: 'event1', departmentId: 'dept1' }) },
          { id: 'event1_dept2', data: () => ({ id: 'event1_dept2', departmentId: 'dept2' }) },
        ],
        forEach: function(callback: any) {
          this.docs.forEach(callback);
        },
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const event: CalendarEvent = {
        id: 'event1',
        title: '연동 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        relatedGroupId: 'group123',
      };

      const { handleDeleteEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1', event);

      // Deletes all linked events
      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('confirm 대화상자를 표시한다', async () => {
      const mockSnapshot = {
        docs: [
          { id: 'event1_dept2', data: () => ({ id: 'event1_dept2', departmentId: 'dept2' }) },
        ],
        forEach: function(callback: any) {
          this.docs.forEach(callback);
        },
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const event: CalendarEvent = {
        id: 'event1',
        title: '연동 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        relatedGroupId: 'group123',
      };

      const { handleDeleteEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1', event);

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('다른 부서와 연동되어 있습니다')
      );
    });
  });

  // ============================================================================
  // 13. handleDeleteEvent - Linked event (delete single)
  // ============================================================================

  describe('handleDeleteEvent - Linked event (delete single)', () => {
    it('confirm이 false이면 현재 부서의 일정만 삭제한다', async () => {
      confirmSpy.mockReturnValue(false);

      const mockSnapshot = {
        docs: [
          { id: 'event1_dept2', data: () => ({ id: 'event1_dept2', departmentId: 'dept2' }) },
        ],
        forEach: function(callback: any) {
          this.docs.forEach(callback);
        },
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const event: CalendarEvent = {
        id: 'event1',
        title: '연동 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        relatedGroupId: 'group123',
      };

      const { handleDeleteEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1', event);

      // Only deletes current event
      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 14. handleDeleteEvent - Error handling
  // ============================================================================

  describe('handleDeleteEvent - Error handling', () => {
    it('에러 발생 시 콘솔에 로그하고 알림을 표시한다', async () => {
      mockBatch.commit.mockRejectedValue(new Error('Delete failed'));

      const { handleDeleteEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error deleting event: ',
        expect.any(Error)
      );
      expect(alertSpy).toHaveBeenCalledWith('일정 삭제 실패');
    });
  });

  // ============================================================================
  // 15. handleBatchUpdateAttendance
  // ============================================================================

  describe('handleBatchUpdateAttendance', () => {
    it('recurrenceGroupId로 이벤트를 필터링하고 참가 상태를 업데이트한다', async () => {
      const events: CalendarEvent[] = [
        {
          id: 'event1',
          title: '반복 1',
          startDate: '2024-03-15',
          endDate: '2024-03-15',
          departmentId: 'dept1',
          recurrenceGroupId: 'group1',
          attendance: {},
        },
        {
          id: 'event1_r2',
          title: '반복 2',
          startDate: '2024-03-16',
          endDate: '2024-03-16',
          departmentId: 'dept1',
          recurrenceGroupId: 'group1',
          attendance: {},
        },
        {
          id: 'event2',
          title: '다른 일정',
          startDate: '2024-03-17',
          endDate: '2024-03-17',
          departmentId: 'dept1',
          recurrenceGroupId: 'group2',
        },
      ];

      const { handleBatchUpdateAttendance } = useEventCrud({
        events,
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleBatchUpdateAttendance('group1', 'user123', 'joined');

      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('2개의 반복 일정에 참가 상태가 적용되었습니다.');
    });

    it('기존 attendance 객체를 병합한다', async () => {
      const events: CalendarEvent[] = [
        {
          id: 'event1',
          title: '반복 1',
          startDate: '2024-03-15',
          endDate: '2024-03-15',
          departmentId: 'dept1',
          recurrenceGroupId: 'group1',
          attendance: { user1: 'joined' },
        },
      ];

      const { handleBatchUpdateAttendance } = useEventCrud({
        events,
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleBatchUpdateAttendance('group1', 'user2', 'declined');

      const updateCall = mockBatch.update.mock.calls[0];
      const updatedAttendance = updateCall[1]['참가현황'];

      expect(updatedAttendance).toEqual({
        user1: 'joined',
        user2: 'declined',
      });
    });

    it('pending 상태를 설정할 수 있다', async () => {
      const events: CalendarEvent[] = [
        {
          id: 'event1',
          title: '일정',
          startDate: '2024-03-15',
          endDate: '2024-03-15',
          departmentId: 'dept1',
          recurrenceGroupId: 'group1',
        },
      ];

      const { handleBatchUpdateAttendance } = useEventCrud({
        events,
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleBatchUpdateAttendance('group1', 'user123', 'pending');

      const updateCall = mockBatch.update.mock.calls[0];
      const updatedAttendance = updateCall[1]['참가현황'];

      expect(updatedAttendance.user123).toBe('pending');
    });

    it('에러 발생 시 콘솔에 로그하고 알림을 표시한다', async () => {
      mockBatch.commit.mockRejectedValue(new Error('Update failed'));

      const events: CalendarEvent[] = [
        {
          id: 'event1',
          title: '일정',
          startDate: '2024-03-15',
          endDate: '2024-03-15',
          departmentId: 'dept1',
          recurrenceGroupId: 'group1',
        },
      ];

      const { handleBatchUpdateAttendance } = useEventCrud({
        events,
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleBatchUpdateAttendance('group1', 'user123', 'joined');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error batch updating attendance: ',
        expect.any(Error)
      );
      expect(alertSpy).toHaveBeenCalledWith('참가 상태 일괄 변경 실패');
    });

    it('매칭되는 이벤트가 없으면 아무것도 업데이트하지 않는다', async () => {
      const events: CalendarEvent[] = [
        {
          id: 'event1',
          title: '일정',
          startDate: '2024-03-15',
          endDate: '2024-03-15',
          departmentId: 'dept1',
          recurrenceGroupId: 'group1',
        },
      ];

      const { handleBatchUpdateAttendance } = useEventCrud({
        events,
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleBatchUpdateAttendance('nonexistent', 'user123', 'joined');

      expect(mockBatch.update).not.toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('0개의 반복 일정에 참가 상태가 적용되었습니다.');
    });
  });

  // ============================================================================
  // Edge cases and complex scenarios
  // ============================================================================

  describe('Edge cases', () => {
    it('departmentIds가 비어있으면 departmentId를 사용한다', async () => {
      const { handleSaveEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      const event: CalendarEvent = {
        id: 'event1',
        title: '미팅',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        departmentIds: [],
      };

      await handleSaveEvent(event);

      const savedEvent = mockBatch.set.mock.calls[0][1];
      expect(savedEvent.departmentId).toBe('dept1');
    });

    it('반복 일정 삭제 시 recurrenceIndex가 0이면 단일 삭제로 처리한다', async () => {
      const event: CalendarEvent = {
        id: 'event1',
        title: '반복 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        recurrenceGroupId: 'group1',
        recurrenceIndex: 0,
      };

      const mockSnapshot = {
        docs: [],
        forEach: vi.fn(),
      };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { handleDeleteEvent } = useEventCrud({
        events: [],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1', event);

      // Does not show recurring delete dialog
      expect(confirmSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('반복 일정')
      );
    });

    it('반복 일정의 단일 삭제에서 연동 확인 대화상자를 표시한다', async () => {
      confirmSpy.mockReturnValueOnce(false).mockReturnValueOnce(true);

      const mockSnapshot = {
        docs: [
          { id: 'event1_dept2', data: () => ({ id: 'event1_dept2', departmentId: 'dept2' }) },
        ],
        forEach: function(callback: any) {
          this.docs.forEach(callback);
        },
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const event: CalendarEvent = {
        id: 'event1',
        title: '반복 연동 일정',
        startDate: '2024-03-15',
        endDate: '2024-03-15',
        departmentId: 'dept1',
        recurrenceGroupId: 'group1',
        recurrenceIndex: 1,
        relatedGroupId: 'relgroup1',
      };

      const { handleDeleteEvent } = useEventCrud({
        events: [event],
        pendingBucketId: null,
        onDeleteBucketItem: mockOnDeleteBucketItem,
        onResetBucketState: mockOnResetBucketState,
      });

      await handleDeleteEvent('event1', event);

      expect(confirmSpy).toHaveBeenCalledTimes(2);
    });
  });
});
