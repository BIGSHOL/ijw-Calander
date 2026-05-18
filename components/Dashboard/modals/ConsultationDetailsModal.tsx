/**
 * 상담 완료율 KPI 근거 데이터 모달
 * - 이번 달 상담 완료 통계 + 미완료 학생 목록
 * - 강사별 상담 건수
 * - read-only
 */
import React from 'react';
import { X } from 'lucide-react';
import type { ConsultationStatsResult, StudentNeedingConsultation } from '../../../hooks/useConsultationStats';
import type { StaffPerformance } from '../PerformanceProgress';

interface ConsultationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: ConsultationStatsResult | null;
  yearMonth: string;
}

const SUBJECT_KO = (s: 'math' | 'english') => (s === 'math' ? '수학' : '영어');

const ConsultationDetailsModal: React.FC<ConsultationDetailsModalProps> = ({
  isOpen,
  onClose,
  stats,
  yearMonth,
}) => {
  if (!isOpen) return null;

  const total = stats?.totalSubjectEnrollments || 0;
  const needing: StudentNeedingConsultation[] = stats?.studentsNeedingConsultation || [];
  const completed = Math.max(0, total - needing.length);
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const staffPerformances: StaffPerformance[] = stats?.staffPerformances || [];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[8vh] bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[760px] max-w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-indigo-50">
          <div className="flex items-center gap-2">
            <span className="text-indigo-700 text-lg">💬</span>
            <h2 className="font-bold text-sm text-indigo-900">상담 완료율 — 근거 데이터</h2>
            <span className="text-xs text-indigo-500">{yearMonth}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* 요약 */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <span className="text-gray-500">
              완료율 <b className="text-indigo-700 text-sm">{rate}%</b>
            </span>
            <span className="text-emerald-600">
              완료 <b>{completed}</b>건
            </span>
            <span className="text-red-600">
              미완료 <b>{needing.length}</b>건
            </span>
            <span className="text-gray-500">
              총 수강 건수 <b>{total}</b>건 (수학+영어 동시 수강 → 2건 카운트)
            </span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5">
            기준: 이번 달 1건 이상 학생 상담 기록 있는 (학생 × 과목) 조합 = 완료.
            등록 상담은 별도 집계 (이 KPI 미포함).
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-auto px-5 py-3 space-y-4">
          {/* 강사별 상담 건수 */}
          <section>
            <h3 className="text-xs font-bold text-gray-700 mb-2">강사별 이번 달 학생 상담 건수</h3>
            {staffPerformances.length === 0 ? (
              <div className="text-xs text-gray-400 py-2">이번 달 상담 기록 없음.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">강사</th>
                    <th className="px-3 py-1.5 text-right font-medium">상담 건수</th>
                    <th className="px-3 py-1.5 text-right font-medium">목표 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {staffPerformances.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 font-medium text-gray-900">{s.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{s.consultationCount}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span
                          className={`font-bold ${
                            s.percentage >= 100
                              ? 'text-emerald-600'
                              : s.percentage >= 50
                                ? 'text-amber-600'
                                : 'text-red-500'
                          }`}
                        >
                          {s.percentage}%
                        </span>
                        <span className="text-gray-400 ml-1">/ {s.targetCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* 미완료 학생 목록 */}
          <section>
            <h3 className="text-xs font-bold text-gray-700 mb-2">
              상담 미완료 학생 ({needing.length}건, 마지막 상담일 오래된 순)
            </h3>
            {needing.length === 0 ? (
              <div className="text-xs text-emerald-600 py-2">
                모든 학생이 이번 달 상담을 완료했습니다.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">학생</th>
                    <th className="px-3 py-1.5 text-left font-medium">과목</th>
                    <th className="px-3 py-1.5 text-left font-medium">마지막 상담일</th>
                  </tr>
                </thead>
                <tbody>
                  {needing.slice(0, 100).map((n, idx) => (
                    <tr key={`${n.studentId}-${n.subject}-${idx}`} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 font-medium text-gray-900">{n.studentName}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            n.subject === 'math'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {SUBJECT_KO(n.subject)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-600 font-mono">
                        {n.lastConsultationDate || (
                          <span className="text-red-500">(상담 기록 없음)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {needing.length > 100 && (
              <div className="text-[10px] text-gray-400 mt-1">
                상위 100건 표시. 전체 {needing.length}건은 학생 상담 탭에서 확인하세요.
              </div>
            )}
          </section>
        </div>

        {/* 푸터 */}
        <div className="px-5 py-2 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultationDetailsModal;