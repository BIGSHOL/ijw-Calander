/**
 * 신규 등록 KPI 근거 데이터 모달
 * - 이번 달 신규 등록 학생 명단 (status='active' + startDate가 이번 달)
 * - 등록일 최신순 정렬
 * - read-only
 */
import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { UnifiedStudent } from '../../../types/student';

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

const isActiveEnrollment = (e: any) => {
  if (e.cancelledAt) return false;
  if (e.endDate || e.withdrawalDate) return false;
  if (e.isScheduled) return false;
  return true;
};

const NewStudentsModal: React.FC<NewStudentsModalProps> = ({
  isOpen,
  onClose,
  students,
  yearMonth,
  monthStart,
  monthEnd,
}) => {
  const newStudents = useMemo(() => {
    return students
      .filter(s => {
        if (s.status !== 'active') return false;
        if (!s.startDate) return false;
        const d = new Date(s.startDate);
        return d >= monthStart && d <= monthEnd;
      })
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }, [students, monthStart, monthEnd]);

  const summary = useMemo(() => {
    let mathCount = 0, englishCount = 0, multiCount = 0;
    newStudents.forEach(s => {
      const active = (s.enrollments || []).filter(isActiveEnrollment);
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
            <h2 className="font-bold text-sm text-pink-900">신규 등록 — 근거 데이터</h2>
            <span className="text-xs text-pink-600">{yearMonth}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-pink-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* 요약 */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <span className="text-gray-500">
              총 신규 <b className="text-pink-700 text-sm">{summary.total}명</b>
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
          <div className="text-[10px] text-gray-400 mt-1.5">
            정렬: 등록일 최신순 · 조건: status='active' + 이번 달 startDate
          </div>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-auto">
          {newStudents.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              이번 달 신규 등록 학생이 없습니다.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <tr className="text-gray-500">
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">등록일</th>
                  <th className="px-3 py-2 text-left font-medium">학생</th>
                  <th className="px-3 py-2 text-left font-medium">학교/학년</th>
                  <th className="px-3 py-2 text-left font-medium">수강 과목</th>
                  <th className="px-3 py-2 text-left font-medium">담당 강사</th>
                  <th className="px-3 py-2 text-left font-medium">보호자</th>
                </tr>
              </thead>
              <tbody>
                {newStudents.map((s) => {
                  const active = (s.enrollments || []).filter(isActiveEnrollment);
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
                      <td className="px-3 py-1.5 font-mono text-gray-700 whitespace-nowrap">
                        {s.startDate || '-'}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {s.name}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {s.school || '-'}
                        {s.grade ? ` / ${s.grade}` : ''}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">
                        {subjectSet.size > 0 ? Array.from(subjectSet).join(', ') : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {teacherSet.size > 0 ? Array.from(teacherSet).join(', ') : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">
                        {s.parentName ? `${s.parentName}${s.parentRelation ? `(${s.parentRelation})` : ''}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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