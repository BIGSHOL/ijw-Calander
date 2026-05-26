/**
 * 신입생 정보 모달 (시간표 헤더 신입 명단의 학생 클릭 시 표시)
 * 구조:
 *  1) 예정된 수강 목록 — 과목별 신입 여부 구분
 *  2) 상담 내역 목록 — 제목만
 *  3) 상담 내역 본문 — 가장 최신 1건 풀 표시
 */
import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useStudentConsultations } from '../../../../hooks/useStudentConsultations';

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
  const { data: consultations = [], isLoading: consultLoading } = useStudentConsultations(
    student?.id ? { studentId: student.id } : undefined
  );

  // 상담 정렬 (date desc)
  const sortedConsultations = useMemo(() => {
    return [...consultations].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [consultations]);

  const latestConsultation = sortedConsultations[0];

  // 과목별 enrollment 그룹화 (수학+고등수학 합산)
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
    return Array.from(groupMap.entries()).map(([g, info]) => {
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
    });
  }, [student?.enrollments, referenceDate]);

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
              <h3 className="font-bold text-xs text-pink-900">📚 예정된 수강 ({subjectsInfo.length}과목)</h3>
            </div>
            {subjectsInfo.length === 0 ? (
              <div className="px-5 py-4 text-center text-xs text-gray-400">활성 수강 정보 없음</div>
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

          {/* [2] 상담 내역 목록 (제목만) */}
          <section className="border-b border-gray-200">
            <div className="px-5 py-2 bg-indigo-50/50 border-b border-indigo-100">
              <h3 className="font-bold text-xs text-indigo-900">
                💬 상담 내역 ({sortedConsultations.length}건)
              </h3>
            </div>
            {consultLoading ? (
              <div className="px-5 py-4 text-center text-xs text-gray-400">로딩 중...</div>
            ) : sortedConsultations.length === 0 ? (
              <div className="px-5 py-4 text-center text-xs text-gray-400">상담 기록 없음</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
                {sortedConsultations.map((c, idx) => (
                  <div
                    key={c.id}
                    className={`px-5 py-1.5 flex items-center gap-2 text-xs ${
                      idx === 0 ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    <span className="font-mono text-gray-500 w-20 shrink-0">{c.date || '-'}</span>
                    <span className="text-gray-700 truncate flex-1">{c.title || '(제목 없음)'}</span>
                    {c.consultantName && (
                      <span className="text-[10px] text-gray-400 shrink-0">{c.consultantName}</span>
                    )}
                    {idx === 0 && (
                      <span className="text-[9px] text-indigo-600 font-bold shrink-0">최신</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* [3] 최신 상담 본문 */}
          {latestConsultation && (
            <section>
              <div className="px-5 py-2 bg-indigo-50/50 border-b border-indigo-100">
                <h3 className="font-bold text-xs text-indigo-900">📖 최신 상담 본문</h3>
              </div>
              <div className="px-5 py-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-gray-500">{latestConsultation.date}</span>
                  {latestConsultation.consultantName && (
                    <span className="text-gray-500">— {latestConsultation.consultantName}</span>
                  )}
                </div>
                <div className="text-xs font-bold text-gray-800">{latestConsultation.title || '(제목 없음)'}</div>
                <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {latestConsultation.content || <span className="text-gray-400">(본문 없음)</span>}
                </div>
              </div>
            </section>
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

export default NewStudentDetailsModal;