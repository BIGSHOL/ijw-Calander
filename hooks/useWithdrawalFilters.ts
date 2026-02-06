import { useMemo, useState, useCallback } from 'react';
import { UnifiedStudent, Enrollment } from '../types';
import { WithdrawalSortBy, WithdrawalEntryType } from '../constants/withdrawal';

// 퇴원/수강종료 항목 래퍼
export interface WithdrawalEntry {
  student: UnifiedStudent;
  type: WithdrawalEntryType;
  // 수강종료된 과목 목록 (subject-ended일 때만 의미 있음)
  endedSubjects: string[];
  // 종료된 enrollment 목록
  endedEnrollments: Enrollment[];
  // 정렬에 사용할 대표 종료일
  effectiveDate: string;
}

export interface WithdrawalFilters {
  entryType: string; // '' | 'withdrawn' | 'subject-ended'
  subject: string;
  staffId: string;
  reason: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  sortBy: WithdrawalSortBy;
}

const DEFAULT_FILTERS: WithdrawalFilters = {
  entryType: '',
  subject: '',
  staffId: '',
  reason: '',
  dateFrom: '',
  dateTo: '',
  search: '',
  sortBy: 'withdrawalDate',
};

/**
 * 과목별 수강종료 여부 판정:
 * - 해당 과목의 모든 enrollment에 종료일(withdrawalDate/endDate)이 있고
 * - 현재 활성(종료일 없는) enrollment가 없으면 → 수강종료
 */
function getEndedSubjects(student: UnifiedStudent): { subjects: string[]; enrollments: Enrollment[] } {
  // 과목별 enrollment 그룹화
  const bySubject = new Map<string, Enrollment[]>();
  for (const e of student.enrollments) {
    const list = bySubject.get(e.subject) || [];
    list.push(e);
    bySubject.set(e.subject, list);
  }

  const endedSubjects: string[] = [];
  const endedEnrollments: Enrollment[] = [];

  for (const [subject, enrollments] of bySubject) {
    const hasActive = enrollments.some(e => !e.withdrawalDate && !e.endDate);
    if (!hasActive && enrollments.length > 0) {
      // 모든 enrollment이 종료됨 → 이 과목은 수강종료
      endedSubjects.push(subject);
      endedEnrollments.push(...enrollments);
    }
  }

  return { subjects: endedSubjects, enrollments: endedEnrollments };
}

export function useWithdrawalFilters(students: UnifiedStudent[]) {
  const [filters, setFilters] = useState<WithdrawalFilters>(DEFAULT_FILTERS);

  // 퇴원생 + 수강종료 학생 통합 추출
  const allEntries = useMemo(() => {
    const entries: WithdrawalEntry[] = [];

    for (const student of students) {
      if (student.status === 'withdrawn' || student.status === 'inactive') {
        // 완전 퇴원 (withdrawn 또는 inactive)
        entries.push({
          student,
          type: 'withdrawn',
          endedSubjects: [...new Set(student.enrollments.map(e => e.subject))],
          endedEnrollments: student.enrollments,
          effectiveDate: student.withdrawalDate || student.endDate || '',
        });
      } else if (student.status === 'active' || student.status === 'on_hold') {
        // 활성이지만 특정 과목 수강종료
        const { subjects, enrollments } = getEndedSubjects(student);
        if (subjects.length > 0) {
          // 가장 최근 종료일을 대표일로
          const latestDate = enrollments
            .map(e => e.withdrawalDate || e.endDate || '')
            .filter(Boolean)
            .sort()
            .pop() || '';

          entries.push({
            student,
            type: 'subject-ended',
            endedSubjects: subjects,
            endedEnrollments: enrollments,
            effectiveDate: latestDate,
          });
        }
      }
    }

    return entries;
  }, [students]);

  // 필터 적용
  const filteredEntries = useMemo(() => {
    let result = allEntries;

    // 유형 필터
    if (filters.entryType) {
      result = result.filter(e => e.type === filters.entryType);
    }

    // 과목 필터
    if (filters.subject) {
      result = result.filter(e => e.endedSubjects.includes(filters.subject));
    }

    // 강사 필터
    if (filters.staffId) {
      result = result.filter(e =>
        e.endedEnrollments.some(en => en.staffId === filters.staffId)
      );
    }

    // 퇴원 사유 필터 (퇴원 유형에만 해당)
    if (filters.reason) {
      result = result.filter(e =>
        e.type === 'withdrawn' && e.student.withdrawalReason === filters.reason
      );
    }

    // 기간 필터
    if (filters.dateFrom) {
      result = result.filter(e => e.effectiveDate >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter(e => e.effectiveDate <= filters.dateTo);
    }

    // 이름 검색
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(e => e.student.name.toLowerCase().includes(q));
    }

    // 정렬
    result = [...result].sort((a, b) => {
      if (filters.sortBy === 'name') {
        return a.student.name.localeCompare(b.student.name, 'ko');
      }
      // 종료일 기준 내림차순 (최근이 먼저)
      return b.effectiveDate.localeCompare(a.effectiveDate);
    });

    return result;
  }, [allEntries, filters]);

  // 유형별 카운트
  const counts = useMemo(() => {
    let withdrawn = 0;
    let subjectEnded = 0;
    for (const e of allEntries) {
      if (e.type === 'withdrawn') withdrawn++;
      else subjectEnded++;
    }
    return { total: allEntries.length, withdrawn, subjectEnded };
  }, [allEntries]);

  const updateFilter = useCallback(<K extends keyof WithdrawalFilters>(key: K, value: WithdrawalFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    filters,
    filteredEntries,
    counts,
    updateFilter,
    resetFilters,
  };
}
