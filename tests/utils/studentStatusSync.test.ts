import { vi } from 'vitest';

// Firebase mock
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', () => ({
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  doc: (...args: any[]) => mockDoc(...args),
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

import {
  syncStudentStatus,
  updateEnrollmentHoldWithSync,
  batchUpdateEnrollmentHoldWithSync,
} from '../../utils/studentStatusSync';

describe('studentStatusSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mockDocRef');
    mockCollection.mockReturnValue('mockCollRef');
    mockQuery.mockReturnValue('mockQuery');
    mockWhere.mockReturnValue('mockWhere');
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('syncStudentStatus', () => {
    it('퇴원 상태는 변경하지 않음', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await syncStudentStatus('s1', 'withdrawn');
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('withdrawn');
      expect(result.reason).toContain('자동 변경하지 않음');
    });

    it('예비 상태는 변경하지 않음', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await syncStudentStatus('s1', 'prospect');
      expect(result.newStatus).toBe('prospect');
    });

    it('prospective 상태는 변경하지 않음', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await syncStudentStatus('s1', 'prospective');
      expect(result.newStatus).toBe('prospective');
    });

    it('활성 enrollments 없으면 상태 유지', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await syncStudentStatus('s1', 'active');
      expect(result.newStatus).toBe('active');
      expect(result.reason).toContain('활성 enrollments 없음');
    });

    it('모든 enrollments가 onHold이면 on_hold로 변경', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ onHold: true }) },
          { data: () => ({ onHold: true }) },
        ],
      });

      const result = await syncStudentStatus('s1', 'active');
      expect(result.newStatus).toBe('on_hold');
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('하나라도 활성이면 active로 변경', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ onHold: true }) },
          { data: () => ({ onHold: false }) },
        ],
      });

      const result = await syncStudentStatus('s1', 'on_hold');
      expect(result.newStatus).toBe('active');
    });

    it('상태 변경 불필요 시 DB 업데이트 안함', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [{ data: () => ({ onHold: false }) }],
      });

      const result = await syncStudentStatus('s1', 'active');
      expect(result.reason).toBe('상태 변경 불필요');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('퇴원한 enrollment은 무시', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ onHold: true, withdrawalDate: '2025-01-01' }) },
          { data: () => ({ onHold: false }) },
        ],
      });

      const result = await syncStudentStatus('s1', 'on_hold');
      expect(result.newStatus).toBe('active');
    });

    it('에러 발생 시 실패 결과 반환', async () => {
      mockGetDocs.mockRejectedValue(new Error('DB error'));

      const result = await syncStudentStatus('s1', 'active');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('오류');
    });

    it('currentStudentStatus 미제공 시 DB에서 조회', async () => {
      // 첫 번째 호출: enrollments 조회 (빈 결과)
      // 두 번째 호출: student 문서 조회
      mockGetDocs
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({
          docs: [{ data: () => ({ status: 'active' }) }],
        });

      const result = await syncStudentStatus('s1');
      expect(result.previousStatus).toBe('active');
    });
  });

  describe('updateEnrollmentHoldWithSync', () => {
    it('enrollment onHold 업데이트 후 동기화', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [{ data: () => ({ onHold: true }) }],
      });

      const result = await updateEnrollmentHoldWithSync('s1', 'e1', true, 'active');
      expect(mockUpdateDoc).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('에러 발생 시 실패 결과', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('fail'));

      const result = await updateEnrollmentHoldWithSync('s1', 'e1', true);
      expect(result.success).toBe(false);
    });
  });

  describe('batchUpdateEnrollmentHoldWithSync', () => {
    it('여러 enrollments 일괄 업데이트', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [{ data: () => ({ onHold: true }) }],
      });

      const result = await batchUpdateEnrollmentHoldWithSync('s1', {
        e1: true,
        e2: false,
      }, 'active');
      expect(result.success).toBe(true);
    });

    it('에러 발생 시 실패 결과', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('batch fail'));

      const result = await batchUpdateEnrollmentHoldWithSync('s1', { e1: true });
      expect(result.success).toBe(false);
    });
  });
});