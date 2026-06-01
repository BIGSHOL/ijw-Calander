/**
 * 신입생 정보 모달 (시간표 헤더 신입 명단의 학생 클릭 시 표시)
 * 구조:
 *  1) 예정된 수강 목록 — 과목별 신입 여부 구분
 *  2) 수강내역 — 제목만
 *  3) 수강 세부 내역 — 가장 최신 1건 풀 표시
 *
 * "최신" 판별 기준: 재원으로 등록된 입학상담(consultations 컬렉션, source='입학') 중 가장 최근.
 *  입학상담이 없으면 전체 통합 목록의 최신으로 폴백.
 */
import React, { useMemo, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { useStudentConsultations } from '../../../../hooks/useStudentConsultations';
import { useConsultations } from '../../../../hooks/useConsultations';
import { exportNewStudentPrint } from '../utils/newStudentPrintExport';

interface SubjectEnrollment {
  subject: string;          // 'math' | 'highmath' | 'english' | ...
  className: string;
  teacher?: string;
  startDate?: string;
  endDate?: string;
  withdrawalDate?: string;
  cancelledAt?: string;
}

interface StudentInfo {
  id: string;
  name: string;
  school?: string;
  grade?: string;
  parentName?: string;
  parentPhone?: string;
  studentPhone?: string;
  enrollments?: SubjectEnrollment[];
}

interface NewStudentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentInfo | null;
  /** 신입 윈도우 기준일 (보통 주의 일요일) — 과목별 신입 판정에 사용 */
  referenceDate: string;
}

const SUBJECT_LABEL: Record<string, string> = {
  math: '수학',
  highmath: '고등수학',
  english: '영어',
  korean: '국어',
  science: '과학',
  other: '기타',
};

/** 과목 카테고리 정규화 (수학 = math + highmath) */
const subjectGroup = (s: string): string => (s === 'highmath' ? 'math' : s);

/** 활성 enrollment 판정 (취소·종료 제외) */
const isActive = (e: SubjectEnrollment): boolean => {
  if (e.cancelledAt) return false;
  if (e.endDate || e.withdrawalDate) return false;
  return true;
};

const NewStudentDetailsModal: React.FC<NewStudentDetailsModalProps> = ({
  isOpen,
  onClose,
  student,
  referenceDate,
}) => {
  // 학생 상담 (재원생 상담일지)
  const { consultations: studentConsults = [] } = useStudentConsultations(
    student?.id ? { studentId: student.id } : undefined
  );
  // 입학 상담 (예비원생 → 등록 전환 기록)
  const { data: regConsults = [] } = useConsultations(
    student?.id ? { studentId: student.id } : {}
  );

  // 두 컬렉션 통합 정렬 (date desc)
  const sortedConsultations = useMemo(() => {
    const merged = [
      ...studentConsults.map((c: any) => ({
        id: c.id,
        date: c.date,
        title: c.title,
        content: c.content,
        consultantName: c.consultantName,
        source: '재원' as const,
      })),
      ...regConsults.map((c: any) => ({
        id: c.id,
        date: c.consultationDate,
        title: c.status ? `[${c.status}] 입학 상담` : '입학 상담',
        content: c.notes,
        consultantName: c.counselor,
        source: '입학' as const,
      })),
    ];
    return merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [studentConsults, regConsults]);

  // "최신" 기준 = 재원으로 등록된 입학상담(consultations, source='입학') 중 가장 최근.
  //  입학상담이 없으면 전체 통합 목록의 최신으로 폴백.
  const latestConsultation = useMemo(() => {
    const admission = sortedConsultations.find(c => c.source === '입학');
    return admission || sortedConsultations[0];
  }, [sortedConsultations]);
  const latestKey = latestConsultation
    ? `${latestConsultation.source}-${latestConsultation.id}`
    : null;

  // 과목별 enrollment 그룹화 (수학+고등수학 합산) — 신입인 과목만 표시
  const subjectsInfo = useMemo(() => {
    if (!student?.enrollments) return [];
    const refMs = new Date(referenceDate).getTime();
    const activeEnrolls = student.enrollments.filter(isActive);
    // 과목별로 첫 startDate 찾기 (해당 학생의 그 과목 시작일)
    const groupMap = new Map<string, { startDates: string[]; classes: SubjectEnrollment[] }>();
    activeEnrolls.forEach(e => {
      const g = subjectGroup(e.subject);
      if (!groupMap.has(g)) groupMap.set(g, { startDates: [], classes: [] });
      const grp = groupMap.get(g)!;
      grp.classes.push(e);
      if (e.startDate) grp.startDates.push(e.startDate);
    });
    return Array.from(groupMap.entries())
      .map(([g, info]) => {
        const firstStart = info.startDates.sort()[0]; // 가장 빠른 시작일
        const daysSince = firstStart
          ? Math.floor((refMs - new Date(firstStart).getTime()) / (1000 * 60 * 60 * 24))
          : -1;
        const isNew = firstStart ? daysSince >= 0 && daysSince <= 30 : false;
        return {
          subject: g,
          label: SUBJECT_LABEL[g] || g,
          firstStart,
          daysSince,
          isNew,
          classes: info.classes,
        };
      })
      // 신입인 과목만 표시 (영어 1년차 같은 기존 수강 과목은 제외)
      .filter(info => info.isNew);
  }, [student?.enrollments, referenceDate]);

  // [2] 수강내역 — 학생이 등록한 모든 활성 수업(개별 enrollment row 단위)
  const enrollmentRows = useMemo(() => {
    if (!student?.enrollments) return [];
    const refMs = new Date(referenceDate).getTime();
    return student.enrollments
      .filter(isActive)
      .map(e => {
        const daysSince = e.startDate
          ? Math.floor((refMs - new Date(e.startDate).getTime()) / (1000 * 60 * 60 * 24))
          : -1;
        return {
          ...e,
          groupLabel: SUBJECT_LABEL[subjectGroup(e.subject)] || e.subject,
          daysSince,
        };
      })
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }, [student?.enrollments, referenceDate]);

  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (!student || isPrinting) return;
    setIsPrinting(true);
    try {
      await exportNewStudentPrint({
        student: {
          id: student.id,
          name: student.name,
          school: student.school,
          grade: student.grade,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          studentPhone: student.studentPhone,
        },
        consultations: sortedConsultations.map(c => ({
          date: c.date,
          title: c.title,
          content: c.content,
          consultantName: c.consultantName,
          source: c.source,
        })),
        enrollments: enrollmentRows.map(e => ({
          subject: e.subject,
          className: e.className,
          teacher: e.teacher,
          startDate: e.startDate,
          endDate: e.endDate,
          groupLabel: e.groupLabel,
        })),
        todayDate: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      console.error('[NewStudentPrint] export failed', err);
      alert('프린트 파일 생성 중 오류가 발생했습니다.\n' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsPrinting(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[8vh] bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[480px] max-w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-pink-50">
          <div className="flex items-center gap-2">
            <span className="text-pink-700 text-lg">🆕</span>
            <h2 className="font-bold text-base text-pink-900">{student.name}</h2>
            <span className="text-xs text-pink-700 bg-pink-200 px-1.5 py-0.5 rounded">신입생</span>
            {(student.school || student.grade) && (
              <span className="text-xs text-gray-500">
                {student.grade || ''} {student.school || ''}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-pink-100 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {/* [1] 예정된 수강 목록 */}
          <section className="border-b border-gray-200">
            <div className="px-5 py-2 bg-pink-50/50 border-b border-pink-100">
              <h3 className="font-bold text-xs text-pink-900">📚 신입 수강 ({subjectsInfo.length}과목)</h3>
            </div>
            {subjectsInfo.length === 0 ? (
              <div className="px-5 py-4 text-center text-xs text-gray-400">신입(30일 이내) 수강 과목 없음</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {subjectsInfo.map(info => (
                  <div key={info.subject} className="px-5 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-gray-800 w-12 shrink-0">{info.label}</span>
                      <span className="text-[10px] text-gray-500 truncate">
                        {info.classes.map(c => c.className).join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {info.isNew ? (
                        <span className="px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded text-[10px] font-bold whitespace-nowrap">
                          신입 ({info.daysSince}일차)
                        </span>
                      ) : info.firstStart ? (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold whitespace-nowrap">
                          {info.daysSince > 365
                            ? `${Math.floor(info.daysSince / 365)}년차`
                            : info.daysSince > 30
                            ? `${Math.floor(info.daysSince / 30)}개월차`
                            : `${info.daysSince}일차`}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px]">-</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* [2] 수강내역 — 학생이 등록한 활성 수업 목록 */}
          <section className="border-b border-gray-200">
            <div className="px-5 py-2 bg-indigo-50/50 border-b border-indigo-100">
              <h3 className="font-bold text-xs text-indigo-900">
                📋 수강내역 ({enrollmentRows.length}건)
              </h3>
            </div>
            {enrollmentRows.length === 0 ? (
              <div className="px-5 py-4 text-center text-xs text-gray-400">등록된 수강 없음</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
                {enrollmentRows.map((e, idx) => (
                  <div
                    key={`${e.subject}-${e.className}-${e.startDate || idx}`}
                    className="px-5 py-1.5 flex items-center gap-2 text-xs"
                  >
                    {/* 수강 시작일 (YY-MM-DD) — 과목 라벨 앞. 데이터 없으면 회색 '-' */}
                    <span
                      className={`text-xs font-mono shrink-0 w-[68px] ${e.startDate ? 'text-black font-bold' : 'text-gray-300'}`}
                      title={e.startDate ? '수강 시작일' : '시작일 데이터 없음 (enrollment 에 startDate 미저장)'}
                    >
                      {e.startDate ? e.startDate.slice(2, 10) : '-'}
                    </span>
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded shrink-0 bg-amber-100 text-amber-700">
                      {e.groupLabel}
                    </span>
                    <span className="text-gray-700 truncate flex-1">{e.className}</span>
                    {e.teacher && (
                      <span className="text-[10px] text-gray-400 shrink-0">{e.teacher}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* [3] 상담 세부 내역 — 최신 1건 본문 + 나머지 제목만 (없으면 empty state) */}
          <section>
            <div className="px-5 py-2 bg-indigo-50/50 border-b border-indigo-100">
              <h3 className="font-bold text-xs text-indigo-900">
                📖 상담 세부 내역 ({sortedConsultations.length}건)
              </h3>
            </div>
            {sortedConsultations.length === 0 ? (
              <div className="px-5 py-4 text-center text-xs text-gray-400">상담 내역 없음</div>
            ) : (
              <>
              {/* 최신 1건 — 본문 풀 표시 */}
              {latestConsultation && (
                <div className="px-5 py-3 space-y-1.5 border-b border-gray-100 bg-indigo-50/20">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-gray-500">{latestConsultation.date}</span>
                    {latestConsultation.consultantName && (
                      <span className="text-gray-500">— {latestConsultation.consultantName}</span>
                    )}
                    <span className="text-[9px] text-indigo-600 font-bold ml-auto">최신</span>
                  </div>
                  <div className="text-xs font-bold text-gray-800">
                    {latestConsultation.title || '(제목 없음)'}
                  </div>
                  <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {latestConsultation.content || <span className="text-gray-400">(본문 없음)</span>}
                  </div>
                </div>
              )}
              {/* 나머지 상담 — 제목만 (latest 제외) */}
              {sortedConsultations.length > 1 && (
                <div className="divide-y divide-gray-100 max-h-[180px] overflow-y-auto">
                  {sortedConsultations
                    .filter(c => `${c.source}-${c.id}` !== latestKey)
                    .map((c) => (
                    <div
                      key={`detail-${c.source}-${c.id}`}
                      className="px-5 py-1.5 flex items-center gap-2 text-xs"
                    >
                      <span className="font-mono text-gray-500 w-20 shrink-0">{c.date || '-'}</span>
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${
                          c.source === '입학'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {c.source}
                      </span>
                      <span className="text-gray-700 truncate flex-1">
                        {c.title || '(제목 없음)'}
                      </span>
                      {c.consultantName && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {c.consultantName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </>
            )}
          </section>
        </div>

        {/* 푸터 */}
        <div className="px-5 py-2 border-t bg-gray-50 flex justify-between items-center">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="상담기록 + 수강내역 + 출석기록을 엑셀(K프린트 양식)로 다운로드"
          >
            <Printer size={14} />
            {isPrinting ? '생성중...' : 'K프린트 다운로드'}
          </button>
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

export default NewStudentDetailsModal;