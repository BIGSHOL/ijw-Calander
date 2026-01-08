// hooks/useAttendance.ts - Firebase hooks for Attendance data
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, deleteField } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Student, SalaryConfig, MonthlySettlement, AttendanceSubject } from '../components/Attendance/types';
import { useEffect, useState } from 'react';

// Collection names
const STUDENTS_COLLECTION = 'students'; // Unified DB
const RECORDS_COLLECTION = 'attendance_records';
const CONFIG_COLLECTION = 'attendance_config';

// ================== READ HOOKS ==================

/**
 * Hook to fetch students with real-time updates
 * Supports filtering by teacherId and subject
 * Now also loads attendance records for the specified month and merges into student objects
 * 
 * Cost Optimization Notes:
 * - Uses single onSnapshot for student list (necessary for real-time attendance marking)
 * - Attendance records loaded via batch getDocs query (not N+1 individual fetches)
 * - Consider converting to React Query if real-time updates not required
 */
export const useAttendanceStudents = (options?: {
    teacherId?: string;
    subject?: AttendanceSubject;
    yearMonth?: string; // NEW: YYYY-MM format, e.g. "2026-01"
    enabled?: boolean;
}) => {
    const [basicStudents, setBasicStudents] = useState<Student[]>([]); // Students from Snapshot (No Records)
    const [mergedStudents, setMergedStudents] = useState<Student[]>([]); // Final Students (With Records)
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refreshKey, setRefreshKey] = useState(0); // Trigger for re-fetching records

    // 1. Snapshot Listener for Student List (Real-time)
    useEffect(() => {
        if (options?.enabled === false) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const q = query(collection(db, STUDENTS_COLLECTION), orderBy('name'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                let data = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    attendance: {},
                    memos: {},
                    teacherIds: d.data().teacherIds || [],
                } as Student));

                // Client-side filtering
                if (options?.teacherId) {
                    data = data.filter(s => {
                        const enrollments = (s as any).enrollments || [];
                        return enrollments.some((e: any) => e.teacherId === options.teacherId);
                    });
                    data = data.map(s => {
                        const enrollments = (s as any).enrollments || [];
                        const teacherEnrollments = enrollments.filter((e: any) => e.teacherId === options.teacherId);
                        const teacherClasses = teacherEnrollments.map((e: any) => e.className);
                        const teacherDays: string[] = [];
                        teacherEnrollments.forEach((e: any) => {
                            if (e.days && Array.isArray(e.days)) {
                                e.days.forEach((d: string) => {
                                    if (!teacherDays.includes(d)) teacherDays.push(d);
                                });
                            }
                        });

                        // Extract date range from enrollments for this teacher
                        // Get the earliest startDate and latest endDate from all enrollments for this teacher
                        let enrollmentStartDate = (s as any).startDate || '1970-01-01';
                        let enrollmentEndDate = (s as any).endDate || null;

                        if (teacherEnrollments.length > 0) {
                            const startDates = teacherEnrollments
                                .map((e: any) => e.startDate)
                                .filter((d: string) => d);
                            const endDates = teacherEnrollments
                                .map((e: any) => e.endDate)
                                .filter((d: string | null) => d !== null && d !== undefined) as string[];

                            if (startDates.length > 0) {
                                enrollmentStartDate = startDates.sort()[0]; // Earliest start
                            }
                            if (endDates.length > 0) {
                                enrollmentEndDate = endDates.sort().reverse()[0]; // Latest end
                            }
                            // If any enrollment has no endDate (still active), set to null
                            if (teacherEnrollments.some((e: any) => !e.endDate)) {
                                enrollmentEndDate = null;
                            }
                        }

                        return {
                            ...s,
                            group: teacherClasses.join(', '),
                            days: teacherDays,
                            startDate: enrollmentStartDate,
                            endDate: enrollmentEndDate,
                        };
                    });
                }
                if (options?.subject) {
                    data = data.filter(s => {
                        const enrollments = (s as any).enrollments || [];
                        return enrollments.some((e: any) => e.subject === options.subject);
                    });
                }

                setBasicStudents(data);
                // Note: We don't turn off loading here, we wait for records
            },
            (err) => {
                console.error('Error fetching attendance students:', err);
                setError(err as Error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [options?.teacherId, options?.subject, options?.enabled]);

    // 2. Fetch Records Logic (Memoized)
    const fetchRecords = async () => {
        if (options?.enabled === false) return;
        if (basicStudents.length === 0) {
            setMergedStudents([]);
            setIsLoading(false);
            return;
        }

        // If no yearMonth, just return basic students without records
        if (!options?.yearMonth) {
            setMergedStudents(basicStudents);
            setIsLoading(false);
            return;
        }

        try {
            // Batch Fetching Logic ...
            const expectedDocIds = basicStudents.map(s => `${s.id}_${options.yearMonth}`);

            // Chunking
            const CHUNK_SIZE = 30;
            const chunks: string[][] = [];
            for (let i = 0; i < expectedDocIds.length; i += CHUNK_SIZE) {
                chunks.push(expectedDocIds.slice(i, i + CHUNK_SIZE));
            }

            const recordsMap = new Map<string, { attendance: Record<string, number>; memos: Record<string, string> }>();

            for (const chunk of chunks) {
                const chunkPromises = chunk.map(async (docId) => {
                    try {
                        const docSnap = await getDoc(doc(db, RECORDS_COLLECTION, docId));
                        if (docSnap.exists()) {
                            const idParts = docId.split('_');
                            idParts.pop();
                            const extractedStudentId = idParts.join('_');
                            return {
                                studentId: extractedStudentId,
                                attendance: docSnap.data().attendance || {},
                                memos: docSnap.data().memos || {}
                            };
                        }
                    } catch (e) {
                        console.warn(`Failed to fetch record ${docId}`, e);
                    }
                    return null;
                });

                const results = await Promise.all(chunkPromises);
                results.forEach(r => {
                    if (r) {
                        recordsMap.set(r.studentId, {
                            attendance: r.attendance,
                            memos: r.memos
                        });
                    }
                });
            }

            // Merge
            const merged = basicStudents.map(student => {
                const record = recordsMap.get(student.id);
                return {
                    ...student,
                    attendance: record?.attendance || {},
                    memos: record?.memos || {}
                };
            });

            setMergedStudents(merged);
        } catch (err) {
            console.error('Error loading attendance records:', err);
            // Fallback to basic students
            setMergedStudents(basicStudents);
        } finally {
            setIsLoading(false);
        }
    };

    // Trigger fetch on dependencies
    useEffect(() => {
        fetchRecords();
    }, [basicStudents, options?.yearMonth, options?.enabled, refreshKey]);

    // Async refetch function
    const refetch = async () => {
        setRefreshKey(prev => prev + 1);
        await fetchRecords();
    };

    return { students: mergedStudents, isLoading, error, refetch };
};

/**
 * Hook to fetch attendance records for a specific month
 * Records are stored as {studentId}_{YYYY-MM} documents for cost optimization
 */
export const useAttendanceRecords = (studentId: string, yearMonth: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['attendanceRecords', studentId, yearMonth],
        queryFn: async () => {
            const docId = `${studentId}_${yearMonth}`;
            const docSnap = await getDoc(doc(db, RECORDS_COLLECTION, docId));

            if (docSnap.exists()) {
                return {
                    attendance: docSnap.data().attendance || {},
                    memos: docSnap.data().memos || {}
                };
            }
            return { attendance: {}, memos: {} };
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled,
    });
};

/**
 * Hook to fetch salary configuration
 */
export const useAttendanceConfig = (configId: string = 'salary', enabled: boolean = true) => {
    return useQuery({
        queryKey: ['attendanceConfig', configId],
        queryFn: async () => {
            const docSnap = await getDoc(doc(db, CONFIG_COLLECTION, configId));

            if (docSnap.exists()) {
                return docSnap.data() as SalaryConfig;
            }
            return null;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
        enabled,
    });
};

/**
 * Hook to fetch a single month's settlement (cost-optimized)
 * Only loads the specific month's data instead of all months
 */
export const useMonthlySettlement = (yearMonth: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['monthlySettlement', yearMonth],
        queryFn: async () => {
            const docSnap = await getDoc(doc(db, CONFIG_COLLECTION, 'settlements', 'months', yearMonth));
            if (docSnap.exists()) {
                return docSnap.data() as MonthlySettlement;
            }
            return null;
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
        enabled,
    });
};

/**
 * @deprecated Use useMonthlySettlement instead for cost optimization
 * Hook to fetch all monthly settlements (loads all months - expensive)
 */
export const useMonthlySettlements = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['monthlySettlements'],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, CONFIG_COLLECTION, 'settlements', 'months'));
            const settlements: Record<string, MonthlySettlement> = {};
            snapshot.docs.forEach(d => {
                settlements[d.id] = d.data() as MonthlySettlement;
            });
            return settlements;
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
        enabled,
    });
};

// ================== WRITE MUTATIONS ==================

/**
 * Mutation to add/update a student
 */
export const useAddStudent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (student: Student) => {
            // Ensure extended fields for UnifiedStudent
            const unifiedData = {
                ...student,
                updatedAt: new Date().toISOString(),
                // If new, set createdAt
                ...(student.createdAt ? {} : { createdAt: new Date().toISOString() }),
                status: student.endDate ? 'withdrawn' : 'active'
            };
            await setDoc(doc(db, STUDENTS_COLLECTION, student.id), unifiedData, { merge: true });
            return student;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendanceStudents'] });
        },
    });
};

/**
 * Mutation to update attendance record (optimized for cost)
 * Only updates the specific month's record
 */
/**
 * Mutation to update attendance record (optimized for cost)
 * Only updates the specific month's record
 */
export const useUpdateAttendance = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            studentId,
            yearMonth,
            dateKey,
            value
        }: {
            studentId: string;
            yearMonth: string;
            dateKey: string;
            value: number | null;
        }) => {
            const docId = `${studentId}_${yearMonth}`;
            const docRef = doc(db, RECORDS_COLLECTION, docId);

            // Use deleteField() to properly remove keys during a merge
            // This also avoids the need to read the document first (Write Optimization)
            const payload = {
                attendance: {
                    [dateKey]: value === null ? deleteField() : value
                }
            };

            await setDoc(docRef, payload, { merge: true });
            return { studentId, yearMonth, dateKey, value };
        },
        onMutate: async ({ studentId, yearMonth, dateKey, value }) => {
            await queryClient.cancelQueries({ queryKey: ['attendanceRecords', studentId, yearMonth] });
            const previousRecord = queryClient.getQueryData(['attendanceRecords', studentId, yearMonth]);

            queryClient.setQueryData(['attendanceRecords', studentId, yearMonth], (old: any) => {
                if (!old) return { attendance: { [dateKey]: value }, memos: {} };
                const newAttendance = { ...old.attendance };
                if (value === null) delete newAttendance[dateKey];
                else newAttendance[dateKey] = value;
                return { ...old, attendance: newAttendance };
            });

            return { previousRecord };
        },
        onError: (err, newTodo, context: any) => {
            queryClient.setQueryData(['attendanceRecords', newTodo.studentId, newTodo.yearMonth], context.previousRecord);
        },
        onSettled: (data, error, variables) => {
            queryClient.invalidateQueries({ queryKey: ['attendanceRecords', variables.studentId, variables.yearMonth] });
        },
    });
};

/**
 * Mutation to update memo
 */
export const useUpdateMemo = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            studentId,
            yearMonth,
            dateKey,
            memo
        }: {
            studentId: string;
            yearMonth: string;
            dateKey: string;
            memo: string;
        }) => {
            const docId = `${studentId}_${yearMonth}`;
            const docRef = doc(db, RECORDS_COLLECTION, docId);

            const payload = {
                memos: {
                    [dateKey]: !memo.trim() ? deleteField() : memo.trim()
                }
            };

            await setDoc(docRef, payload, { merge: true });
            return { studentId, yearMonth, dateKey, memo };
        },
        onMutate: async ({ studentId, yearMonth, dateKey, memo }) => {
            await queryClient.cancelQueries({ queryKey: ['attendanceRecords', studentId, yearMonth] });
            const previousRecord = queryClient.getQueryData(['attendanceRecords', studentId, yearMonth]);

            queryClient.setQueryData(['attendanceRecords', studentId, yearMonth], (old: any) => {
                if (!old) return { attendance: {}, memos: { [dateKey]: memo } };
                const newMemos = { ...old.memos };
                if (!memo) delete newMemos[dateKey];
                else newMemos[dateKey] = memo;
                return { ...old, memos: newMemos };
            });

            return { previousRecord };
        },
        onError: (err, newTodo, context: any) => {
            queryClient.setQueryData(['attendanceRecords', newTodo.studentId, newTodo.yearMonth], context.previousRecord);
        },
        onSettled: (data, error, variables) => {
            queryClient.invalidateQueries({ queryKey: ['attendanceRecords', variables.studentId, variables.yearMonth] });
        },
    });
};

/**
 * Mutation to delete a student
 */
export const useDeleteStudent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (studentId: string) => {
            await deleteDoc(doc(db, STUDENTS_COLLECTION, studentId));
            // Note: Related records are orphaned but not deleted for data retention
            // Consider a cleanup function or TTL policy for old records
            return studentId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendanceStudents'] });
        },
    });
};

export const useSaveAttendanceConfig = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ config, configId = 'salary' }: { config: SalaryConfig, configId?: string }) => {
            await setDoc(doc(db, CONFIG_COLLECTION, configId), config);
            return { config, configId };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['attendanceConfig', data.configId] });
        },
    });
};

/**
 * Mutation to delete salary configuration (reset to global)
 */
export const useDeleteAttendanceConfig = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (configId: string) => {
            if (configId === 'salary') return; // Protect global config
            await deleteDoc(doc(db, CONFIG_COLLECTION, configId));
            return configId;
        },
        onSuccess: (configId) => {
            queryClient.invalidateQueries({ queryKey: ['attendanceConfig', configId] });
        },
    });
};

/**
 * Mutation to save monthly settlement to Firebase
 */
export const useSaveMonthlySettlement = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ monthKey, data }: { monthKey: string; data: MonthlySettlement }) => {
            await setDoc(doc(db, CONFIG_COLLECTION, 'settlements', 'months', monthKey), data);
            return { monthKey, data };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['monthlySettlements'] });
        },
    });
};
