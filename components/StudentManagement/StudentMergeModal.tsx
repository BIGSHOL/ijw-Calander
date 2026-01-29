/**
 * StudentMergeModal - 중복 학생 병합 모달
 *
 * 중복 기준: 이름 + 학교 + 학년이 같은 학생
 * 처리:
 *   1. 대표 학생에게 enrollment 이전 (중복 스킵)
 *   2. 대표 학생 기본정보 보완 (빈 필드 채우기)
 *   3. 원본 학생 완전 삭제 (hard delete)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { X, Loader2, ChevronDown, ChevronRight, Check, AlertTriangle, GitMerge, Users } from 'lucide-react';
import { collection, doc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { UnifiedStudent } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import { useStudentDuplicates, DuplicateGroup } from './hooks/useStudentDuplicates';
import { useQueryClient } from '@tanstack/react-query';

interface StudentMergeModalProps {
  onClose: () => void;
}

type ModalStep = 'loading' | 'preview' | 'processing' | 'done';

interface MergeResult {
  processedGroups: number;
  transferredEnrollments: number;
  deletedStudents: number;
  errors: string[];
}

const StudentMergeModal: React.FC<StudentMergeModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const { students, loading: studentsLoading } = useStudents(true); // 퇴원생 포함

  const {
    duplicateGroups,
    totalDuplicates,
    totalGroups,
    selectedGroups,
    setPrimaryStudent,
    toggleGroupSelection,
    selectAllGroups,
    deselectAllGroups,
    autoSelectPrimary,
    getSelectedGroups,
  } = useStudentDuplicates(students, studentsLoading);

  const [step, setStep] = useState<ModalStep>(studentsLoading ? 'loading' : 'preview');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0, currentGroup: '' });
  const [result, setResult] = useState<MergeResult | null>(null);

  // 로딩 완료 시 preview로 전환
  React.useEffect(() => {
    if (!studentsLoading && step === 'loading') {
      setStep('preview');
      // 자동으로 대표 학생 선택
      autoSelectPrimary();
    }
  }, [studentsLoading, step, autoSelectPrimary]);

  // 그룹 확장/축소 토글
  const toggleExpand = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // 기본 정보 병합 함수
  const mergeBasicInfo = useCallback((
    primary: UnifiedStudent,
    secondaries: UnifiedStudent[]
  ): Partial<UnifiedStudent> => {
    const fieldsToMerge: (keyof UnifiedStudent)[] = [
      'englishName', 'school', 'grade', 'gender',
      'studentPhone', 'parentPhone', 'parentName', 'parentRelation',
      'otherPhone', 'homePhone', 'zipCode', 'address', 'addressDetail',
      'birthDate', 'nickname', 'attendanceNumber', 'studentEmail',
      'enrollmentReason', 'cashReceiptNumber', 'billingDay'
    ];

    const merged: Partial<UnifiedStudent> = {};

    for (const field of fieldsToMerge) {
      if (!primary[field]) {
        for (const secondary of secondaries) {
          if (secondary[field]) {
            (merged as any)[field] = secondary[field];
            break;
          }
        }
      }
    }

    // 메모 합치기
    const allMemos = [primary.memo, ...secondaries.map(s => s.memo)].filter(Boolean);
    if (allMemos.length > 1) {
      merged.memo = allMemos.join('\n\n---\n\n');
    } else if (allMemos.length === 1 && !primary.memo) {
      merged.memo = allMemos[0];
    }

    return merged;
  }, []);

  // 단일 그룹 병합
  const mergeGroup = useCallback(async (
    group: DuplicateGroup
  ): Promise<{ enrollmentsTransferred: number; studentsDeleted: number; error?: string }> => {
    const primary = group.students.find(s => s.id === group.primaryId);
    if (!primary) {
      return { enrollmentsTransferred: 0, studentsDeleted: 0, error: '대표 학생을 찾을 수 없습니다' };
    }

    const secondaries = group.students.filter(s => s.id !== group.primaryId);
    if (secondaries.length === 0) {
      return { enrollmentsTransferred: 0, studentsDeleted: 0 };
    }

    let enrollmentsTransferred = 0;
    let studentsDeleted = 0;

    try {
      // 1. 대표 학생의 기존 enrollment 조회 (중복 체크용)
      const primaryEnrollmentsSnap = await getDocs(
        collection(db, 'students', primary.id, 'enrollments')
      );
      const existingEnrollments = new Set<string>();
      primaryEnrollmentsSnap.docs.forEach(doc => {
        const data = doc.data();
        // endDate가 없는 활성 enrollment만 체크
        if (!data.endDate) {
          existingEnrollments.add(`${data.subject}_${data.className}`);
        }
      });

      // 2. 각 보조 학생 처리
      for (const secondary of secondaries) {
        const batch = writeBatch(db);

        // 2-1. enrollment 이전
        const secondaryEnrollmentsSnap = await getDocs(
          collection(db, 'students', secondary.id, 'enrollments')
        );

        for (const enrollDoc of secondaryEnrollmentsSnap.docs) {
          const enrollData = enrollDoc.data();
          const enrollKey = `${enrollData.subject}_${enrollData.className}`;

          // 활성 enrollment 중복 체크 (종료된 enrollment는 이력 보존을 위해 무조건 이전)
          if (!enrollData.endDate && existingEnrollments.has(enrollKey)) {
            continue; // 중복 스킵
          }

          // 새 enrollment 생성
          const newEnrollmentRef = doc(collection(db, 'students', primary.id, 'enrollments'));
          batch.set(newEnrollmentRef, {
            ...enrollData,
            migratedFrom: secondary.id,
            migratedAt: new Date().toISOString(),
          });
          enrollmentsTransferred++;

          // 이전한 enrollment 키 추가 (이후 중복 방지)
          if (!enrollData.endDate) {
            existingEnrollments.add(enrollKey);
          }
        }

        // 2-2. 보조 학생 삭제 (서브컬렉션 먼저)
        for (const enrollDoc of secondaryEnrollmentsSnap.docs) {
          batch.delete(enrollDoc.ref);
        }

        await batch.commit();

        // 학생 문서 삭제 (batch 외부에서 처리 - 서브컬렉션 삭제 후)
        await deleteDoc(doc(db, 'students', secondary.id));
        studentsDeleted++;
      }

      // 3. 대표 학생 정보 업데이트
      const mergedInfo = mergeBasicInfo(primary, secondaries);
      if (Object.keys(mergedInfo).length > 0) {
        const updateBatch = writeBatch(db);
        updateBatch.update(doc(db, 'students', primary.id), {
          ...mergedInfo,
          updatedAt: new Date().toISOString(),
        });
        await updateBatch.commit();
      }

      return { enrollmentsTransferred, studentsDeleted };
    } catch (error) {
      console.error('그룹 병합 오류:', error);
      return {
        enrollmentsTransferred,
        studentsDeleted,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    }
  }, [mergeBasicInfo]);

  // 병합 실행
  const handleMerge = useCallback(async () => {
    const groupsToMerge = getSelectedGroups();
    if (groupsToMerge.length === 0) {
      alert('병합할 그룹을 선택해주세요');
      return;
    }

    if (!window.confirm(`총 ${groupsToMerge.length}개 그룹을 병합하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setStep('processing');
    setProgress({ current: 0, total: groupsToMerge.length, currentGroup: '' });

    const mergeResult: MergeResult = {
      processedGroups: 0,
      transferredEnrollments: 0,
      deletedStudents: 0,
      errors: [],
    };

    for (let i = 0; i < groupsToMerge.length; i++) {
      const group = groupsToMerge[i];
      setProgress({
        current: i + 1,
        total: groupsToMerge.length,
        currentGroup: `${group.name} (${group.school} ${group.grade})`,
      });

      const result = await mergeGroup(group);

      mergeResult.processedGroups++;
      mergeResult.transferredEnrollments += result.enrollmentsTransferred;
      mergeResult.deletedStudents += result.studentsDeleted;

      if (result.error) {
        mergeResult.errors.push(`${group.name}: ${result.error}`);
      }
    }

    // 캐시 무효화
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    queryClient.invalidateQueries({ queryKey: ['enrollments-as-classes'] });

    setResult(mergeResult);
    setStep('done');
  }, [getSelectedGroups, mergeGroup, queryClient]);

  // 학생 정보 표시
  const renderStudentInfo = (student: UnifiedStudent, isPrimary: boolean) => {
    const enrollmentCount = student.enrollments?.length || 0;
    const subjects = [...new Set(student.enrollments?.map(e => e.subject) || [])];

    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isPrimary ? 'font-bold text-[#081429]' : 'text-gray-600'}`}>
            {student.id.length > 20 ? student.id.substring(0, 20) + '...' : student.id}
          </span>
          {isPrimary && (
            <span className="text-xxs bg-[#fdb813] text-[#081429] px-1 rounded font-bold">추천</span>
          )}
          <span className={`text-xxs px-1 rounded ${
            student.status === 'active' ? 'bg-green-100 text-green-700' :
            student.status === 'withdrawn' ? 'bg-gray-100 text-gray-600' :
            'bg-blue-100 text-blue-700'
          }`}>
            {student.status === 'active' ? '재원' :
             student.status === 'withdrawn' ? '퇴원' : '예비'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xxs text-gray-500">
          {enrollmentCount > 0 && (
            <span>
              {subjects.map(s => s === 'math' ? '수학' : s === 'english' ? '영어' : s).join(', ')}
              ({enrollmentCount})
            </span>
          )}
          {!enrollmentCount && <span className="text-gray-400">수강없음</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-[#081429] text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            <h3 className="font-bold">학생 중복 병합</h3>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'processing'}
            className="text-white/70 hover:text-white disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Loading */}
          {step === 'loading' && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#fdb813] mb-3" />
              <p className="text-gray-600">{students.length}명 학생 분석 중...</p>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && (
            <>
              {/* 통계 */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span>전체 <strong>{students.length}</strong>명</span>
                    <span>중복 그룹 <strong className="text-orange-600">{totalGroups}</strong>개</span>
                    <span>병합 대상 <strong className="text-red-600">{totalDuplicates}</strong>명</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllGroups}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      모두 선택
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={deselectAllGroups}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      선택 해제
                    </button>
                  </div>
                </div>
              </div>

              {/* 그룹 목록 */}
              <div className="flex-1 overflow-y-auto">
                {duplicateGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <Users className="w-12 h-12 mb-3 text-gray-300" />
                    <p>중복된 학생이 없습니다</p>
                    <p className="text-xs text-gray-400 mt-1">이름 + 학교 + 학년이 같은 학생을 찾습니다</p>
                  </div>
                ) : (
                  duplicateGroups.map(group => {
                    const isExpanded = expandedGroups.has(group.key);

                    return (
                      <div key={group.key} className="border-b border-gray-100">
                        {/* 그룹 헤더 */}
                        <div
                          className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-50 ${
                            group.isSelected ? 'bg-[#fdb813]/10' : ''
                          }`}
                          onClick={() => toggleExpand(group.key)}
                        >
                          <input
                            type="checkbox"
                            checked={group.isSelected}
                            onChange={() => toggleGroupSelection(group.key)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 text-[#fdb813] rounded border-gray-300 focus:ring-[#fdb813]"
                          />
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <div className="flex-1">
                            <span className="font-bold text-sm text-[#081429]">{group.name}</span>
                            {(group.school || group.grade) && (
                              <span className="text-xs text-gray-500 ml-2">
                                {group.school} {group.grade}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {group.students.length}명
                          </span>
                        </div>

                        {/* 학생 목록 */}
                        {isExpanded && (
                          <div className="px-4 pb-3 pl-10 space-y-1">
                            {group.students.map(student => {
                              const isPrimary = student.id === group.primaryId;
                              return (
                                <div
                                  key={student.id}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                                    isPrimary
                                      ? 'bg-[#fdb813]/20 border border-[#fdb813]'
                                      : 'bg-gray-50 hover:bg-gray-100'
                                  }`}
                                  onClick={() => setPrimaryStudent(group.key, student.id)}
                                >
                                  <input
                                    type="radio"
                                    name={`primary-${group.key}`}
                                    checked={isPrimary}
                                    onChange={() => setPrimaryStudent(group.key, student.id)}
                                    className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                  />
                                  <div className="flex-1">
                                    {renderStudentInfo(student, isPrimary)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  선택된 그룹: <strong className="text-[#081429]">{selectedGroups}</strong>개
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleMerge}
                    disabled={selectedGroups === 0}
                    className="px-4 py-2 bg-[#fdb813] text-[#081429] rounded text-sm font-bold hover:bg-[#e5a711] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <GitMerge className="w-4 h-4" />
                    선택 그룹 병합 ({selectedGroups})
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Processing */}
          {step === 'processing' && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#fdb813] mb-4" />
              <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-[#fdb813] transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mb-1">
                {progress.currentGroup} 처리 중...
              </p>
              <p className="text-xs text-gray-400">
                {progress.current} / {progress.total} 그룹
              </p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && result && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-bold text-[#081429] mb-4">병합 완료!</h4>
              <div className="text-center space-y-1 text-sm text-gray-600 mb-6">
                <p>처리된 그룹: <strong>{result.processedGroups}</strong>개</p>
                <p>이전된 수강정보: <strong>{result.transferredEnrollments}</strong>개</p>
                <p>삭제된 학생: <strong>{result.deletedStudents}</strong>명</p>
              </div>
              {result.errors.length > 0 && (
                <div className="w-full max-w-md p-3 bg-red-50 border border-red-200 rounded mb-4">
                  <div className="flex items-center gap-2 text-red-700 text-sm mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-bold">오류 발생 ({result.errors.length}건)</span>
                  </div>
                  <ul className="text-xs text-red-600 space-y-1">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>... 외 {result.errors.length - 5}건</li>
                    )}
                  </ul>
                </div>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#fdb813] text-[#081429] rounded text-sm font-bold hover:bg-[#e5a711]"
              >
                완료
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentMergeModal;
