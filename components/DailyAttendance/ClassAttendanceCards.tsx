// components/DailyAttendance/ClassAttendanceCards.tsx
// 수업별 출결 현황 카드 컴포넌트
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Users, BookOpen } from 'lucide-react';
import { DailyAttendanceRecord, UserProfile, UnifiedStudent } from '../../types';
import { useClasses } from '../../hooks/useClasses';
import { useStudents } from '../../hooks/useStudents';
import { getWeekdayFromDate, isDateInRange } from '../../utils/dateUtils';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';
import ClassAttendanceList from './ClassAttendanceList';

interface ClassAttendanceCardsProps {
  records: DailyAttendanceRecord[];
  selectedDate: string;
  userProfile: UserProfile | null;
  onRefresh: () => void;
  isLoading: boolean;
  selectedSubject?: 'all' | 'english' | 'math';
}

interface ClassSummary {
  classId: string;
  className: string;
  subject: string;
  totalStudents: number;
  processedCount: number;
  present: number;
  late: number;
  absent: number;
  earlyLeave: number;
  excused: number;
  unprocessed: number;
}

const ClassAttendanceCards: React.FC<ClassAttendanceCardsProps> = ({
  records,
  selectedDate,
  userProfile,
  onRefresh,
  isLoading,
  selectedSubject = 'all',
}) => {
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const saved = storage.getString(STORAGE_KEYS.DAILY_ATTENDANCE_PAGE_SIZE);
    return saved ? parseInt(saved, 10) : 10;
  });

  // 과목 필터 변경 시 페이지 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSubject, selectedDate]);

  // 모든 수업 목록 조회
  const { data: allClasses = [] } = useClasses();

  // 모든 학생 목록 조회 (enrollments 포함)
  const { students: allStudents = [] } = useStudents();

  // 수업별 출결 통계 계산
  const classSummaries = useMemo((): ClassSummary[] => {
    const summaryMap = new Map<string, ClassSummary>();

    // 선택된 날짜의 요일 구하기 (타임존 문제 수정)
    const selectedDayOfWeek = getWeekdayFromDate(selectedDate);

    // 1. 선택된 날짜에 수업이 있는 클래스만 초기화 (총 학생 수 포함)
    allClasses.forEach(cls => {
      const className = cls.className || cls.name || '';
      const schedule = cls.schedule || [];

      // 해당 수업이 선택된 요일에 있는지 확인
      const hasClassOnSelectedDay = schedule.some(slot => {
        // "월 1교시", "수 3교시" 형식에서 요일 추출
        const dayPart = slot.split(' ')[0];
        return dayPart === selectedDayOfWeek;
      });

      // 선택된 요일에 수업이 없으면 skip
      if (!hasClassOnSelectedDay) {
        return;
      }

      // 해당 수업에 등록된 학생 수 계산 (enrollments 기반)
      const studentsInClass = allStudents.filter((student: UnifiedStudent) => {
        const enrollments = student.enrollments || [];
        return enrollments.some(enr => {
          // 수업 매칭
          const matchesClass =
            (enr.classId === cls.id || enr.className === className) &&
            enr.subject === cls.subject;

          if (!matchesClass) return false;

          // 선택된 날짜 기준 활성 상태 확인
          const isActiveOnDate =
            isDateInRange(selectedDate, enr.enrollmentDate, enr.withdrawalDate) &&
            !enr.onHold;

          return isActiveOnDate;
        });
      });

      summaryMap.set(cls.id, {
        classId: cls.id,
        className: className,
        subject: cls.subject || 'unknown',
        totalStudents: studentsInClass.length,
        processedCount: 0,
        present: 0,
        late: 0,
        absent: 0,
        earlyLeave: 0,
        excused: 0,
        unprocessed: studentsInClass.length,
      });
    });

    // 2. 출결 기록 반영
    records.forEach(record => {
      const summary = summaryMap.get(record.classId);
      if (!summary) return;

      summary.processedCount++;

      switch (record.status) {
        case 'present':
          summary.present++;
          break;
        case 'late':
          summary.late++;
          break;
        case 'absent':
          summary.absent++;
          break;
        case 'early_leave':
          summary.earlyLeave++;
          break;
        case 'excused':
          summary.excused++;
          break;
      }
    });

    // 3. 미처리 학생 수 계산
    summaryMap.forEach((summary) => {
      summary.unprocessed = summary.totalStudents - summary.processedCount;
    });

    // 4. 과목 필터 적용
    let filteredSummaries = Array.from(summaryMap.values());
    if (selectedSubject !== 'all') {
      filteredSummaries = filteredSummaries.filter(summary => summary.subject === selectedSubject);
    }

    // 5. 과목별/수업명 정렬
    return filteredSummaries.sort((a, b) => {
      if (a.subject !== b.subject) {
        return a.subject.localeCompare(b.subject);
      }
      return a.className.localeCompare(b.className, 'ko');
    });
  }, [allClasses, records, allStudents, selectedDate, selectedSubject]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(classSummaries.length / itemsPerPage);
  const paginatedSummaries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return classSummaries.slice(start, start + itemsPerPage);
  }, [classSummaries, currentPage, itemsPerPage]);

  const handleItemsPerPageChange = (count: number) => {
    setItemsPerPage(count);
    setCurrentPage(1);
    storage.setString(STORAGE_KEYS.DAILY_ATTENDANCE_PAGE_SIZE, String(count));
  };

  const handleToggle = (classId: string) => {
    setExpandedClassId(prev => prev === classId ? null : classId);
  };

  const getSubjectIcon = (subject: string) => {
    switch (subject) {
      case 'english':
        return '📘';
      case 'math':
        return '📐';
      default:
        return '📚';
    }
  };

  const getSubjectLabel = (subject: string) => {
    switch (subject) {
      case 'english':
        return '영어';
      case 'math':
        return '수학';
      default:
        return subject;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Users className="w-8 h-8 text-gray-400 animate-pulse" />
      </div>
    );
  }

  if (classSummaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <BookOpen className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">수업이 없습니다</p>
        <p className="text-sm mt-1">선택한 날짜에 등록된 수업이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 수업 카드 목록 */}
      <div className="flex-1 overflow-auto space-y-2">
      {paginatedSummaries.map((summary) => {
        const isExpanded = expandedClassId === summary.classId;
        const classRecords = records.filter(r => r.classId === summary.classId);
        const completionRate = summary.totalStudents > 0
          ? Math.round((summary.processedCount / summary.totalStudents) * 100)
          : 0;

        return (
          <div
            key={summary.classId}
            className="bg-white rounded-sm shadow-sm overflow-hidden transition-all"
          >
            {/* 헤더 - 클릭 가능 */}
            <button
              onClick={() => handleToggle(summary.classId)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{getSubjectIcon(summary.subject)}</span>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-gray-900">{summary.className}</h3>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {getSubjectLabel(summary.subject)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-600">
                    <span className="font-medium">
                      {summary.processedCount} / {summary.totalStudents}명 처리
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className={summary.unprocessed > 0 ? 'text-orange-600 font-medium' : 'text-emerald-600 font-medium'}>
                      {summary.unprocessed > 0 ? `미처리 ${summary.unprocessed}명` : '완료'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* 진행률 바 */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <div className="w-20 h-1.5 bg-gray-200 rounded-sm overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        completionRate === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-8 text-right">
                    {completionRate}%
                  </span>
                </div>

                {/* 통계 요약 - 더 컴팩트하게 */}
                <div className="hidden md:flex items-center gap-1.5 text-xs">
                  {summary.present > 0 && (
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">
                      출석 {summary.present}
                    </span>
                  )}
                  {summary.late > 0 && (
                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
                      지각 {summary.late}
                    </span>
                  )}
                  {summary.absent > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded font-medium">
                      결석 {summary.absent}
                    </span>
                  )}
                  {summary.earlyLeave > 0 && (
                    <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded font-medium">
                      조퇴 {summary.earlyLeave}
                    </span>
                  )}
                  {summary.excused > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                      사유 {summary.excused}
                    </span>
                  )}
                </div>

                {/* 확장/축소 아이콘 */}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* 펼쳐진 내용 - 학생 목록 */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-3 py-3 bg-gray-50">
                {classRecords.length > 0 ? (
                  <ClassAttendanceList
                    records={classRecords}
                    selectedDate={selectedDate}
                    isLoading={false}
                    userProfile={userProfile}
                    onRefresh={onRefresh}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">아직 출결 처리된 학생이 없습니다</p>
                    <p className="text-xs mt-1 text-gray-400">
                      출석부에서 출결을 처리하면 자동으로 표시됩니다
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
          {/* 왼쪽: 항목 수 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">페이지당</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded-sm border border-gray-200 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={30}>30개</option>
              <option value={50}>50개</option>
            </select>
            <span className="text-xs text-gray-500">
              {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, classSummaries.length)} / 총 {classSummaries.length}개 수업
            </span>
          </div>

          {/* 오른쪽: 페이지 네비게이션 */}
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-700"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                      currentPage === pageNum
                        ? 'bg-emerald-500 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-700"
            >
              <ChevronRight size={14} />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default ClassAttendanceCards;
