/**
 * useStudentFilters - Student filtering and sorting logic
 *
 * PURPOSE: Extract complex filtering logic from StudentManagementTab
 *
 * BENEFITS:
 * - 250+ lines of useMemo split into testable functions
 * - Each filter independently memoized for optimal performance
 * - Easy to debug and maintain
 * - Reusable across components
 *
 * PERFORMANCE: Vercel React Best Practices (rerender-derived-state)
 * - Original: 1 giant useMemo (250+ lines)
 * - Optimized: 7 independent memoized steps
 * - Result: Only changed filters re-run, not all 250 lines
 */

import { useMemo } from 'react';
import { UnifiedStudent } from '../types';
import { StudentFilters } from './useAppState';

type SearchField = 'all' | 'name' | 'englishName' | 'phone' | 'school' | 'address' | 'parent' | 'memo' | 'email' | 'etc';

/**
 * Filter students by search query (완전한 구현 - 모든 필드 지원)
 */
const filterBySearch = (
    students: UnifiedStudent[],
    searchQuery: string,
    searchField: SearchField,
    oldWithdrawnStudents: UnifiedStudent[]
): UnifiedStudent[] => {
    if (!searchQuery) return students;

    const query = searchQuery.toLowerCase();

    const filtered = students.filter((s) => {
        switch (searchField) {
            case 'all':
                return (
                    // 기본 정보
                    (s.name || '').toLowerCase().includes(query) ||
                    s.englishName?.toLowerCase().includes(query) ||
                    s.school?.toLowerCase().includes(query) ||
                    s.grade?.toLowerCase().includes(query) ||
                    s.nickname?.toLowerCase().includes(query) ||

                    // 연락처 정보
                    s.studentPhone?.includes(query) ||
                    s.parentPhone?.includes(query) ||
                    s.homePhone?.includes(query) ||
                    s.parentName?.toLowerCase().includes(query) ||
                    s.parentRelation?.toLowerCase().includes(query) ||
                    s.otherPhone?.includes(query) ||
                    s.otherPhoneRelation?.toLowerCase().includes(query) ||

                    // 주소 정보
                    s.zipCode?.includes(query) ||
                    s.address?.toLowerCase().includes(query) ||
                    s.addressDetail?.toLowerCase().includes(query) ||

                    // 추가 정보
                    s.birthDate?.includes(query) ||
                    s.studentEmail?.toLowerCase().includes(query) ||
                    s.emailDomain?.toLowerCase().includes(query) ||
                    s.enrollmentReason?.toLowerCase().includes(query) ||

                    // 수납 정보
                    s.cashReceiptNumber?.includes(query) ||

                    // 기타 정보
                    s.graduationYear?.includes(query) ||
                    s.customField1?.toLowerCase().includes(query) ||
                    s.customField2?.toLowerCase().includes(query) ||
                    s.memo?.toLowerCase().includes(query) ||

                    // 퇴원 정보
                    s.withdrawalReason?.toLowerCase().includes(query) ||
                    s.withdrawalMemo?.toLowerCase().includes(query)
                );

            case 'name':
                return (
                    (s.name || '').toLowerCase().includes(query) ||
                    s.englishName?.toLowerCase().includes(query) ||
                    s.nickname?.toLowerCase().includes(query)
                );

            case 'phone':
                return (
                    s.studentPhone?.includes(query) ||
                    s.parentPhone?.includes(query) ||
                    s.homePhone?.includes(query) ||
                    s.otherPhone?.includes(query)
                );

            case 'school':
                return s.school?.toLowerCase().includes(query);

            case 'address':
                return (
                    s.zipCode?.includes(query) ||
                    s.address?.toLowerCase().includes(query) ||
                    s.addressDetail?.toLowerCase().includes(query)
                );

            case 'parent':
                return (
                    s.parentName?.toLowerCase().includes(query) ||
                    s.parentRelation?.toLowerCase().includes(query) ||
                    s.otherPhoneRelation?.toLowerCase().includes(query)
                );

            case 'memo':
                return s.memo?.toLowerCase().includes(query);

            case 'email':
                return (
                    s.studentEmail?.toLowerCase().includes(query) ||
                    s.emailDomain?.toLowerCase().includes(query)
                );

            case 'etc':
                return (
                    s.birthDate?.includes(query) ||
                    s.grade?.toLowerCase().includes(query) ||
                    s.customField1?.toLowerCase().includes(query) ||
                    s.customField2?.toLowerCase().includes(query) ||
                    s.withdrawalReason?.toLowerCase().includes(query) ||
                    s.withdrawalMemo?.toLowerCase().includes(query) ||
                    s.cashReceiptNumber?.includes(query) ||
                    s.graduationYear?.includes(query) ||
                    s.enrollmentReason?.toLowerCase().includes(query)
                );

            default:
                return false;
        }
    });

    // 과거 퇴원생도 동일한 검색 필터 적용 후 추가 (중복 제거)
    const existingIds = new Set(filtered.map(s => s.id));
    const oldFiltered = oldWithdrawnStudents.filter(s => {
        if (existingIds.has(s.id)) return false;
        switch (searchField) {
            case 'all':
                return (
                    (s.name || '').toLowerCase().includes(query) ||
                    s.englishName?.toLowerCase().includes(query) ||
                    s.school?.toLowerCase().includes(query) ||
                    s.grade?.toLowerCase().includes(query) ||
                    s.nickname?.toLowerCase().includes(query) ||
                    s.studentPhone?.includes(query) ||
                    s.parentPhone?.includes(query) ||
                    s.parentName?.toLowerCase().includes(query) ||
                    s.memo?.toLowerCase().includes(query) ||
                    s.address?.toLowerCase().includes(query) ||
                    s.customField1?.toLowerCase().includes(query) ||
                    s.customField2?.toLowerCase().includes(query) ||
                    s.withdrawalReason?.toLowerCase().includes(query) ||
                    s.withdrawalMemo?.toLowerCase().includes(query)
                );
            case 'name':
                return (
                    (s.name || '').toLowerCase().includes(query) ||
                    s.englishName?.toLowerCase().includes(query) ||
                    s.nickname?.toLowerCase().includes(query)
                );
            case 'phone':
                return (
                    s.studentPhone?.includes(query) ||
                    s.parentPhone?.includes(query) ||
                    s.homePhone?.includes(query) ||
                    s.otherPhone?.includes(query)
                );
            case 'school':
                return s.school?.toLowerCase().includes(query);
            case 'memo':
                return s.memo?.toLowerCase().includes(query);
            default:
                return (s.name || '').toLowerCase().includes(query);
        }
    });
    return [...filtered, ...oldFiltered];
};

/**
 * Filter students by grade (완전한 구현 - 그룹 필터 지원)
 */
const filterByGrade = (students: UnifiedStudent[], grade: string): UnifiedStudent[] => {
    if (grade === 'all') return students;

    if (grade === 'elementary') {
        return students.filter((s) => s.grade?.startsWith('초'));
    } else if (grade === 'middle') {
        return students.filter((s) => s.grade?.startsWith('중'));
    } else if (grade === 'high') {
        return students.filter((s) => s.grade?.startsWith('고'));
    } else if (grade === 'other') {
        return students.filter((s) => {
            const g = s.grade;
            if (!g) return true;
            return !g.startsWith('초') && !g.startsWith('중') && !g.startsWith('고');
        });
    }

    return students.filter((s) => s.grade === grade);
};

/**
 * Filter students by status (완전한 구현 - prospect/on_hold/no_enrollment 지원)
 */
const filterByStatus = (students: UnifiedStudent[], status: string): UnifiedStudent[] => {
    if (status === 'all') return students;

    return students.filter((s) => {
        const studentStatus = s.status || 'active';

        if (status === 'prospect') {
            return studentStatus === 'prospect' || studentStatus === 'prospective';
        }

        if (status === 'on_hold') {
            if (studentStatus === 'on_hold') return true;

            const activeEnrollments = s.enrollments?.filter(e => !e.endDate) || [];
            if (activeEnrollments.length > 0) {
                const allOnHold = activeEnrollments.every(e => e.onHold === true);
                if (allOnHold) return true;
            }

            return false;
        }

        if (status === 'no_enrollment') {
            // 현재 수강 중인 enrollment가 없는 학생 (배정 예정 제외)
            const today = new Date().toISOString().split('T')[0];
            const activeStartedEnrollments = (s.enrollments || []).filter(e => {
                if (e.endDate) return false;
                const startDate = e.startDate;
                const isFuture = startDate && startDate > today;
                return !isFuture;
            });
            return activeStartedEnrollments.length === 0;
        }

        return studentStatus === status;
    });
};

/**
 * Filter students by subjects (OR/AND condition)
 * CoursesTab과 동일한 로직: 현재 수강 중인 수업만 (배정 예정 제외)
 * @param mode - 'OR': 하나라도 수강, 'AND': 모두 수강
 */
const filterBySubjects = (students: UnifiedStudent[], subjects: string[], mode: 'OR' | 'AND' = 'OR'): UnifiedStudent[] => {
    if (subjects.length === 0) return students;

    const today = new Date().toISOString().split('T')[0];

    return students.filter((s) => {
        if (s.status === 'withdrawn') return true;

        const studentSubjects = (s.enrollments || [])
            .filter(e => {
                // CoursesTab과 동일한 로직: endDate가 없고 startDate가 오늘 이전인 것만
                const hasEnded = !!e.endDate;
                const startDate = e.startDate;
                const isFuture = startDate && startDate > today;
                // 종료되지 않았고, 미래가 아닌 수업만 (현재 수강 중)
                return !hasEnded && !isFuture;
            })
            .map((e) => e.subject);

        if (mode === 'AND') {
            // AND 모드: 모든 선택된 과목을 수강하는 학생만
            return subjects.every((subject) => studentSubjects.includes(subject as any));
        } else {
            // OR 모드: 하나라도 수강하는 학생
            return subjects.some((subject) => studentSubjects.includes(subject as any));
        }
    });
};

/**
 * Filter students by teacher
 * CoursesTab과 동일한 로직: 현재 수강 중인 수업만 (배정 예정 제외)
 */
const filterByTeacher = (students: UnifiedStudent[], staffId: string): UnifiedStudent[] => {
    if (staffId === 'all') return students;

    const today = new Date().toISOString().split('T')[0];

    return students.filter((s) => {
        if (s.status === 'withdrawn') return true;

        return (s.enrollments || [])
            .filter(e => {
                // CoursesTab과 동일한 로직: endDate가 없고 startDate가 오늘 이전인 것만
                const hasEnded = !!e.endDate;
                const startDate = e.startDate;
                const isFuture = startDate && startDate > today;
                // 종료되지 않았고, 미래가 아닌 수업만 (현재 수강 중)
                return !hasEnded && !isFuture;
            })
            .some((e) => e.staffId === staffId);
    });
};

/**
 * Filter out students with no enrollment
 */
const filterByEnrollment = (students: UnifiedStudent[], excludeNoEnrollment: boolean): UnifiedStudent[] => {
    if (!excludeNoEnrollment) return students;

    return students.filter((s) => {
        if (s.status === 'withdrawn') return true;

        const today = new Date().toISOString().split('T')[0];

        const activeStartedEnrollments = (s.enrollments || []).filter(e => {
            if (e.endDate) return false;
            if (!e.enrollmentDate) return true;
            return e.enrollmentDate <= today;
        });

        return activeStartedEnrollments.length > 0;
    });
};

/**
 * 학교명에서 학제(초/중/고) 추출
 */
function getSchoolLevel(school: string): '초' | '중' | '고' | null {
    if (/초등학교|초$/.test(school)) return '초';
    if (/중학교|중$/.test(school)) return '중';
    if (/고등학교|고교|고$/.test(school)) return '고';
    return null;
}

/**
 * 학년에서 학제(초/중/고) 추출
 */
function getGradeLevel(grade: string): '초' | '중' | '고' | null {
    if (grade?.startsWith('초')) return '초';
    if (grade?.startsWith('중')) return '중';
    if (grade?.startsWith('고')) return '고';
    return null;
}

/**
 * Filter students by grade-school level mismatch
 * 학교명의 학제(초등학교/중학교/고등학교)와 학년의 학제(초/중/고)가 불일치하는 학생만 표시
 */
const filterByGradeMismatch = (students: UnifiedStudent[], gradeMismatch: boolean): UnifiedStudent[] => {
    if (!gradeMismatch) return students;
    return students.filter(s => {
        if (!s.school || !s.grade) return false;
        const schoolLevel = getSchoolLevel(s.school);
        const gradeLevel = getGradeLevel(s.grade);
        if (!schoolLevel || !gradeLevel) return false;
        return schoolLevel !== gradeLevel;
    });
};

/**
 * Sort students by specified field
 */
const sortStudents = (students: UnifiedStudent[], sortBy: 'name' | 'grade' | 'startDate'): UnifiedStudent[] => {
    const getGradeOrder = (grade: string | undefined): number => {
        if (!grade) return 999;
        const gradeMap: Record<string, number> = {
            '고3': 1, '고2': 2, '고1': 3,
            '중3': 4, '중2': 5, '중1': 6,
            '초6': 7, '초5': 8, '초4': 9, '초3': 10, '초2': 11, '초1': 12,
        };
        return gradeMap[grade] ?? 999;
    };

    return [...students].sort((a, b) => {
        if (sortBy === 'name') {
            return (a.name || '').localeCompare(b.name || '', 'ko');
        } else if (sortBy === 'grade') {
            const orderA = getGradeOrder(a.grade);
            const orderB = getGradeOrder(b.grade);
            if (orderA !== orderB) return orderA - orderB;
            return (a.name || '').localeCompare(b.name || '', 'ko');
        } else if (sortBy === 'startDate') {
            return (b.startDate || '').localeCompare(a.startDate || '');
        }
        return 0;
    });
};

/**
 * Main hook: Apply all filters and sorting with independent memoization
 */
export const useStudentFilters = (
    students: UnifiedStudent[],
    filters: StudentFilters,
    sortBy: 'name' | 'grade' | 'startDate',
    oldWithdrawnStudents: UnifiedStudent[]
) => {
    // OPTIMIZATION: Each filter independently memoized
    // Only re-runs when its specific dependencies change

    const searchFiltered = useMemo(
        () => filterBySearch(students, filters.searchQuery, filters.searchField, oldWithdrawnStudents),
        [students, filters.searchQuery, filters.searchField, oldWithdrawnStudents]
    );

    const gradeFiltered = useMemo(
        () => filterByGrade(searchFiltered, filters.grade),
        [searchFiltered, filters.grade]
    );

    const statusFiltered = useMemo(
        () => filterByStatus(gradeFiltered, filters.status),
        [gradeFiltered, filters.status]
    );

    const subjectFiltered = useMemo(
        () => filterBySubjects(statusFiltered, filters.subjects, filters.subjectFilterMode),
        [statusFiltered, filters.subjects, filters.subjectFilterMode]
    );

    const teacherFiltered = useMemo(
        () => filterByTeacher(subjectFiltered, filters.teacher),
        [subjectFiltered, filters.teacher]
    );

    const enrollmentFiltered = useMemo(
        () => filterByEnrollment(teacherFiltered, filters.excludeNoEnrollment),
        [teacherFiltered, filters.excludeNoEnrollment]
    );

    const mismatchFiltered = useMemo(
        () => filterByGradeMismatch(enrollmentFiltered, filters.gradeMismatch),
        [enrollmentFiltered, filters.gradeMismatch]
    );

    const sorted = useMemo(
        () => sortStudents(mismatchFiltered, sortBy),
        [mismatchFiltered, sortBy]
    );

    return sorted;
};
