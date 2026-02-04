/**
 * useStudentDuplicates - 중복 학생 감지 및 관리 hook
 *
 * 중복 기준: 이름 + 학교(정규화) + 학년이 같은 학생
 * 학교 정규화: "남산초등학교" = "남산초" (같은 학교로 취급)
 *
 * 대표 학생 자동 선택 기준:
 *   1. status === 'active' 학생
 *   2. enrollment 개수 많은 학생
 *   3. createdAt 오래된 학생
 *   4. 기본 정보 많이 채워진 학생
 */

import { useState, useMemo, useCallback } from 'react';
import { UnifiedStudent } from '../../../types';

/**
 * 학교명 정규화 (초등학교 → 초, 중학교 → 중, 고등학교 → 고)
 */
function normalizeSchool(school?: string): string {
  if (!school) return '';
  return school.trim()
    .replace(/초등학교$/g, '초')
    .replace(/중학교$/g, '중')
    .replace(/고등학교$/g, '고');
}

/**
 * 기존 학생 데이터에서 학교 약칭 → 정식명 자동 보정 맵 생성
 * 예: "일중"이 1명, "대구일중"이 10명이면 → "일중" → "대구일중"
 */
function buildSchoolCorrections(students: UnifiedStudent[]): Map<string, string> {
  const schoolCounts = new Map<string, number>();

  students.forEach(student => {
    const idParts = student.id.split('_');
    const isSemanticId = idParts.length >= 2 && !/^\d+$/.test(student.id) && !/^[a-zA-Z0-9]{15,}$/.test(student.id);
    if (isSemanticId) {
      const school = normalizeSchool(idParts[1]);
      if (school) schoolCounts.set(school, (schoolCounts.get(school) || 0) + 1);
    }
    const school = normalizeSchool(student.school);
    if (school) schoolCounts.set(school, (schoolCounts.get(school) || 0) + 1);
  });

  const allSchools = Array.from(schoolCounts.keys());
  const corrections = new Map<string, string>();

  for (const shortName of allSchools) {
    if (shortName.length > 2) continue; // 3자 이상은 정상 (침산초, 종로초 등)
    const matches = allSchools.filter(
      longName => longName.length > shortName.length && longName.endsWith(shortName)
    );
    if (matches.length === 1) {
      corrections.set(shortName, matches[0]);
    } else if (matches.length > 1) {
      matches.sort((a, b) => (schoolCounts.get(b) || 0) - (schoolCounts.get(a) || 0));
      corrections.set(shortName, matches[0]);
    }
  }

  return corrections;
}

/**
 * 학교명 정규화 + 약칭 보정 통합
 */
function fullNormalizeSchool(school: string, corrections?: Map<string, string>): string {
  const normalized = normalizeSchool(school);
  if (corrections && corrections.has(normalized)) {
    return corrections.get(normalized)!;
  }
  return normalized;
}

export interface DuplicateGroup {
  key: string;                     // 중복 키 (이름_학교_학년)
  name: string;                    // 이름
  school: string;                  // 학교
  grade: string;                   // 학년
  students: UnifiedStudent[];      // 해당 조합의 학생들
  primaryId: string | null;        // 대표 학생 ID
  isSelected: boolean;             // 병합 대상으로 선택됨
}

interface UseStudentDuplicatesReturn {
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;         // 중복된 총 학생 수
  totalGroups: number;             // 중복 그룹 수
  selectedGroups: number;          // 선택된 그룹 수
  isLoading: boolean;
  setPrimaryStudent: (groupKey: string, studentId: string) => void;
  toggleGroupSelection: (groupKey: string) => void;
  selectAllGroups: () => void;
  deselectAllGroups: () => void;
  autoSelectPrimary: () => void;
  getSelectedGroups: () => DuplicateGroup[];
}

/**
 * 학생의 점수 계산 (높을수록 대표 학생으로 적합)
 */
function calculateStudentScore(student: UnifiedStudent): number {
  let score = 0;

  // 1. 활성 상태 (최우선)
  if (student.status === 'active') score += 1000;
  if (student.status === 'prospect' || student.status === 'prospective') score += 500;

  // 2. enrollment 개수
  const enrollmentCount = student.enrollments?.length || 0;
  score += enrollmentCount * 100;

  // 3. 기본 정보 채워진 정도
  const fields = [
    'englishName', 'studentPhone', 'parentPhone', 'parentName',
    'birthDate', 'address', 'attendanceNumber', 'memo'
  ];
  fields.forEach(field => {
    if ((student as any)[field]) score += 10;
  });

  // 4. 생성일이 오래될수록 (기존 데이터 우선)
  if (student.createdAt) {
    const age = Date.now() - new Date(student.createdAt).getTime();
    score += Math.min(age / (1000 * 60 * 60 * 24), 365); // 최대 365일 보너스
  }

  return score;
}

/**
 * 중복 그룹의 대표 학생 자동 선택
 */
function selectBestPrimary(students: UnifiedStudent[]): string {
  if (students.length === 0) return '';
  if (students.length === 1) return students[0].id;

  const scored = students.map(s => ({
    student: s,
    score: calculateStudentScore(s)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].student.id;
}

export function useStudentDuplicates(
  students: UnifiedStudent[],
  isLoading: boolean = false
): UseStudentDuplicatesReturn {
  const [groupSelections, setGroupSelections] = useState<Record<string, {
    primaryId: string | null;
    isSelected: boolean;
  }>>({});

  // 학교 약칭 보정 맵 (데이터 기반)
  const schoolCorrections = useMemo(() => buildSchoolCorrections(students), [students]);

  // 중복 그룹 계산
  const duplicateGroups = useMemo(() => {
    const groupMap = new Map<string, UnifiedStudent[]>();

    // 문서 ID 기준 이름(접미사 포함) + 학교(정규화+약칭보정) + 학년으로 그룹화
    students.forEach(student => {
      // 문서 ID에서 이름 추출 (접미사 A/B/C 포함, 동명이인 구분)
      const idParts = student.id.split('_');
      const isSemanticId = idParts.length >= 3 && !/^\d+$/.test(student.id) && !/^[a-zA-Z0-9]{15,}$/.test(student.id);
      const name = isSemanticId ? idParts[0] : (student.name || '').trim();
      const school = isSemanticId ? fullNormalizeSchool(idParts[1], schoolCorrections) : fullNormalizeSchool(student.school || '', schoolCorrections);
      const grade = isSemanticId ? idParts.slice(2).join('_') : (student.grade || '').trim();

      // 이름이 없으면 스킵
      if (!name) return;

      const key = `${name}_${school}_${grade}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(student);
    });

    // 2명 이상인 그룹만 필터링
    const groups: DuplicateGroup[] = [];
    groupMap.forEach((groupStudents, key) => {
      if (groupStudents.length >= 2) {
        const [name, school, grade] = key.split('_');
        const selection = groupSelections[key];

        groups.push({
          key,
          name,
          school,
          grade,
          students: groupStudents.sort((a, b) =>
            calculateStudentScore(b) - calculateStudentScore(a)
          ),
          primaryId: selection?.primaryId ?? selectBestPrimary(groupStudents),
          isSelected: selection?.isSelected ?? false,
        });
      }
    });

    // 그룹 크기 순으로 정렬 (큰 그룹 먼저)
    groups.sort((a, b) => b.students.length - a.students.length);

    return groups;
  }, [students, groupSelections, schoolCorrections]);

  // 통계 계산
  const totalDuplicates = useMemo(() =>
    duplicateGroups.reduce((sum, g) => sum + g.students.length, 0),
    [duplicateGroups]
  );

  const totalGroups = duplicateGroups.length;

  const selectedGroups = useMemo(() =>
    duplicateGroups.filter(g => g.isSelected).length,
    [duplicateGroups]
  );

  // 대표 학생 설정
  const setPrimaryStudent = useCallback((groupKey: string, studentId: string) => {
    setGroupSelections(prev => ({
      ...prev,
      [groupKey]: {
        ...prev[groupKey],
        primaryId: studentId,
        isSelected: prev[groupKey]?.isSelected ?? false,
      }
    }));
  }, []);

  // 그룹 선택 토글
  const toggleGroupSelection = useCallback((groupKey: string) => {
    setGroupSelections(prev => {
      const current = prev[groupKey];
      const group = duplicateGroups.find(g => g.key === groupKey);

      return {
        ...prev,
        [groupKey]: {
          primaryId: current?.primaryId ?? (group ? selectBestPrimary(group.students) : null),
          isSelected: !(current?.isSelected ?? false),
        }
      };
    });
  }, [duplicateGroups]);

  // 모두 선택
  const selectAllGroups = useCallback(() => {
    const newSelections: typeof groupSelections = {};
    duplicateGroups.forEach(group => {
      newSelections[group.key] = {
        primaryId: groupSelections[group.key]?.primaryId ?? selectBestPrimary(group.students),
        isSelected: true,
      };
    });
    setGroupSelections(newSelections);
  }, [duplicateGroups, groupSelections]);

  // 모두 해제
  const deselectAllGroups = useCallback(() => {
    const newSelections: typeof groupSelections = {};
    duplicateGroups.forEach(group => {
      newSelections[group.key] = {
        primaryId: groupSelections[group.key]?.primaryId ?? null,
        isSelected: false,
      };
    });
    setGroupSelections(newSelections);
  }, [duplicateGroups, groupSelections]);

  // 대표 학생 자동 선택 (모든 그룹)
  const autoSelectPrimary = useCallback(() => {
    const newSelections: typeof groupSelections = {};
    duplicateGroups.forEach(group => {
      newSelections[group.key] = {
        primaryId: selectBestPrimary(group.students),
        isSelected: groupSelections[group.key]?.isSelected ?? false,
      };
    });
    setGroupSelections(newSelections);
  }, [duplicateGroups, groupSelections]);

  // 선택된 그룹 반환
  const getSelectedGroups = useCallback(() => {
    return duplicateGroups.filter(g => g.isSelected && g.primaryId);
  }, [duplicateGroups]);

  return {
    duplicateGroups,
    totalDuplicates,
    totalGroups,
    selectedGroups,
    isLoading,
    setPrimaryStudent,
    toggleGroupSelection,
    selectAllGroups,
    deselectAllGroups,
    autoSelectPrimary,
    getSelectedGroups,
  };
}
