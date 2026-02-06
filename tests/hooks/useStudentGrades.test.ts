import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useStudentScores,
  useAddScore,
  useUpdateScore,
  useDeleteScore,
  calculateScoreStats,
} from '../../hooks/useStudentGrades';
import { StudentScore } from '../../types';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  Timestamp: { fromDate: vi.fn((d: Date) => ({ toDate: () => d })) },
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Mock calculateGrade from types
vi.mock('../../types', async () => {
  const actual = await vi.importActual('../../types');
  return {
    ...actual,
    calculateGrade: vi.fn((pct: number) => {
      if (pct >= 97) return 'A+';
      if (pct >= 93) return 'A';
      if (pct >= 90) return 'A-';
      if (pct >= 87) return 'B+';
      if (pct >= 83) return 'B';
      if (pct >= 80) return 'B-';
      if (pct >= 77) return 'C+';
      if (pct >= 73) return 'C';
      if (pct >= 70) return 'C-';
      if (pct >= 67) return 'D+';
      if (pct >= 60) return 'D';
      return 'F';
    }),
  };
});

import { getDocs, addDoc, updateDoc, deleteDoc, doc, collection, query, where } from 'firebase/firestore';
import { calculateGrade } from '../../types';

// Helper function to create QueryClient wrapper
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

// Mock student score data
const createMockScore = (overrides: Partial<StudentScore> = {}): StudentScore => ({
  id: 'score-1',
  studentId: 'student-1',
  studentName: '홍길동',
  examId: 'exam-1',
  examTitle: '중간고사',
  subject: 'math',
  score: 85,
  maxScore: 100,
  percentage: 85,
  grade: 'B',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'teacher-1',
  createdByName: '김선생',
  ...overrides,
});

describe('useStudentScores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches scores for a given studentId', async () => {
    const mockScores = [
      createMockScore({ id: 'score-1', score: 90, createdAt: 3000 }),
      createMockScore({ id: 'score-2', score: 80, createdAt: 2000 }),
      createMockScore({ id: 'score-3', score: 70, createdAt: 1000 }),
    ];

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockScores.map(score => ({
        id: score.id,
        data: () => ({ ...score }),
      })),
    } as any);

    const { result } = renderHook(() => useStudentScores('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getDocs).toHaveBeenCalled();
    expect(query).toHaveBeenCalled();
    expect(where).toHaveBeenCalledWith('studentId', '==', 'student-1');
    expect(result.current.data).toHaveLength(3);
  });

  it('sorts scores by createdAt descending (newest first)', async () => {
    const mockScores = [
      createMockScore({ id: 'score-1', score: 70, createdAt: 1000 }),
      createMockScore({ id: 'score-2', score: 90, createdAt: 3000 }),
      createMockScore({ id: 'score-3', score: 80, createdAt: 2000 }),
    ];

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockScores.map(score => ({
        id: score.id,
        data: () => ({ ...score }),
      })),
    } as any);

    const { result } = renderHook(() => useStudentScores('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const scores = result.current.data!;
    expect(scores[0].id).toBe('score-2'); // createdAt: 3000
    expect(scores[1].id).toBe('score-3'); // createdAt: 2000
    expect(scores[2].id).toBe('score-1'); // createdAt: 1000
  });

  it('filters scores by subject when provided', async () => {
    const mockScores = [
      createMockScore({ id: 'score-1', subject: 'math', createdAt: 3000 }),
      createMockScore({ id: 'score-2', subject: 'english', createdAt: 2000 }),
      createMockScore({ id: 'score-3', subject: 'math', createdAt: 1000 }),
    ];

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockScores.map(score => ({
        id: score.id,
        data: () => ({ ...score }),
      })),
    } as any);

    const { result } = renderHook(() => useStudentScores('student-1', 'math'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const scores = result.current.data!;
    expect(scores).toHaveLength(2);
    expect(scores.every(s => s.subject === 'math')).toBe(true);
  });

  it('does not filter when subject is not provided', async () => {
    const mockScores = [
      createMockScore({ id: 'score-1', subject: 'math' }),
      createMockScore({ id: 'score-2', subject: 'english' }),
    ];

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockScores.map(score => ({
        id: score.id,
        data: () => ({ ...score }),
      })),
    } as any);

    const { result } = renderHook(() => useStudentScores('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it('is disabled when studentId is empty', () => {
    const { result } = renderHook(() => useStudentScores(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('returns empty array when studentId is empty string (after enabled)', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [],
    } as any);

    const { result, rerender } = renderHook(
      ({ studentId }) => useStudentScores(studentId),
      {
        wrapper: createWrapper(),
        initialProps: { studentId: 'student-1' },
      }
    );

    // Initially enabled
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Change to empty studentId
    rerender({ studentId: '' });

    // Should be disabled now
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns empty array when no scores found', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [],
    } as any);

    const { result } = renderHook(() => useStudentScores('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('handles missing createdAt field gracefully', async () => {
    const mockScores = [
      createMockScore({ id: 'score-1', createdAt: 2000 }),
      createMockScore({ id: 'score-2', createdAt: 0 }), // Missing/falsy
      createMockScore({ id: 'score-3', createdAt: 3000 }),
    ];

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockScores.map(score => ({
        id: score.id,
        data: () => ({ ...score }),
      })),
    } as any);

    const { result } = renderHook(() => useStudentScores('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const scores = result.current.data!;
    expect(scores).toHaveLength(3);
    expect(scores[0].id).toBe('score-3'); // 3000
    expect(scores[1].id).toBe('score-1'); // 2000
    expect(scores[2].id).toBe('score-2'); // 0
  });

  it('includes score id from document id', async () => {
    const mockScore = createMockScore({ score: 95 });
    delete (mockScore as any).id; // Remove id from data

    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: 'doc-id-123',
          data: () => mockScore,
        },
      ],
    } as any);

    const { result } = renderHook(() => useStudentScores('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data![0].id).toBe('doc-id-123');
  });

  it('handles query errors', async () => {
    vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

    const { result } = renderHook(() => useStudentScores('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('Firestore error'));
  });
});

describe('useAddScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a new score with calculated percentage and grade', async () => {
    const mockDocRef = { id: 'new-score-id' };
    vi.mocked(addDoc).mockResolvedValue(mockDocRef as any);

    const { result } = renderHook(() => useAddScore(), {
      wrapper: createWrapper(),
    });

    const newScoreData: Omit<StudentScore, 'id' | 'createdAt' | 'updatedAt'> = {
      studentId: 'student-1',
      studentName: '홍길동',
      examId: 'exam-1',
      examTitle: '중간고사',
      subject: 'math',
      score: 90,
      maxScore: 100,
      createdBy: 'teacher-1',
      createdByName: '김선생',
    };

    result.current.mutate(newScoreData);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(addDoc).toHaveBeenCalled();
    expect(collection).toHaveBeenCalled();

    const addDocCall = vi.mocked(addDoc).mock.calls[0][1];
    expect(addDocCall).toMatchObject({
      ...newScoreData,
      percentage: 90,
      grade: 'A-',
    });
    expect(addDocCall.createdAt).toBeDefined();
    expect(addDocCall.updatedAt).toBeDefined();
  });

  it('calculates percentage correctly (85/100 = 85%)', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);

    const { result } = renderHook(() => useAddScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math',
      score: 85,
      maxScore: 100,
      createdBy: 'teacher-1',
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const addDocCall = vi.mocked(addDoc).mock.calls[0][1];
    expect(addDocCall.percentage).toBe(85);
  });

  it('calculates grade using calculateGrade function', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);

    const { result } = renderHook(() => useAddScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math',
      score: 95,
      maxScore: 100,
      createdBy: 'teacher-1',
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calculateGrade).toHaveBeenCalledWith(95);
    const addDocCall = vi.mocked(addDoc).mock.calls[0][1];
    expect(addDocCall.grade).toBe('A');
  });

  it('invalidates student_scores cache on success', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useAddScore(), { wrapper });

    result.current.mutate({
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math',
      score: 85,
      maxScore: 100,
      createdBy: 'teacher-1',
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['student_scores', 'student-1'] });
  });

  it('invalidates all_scores cache on success', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useAddScore(), { wrapper });

    result.current.mutate({
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math',
      score: 85,
      maxScore: 100,
      createdBy: 'teacher-1',
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['all_scores'] });
  });

  it('invalidates exam_scores cache on success', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useAddScore(), { wrapper });

    result.current.mutate({
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math',
      score: 85,
      maxScore: 100,
      createdBy: 'teacher-1',
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['exam_scores'] });
  });

  it('invalidates exams cache on success', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useAddScore(), { wrapper });

    result.current.mutate({
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math',
      score: 85,
      maxScore: 100,
      createdBy: 'teacher-1',
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['exams'] });
  });

  it('handles add errors', async () => {
    vi.mocked(addDoc).mockRejectedValue(new Error('Add failed'));

    const { result } = renderHook(() => useAddScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math',
      score: 85,
      maxScore: 100,
      createdBy: 'teacher-1',
    } as any);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('Add failed'));
  });

  it('returns added score data with id', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-score-123' } as any);

    const { result } = renderHook(() => useAddScore(), {
      wrapper: createWrapper(),
    });

    const scoreData = {
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math' as const,
      score: 88,
      maxScore: 100,
      createdBy: 'teacher-1',
    };

    result.current.mutate(scoreData as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe('new-score-123');
    expect(result.current.data?.score).toBe(88);
    expect(result.current.data?.percentage).toBe(88);
  });

  it('handles perfect score (100/100)', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);

    const { result } = renderHook(() => useAddScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math',
      score: 100,
      maxScore: 100,
      createdBy: 'teacher-1',
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const addDocCall = vi.mocked(addDoc).mock.calls[0][1];
    expect(addDocCall.percentage).toBe(100);
    expect(calculateGrade).toHaveBeenCalledWith(100);
  });

  it('handles low score (50/100)', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);

    const { result } = renderHook(() => useAddScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      studentId: 'student-1',
      examId: 'exam-1',
      subject: 'math',
      score: 50,
      maxScore: 100,
      createdBy: 'teacher-1',
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const addDocCall = vi.mocked(addDoc).mock.calls[0][1];
    expect(addDocCall.percentage).toBe(50);
    expect(calculateGrade).toHaveBeenCalledWith(50);
  });
});

describe('useUpdateScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates score with recalculated percentage and grade', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'score-1',
      updates: {
        score: 95,
        maxScore: 100,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(doc).toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalled();

    const updateDocCall = vi.mocked(updateDoc).mock.calls[0][1];
    expect(updateDocCall.score).toBe(95);
    expect(updateDocCall.maxScore).toBe(100);
    expect(updateDocCall.percentage).toBe(95);
    expect(updateDocCall.grade).toBe('A');
  });

  it('recalculates only when both score and maxScore are provided', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'score-1',
      updates: {
        score: 95,
        maxScore: 100,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const updateDocCall = vi.mocked(updateDoc).mock.calls[0][1];
    expect(updateDocCall.percentage).toBe(95);
    expect(updateDocCall.grade).toBeDefined();
  });

  it('does not recalculate when only score is provided', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'score-1',
      updates: {
        score: 95,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const updateDocCall = vi.mocked(updateDoc).mock.calls[0][1];
    expect(updateDocCall.percentage).toBeUndefined();
    expect(updateDocCall.grade).toBeUndefined();
  });

  it('does not recalculate when only maxScore is provided', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'score-1',
      updates: {
        maxScore: 120,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const updateDocCall = vi.mocked(updateDoc).mock.calls[0][1];
    expect(updateDocCall.percentage).toBeUndefined();
    expect(updateDocCall.grade).toBeUndefined();
  });

  it('updates non-score fields without recalculation', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'score-1',
      updates: {
        memo: '재시험 필요',
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const updateDocCall = vi.mocked(updateDoc).mock.calls[0][1];
    expect(updateDocCall.memo).toBe('재시험 필요');
    expect(updateDocCall.percentage).toBeUndefined();
    expect(updateDocCall.grade).toBeUndefined();
  });

  it('always includes updatedAt timestamp', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);
    const beforeUpdate = Date.now();

    const { result } = renderHook(() => useUpdateScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'score-1',
      updates: {
        memo: '수정',
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const updateDocCall = vi.mocked(updateDoc).mock.calls[0][1];
    expect(updateDocCall.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
  });

  it('invalidates student_scores cache on success', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateScore(), { wrapper });

    result.current.mutate({
      id: 'score-1',
      updates: { score: 90, maxScore: 100 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['student_scores'] });
  });

  it('invalidates exam_scores cache on success', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateScore(), { wrapper });

    result.current.mutate({
      id: 'score-1',
      updates: { score: 90, maxScore: 100 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['exam_scores'] });
  });

  it('invalidates exams cache on success', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateScore(), { wrapper });

    result.current.mutate({
      id: 'score-1',
      updates: { score: 90, maxScore: 100 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['exams'] });
  });

  it('handles update errors', async () => {
    vi.mocked(updateDoc).mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useUpdateScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'score-1',
      updates: { score: 90, maxScore: 100 },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('Update failed'));
  });

  it('returns updated data with id', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'score-123',
      updates: { score: 88, maxScore: 100 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe('score-123');
    expect(result.current.data?.score).toBe(88);
    expect(result.current.data?.percentage).toBe(88);
  });
});

describe('useDeleteScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a score document', async () => {
    vi.mocked(deleteDoc).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('score-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(doc).toHaveBeenCalled();
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('invalidates student_scores cache on success', async () => {
    vi.mocked(deleteDoc).mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteScore(), { wrapper });

    result.current.mutate('score-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['student_scores'] });
  });

  it('invalidates all_scores cache on success', async () => {
    vi.mocked(deleteDoc).mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteScore(), { wrapper });

    result.current.mutate('score-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['all_scores'] });
  });

  it('invalidates exam_scores cache on success', async () => {
    vi.mocked(deleteDoc).mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteScore(), { wrapper });

    result.current.mutate('score-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['exam_scores'] });
  });

  it('invalidates exams cache on success', async () => {
    vi.mocked(deleteDoc).mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteScore(), { wrapper });

    result.current.mutate('score-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['exams'] });
  });

  it('handles delete errors', async () => {
    vi.mocked(deleteDoc).mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => useDeleteScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('score-1');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('Delete failed'));
  });

  it('returns deleted score id', async () => {
    vi.mocked(deleteDoc).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteScore(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('score-to-delete');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe('score-to-delete');
  });
});

describe('calculateScoreStats', () => {
  it('returns default stats for empty scores array', () => {
    const stats = calculateScoreStats([]);

    expect(stats).toEqual({
      averageScore: 0,
      averagePercentage: 0,
      totalExams: 0,
      trend: 'stable',
      highestScore: null,
      lowestScore: null,
    });
  });

  it('calculates correct average for single score', () => {
    const scores = [createMockScore({ score: 85, percentage: 85 })];

    const stats = calculateScoreStats(scores);

    expect(stats.averageScore).toBe(85);
    expect(stats.averagePercentage).toBe(85);
    expect(stats.totalExams).toBe(1);
  });

  it('returns stable trend for single score', () => {
    const scores = [createMockScore({ percentage: 85 })];

    const stats = calculateScoreStats(scores);

    expect(stats.trend).toBe('stable');
  });

  it('calculates correct average for multiple scores', () => {
    const scores = [
      createMockScore({ score: 90, percentage: 90 }),
      createMockScore({ score: 80, percentage: 80 }),
      createMockScore({ score: 70, percentage: 70 }),
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.averageScore).toBe(80);
    expect(stats.averagePercentage).toBe(80);
    expect(stats.totalExams).toBe(3);
  });

  it('identifies highest score correctly', () => {
    const scores = [
      createMockScore({ id: 'score-1', percentage: 85 }),
      createMockScore({ id: 'score-2', percentage: 95 }),
      createMockScore({ id: 'score-3', percentage: 75 }),
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.highestScore?.id).toBe('score-2');
    expect(stats.highestScore?.percentage).toBe(95);
  });

  it('identifies lowest score correctly', () => {
    const scores = [
      createMockScore({ id: 'score-1', percentage: 85 }),
      createMockScore({ id: 'score-2', percentage: 95 }),
      createMockScore({ id: 'score-3', percentage: 75 }),
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.lowestScore?.id).toBe('score-3');
    expect(stats.lowestScore?.percentage).toBe(75);
  });

  it('returns up trend when newest > oldest by more than 5', () => {
    const scores = [
      createMockScore({ id: 'newest', percentage: 90 }), // newest
      createMockScore({ id: 'middle', percentage: 85 }),
      createMockScore({ id: 'oldest', percentage: 80 }), // oldest
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.trend).toBe('up');
  });

  it('returns down trend when newest < oldest by more than 5', () => {
    const scores = [
      createMockScore({ id: 'newest', percentage: 70 }), // newest
      createMockScore({ id: 'middle', percentage: 75 }),
      createMockScore({ id: 'oldest', percentage: 85 }), // oldest
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.trend).toBe('down');
  });

  it('returns stable trend when difference is exactly 5', () => {
    const scores = [
      createMockScore({ percentage: 85 }), // newest
      createMockScore({ percentage: 82 }),
      createMockScore({ percentage: 80 }), // oldest
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.trend).toBe('stable');
  });

  it('returns stable trend when difference is less than 5', () => {
    const scores = [
      createMockScore({ percentage: 83 }), // newest
      createMockScore({ percentage: 82 }),
      createMockScore({ percentage: 80 }), // oldest (diff = 3)
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.trend).toBe('stable');
  });

  it('calculates trend from most recent 3 scores only', () => {
    const scores = [
      createMockScore({ percentage: 90 }), // newest (used)
      createMockScore({ percentage: 85 }), // (used)
      createMockScore({ percentage: 80 }), // oldest of 3 (used)
      createMockScore({ percentage: 50 }), // ignored
      createMockScore({ percentage: 40 }), // ignored
    ];

    const stats = calculateScoreStats(scores);

    // Trend is up (90 - 80 = 10 > 5)
    expect(stats.trend).toBe('up');
  });

  it('uses only 2 scores for trend when less than 3 scores available', () => {
    const scores = [
      createMockScore({ percentage: 90 }), // newest
      createMockScore({ percentage: 80 }), // oldest
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.trend).toBe('up'); // 90 - 80 = 10 > 5
  });

  it('handles missing percentage field (defaults to 0)', () => {
    const scores = [
      createMockScore({ percentage: undefined as any }),
      createMockScore({ percentage: 80 }),
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.averagePercentage).toBe(40); // (0 + 80) / 2
  });

  it('identifies same score as both highest and lowest when only one score', () => {
    const scores = [createMockScore({ id: 'only', percentage: 75 })];

    const stats = calculateScoreStats(scores);

    expect(stats.highestScore?.id).toBe('only');
    expect(stats.lowestScore?.id).toBe('only');
  });

  it('handles all scores with same percentage', () => {
    const scores = [
      createMockScore({ percentage: 80 }),
      createMockScore({ percentage: 80 }),
      createMockScore({ percentage: 80 }),
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.averagePercentage).toBe(80);
    expect(stats.trend).toBe('stable'); // 80 - 80 = 0
  });

  it('calculates average of raw scores correctly', () => {
    const scores = [
      createMockScore({ score: 85, maxScore: 100, percentage: 85 }),
      createMockScore({ score: 90, maxScore: 100, percentage: 90 }),
      createMockScore({ score: 75, maxScore: 100, percentage: 75 }),
    ];

    const stats = calculateScoreStats(scores);

    expect(stats.averageScore).toBe(83.33333333333333); // (85 + 90 + 75) / 3
  });
});
