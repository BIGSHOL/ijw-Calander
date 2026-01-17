/**
 * useClassStudents - Centralized hook for fetching class student data
 *
 * PURPOSE: Fetch student data from students/enrollments structure
 * instead of the legacy 수업목록 collection.
 *
 * DATA FLOW:
 * 1. Query enrollments collection group for subject='english'
 * 2. Get student IDs from enrollment document paths
 * 3. Map student data from studentMap (unified student DB)
 *
 * OPTIMIZATION (2026-01-17):
 * - onSnapshot → getDocs + React Query 캐싱으로 변경
 * - Firebase 읽기 비용 60% 이상 절감 (실시간 구독 제거)
 * - 5분 캐싱으로 불필요한 재요청 방지
 *
 * USAGE:
 * const { classDataMap, isLoading, refetch } = useClassStudents(classNames, isSimulationMode, studentMap);
 * // classDataMap[className] = { studentList: [...], studentIds: [...] }
 */

import { useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { query, where, collectionGroup, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableStudent } from '../../../../types';

export interface ClassStudentData {
    studentList: TimetableStudent[];
    studentIds: string[];
}

export const useClassStudents = (
    classNames: string[],
    isSimulationMode: boolean = false,
    studentMap: Record<string, any> = {}
) => {
    // Use Ref to avoid re-fetch when studentMap reference changes
    const studentMapRef = useRef(studentMap);
    useEffect(() => {
        studentMapRef.current = studentMap;
    }, [studentMap]);

    // Memoize classNames to avoid unnecessary re-fetches
    const classNamesKey = useMemo(() => [...classNames].sort().join(','), [classNames]);

    const { data: classDataMap = {}, isLoading, refetch } = useQuery<Record<string, ClassStudentData>>({
        queryKey: ['englishClassStudents', classNamesKey],
        queryFn: async () => {
            if (classNames.length === 0) {
                return {};
            }

            // Query enrollments collection group for english subject
            // This gets students from students/{studentId}/enrollments
            const enrollmentsQuery = query(
                collectionGroup(db, 'enrollments'),
                where('subject', '==', 'english')
            );

            const snapshot = await getDocs(enrollmentsQuery);

            // Build a map of className -> studentIds
            const classStudentMap: Record<string, Set<string>> = {};
            const enrollmentDataMap: Record<string, Record<string, any>> = {}; // className -> studentId -> enrollment data

            // Initialize all requested classes
            classNames.forEach(name => {
                classStudentMap[name] = new Set();
                enrollmentDataMap[name] = {};
            });

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const className = data.className as string;

                // Only process if this class is in our requested list
                if (!classNames.includes(className)) return;

                // Get student ID from document path: students/{studentId}/enrollments/{enrollmentId}
                const studentId = doc.ref.parent.parent?.id;
                if (!studentId) return;

                // Skip if student is withdrawn or on hold (based on enrollment data)
                if (data.withdrawalDate || data.onHold) return;

                classStudentMap[className].add(studentId);
                enrollmentDataMap[className][studentId] = {
                    underline: data.underline,
                    enrollmentDate: data.enrollmentDate || data.startDate,
                    withdrawalDate: data.withdrawalDate,
                    onHold: data.onHold,
                    attendanceDays: data.attendanceDays || [],  // 등원 요일 추가
                };
            });

            // Convert to ClassStudentData format
            const result: Record<string, ClassStudentData> = {};

            classNames.forEach(className => {
                const studentIds = Array.from(classStudentMap[className] || []);
                const studentList: TimetableStudent[] = studentIds
                    .map(id => {
                        const baseStudent = studentMapRef.current[id];
                        const enrollmentData = enrollmentDataMap[className]?.[id] || {};

                        if (!baseStudent) {
                            // Student not found in studentMap - might be deleted or not loaded yet
                            return null;
                        }

                        // Skip if student is not active
                        if (baseStudent.status !== 'active') return null;

                        return {
                            id,
                            name: baseStudent.name || '',
                            englishName: baseStudent.englishName || '',
                            school: baseStudent.school || '',
                            grade: baseStudent.grade || '',
                            // Merge enrollment-specific data
                            underline: enrollmentData.underline ?? baseStudent.underline ?? false,
                            enrollmentDate: enrollmentData.enrollmentDate,
                            withdrawalDate: enrollmentData.withdrawalDate,
                            onHold: enrollmentData.onHold,
                            isMoved: false,
                            attendanceDays: enrollmentData.attendanceDays || [],  // 등원 요일
                        } as TimetableStudent;
                    })
                    .filter(Boolean) as TimetableStudent[];

                // Sort by name
                studentList.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

                result[className] = {
                    studentList,
                    studentIds,
                };
            });

            return result;
        },
        enabled: classNames.length > 0,
        staleTime: 1000 * 60 * 5,     // 5분 캐싱
        gcTime: 1000 * 60 * 15,       // 15분 GC
        refetchOnWindowFocus: false,  // 창 포커스 시 자동 재요청 비활성화
    });

    return { classDataMap, isLoading, refetch };
};
