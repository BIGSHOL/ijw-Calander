/**
 * useMathClassStudents - Centralized hook for fetching math class student data
 *
 * PURPOSE: Fetch student data from students/enrollments structure
 * instead of the legacy "이름_학교_학년" format in classes collection.
 *
 * DATA FLOW:
 * 1. Query enrollments collection group for subject='math'
 * 2. Get student IDs from enrollment document paths
 * 3. Map student data from studentMap (unified student DB)
 *
 * OPTIMIZATION (2026-01-17):
 * - onSnapshot → getDocs + React Query 캐싱으로 변경
 * - Firebase 읽기 비용 60% 이상 절감 (실시간 구독 제거)
 * - 5분 캐싱으로 불필요한 재요청 방지
 *
 * USAGE:
 * const { classDataMap, isLoading, refetch } = useMathClassStudents(classNames, studentMap);
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

export const useMathClassStudents = (
    classNames: string[],
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
        queryKey: ['mathClassStudents', classNamesKey],
        queryFn: async () => {
            if (classNames.length === 0) {
                return {};
            }

            // Query enrollments collection group for math subject
            // This gets students from students/{studentId}/enrollments
            const enrollmentsQuery = query(
                collectionGroup(db, 'enrollments'),
                where('subject', '==', 'math')
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

                classStudentMap[className].add(studentId);

                // Convert Firestore Timestamp to YYYY-MM-DD string
                const convertTimestampToDate = (timestamp: any): string | undefined => {
                    if (!timestamp) return undefined;
                    if (typeof timestamp === 'string') return timestamp;
                    if (timestamp?.toDate) {
                        const date = timestamp.toDate();
                        return date.toISOString().split('T')[0];
                    }
                    return undefined;
                };

                enrollmentDataMap[className][studentId] = {
                    enrollmentDate: convertTimestampToDate(data.enrollmentDate || data.startDate),
                    withdrawalDate: convertTimestampToDate(data.withdrawalDate),
                    onHold: data.onHold,
                    attendanceDays: data.attendanceDays || [],
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

                        // Priority for enrollment date (학생 관리 수업 탭 기준):
                        // 1. enrollmentData.enrollmentDate (학생 관리 수업 탭의 '시작일' from enrollments subcollection)
                        // 2. baseStudent.startDate (학생 기본정보의 등록일 - fallback)
                        const classEnrollmentDate = enrollmentData.enrollmentDate || baseStudent.startDate;

                        return {
                            id,
                            name: baseStudent.name || '',
                            englishName: baseStudent.englishName || '',
                            school: baseStudent.school || '',
                            grade: baseStudent.grade || '',
                            // Use prioritized enrollment date for new student marking
                            enrollmentDate: classEnrollmentDate,
                            withdrawalDate: enrollmentData.withdrawalDate,
                            onHold: enrollmentData.onHold,
                            isMoved: false,
                            attendanceDays: enrollmentData.attendanceDays || [],
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
