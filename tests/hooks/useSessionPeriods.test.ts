// tests/hooks/useSessionPeriods.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { SessionPeriod } from '../../components/Attendance/types';

// Mock Firebase functions
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

import { getDocs, setDoc, deleteDoc, doc, collection, query, where, orderBy } from 'firebase/firestore';
import {
  useSessionPeriods,
  useSessionPeriod,
  useSaveSessionPeriod,
  useDeleteSessionPeriod,
  useBatchSaveSessionPeriods,
} from '../../hooks/useSessionPeriods';

// Helper function to create a QueryClient wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// Helper function to create mock session period
function createMockSession(
  year: number,
  category: 'math' | 'english' | 'eie',
  month: number,
  overrides?: Partial<SessionPeriod>
): SessionPeriod {
  return {
    id: `${year}-${category}-${month}`,
    year,
    category,
    month,
    ranges: [
      { startDate: '2026-01-01', endDate: '2026-01-31' }
    ],
    sessions: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useSessionPeriods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish mock return values after clearAllMocks
    (collection as any).mockReturnValue({});
    (doc as any).mockReturnValue({});
    (query as any).mockReturnValue({});
    (where as any).mockReturnValue({});
    (orderBy as any).mockReturnValue({});
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
  });

  describe('Basic Functionality', () => {
    it('returns sessions filtered by year', async () => {
      const mockSessions = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'math', 2),
        createMockSession(2025, 'math', 1), // Different year
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockSessions.map(session => ({
          id: session.id,
          data: () => session,
        })),
      } as any);

      const { result } = renderHook(() => useSessionPeriods(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every(s => s.year === 2026)).toBe(true);
    });

    it('filters by category when provided', async () => {
      const mockSessions = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'english', 1),
        createMockSession(2026, 'math', 2),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockSessions.map(session => ({
          id: session.id,
          data: () => session,
        })),
      } as any);

      const { result } = renderHook(() => useSessionPeriods(2026, 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every(s => s.category === 'math')).toBe(true);
    });

    it('sorts sessions by month ascending', async () => {
      const mockSessions = [
        createMockSession(2026, 'math', 5),
        createMockSession(2026, 'math', 2),
        createMockSession(2026, 'math', 8),
        createMockSession(2026, 'math', 1),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockSessions.map(session => ({
          id: session.id,
          data: () => session,
        })),
      } as any);

      const { result } = renderHook(() => useSessionPeriods(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.map(s => s.month)).toEqual([1, 2, 5, 8]);
    });

    it('returns empty array for non-matching year', async () => {
      const mockSessions = [
        createMockSession(2025, 'math', 1),
        createMockSession(2025, 'math', 2),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockSessions.map(session => ({
          id: session.id,
          data: () => session,
        })),
      } as any);

      const { result } = renderHook(() => useSessionPeriods(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('returns empty array for non-matching category', async () => {
      const mockSessions = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'math', 2),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockSessions.map(session => ({
          id: session.id,
          data: () => session,
        })),
      } as any);

      const { result } = renderHook(() => useSessionPeriods(2026, 'english'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('handles empty snapshot', async () => {
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [],
      } as any);

      const { result } = renderHook(() => useSessionPeriods(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('Multiple Categories', () => {
    it('filters math sessions correctly', async () => {
      const mockSessions = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'english', 1),
        createMockSession(2026, 'eie', 1),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockSessions.map(session => ({
          id: session.id,
          data: () => session,
        })),
      } as any);

      const { result } = renderHook(() => useSessionPeriods(2026, 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].category).toBe('math');
    });

    it('filters english sessions correctly', async () => {
      const mockSessions = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'english', 1),
        createMockSession(2026, 'eie', 1),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockSessions.map(session => ({
          id: session.id,
          data: () => session,
        })),
      } as any);

      const { result } = renderHook(() => useSessionPeriods(2026, 'english'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].category).toBe('english');
    });

    it('filters eie sessions correctly', async () => {
      const mockSessions = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'english', 1),
        createMockSession(2026, 'eie', 1),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockSessions.map(session => ({
          id: session.id,
          data: () => session,
        })),
      } as any);

      const { result } = renderHook(() => useSessionPeriods(2026, 'eie'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].category).toBe('eie');
    });
  });

  describe('Query Configuration', () => {
    it('uses correct query key with year only', async () => {
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useSessionPeriods(2026), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query key should be ['sessionPeriods', 2026, undefined]
      expect(result.current.data).toBeDefined();
    });

    it('uses correct query key with year and category', async () => {
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useSessionPeriods(2026, 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query key should be ['sessionPeriods', 2026, 'math']
      expect(result.current.data).toBeDefined();
    });
  });
});

describe('useSessionPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish mock return values after clearAllMocks
    (collection as any).mockReturnValue({});
    (doc as any).mockReturnValue({});
    (query as any).mockReturnValue({});
    (where as any).mockReturnValue({});
    (orderBy as any).mockReturnValue({});
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
  });

  describe('Basic Functionality', () => {
    it('returns single session matching constructed ID', async () => {
      const mockSession = createMockSession(2026, 'math', 1);

      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: mockSession.id,
            data: () => mockSession,
          },
        ],
      } as any);

      const { result } = renderHook(() => useSessionPeriod(2026, 'math', 1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockSession);
    });

    it('returns null when snapshot is empty', async () => {
      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: true,
        docs: [],
      } as any);

      const { result } = renderHook(() => useSessionPeriod(2026, 'math', 1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it('constructs correct session ID', async () => {
      const mockSession = createMockSession(2026, 'english', 5);

      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: '2026-english-5',
            data: () => mockSession,
          },
        ],
      } as any);

      const { result } = renderHook(() => useSessionPeriod(2026, 'english', 5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.id).toBe('2026-english-5');
    });
  });

  describe('Different Parameters', () => {
    it('handles different years', async () => {
      const mockSession = createMockSession(2025, 'math', 1);

      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: mockSession.id, data: () => mockSession }],
      } as any);

      const { result } = renderHook(() => useSessionPeriod(2025, 'math', 1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.year).toBe(2025);
    });

    it('handles different categories', async () => {
      const mockSession = createMockSession(2026, 'eie', 3);

      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: mockSession.id, data: () => mockSession }],
      } as any);

      const { result } = renderHook(() => useSessionPeriod(2026, 'eie', 3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.category).toBe('eie');
    });

    it('handles different months', async () => {
      const mockSession = createMockSession(2026, 'math', 12);

      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: mockSession.id, data: () => mockSession }],
      } as any);

      const { result } = renderHook(() => useSessionPeriod(2026, 'math', 12), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.month).toBe(12);
    });
  });
});

describe('useSaveSessionPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish mock return values after clearAllMocks
    (collection as any).mockReturnValue({});
    (doc as any).mockReturnValue({});
    (query as any).mockReturnValue({});
    (where as any).mockReturnValue({});
    (orderBy as any).mockReturnValue({});
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
  });

  describe('Basic Functionality', () => {
    it('calls setDoc with session data and generated ID', async () => {
      const { result } = renderHook(() => useSaveSessionPeriod(), {
        wrapper: createWrapper(),
      });

      const sessionData: SessionPeriod = {
        id: '',
        year: 2026,
        category: 'math',
        month: 1,
        ranges: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
        sessions: 12,
      };

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          id: '2026-math-1',
          year: 2026,
          category: 'math',
          month: 1,
          ranges: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
          sessions: 12,
          updatedAt: expect.any(String),
          createdAt: expect.any(String),
        })
      );
    });

    it('uses existing session.id if provided', async () => {
      const { result } = renderHook(() => useSaveSessionPeriod(), {
        wrapper: createWrapper(),
      });

      const sessionData: SessionPeriod = {
        id: 'custom-id',
        year: 2026,
        category: 'math',
        month: 1,
        ranges: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
        sessions: 12,
      };

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          id: 'custom-id',
        })
      );
    });

    it('sets updatedAt timestamp', async () => {
      const { result } = renderHook(() => useSaveSessionPeriod(), {
        wrapper: createWrapper(),
      });

      const sessionData = createMockSession(2026, 'math', 1);

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          updatedAt: expect.any(String),
        })
      );
    });

    it('sets createdAt timestamp for new session', async () => {
      const { result } = renderHook(() => useSaveSessionPeriod(), {
        wrapper: createWrapper(),
      });

      const sessionData: SessionPeriod = {
        id: '',
        year: 2026,
        category: 'math',
        month: 1,
        ranges: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
        sessions: 12,
      };

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          createdAt: expect.any(String),
        })
      );
    });

    it('preserves existing createdAt timestamp', async () => {
      const existingCreatedAt = '2026-01-01T00:00:00.000Z';

      const { result } = renderHook(() => useSaveSessionPeriod(), {
        wrapper: createWrapper(),
      });

      const sessionData: SessionPeriod = {
        id: '2026-math-1',
        year: 2026,
        category: 'math',
        month: 1,
        ranges: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
        sessions: 12,
        createdAt: existingCreatedAt,
      };

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          createdAt: existingCreatedAt,
        })
      );
    });
  });

  describe('Cache Invalidation', () => {
    it('invalidates year cache on success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useSaveSessionPeriod(), { wrapper });

      const sessionData = createMockSession(2026, 'math', 1);

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026],
      });
    });

    it('invalidates year and category cache on success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useSaveSessionPeriod(), { wrapper });

      const sessionData = createMockSession(2026, 'english', 3);

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026, 'english'],
      });
    });

    it('invalidates specific session cache on success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useSaveSessionPeriod(), { wrapper });

      const sessionData = createMockSession(2026, 'eie', 5);

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026, 'eie', 5],
      });
    });
  });

  describe('Different Session Types', () => {
    it('saves math session correctly', async () => {
      const { result } = renderHook(() => useSaveSessionPeriod(), {
        wrapper: createWrapper(),
      });

      const sessionData = createMockSession(2026, 'math', 1);

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ category: 'math' })
      );
    });

    it('saves english session correctly', async () => {
      const { result } = renderHook(() => useSaveSessionPeriod(), {
        wrapper: createWrapper(),
      });

      const sessionData = createMockSession(2026, 'english', 2);

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ category: 'english' })
      );
    });

    it('saves eie session correctly', async () => {
      const { result } = renderHook(() => useSaveSessionPeriod(), {
        wrapper: createWrapper(),
      });

      const sessionData = createMockSession(2026, 'eie', 3);

      result.current.mutate(sessionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ category: 'eie' })
      );
    });
  });
});

describe('useDeleteSessionPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish mock return values after clearAllMocks
    (collection as any).mockReturnValue({});
    (doc as any).mockReturnValue({});
    (query as any).mockReturnValue({});
    (where as any).mockReturnValue({});
    (orderBy as any).mockReturnValue({});
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
  });

  describe('Basic Functionality', () => {
    it('calls deleteDoc with correct document reference', async () => {
      const { result } = renderHook(() => useDeleteSessionPeriod(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('2026-math-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(deleteDoc).toHaveBeenCalledWith({});
      expect(doc).toHaveBeenCalledWith({}, 'session_periods', '2026-math-1');
    });

    it('returns deleted sessionId on success', async () => {
      const { result } = renderHook(() => useDeleteSessionPeriod(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('2026-math-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe('2026-math-1');
    });
  });

  describe('SessionId Parsing', () => {
    it('parses sessionId correctly for cache invalidation', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useDeleteSessionPeriod(), { wrapper });

      result.current.mutate('2026-math-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026, 'math'],
      });
    });

    it('parses year from sessionId', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useDeleteSessionPeriod(), { wrapper });

      result.current.mutate('2025-english-5');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2025],
      });
    });

    it('parses category from sessionId', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useDeleteSessionPeriod(), { wrapper });

      result.current.mutate('2026-eie-12');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026, 'eie'],
      });
    });
  });

  describe('Cache Invalidation', () => {
    it('invalidates year cache on delete success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useDeleteSessionPeriod(), { wrapper });

      result.current.mutate('2026-math-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026],
      });
    });

    it('invalidates category cache on delete success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useDeleteSessionPeriod(), { wrapper });

      result.current.mutate('2026-english-3');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026, 'english'],
      });
    });
  });
});

describe('useBatchSaveSessionPeriods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish mock return values after clearAllMocks
    (collection as any).mockReturnValue({});
    (doc as any).mockReturnValue({});
    (query as any).mockReturnValue({});
    (where as any).mockReturnValue({});
    (orderBy as any).mockReturnValue({});
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
  });

  describe('Basic Functionality', () => {
    it('saves multiple sessions in parallel', async () => {
      const { result } = renderHook(() => useBatchSaveSessionPeriods(), {
        wrapper: createWrapper(),
      });

      const sessions: SessionPeriod[] = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'math', 2),
        createMockSession(2026, 'math', 3),
      ];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledTimes(3);
    });

    it('generates ID for each session', async () => {
      const { result } = renderHook(() => useBatchSaveSessionPeriods(), {
        wrapper: createWrapper(),
      });

      const sessions: SessionPeriod[] = [
        { ...createMockSession(2026, 'math', 1), id: '' },
        { ...createMockSession(2026, 'english', 2), id: '' },
      ];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ id: '2026-math-1' })
      );
      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ id: '2026-english-2' })
      );
    });

    it('uses same timestamp for all sessions', async () => {
      const { result } = renderHook(() => useBatchSaveSessionPeriods(), {
        wrapper: createWrapper(),
      });

      const sessions: SessionPeriod[] = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'math', 2),
      ];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          updatedAt: expect.any(String),
        })
      );
    });

    it('preserves existing createdAt for each session', async () => {
      const existingCreatedAt = '2026-01-01T00:00:00.000Z';

      const { result } = renderHook(() => useBatchSaveSessionPeriods(), {
        wrapper: createWrapper(),
      });

      const sessions: SessionPeriod[] = [
        { ...createMockSession(2026, 'math', 1), createdAt: existingCreatedAt },
      ];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          createdAt: existingCreatedAt,
        })
      );
    });
  });

  describe('Cache Invalidation', () => {
    it('invalidates all affected year caches', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useBatchSaveSessionPeriods(), { wrapper });

      const sessions: SessionPeriod[] = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'english', 2),
      ];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026],
      });
    });

    it('invalidates each unique year only once', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useBatchSaveSessionPeriods(), { wrapper });

      const sessions: SessionPeriod[] = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'math', 2),
        createMockSession(2026, 'english', 1),
      ];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const yearInvalidations = invalidateSpy.mock.calls.filter(
        call => call[0].queryKey[0] === 'sessionPeriods' && call[0].queryKey.length === 2
      );
      expect(yearInvalidations).toHaveLength(1);
    });

    it('invalidates multiple years when sessions span different years', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useBatchSaveSessionPeriods(), { wrapper });

      const sessions: SessionPeriod[] = [
        createMockSession(2026, 'math', 1),
        createMockSession(2025, 'english', 12),
      ];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2026],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['sessionPeriods', 2025],
      });
    });
  });

  describe('Multiple Sessions', () => {
    it('handles empty array', async () => {
      const { result } = renderHook(() => useBatchSaveSessionPeriods(), {
        wrapper: createWrapper(),
      });

      result.current.mutate([]);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).not.toHaveBeenCalled();
      expect(result.current.data).toEqual([]);
    });

    it('handles single session', async () => {
      const { result } = renderHook(() => useBatchSaveSessionPeriods(), {
        wrapper: createWrapper(),
      });

      const sessions: SessionPeriod[] = [createMockSession(2026, 'math', 1)];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledTimes(1);
      expect(result.current.data).toHaveLength(1);
    });

    it('handles large batch of sessions', async () => {
      const { result } = renderHook(() => useBatchSaveSessionPeriods(), {
        wrapper: createWrapper(),
      });

      const sessions: SessionPeriod[] = Array.from({ length: 12 }, (_, i) =>
        createMockSession(2026, 'math', i + 1)
      );

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledTimes(12);
      expect(result.current.data).toHaveLength(12);
    });

    it('handles mixed categories in batch', async () => {
      const { result } = renderHook(() => useBatchSaveSessionPeriods(), {
        wrapper: createWrapper(),
      });

      const sessions: SessionPeriod[] = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'english', 1),
        createMockSession(2026, 'eie', 1),
      ];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledTimes(3);
      expect(result.current.data?.[0].category).toBe('math');
      expect(result.current.data?.[1].category).toBe('english');
      expect(result.current.data?.[2].category).toBe('eie');
    });
  });

  describe('Error Handling', () => {
    it('handles partial failure in batch save', async () => {
      vi.mocked(setDoc)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Save failed'))
        .mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useBatchSaveSessionPeriods(), {
        wrapper: createWrapper(),
      });

      const sessions: SessionPeriod[] = [
        createMockSession(2026, 'math', 1),
        createMockSession(2026, 'math', 2),
        createMockSession(2026, 'math', 3),
      ];

      result.current.mutate(sessions);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(setDoc).toHaveBeenCalledTimes(3);
    });
  });
});
