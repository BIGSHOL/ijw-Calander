// hooks/useAttendance.ts - Firebase hooks for Attendance data
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
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
 */
export const useAttendanceStudents = (options?: {
    teacherId?: string;
    subject?: AttendanceSubject;
    yearMonth?: string; // NEW: YYYY-MM format, e.g. "2026-01"
    enabled?: boolean;
}) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (options?.enabled === false) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        // Build query based on filters
        let q = query(collection(db, STUDENTS_COLLECTION), orderBy('name'));

        // Note: Firestore requires composite index for array-contains + other conditions
        // For now, we fetch all and filter client-side for flexibility
        // TODO: Add Firestore composite index for production optimization

        const unsubscribe = onSnapshot(
            q,
            async (snapshot) => {
                let data = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    attendance: {}, // Initialize empty, will be filled below
                    memos: {},
                    // Ensure compatibility fields if missing in DB
                    teacherIds: d.data().teacherIds || [],
                } as Student));

                // Filter out withdrawn students if needed, or keeping them for historical attendance?
                // Usually we only show active students in the main list.
                // Unified DB uses 'status' field.
                // data = data.filter(s => (s as any).status !== 'withdrawn');

                // Client-side filtering (can be moved to Firestore query with proper indexes)
                if (options?.teacherId) {
                    data = data.filter(s => s.teacherIds?.includes(options.teacherId!));
                }
                if (options?.subject) {
                    data = data.filter(s => s.subjects?.includes(options.subject!));
                }

                // Load attendance records for the specified month
                if (options?.yearMonth && data.length > 0) {
                    try {
                        // Batch fetch all student records for this month
                        const recordPromises = data.map(async (student) => {
                            const docId = `${student.id}_${options.yearMonth}`;
                            const docSnap = await getDoc(doc(db, RECORDS_COLLECTION, docId));

                            if (docSnap.exists()) {
                                return {
                                    studentId: student.id,
                                    attendance: docSnap.data().attendance || {},
                                    memos: docSnap.data().memos || {}
                                };
                            }
                            return { studentId: student.id, attendance: {}, memos: {} };
                        });

                        const records = await Promise.all(recordPromises);

                        // Merge records into student objects
                        const recordsMap = new Map(records.map(r => [r.studentId, r]));
                        data = data.map(student => {
                            const record = recordsMap.get(student.id);
                            return {
                                ...student,
                                attendance: record?.attendance || {},
                                memos: record?.memos || {}
                            };
                        });
                    } catch (recordError) {
                        console.error('Error loading attendance records:', recordError);
                        // Continue with empty attendance data
                    }
                }

                setStudents(data);
                setIsLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Error fetching attendance students:', err);
                setError(err as Error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [options?.teacherId, options?.subject, options?.yearMonth, options?.enabled]);

    return { students, isLoading, error };
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
export const useAttendanceConfig = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['attendanceConfig'],
        queryFn: async () => {
            const docSnap = await getDoc(doc(db, CONFIG_COLLECTION, 'salary'));

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
 * Hook to fetch monthly settlements
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
            const docSnap = await getDoc(docRef);

            const currentData = docSnap.exists() ? docSnap.data() : { attendance: {}, memos: {} };
            const newAttendance = { ...currentData.attendance };

            if (value === null) {
                delete newAttendance[dateKey];
            } else {
                newAttendance[dateKey] = value;
            }

            await setDoc(docRef, { ...currentData, attendance: newAttendance }, { merge: true });
            return { studentId, yearMonth, dateKey, value };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['attendanceRecords', data.studentId, data.yearMonth] });
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
            const docSnap = await getDoc(docRef);

            const currentData = docSnap.exists() ? docSnap.data() : { attendance: {}, memos: {} };
            const newMemos = { ...currentData.memos };

            if (!memo.trim()) {
                delete newMemos[dateKey];
            } else {
                newMemos[dateKey] = memo.trim();
            }

            await setDoc(docRef, { ...currentData, memos: newMemos }, { merge: true });
            return { studentId, yearMonth, dateKey, memo };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['attendanceRecords', data.studentId, data.yearMonth] });
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

/**
 * Mutation to save salary configuration
 */
export const useSaveAttendanceConfig = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (config: SalaryConfig) => {
            await setDoc(doc(db, CONFIG_COLLECTION, 'salary'), config);
            return config;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendanceConfig'] });
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
