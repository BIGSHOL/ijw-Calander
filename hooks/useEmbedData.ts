// Embed Data Loading Hook
// 인증 없이 임베드용 시간표 데이터를 로드
// 최적화: 병렬 로딩, 배치 처리, 필요 학생만 로드

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TimetableClass, Teacher, TimetableStudent, ClassKeywordColor } from '../types';
import { EmbedSettings } from '../types/embed';

interface EmbedMathData {
  classes: TimetableClass[];
  teachers: Teacher[];
  classKeywords: ClassKeywordColor[];
  studentMap: Record<string, any>;
  loading: boolean;
  error: string | null;
}

// 간단한 메모리 캐시 (세션 동안 유지)
const cache: {
  staff?: Teacher[];
  classKeywords?: ClassKeywordColor[];
  timestamp?: number;
} = {};
const CACHE_TTL = 5 * 60 * 1000; // 5분

const isCacheValid = () => {
  return cache.timestamp && (Date.now() - cache.timestamp) < CACHE_TTL;
};

/**
 * 임베드용 수학 시간표 데이터 로딩 훅
 * - 인증 없이 Firestore에서 직접 데이터 로드
 * - 설정에 따라 필터링 적용
 * - 최적화: 병렬 로딩, 배치 처리, 캐싱
 */
export function useEmbedMathData(settings?: EmbedSettings): EmbedMathData {
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classKeywords, setClassKeywords] = useState<ClassKeywordColor[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 중복 로딩 방지
  const loadingRef = useRef(false);

  useEffect(() => {
    if (loadingRef.current) return;

    const loadData = async () => {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        // ===== Phase 1: 병렬로 기본 데이터 로드 =====
        const [classesResult, staffResult, keywordsResult] = await Promise.all([
          // 1. 수학 수업 로드
          getDocs(query(collection(db, 'classes'), where('subject', '==', 'math'))),

          // 2. 강사 데이터 (캐시 확인)
          isCacheValid() && cache.staff
            ? Promise.resolve(null)
            : getDocs(collection(db, 'staff')),

          // 3. 키워드 색상 (캐시 확인)
          isCacheValid() && cache.classKeywords
            ? Promise.resolve(null)
            : getDocs(collection(db, 'classKeywords')),
        ]);

        // 수업 데이터 처리
        let loadedClasses = classesResult.docs.map(doc => ({
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

        // 강사 데이터 처리 (캐시 또는 새로 로드)
        let loadedTeachers: Teacher[];
        if (staffResult) {
          loadedTeachers = staffResult.docs
            .filter(doc => {
              const data = doc.data();
              return data.subjects?.includes('math') || data.subjects?.includes('english');
            })
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name || '',
                englishName: data.englishName,
                subjects: data.subjects || [],
                isHidden: data.isHiddenInTimetable || false,
                isHiddenInAttendance: data.isHiddenInAttendance || false,
                isNative: data.isNative || false,
                bgColor: data.bgColor,
                textColor: data.textColor,
                order: data.timetableOrder,
                defaultRoom: data.defaultRoom,
              } as Teacher;
            });
          cache.staff = loadedTeachers;
          cache.timestamp = Date.now();
        } else {
          loadedTeachers = cache.staff!;
        }
        setTeachers(loadedTeachers);

        // 키워드 색상 처리 (캐시 또는 새로 로드)
        let loadedKeywords: ClassKeywordColor[];
        if (keywordsResult) {
          loadedKeywords = keywordsResult.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ClassKeywordColor))
            .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
          cache.classKeywords = loadedKeywords;
        } else {
          loadedKeywords = cache.classKeywords!;
        }
        setClassKeywords(loadedKeywords);

        // ===== Phase 2: 학생 데이터 최적화 로드 =====
        if (settings?.showStudentList !== false) {
          const classNames = new Set(loadedClasses.map(c => c.className));

          try {
            // 최적화 방식: collectionGroup 쿼리로 한번에 모든 수학 enrollments 로드
            const enrollmentsSnap = await getDocs(
              query(collectionGroup(db, 'enrollments'), where('subject', '==', 'math'))
            );

            // 필요한 학생 ID만 추출 (해당 수업에 등록된 학생)
            const studentIds = new Set<string>();
            const enrollmentsByStudent = new Map<string, any[]>();

            enrollmentsSnap.docs.forEach(doc => {
              const data = doc.data();
              if (classNames.has(data.className)) {
                const studentId = doc.ref.parent.parent?.id;
                if (studentId) {
                  studentIds.add(studentId);
                  if (!enrollmentsByStudent.has(studentId)) {
                    enrollmentsByStudent.set(studentId, []);
                  }
                  enrollmentsByStudent.get(studentId)!.push({ id: doc.id, ...data });
                }
              }
            });

            // 필요한 학생만 배치로 로드
            if (studentIds.size > 0) {
              const studentIdArray = Array.from(studentIds);
              const BATCH_SIZE = 30;
              const studentBatches: Promise<any>[] = [];

              for (let i = 0; i < studentIdArray.length; i += BATCH_SIZE) {
                const batchIds = studentIdArray.slice(i, i + BATCH_SIZE);
                studentBatches.push(
                  getDocs(query(
                    collection(db, 'students'),
                    where('__name__', 'in', batchIds)
                  )).catch(() => null)
                );
              }

              const batchResults = await Promise.all(studentBatches);
              const loadedStudents: any[] = [];

              batchResults.forEach(result => {
                if (result) {
                  result.docs.forEach((doc: any) => {
                    loadedStudents.push({
                      id: doc.id,
                      ...doc.data(),
                      enrollments: enrollmentsByStudent.get(doc.id) || [],
                    });
                  });
                }
              });

              setStudents(loadedStudents);
            } else {
              setStudents([]);
            }
          } catch (cgError) {
            // collectionGroup 실패 시 폴백: 병렬 개별 로드
            console.warn('collectionGroup query failed, using fallback:', cgError);

            const studentsSnap = await getDocs(collection(db, 'students'));
            const PARALLEL_LIMIT = 20; // 동시 요청 제한
            const loadedStudents: any[] = [];

            // 학생을 배치로 나누어 병렬 처리
            for (let i = 0; i < studentsSnap.docs.length; i += PARALLEL_LIMIT) {
              const batch = studentsSnap.docs.slice(i, i + PARALLEL_LIMIT);
              const batchPromises = batch.map(async (studentDoc) => {
                const studentData = { id: studentDoc.id, ...studentDoc.data() };
                const enrollmentsSnap = await getDocs(
                  collection(db, 'students', studentDoc.id, 'enrollments')
                );
                const enrollments = enrollmentsSnap.docs
                  .map(e => ({ id: e.id, ...e.data() }))
                  .filter((e: any) => e.subject === 'math' && classNames.has(e.className));

                // 해당 수업에 등록된 학생만 반환
                if (enrollments.length > 0) {
                  return { ...studentData, enrollments };
                }
                return null;
              });

              const batchResults = await Promise.all(batchPromises);
              batchResults.forEach(result => {
                if (result) loadedStudents.push(result);
              });
            }

            setStudents(loadedStudents);
          }
        }
      } catch (err: any) {
        console.error('Embed data load error:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
        loadingRef.current = false;
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

  return { classes, teachers, classKeywords, studentMap, loading, error };
}
