/**
 * EnrollmentSyncModal - enrollment과 classes 간 데이터 불일치 탐지 및 수정
 *
 * 기능:
 * 1. 모든 학생의 enrollment를 스캔
 * 2. classes 컬렉션에 존재하지 않는 className을 가진 enrollment 찾기
 * 3. 체크박스로 선택 후 일괄 수정
 */

import React, { useState, useMemo, useEffect } from 'react';
import { X, AlertTriangle, RefreshCw, Check, Trash2, ArrowRight, CheckSquare, Square } from 'lucide-react';
import { useClasses } from '../../hooks/useClasses';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';
import { useEnrollmentSync } from './hooks/useEnrollmentSync';

interface MismatchedEnrollment {
  studentId: string;
  studentName: string;
  enrollmentId: string;
  enrollmentClassName: string;
  subject: string;
  suggestedMatches: string[]; // 유사한 수업명 추천
}

interface EnrollmentSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EnrollmentSyncModal: React.FC<EnrollmentSyncModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { enrollments: allEnrollments, isLoading: enrollmentsLoading, refetch: refetchEnrollments } = useEnrollmentSync(isOpen);
  const { classes } = useClasses();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [fixTargets, setFixTargets] = useState<Record<string, string>>({}); // key -> newClassName
  const [isFixing, setIsFixing] = useState(false);
  const [fixedCount, setFixedCount] = useState(0);
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // 페이지당 20개씩 표시

  // 필터 변경 시 페이지 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [subjectFilter]);

  // classes에서 유효한 className 목록 추출
  const validClassNames = useMemo(() => {
    const namesBySubject: Record<string, Set<string>> = {
      math: new Set(),
      english: new Set(),
      science: new Set(),
      korean: new Set(),
    };

    if (!classes) return namesBySubject;

    classes.forEach(cls => {
      const subject = cls.subject || 'math';
      if (!namesBySubject[subject]) {
        namesBySubject[subject] = new Set();
      }
      namesBySubject[subject].add(cls.className);
    });

    return namesBySubject;
  }, [classes]);

  // 모든 className 목록 (선택 드롭다운용)
  const allClassNamesBySubject = useMemo(() => {
    const result: Record<string, string[]> = {};
    Object.entries(validClassNames).forEach(([subject, names]) => {
      result[subject] = Array.from(names).sort((a, b) => a.localeCompare(b, 'ko'));
    });
    return result;
  }, [validClassNames]);

  // 레벤슈타인 거리 계산 (문자열 유사도)
  const levenshteinDistance = (a: string, b: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };

  // 불일치 enrollment 찾기
  const mismatchedEnrollments = useMemo(() => {
    const mismatches: MismatchedEnrollment[] = [];

    if (!allEnrollments) return mismatches;

    allEnrollments.forEach(enrollment => {
      const subject = enrollment.subject || 'math';
      const className = enrollment.className;

      if (!className) return;

      // 필터 적용
      if (subjectFilter !== 'all' && subject !== subjectFilter) return;

      const validNames = validClassNames[subject] || new Set();

      // 정확히 일치하는 수업이 없는 경우
      if (!validNames.has(className)) {
        // 유사한 수업명 찾기 (부분 일치 또는 레벤슈타인 거리)
        const suggestedMatches = Array.from(validNames).filter(name =>
          name.includes(className) ||
          className.includes(name) ||
          levenshteinDistance(name, className) <= 3
        ).slice(0, 5);

        mismatches.push({
          studentId: enrollment.studentId,
          studentName: enrollment.studentName,
          enrollmentId: enrollment.enrollmentId,
          enrollmentClassName: className,
          subject,
          suggestedMatches,
        });
      }
    });

    return mismatches;
  }, [allEnrollments, validClassNames, subjectFilter]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(mismatchedEnrollments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEnrollments = mismatchedEnrollments.slice(startIndex, endIndex);

  // 아이템 키 생성
  const getItemKey = (m: MismatchedEnrollment) => `${m.studentId}_${m.enrollmentId}`;

  // 현재 페이지 전체 선택/해제
  const handleSelectAll = () => {
    const currentPageKeys = paginatedEnrollments.map(getItemKey);
    const allCurrentSelected = currentPageKeys.every(key => selectedItems.has(key));

    const newSet = new Set(selectedItems);
    if (allCurrentSelected) {
      // 현재 페이지 항목 모두 제거
      currentPageKeys.forEach(key => newSet.delete(key));
    } else {
      // 현재 페이지 항목 모두 추가
      currentPageKeys.forEach(key => newSet.add(key));
    }
    setSelectedItems(newSet);
  };

  // 개별 선택/해제
  const handleToggleSelect = (key: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedItems(newSet);
  };

  // 수정 대상 설정
  const handleSetFixTarget = (key: string, newClassName: string) => {
    setFixTargets(prev => ({
      ...prev,
      [key]: newClassName,
    }));
  };

  // 선택된 항목 일괄 수정
  const handleFixSelected = async () => {
    const toFix = Array.from(selectedItems).filter(key => fixTargets[key]);

    if (toFix.length === 0) {
      alert('수정할 수업을 선택해주세요.\n(체크박스 선택 + 수업 선택 필요)');
      return;
    }

    if (!confirm(`${toFix.length}개 항목을 수정하시겠습니까?`)) {
      return;
    }

    setIsFixing(true);
    let fixed = 0;

    for (const key of toFix) {
      const [studentId, enrollmentId] = key.split('_');
      const newClassName = fixTargets[key];

      try {
        const enrollmentRef = doc(db, 'students', studentId, 'enrollments', enrollmentId);
        await updateDoc(enrollmentRef, {
          className: newClassName,
          updatedAt: new Date().toISOString(),
        });
        fixed++;
      } catch (error) {
        console.error('Failed to fix enrollment:', error);
      }
    }

    setFixedCount(prev => prev + fixed);
    setSelectedItems(new Set());
    setFixTargets({});
    setIsFixing(false);

    // 데이터 새로고침
    await refetchEnrollments();
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['students', true] });

    alert(`${fixed}개 항목 수정 완료`);
  };

  // 선택된 항목 일괄 삭제
  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }

    if (!confirm(`${selectedItems.size}개 항목을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setIsFixing(true);
    let deleted = 0;

    for (const key of selectedItems) {
      const [studentId, enrollmentId] = key.split('_');

      try {
        const enrollmentRef = doc(db, 'students', studentId, 'enrollments', enrollmentId);
        await deleteDoc(enrollmentRef);
        deleted++;
      } catch (error) {
        console.error('Failed to delete enrollment:', error);
      }
    }

    setFixedCount(prev => prev + deleted);
    setSelectedItems(new Set());
    setIsFixing(false);

    // 데이터 새로고침
    await refetchEnrollments();
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['students', true] });

    alert(`${deleted}개 항목 삭제 완료`);
  };

  if (!isOpen) return null;

  // 데이터 로딩 중
  if (enrollmentsLoading || !classes) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
            <span className="text-gray-700">Enrollment 데이터 로딩 중...</span>
          </div>
        </div>
      </div>
    );
  }

  const isAllCurrentPageSelected = paginatedEnrollments.length > 0 &&
    paginatedEnrollments.every(m => selectedItems.has(getItemKey(m)));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">Enrollment 데이터 동기화</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Stats */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">과목:</span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">전체</option>
                <option value="math">수학</option>
                <option value="english">영어</option>
              </select>
            </div>
            <div className="text-sm">
              <span className="text-amber-600 font-semibold">{mismatchedEnrollments.length}</span>
              <span className="text-gray-500"> 개 불일치</span>
              {totalPages > 1 && (
                <span className="text-gray-400 ml-2">
                  (페이지 {currentPage}/{totalPages})
                </span>
              )}
              {selectedItems.size > 0 && (
                <span className="text-blue-600 ml-2">({selectedItems.size}개 선택됨)</span>
              )}
              {fixedCount > 0 && (
                <span className="text-green-600 ml-2">({fixedCount}개 처리됨)</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFixSelected}
              disabled={isFixing || selectedItems.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFixing ? 'animate-spin' : ''}`} />
              선택 수정
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={isFixing || selectedItems.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              선택 삭제
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {mismatchedEnrollments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="text-lg font-medium">모든 enrollment가 정상입니다!</p>
              <p className="text-sm mt-1">불일치하는 데이터가 없습니다.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left w-10">
                    <button onClick={handleSelectAll} className="p-1 hover:bg-gray-200 rounded">
                      {isAllCurrentPageSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="p-2 text-left">과목</th>
                  <th className="p-2 text-left">학생</th>
                  <th className="p-2 text-left">현재 수업명 (불일치)</th>
                  <th className="p-2 text-left">수정할 수업 선택</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEnrollments.map((mismatch) => {
                  const key = getItemKey(mismatch);
                  const isSelected = selectedItems.has(key);
                  const selectedClass = fixTargets[key];

                  return (
                    <tr
                      key={key}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                    >
                      <td className="p-2">
                        <button
                          onClick={() => handleToggleSelect(key)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="p-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          mismatch.subject === 'math' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {mismatch.subject === 'math' ? '수학' : '영어'}
                        </span>
                      </td>
                      <td className="p-2 font-medium">{mismatch.studentName}</td>
                      <td className="p-2">
                        <span className="text-red-600">{mismatch.enrollmentClassName}</span>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedClass || ''}
                            onChange={(e) => handleSetFixTarget(key, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 max-w-[250px] flex-1"
                          >
                            <option value="">수업 선택...</option>
                            {mismatch.suggestedMatches.length > 0 && (
                              <optgroup label="추천 (유사한 이름)">
                                {mismatch.suggestedMatches.map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="전체 수업 목록">
                              {(allClassNamesBySubject[mismatch.subject] || []).map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </optgroup>
                          </select>
                          {selectedClass && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-gray-200 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              처음
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              이전
            </button>
            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              다음
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              마지막
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            * 체크박스로 항목 선택 → 수업 선택 → "선택 수정" 클릭
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentSyncModal;
