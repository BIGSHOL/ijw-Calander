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
import { ConsultationRecord, SubjectConsultationDetail } from '../types';

// ============ 컬렉션 상수 ============
const COL_LEVEL_TESTS = 'level_tests';
const COL_GOAL_SETTINGS = 'goal_settings';
const COL_GRADE_COMMENTS = 'grade_comments';

// ============ 레벨테스트 Hooks ============

/**
 * 전체 레벨테스트 목록 조회 (과목 필터 지원)
 */
export function useAllLevelTests(subjectFilter?: 'all' | 'math' | 'english') {
  return useQuery({
    queryKey: ['level_tests', 'all', subjectFilter],
    queryFn: async () => {
      let q;
      if (subjectFilter && subjectFilter !== 'all') {
        q = query(
          collection(db, COL_LEVEL_TESTS),
          where('subject', '==', subjectFilter),
          orderBy('testDate', 'desc')
        );
      } else {
        q = query(
          collection(db, COL_LEVEL_TESTS),
          orderBy('testDate', 'desc')
        );
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<LevelTest, 'id'>) })) as LevelTest[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ============ 상담 기반 레벨테스트 Hooks ============

export interface ConsultationLevelTest extends LevelTest {
  _sourceConsultationId: string;
  _sourceDetail: SubjectConsultationDetail;
}

function hasMathLevelTestData(detail?: SubjectConsultationDetail): boolean {
  if (!detail) return false;
  return !!(
    detail.calculationScore || detail.comprehensionScore ||
    detail.reasoningScore || detail.problemSolvingScore ||
    detail.myTotalScore || detail.levelTestScore
  );
}

function hasEnglishLevelTestData(detail?: SubjectConsultationDetail): boolean {
  if (!detail) return false;
  return !!(detail.englishTestType || detail.engLevel || detail.levelTestScore);
}

/** Firestore Timestamp 또는 문자열을 안전하게 문자열로 변환 */
function toSafeString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') {
    // Firestore Timestamp
    const d = val.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return String(val);
}

/** Firestore Timestamp 또는 문자열을 안전하게 숫자(ms)로 변환 */
function toSafeTimestamp(val: any): number {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  const d = new Date(val);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

function consultationToLevelTests(record: ConsultationRecord): ConsultationLevelTest[] {
  const results: ConsultationLevelTest[] = [];
  const baseFields = {
    studentId: record.registeredStudentId || record.id,
    studentName: record.studentName || '',
    testDate: toSafeString(record.consultationDate),
    testType: 'placement' as const,
    evaluatorId: record.authorId || '',
    evaluatorName: record.counselor || '',
    createdAt: toSafeTimestamp(record.createdAt),
    updatedAt: toSafeTimestamp(record.updatedAt),
    _sourceConsultationId: record.id,
  };

  if (hasMathLevelTestData(record.mathConsultation)) {
    const m = record.mathConsultation!;
    results.push({
      ...baseFields,
      id: record.id + '_math',
      subject: 'math',
      calculationScore: m.calculationScore,
      comprehensionScore: m.comprehensionScore,
      reasoningScore: m.reasoningScore,
      problemSolvingScore: m.problemSolvingScore,
      myTotalScore: m.myTotalScore,
      averageScore: m.averageScore,
      scoreGrade: m.scoreGrade,
      percentage: m.levelTestScore ? parseFloat(m.levelTestScore) : undefined,
      _sourceDetail: m,
    });
  }

  if (hasEnglishLevelTestData(record.englishConsultation)) {
    const e = record.englishConsultation!;
    results.push({
      ...baseFields,
      id: record.id + '_english',
      subject: 'english',
      englishTestType: e.englishTestType,
      engLevel: e.engLevel,
      engAiGradeLevel: e.engAiGradeLevel,
      engAiArIndex: e.engAiArIndex,
      engAiTopPercent: e.engAiTopPercent,
      engAiWordMy: e.engAiWordMy,
      engAiWordAvg: e.engAiWordAvg,
      engAiListenMy: e.engAiListenMy,
      engAiListenAvg: e.engAiListenAvg,
      engAiReadMy: e.engAiReadMy,
      engAiReadAvg: e.engAiReadAvg,
      engAiWriteMy: e.engAiWriteMy,
      engAiWriteAvg: e.engAiWriteAvg,
      engNeltOverallLevel: e.engNeltOverallLevel,
      engNeltRank: e.engNeltRank,
      engNeltVocab: e.engNeltVocab,
      engNeltGrammar: e.engNeltGrammar,
      engNeltListening: e.engNeltListening,
      engNeltReading: e.engNeltReading,
      engEieGradeLevel: e.engEieGradeLevel,
      engEieVocabLevel: e.engEieVocabLevel,
      engEieRank: e.engEieRank,
      engEieCourse: e.engEieCourse,
      engEieChartLevel: e.engEieChartLevel,
      engEieTextbook: e.engEieTextbook,
      engEieVocabMy: e.engEieVocabMy,
      engEieVocabAvg: e.engEieVocabAvg,
      engEieListenMy: e.engEieListenMy,
      engEieListenAvg: e.engEieListenAvg,
      engEieReadMy: e.engEieReadMy,
      engEieReadAvg: e.engEieReadAvg,
      engEieGrammarMy: e.engEieGrammarMy,
      engEieGrammarAvg: e.engEieGrammarAvg,
      percentage: e.levelTestScore ? parseFloat(e.levelTestScore) : undefined,
      _sourceDetail: e,
    });
  }

  return results;
}

/**
 * 전체 상담에서 레벨테스트 데이터 추출 (모아보기용)
 */
export function useConsultationLevelTests(subjectFilter?: 'all' | 'math' | 'english') {
  return useQuery({
    queryKey: ['consultation_level_tests', 'all', subjectFilter],
    queryFn: async () => {
      const q = query(
        collection(db, 'consultations'),
        orderBy('consultationDate', 'desc')
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(d => ({
        ...(d.data() as Record<string, any>),
        id: d.id,
      })) as ConsultationRecord[];

      let levelTests: ConsultationLevelTest[] = [];
      for (const record of records) {
        levelTests.push(...consultationToLevelTests(record));
      }

      if (subjectFilter && subjectFilter !== 'all') {
        levelTests = levelTests.filter(t => t.subject === subjectFilter);
      }

      return levelTests;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * 특정 학생의 상담 레벨테스트 조회 (성적탭용)
 */
export function useStudentConsultationLevelTests(studentId: string | undefined) {
  return useQuery({
    queryKey: ['consultation_level_tests', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const q = query(
        collection(db, 'consultations'),
        where('registeredStudentId', '==', studentId),
        orderBy('consultationDate', 'desc')
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(d => ({
        ...(d.data() as Record<string, any>),
        id: d.id,
      })) as ConsultationRecord[];

      const levelTests: ConsultationLevelTest[] = [];
      for (const record of records) {
        levelTests.push(...consultationToLevelTests(record));
      }
      return levelTests;
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5,
  });
}

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
    onError: (error: Error) => {
      console.error('[useAddLevelTest] mutation error:', error);
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
    onError: (error: Error) => {
      console.error('[useUpdateLevelTest] mutation error:', error);
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
    onError: (error: Error) => {
      console.error('[useDeleteLevelTest] mutation error:', error);
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
    onError: (error: Error) => {
      console.error('[useAddGoalSetting] mutation error:', error);
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
    onError: (error: Error) => {
      console.error('[useUpdateGoalAchievement] mutation error:', error);
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
    onError: (error: Error) => {
      console.error('[useDeleteGoalSetting] mutation error:', error);
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
      const q = query(
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
    onError: (error: Error) => {
      console.error('[useAddGradeComment] mutation error:', error);
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
    onError: (error: Error) => {
      console.error('[useUpdateGradeComment] mutation error:', error);
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
    onError: (error: Error) => {
      console.error('[useDeleteGradeComment] mutation error:', error);
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
