/**
 * 순증감 KPI 근거 데이터 모달
 * - 이번 달 신규 등록 + 퇴원 학생을 한 화면에 표시
 * - 상단 요약: 신규 N - 퇴원 M = 순증감 ±K
 * - read-only
 */
import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { UnifiedStudent } from '../../../types/student';

interface NetChangeDetailsModalProps {
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

const WITHDRAWAL_REASON_LABELS: Record<string, string> = {
  graduation: '졸업',
  relocation: '이사',
  competitor: '경쟁 학원 이동',
  financial: '경제적 사유',
  schedule: '시간 조절 어려움',
  dissatisfied: '불만족',
  other: '기타',
};

const isActiveEnrollment = (e: any) => {
  if (e.cancelledAt) return false;
  if (e.endDate || e.withdrawalDate) return false;
  if (e.isScheduled) return false;
  return true;
};

const NetChangeDetailsModal: React.FC<NetChangeDetailsModalProps> = ({
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

  const withdrawnStudents = useMemo(() => {
    return students
      .filter(s => {
        if (s.status !== 'withdrawn' || !s.withdrawalDate) return false;
        const d = new Date(s.withdrawalDate);
        return d >= monthStart && d <= monthEnd;
      })
      .sort((a, b) => (b.withdrawalDate || '').localeCompare(a.withdrawalDate || ''));
  }, [students, monthStart, monthEnd]);

  const netChange = newStudents.length - withdrawnStudents.length;
  const netSign = netChange > 0 ? '+' : '';
  const netColor = netChange > 0 ? 'text-emerald-700' : netChange < 0 ? 'text-red-700' : 'text-gray-700';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[8vh] bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[860px] max-w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-slate-700 text-lg">📊</span>
            <h2 className="font-bold text-sm text-slate-900">순증감 — 근거 데이터</h2>
            <span className="text-xs text-slate-600">{yearMonth}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* 요약 */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-emerald-600">
              신규 <b className="text-sm">{newStudents.length}명</b>
            </span>
            <span className="text-gray-400">-</span>
            <span className="text-red-600">
              퇴원 <b className="text-sm">{withdrawnStudents.length}명</b>
            </span>
            <span className="text-gray-400">=</span>
            <span className={netColor}>
              순증감 <b className="text-sm">{netSign}{netChange}명</b>
            </span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5">
            이번 달 학원 재원생 수의 순수 증감폭 = 신규 등록 - 퇴원
          </div>
        </div>

        {/* 본문: 신규 + 퇴원 */}
        <div className="flex-1 overflow-auto">
          {/* 신규 섹션 */}
          <div className="px-5 py-2 bg-emerald-50/50 border-b border-emerald-100 flex items-center gap-2">
            <span className="text-emerald-700">🆕</span>
            <h3 className="font-bold text-xs text-emerald-900">신규 등록 ({newStudents.length}명)</h3>
          </div>
          {newStudents.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">이번 달 신규 등록 학생이 없습니다.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-white border-b border-gray-200">
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
                    active.map(e => e.teacher).filter((t): t is string => !!t && t.length > 0)
                  );
                  return (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono text-gray-700 whitespace-nowrap">{s.startDate || '-'}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-900">{s.name}</td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {s.school || '-'}{s.grade ? ` / ${s.grade}` : ''}
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

          {/* 퇴원 섹션 */}
          <div className="px-5 py-2 bg-red-50/50 border-y border-red-100 flex items-center gap-2 mt-2">
            <span className="text-red-700">🚪</span>
            <h3 className="font-bold text-xs text-red-900">퇴원 ({withdrawnStudents.length}명)</h3>
          </div>
          {withdrawnStudents.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">이번 달 퇴원 학생이 없습니다.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-white border-b border-gray-200">
                <tr className="text-gray-500">
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">퇴원일</th>
                  <th className="px-3 py-2 text-left font-medium">학생</th>
                  <th className="px-3 py-2 text-left font-medium">학교/학년</th>
                  <th className="px-3 py-2 text-left font-medium">수강 과목</th>
                  <th className="px-3 py-2 text-left font-medium">담당 강사</th>
                  <th className="px-3 py-2 text-left font-medium">퇴원 사유</th>
                </tr>
              </thead>
              <tbody>
                {withdrawnStudents.map((s) => {
                  const allEnrolls = s.enrollments || [];
                  const subjectSet = new Set(allEnrolls.map(e => SUBJECT_LABEL[e.subject] || e.subject));
                  const teacherSet = new Set(
                    allEnrolls.map(e => e.teacher).filter((t): t is string => !!t && t.length > 0)
                  );
                  const reasonRaw = s.withdrawalReason || '';
                  const reasonLabel = WITHDRAWAL_REASON_LABELS[reasonRaw] || reasonRaw || '사유 미기재';
                  return (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono text-gray-700 whitespace-nowrap">{s.withdrawalDate || '-'}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-900">{s.name}</td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {s.school || '-'}{s.grade ? ` / ${s.grade}` : ''}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">
                        {subjectSet.size > 0 ? Array.from(subjectSet).join(', ') : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {teacherSet.size > 0 ? Array.from(teacherSet).join(', ') : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">{reasonLabel}</td>
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
            className="px-4 py-1.5 bg-slate-600 text-white rounded text-xs font-bold hover:bg-slate-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default NetChangeDetailsModal;