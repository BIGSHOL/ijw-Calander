/**
 * 성적 프로필 관련 Hooks (Phase 1-5)
 * - 레벨테스트 관리
 * - 목표 점수 관리
 * - 강사 코멘트 관리
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { LevelTest, GoalSetting, GradeComment, GradeCommentCategory, StudentScore } from '../types';

// ============ 컬렉션 상수 ============
const COL_LEVEL_TESTS = 'level_tests';
const COL_GOAL_SETTINGS = 'goal_settings';
const COL_GRADE_COMMENTS = 'grade_comments';

// ============ 레벨테스트 Hooks ============

/**
 * 학생의 레벨테스트 목록 조회
 */
export function useLevelTests(studentId: string | undefined) {
  return useQuery({
    queryKey: ['level_tests', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const q = query(
        collection(db, COL_LEVEL_TESTS),
        where('studentId', '==', studentId),
        orderBy('testDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LevelTest[];
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5, // 5분
  });
}

/**
 * 레벨테스트 추가
 */
export function useAddLevelTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (levelTest: Omit<LevelTest, 'id'>) => {
      const docRef = await addDoc(collection(db, COL_LEVEL_TESTS), levelTest);
      return { id: docRef.id, ...levelTest };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['level_tests', data.studentId] });
    },
  });
}

/**
 * 레벨테스트 수정
 */
export function useUpdateLevelTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LevelTest> }) => {
      const docRef = doc(db, COL_LEVEL_TESTS, id);
      await updateDoc(docRef, { ...updates, updatedAt: Date.now() });
      return { id, updates };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['level_tests'] });
    },
  });
}

/**
 * 레벨테스트 삭제
 */
export function useDeleteLevelTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, studentId }: { id: string; studentId: string }) => {
      await deleteDoc(doc(db, COL_LEVEL_TESTS, id));
      return { id, studentId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['level_tests', data.studentId] });
    },
  });
}

// ============ 목표 점수 Hooks ============

/**
 * 학생의 목표 점수 목록 조회
 */
export function useGoalSettings(studentId: string | undefined) {
  return useQuery({
    queryKey: ['goal_settings', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const q = query(
        collection(db, COL_GOAL_SETTINGS),
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GoalSetting[];
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * 특정 시험의 목표 조회
 */
export function useGoalByExam(studentId: string | undefined, examId: string | undefined) {
  return useQuery({
    queryKey: ['goal_settings', studentId, examId],
    queryFn: async () => {
      if (!studentId || !examId) return null;
      const q = query(
        collection(db, COL_GOAL_SETTINGS),
        where('studentId', '==', studentId),
        where('examId', '==', examId),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as GoalSetting;
    },
    enabled: !!studentId && !!examId,
  });
}

/**
 * 목표 점수 설정
 */
export function useAddGoalSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goal: Omit<GoalSetting, 'id'>) => {
      const docRef = await addDoc(collection(db, COL_GOAL_SETTINGS), goal);
      return { id: docRef.id, ...goal };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['goal_settings', data.studentId] });
    },
  });
}

/**
 * 목표 달성 여부 업데이트 (성적 입력 시 호출)
 */
export function useUpdateGoalAchievement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      goalId,
      actualScore,
      actualPercentage,
      targetScore,
    }: {
      goalId: string;
      actualScore: number;
      actualPercentage: number;
      targetScore: number;
    }) => {
      const achieved = actualScore >= targetScore;
      await updateDoc(doc(db, COL_GOAL_SETTINGS, goalId), {
        actualScore,
        actualPercentage,
        achieved,
        updatedAt: Date.now(),
      });
      return { goalId, achieved };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal_settings'] });
    },
  });
}

/**
 * 목표 삭제
 */
export function useDeleteGoalSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, studentId }: { id: string; studentId: string }) => {
      await deleteDoc(doc(db, COL_GOAL_SETTINGS, id));
      return { id, studentId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['goal_settings', data.studentId] });
    },
  });
}

// ============ 강사 코멘트 Hooks ============

/**
 * 학생의 코멘트 목록 조회
 */
export function useGradeComments(studentId: string | undefined, period?: string) {
  return useQuery({
    queryKey: ['grade_comments', studentId, period],
    queryFn: async () => {
      if (!studentId) return [];
      let q = query(
        collection(db, COL_GRADE_COMMENTS),
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      let comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GradeComment[];

      // 기간 필터 (클라이언트 사이드)
      if (period) {
        comments = comments.filter(c => c.period === period);
      }

      return comments;
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * 최신 코멘트 조회 (카테고리별 1개씩)
 */
export function useLatestComments(studentId: string | undefined) {
  const { data: allComments = [] } = useGradeComments(studentId);

  return useMemo(() => {
    const latestByCategory: Partial<Record<GradeCommentCategory, GradeComment>> = {};

    // 최신순 정렬된 상태에서 카테고리별 첫 번째만 선택
    allComments.forEach(comment => {
      if (!latestByCategory[comment.category]) {
        latestByCategory[comment.category] = comment;
      }
    });

    return latestByCategory;
  }, [allComments]);
}

/**
 * 코멘트 추가
 */
export function useAddGradeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (comment: Omit<GradeComment, 'id'>) => {
      const docRef = await addDoc(collection(db, COL_GRADE_COMMENTS), comment);
      return { id: docRef.id, ...comment };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grade_comments', data.studentId] });
    },
  });
}

/**
 * 코멘트 수정
 */
export function useUpdateGradeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GradeComment> }) => {
      await updateDoc(doc(db, COL_GRADE_COMMENTS, id), { ...updates, updatedAt: Date.now() });
      return { id, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade_comments'] });
    },
  });
}

/**
 * 코멘트 삭제
 */
export function useDeleteGradeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, studentId }: { id: string; studentId: string }) => {
      await deleteDoc(doc(db, COL_GRADE_COMMENTS, id));
      return { id, studentId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grade_comments', data.studentId] });
    },
  });
}

// ============ 유틸리티 함수 ============

/**
 * 레벨 판정 (점수 기반)
 */
export function determineLevel(subject: 'math' | 'english', percentage: number): string {
  if (subject === 'math') {
    if (percentage >= 90) return '최상급';
    if (percentage >= 80) return '상급';
    if (percentage >= 70) return '중급';
    if (percentage >= 60) return '초급';
    return '기초';
  } else {
    // 영어 레벨
    if (percentage >= 90) return 'LE';
    if (percentage >= 80) return 'RTT';
    if (percentage >= 70) return 'PL';
    if (percentage >= 60) return 'DP';
    return 'Starter';
  }
}

/**
 * 현재 월 문자열 생성
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
