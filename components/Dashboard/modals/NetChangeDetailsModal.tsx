/**
 * 순증감 KPI 근거 데이터 모달
 * - 이번 달 신입생 + 퇴원 학생을 한 화면에 표시
 * - 상단 요약: 신입생 N - 퇴원 M = 순증감 ±K
 * - read-only
 */
import React, { useMemo, useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { UnifiedStudent } from '../../../types/student';
import { isActiveEnrollment } from '../../../utils/dashboardUtils';
import { getWeekRange, getMonthRange } from '../../../utils/datePeriod';

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

const NetChangeDetailsModal: React.FC<NetChangeDetailsModalProps> = ({
  isOpen,
  onClose,
  students,
  yearMonth: _yearMonth,
  monthStart: _monthStart,
  monthEnd: _monthEnd,
}) => {
  // 기간 선택 — 기본: 이번 주차
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [offset, setOffset] = useState(0);
  const [newExpanded, setNewExpanded] = useState(false);
  const [withdrawnExpanded, setWithdrawnExpanded] = useState(false);
  const TABLE_PREVIEW = 5;

  useEffect(() => {
    if (isOpen) {
      setPeriod('week');
      setOffset(0);
      setNewExpanded(false);
      setWithdrawnExpanded(false);
    }
  }, [isOpen]);

  const range = useMemo(() => {
    return period === 'week' ? getWeekRange(offset) : getMonthRange(offset);
  }, [period, offset]);

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

  const withdrawnStudents = useMemo(() => {
    return students
      .filter(s => {
        if (s.status !== 'withdrawn' || !s.withdrawalDate) return false;
        const d = new Date(s.withdrawalDate);
        return d >= range.start && d <= range.end;
      })
      .sort((a, b) => (b.withdrawalDate || '').localeCompare(a.withdrawalDate || ''));
  }, [students, range]);

  const netChange = newStudents.length - withdrawnStudents.length;
  const netSign = netChange > 0 ? '+' : '';
  const netColor = netChange > 0 ? 'text-emerald-700' : netChange < 0 ? 'text-red-700' : 'text-black';

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
            <span className="text-black text-lg">📊</span>
            <h2 className="font-bold text-sm text-black">순증감 — 근거 데이터</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* 기간 네비게이션 */}
        <div className="flex items-center justify-between px-5 py-2 border-b bg-white">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOffset(o => o - 1)}
              className="p-1 hover:bg-gray-100 rounded text-black"
              title={period === 'week' ? '지난 주' : '지난 달'}
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
              title={period === 'week' ? '다음 주' : '다음 달'}
            >
              <ChevronRight size={16} />
            </button>
            {offset !== 0 && (
              <button
                onClick={() => setOffset(0)}
                className="ml-2 px-2 py-0.5 text-xs font-bold border border-slate-300 text-black rounded hover:bg-slate-50"
              >
                이번 {period === 'week' ? '주' : '달'}로
              </button>
            )}
          </div>
          <div className="flex items-center gap-0">
            <button
              onClick={() => { setPeriod('week'); setOffset(0); }}
              className={`px-3 py-1 text-xs font-bold rounded-l border ${
                period === 'week'
                  ? 'bg-slate-600 text-white border-slate-600'
                  : 'bg-white text-black border-gray-300 hover:bg-gray-50'
              }`}
            >
              주간
            </button>
            <button
              onClick={() => { setPeriod('month'); setOffset(0); }}
              className={`px-3 py-1 text-xs font-bold rounded-r border-y border-r ${
                period === 'month'
                  ? 'bg-slate-600 text-white border-slate-600'
                  : 'bg-white text-black border-gray-300 hover:bg-gray-50'
              }`}
            >
              월간
            </button>
          </div>
        </div>

        {/* 요약 */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-emerald-600">
              신입생 <b className="text-sm">{newStudents.length}명</b>
            </span>
            <span className="text-black">-</span>
            <span className="text-red-600">
              퇴원 <b className="text-sm">{withdrawnStudents.length}명</b>
            </span>
            <span className="text-black">=</span>
            <span className={netColor}>
              순증감 <b className="text-sm">{netSign}{netChange}명</b>
            </span>
          </div>
          <div className="text-xs text-black mt-1.5">
            선택 기간 학원 재원생 수의 순수 증감폭 = 신입생 - 퇴원
          </div>
        </div>

        {/* 본문: 신입생 + 퇴원 */}
        <div className="flex-1 overflow-auto">
          {/* 신입생 섹션 */}
          <div className="px-5 py-2 bg-emerald-50/50 border-b border-emerald-100 flex items-center gap-2">
            <span className="text-emerald-700">🆕</span>
            <h3 className="font-bold text-xs text-emerald-900">신입생 ({newStudents.length}명)</h3>
          </div>
          {newStudents.length === 0 ? (
            <div className="text-center py-6 text-black text-xs">이번 달 신입생이 없습니다.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-white border-b border-gray-200">
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
                {(newExpanded ? newStudents : newStudents.slice(0, TABLE_PREVIEW)).map((s) => {
                  const active = (s.enrollments || []).filter((e: any) => isActiveEnrollment(e));
                  const subjectSet = new Set(active.map(e => SUBJECT_LABEL[e.subject] || e.subject));
                  const teacherSet = new Set(
                    active.map(e => e.teacher).filter((t): t is string => !!t && t.length > 0)
                  );
                  return (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono text-black whitespace-nowrap">{s.startDate || '-'}</td>
                      <td className="px-3 py-1.5 font-medium text-black">{s.name}</td>
                      <td className="px-3 py-1.5 text-black">
                        {s.school || '-'}{s.grade ? ` / ${s.grade}` : ''}
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
              onClick={() => setNewExpanded(e => !e)}
              className="w-full px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 border-t border-gray-200 flex items-center justify-center gap-1"
            >
              {newExpanded ? (
                <>접기 <ChevronUp size={14} /></>
              ) : (
                <>+ {newStudents.length - TABLE_PREVIEW}명 더 보기 <ChevronDown size={14} /></>
              )}
            </button>
          )}

          {/* 퇴원 섹션 */}
          <div className="px-5 py-2 bg-red-50/50 border-y border-red-100 flex items-center gap-2 mt-2">
            <span className="text-red-700">🚪</span>
            <h3 className="font-bold text-xs text-red-900">퇴원 ({withdrawnStudents.length}명)</h3>
          </div>
          {withdrawnStudents.length === 0 ? (
            <div className="text-center py-6 text-black text-xs">이번 달 퇴원 학생이 없습니다.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-white border-b border-gray-200">
                <tr className="text-black">
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">퇴원일</th>
                  <th className="px-3 py-2 text-left font-medium">학생</th>
                  <th className="px-3 py-2 text-left font-medium">학교/학년</th>
                  <th className="px-3 py-2 text-left font-medium">수강 과목</th>
                  <th className="px-3 py-2 text-left font-medium">담당 강사</th>
                  <th className="px-3 py-2 text-left font-medium">퇴원 사유</th>
                </tr>
              </thead>
              <tbody>
                {(withdrawnExpanded ? withdrawnStudents : withdrawnStudents.slice(0, TABLE_PREVIEW)).map((s) => {
                  const allEnrolls = s.enrollments || [];
                  const subjectSet = new Set(allEnrolls.map(e => SUBJECT_LABEL[e.subject] || e.subject));
                  const teacherSet = new Set(
                    allEnrolls.map(e => e.teacher).filter((t): t is string => !!t && t.length > 0)
                  );
                  const reasonRaw = s.withdrawalReason || '';
                  const reasonLabel = WITHDRAWAL_REASON_LABELS[reasonRaw] || reasonRaw || '사유 미기재';
                  return (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono text-black whitespace-nowrap">{s.withdrawalDate || '-'}</td>
                      <td className="px-3 py-1.5 font-medium text-black">{s.name}</td>
                      <td className="px-3 py-1.5 text-black">
                        {s.school || '-'}{s.grade ? ` / ${s.grade}` : ''}
                      </td>
                      <td className="px-3 py-1.5 text-black">
                        {subjectSet.size > 0 ? Array.from(subjectSet).join(', ') : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-black">
                        {teacherSet.size > 0 ? Array.from(teacherSet).join(', ') : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-black">{reasonLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {withdrawnStudents.length > TABLE_PREVIEW && (
            <button
              type="button"
              onClick={() => setWithdrawnExpanded(e => !e)}
              className="w-full px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 border-t border-gray-200 flex items-center justify-center gap-1"
            >
              {withdrawnExpanded ? (
                <>접기 <ChevronUp size={14} /></>
              ) : (
                <>+ {withdrawnStudents.length - TABLE_PREVIEW}명 더 보기 <ChevronDown size={14} /></>
              )}
            </button>
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