// hooks/useSessionPeriods.ts - Firebase hooks for Session Period management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SessionPeriod } from '../components/Attendance/types';

// Collection name for session periods
const SESSION_PERIODS_COLLECTION = 'session_periods';

// Query keys
const SESSION_PERIODS_KEY = 'sessionPeriods';

/**
 * 연도별 세션 기간 목록 조회
 * @param year - 조회할 연도 (e.g., 2026)
 * @param category - 과목 필터 (optional)
 */
export const useSessionPeriods = (year: number, category?: 'math' | 'english' | 'eie') => {
  return useQuery({
    queryKey: [SESSION_PERIODS_KEY, year, category],
    queryFn: async () => {
      const sessionsRef = collection(db, SESSION_PERIODS_COLLECTION);

      const snapshot = await getDocs(sessionsRef);

      let sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SessionPeriod[];

      // 클라이언트 사이드 필터링
      sessions = sessions.filter(s => s.year === year);

      if (category) {
        sessions = sessions.filter(s => s.category === category);
      }

      // 월 기준 정렬
      sessions.sort((a, b) => a.month - b.month);

      return sessions;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,   // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

/**
 * 특정 월의 세션 조회
 * @param year - 연도
 * @param category - 과목
 * @param month - 월 (1-12)
 */
export const useSessionPeriod = (year: number, category: 'math' | 'english' | 'eie', month: number) => {
  return useQuery({
    queryKey: [SESSION_PERIODS_KEY, year, category, month],
    queryFn: async () => {
      const sessionId = `${year}-${category}-${month}`;
      const sessionsRef = collection(db, SESSION_PERIODS_COLLECTION);
      const q = query(sessionsRef, where('id', '==', sessionId));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as SessionPeriod;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * 세션 기간 저장 (생성/수정)
 */
export const useSaveSessionPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (session: SessionPeriod) => {
      const sessionId = session.id || `${session.year}-${session.category}-${session.month}`;
      const docRef = doc(db, SESSION_PERIODS_COLLECTION, sessionId);

      const dataToSave = {
        ...session,
        id: sessionId,
        updatedAt: new Date().toISOString(),
        createdAt: session.createdAt || new Date().toISOString(),
      };

      await setDoc(docRef, dataToSave);
      return dataToSave;
    },
    onSuccess: (savedSession) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: [SESSION_PERIODS_KEY, savedSession.year]
      });
      queryClient.invalidateQueries({
        queryKey: [SESSION_PERIODS_KEY, savedSession.year, savedSession.category]
      });
      queryClient.invalidateQueries({
        queryKey: [SESSION_PERIODS_KEY, savedSession.year, savedSession.category, savedSession.month]
      });
    },
  });
};

/**
 * 세션 기간 삭제
 */
export const useDeleteSessionPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const docRef = doc(db, SESSION_PERIODS_COLLECTION, sessionId);
      await deleteDoc(docRef);
      return sessionId;
    },
    onSuccess: (_, sessionId) => {
      // Parse sessionId to get year and category for cache invalidation
      const parts = sessionId.split('-');
      const year = parseInt(parts[0]);
      const category = parts[1];

      queryClient.invalidateQueries({
        queryKey: [SESSION_PERIODS_KEY, year]
      });
      queryClient.invalidateQueries({
        queryKey: [SESSION_PERIODS_KEY, year, category]
      });
    },
  });
};

/**
 * 여러 세션을 한 번에 저장 (배치)
 */
export const useBatchSaveSessionPeriods = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessions: SessionPeriod[]) => {
      const now = new Date().toISOString();

      const savePromises = sessions.map(async (session) => {
        const sessionId = session.id || `${session.year}-${session.category}-${session.month}`;
        const docRef = doc(db, SESSION_PERIODS_COLLECTION, sessionId);

        const dataToSave = {
          ...session,
          id: sessionId,
          updatedAt: now,
          createdAt: session.createdAt || now,
        };

        await setDoc(docRef, dataToSave);
        return dataToSave;
      });

      return Promise.all(savePromises);
    },
    onSuccess: (savedSessions) => {
      // Invalidate all affected year queries
      const years = [...new Set(savedSessions.map(s => s.year))];
      years.forEach(year => {
        queryClient.invalidateQueries({
          queryKey: [SESSION_PERIODS_KEY, year]
        });
      });
    },
  });
};
