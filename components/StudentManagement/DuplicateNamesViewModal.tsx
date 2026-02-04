/**
 * DuplicateNamesViewModal - 중복 학생 확인 모달
 *
 * DB 마이그레이션 후 중복된 학생을 확인하기 위한 모달
 * 이름 + 학교(정규화) + 학년으로 그룹화하여 실제 중복 데이터를 파악
 *
 * 중복 기준: 이름 + 학교 + 학년이 같은 경우
 * 학교 정규화: "남산초등학교" = "남산초" (같은 학교로 취급)
 */

import React, { useMemo, useState } from 'react';
import { X, Users, AlertTriangle, ChevronDown, ChevronRight, Trash2, RefreshCw, FileWarning, Filter, Settings, BarChart3 } from 'lucide-react';
import { useStudents } from '../../hooks/useStudents';
import { UnifiedStudent } from '../../types';
import { doc, deleteDoc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';

interface DuplicateNamesViewModalProps {
  onClose: () => void;
  students?: UnifiedStudent[];  // 외부에서 전달받으면 사용, 없으면 자체 로드
  onRefresh?: () => void;       // 외부 students 사용 시 삭제 후 새로고침 콜백
}

interface DuplicateGroup {
  key: string;          // name_school_grade
  name: string;
  school: string;
  grade: string;
  students: UnifiedStudent[];
}

/**
 * 학교명 정규화 (초등학교 → 초, 중학교 → 중, 고등학교 → 고)
 */
const normalizeSchool = (school?: string): string => {
  if (!school) return '';
  return school.trim()
    .replace(/초등학교$/g, '초')
    .replace(/중학교$/g, '중')
    .replace(/고등학교$/g, '고');
};

/**
 * 학교 약칭 → 정식명 자동 보정 맵 생성 (데이터 기반)
 * 기존 학생 데이터에서 학교명을 분석하여 약칭 → 정식명 매핑을 자동 생성
 * 예: "일중"이 1명, "대구일중"이 10명이면 → "일중" → "대구일중"
 */
const buildSchoolCorrections = (students: UnifiedStudent[]): Map<string, string> => {
  const schoolCounts = new Map<string, number>();

  students.forEach(student => {
    // ID에서 학교명 추출
    const idParts = student.id.split('_');
    const isSemanticId = idParts.length >= 2 && !/^\d+$/.test(student.id) && !/^[a-zA-Z0-9]{15,}$/.test(student.id);
    if (isSemanticId) {
      const school = normalizeSchool(idParts[1]);
      if (school) schoolCounts.set(school, (schoolCounts.get(school) || 0) + 1);
    }
    // school 필드에서도 수집
    const school = normalizeSchool(student.school);
    if (school) schoolCounts.set(school, (schoolCounts.get(school) || 0) + 1);
  });

  const allSchools = Array.from(schoolCounts.keys());
  const corrections = new Map<string, string>();

  for (const shortName of allSchools) {
    if (shortName.length > 2) continue; // 3자 이상은 이미 충분히 구체적 (침산초, 종로초 등)

    // 짧은 학교명이 더 긴 학교명의 접미사인 경우 찾기
    const matches = allSchools.filter(
      longName => longName.length > shortName.length && longName.endsWith(shortName)
    );

    if (matches.length === 1) {
      corrections.set(shortName, matches[0]);
    } else if (matches.length > 1) {
      // 여러 매칭이면 가장 많은 학생이 있는 학교 선택
      matches.sort((a, b) => (schoolCounts.get(b) || 0) - (schoolCounts.get(a) || 0));
      corrections.set(shortName, matches[0]);
    }
  }

  return corrections;
};

/**
 * 학교명 정규화 + 약칭 보정 통합
 */
const fullNormalizeSchool = (school: string, corrections?: Map<string, string>): string => {
  const normalized = normalizeSchool(school);
  if (corrections && corrections.has(normalized)) {
    return corrections.get(normalized)!;
  }
  return normalized;
};

/**
 * 문서 ID에서 이름 추출 (첫 번째 _ 이전 부분, 접미사 A/B/C 포함)
 * 예: "김민수_남산초_초3" → "김민수"
 * 예: "김민수A_남산초_초3" → "김민수A" (동명이인 구분)
 */
const extractNameFromId = (id: string): string => {
  if (/^\d+$/.test(id)) return '';
  if (/^[a-zA-Z0-9]{15,}$/.test(id)) return '';
  const parts = id.split('_');
  return parts[0] || '';
};

/**
 * 문서 ID 파싱 → {name, school, grade}
 * 이름은 접미사(A,B,C) 포함, 학교명은 정규화 + 약칭 보정 적용
 */
const parseStudentId = (id: string, schoolCorrections?: Map<string, string>): { name: string; school: string; grade: string } | null => {
  if (/^\d+$/.test(id) || /^[a-zA-Z0-9]{15,}$/.test(id)) return null;
  const parts = id.split('_');
  if (parts.length < 3) return null;
  const name = parts[0] || '';
  const school = fullNormalizeSchool(parts[1] || '', schoolCorrections);
  const grade = parts.slice(2).join('_') || '';
  return { name, school, grade };
};

/**
 * ID 정규화 필요 여부 확인
 * - 공백 포함: "류예준 _종로초_초2" → true
 * - 학교명 미정규화: "대구일중학교" → true
 * - 학교 약칭: "일중" (대구일중으로 보정 필요) → true
 */
const isIdNeedsNormalization = (id: string, schoolCorrections?: Map<string, string>): boolean => {
  // 공백 포함 여부
  if (/\s/.test(id)) return true;
  const parts = id.split('_');
  if (parts.length < 2) return false;
  // 학교명 정규화 필요 여부 (초등학교, 중학교, 고등학교)
  if (/초등학교|중학교|고등학교/.test(parts[1])) return true;
  // 학교 약칭 보정 필요 여부 (데이터 기반)
  if (schoolCorrections) {
    const normalized = normalizeSchool(parts[1]);
    if (schoolCorrections.has(normalized)) return true;
  }
  return false;
};

/**
 * ID를 정규화된 형태로 변환
 * - 공백 제거: "류예준 _종로초_초2" → "류예준_종로초_초2"
 * - 학교명 정규화: "박도현_대구일중학교_중1" → "박도현_대구일중_중1"
 * - 학교 약칭 보정: "박도현_일중_중1" → "박도현_대구일중_중1"
 */
const getNormalizedId = (id: string, schoolCorrections?: Map<string, string>): string => {
  // 각 파트의 앞뒤 공백 제거
  const parts = id.split('_').map(p => p.trim());
  if (parts.length < 2) return parts.join('_');
  parts[1] = fullNormalizeSchool(parts[1], schoolCorrections);
  return parts.join('_');
};

const DuplicateNamesViewModal: React.FC<DuplicateNamesViewModalProps> = ({ onClose, students: externalStudents, onRefresh }) => {
  const queryClient = useQueryClient();
  const { students: internalStudents, loading: internalLoading, refreshStudents: internalRefresh } = useStudents(!externalStudents); // 외부 데이터 없을 때만 로드
  const students = externalStudents || internalStudents;
  const loading = externalStudents ? false : internalLoading;

  // 학교 약칭 → 정식명 자동 보정 맵 (데이터 기반)
  const schoolCorrections = useMemo(() => buildSchoolCorrections(students), [students]);

  // 삭제/수정 후 캐시 무효화 + 리프레시
  const invalidateAndRefresh = async () => {
    // React Query 캐시 완전 무효화
    await queryClient.invalidateQueries({ queryKey: ['students'] });
    // 외부 콜백도 호출
    if (onRefresh) await onRefresh();
    else await internalRefresh();
  };
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showMismatchOnly, setShowMismatchOnly] = useState(false);
  const [showAbnormalList, setShowAbnormalList] = useState(false);
  const [showMismatchList, setShowMismatchList] = useState(false);
  const [showUnnormalizedList, setShowUnnormalizedList] = useState(false);
  const [normalizeResult, setNormalizeResult] = useState<{ errors: string[]; skipped: string[] } | null>(null);

  // 문서 ID 기준 이름(접미사 포함) + 학교(정규화+약칭보정) + 학년으로 그룹화하여 중복 찾기
  const duplicateGroups = useMemo((): DuplicateGroup[] => {
    const groupMap = new Map<string, UnifiedStudent[]>();

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
    const duplicates: DuplicateGroup[] = [];
    groupMap.forEach((studentList, key) => {
      if (studentList.length >= 2) {
        const [name, school, grade] = key.split('_');
        duplicates.push({
          key,
          name,
          school,
          grade,
          students: studentList.sort((a, b) => {
            // 재원 > 퇴원 순으로 정렬
            if (a.status === 'withdrawn' && b.status !== 'withdrawn') return 1;
            if (a.status !== 'withdrawn' && b.status === 'withdrawn') return -1;
            // 수강 수업이 많은 학생 우선
            const aEnrollments = a.enrollments?.filter(e => !e.endDate).length || 0;
            const bEnrollments = b.enrollments?.filter(e => !e.endDate).length || 0;
            return bEnrollments - aEnrollments;
          }),
        });
      }
    });

    // 중복 수가 많은 순으로 정렬
    return duplicates.sort((a, b) => b.students.length - a.students.length);
  }, [students, schoolCorrections]);

  const totalDuplicateStudents = duplicateGroups.reduce((sum, g) => sum + g.students.length, 0);

  // ID-데이터 불일치 학생 찾기 (문서 ID의 이름과 실제 이름이 다른 경우)
  const mismatchedStudents = useMemo(() => {
    return students.filter(student => {
      const idName = extractNameFromId(student.id);
      const actualName = (student.name || '').trim();
      // ID에서 이름을 추출할 수 없거나 (숫자 ID 등), 이름이 없으면 제외
      if (!idName || !actualName) return false;
      // ID의 이름과 실제 이름이 다르면 불일치
      return idName !== actualName;
    });
  }, [students]);

  // 예비(prospect/prospective) 상태 학생 찾기
  const prospectStudents = useMemo(() => {
    return students.filter(student =>
      student.status === 'prospect' || student.status === 'prospective'
    );
  }, [students]);

  // 이상한 형태의 학생 문서 찾기
  const abnormalStudents = useMemo(() => {
    return students.filter(student => {
      const id = student.id;
      const name = (student.name || '').trim();

      // 1. 이름이 비어있는 경우
      if (!name) return true;

      // 2. 숫자로만 된 ID (4-6자리)
      if (/^\d{4,6}$/.test(id)) return true;

      // 3. Firebase 자동생성 ID (20자 이상 영숫자)
      if (/^[a-zA-Z0-9]{20,}$/.test(id)) return true;

      // 4. 너무 짧은 ID (3자 이하)
      if (id.length <= 3) return true;

      // 5. 특수문자만 있거나 이상한 패턴
      if (!/^[가-힣a-zA-Z0-9_-]+$/.test(id)) return true;

      return false;
    });
  }, [students]);

  // ID에 정규화가 필요한 학생 (초등학교/중학교/고등학교, 공백, 학교 약칭)
  const unnormalizedIdStudents = useMemo(() => {
    return students.filter(student => isIdNeedsNormalization(student.id, schoolCorrections));
  }, [students, schoolCorrections]);

  // 이상한 형태 유형 분류
  const getAbnormalType = (student: UnifiedStudent): string => {
    const id = student.id;
    const name = (student.name || '').trim();

    if (!name) return '이름 없음';
    if (/^\d{4,6}$/.test(id)) return '숫자 ID';
    if (/^[a-zA-Z0-9]{20,}$/.test(id)) return '자동생성 ID';
    if (id.length <= 3) return '짧은 ID';
    if (!/^[가-힣a-zA-Z0-9_-]+$/.test(id)) return '특수문자 ID';
    return '기타';
  };

  // 이상한 학생 일괄 삭제
  const handleDeleteAllAbnormal = async () => {
    if (abnormalStudents.length === 0) {
      alert('이상한 형태의 학생 문서가 없습니다.');
      return;
    }

    if (!confirm(`이상한 형태의 학생 문서 ${abnormalStudents.length}개를 모두 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setIsBatchDeleting(true);
    let deleted = 0;
    let errors = 0;

    try {
      for (const student of abnormalStudents) {
        try {
          await deleteDoc(doc(db, 'students', student.id));
          deleted++;
        } catch (error) {
          console.error(`학생 삭제 실패 (${student.id}):`, error);
          errors++;
        }
      }

      await invalidateAndRefresh();
      alert(`삭제 완료!\n- 삭제됨: ${deleted}개\n- 오류: ${errors}건`);
    } catch (error) {
      console.error('일괄 삭제 실패:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // 예비 → 재원 일괄 변경
  const handleConvertProspectToActive = async () => {
    if (prospectStudents.length === 0) {
      alert('예비 상태 학생이 없습니다.');
      return;
    }

    if (!confirm(`예비 상태 학생 ${prospectStudents.length}명을 모두 재원으로 변경하시겠습니까?`)) {
      return;
    }

    setIsBatchDeleting(true);
    let converted = 0;
    let errors = 0;

    try {
      for (const student of prospectStudents) {
        try {
          const docRef = doc(db, 'students', student.id);
          await setDoc(docRef, {
            status: 'active',
            updatedAt: new Date().toISOString(),
            _previousStatus: student.status,
          }, { merge: true });
          converted++;
        } catch (error) {
          console.error(`상태 변경 실패 (${student.id}):`, error);
          errors++;
        }
      }

      await invalidateAndRefresh();
      alert(`상태 변경 완료!\n- 변경됨: ${converted}명\n- 오류: ${errors}건`);
    } catch (error) {
      console.error('일괄 변경 실패:', error);
      alert('일괄 변경 중 오류가 발생했습니다.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // 불일치 학생 일괄 삭제
  const handleDeleteAllMismatched = async () => {
    if (mismatchedStudents.length === 0) {
      alert('ID-데이터 불일치 학생이 없습니다.');
      return;
    }

    if (!confirm(`ID-데이터 불일치 학생 ${mismatchedStudents.length}명을 모두 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setIsBatchDeleting(true);
    let deleted = 0;
    let errors = 0;

    try {
      for (const student of mismatchedStudents) {
        try {
          await deleteDoc(doc(db, 'students', student.id));
          deleted++;
        } catch (error) {
          console.error(`학생 삭제 실패 (${student.id}):`, error);
          errors++;
        }
      }

      await invalidateAndRefresh();
      alert(`삭제 완료!\n- 삭제됨: ${deleted}명\n- 오류: ${errors}건`);
    } catch (error) {
      console.error('일괄 삭제 실패:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // 불일치 학생 name/school/grade 필드 수정 (문서 ID 기준)
  const handleFixAllMismatched = async () => {
    if (mismatchedStudents.length === 0) {
      alert('ID-데이터 불일치 학생이 없습니다.');
      return;
    }

    if (!confirm(`ID-데이터 불일치 학생 ${mismatchedStudents.length}명의 정보를 ID 기준으로 수정하시겠습니까?\n\n문서 ID에서 이름/학교/학년을 추출하여 덮어씁니다.\n예: 김지완_칠산초_초6 → name:"김지완", school:"칠산초", grade:"초6"`)) {
      return;
    }

    setIsBatchDeleting(true);
    let fixed = 0;
    let errors = 0;

    try {
      for (const student of mismatchedStudents) {
        try {
          const parsed = parseStudentId(student.id, schoolCorrections);
          if (!parsed || !parsed.name) {
            errors++;
            continue;
          }

          const docRef = doc(db, 'students', student.id);
          await setDoc(docRef, {
            name: parsed.name,
            school: parsed.school,
            grade: parsed.grade,
            updatedAt: new Date().toISOString(),
            _previousName: student.name,
          }, { merge: true });

          fixed++;
        } catch (error) {
          console.error(`수정 실패 (${student.id}):`, error);
          errors++;
        }
      }

      await invalidateAndRefresh();
      alert(`수정 완료!\n- 수정됨: ${fixed}명\n- 오류: ${errors}건`);
    } catch (error) {
      console.error('일괄 수정 실패:', error);
      alert('일괄 수정 중 오류가 발생했습니다.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // 비정규 ID 일괄 정규화 (문서 이동 + 필드 동기화)
  // 예: 박도현_대구일중학교_중1 → 박도현_대구일중_중1
  const handleNormalizeAllIds = async () => {
    if (unnormalizedIdStudents.length === 0) {
      alert('정규화가 필요한 ID가 없습니다.');
      return;
    }

    const examples = unnormalizedIdStudents.slice(0, 3).map(s =>
      `  ${s.id} → ${getNormalizedId(s.id, schoolCorrections)}`
    ).join('\n');

    if (!confirm(`학교명이 정규화되지 않은 학생 ${unnormalizedIdStudents.length}명의 문서 ID를 정규화하시겠습니까?\n\n${examples}${unnormalizedIdStudents.length > 3 ? `\n  ...외 ${unnormalizedIdStudents.length - 3}건` : ''}\n\n문서가 새 ID로 이동되고, name/school/grade 필드도 동기화됩니다.`)) {
      return;
    }

    setIsBatchDeleting(true);
    setNormalizeResult(null);
    let fixed = 0;
    const errorList: string[] = [];
    const skippedList: string[] = [];

    try {
      const allStudentIds = new Set(students.map(s => s.id));

      for (const student of unnormalizedIdStudents) {
        try {
          const newId = getNormalizedId(student.id, schoolCorrections);
          if (newId === student.id) {
            skippedList.push(`${student.id} (변환 결과 동일)`);
            continue;
          }

          // 새 ID 충돌 확인
          if (allStudentIds.has(newId)) {
            skippedList.push(`${student.id} → ${newId} (이미 존재)`);
            continue;
          }

          // 기존 문서 전체 데이터 읽기
          const oldDocRef = doc(db, 'students', student.id);
          const oldDocSnap = await getDoc(oldDocRef);
          if (!oldDocSnap.exists()) {
            errorList.push(`${student.id} (문서 없음)`);
            continue;
          }

          const studentData = oldDocSnap.data();
          const parsed = parseStudentId(newId, schoolCorrections);

          // 새 문서 생성 (필드 동기화 포함)
          const newDocRef = doc(db, 'students', newId);
          await setDoc(newDocRef, {
            ...studentData,
            ...(parsed ? { name: parsed.name, school: parsed.school, grade: parsed.grade } : {}),
            _firestoreDocId: newId,
            _previousId: student.id,
            _previousName: studentData.name || student.name,
            updatedAt: new Date().toISOString(),
          });

          // enrollments 서브컬렉션 이동
          const oldEnrollments = await getDocs(collection(db, 'students', student.id, 'enrollments'));
          for (const enrollDoc of oldEnrollments.docs) {
            await setDoc(
              doc(db, 'students', newId, 'enrollments', enrollDoc.id),
              enrollDoc.data()
            );
            await deleteDoc(enrollDoc.ref);
          }

          // 기존 문서 삭제
          await deleteDoc(oldDocRef);

          allStudentIds.add(newId);
          allStudentIds.delete(student.id);
          fixed++;
        } catch (error: any) {
          errorList.push(`${student.id} (${error?.message || '알 수 없는 오류'})`);
        }
      }

      await invalidateAndRefresh();
      setNormalizeResult({ errors: errorList, skipped: skippedList });
      alert(`ID 정규화 완료!\n- 이동됨: ${fixed}명\n- 스킵: ${skippedList.length}명\n- 오류: ${errorList.length}건${errorList.length > 0 ? '\n\n상세 내역은 모달에서 확인하세요.' : ''}`);
    } catch (error) {
      console.error('일괄 정규화 실패:', error);
      alert('일괄 정규화 중 오류가 발생했습니다.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedNames(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedNames(new Set(duplicateGroups.map(g => g.key)));
  };

  const collapseAll = () => {
    setExpandedNames(new Set());
  };

  // 학생 삭제 (hard delete)
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`정말로 "${studentName}" 학생을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setDeletingId(studentId);
    try {
      await deleteDoc(doc(db, 'students', studentId));
      await invalidateAndRefresh();
    } catch (error) {
      console.error('학생 삭제 실패:', error);
      alert('학생 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // 수강 없는 중복 학생 수 계산
  const noEnrollmentDuplicates = useMemo(() => {
    const result: UnifiedStudent[] = [];
    duplicateGroups.forEach(group => {
      group.students.forEach(student => {
        const activeEnrollments = student.enrollments?.filter(e => !e.endDate) || [];
        if (activeEnrollments.length === 0) {
          result.push(student);
        }
      });
    });
    return result;
  }, [duplicateGroups]);

  // 수강 없는 중복 학생 일괄 삭제
  const handleDeleteAllNoEnrollment = async () => {
    if (noEnrollmentDuplicates.length === 0) {
      alert('수강 정보가 없는 중복 학생이 없습니다.');
      return;
    }

    if (!confirm(`수강 정보가 없는 중복 학생 ${noEnrollmentDuplicates.length}명을 모두 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setIsBatchDeleting(true);
    let deleted = 0;
    let errors = 0;

    try {
      for (const student of noEnrollmentDuplicates) {
        try {
          await deleteDoc(doc(db, 'students', student.id));
          deleted++;
        } catch (error) {
          console.error(`학생 삭제 실패 (${student.id}):`, error);
          errors++;
        }
      }

      await invalidateAndRefresh();
      alert(`삭제 완료!\n- 삭제됨: ${deleted}명\n- 오류: ${errors}건`);
    } catch (error) {
      console.error('일괄 삭제 실패:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // 그룹 전체 삭제
  const handleDeleteGroup = async (group: DuplicateGroup) => {
    if (!confirm(`"${group.name}" 그룹의 학생 ${group.students.length}명을 모두 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setDeletingId(`group_${group.key}`);
    try {
      for (const student of group.students) {
        await deleteDoc(doc(db, 'students', student.id));
      }
      await invalidateAndRefresh();
    } catch (error) {
      console.error('그룹 삭제 실패:', error);
      alert('그룹 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // ID-데이터 불일치 여부 확인
  const isIdMismatched = (student: UnifiedStudent): boolean => {
    const idName = extractNameFromId(student.id);
    const actualName = (student.name || '').trim();
    if (!idName || !actualName) return false;
    return idName !== actualName;
  };

  const getStatusBadge = (student: UnifiedStudent) => {
    if (student.status === 'withdrawn') {
      return <span className="px-1.5 py-0.5 text-micro bg-gray-200 text-gray-600 rounded-sm">퇴원</span>;
    }
    if (student.status === 'prospect' || student.status === 'prospective') {
      return <span className="px-1.5 py-0.5 text-micro bg-blue-100 text-blue-600 rounded-sm">상담</span>;
    }
    return <span className="px-1.5 py-0.5 text-micro bg-green-100 text-green-600 rounded-sm">재원</span>;
  };

  const getEnrollmentInfo = (student: UnifiedStudent) => {
    const active = student.enrollments?.filter(e => !e.endDate) || [];
    if (active.length === 0) return <span className="text-gray-400">수강 없음</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {active.map((e, i) => (
          <span key={i} className="px-1.5 py-0.5 text-micro bg-amber-100 text-amber-700 rounded-sm">
            {e.subject === 'math' ? '수학' : '영어'}: {e.className}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100] p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#081429] rounded-t-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">중복 이름 학생 확인</h2>
            <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-sm">
              임시 UI
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-start justify-center pt-[8vh] h-40">
              <div className="text-center text-gray-500">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-sm mx-auto mb-2" />
                <p className="text-sm">학생 데이터 로딩 중...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Section 1: 필터 및 설정 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Filter className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">필터 및 설정</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {/* 불일치 목록 토글 */}
                  {mismatchedStudents.length > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-purple-600" />
                        <span className="text-xs font-medium text-[#373d41]">ID-데이터 불일치</span>
                        <span className="text-xs text-purple-600">
                          {mismatchedStudents.length}명
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowMismatchList(prev => !prev)}
                          className={`px-2 py-1 text-xs rounded-sm transition-colors ${
                            showMismatchList
                              ? 'bg-purple-500 text-white'
                              : 'text-purple-700 hover:bg-purple-100'
                          }`}
                        >
                          {showMismatchList ? '목록 숨기기' : '목록 보기'}
                        </button>
                        <button
                          onClick={() => setShowMismatchOnly(prev => !prev)}
                          className={`px-2 py-1 text-xs rounded-sm transition-colors ${
                            showMismatchOnly
                              ? 'bg-purple-500 text-white'
                              : 'text-purple-700 hover:bg-purple-100'
                          }`}
                        >
                          {showMismatchOnly ? '전체 보기' : '불일치만 보기'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 비정규 ID 목록 토글 */}
                  {unnormalizedIdStudents.length > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 text-rose-600" />
                        <span className="text-xs font-medium text-[#373d41]">비정규 ID</span>
                        <span className="text-xs text-rose-600">
                          {unnormalizedIdStudents.length}명
                        </span>
                      </div>
                      <button
                        onClick={() => setShowUnnormalizedList(prev => !prev)}
                        className={`px-2 py-1 text-xs rounded-sm transition-colors ${
                          showUnnormalizedList
                            ? 'bg-rose-500 text-white'
                            : 'text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {showUnnormalizedList ? '목록 숨기기' : '목록 보기'}
                      </button>
                    </div>
                  )}

                  {/* 이상한 형태 목록 토글 */}
                  {abnormalStudents.length > 0 && (
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <FileWarning className="w-3 h-3 text-orange-600" />
                        <span className="text-xs font-medium text-[#373d41]">이상한 문서</span>
                        <span className="text-xs text-orange-600">
                          {abnormalStudents.length}개
                        </span>
                      </div>
                      <button
                        onClick={() => setShowAbnormalList(prev => !prev)}
                        className={`px-2 py-1 text-xs rounded-sm transition-colors ${
                          showAbnormalList
                            ? 'bg-orange-500 text-white'
                            : 'text-orange-700 hover:bg-orange-100'
                        }`}
                      >
                        {showAbnormalList ? '목록 숨기기' : '목록 보기'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: 통계 요약 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <BarChart3 className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">통계 요약</h3>
                </div>
                <div className="p-2 space-y-2">
                  {/* 중복 그룹 통계 */}
                  <div className="flex items-center gap-3 p-2 bg-amber-50 rounded-sm border border-amber-100">
                    <Users className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-amber-800">
                        중복 그룹: {duplicateGroups.length}개
                      </div>
                      <div className="text-xs text-amber-600">
                        총 {totalDuplicateStudents}명
                        {noEnrollmentDuplicates.length > 0 && (
                          <span className="ml-2 text-red-600">
                            (수강 없음: {noEnrollmentDuplicates.length}명)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ID-데이터 불일치 통계 */}
                  {mismatchedStudents.length > 0 && (
                    <div className="flex items-center gap-3 p-2 bg-purple-50 rounded-sm border border-purple-100">
                      <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-purple-800">
                          ID-데이터 불일치: {mismatchedStudents.length}명
                        </div>
                        <div className="text-xs text-purple-600">
                          문서 ID의 이름과 실제 이름이 다름
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 예비 상태 통계 */}
                  {prospectStudents.length > 0 && (
                    <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-sm border border-blue-100">
                      <Users className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-blue-800">
                          예비 상태: {prospectStudents.length}명
                        </div>
                        <div className="text-xs text-blue-600">
                          재원으로 변경 필요
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 비정규 ID 통계 */}
                  {unnormalizedIdStudents.length > 0 && (
                    <div className="flex items-center gap-3 p-2 bg-rose-50 rounded-sm border border-rose-100">
                      <RefreshCw className="w-4 h-4 text-rose-600 shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-rose-800">
                          비정규 ID: {unnormalizedIdStudents.length}명
                        </div>
                        <div className="text-xs text-rose-600">
                          초등학교→초, 중학교→중, 고등학교→고, 학교약칭 보정
                          {schoolCorrections.size > 0 && (
                            <span className="ml-1 text-blue-600">
                              (약칭 {schoolCorrections.size}건: {Array.from(schoolCorrections.entries()).map(([k, v]) => `${k}→${v}`).join(', ')})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 이상한 문서 통계 */}
                  {abnormalStudents.length > 0 && (
                    <div className="flex items-center gap-3 p-2 bg-orange-50 rounded-sm border border-orange-100">
                      <FileWarning className="w-4 h-4 text-orange-600 shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-orange-800">
                          이상한 문서: {abnormalStudents.length}개
                        </div>
                        <div className="text-xs text-orange-600">
                          이름없음, 숫자ID, 자동생성ID 등
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 불일치 학생 목록 (토글) */}
              {showMismatchList && mismatchedStudents.length > 0 && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-purple-50 border-b border-purple-200">
                    <AlertTriangle className="w-3 h-3 text-purple-600" />
                    <h3 className="text-purple-800 font-bold text-xs">ID-데이터 불일치 상세 목록</h3>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-purple-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left text-purple-700">문서 ID</th>
                          <th className="px-2 py-1 text-left text-purple-700">ID 이름</th>
                          <th className="px-2 py-1 text-left text-purple-700">실제 이름</th>
                          <th className="px-2 py-1 text-left text-purple-700">학교</th>
                          <th className="px-2 py-1 text-left text-purple-700">학년</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100">
                        {mismatchedStudents.map(student => {
                          const parsed = parseStudentId(student.id, schoolCorrections);
                          return (
                            <tr key={student.id} className="hover:bg-purple-50">
                              <td className="px-2 py-1 font-mono text-gray-600 max-w-[160px] truncate" title={student.id}>{student.id}</td>
                              <td className="px-2 py-1 text-purple-700 font-medium">{extractNameFromId(student.id)}</td>
                              <td className="px-2 py-1 text-red-600">{student.name}</td>
                              <td className="px-2 py-1 text-gray-600">{parsed?.school || student.school || '-'}</td>
                              <td className="px-2 py-1 text-gray-600">{parsed?.grade || student.grade || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 비정규 ID 목록 (토글) */}
              {showUnnormalizedList && unnormalizedIdStudents.length > 0 && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-rose-50 border-b border-rose-200">
                    <RefreshCw className="w-3 h-3 text-rose-600" />
                    <h3 className="text-rose-800 font-bold text-xs">비정규 ID 상세 목록</h3>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-rose-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left text-rose-700">현재 ID</th>
                          <th className="px-2 py-1 text-left text-rose-700">→</th>
                          <th className="px-2 py-1 text-left text-rose-700">정규화 ID</th>
                          <th className="px-2 py-1 text-left text-rose-700">문제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {unnormalizedIdStudents.map(student => {
                          const newId = getNormalizedId(student.id, schoolCorrections);
                          const hasSpace = /\s/.test(student.id);
                          const hasFullSchool = /초등학교|중학교|고등학교/.test(student.id);
                          const idParts = student.id.split('_');
                          const hasAbbreviation = idParts.length >= 2 && schoolCorrections.has(normalizeSchool(idParts[1]));
                          return (
                            <tr key={student.id} className="hover:bg-rose-50">
                              <td className="px-2 py-1 font-mono text-gray-600 max-w-[180px] truncate" title={student.id}>{student.id}</td>
                              <td className="px-2 py-1 text-gray-400">→</td>
                              <td className="px-2 py-1 font-mono text-green-700 font-medium max-w-[180px] truncate" title={newId}>{newId}</td>
                              <td className="px-2 py-1">
                                {hasSpace && <span className="px-1 py-0.5 bg-yellow-200 text-yellow-800 rounded-sm text-micro mr-1">공백</span>}
                                {hasFullSchool && <span className="px-1 py-0.5 bg-rose-200 text-rose-800 rounded-sm text-micro mr-1">학교명</span>}
                                {hasAbbreviation && <span className="px-1 py-0.5 bg-blue-200 text-blue-800 rounded-sm text-micro">약칭</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 정규화 결과 상세 (오류/스킵) */}
              {normalizeResult && (normalizeResult.errors.length > 0 || normalizeResult.skipped.length > 0) && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-gray-600" />
                      <h3 className="text-[#081429] font-bold text-xs">최근 정규화 결과</h3>
                    </div>
                    <button onClick={() => setNormalizeResult(null)} className="text-xs text-gray-500 hover:text-gray-700">닫기</button>
                  </div>
                  <div className="max-h-40 overflow-y-auto p-2 space-y-2 text-xs">
                    {normalizeResult.skipped.length > 0 && (
                      <div>
                        <div className="font-medium text-amber-700 mb-1">스킵 ({normalizeResult.skipped.length}건)</div>
                        {normalizeResult.skipped.map((msg, i) => (
                          <div key={i} className="text-gray-600 pl-2 py-0.5 border-l-2 border-amber-300">{msg}</div>
                        ))}
                      </div>
                    )}
                    {normalizeResult.errors.length > 0 && (
                      <div>
                        <div className="font-medium text-red-700 mb-1">오류 ({normalizeResult.errors.length}건)</div>
                        {normalizeResult.errors.map((msg, i) => (
                          <div key={i} className="text-gray-600 pl-2 py-0.5 border-l-2 border-red-300">{msg}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 이상한 학생 목록 표시 (토글) */}
              {showAbnormalList && abnormalStudents.length > 0 && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-orange-50 border-b border-orange-200">
                    <FileWarning className="w-3 h-3 text-orange-600" />
                    <h3 className="text-orange-800 font-bold text-xs">이상한 문서 상세 목록</h3>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-orange-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left text-orange-700">ID</th>
                          <th className="px-2 py-1 text-left text-orange-700">이름</th>
                          <th className="px-2 py-1 text-left text-orange-700">유형</th>
                          <th className="px-2 py-1 text-left text-orange-700">학교</th>
                          <th className="px-2 py-1 text-center text-orange-700">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100">
                        {abnormalStudents.map(student => (
                          <tr key={student.id} className="hover:bg-orange-50">
                            <td className="px-2 py-1 font-mono text-gray-600 max-w-[120px] truncate" title={student.id}>
                              {student.id.slice(0, 15)}...
                            </td>
                            <td className="px-2 py-1 text-gray-700">{student.name || '(없음)'}</td>
                            <td className="px-2 py-1">
                              <span className="px-1.5 py-0.5 bg-orange-200 text-orange-700 rounded-sm text-micro">
                                {getAbnormalType(student)}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-gray-600">{student.school || '-'}</td>
                            <td className="px-2 py-1 text-center">
                              <button
                                onClick={() => handleDeleteStudent(student.id, student.name || student.id)}
                                disabled={deletingId === student.id}
                                className="p-1 text-red-500 hover:bg-red-100 rounded-sm disabled:opacity-50"
                              >
                                {deletingId === student.id ? (
                                  <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-sm animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 3: 중복 그룹 목록 */}
              {duplicateGroups.length === 0 ? (
                <div className="flex items-start justify-center pt-[8vh] h-40">
                  <div className="text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">중복된 이름이 없습니다.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#081429]" />
                      <h3 className="text-[#081429] font-bold text-xs">중복 그룹 목록</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={expandAll}
                        className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 rounded-sm transition-colors"
                      >
                        모두 펼치기
                      </button>
                      <button
                        onClick={collapseAll}
                        className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 rounded-sm transition-colors"
                      >
                        모두 접기
                      </button>
                    </div>
                  </div>
                  <div className="p-2 space-y-2 max-h-[40vh] overflow-y-auto">
                    {duplicateGroups
                      .filter(group => !showMismatchOnly || group.students.some(s => isIdMismatched(s)))
                      .map((group) => {
                      const isExpanded = expandedNames.has(group.key);
                      const hasMismatch = group.students.some(s => isIdMismatched(s));
                      return (
                        <div key={group.key} className="border border-gray-200 rounded-sm overflow-hidden">
                          {/* 그룹 헤더 */}
                          <div className="flex items-center justify-between p-3 bg-gray-50">
                            <button
                              onClick={() => toggleExpand(group.key)}
                              className="flex items-center gap-3 hover:bg-gray-100 rounded-sm px-2 py-1 -ml-2 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                              <span className="font-bold text-[#081429]">{group.name}</span>
                              {(group.school || group.grade) && (
                                <span className="text-xs text-gray-500">
                                  {group.school} {group.grade}
                                </span>
                              )}
                              <span className="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded-sm font-medium">
                                {group.students.length}명
                              </span>
                              {hasMismatch && (
                                <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-sm font-medium">
                                  ID불일치
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(group)}
                              disabled={deletingId === `group_${group.key}`}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-sm transition-colors disabled:opacity-50"
                              title="그룹 전체 삭제"
                            >
                              {deletingId === `group_${group.key}` ? (
                                <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-sm animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>전체 삭제</span>
                            </button>
                          </div>

                          {/* 그룹 상세 */}
                          {isExpanded && (
                            <div className="border-t border-gray-200">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">ID</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">상태</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">학교</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">학년</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">연락처</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">수강</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">삭제</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {group.students.map((student, index) => {
                                    const isMismatched = isIdMismatched(student);
                                    return (
                                    <tr
                                      key={student.id}
                                      className={`hover:bg-gray-50 ${index === 0 ? 'bg-green-50' : ''} ${isMismatched ? 'bg-purple-50' : ''}`}
                                    >
                                      <td className="px-3 py-2">
                                        <div className="flex flex-col gap-0.5">
                                          <span className={`text-xs font-mono ${isMismatched ? 'text-purple-600' : 'text-gray-400'}`}>
                                            {student.id.slice(0, 12)}...
                                          </span>
                                          {isMismatched && (
                                            <span className="text-micro text-purple-500">
                                              ID이름: {extractNameFromId(student.id)}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">{getStatusBadge(student)}</td>
                                      <td className="px-3 py-2 text-gray-700">{student.school || '-'}</td>
                                      <td className="px-3 py-2 text-gray-700">{student.grade || '-'}</td>
                                      <td className="px-3 py-2 text-gray-700 text-xs">
                                        {student.studentPhone || student.parentPhone || '-'}
                                      </td>
                                      <td className="px-3 py-2">{getEnrollmentInfo(student)}</td>
                                      <td className="px-3 py-2 text-center">
                                        <button
                                          onClick={() => handleDeleteStudent(student.id, student.name)}
                                          disabled={deletingId === student.id}
                                          className="p-1 text-red-500 hover:bg-red-50 rounded-sm transition-colors disabled:opacity-50"
                                          title="학생 삭제"
                                        >
                                          {deletingId === student.id ? (
                                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-sm animate-spin" />
                                          ) : (
                                            <Trash2 className="w-4 h-4" />
                                          )}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 4: 작업 버튼 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Settings className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">일괄 작업</h3>
                </div>
                <div className="p-2 space-y-2">
                  {/* 수강 없는 중복 학생 삭제 */}
                  {noEnrollmentDuplicates.length > 0 && (
                    <button
                      onClick={handleDeleteAllNoEnrollment}
                      disabled={isBatchDeleting}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-white bg-red-500 hover:bg-red-600 rounded-sm transition-colors disabled:opacity-50"
                    >
                      {isBatchDeleting ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-sm animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>수강 없는 중복 학생 일괄 삭제 ({noEnrollmentDuplicates.length}명)</span>
                    </button>
                  )}

                  {/* 비정규 ID 정규화 (문서 이동) */}
                  {unnormalizedIdStudents.length > 0 && (
                    <button
                      onClick={handleNormalizeAllIds}
                      disabled={isBatchDeleting}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-white bg-rose-500 hover:bg-rose-600 rounded-sm transition-colors disabled:opacity-50"
                      title="초등학교→초, 중학교→중, 고등학교→고 정규화 (문서 이동)"
                    >
                      {isBatchDeleting ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-sm animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      <span>비정규 ID 정규화 ({unnormalizedIdStudents.length}명) - 학교명 정규화 + 약칭 보정</span>
                    </button>
                  )}

                  {/* ID-데이터 불일치 수정 */}
                  {mismatchedStudents.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleFixAllMismatched}
                        disabled={isBatchDeleting}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs text-white bg-green-500 hover:bg-green-600 rounded-sm transition-colors disabled:opacity-50"
                        title="name/school/grade 필드를 문서 ID 기준으로 수정"
                      >
                        {isBatchDeleting ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-sm animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        <span>ID→필드 동기화 ({mismatchedStudents.length}명)</span>
                      </button>
                      <button
                        onClick={handleDeleteAllMismatched}
                        disabled={isBatchDeleting}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs text-white bg-red-500 hover:bg-red-600 rounded-sm transition-colors disabled:opacity-50"
                        title="불일치 학생 전체 삭제"
                      >
                        {isBatchDeleting ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-sm animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        <span>삭제 ({mismatchedStudents.length}명)</span>
                      </button>
                    </div>
                  )}

                  {/* 예비 → 재원 변경 */}
                  {prospectStudents.length > 0 && (
                    <button
                      onClick={handleConvertProspectToActive}
                      disabled={isBatchDeleting}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-white bg-blue-500 hover:bg-blue-600 rounded-sm transition-colors disabled:opacity-50"
                      title="예비 학생을 재원으로 일괄 변경"
                    >
                      {isBatchDeleting ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-sm animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      <span>예비 → 재원 일괄 변경 ({prospectStudents.length}명)</span>
                    </button>
                  )}

                  {/* 이상한 문서 삭제 */}
                  {abnormalStudents.length > 0 && (
                    <button
                      onClick={handleDeleteAllAbnormal}
                      disabled={isBatchDeleting}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-white bg-orange-500 hover:bg-orange-600 rounded-sm transition-colors disabled:opacity-50"
                      title="이상한 형태의 학생 문서 전체 삭제"
                    >
                      {isBatchDeleting ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-sm animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>이상한 문서 전체 삭제 ({abnormalStudents.length}개)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              * 녹색 배경 = 대표 학생 | 보라색 배경 = ID-이름 불일치 (이름 수정 필요)
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-sm hover:bg-gray-300 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateNamesViewModal;
