import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TuitionCourse } from '../types/tuition';
import { TUITION_COURSES } from '../constants/tuitionCourses';

const COLLECTION = 'tuition_courses';
const QUERY_KEY = 'tuitionCourses';

export const useTuitionCourses = () => {
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const snap = await getDocs(collection(db, COLLECTION));
      if (snap.empty) return []; // 비어있으면 빈 배열 (시드 필요)
      return snap.docs.map(d => ({ ...d.data(), id: d.id }) as TuitionCourse);
    },
    staleTime: 5 * 60 * 1000,
  });

  // DB가 비어있으면 하드코딩 상수 사용 (폴백)
  const effectiveCourses = courses.length > 0 ? courses : TUITION_COURSES;

  // 단가 수정
  const updateMutation = useMutation({
    mutationFn: async (course: TuitionCourse) => {
      await setDoc(doc(db, COLLECTION, course.id), {
        category: course.category,
        name: course.name,
        days: course.days,
        defaultPrice: course.defaultPrice,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionCourses]', error),
  });

  // 과목 추가
  const addMutation = useMutation({
    mutationFn: async (course: TuitionCourse) => {
      await setDoc(doc(db, COLLECTION, course.id), {
        category: course.category,
        name: course.name,
        days: course.days,
        defaultPrice: course.defaultPrice,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionCourses]', error),
  });

  // 과목 삭제
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COLLECTION, id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionCourses]', error),
  });

  // 초기 시드: 하드코딩 상수 → Firebase
  const seedMutation = useMutation({
    mutationFn: async () => {
      const batch = writeBatch(db);
      for (const course of TUITION_COURSES) {
        batch.set(doc(db, COLLECTION, course.id), {
          category: course.category,
          name: course.name,
          days: course.days,
          defaultPrice: course.defaultPrice,
        });
      }
      await batch.commit();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionCourses]', error),
  });

  return {
    courses: effectiveCourses,
    isLoading,
    isEmpty: courses.length === 0,
    updateCoursePrice: updateMutation.mutateAsync,
    addCourse: addMutation.mutateAsync,
    deleteCourse: deleteMutation.mutateAsync,
    seedCourses: seedMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isSeeding: seedMutation.isPending,
  };
};
