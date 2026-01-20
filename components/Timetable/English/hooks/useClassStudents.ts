/**
 * useClassStudents - Centralized hook for fetching class student data
 *
 * PURPOSE: Fetch student data from students/enrollments structure
 *
 * DATA FLOW:
 * 1. Query enrollments collection group for subject='english'
 * 2. Get student IDs from enrollment document paths
 * 3. Map student data from studentMap (unified student DB)
 *
 * SIMULATION MODE (2026-01-17):
 * - isSimulationMode=true일 때 SimulationContext의 draft 데이터 사용
 * - 메모리 기반 상태로 Firebase 조회 없이 즉시 반환
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { query, where, collectionGroup, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableStudent } from '../../../../types';
import { useSimulationOptional } from '../context/SimulationContext';

export interface ClassStudentData {
    studentList: TimetableStudent[];
    studentIds: string[];
}

export const useClassStudents = (
    classNames: string[],
    isSimulationMode: boolean = false,
    studentMap: Record<string, any> = {}
) => {
    const queryClient = useQueryClient();

    // Use Ref to avoid re-fetch when studentMap reference changes
    const studentMapRef = useRef(studentMap);

    // studentMap이 변경되면 캐시된 데이터를 무효화하여 재계산 트리거
    // (학생 기본 정보 변경 시 시간표에 반영되도록)
    const prevStudentMapRef = useRef<Record<string, any> | null>(null);
    useEffect(() => {
        studentMapRef.current = studentMap;

        // studentMap이 실제로 변경되었는지 확인 (초기 로드 제외)
        if (prevStudentMapRef.current !== null && prevStudentMapRef.current !== studentMap) {
            // 캐시 무효화하여 재조회 트리거
            queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
        }
        prevStudentMapRef.current = studentMap;
    }, [studentMap, queryClient]);

    // Memoize classNames to avoid unnecessary re-fetches
    const classNamesKey = useMemo(() => [...classNames].sort().join(','), [classNames]);

    // SimulationContext - optional (may not be wrapped in provider)
    const simulation = useSimulationOptional();

    // 시나리오 모드: Context에서 시나리오 데이터 사용
    // simulation 객체의 상태(scenarioEnrollments)가 변경될 때도 재계산되도록 의존성 추가
    const simulationData = useMemo(() => {
        if (!isSimulationMode || !simulation?.isScenarioMode) {
            return null;
        }
        return simulation.getClassStudents(classNames, studentMapRef.current);
    }, [isSimulationMode, simulation?.isScenarioMode, simulation?.scenarioEnrollments, classNames]);

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
                    underline: data.underline,
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

                        // Skip if student is not active
                        if (baseStudent.status !== 'active') return null;

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
                            // Merge enrollment-specific data
                            underline: enrollmentData.underline ?? baseStudent.underline ?? false,
                            // Priority: classHistory startDate > enrollment startDate
                            enrollmentDate: classEnrollmentDate,
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
        // 시뮬레이션 모드에서는 실행하지 않음 (simulationData 사용)
        enabled: classNames.length > 0 && !isSimulationMode,
        staleTime: 1000 * 60 * 5,     // 5분 캐싱
        gcTime: 1000 * 60 * 15,       // 15분 GC
        refetchOnWindowFocus: false,  // 창 포커스 시 자동 재요청 비활성화
    });

    // 시뮬레이션 모드면 simulationData 반환, 아니면 React Query 결과 반환
    if (isSimulationMode && simulationData) {
        return {
            classDataMap: simulationData,
            isLoading: false,
            refetch: async () => {
                // 시뮬레이션 모드에서는 loadFromLive로 새로고침
                await simulation?.loadFromLive();
            },
        };
    }

    return { classDataMap, isLoading, refetch };
};
