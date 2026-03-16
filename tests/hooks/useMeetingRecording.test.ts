import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import {
  useMeetingReports,
  useUpdateMeetingReportTitle,
  useReanalyzeMeetingReport,
  useDeleteMeetingReport,
  useMeetingReportStatus,
  useUploadMeetingRecording,
} from '../../hooks/useMeetingRecording';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  setDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytesResumable: vi.fn(),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn().mockReturnValue({}),
  httpsCallable: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({ data: { reportId: 'test-id', status: 'ok' } })),
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn().mockReturnValue({}),
}));

vi.mock('../../firebaseConfig', () => ({ db: {}, storage: {} }));

describe('useMeetingRecording', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  describe('useMeetingReports', () => {
    it('hook 초기화 — queryKey가 meeting_reports여야 함', () => {
      const { result } = renderHook(() => useMeetingReports(), {
        wrapper: createWrapper(),
      });
      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('useUpdateMeetingReportTitle', () => {
    it('hook 초기화', () => {
      const { result } = renderHook(() => useUpdateMeetingReportTitle(), {
        wrapper: createWrapper(),
      });
      expect(result.current.mutateAsync).toBeDefined();
      expect(result.current.isIdle).toBe(true);
    });
  });

  describe('useReanalyzeMeetingReport', () => {
    it('hook 초기화', () => {
      const { result } = renderHook(() => useReanalyzeMeetingReport(), {
        wrapper: createWrapper(),
      });
      expect(result.current.mutateAsync).toBeDefined();
      expect(result.current.isIdle).toBe(true);
    });
  });

  describe('useDeleteMeetingReport', () => {
    it('hook 초기화', () => {
      const { result } = renderHook(() => useDeleteMeetingReport(), {
        wrapper: createWrapper(),
      });
      expect(result.current.mutateAsync).toBeDefined();
      expect(result.current.isIdle).toBe(true);
    });
  });

  describe('useMeetingReportStatus', () => {
    it('reportId가 null이면 report가 null이어야 함', () => {
      const { result } = renderHook(() => useMeetingReportStatus(null));
      expect(result.current.report).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useUploadMeetingRecording', () => {
    it('초기 상태는 업로드 중이 아니어야 함', () => {
      const { result } = renderHook(() => useUploadMeetingRecording());
      expect(result.current.isUploading).toBe(false);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.uploadProgress).toBeNull();
      expect(result.current.uploadAndProcess).toBeDefined();
    });
  });
});
