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
import { RemarksPopover } from '../../Common/RemarksPopover';

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

/** 강사 subjects + 상담 카운트 → '수학' / '영어' / '수학·영어' 라벨 */
const formatSubjectsLabel = (
  subjects?: string[],
  mathCount: number = 0,
  englishCount: number = 0
): string => {
  // 1) staff.subjects 우선
  if (subjects && subjects.length > 0) {
    const hasMath = subjects.some(s => s === 'math' || s === 'highmath');
    const hasEng = subjects.includes('english');
    if (hasMath && hasEng) return '수학·영어';
    if (hasMath) return '수학';
    if (hasEng) return '영어';
  }
  // 2) 상담 subject 카운트 fallback (강사 데이터 부재 시)
  if (mathCount > 0 && englishCount === 0) return '수학';
  if (englishCount > 0 && mathCount === 0) return '영어';
  if (mathCount > 0 && englishCount > 0) return mathCount >= englishCount ? '수학*' : '영어*';
  return '';
};

/** 카테고리 합산용 분류 — staff.subjects 우선, 상담 다수결 fallback */
const teacherCategory = (
  subjects?: string[],
  mathCount: number = 0,
  englishCount: number = 0
): 'math' | 'english' | 'both' | 'other' => {
  // 1) staff.subjects 우선
  if (subjects && subjects.length > 0) {
    const hasMath = subjects.some(s => s === 'math' || s === 'highmath');
    const hasEng = subjects.includes('english');
    if (hasMath && hasEng) return 'both';
    if (hasMath) return 'math';
    if (hasEng) return 'english';
  }
  // 2) 상담 다수결 fallback
  if (mathCount === 0 && englishCount === 0) return 'other';
  if (mathCount > 0 && englishCount === 0) return 'math';
  if (englishCount > 0 && mathCount === 0) return 'english';
  return mathCount >= englishCount ? 'math' : 'english';
};

const ConsultationDetailsModal: React.FC<ConsultationDetailsModalProps> = ({
  isOpen,
  onClose,
  stats,
  yearMonth,
}) => {
  if (!isOpen) return null;

  const totalEnrollments = stats?.totalSubjectEnrollments || 0;  // 사실 수강 건수
  const needing: StudentNeedingConsultation[] = stats?.studentsNeedingConsultation || [];
  // 의미 있는 분자/분모: 이력 0건 진행 대기중 학생은 제외
  const completed = stats?.completedCount ?? 0;
  const meaningfulTotal = stats?.meaningfulTargetCount ?? (completed + needing.length);
  const rate = meaningfulTotal > 0 ? Math.round((completed / meaningfulTotal) * 100) : 0;
  const excluded = Math.max(0, totalEnrollments - meaningfulTotal);  // 이력 없어 제외된 건수
  const staffPerformances: StaffPerformance[] = stats?.staffPerformances || [];
  const inactiveTeachers = stats?.inactiveTeachers || [];

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
          <div className="flex items-center gap-2">
            <RemarksPopover notes={[
              '고등부 학생은 상담 대상에서 제외됩니다.',
            ]} />
            <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded">
              <X size={16} />
            </button>
          </div>
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
            <span
              className="text-gray-500 cursor-help"
              title={`전체 수강 ${totalEnrollments}건 중 상담 대상 ${meaningfulTotal}건\n· 제외: 상담 기록·예정 0건인 진행 대기중 학생 ${excluded}건\n· 수학+영어 동시 수강 → 2건 카운트`}
            >
              상담 대상 <b>{meaningfulTotal}</b>건
              {excluded > 0 && (
                <span className="text-gray-400"> (전체 수강 {totalEnrollments}건 중 이력 0건 {excluded}건 제외)</span>
              )}
            </span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5">
            기준: 이번 달 1건 이상 학생 상담 기록 있는 (학생 × 과목) 조합 = 완료.
            상담 기록·예정이 0건인 학생은 분모에서 제외 (의미 없는 미완료 노이즈 차단).
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
              <>
                {/* 카테고리(수학/영어) 합계 — staff.subjects 우선 + 상담 다수결 fallback */}
                {(() => {
                  const catOf = (s: StaffPerformance) => teacherCategory(s.subjects, s.mathCount, s.englishCount);
                  // both 는 수학·영어 각각 +1, 합계는 양쪽에 카운트
                  const mathPerf = staffPerformances.filter(s => catOf(s) === 'math' || catOf(s) === 'both');
                  const engPerf  = staffPerformances.filter(s => catOf(s) === 'english' || catOf(s) === 'both');
                  const otherPerf = staffPerformances.filter(s => catOf(s) === 'other');
                  const mathTotal = mathPerf.reduce((a, s) => a + s.consultationCount, 0);
                  const englishTotal = engPerf.reduce((a, s) => a + s.consultationCount, 0);
                  const otherTotal = otherPerf.reduce((a, s) => a + s.consultationCount, 0);
                  return (
                    <div className="flex flex-wrap items-center gap-3 mb-2 px-2 py-1.5 bg-gray-50 rounded text-[11px]">
                      <span className="text-gray-500">카테고리 합계:</span>
                      <span className="text-emerald-700">
                        수학 <b>{mathTotal}건</b>
                        <span className="text-gray-400"> · 강사 {mathPerf.length}명</span>
                      </span>
                      <span className="text-red-700">
                        영어 <b>{englishTotal}건</b>
                        <span className="text-gray-400"> · 강사 {engPerf.length}명</span>
                      </span>
                      {otherTotal > 0 && (
                        <span className="text-gray-600">기타 <b>{otherTotal}건</b> · 강사 {otherPerf.length}명</span>
                      )}
                    </div>
                  );
                })()}
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr className="text-gray-500">
                      <th className="px-3 py-1.5 text-left font-medium">강사</th>
                      <th
                        className="px-3 py-1.5 text-right font-medium cursor-help"
                        title={`이번 달 작성한 학생 상담 기록 수 (활동량)\n· 한 학생 여러 번 상담 → 여러 번 카운트\n· Firestore: studentConsultations, ${yearMonth} 기간`}
                      >
                        상담 건수
                      </th>
                      <th
                        className="px-3 py-1.5 text-right font-medium cursor-help"
                        title={`이번 달 만난 학생 수 (중복 제외, 커버리지)\n· 한 학생 여러 번 상담 → 1명으로 카운트\n· studentId 기준 dedupe`}
                      >
                        만난 학생
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPerformances.map((s) => {
                      const subjectLabel = formatSubjectsLabel(s.subjects, s.mathCount, s.englishCount);
                      const cat = teacherCategory(s.subjects, s.mathCount, s.englishCount);
                      const subjectColor =
                        cat === 'math' ? 'text-emerald-600' :
                        cat === 'english' ? 'text-red-600' :
                        cat === 'both' ? 'text-amber-600' :
                        'text-gray-400';
                      return (
                        <tr key={s.id} className="border-b border-gray-100">
                          <td className="px-3 py-1.5 font-medium text-gray-900">
                            {s.name}
                            {subjectLabel && (
                              <span className={`ml-1.5 text-[10px] font-normal ${subjectColor}`}>
                                ({subjectLabel})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">{s.consultationCount}<span className="text-gray-400 text-[10px]">건</span></td>
                          <td className="px-3 py-1.5 text-right font-mono text-gray-700">
                            {s.uniqueStudentCount}<span className="text-gray-400 text-[10px]">명</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </section>

          {/* 전화상담 0건 강사 — 별도 분류 */}
          {inactiveTeachers.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
                <span>⚠️</span>
                <span>이번 달 전화상담 0건 강사 ({inactiveTeachers.length}명)</span>
              </h3>
              <div className="border border-amber-200 bg-amber-50/40 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-amber-50">
                    <tr className="text-amber-700">
                      <th className="px-3 py-1.5 text-left font-medium">강사</th>
                      <th className="px-3 py-1.5 text-left font-medium">과목</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveTeachers.map((t) => {
                      const label = formatSubjectsLabel(t.subjects, 0, 0);
                      const cat = teacherCategory(t.subjects, 0, 0);
                      const color =
                        cat === 'math' ? 'text-emerald-600' :
                        cat === 'english' ? 'text-red-600' :
                        cat === 'both' ? 'text-amber-600' :
                        'text-gray-400';
                      return (
                        <tr key={t.id} className="border-b border-amber-100 last:border-b-0">
                          <td className="px-3 py-1.5 font-medium text-gray-900">{t.name}</td>
                          <td className={`px-3 py-1.5 text-[11px] ${color}`}>
                            {label || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 미완료 학생 목록 — 수학/영어 좌우 분리 */}
          <section>
            <h3 className="text-xs font-bold text-gray-700 mb-2">
              상담 미완료 학생 ({needing.length}건, 마지막 상담일 오래된 순)
            </h3>
            {needing.length === 0 ? (
              <div className="text-xs text-emerald-600 py-2">
                모든 학생이 이번 달 상담을 완료했습니다.
              </div>
            ) : (() => {
              const mathList = needing.filter(n => n.subject === 'math').slice(0, 100);
              const engList = needing.filter(n => n.subject === 'english').slice(0, 100);

              const renderTable = (
                list: StudentNeedingConsultation[],
                title: string,
                subjectColor: string,
              ) => (
                <div className="border border-gray-200 rounded overflow-hidden">
                  <div className={`px-3 py-1.5 text-xs font-bold ${subjectColor} border-b border-gray-200`}>
                    {title} ({list.length}건)
                  </div>
                  {list.length === 0 ? (
                    <div className="px-3 py-4 text-center text-[11px] text-gray-400">없음</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr className="text-gray-500">
                          <th className="px-2 py-1.5 text-left font-medium">학생</th>
                          <th className="px-2 py-1.5 text-left font-medium">사유</th>
                          <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">마지막 상담일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((n, idx) => {
                          const cfg = REASON_CONFIG[n.reason];
                          return (
                            <tr key={`${n.studentId}-${n.subject}-${idx}`} className="border-b border-gray-100">
                              <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">{n.studentName}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`} title={n.reasonDetail || cfg.label}>
                                  <span>{cfg.icon}</span>
                                  <span>{cfg.label}</span>
                                </span>
                                {n.reasonDetail && (
                                  <span className="ml-1.5 text-[10px] text-gray-400">{n.reasonDetail}</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-gray-600 font-mono whitespace-nowrap">
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
                </div>
              );

              return (
                <div className="grid grid-cols-2 gap-3">
                  {renderTable(mathList, '수학', 'bg-blue-50 text-blue-800')}
                  {renderTable(engList, '영어', 'bg-purple-50 text-purple-800')}
                </div>
              );
            })()}
            {needing.length > 200 && (
              <div className="text-[10px] text-gray-400 mt-1">
                과목별 상위 100건씩 표시. 전체 {needing.length}건은 학생 상담 탭에서 확인하세요.
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