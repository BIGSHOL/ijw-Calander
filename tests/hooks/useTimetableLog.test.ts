import { logTimetableChange, TimetableLogAction } from '../../hooks/useTimetableLog';
import { addDoc, collection } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
  limit: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
  auth: {
    currentUser: { email: 'teacher@test.com', displayName: '김선생' },
  },
}));

describe('useTimetableLog - logTimetableChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (collection as any).mockReturnValue({});
    (addDoc as any).mockResolvedValue({ id: 'log-1' });
  });

  describe('기본 로그 기록', () => {
    it('필수 파라미터로 addDoc을 호출한다', () => {
      // Given: 수업 생성 로그를 기록할 때
      logTimetableChange({
        action: 'class_create',
        subject: 'math',
        className: '수학A반',
        details: '새 수업 생성',
      });

      // Then: addDoc이 호출된다 (fire-and-forget)
      expect(addDoc).toHaveBeenCalledTimes(1);
    });

    it('로그 엔트리에 action, subject, className, details, timestamp가 포함된다', () => {
      // Given: 로그를 기록하면
      logTimetableChange({
        action: 'class_update',
        subject: 'english',
        className: '영어B반',
        details: '수업 시간 변경',
      });

      // Then: 필수 필드가 포함된다
      const callArg = (addDoc as any).mock.calls[0][1];
      expect(callArg.action).toBe('class_update');
      expect(callArg.subject).toBe('english');
      expect(callArg.className).toBe('영어B반');
      expect(callArg.details).toBe('수업 시간 변경');
      expect(callArg.timestamp).toBeDefined();
    });

    it('changedBy가 auth.currentUser.email로 설정된다', () => {
      // Given: 로그를 기록하면
      logTimetableChange({
        action: 'student_enroll',
        subject: 'math',
        className: '수학A반',
        details: '학생 등록',
      });

      // Then: changedBy가 현재 사용자 이메일이다
      const callArg = (addDoc as any).mock.calls[0][1];
      expect(callArg.changedBy).toBe('teacher@test.com');
    });

    it('timestamp가 ISO 형식 문자열이다', () => {
      // Given: 로그를 기록하면
      logTimetableChange({
        action: 'class_delete',
        subject: 'math',
        className: '수학A반',
        details: '수업 삭제',
      });

      // Then: timestamp가 ISO 형식이다
      const callArg = (addDoc as any).mock.calls[0][1];
      expect(callArg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('선택적 파라미터', () => {
    it('studentName이 있으면 로그에 포함된다', () => {
      // Given: 학생 이름을 포함한 로그를 기록하면
      logTimetableChange({
        action: 'student_enroll',
        subject: 'math',
        className: '수학A반',
        studentName: '홍길동',
        details: '학생 등록',
      });

      // Then: studentName이 로그에 포함된다
      const callArg = (addDoc as any).mock.calls[0][1];
      expect(callArg.studentName).toBe('홍길동');
    });

    it('studentName이 없으면 로그에서 제외된다', () => {
      // Given: 학생 이름 없이 로그를 기록하면
      logTimetableChange({
        action: 'class_create',
        subject: 'math',
        className: '수학A반',
        details: '수업 생성',
      });

      // Then: studentName 필드가 없다
      const callArg = (addDoc as any).mock.calls[0][1];
      expect(callArg.studentName).toBeUndefined();
    });

    it('before/after 값이 있으면 로그에 포함된다', () => {
      // Given: 변경 전후 데이터를 포함한 로그를 기록하면
      logTimetableChange({
        action: 'class_update',
        subject: 'math',
        className: '수학A반',
        details: '강의실 변경',
        before: { room: '본원201' },
        after: { room: '본원301' },
      });

      // Then: before와 after가 로그에 포함된다
      const callArg = (addDoc as any).mock.calls[0][1];
      expect(callArg.before).toEqual({ room: '본원201' });
      expect(callArg.after).toEqual({ room: '본원301' });
    });

    it('before/after에 undefined 값이 있으면 해당 필드를 제거한다', () => {
      // Given: undefined 값이 있는 before 데이터를 전달하면
      logTimetableChange({
        action: 'class_update',
        subject: 'math',
        className: '수학A반',
        details: '변경',
        before: { room: '본원201', note: undefined },
      });

      // Then: undefined 필드가 제거된다
      const callArg = (addDoc as any).mock.calls[0][1];
      expect(callArg.before).toEqual({ room: '본원201' });
      expect(callArg.before.note).toBeUndefined();
    });
  });

  describe('fire-and-forget 방식', () => {
    it('addDoc 실패 시 에러를 던지지 않는다', () => {
      // Given: addDoc이 실패하도록 설정하면
      (addDoc as any).mockRejectedValue(new Error('Firestore 오류'));

      // When: 로그를 기록하면 (에러가 전파되지 않아야 한다)
      expect(() => {
        logTimetableChange({
          action: 'class_create',
          subject: 'math',
          className: '수학A반',
          details: '수업 생성',
        });
      }).not.toThrow();
    });
  });

  describe('TimetableLogAction 타입', () => {
    const validActions: TimetableLogAction[] = [
      'class_create', 'class_update', 'class_delete',
      'student_enroll', 'student_unenroll', 'student_transfer',
      'student_withdraw', 'enrollment_update', 'english_move',
    ];

    it.each(validActions)('action "%s"으로 로그를 기록할 수 있다', (action) => {
      logTimetableChange({
        action,
        subject: 'math',
        className: '수학A반',
        details: `${action} 테스트`,
      });

      expect(addDoc).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();
    });
  });
});
