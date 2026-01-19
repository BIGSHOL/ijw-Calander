import React, { useState, useMemo } from 'react';
import { UnifiedStudent, ClassHistoryEntry } from '../../../types';
import { BookOpen, Plus, User, X, Loader2, Users } from 'lucide-react';
import AssignClassModal from '../AssignClassModal';
import { useStudents } from '../../../hooks/useStudents';
import { useTeachers } from '../../../hooks/useFirebaseQueries';
import { ClassInfo, useClasses } from '../../../hooks/useClasses';
import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../../utils/styleUtils';
import ClassDetailModal from '../../ClassManagement/ClassDetailModal';
import { doc, deleteDoc, getDocs, collection, query, where, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';
import {
  SubjectForSchedule,
  MATH_PERIOD_INFO,
  ENGLISH_PERIOD_INFO,
  WEEKEND_PERIOD_INFO,
} from '../../Timetable/constants';

// 요일별 색상 정의
const DAY_COLORS: Record<string, { bg: string; text: string }> = {
  '월': { bg: '#fef3c7', text: '#92400e' },
  '화': { bg: '#fce7f3', text: '#9d174d' },
  '수': { bg: '#dbeafe', text: '#1e40af' },
  '목': { bg: '#d1fae5', text: '#065f46' },
  '금': { bg: '#e0e7ff', text: '#3730a3' },
  '토': { bg: '#fee2e2', text: '#991b1b' },
  '일': { bg: '#f3e8ff', text: '#6b21a8' },
};

// 수학 교시 라벨 포맷팅
function formatMathLabel(periods: string[]): string {
  const completeGroups: number[] = [];
  const usedPeriods = new Set<string>();

  for (let group = 1; group <= 4; group++) {
    const first = String(group * 2 - 1);
    const second = String(group * 2);

    if (periods.includes(first) && periods.includes(second)) {
      completeGroups.push(group);
      usedPeriods.add(first);
      usedPeriods.add(second);
    }
  }

  const allPeriodsUsed = periods.every(p => usedPeriods.has(p));

  if (allPeriodsUsed && completeGroups.length > 0) {
    return completeGroups.map(g => `${g}교시`).join(', ');
  } else {
    const times = periods.map(p => MATH_PERIOD_INFO[p]).filter(Boolean);
    if (times.length === 0) return '시간 미정';

    const startTime = times[0].startTime;
    const endTime = times[times.length - 1].endTime;
    return `${startTime}~${endTime}`;
  }
}

// 주말 교시 라벨 포맷팅
function formatWeekendLabel(periods: string[]): string {
  if (periods.length === 0) return '시간 미정';

  const times = periods
    .map(p => WEEKEND_PERIOD_INFO[p])
    .filter(Boolean)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (times.length === 0) return '시간 미정';

  const startTime = times[0].startTime;
  const endTime = times[times.length - 1].endTime;
  return `${startTime}~${endTime}`;
}

// 영어 교시 라벨 포맷팅
function formatEnglishLabel(periods: string[]): string {
  if (periods.length === 0) return '시간 미정';

  const nums = periods.map(Number).sort((a, b) => a - b);

  if (nums.length === 1) {
    return `${nums[0]}교시`;
  }

  const isConsecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);

  if (isConsecutive) {
    return `${nums[0]}~${nums[nums.length - 1]}교시`;
  } else {
    return nums.map(n => `${n}교시`).join(', ');
  }
}

interface ScheduleBadgeProps {
  schedule?: string[];
  subject: SubjectForSchedule;
}

const ScheduleBadge: React.FC<ScheduleBadgeProps> = ({ schedule, subject }) => {
  if (!schedule || schedule.length === 0) {
    return <span className="text-gray-400 italic text-xxs">시간 미정</span>;
  }

  const getPeriodInfoForDay = (day: string) => {
    if (day === '토' || day === '일') {
      return WEEKEND_PERIOD_INFO;
    }
    return subject === 'english' ? ENGLISH_PERIOD_INFO : MATH_PERIOD_INFO;
  };

  const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];

  const dayPeriods: Map<string, string[]> = new Map();

  for (const item of schedule) {
    const parts = item.split(' ');
    const day = parts[0];
    const periodId = parts[1] || '';
    const periodInfo = getPeriodInfoForDay(day);
    if (!periodId || !periodInfo[periodId]) continue;

    if (!dayPeriods.has(day)) {
      dayPeriods.set(day, []);
    }
    dayPeriods.get(day)!.push(periodId);
  }

  if (dayPeriods.size === 0) {
    return <span className="text-gray-400 italic text-xxs">시간 미정</span>;
  }

  const dayLabels: Map<string, string> = new Map();

  for (const [day, periods] of dayPeriods) {
    const sortedPeriods = periods.sort((a, b) => Number(a) - Number(b));
    const isWeekend = day === '토' || day === '일';

    let label: string;
    if (isWeekend) {
      label = formatWeekendLabel(sortedPeriods);
    } else if (subject === 'english') {
      label = formatEnglishLabel(sortedPeriods);
    } else {
      label = formatMathLabel(sortedPeriods);
    }
    dayLabels.set(day, label);
  }

  const labelToDays: Map<string, string[]> = new Map();

  for (const [day, label] of dayLabels) {
    if (!labelToDays.has(label)) {
      labelToDays.set(label, []);
    }
    labelToDays.get(label)!.push(day);
  }

  const entries: Array<{ days: string[]; label: string }> = [];
  for (const [label, days] of labelToDays) {
    days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    entries.push({ days, label });
  }

  entries.sort((a, b) => dayOrder.indexOf(a.days[0]) - dayOrder.indexOf(b.days[0]));

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-0.5">
          <div className="flex">
            {entry.days.map((day, dayIdx) => {
              const colors = DAY_COLORS[day] || { bg: '#f3f4f6', text: '#374151' };
              return (
                <span
                  key={day}
                  className={`px-1 py-0.5 text-micro font-bold ${dayIdx === 0 ? 'rounded-l' : ''} ${dayIdx === entry.days.length - 1 ? 'rounded-r' : ''}`}
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  {day}
                </span>
              );
            })}
          </div>
          <span className="text-xxs font-semibold text-gray-700">
            {entry.label}
          </span>
          {idx < entries.length - 1 && (
            <span className="text-gray-300 mx-0.5">/</span>
          )}
        </div>
      ))}
    </div>
  );
};

interface CoursesTabProps {
  student: UnifiedStudent;
  compact?: boolean; // 컴팩트 모드 (모달)
}

interface GroupedEnrollment {
  className: string;
  subject: 'math' | 'english';
  teachers: string[];
  days: string[];
  enrollmentIds: string[]; // 삭제를 위해 enrollment ID 저장
  startDate?: string; // 수강 시작일
  endDate?: string; // 수강 종료일 (undefined = 재원중)
}

const CoursesTab: React.FC<CoursesTabProps> = ({ student, compact = false }) => {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [deletingClass, setDeletingClass] = useState<string | null>(null);
  const { refreshStudents } = useStudents();
  const { data: teachers = [], isLoading: loadingTeachers } = useTeachers();
  const { data: allClasses = [] } = useClasses();
  const queryClient = useQueryClient();

  // 날짜 포맷팅 함수 (YYYY-MM-DD -> YY.MM.DD)
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const year = String(date.getFullYear()).slice(2); // 마지막 2자리
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 같은 수업(className)끼리 그룹화 + 수강 이력 정보 추가
  const groupedEnrollments = useMemo(() => {
    const groups = new Map<string, GroupedEnrollment>();

    (student.enrollments || []).forEach(enrollment => {
      const key = `${enrollment.subject}_${enrollment.className}`;

      // classHistory에서 해당 수업의 이력 찾기 (endDate가 없는 항목 = 현재 수강중)
      const classHistory = student.classHistory || [];
      const currentHistory = classHistory.find(
        h => h.className === enrollment.className &&
             h.subject === enrollment.subject &&
             !h.endDate
      );

      if (groups.has(key)) {
        const existing = groups.get(key)!;
        if (!existing.teachers.includes(enrollment.teacherId)) {
          existing.teachers.push(enrollment.teacherId);
        }
        enrollment.days?.forEach(day => {
          if (!existing.days.includes(day)) {
            existing.days.push(day);
          }
        });
        // enrollment ID 추가
        if ((enrollment as any).id && !existing.enrollmentIds.includes((enrollment as any).id)) {
          existing.enrollmentIds.push((enrollment as any).id);
        }
      } else {
        groups.set(key, {
          className: enrollment.className,
          subject: enrollment.subject,
          teachers: [enrollment.teacherId],
          days: [...(enrollment.days || [])],
          enrollmentIds: (enrollment as any).id ? [(enrollment as any).id] : [],
          startDate: currentHistory?.startDate,
          endDate: currentHistory?.endDate,
        });
      }
    });

    return Array.from(groups.values());
  }, [student.enrollments, student.classHistory]);

  // 수업의 대표 강사 결정
  const getMainTeacher = (group: GroupedEnrollment): string | null => {
    const teacherCounts: Record<string, number> = {};

    student.enrollments
      .filter(e => e.subject === group.subject && e.className === group.className)
      .forEach(enrollment => {
        const teacherName = enrollment.teacherId;
        const teacherData = teachers.find(t => t.name === teacherName);
        if (teacherData?.isHidden) return;

        const dayCount = enrollment.days?.length || 0;
        teacherCounts[teacherName] = (teacherCounts[teacherName] || 0) + dayCount;
      });

    const teacherEntries = Object.entries(teacherCounts);
    if (teacherEntries.length === 0) return null;

    const maxCount = Math.max(...teacherEntries.map(([, count]) => count));
    const topTeachers = teacherEntries.filter(([, count]) => count === maxCount);

    if (topTeachers.length === 1) return topTeachers[0][0];

    const nonNativeTeachers = topTeachers.filter(([name]) => {
      const teacherData = teachers.find(t => t.name === name);
      return !teacherData?.isNative;
    });

    return nonNativeTeachers.length > 0 ? nonNativeTeachers[0][0] : topTeachers[0][0];
  };

  // 수업 클릭 시 ClassDetailModal용 ClassInfo 생성
  const handleClassClick = (group: GroupedEnrollment) => {
    // allClasses에서 실제 수업 정보 찾기
    const actualClass = allClasses.find(
      c => c.className === group.className && c.subject === group.subject
    );

    if (actualClass) {
      // 실제 수업 정보가 있으면 그대로 사용
      setSelectedClass(actualClass);
    } else {
      // 없으면 enrollment 기반으로 기본 정보 생성
      const mainTeacher = getMainTeacher(group);
      const classInfo: ClassInfo = {
        id: `${group.subject}_${group.className}`,
        className: group.className,
        subject: group.subject,
        teacher: mainTeacher || group.teachers[0] || '',
        schedule: group.days.map(day => `${day}`),
        studentCount: 0,
      };
      setSelectedClass(classInfo);
    }
  };

  // 수업 배정 취소 (해당 학생의 enrollment만 삭제)
  const handleRemoveEnrollment = async (group: GroupedEnrollment, e: React.MouseEvent) => {
    e.stopPropagation(); // 행 클릭 이벤트 전파 방지

    const confirmMsg = `"${group.className}" 수업에서 ${student.name} 학생을 제외하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    const key = `${group.subject}_${group.className}`;
    setDeletingClass(key);

    try {
      // 1. 저장된 enrollmentIds가 있으면 사용
      if (group.enrollmentIds.length > 0) {
        for (const enrollmentId of group.enrollmentIds) {
          await deleteDoc(doc(db, `students/${student.id}/enrollments`, enrollmentId));
        }
      } else {
        // 2. enrollmentIds가 없으면 쿼리로 찾아서 삭제
        const enrollmentsRef = collection(db, `students/${student.id}/enrollments`);
        const q = query(
          enrollmentsRef,
          where('subject', '==', group.subject),
          where('className', '==', group.className)
        );
        const snapshot = await getDocs(q);

        for (const docSnap of snapshot.docs) {
          await deleteDoc(docSnap.ref);
        }
      }

      // 수강 이력에 종료일 추가
      const now = new Date();
      const endDate = now.toISOString().split('T')[0]; // YYYY-MM-DD 형식

      const studentDocRef = doc(db, 'students', student.id);
      const studentDoc = await getDoc(studentDocRef);

      if (studentDoc.exists()) {
        const currentHistory = (studentDoc.data().classHistory || []) as ClassHistoryEntry[];

        // 해당 수업의 가장 최근 이력(endDate가 없는 항목) 찾아서 종료일 추가
        const updatedHistory = currentHistory.map((entry) => {
          if (
            entry.className === group.className &&
            entry.subject === group.subject &&
            !entry.endDate
          ) {
            return { ...entry, endDate: endDate };
          }
          return entry;
        });

        await updateDoc(studentDocRef, {
          classHistory: updatedHistory,
          updatedAt: now.toISOString(),
        });
      }

      // 캐시 무효화 및 새로고침
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refreshStudents();

    } catch (err) {
      console.error('수업 배정 취소 오류:', err);
      alert('수업 배정 취소에 실패했습니다.');
    } finally {
      setDeletingClass(null);
    }
  };

  const handleAssignSuccess = () => {
    refreshStudents();
  };

  if (loadingTeachers) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin w-5 h-5 border-2 border-[#fdb813] border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-gray-500 text-xs">수업 정보 불러오는 중...</p>
      </div>
    );
  }

  // 종료된 수업 목록 (classHistory에서 endDate가 있는 항목)
  const completedClasses = useMemo(() => {
    const classHistory = student.classHistory || [];
    return classHistory
      .filter(h => h.endDate) // endDate가 있는 것만
      .map(h => ({
        className: h.className,
        subject: h.subject as 'math' | 'english',
        teachers: h.teacher ? [h.teacher] : [],
        days: [],
        enrollmentIds: [],
        startDate: h.startDate,
        endDate: h.endDate,
      }));
  }, [student.classHistory]);

  // 과목별 분류
  const mathClasses = groupedEnrollments.filter(g => g.subject === 'math');
  const englishClasses = groupedEnrollments.filter(g => g.subject === 'english');

  const completedMathClasses = completedClasses.filter(g => g.subject === 'math');
  const completedEnglishClasses = completedClasses.filter(g => g.subject === 'english');

  // 수업 행 렌더링 함수 (현재 수강 중)
  const renderClassRow = (group: GroupedEnrollment, index: number) => {
    const mainTeacher = getMainTeacher(group);
    const visibleTeachers = group.teachers.filter(name => {
      const teacher = teachers.find(t => t.name === name);
      return !teacher?.isHidden;
    });
    const subjectColor = SUBJECT_COLORS[group.subject];
    const key = `${group.subject}_${group.className}`;
    const isDeleting = deletingClass === key;

    // 실제 수업 정보 가져오기
    const actualClass = allClasses.find(
      c => c.className === group.className && c.subject === group.subject
    );
    const subjectForSchedule: SubjectForSchedule = group.subject === 'english' ? 'english' : 'math';

    return (
      <div
        key={`${group.subject}-${index}`}
        onClick={() => !isDeleting && handleClassClick(group)}
        className={`flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 hover:bg-[#fdb813]/5 transition-colors ${isDeleting ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        {/* 과목 뱃지 */}
        <span
          className="w-8 shrink-0 text-micro px-1 py-0.5 rounded font-semibold text-center"
          style={{
            backgroundColor: subjectColor.bg,
            color: subjectColor.text,
          }}
        >
          {SUBJECT_LABELS[group.subject]}
        </span>

        {/* 수업명 */}
        <span className="w-24 shrink-0 text-xs text-[#081429] truncate font-medium">
          {group.className}
        </span>

        {/* 강사 */}
        <div className="w-14 shrink-0 flex items-center gap-0.5">
          <User className="w-3 h-3 text-gray-400" />
          <span className="text-xxs text-[#373d41] truncate">
            {mainTeacher || visibleTeachers[0] || '-'}
          </span>
        </div>

        {/* 스케줄 (요일+교시 배지) */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ScheduleBadge schedule={actualClass?.schedule} subject={subjectForSchedule} />
        </div>

        {/* 학생수 */}
        <div className="w-10 shrink-0 flex items-center justify-center gap-0.5">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-xxs font-medium text-[#081429]">
            {actualClass?.studentCount || 0}
          </span>
        </div>

        {/* 시작일/종료일 (compact 모드가 아닐 때만) */}
        {!compact && (
          <>
            <span className="w-16 shrink-0 text-xxs text-[#373d41] text-center">
              {formatDate(group.startDate)}
            </span>
            <span className="w-14 shrink-0 text-xxs font-bold text-emerald-600 text-center">
              재원중
            </span>
          </>
        )}

        {/* 삭제 버튼 */}
        <button
          onClick={(e) => handleRemoveEnrollment(group, e)}
          disabled={isDeleting}
          className="w-5 h-5 shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
          title="수업 배정 취소"
        >
          {isDeleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
        </button>
      </div>
    );
  };

  // 종료된 수업 행 렌더링 함수
  const renderCompletedClassRow = (group: GroupedEnrollment, index: number) => {
    const subjectColor = SUBJECT_COLORS[group.subject];

    return (
      <div
        key={`completed-${group.subject}-${index}`}
        className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 opacity-60"
      >
        {/* 과목 뱃지 */}
        <span
          className="w-8 shrink-0 text-micro px-1 py-0.5 rounded font-semibold text-center"
          style={{
            backgroundColor: subjectColor.bg,
            color: subjectColor.text,
          }}
        >
          {SUBJECT_LABELS[group.subject]}
        </span>

        {/* 수업명 */}
        <span className="w-24 shrink-0 text-xs text-[#373d41] truncate">
          {group.className}
        </span>

        {/* 강사 */}
        <div className="w-14 shrink-0 flex items-center gap-0.5">
          <User className="w-3 h-3 text-gray-400" />
          <span className="text-xxs text-[#373d41] truncate">
            {group.teachers[0] || '-'}
          </span>
        </div>

        {/* 스케줄 (빈 공간) */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <span className="text-xxs text-gray-400 italic">종료됨</span>
        </div>

        {/* 학생수 (빈 공간) */}
        <div className="w-10 shrink-0"></div>

        {/* 시작일/종료일 (compact 모드가 아닐 때만) */}
        {!compact && (
          <>
            <span className="w-16 shrink-0 text-xxs text-[#373d41] text-center">
              {formatDate(group.startDate)}
            </span>
            <span className="w-14 shrink-0 text-xxs text-[#373d41] text-center">
              {formatDate(group.endDate)}
            </span>
          </>
        )}

        {/* 삭제 버튼 자리 (빈 공간) */}
        <div className="w-5 shrink-0"></div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-[#081429]">수강 중인 수업</h3>
          <span className="text-xs text-[#373d41]">
            ({groupedEnrollments.length}개)
          </span>
        </div>
        <button
          onClick={() => setIsAssignModalOpen(true)}
          className="bg-[#fdb813] text-[#081429] px-2 py-1 rounded text-xs font-semibold hover:bg-[#e5a711] transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          배정
        </button>
      </div>

      {/* 수업 목록 - 행 스타일 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-[#373d41]">
          <span className="w-8 shrink-0">과목</span>
          <span className="w-24 shrink-0">수업명</span>
          <span className="w-14 shrink-0">강사</span>
          <span className="flex-1">스케줄</span>
          <span className="w-10 shrink-0 text-center">인원</span>
          {!compact && (
            <>
              <span className="w-16 shrink-0 text-center">시작</span>
              <span className="w-14 shrink-0 text-center">종료</span>
            </>
          )}
          <span className="w-5 shrink-0"></span>
        </div>

        {groupedEnrollments.length === 0 ? (
          <div className="text-center py-6">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500 text-xs">수강 중인 수업이 없습니다</p>
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              + 수업 배정하기
            </button>
          </div>
        ) : (
          <div>
            {/* 수학 수업 */}
            {mathClasses.map((group, index) => renderClassRow(group, index))}

            {/* 영어 수업 */}
            {englishClasses.map((group, index) => renderClassRow(group, index))}
          </div>
        )}
      </div>

      {/* 지난 수업 섹션 */}
      {completedClasses.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold text-[#373d41] mb-2">지난 수업 ({completedClasses.length}개)</h3>
          <div className="bg-white border border-gray-200 overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-[#373d41]">
              <span className="w-8 shrink-0">과목</span>
              <span className="w-24 shrink-0">수업명</span>
              <span className="w-14 shrink-0">강사</span>
              <span className="flex-1">상태</span>
              <span className="w-10 shrink-0"></span>
              {!compact && (
                <>
                  <span className="w-16 shrink-0 text-center">시작</span>
                  <span className="w-14 shrink-0 text-center">종료</span>
                </>
              )}
              <span className="w-5 shrink-0"></span>
            </div>

            <div>
              {/* 수학 수업 */}
              {completedMathClasses.map((group, index) => renderCompletedClassRow(group, index))}

              {/* 영어 수업 */}
              {completedEnglishClasses.map((group, index) => renderCompletedClassRow(group, index))}
            </div>
          </div>
        </div>
      )}

      {/* 수업 배정 모달 */}
      {isAssignModalOpen && (
        <AssignClassModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          student={student}
          onSuccess={handleAssignSuccess}
        />
      )}

      {/* 수업 상세 모달 */}
      {selectedClass && (
        <ClassDetailModal
          classInfo={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
};

export default CoursesTab;
