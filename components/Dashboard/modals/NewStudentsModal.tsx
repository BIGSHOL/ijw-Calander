/**
 * 신입생 KPI 근거 데이터 모달
 * - 이번 달 등록 + 활성 수강과목 1개 이상 학생 명단
 * - 등록일 최신순 정렬
 * - read-only
 */
import React, { useMemo, useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { UnifiedStudent } from '../../../types/student';
import { isActiveEnrollment } from '../../../utils/dashboardUtils';
import { getMonthRange } from '../../../utils/datePeriod';

interface NewStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: UnifiedStudent[];
  yearMonth: string;
  monthStart: Date;
  monthEnd: Date;
}

const SUBJECT_LABEL: Record<string, string> = {
  math: '수학',
  highmath: '고등수학',
  english: '영어',
  korean: '국어',
  science: '과학',
  other: '기타',
};

const NewStudentsModal: React.FC<NewStudentsModalProps> = ({
  isOpen,
  onClose,
  students,
  yearMonth: _yearMonth,
  monthStart: _monthStart,
  monthEnd: _monthEnd,
}) => {
  // 월간 페이지 — offset: 0=이번 달, -1=지난 달 ...
  const [offset, setOffset] = useState(0);
  const [tableExpanded, setTableExpanded] = useState(false);
  const TABLE_PREVIEW = 10;

  // 모달 열릴 때마다 이번 달로 초기화
  useEffect(() => {
    if (isOpen) {
      setOffset(0);
      setTableExpanded(false);
    }
  }, [isOpen]);

  const range = useMemo(() => getMonthRange(offset), [offset]);

  const newStudents = useMemo(() => {
    return students
      .filter(s => {
        if (!s.startDate) return false;
        const d = new Date(s.startDate);
        if (d < range.start || d > range.end) return false;
        // 수강과목 유무: active enrollment 1개 이상
        const activeEnrolls = (s.enrollments || []).filter((e: any) => isActiveEnrollment(e));
        return activeEnrolls.length > 0;
      })
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }, [students, range]);

  const summary = useMemo(() => {
    let mathCount = 0, englishCount = 0, multiCount = 0;
    newStudents.forEach(s => {
      const active = (s.enrollments || []).filter((e: any) => isActiveEnrollment(e));
      const subjects = new Set(active.map(e => e.subject === 'highmath' ? 'math' : e.subject));
      const hasMath = subjects.has('math');
      const hasEng = subjects.has('english');
      if (hasMath) mathCount++;
      if (hasEng) englishCount++;
      if (subjects.size >= 2) multiCount++;
    });
    return { total: newStudents.length, mathCount, englishCount, multiCount };
  }, [newStudents]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[8vh] bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[820px] max-w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-pink-50">
          <div className="flex items-center gap-2">
            <span className="text-pink-700 text-lg">🆕</span>
            <h2 className="font-bold text-sm text-pink-900">신입생 — 근거 데이터</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-pink-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* 월 페이지 네비 */}
        <div className="flex items-center justify-between px-5 py-2 border-b bg-white">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOffset(o => o - 1)}
              className="p-1 hover:bg-gray-100 rounded text-black"
              title="지난 달"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-black mx-2 min-w-[120px] text-center">
              {range.label}
            </span>
            <button
              onClick={() => setOffset(o => o + 1)}
              disabled={offset >= 0}
              className="p-1 hover:bg-gray-100 rounded text-black disabled:opacity-30 disabled:cursor-not-allowed"
              title="다음 달"
            >
              <ChevronRight size={16} />
            </button>
            {offset !== 0 && (
              <button
                onClick={() => setOffset(0)}
                className="ml-2 px-2 py-0.5 text-xs font-bold border border-pink-300 text-pink-700 rounded hover:bg-pink-50"
              >
                이번 달로
              </button>
            )}
          </div>
          <span className="text-xs text-black">월간 기준</span>
        </div>

        {/* 요약 */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <span className="text-black">
              총 신입생 <b className="text-pink-700 text-sm">{summary.total}명</b>
            </span>
            <span className="text-emerald-600">
              수학 <b>{summary.mathCount}명</b>
            </span>
            <span className="text-red-600">
              영어 <b>{summary.englishCount}명</b>
            </span>
            <span className="text-amber-600">
              2과목 이상 <b>{summary.multiCount}명</b>
            </span>
          </div>
          <div className="text-xs text-black mt-1.5">
            정렬: 등록일 최신순 · 조건: 선택 월 startDate + 수강과목 1개 이상
          </div>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-auto">
          {newStudents.length === 0 ? (
            <div className="text-center py-12 text-black text-sm">
              이번 달 신입생이 없습니다.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <tr className="text-black">
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">등록일</th>
                  <th className="px-3 py-2 text-left font-medium">학생</th>
                  <th className="px-3 py-2 text-left font-medium">학교/학년</th>
                  <th className="px-3 py-2 text-left font-medium">수강 과목</th>
                  <th className="px-3 py-2 text-left font-medium">담당 강사</th>
                  <th className="px-3 py-2 text-left font-medium">보호자</th>
                </tr>
              </thead>
              <tbody>
                {(tableExpanded ? newStudents : newStudents.slice(0, TABLE_PREVIEW)).map((s) => {
                  const active = (s.enrollments || []).filter((e: any) => isActiveEnrollment(e));
                  const subjectSet = new Set(active.map(e => SUBJECT_LABEL[e.subject] || e.subject));
                  const teacherSet = new Set(
                    active
                      .map(e => e.teacher)
                      .filter((t): t is string => !!t && t.length > 0)
                  );
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-1.5 font-mono text-black whitespace-nowrap">
                        {s.startDate || '-'}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-black">
                        {s.name}
                      </td>
                      <td className="px-3 py-1.5 text-black">
                        {s.school || '-'}
                        {s.grade ? ` / ${s.grade}` : ''}
                      </td>
                      <td className="px-3 py-1.5 text-black">
                        {subjectSet.size > 0 ? Array.from(subjectSet).join(', ') : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-black">
                        {teacherSet.size > 0 ? Array.from(teacherSet).join(', ') : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-black">
                        {s.parentName ? `${s.parentName}${s.parentRelation ? `(${s.parentRelation})` : ''}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {newStudents.length > TABLE_PREVIEW && (
            <button
              type="button"
              onClick={() => setTableExpanded(e => !e)}
              className="w-full px-3 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 border-t border-gray-200 flex items-center justify-center gap-1"
            >
              {tableExpanded ? (
                <>접기 <ChevronUp size={16} /></>
              ) : (
                <>+ {newStudents.length - TABLE_PREVIEW}명 더 보기 <ChevronDown size={16} /></>
              )}
            </button>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-2 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-pink-600 text-white rounded text-xs font-bold hover:bg-pink-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewStudentsModal;