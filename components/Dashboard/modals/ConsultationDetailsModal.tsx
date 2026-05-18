/**
 * 상담 완료율 KPI 근거 데이터 모달
 * - 이번 달 상담 완료 통계 + 미완료 학생 목록
 * - 강사별 상담 건수
 * - read-only
 */
import React from 'react';
import { X } from 'lucide-react';
import type { ConsultationStatsResult, StudentNeedingConsultation, ConsultationMissingReason } from '../../../hooks/useConsultationStats';
import type { StaffPerformance } from '../PerformanceProgress';

const REASON_CONFIG: Record<ConsultationMissingReason, { label: string; bg: string; text: string; icon: string }> = {
  new_student:    { label: '신입생',     bg: 'bg-sky-100',     text: 'text-sky-700',     icon: '🆕' },
  recent_consult: { label: '최근 상담',  bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '🕐' },
  no_response:    { label: '연락 미응답', bg: 'bg-amber-100',   text: 'text-amber-700',   icon: '📵' },
  pending:        { label: '진행 대기중', bg: 'bg-red-100',     text: 'text-red-700',     icon: '⚠️' },
};

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

  // 미완료 사유별 카운트
  const reasonCounts = needing.reduce<Record<ConsultationMissingReason, number>>(
    (acc, n) => { acc[n.reason] = (acc[n.reason] || 0) + 1; return acc; },
    { new_student: 0, recent_consult: 0, no_response: 0, pending: 0 }
  );

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
          {/* 미완료 사유 분포 */}
          {needing.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(['new_student', 'recent_consult', 'no_response', 'pending'] as ConsultationMissingReason[]).map(r => {
                const cnt = reasonCounts[r];
                if (cnt === 0) return null;
                const cfg = REASON_CONFIG[r];
                return (
                  <span key={r} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                    <span>{cfg.icon}</span>
                    <span>{cfg.label}</span>
                    <b>{cnt}</b>
                  </span>
                );
              })}
            </div>
          )}
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
                    <th
                      className="px-3 py-1.5 text-right font-medium cursor-help"
                      title={`이번 달 작성한 학생 상담 기록 수 (Firestore: studentConsultations)\n· 기간: ${yearMonth} 1일 ~ 말일\n· consultantId = 해당 강사 id 인 건수`}
                    >
                      상담 건수
                    </th>
                    <th
                      className="px-3 py-1.5 text-right font-medium cursor-help"
                      title="달성률 = 상담 건수 ÷ 담당 학생 수(가중) × 100&#10;담당 학생 수: 강사가 담임/부담임으로 맡은 (학생×과목) 슬롯 비율 가중 합&#10;예: 학생 A 가 월화목금=김선생, 수=이선생 → 김선생 +0.8 / 이선생 +0.2"
                    >
                      달성률
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {staffPerformances.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 font-medium text-gray-900">{s.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{s.consultationCount}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span
                          title={`이번 달 학생 상담 ${s.consultationCount}건 ÷ 담당 학생 수(가중) ${s.targetCount}명 × 100\n· 분자: ${yearMonth} 기간 내 이 강사가 작성한 학생 상담 기록 수\n· 분모: 강사가 담당하는 (학생×과목) 가중 합 — 월/화/목/금=담임, 수=부담임(slotTeachers) 슬롯 비율 분할`}
                          className={`font-bold cursor-help ${
                            s.percentage >= 100
                              ? 'text-emerald-600'
                              : s.percentage >= 50
                                ? 'text-amber-600'
                                : 'text-red-500'
                          }`}
                        >
                          {s.percentage}%
                        </span>
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
                    <th className="px-3 py-1.5 text-left font-medium">사유</th>
                    <th className="px-3 py-1.5 text-left font-medium">마지막 상담일</th>
                  </tr>
                </thead>
                <tbody>
                  {needing.slice(0, 100).map((n, idx) => {
                    const cfg = REASON_CONFIG[n.reason];
                    return (
                      <tr key={`${n.studentId}-${n.subject}-${idx}`} className="border-b border-gray-100">
                        <td className="px-3 py-1.5 font-medium text-gray-900 whitespace-nowrap">{n.studentName}</td>
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
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`} title={n.reasonDetail || cfg.label}>
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                          </span>
                          {n.reasonDetail && (
                            <span className="ml-1.5 text-[10px] text-gray-400">{n.reasonDetail}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 font-mono">
                          {n.lastConsultationDate || (
                            <span className="text-red-500">(상담 기록 없음)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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