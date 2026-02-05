// Embed Data Loading Hook
// 인증 없이 임베드용 시간표 데이터를 로드

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TimetableClass, Teacher, TimetableStudent } from '../types';
import { EmbedSettings } from '../types/embed';

interface EmbedMathData {
  classes: TimetableClass[];
  teachers: Teacher[];
  studentMap: Record<string, any>;
  loading: boolean;
  error: string | null;
}

// Timestamp를 날짜 문자열로 변환
const convertTimestamp = (ts: any): string | undefined => {
  if (!ts) return undefined;
  if (typeof ts === 'string') return ts;
  if (ts?.toDate) return ts.toDate().toISOString().split('T')[0];
  return undefined;
};

/**
 * 임베드용 수학 시간표 데이터 로딩 훅
 * - 인증 없이 Firestore에서 직접 데이터 로드
 * - 설정에 따라 필터링 적용
 */
export function useEmbedMathData(settings?: EmbedSettings): EmbedMathData {
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. 수학 수업 로드
        const classesRef = collection(db, 'classes');
        const classesQuery = query(classesRef, where('subject', '==', 'math'));
        const classesSnap = await getDocs(classesQuery);

        let loadedClasses = classesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as TimetableClass[];

        // 필터 적용
        if (settings?.filterByClass?.length) {
          loadedClasses = loadedClasses.filter(c =>
            settings.filterByClass!.includes(c.className)
          );
        }
        if (settings?.filterByTeacher?.length) {
          loadedClasses = loadedClasses.filter(c =>
            settings.filterByTeacher!.includes(c.teacher || '')
          );
        }

        setClasses(loadedClasses);

        // 2. 강사 데이터 로드
        const teachersSnap = await getDocs(collection(db, 'teachers'));
        const loadedTeachers = teachersSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Teacher[];
        setTeachers(loadedTeachers);

        // 3. 학생 데이터 로드 (학생 목록 표시가 필요한 경우만)
        if (settings?.showStudentList !== false) {
          const studentsSnap = await getDocs(collection(db, 'students'));
          const loadedStudents: any[] = [];

          for (const studentDoc of studentsSnap.docs) {
            const studentData = { id: studentDoc.id, ...studentDoc.data() };

            // enrollments 서브컬렉션 로드
            const enrollmentsSnap = await getDocs(
              collection(db, 'students', studentDoc.id, 'enrollments')
            );
            const enrollments = enrollmentsSnap.docs.map(e => ({
              id: e.id,
              ...e.data(),
            }));

            loadedStudents.push({
              ...studentData,
              enrollments,
            });
          }

          setStudents(loadedStudents);
        }
      } catch (err: any) {
        console.error('Embed data load error:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [settings?.filterByClass, settings?.filterByTeacher, settings?.showStudentList]);

  // studentMap 구성
  const studentMap = useMemo(() => {
    const map: Record<string, any> = {};
    students.forEach(s => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  return { classes, teachers, studentMap, loading, error };
}
