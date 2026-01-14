import { useCallback } from 'react';
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
    collectionGroup,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent } from '../types';

export const COL_STUDENTS = 'students';

/**
 * 학생 목록 조회 (React Query 기반)
 * - onSnapshot 대신 getDocs 사용으로 Firebase 비용 절감
 * - 5분 캐싱으로 불필요한 재요청 방지
 * - includeWithdrawn=true 시 최근 90일 퇴원생만 포함 (성능 최적화)
 */
export function useStudents(includeWithdrawn = false) {
    const queryClient = useQueryClient();

    const { data: students = [], isLoading: loading, error: queryError, refetch } = useQuery<UnifiedStudent[]>({
        queryKey: ['students', includeWithdrawn],
        queryFn: async () => {
            if (includeWithdrawn) {
                // 활성 학생 + 최근 90일 퇴원생만 조회
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - 90);
                const cutoffString = cutoffDate.toISOString().split('T')[0];

                // 두 쿼리 병렬 실행
                const activeQuery = query(
                    collection(db, COL_STUDENTS),
                    where('status', 'in', ['active', 'on_hold', 'prospect'])
                );
                // withdrawalDate가 없는 퇴원생도 포함하기 위해 단순 withdrawn 쿼리
                const withdrawnQuery = query(
                    collection(db, COL_STUDENTS),
                    where('status', '==', 'withdrawn')
                );

                const [activeSnap, withdrawnSnap] = await Promise.all([
                    getDocs(activeQuery).catch(err => {
                        console.error('Active students query failed:', err);
                        // 빈 결과 반환하여 부분 실패 허용
                        return { docs: [] } as any;
                    }),
                    getDocs(withdrawnQuery).catch(err => {
                        console.error('Withdrawn students query failed:', err);
                        return { docs: [] } as any;
                    })
                ]);

                // withdrawalDate 기준 필터링 (클라이언트 사이드)
                const withdrawnStudents = withdrawnSnap.docs
                    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UnifiedStudent))
                    .filter(student => {
                        // withdrawalDate가 없으면 포함 (레거시 데이터)
                        if (!student.withdrawalDate) return true;
                        // withdrawalDate가 있으면 90일 이내만 포함
                        return student.withdrawalDate >= cutoffString;
                    });

                const studentList = [
                    ...activeSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UnifiedStudent)),
                    ...withdrawnStudents
                ];

                // enrollments 한 번에 조회 후 학생별로 그룹화 (성능 최적화)
                const allEnrollmentsSnap = await getDocs(collectionGroup(db, 'enrollments'));
                const enrollmentsByStudent = new Map<string, any[]>();

                allEnrollmentsSnap.docs.forEach(doc => {
                    const studentId = doc.ref.parent.parent?.id;
                    if (studentId) {
                        if (!enrollmentsByStudent.has(studentId)) {
                            enrollmentsByStudent.set(studentId, []);
                        }
                        enrollmentsByStudent.get(studentId)!.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    }
                });

                // 각 학생에게 enrollments 할당
                studentList.forEach(student => {
                    student.enrollments = enrollmentsByStudent.get(student.id) || [];
                });

                // Client-side sort by name
                studentList.sort((a, b) => a.name.localeCompare(b.name));

                return studentList;
            } else {
                // 활성 학생만 조회
                const q = query(
                    collection(db, COL_STUDENTS),
                    where('status', '!=', 'withdrawn')
                );

                const snapshot = await getDocs(q);
                const studentList = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data()
                } as UnifiedStudent));

                // enrollments 한 번에 조회 후 학생별로 그룹화 (성능 최적화)
                const allEnrollmentsSnap = await getDocs(collectionGroup(db, 'enrollments'));
                const enrollmentsByStudent = new Map<string, any[]>();

                allEnrollmentsSnap.docs.forEach(doc => {
                    const studentId = doc.ref.parent.parent?.id;
                    if (studentId) {
                        if (!enrollmentsByStudent.has(studentId)) {
                            enrollmentsByStudent.set(studentId, []);
                        }
                        enrollmentsByStudent.get(studentId)!.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    }
                });

                // 각 학생에게 enrollments 할당
                studentList.forEach(student => {
                    student.enrollments = enrollmentsByStudent.get(student.id) || [];
                });

                // Client-side sort by name
                studentList.sort((a, b) => a.name.localeCompare(b.name));

                return studentList;
            }
        },
        staleTime: 1000 * 60 * 5,    // 5분 캐싱
        gcTime: 1000 * 60 * 15,       // 15분 GC
        refetchOnWindowFocus: false,  // 창 포커스 시 자동 재요청 비활성화
    });

    const error = queryError ? (queryError as Error).message : null;

    // One-off fetch for specific student
    const getStudent = useCallback(async (id: string) => {
        try {
            const docRef = doc(db, COL_STUDENTS, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as UnifiedStudent;
            }
            return null;
        } catch (err) {
            console.error("Error getting student:", err);
            throw err;
        }
    }, []);

    // Create student mutation
    const addStudentMutation = useMutation({
        mutationFn: async (studentData: Omit<UnifiedStudent, 'id' | 'createdAt' | 'updatedAt'>) => {
            const now = new Date().toISOString();
            const docRef = await addDoc(collection(db, COL_STUDENTS), {
                ...studentData,
                createdAt: now,
                updatedAt: now,
            });
            return docRef.id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
    });

    // Update student mutation
    const updateStudentMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<UnifiedStudent> }) => {
            const docRef = doc(db, COL_STUDENTS, id);
            const now = new Date().toISOString();
            await updateDoc(docRef, {
                ...updates,
                updatedAt: now,
            });
            return { id, updates };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
    });

    // Delete student mutation
    const deleteStudentMutation = useMutation({
        mutationFn: async ({ id, hardDelete = false }: { id: string; hardDelete?: boolean }) => {
            const docRef = doc(db, COL_STUDENTS, id);
            if (hardDelete) {
                await deleteDoc(docRef);
            } else {
                const now = new Date().toISOString();
                await updateDoc(docRef, {
                    status: 'withdrawn',
                    updatedAt: now,
                    endDate: now
                });
            }
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
    });

    // 기존 API와 호환되는 래퍼 함수들
    const addStudent = useCallback(async (studentData: Omit<UnifiedStudent, 'id' | 'createdAt' | 'updatedAt'>) => {
        return addStudentMutation.mutateAsync(studentData);
    }, [addStudentMutation]);

    const updateStudent = useCallback(async (id: string, updates: Partial<UnifiedStudent>) => {
        await updateStudentMutation.mutateAsync({ id, updates });
    }, [updateStudentMutation]);

    const deleteStudent = useCallback(async (id: string, hardDelete = false) => {
        await deleteStudentMutation.mutateAsync({ id, hardDelete });
    }, [deleteStudentMutation]);

    // 수동 새로고침 함수
    const refreshStudents = useCallback(() => {
        return refetch();
    }, [refetch]);

    return {
        students,
        loading,
        error,
        getStudent,
        addStudent,
        updateStudent,
        deleteStudent,
        refreshStudents,  // 새로고침 함수 추가
        // mutation 상태 (필요시 사용)
        isAdding: addStudentMutation.isPending,
        isUpdating: updateStudentMutation.isPending,
        isDeleting: deleteStudentMutation.isPending,
    };
}

/**
 * 이름으로 학생 검색 (과거 퇴원생 포함)
 * - 부분 일치 검색 지원 (contains)
 * - 90일 이상 경과한 퇴원생도 검색 가능
 * - 통합 검색창에서 사용
 */
export async function searchStudentsByQuery(searchQuery: string): Promise<UnifiedStudent[]> {
    try {
        if (!searchQuery.trim()) {
            return [];
        }

        const lowerQuery = searchQuery.toLowerCase();

        // Firestore는 부분 일치 검색이 어려우므로 prefix 검색 사용
        // name >= query && name <= query + '\uf8ff'
        const nameQuery = query(
            collection(db, COL_STUDENTS),
            where('status', '==', 'withdrawn'),
            where('name', '>=', searchQuery),
            where('name', '<=', searchQuery + '\uf8ff')
        );

        const snapshot = await getDocs(nameQuery);
        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isOldWithdrawn: true // 과거 퇴원생 표시용
        } as UnifiedStudent));

        return results;
    } catch (error) {
        console.error('과거 퇴원생 검색 실패:', error);
        return [];
    }
}

/**
 * 정확한 이름으로 학생 검색 (중복 확인용)
 * - 신입 등록 시 기존 학생 확인
 */
export async function searchStudentByExactName(name: string): Promise<UnifiedStudent | null> {
    try {
        // 현재 students 컬렉션에서 정확히 일치하는 이름 검색
        const currentQuery = query(
            collection(db, COL_STUDENTS),
            where('name', '==', name)
        );
        const currentSnap = await getDocs(currentQuery);

        if (!currentSnap.empty) {
            return { id: currentSnap.docs[0].id, ...currentSnap.docs[0].data() } as UnifiedStudent;
        }

        // 향후 students_archived 컬렉션 추가 시 여기에 검색 로직 추가
        return null;
    } catch (error) {
        console.error('학생 이름 검색 실패:', error);
        throw error;
    }
}
