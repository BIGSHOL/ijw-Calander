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

// Helper to convert Firestore Timestamp to YYYY-MM-DD string (hoisted to module level)
const convertTimestampToDate = (timestamp: any): string | undefined => {
    if (!timestamp) return undefined;
    if (typeof timestamp === 'string') return timestamp;
    if (timestamp?.toDate) {
        const date = timestamp.toDate();
        return date.toISOString().split('T')[0];
    }
    return undefined;
};

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

    // studentMap이 비어있지 않은지 확인 (쿼리 활성화 조건용)
    const studentMapReady = Object.keys(studentMap).length > 0;

    // studentMap 참조 변경 감지 → 캐시 무효화
    // React Query의 structuralSharing 덕분에 실제 데이터 변경 시에만 새 참조 생성
    const prevStudentMapRef = useRef<Record<string, any> | null>(null);
    useEffect(() => {
        const prev = prevStudentMapRef.current;
        studentMapRef.current = studentMap;
        prevStudentMapRef.current = studentMap;

        // 첫 렌더가 아니고, 참조가 변경된 경우 캐시 무효화
        if (prev !== null && prev !== studentMap) {
            queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
        }
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

            // Get today's date for filtering future enrollments
            const today = new Date().toISOString().split('T')[0];

            // 반이동 감지: 학생별로 활성/종료 등록 수업 목록 수집
            const studentActiveClasses: Record<string, Set<string>> = {}; // studentId -> Set of active classNames
            const studentEndedClasses: Record<string, Set<string>> = {};  // studentId -> Set of ended classNames

            // 1차: 모든 enrollment 순회하여 활성/종료 등록 수집
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const className = data.className as string;
                const studentId = doc.ref.parent.parent?.id;
                if (!studentId) return;

                const withdrawalDate = convertTimestampToDate(data.withdrawalDate);
                const endDate = convertTimestampToDate(data.endDate);
                const hasEndDate = !!(withdrawalDate || endDate);

                if (!hasEndDate) {
                    // 활성 등록 (endDate 없음)
                    if (!studentActiveClasses[studentId]) {
                        studentActiveClasses[studentId] = new Set();
                    }
                    studentActiveClasses[studentId].add(className);
                } else {
                    // 종료된 등록 (endDate 있음)
                    if (!studentEndedClasses[studentId]) {
                        studentEndedClasses[studentId] = new Set();
                    }
                    studentEndedClasses[studentId].add(className);
                }
            });

            // 2차: 요청된 수업들의 enrollment 데이터 처리
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const className = data.className as string;

                // Only process if this class is in our requested list
                if (!classNames.includes(className)) return;

                // Get student ID from document path: students/{studentId}/enrollments/{enrollmentId}
                const studentId = doc.ref.parent.parent?.id;
                if (!studentId) return;

                const startDate = convertTimestampToDate(data.enrollmentDate || data.startDate);
                const withdrawalDate = convertTimestampToDate(data.withdrawalDate);
                const endDate = convertTimestampToDate(data.endDate);

                // 미래 시작일 학생도 포함 (대기 섹션에 '배정 예정'으로 표시)
                const isScheduled = startDate && startDate > today;

                // 반이동 여부 체크
                const hasEndDate = !!(withdrawalDate || endDate);
                const activeClasses = studentActiveClasses[studentId] || new Set();
                const endedClasses = studentEndedClasses[studentId] || new Set();

                // isTransferred: 이 수업에서 종료됐지만 다른 수업에 활성 등록이 있음 (퇴원 섹션에서 제외)
                const hasActiveInOtherClass = hasEndDate &&
                    Array.from(activeClasses).some(c => c !== className);

                // isTransferredIn: 이 수업에 활성 등록이 있고, 다른 수업에서 종료된 기록이 있음 (반이동으로 온 학생)
                const hasEndedInOtherClass = !hasEndDate &&
                    Array.from(endedClasses).some(c => c !== className);

                // 모든 학생 포함 (퇴원/휴원도 카드에서 별도 섹션으로 표시)
                classStudentMap[className].add(studentId);

                enrollmentDataMap[className][studentId] = {
                    underline: data.underline,
                    enrollmentDate: startDate,
                    withdrawalDate: withdrawalDate || endDate,  // endDate도 퇴원으로 처리
                    onHold: data.onHold,
                    attendanceDays: data.attendanceDays || [],
                    isScheduled,  // 배정 예정 플래그
                    isTransferred: hasActiveInOtherClass,  // 반이동 나감 (퇴원 섹션에서 제외)
                    isTransferredIn: hasEndedInOtherClass,  // 반이동 들어옴 (초록색 배경으로 상단 표시)
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
                            enrollmentDate: classEnrollmentDate,
                            withdrawalDate: enrollmentData.withdrawalDate,
                            onHold: enrollmentData.onHold,
                            isMoved: false,
                            attendanceDays: enrollmentData.attendanceDays || [],  // 등원 요일
                            isScheduled: enrollmentData.isScheduled || false,  // 배정 예정
                            isTransferred: enrollmentData.isTransferred || false,  // 반이동 나감 (퇴원 아님)
                            isTransferredIn: enrollmentData.isTransferredIn || false,  // 반이동 들어옴 (초록 배경)
                        } as TimetableStudent;
                    })
                    .filter(Boolean) as TimetableStudent[];

                // Sort by name
                studentList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

                result[className] = {
                    studentList,
                    studentIds,
                };
            });

            return result;
        },
        // 시뮬레이션 모드에서는 실행하지 않음 (simulationData 사용)
        // studentMapReady: studentMap이 로드된 후에만 쿼리 실행 (초기 로딩 시 빈 결과 캐싱 방지)
        enabled: classNames.length > 0 && !isSimulationMode && studentMapReady,
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
