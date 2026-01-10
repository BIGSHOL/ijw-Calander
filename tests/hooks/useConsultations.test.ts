import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useConsultations } from '../../hooks/useConsultations';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// Mock Firebase Firestore
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
  Timestamp: vi.fn(),
}));

// Mock Firebase app
vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date, formatStr) => {
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0];
    }
    return date.toString();
  }),
}));

describe('useConsultations Hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  const mockConsultations = [
    {
      id: 'consult1',
      studentId: 'student1',
      studentName: '김철수',
      consultationType: 'parent-meeting' as const,
      consultationDate: '2026-01-10',
      content: '학습 진도 상담',
      counselor: '김선생',
      createdAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'consult2',
      studentId: 'student2',
      studentName: '이영희',
      consultationType: 'phone-call' as const,
      consultationDate: '2026-01-08',
      content: '출석 관련 상담',
      counselor: '이선생',
      createdAt: '2026-01-08T14:00:00Z',
    },
    {
      id: 'consult3',
      studentId: 'student1',
      studentName: '김철수',
      consultationType: 'online' as const,
      consultationDate: '2025-12-20',
      content: '성적 관련 상담',
      counselor: '박선생',
      createdAt: '2025-12-20T16:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (collection as any).mockReturnValue({});
    (query as any).mockImplementation((...args) => args[0]);
    (orderBy as any).mockReturnValue({});
  });

  describe('Fetching All Consultations', () => {
    it('should fetch all consultations when no filters applied', async () => {
      const mockDocs = mockConsultations.map((consultation) => ({
        id: consultation.id,
        data: () => consultation,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(3);
    });

    it('should return empty array when no consultations exist', async () => {
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });

      const { result } = renderHook(() => useConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('Filtering by Year', () => {
    it('should filter consultations by year (2026)', async () => {
      const mockDocs = mockConsultations.map((consultation) => ({
        id: consultation.id,
        data: () => consultation,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useConsultations({ year: 2026, month: 'all' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      // Should only have 2026 consultations
      result.current.data?.forEach((consultation) => {
        const year = new Date(consultation.consultationDate).getFullYear();
        expect(year).toBe(2026);
      });
    });

    it('should filter consultations by year (2025)', async () => {
      const mockDocs = mockConsultations.map((consultation) => ({
        id: consultation.id,
        data: () => consultation,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useConsultations({ year: 2025, month: 'all' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      // Should only have 2025 consultations
      result.current.data?.forEach((consultation) => {
        const year = new Date(consultation.consultationDate).getFullYear();
        expect(year).toBe(2025);
      });
    });
  });

  describe('Filtering by Month', () => {
    it('should filter consultations by year and month', async () => {
      const mockDocs = mockConsultations.map((consultation) => ({
        id: consultation.id,
        data: () => consultation,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useConsultations({ year: 2026, month: '1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      // Should only have January 2026 consultations
      result.current.data?.forEach((consultation) => {
        const date = new Date(consultation.consultationDate);
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth() + 1).toBe(1);
      });
    });

    it('should filter consultations by December', async () => {
      const mockDocs = mockConsultations.map((consultation) => ({
        id: consultation.id,
        data: () => consultation,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useConsultations({ year: 2025, month: '12' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      // Should only have December 2025 consultations
      result.current.data?.forEach((consultation) => {
        const date = new Date(consultation.consultationDate);
        expect(date.getFullYear()).toBe(2025);
        expect(date.getMonth() + 1).toBe(12);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors gracefully', async () => {
      const mockError = new Error('Firestore query failed');
      (getDocs as any).mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle invalid dates gracefully', async () => {
      const invalidConsultation = {
        id: 'consult-invalid',
        studentId: 'student1',
        studentName: '김철수',
        consultationType: 'phone-call' as const,
        consultationDate: 'invalid-date',
        content: '테스트',
        counselor: '김선생',
        createdAt: 'invalid-date',
      };

      const mockDocs = [invalidConsultation].map((consultation) => ({
        id: consultation.id,
        data: () => consultation,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useConsultations({ year: 2026, month: '1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should filter out invalid dates
      expect(result.current.data).toEqual([]);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache results with 5 minute staleTime', async () => {
      const mockDocs = mockConsultations.map((consultation) => ({
        id: consultation.id,
        data: () => consultation,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result, rerender } = renderHook(() => useConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstCallCount = (getDocs as any).mock.calls.length;

      // Rerender should use cache, not make another query
      rerender();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not have made additional calls due to caching
      expect((getDocs as any).mock.calls.length).toBe(firstCallCount);
    });
  });
});
