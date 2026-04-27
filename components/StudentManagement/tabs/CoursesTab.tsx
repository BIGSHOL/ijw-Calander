import React, { useState, useMemo, lazy, Suspense } from 'react';
import { UnifiedStudent, UserProfile } from '../../../types';
import { BookOpen, Plus, User, X, Loader2, Users, Trash2, ChevronDown, Calendar, RotateCcw } from 'lucide-react';
import { restoreCancelledEnrollment } from '../../../utils/classMove';

const StudentTimetableModal = lazy(() => import('../StudentTimetableModal'));
import AssignClassModal from '../AssignClassModal';
import { useStudents } from '../../../hooks/useStudents';
import { useTeachers } from '../../../hooks/useFirebaseQueries';
import { ClassInfo, useClasses } from '../../../hooks/useClasses';
import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../../utils/styleUtils';
import ClassDetailModal from '../../ClassManagement/ClassDetailModal';
import { doc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '../../../hooks/usePermissions';
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
                  className={`px-1 py-0.5 text-micro font-bold ${dayIdx === 0 ? 'rounded-l-sm' : ''} ${dayIdx === entry.days.length - 1 ? 'rounded-r-sm' : ''}`}
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
  readOnly?: boolean; // 조회 전용 모드
  currentUser?: UserProfile | null; // 현재 사용자
}

interface GroupedEnrollment {
  className: string;
  subject: 'math' | 'highmath' | 'english' | 'science' | 'korean' | 'other';
  teachers: string[];
  days: string[];
  attendanceDays: string[]; // 학생 실제 등원 요일 (비어있으면 모든 수업 요일에 등원)
  enrollmentIds: string[]; // 삭제를 위해 enrollment ID 저장
  startDate?: string; // 수강 시작일
  endDate?: string; // 수강 종료일 (undefined = 재원중)
  schedule?: string[]; // 스케줄 정보
}

const CoursesTab: React.FC<CoursesTabProps> = ({ student, compact = false, readOnly = false, currentUser }) => {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [deletingClass, setDeletingClass] = useState<string | null>(null);

  // 학생 시간표 모달
  const [showTimetable, setShowTimetable] = useState(false);

  // 섹션 접기/펼치기 상태
  const [showCurrentClasses, setShowCurrentClasses] = useState(true);
  const [showScheduledClasses, setShowScheduledClasses] = useState(true);
  const [showCompletedClasses, setShowCompletedClasses] = useState(true);
  const [showCancelledClasses, setShowCancelledClasses] = useState(false);
  const [restoringEnrollmentId, setRestoringEnrollmentId] = useState<string | null>(null);
  const { refreshStudents } = useStudents();
  const { data: teachers = [], isLoading: loadingTeachers } = useTeachers();
  const { data: allClasses = [] } = useClasses();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions(currentUser);

  // 권한 체크
  const canManageClassHistory = (currentUser?.role === 'master' || currentUser?.role === 'admin') || hasPermission('students.manage_class_history');
  const canEditEnrollmentDates = (currentUser?.role === 'master' || currentUser?.role === 'admin') || hasPermission('students.edit_enrollment_dates');

  // 날짜 수정 상태 (key = subject_className, field = startDate/endDate)
  const [editingDate, setEditingDate] = useState<{ key: string; field: 'startDate' | 'endDate' } | null>(null);

  // 날짜 포맷팅 함수 (YYYY-MM-DD -> YY.MM.DD)
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const year = String(date.getFullYear()).slice(2); // 마지막 2자리
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 오늘 날짜 (미래 수업 구분용)
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // enrollment 시작일 추출 (enrollmentDate 또는 startDate 필드 사용)
  const getStartDate = (enrollment: any): string | undefined =>
    enrollment.enrollmentDate || enrollment.startDate;
  // enrollment 종료일 추출 (endDate 또는 withdrawalDate 필드 사용)
  const getEndDate = (enrollment: any): string | undefined =>
    enrollment.endDate || enrollment.withdrawalDate;

  // 같은 수업(className)끼리 그룹화 (현재 수강중인 수업만)
  const groupedEnrollments = useMemo(() => {
    const groups = new Map<string, GroupedEnrollment>();

    (student.enrollments || [])
      .filter(enrollment => {
        // 취소된 예약 제외 (cancel ≠ delete; 데이터 보존 + restore 가능)
        if ((enrollment as any).cancelledAt) return false;
        // 모순 record 가드 — startDate > endDate 인 깨진 record 는 어디에도 표시 안 함
        const _sd = getStartDate(enrollment);
        const _ed = getEndDate(enrollment);
        if (_sd && _ed && _sd > _ed) return false;
        // endDate가 없거나 오늘 이후이면 아직 수강중, startDate가 오늘 이전이거나 없는 것
        const endDate = getEndDate(enrollment);
        const hasEnded = endDate ? endDate < today : false; // 종료일이 오늘 이전이면 종료
        const startDate = getStartDate(enrollment);
        const hasStarted = !startDate || startDate <= today;
        return !hasEnded && hasStarted;
      })
      .forEach(enrollment => {
        // 그룹핑 키에 staffId + attendanceDays 시그니처 포함
        // — 같은 className이어도 담임/등원요일이 다르면 별도 카드로 분리
        // (강사 인수인계: 권나현 endDate=D-1 / 김선생 startDate=D 는 별도 행)
        // (요일 변경: 월목 엔롤먼트와 신규 월만 엔롤먼트가 섞이지 않고 별도 행 → X 시 해당 행만 종료)
        const ad = (enrollment as any).attendanceDays;
        const attendanceSig = (ad && ad.length > 0) ? [...ad].sort().join(',') : '*';
        const key = `${enrollment.subject}_${enrollment.className}_${enrollment.staffId || ''}_${attendanceSig}`;

        if (groups.has(key)) {
          const existing = groups.get(key)!;
          const staffId = enrollment.staffId;
          if (staffId && !existing.teachers.includes(staffId)) {
            existing.teachers.push(staffId);
          }
          enrollment.days?.forEach(day => {
            if (!existing.days.includes(day)) {
              existing.days.push(day);
            }
          });
          // 학생 등원 요일 수집 (같은 시그니처 그룹 내에선 동일 값이지만 방어적으로 유지)
          (enrollment as any).attendanceDays?.forEach((day: string) => {
            if (!existing.attendanceDays.includes(day)) {
              existing.attendanceDays.push(day);
            }
          });
          // enrollment ID 추가
          if ((enrollment as any).id && !existing.enrollmentIds.includes((enrollment as any).id)) {
            existing.enrollmentIds.push((enrollment as any).id);
          }
          // startDate는 가장 빠른 날짜 사용
          const existingSD = existing.startDate ? new Date(existing.startDate) : null;
          const sd = getStartDate(enrollment);
          const currentSD = sd ? new Date(sd) : null;
          if (currentSD && (!existingSD || currentSD < existingSD)) {
            existing.startDate = sd;
          }
          // endDate는 가장 늦은 날짜 사용
          const ed = getEndDate(enrollment);
          if (ed) {
            const existED = existing.endDate ? new Date(existing.endDate) : null;
            const curED = new Date(ed);
            if (!existED || curED > existED) {
              existing.endDate = ed;
            }
          }
        } else {
          const staffId = enrollment.staffId;
          groups.set(key, {
            className: enrollment.className,
            subject: enrollment.subject,
            teachers: staffId ? [staffId] : [],
            days: [...(enrollment.days || [])],
            attendanceDays: [...((enrollment as any).attendanceDays || [])],
            enrollmentIds: (enrollment as any).id ? [(enrollment as any).id] : [],
            startDate: getStartDate(enrollment),
            endDate: getEndDate(enrollment), // 종료 예정일 보존
          });
        }
      });

    return Array.from(groups.values());
  }, [student.enrollments, today]);

  // 배정 예정 수업 그룹화 (미래 시작일)
  const scheduledEnrollments = useMemo(() => {
    const groups = new Map<string, GroupedEnrollment>();

    (student.enrollments || [])
      .filter(enrollment => {
        // 취소된 예약 제외 (cancel ≠ delete; 데이터 보존 + restore 가능)
        if ((enrollment as any).cancelledAt) return false;
        // 모순 record 가드 — startDate > endDate 인 깨진 record 는 어디에도 표시 안 함
        const _sd = getStartDate(enrollment);
        const _ed = getEndDate(enrollment);
        if (_sd && _ed && _sd > _ed) return false;
        // endDate가 없거나 오늘 이후이고, startDate가 미래인 것만
        const endDate = getEndDate(enrollment);
        const hasEnded = endDate ? endDate < today : false;
        const startDate = getStartDate(enrollment);
        const isFuture = startDate && startDate > today;
        return !hasEnded && isFuture;
      })
      .forEach(enrollment => {
        // 그룹핑 키에 staffId + attendanceDays 시그니처 포함 (groupedEnrollments와 동일 원칙)
        const ad = (enrollment as any).attendanceDays;
        const attendanceSig = (ad && ad.length > 0) ? [...ad].sort().join(',') : '*';
        const key = `${enrollment.subject}_${enrollment.className}_${enrollment.staffId || ''}_${attendanceSig}`;

        if (groups.has(key)) {
          const existing = groups.get(key)!;
          const staffId = enrollment.staffId;
          if (staffId && !existing.teachers.includes(staffId)) {
            existing.teachers.push(staffId);
          }
          enrollment.days?.forEach(day => {
            if (!existing.days.includes(day)) {
              existing.days.push(day);
            }
          });
          (enrollment as any).attendanceDays?.forEach((day: string) => {
            if (!existing.attendanceDays.includes(day)) {
              existing.attendanceDays.push(day);
            }
          });
          // enrollment ID 추가
          if ((enrollment as any).id && !existing.enrollmentIds.includes((enrollment as any).id)) {
            existing.enrollmentIds.push((enrollment as any).id);
          }
          // startDate는 가장 빠른 날짜 사용
          const existingStartDate = existing.startDate ? new Date(existing.startDate) : null;
          const sd = getStartDate(enrollment);
          const currentStartDate = sd ? new Date(sd) : null;
          if (currentStartDate && (!existingStartDate || currentStartDate < existingStartDate)) {
            existing.startDate = sd;
          }
        } else {
          const staffId = enrollment.staffId;
          groups.set(key, {
            className: enrollment.className,
            subject: enrollment.subject,
            teachers: staffId ? [staffId] : [],
            days: [...(enrollment.days || [])],
            attendanceDays: [...((enrollment as any).attendanceDays || [])],
            enrollmentIds: (enrollment as any).id ? [(enrollment as any).id] : [],
            startDate: getStartDate(enrollment),
            endDate: undefined,
          });
        }
      });

    return Array.from(groups.values());
  }, [student.enrollments, today]);

  // Build teacher Map for O(1) lookups (js-index-maps)
  const teacherMap = useMemo(() => {
    return new Map(teachers.map(t => [t.id, t]));
  }, [teachers]);

  // 이름으로도 강사 조회 가능하도록 (영어 수업 호환성)
  const teacherByNameMap = useMemo(() => {
    return new Map(teachers.map(t => [t.name, t]));
  }, [teachers]);

  // staffId 또는 이름으로 강사 조회
  const getTeacherByIdOrName = (idOrName: string | undefined | null) => {
    if (!idOrName) return null;
    return teacherMap.get(idOrName) || teacherByNameMap.get(idOrName) || null;
  };

  // 수업의 대표 강사 결정
  // — group 단위로 좁혀 집계해야 "같은 className이지만 다른 담임" 그룹(인수인계 후 eager split 된 새 enrollment)에서
  //   엉뚱하게 과거 담임이 대표 강사로 뽑히는 버그 방지
  const getMainTeacher = (group: GroupedEnrollment): string | null => {
    const teacherCounts: Record<string, number> = {};
    const groupEnrollmentIds = new Set(group.enrollmentIds);
    const groupStaffSet = new Set(group.teachers);

    student.enrollments
      .filter(e => {
        // 과목/수업명 1차 필터 (필수)
        if (e.subject !== group.subject || e.className !== group.className) return false;
        // 그룹에 포함된 enrollmentId만 인정 (정확)
        const eid = (e as any).id;
        if (groupEnrollmentIds.size > 0 && eid) {
          return groupEnrollmentIds.has(eid);
        }
        // fallback: 그룹의 staffId 집합 안에 속한 enrollment만
        if (groupStaffSet.size > 0 && e.staffId) {
          return groupStaffSet.has(e.staffId);
        }
        return true;
      })
      .forEach(enrollment => {
        const staffId = enrollment.staffId;
        if (!staffId) return;
        const teacherData = getTeacherByIdOrName(staffId);
        if (teacherData?.isHidden) return;

        // days 필드가 없는 enrollment(인수인계 eager split 등)는 최소 1로 간주하여 카운트 누락 방지
        const dayCount = (enrollment.days?.length || 0) || 1;
        teacherCounts[staffId] = (teacherCounts[staffId] || 0) + dayCount;
      });

    const teacherEntries = Object.entries(teacherCounts);
    if (teacherEntries.length === 0) return null;

    const maxCount = Math.max(...teacherEntries.map(([, count]) => count));
    const topTeachers = teacherEntries.filter(([, count]) => count === maxCount);

    if (topTeachers.length === 1) return topTeachers[0][0];

    const nonNativeTeachers = topTeachers.filter(([staffId]) => {
      const teacherData = getTeacherByIdOrName(staffId);
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
        id: `${group.subject}_${group.className}_${group.teachers[0] || ''}`,
        className: group.className,
        subject: group.subject,
        teacher: mainTeacher || group.teachers[0] || '',
        schedule: group.days.map(day => `${day}`),
        studentCount: 0,
      };
      setSelectedClass(classInfo);
    }
  };

  // 수강 일자 수정 (시작일/종료일)
  const handleDateChange = async (group: GroupedEnrollment, field: 'startDate' | 'endDate', newDate: string) => {
    if (!canEditEnrollmentDates) {
      setEditingDate(null);
      return;
    }
    // startDate는 필수, endDate는 빈 값 허용 (종료일 삭제 = 재원중으로 복구)
    if (field === 'startDate' && !newDate) {
      setEditingDate(null);
      return;
    }

    const key = `${group.subject}_${group.className}_${group.teachers[0] || ''}`;
    setDeletingClass(key); // 로딩 상태 재활용

    try {
      const buildUpdateData = () => {
        const updateData: Record<string, any> = {};
        if (field === 'startDate') {
          updateData.startDate = newDate;
          updateData.enrollmentDate = newDate; // 호환성 유지
        } else {
          if (newDate) {
            updateData.endDate = newDate;
            updateData.withdrawalDate = newDate;
          } else {
            // 종료일 삭제 (재원중으로 복구)
            updateData.endDate = deleteField();
            updateData.withdrawalDate = deleteField();
          }
        }
        updateData.updatedAt = new Date().toISOString();
        return updateData;
      };

      if (group.enrollmentIds.length > 0) {
        for (const enrollmentId of group.enrollmentIds) {
          const docRef = doc(db, `students/${student.id}/enrollments`, enrollmentId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            await updateDoc(docRef, buildUpdateData());
          }
        }
      } else {
        const enrollmentsRef = collection(db, `students/${student.id}/enrollments`);
        const q = query(
          enrollmentsRef,
          where('subject', '==', group.subject),
          where('className', '==', group.className)
        );
        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
          await updateDoc(docSnap.ref, buildUpdateData());
        }
      }

      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classStudents'] });
      queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
      queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });
      refreshStudents();
    } catch (err) {
      console.error('수강 일자 수정 오류:', err);
      alert('수강 일자 수정에 실패했습니다.');
    } finally {
      setDeletingClass(null);
      setEditingDate(null);
    }
  };

  // 수업 배정 취소 (해당 학생의 enrollment만 삭제)
  //
  // 분기 정책 (Cancel ≠ Delete):
  //  - 미래 startDate (배정 예정) → cancelledAt 플래그 set. endDate 손대지 않음.
  //    "예약 무르기" 의미. 학생 데이터/이력 보존. 복원 가능.
  //  - 과거/오늘 startDate (시작된 수업) → endDate=today (기존 soft-delete).
  //    "여기까지 다녔음" 의미. 출결/수강료 등 이력 보존.
  //
  // 이로써 startDate(미래) > endDate(오늘) 모순 record 가 구조적으로 발생 불가.
  const handleRemoveEnrollment = async (group: GroupedEnrollment, e: React.MouseEvent) => {
    e.stopPropagation(); // 행 클릭 이벤트 전파 방지

    const confirmMsg = `"${group.className}" 수업에서 ${student.name} 학생을 제외하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    const key = `${group.subject}_${group.className}_${group.teachers[0] || ''}`;
    setDeletingClass(key);

    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // 이미 종료된 enrollment(endDate 이전 날짜)는 건드리지 않음 — 과거 퇴원 기록 보호
      const shouldSkipAlreadyEnded = (data: Record<string, any>) => {
        const existingEnd = data.endDate || data.withdrawalDate;
        return typeof existingEnd === 'string' && existingEnd < todayStr;
      };

      // 이미 취소된 예약은 재취소 안 함
      const shouldSkipAlreadyCancelled = (data: Record<string, any>) => {
        return typeof data.cancelledAt === 'string';
      };

      // enrollment 가 미래 시작 예약인지 판정
      const isFutureReservation = (data: Record<string, any>) => {
        const sd = data.startDate || data.enrollmentDate;
        return typeof sd === 'string' && sd > todayStr;
      };

      // 단일 enrollment 처리 — 미래/시작됨에 따라 다른 update 적용
      const processOne = async (docRef: ReturnType<typeof doc>, data: Record<string, any>) => {
        if (shouldSkipAlreadyEnded(data) || shouldSkipAlreadyCancelled(data)) return;

        if (isFutureReservation(data)) {
          // 배정 예정 취소 = 예약 무르기. endDate 손대지 않음. startDate 도 그대로 (원래 의도 보존).
          await updateDoc(docRef, {
            cancelledAt: todayStr,
            cancelledBy: currentUser?.uid || currentUser?.email || null,
            updatedAt: new Date().toISOString(),
          });
        } else {
          // 시작된 수업 종료 (기존 동작)
          await updateDoc(docRef, {
            endDate: todayStr,
            updatedAt: new Date().toISOString(),
          });
        }
      };

      // 1. 저장된 enrollmentIds가 있으면 사용
      if (group.enrollmentIds.length > 0) {
        for (const enrollmentId of group.enrollmentIds) {
          const docRef = doc(db, `students/${student.id}/enrollments`, enrollmentId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            await processOne(docRef, docSnap.data());
          }
        }
      } else {
        // 2. enrollmentIds가 없으면 쿼리로 찾아서 업데이트
        // attendanceDays 시그니처까지 일치하는 것만 종료 (월목 전체 → 월만 이동 시 신규 enrollment만 골라 종료)
        const enrollmentsRef = collection(db, `students/${student.id}/enrollments`);
        const q = query(
          enrollmentsRef,
          where('subject', '==', group.subject),
          where('className', '==', group.className)
        );
        const snapshot = await getDocs(q);

        const groupSig = group.attendanceDays.length > 0
          ? [...group.attendanceDays].sort().join(',')
          : '*';

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const ad = data.attendanceDays || [];
          const docSig = ad.length > 0 ? [...ad].sort().join(',') : '*';
          if (docSig !== groupSig) continue; // 다른 요일 그룹은 건너뜀
          await processOne(docSnap.ref, data);
        }
      }

      // 캐시 무효화 및 새로고침 (모든 시간표 뷰에 실시간 반영)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['classes'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['classStudents'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['englishClassStudents'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['mathClassStudents'], refetchType: 'all' }),
      ]);
      refreshStudents();

    } catch (err) {
      console.error('수업 배정 취소 오류:', err);
      alert('수업 배정 취소에 실패했습니다.');
    } finally {
      setDeletingClass(null);
    }
  };


  // 종료된 수업 이력 완전 삭제 (권한 필요)
  const handleDeleteCompletedEnrollment = async (group: GroupedEnrollment, e: React.MouseEvent) => {
    e.stopPropagation(); // 행 클릭 이벤트 전파 방지

    // 권한 체크
    if (!canManageClassHistory) {
      alert('종료된 수업 이력을 삭제할 권한이 없습니다.');
      return;
    }

    const confirmMsg = `"${group.className}" 수업 이력을 완전히 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`;

    if (!window.confirm(confirmMsg)) return;

    const key = `${group.subject}_${group.className}_${group.teachers[0] || ''}`;
    setDeletingClass(key);

    try {
      // 1. 저장된 enrollmentIds가 있으면 사용
      if (group.enrollmentIds.length > 0) {
        for (const enrollmentId of group.enrollmentIds) {
          const docRef = doc(db, `students/${student.id}/enrollments`, enrollmentId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            // 활성 enrollment(endDate/withdrawalDate 없음)은 삭제하지 않음 — 현재 수강 보호
            if (!data.endDate && !data.withdrawalDate) continue;
            await deleteDoc(docRef);
          }
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
          const data = docSnap.data();
          // 활성 enrollment(endDate/withdrawalDate 없음)은 삭제하지 않음 — 현재 수강 보호
          if (!data.endDate && !data.withdrawalDate) continue;
          await deleteDoc(docSnap.ref);
        }
      }

      // 캐시 무효화 및 새로고침
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classStudents'] });
      queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
      queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });  // 수학 시간표
      refreshStudents();

    } catch (err) {
      console.error('수업 이력 삭제 오류:', err);
      alert('수업 이력 삭제에 실패했습니다.');
    } finally {
      setDeletingClass(null);
    }
  };

  const handleAssignSuccess = () => {
    refreshStudents();
  };

  // 취소된 예약 복원 — admin 전용 (선생님 실수 대비 안전망)
  // classMove pair 가 있는 경우 restoreMove() 가 더 정확하지만,
  // 단일 enrollment 복원도 cancelledAt 만 제거하면 즉시 활성으로 돌아옴.
  const handleRestoreCancelled = async (enrollmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManageClassHistory) {
      alert('취소된 예약을 복원할 권한이 없습니다.');
      return;
    }
    if (!window.confirm('이 취소된 예약을 복원하시겠습니까? 학생이 다시 해당 반의 대기 상태로 돌아갑니다.')) return;

    setRestoringEnrollmentId(enrollmentId);
    try {
      await restoreCancelledEnrollment(student.id, enrollmentId, currentUser?.uid || currentUser?.email || undefined);
      // 캐시 갱신
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['classes'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['classStudents'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['englishClassStudents'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['mathClassStudents'], refetchType: 'all' }),
      ]);
      refreshStudents();
    } catch (err) {
      console.error('예약 복원 오류:', err);
      alert('예약 복원에 실패했습니다.');
    } finally {
      setRestoringEnrollmentId(null);
    }
  };

  // 종료된 수업 목록 (enrollments에서 endDate가 있는 항목)
  // NOTE: 모든 useMemo/useEffect 훅은 early return 전에 호출되어야 함 (React 훅 규칙)
  const completedClasses = useMemo(() => {
    const groups = new Map<string, GroupedEnrollment>();

    (student.enrollments || [])
      .filter(enrollment => {
        // 취소된 예약 제외 — 지난 수업은 "실제 시작했다 끝난 것" 만
        if ((enrollment as any).cancelledAt) return false;
        // 모순 record 가드 — 미래 시작 + 과거 종료 같은 깨진 record 는 지난 수업에 들어오면 안 됨
        const _sd = getStartDate(enrollment);
        const _ed = getEndDate(enrollment);
        if (_sd && _ed && _sd > _ed) return false;
        // 종료일이 "오늘 이전"인 것만 지난 수업으로 분류.
        // endDate === today는 "오늘까지 등원"을 의미하므로 오늘은 여전히 수강 중.
        // (수강 중 필터와 상호배타적으로 맞추기 위함 — 중복 노출 버그 방지)
        const endDate = getEndDate(enrollment);
        return !!endDate && endDate < today;
      })
      .forEach(enrollment => {
        // 그룹핑 키에 staffId + attendanceDays 시그니처 포함 (groupedEnrollments와 동일 원칙)
        const ad = (enrollment as any).attendanceDays;
        const attendanceSig = (ad && ad.length > 0) ? [...ad].sort().join(',') : '*';
        const key = `${enrollment.subject}_${enrollment.className}_${enrollment.staffId || ''}_${attendanceSig}`;

        if (groups.has(key)) {
          const existing = groups.get(key)!;
          const staffId = enrollment.staffId;
          if (staffId && !existing.teachers.includes(staffId)) {
            existing.teachers.push(staffId);
          }
          // startDate는 가장 빠른 날짜, endDate는 가장 늦은 날짜 사용
          const existingStartDate = existing.startDate ? new Date(existing.startDate) : null;
          const sd = getStartDate(enrollment);
          const currentStartDate = sd ? new Date(sd) : null;
          if (currentStartDate && (!existingStartDate || currentStartDate < existingStartDate)) {
            existing.startDate = sd;
          }

          const existingEndDate = existing.endDate ? new Date(existing.endDate) : null;
          const ed = getEndDate(enrollment);
          const currentEndDate = ed ? new Date(ed) : null;
          if (currentEndDate && (!existingEndDate || currentEndDate > existingEndDate)) {
            existing.endDate = ed;
          }

          // schedule 정보도 수집 (enrollment에 저장된 스케줄)
          if ((enrollment as any).schedule && !existing.schedule) {
            existing.schedule = (enrollment as any).schedule;
          }
        } else {
          const staffId = enrollment.staffId;
          groups.set(key, {
            className: enrollment.className,
            subject: enrollment.subject as 'math' | 'english',
            teachers: staffId ? [staffId] : [],
            days: [],
            attendanceDays: [],
            enrollmentIds: [],
            startDate: getStartDate(enrollment),
            endDate: getEndDate(enrollment),
            schedule: (enrollment as any).schedule, // 삭제 당시 저장된 스케줄 정보
          });
        }
      });

    return Array.from(groups.values());
  }, [student.enrollments, today]);

  // 취소된 예약 (cancelledAt 있는 enrollment) — admin 전용 섹션
  // 그룹화 안 함: 각 enrollment 가 개별 record (취소 사유/시점이 다를 수 있음)
  // 복원 시 정확히 그 record 를 되살려야 하므로 enrollment id 단위 표시
  interface CancelledEntry {
    id: string;
    className: string;
    subject: string;
    staffId?: string;
    startDate?: string;
    cancelledAt: string;
    cancelledBy?: string;
    attendanceDays?: string[];
    schedule?: string[];
  }
  const cancelledEnrollments = useMemo<CancelledEntry[]>(() => {
    const list: CancelledEntry[] = [];
    (student.enrollments || []).forEach((e: any) => {
      if (!e.cancelledAt) return;
      list.push({
        id: e.id,
        className: e.className,
        subject: e.subject,
        staffId: e.staffId,
        startDate: getStartDate(e),
        cancelledAt: e.cancelledAt,
        cancelledBy: e.cancelledBy,
        attendanceDays: e.attendanceDays,
        schedule: e.schedule,
      });
    });
    // 최근 취소순 정렬
    list.sort((a, b) => (b.cancelledAt || '').localeCompare(a.cancelledAt || ''));
    return list;
  }, [student.enrollments]);

  // 로딩 중 early return (모든 훅 호출 이후)
  if (loadingTeachers) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-sm mx-auto mb-2"></div>
        <p className="text-gray-500 text-xs">수업 정보 불러오는 중...</p>
      </div>
    );
  }

  // 과목별 정렬 (math → highmath → english → science → korean → 기타)
  const SUBJECT_ORDER: Record<string, number> = { math: 0, highmath: 1, english: 2, science: 3, korean: 4 };
  const sortBySubject = <T extends { subject: string }>(list: T[]) =>
    [...list].sort((a, b) => (SUBJECT_ORDER[a.subject] ?? 99) - (SUBJECT_ORDER[b.subject] ?? 99));

  // 수업 행 렌더링 함수 (현재 수강 중)
  const renderClassRow = (group: GroupedEnrollment, index: number) => {
    const mainTeacherStaffId = getMainTeacher(group);
    const mainTeacher = getTeacherByIdOrName(mainTeacherStaffId)?.name;
    const visibleTeachers = group.teachers.filter(staffId => {
      const teacher = getTeacherByIdOrName(staffId);
      return !teacher?.isHidden;
    }).map(staffId => getTeacherByIdOrName(staffId)?.name).filter(Boolean);
    const subjectColor = SUBJECT_COLORS[group.subject] || SUBJECT_COLORS.other;
    const key = `${group.subject}_${group.className}_${group.teachers[0] || ''}`;
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
        className={`flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 hover:bg-accent/5 transition-colors ${isDeleting ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        {/* 과목 뱃지 */}
        <span
          className="w-8 shrink-0 text-micro px-1 py-0.5 rounded-sm font-semibold text-center"
          style={{
            backgroundColor: subjectColor.bg,
            color: subjectColor.text,
          }}
        >
          {SUBJECT_LABELS[group.subject]}
        </span>

        {/* 수업명 */}
        <span className="flex-1 min-w-0 text-xs text-primary truncate font-medium">
          {group.className}
        </span>

        {/* 강사 */}
        <div className="w-14 shrink-0 flex items-center gap-0.5">
          <User className="w-3 h-3 text-gray-400" />
          <span className="text-xxs text-primary-700 truncate">
            {mainTeacher || visibleTeachers[0] || actualClass?.teacher || '-'}
          </span>
        </div>

        {/* 스케줄 (요일+교시 배지) - 학생의 등원 요일만 표시 */}
        <div className="w-40 min-w-0 overflow-hidden">
          <ScheduleBadge
            schedule={actualClass?.schedule?.filter(s => {
              // attendanceDays가 있으면 학생 등원 요일만, 없으면 전체 표시
              const studentDays = group.attendanceDays?.length > 0 ? group.attendanceDays : null;
              if (!studentDays) return true;
              const day = s.split(' ')[0];
              return studentDays.includes(day);
            })}
            subject={subjectForSchedule}
          />
        </div>

        {/* 학생수 */}
        <div className="w-10 shrink-0 flex items-center justify-center gap-0.5">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-xxs font-medium text-primary">
            {actualClass?.studentCount || 0}
          </span>
        </div>

        {/* 시작일/종료일 */}
        <>
          {canEditEnrollmentDates && !readOnly && editingDate?.key === `${group.subject}_${group.className}_${group.teachers[0] || ''}` && editingDate?.field === 'startDate' ? (
            <input
              type="date"
              className="w-24 shrink-0 text-xxs text-primary-700 text-center border border-blue-300 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              defaultValue={group.startDate || ''}
              autoFocus
              onBlur={(e) => {
                if (e.target.value && e.target.value !== group.startDate) {
                  handleDateChange(group, 'startDate', e.target.value);
                } else {
                  setEditingDate(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditingDate(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={`w-16 shrink-0 text-xxs text-primary-700 text-center ${canEditEnrollmentDates && !readOnly ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
              onClick={(e) => {
                if (canEditEnrollmentDates && !readOnly) {
                  e.stopPropagation();
                  setEditingDate({ key: `${group.subject}_${group.className}_${group.teachers[0] || ''}`, field: 'startDate' });
                }
              }}
              title={canEditEnrollmentDates && !readOnly ? '클릭하여 시작일 수정' : undefined}
            >
              {formatDate(group.startDate)}
            </span>
          )}
          {canEditEnrollmentDates && !readOnly && editingDate?.key === `${group.subject}_${group.className}_${group.teachers[0] || ''}` && editingDate?.field === 'endDate' ? (
            <input
              type="date"
              className="w-24 shrink-0 text-xxs text-primary-700 text-center border border-blue-300 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              defaultValue={group.endDate || ''}
              autoFocus
              onBlur={(e) => {
                if (e.target.value !== (group.endDate || '')) {
                  if (e.target.value) {
                    handleDateChange(group, 'endDate', e.target.value);
                  } else {
                    // 빈 값 = 종료일 삭제 (재원중으로 복구)
                    handleDateChange(group, 'endDate', '');
                  }
                } else {
                  setEditingDate(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditingDate(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : group.endDate ? (
            <span
              className={`w-16 shrink-0 text-xxs font-bold text-orange-500 text-center ${canEditEnrollmentDates && !readOnly ? 'cursor-pointer hover:text-orange-700 hover:underline' : ''}`}
              onClick={(e) => {
                if (canEditEnrollmentDates && !readOnly) {
                  e.stopPropagation();
                  setEditingDate({ key: `${group.subject}_${group.className}_${group.teachers[0] || ''}`, field: 'endDate' });
                }
              }}
              title={canEditEnrollmentDates && !readOnly ? '클릭하여 종료일 수정' : undefined}
            >
              ~{formatDate(group.endDate)}
            </span>
          ) : (
            <span
              className={`w-16 shrink-0 text-xxs font-bold text-emerald-600 text-center ${canEditEnrollmentDates && !readOnly ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
              onClick={(e) => {
                if (canEditEnrollmentDates && !readOnly) {
                  e.stopPropagation();
                  setEditingDate({ key: `${group.subject}_${group.className}_${group.teachers[0] || ''}`, field: 'endDate' });
                }
              }}
              title={canEditEnrollmentDates && !readOnly ? '클릭하여 종료일 설정' : undefined}
            >
              재원중
            </span>
          )}
        </>

        {/* 삭제 버튼 - readOnly 모드에서는 숨김 */}
        {!readOnly && (
          <button
            onClick={(e) => handleRemoveEnrollment(group, e)}
            disabled={isDeleting}
            className="w-5 h-5 shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-sm transition-colors disabled:opacity-50"
            title="수업 배정 취소"
          >
            {isDeleting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <X className="w-3 h-3" />
            )}
          </button>
        )}
      </div>
    );
  };

  // 종료된 수업 행 렌더링 함수
  const renderCompletedClassRow = (group: GroupedEnrollment, index: number) => {
    const subjectColor = SUBJECT_COLORS[group.subject] || SUBJECT_COLORS.other;
    const firstTeacherStaffId = group.teachers[0];
    const firstTeacherName = getTeacherByIdOrName(firstTeacherStaffId)?.name;
    // staffId가 없을 때 수업 정보에서 teacher 가져오기 (영어 수업 호환성)
    const actualClass = allClasses.find(
      c => c.className === group.className && c.subject === group.subject
    );
    const subjectForSchedule: SubjectForSchedule = group.subject === 'english' ? 'english' : 'math';

    return (
      <div
        key={`completed-${group.subject}-${index}`}
        className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 opacity-60"
      >
        {/* 과목 뱃지 */}
        <span
          className="w-8 shrink-0 text-micro px-1 py-0.5 rounded-sm font-semibold text-center"
          style={{
            backgroundColor: subjectColor.bg,
            color: subjectColor.text,
          }}
        >
          {SUBJECT_LABELS[group.subject]}
        </span>

        {/* 수업명 */}
        <span className="flex-1 min-w-0 text-xs text-primary-700 truncate">
          {group.className}
        </span>

        {/* 강사 */}
        <div className="w-14 shrink-0 flex items-center gap-0.5">
          <User className="w-3 h-3 text-gray-400" />
          <span className="text-xxs text-primary-700 truncate">
            {firstTeacherName || actualClass?.teacher || '-'}
          </span>
        </div>

        {/* 스케줄 (삭제 당시 저장된 스케줄 정보) */}
        <div className="w-40 min-w-0 overflow-hidden">
          <ScheduleBadge
            schedule={group.schedule || actualClass?.schedule}
            subject={subjectForSchedule}
          />
        </div>

        {/* 인원 자리 (수강중/배정예정과 정렬) */}
        <div className="w-10 shrink-0 flex items-center justify-center gap-0.5">
          <Users className="w-3 h-3 text-gray-300" />
          <span className="text-xxs font-medium text-primary-700">
            {actualClass?.studentCount || 0}
          </span>
        </div>

        {/* 시작일 */}
        {canEditEnrollmentDates && !readOnly && editingDate?.key === `completed_${group.subject}_${group.className}_${group.teachers[0] || ''}` && editingDate?.field === 'startDate' ? (
          <input
            type="date"
            className="w-24 shrink-0 text-xxs text-primary-700 text-center border border-blue-300 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            defaultValue={group.startDate || ''}
            autoFocus
            onBlur={(e) => {
              if (e.target.value && e.target.value !== group.startDate) {
                handleDateChange(group, 'startDate', e.target.value);
              } else {
                setEditingDate(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingDate(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`w-16 shrink-0 text-xxs text-primary-700 text-center ${canEditEnrollmentDates && !readOnly ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
            onClick={(e) => {
              if (canEditEnrollmentDates && !readOnly) {
                e.stopPropagation();
                setEditingDate({ key: `completed_${group.subject}_${group.className}_${group.teachers[0] || ''}`, field: 'startDate' });
              }
            }}
            title={canEditEnrollmentDates && !readOnly ? '클릭하여 시작일 수정' : undefined}
          >
            {formatDate(group.startDate)}
          </span>
        )}

        {/* 종료일 */}
        {canEditEnrollmentDates && !readOnly && editingDate?.key === `completed_${group.subject}_${group.className}_${group.teachers[0] || ''}` && editingDate?.field === 'endDate' ? (
          <input
            type="date"
            className="w-24 shrink-0 text-xxs text-primary-700 text-center border border-blue-300 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            defaultValue={group.endDate || ''}
            autoFocus
            onBlur={(e) => {
              if (e.target.value && e.target.value !== group.endDate) {
                handleDateChange(group, 'endDate', e.target.value);
              } else {
                setEditingDate(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingDate(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`w-16 shrink-0 text-xxs text-primary-700 text-center ${canEditEnrollmentDates && !readOnly ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
            onClick={(e) => {
              if (canEditEnrollmentDates && !readOnly) {
                e.stopPropagation();
                setEditingDate({ key: `completed_${group.subject}_${group.className}_${group.teachers[0] || ''}`, field: 'endDate' });
              }
            }}
            title={canEditEnrollmentDates && !readOnly ? '클릭하여 종료일 수정' : undefined}
          >
            {formatDate(group.endDate)}
          </span>
        )}

        {/* 이력 삭제 버튼 (권한이 있는 경우만) */}
        {canManageClassHistory && !readOnly && (
          <button
            onClick={(e) => handleDeleteCompletedEnrollment(group, e)}
            disabled={deletingClass === `${group.subject}_${group.className}_${group.teachers[0] || ''}`}
            className="w-5 h-5 shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-sm transition-colors disabled:opacity-50"
            title="수업 이력 삭제"
          >
            {deletingClass === `${group.subject}_${group.className}_${group.teachers[0] || ''}` ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setShowCurrentClasses(!showCurrentClasses)}
        >
          <h3 className="text-xs font-bold text-primary">수강 중인 수업</h3>
          <span className="text-xs text-primary-700">
            ({groupedEnrollments.length}개)
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCurrentClasses ? '' : 'rotate-180'}`} />
          <span className="text-[10px] text-gray-400 ml-1">실제 학생이 등원하는 요일만 표기됩니다</span>
        </div>
        <div className="flex items-center gap-1">
          {groupedEnrollments.length > 0 && (
            <button
              onClick={() => setShowTimetable(true)}
              className="bg-primary/10 text-primary border border-primary/30 px-2 py-1 rounded-sm text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <Calendar className="w-3 h-3" />
              시간표
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="bg-accent text-primary px-2 py-1 rounded-sm text-xs font-semibold hover:bg-[#e5a711] transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              배정
            </button>
          )}
        </div>
      </div>

      {/* 수업 목록 - 행 스타일 */}
      {showCurrentClasses && (
      <div className="bg-white border border-gray-200 overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-primary-700">
          <span className="w-8 shrink-0">과목</span>
          <span className="flex-1 min-w-0">수업명</span>
          <span className="w-14 shrink-0">강사</span>
          <span className="w-40">스케줄</span>
          <span className="w-10 shrink-0 text-center">인원</span>
          <span className="w-16 shrink-0 text-center">시작</span>
          <span className="w-16 shrink-0 text-center">종료</span>
          <span className="w-5 shrink-0"></span>
        </div>

        {groupedEnrollments.length === 0 ? (
          <div className="text-center py-6">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500 text-xs">수강 중인 수업이 없습니다</p>
            {!readOnly && (
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + 수업 배정하기
              </button>
            )}
          </div>
        ) : (
          <div>
            {sortBySubject(groupedEnrollments).map((group, index) => renderClassRow(group, index))}
          </div>
        )}
      </div>
      )}

      {/* 배정 예정 수업 섹션 */}
      <div className="mt-4">
        <div
          className="flex items-center gap-2 mb-2 cursor-pointer"
          onClick={() => setShowScheduledClasses(!showScheduledClasses)}
        >
          <h3 className="text-xs font-bold text-primary">배정 예정 수업</h3>
          <span className="text-xs text-primary-700">
            ({scheduledEnrollments.length}개)
          </span>
          {scheduledEnrollments.length > 0 && (
            <span className="text-xxs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-sm">
              시작일 전
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showScheduledClasses ? '' : 'rotate-180'}`} />
        </div>
        {showScheduledClasses && (
        <div className="bg-white border border-gray-200 overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-primary-700">
            <span className="w-8 shrink-0">과목</span>
            <span className="flex-1 min-w-0">수업명</span>
            <span className="w-14 shrink-0">강사</span>
            <span className="w-40">스케줄</span>
            <span className="w-10 shrink-0 text-center">인원</span>
            <span className="w-16 shrink-0 text-center">시작</span>
            <span className="w-16 shrink-0 text-center">종료</span>
            <span className="w-5 shrink-0"></span>
          </div>

          {scheduledEnrollments.length === 0 ? (
            <div className="text-center py-6">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-xs">배정 예정 수업이 없습니다</p>
            </div>
          ) : (
            <div>
              {scheduledEnrollments.map((group, index) => {
                const subjectColor = SUBJECT_COLORS[group.subject] || SUBJECT_COLORS.other;
                const actualClass = allClasses.find(
                  c => c.className === group.className && c.subject === group.subject
                );
                const key = `${group.subject}_${group.className}_${group.teachers[0] || ''}`;
                const isDeleting = deletingClass === key;

                return (
                  <div
                    key={`scheduled-${group.subject}-${index}`}
                    className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 hover:bg-accent/5 transition-colors cursor-pointer"
                    onClick={() => handleClassClick(group)}
                  >
                    {/* 과목 뱃지 */}
                    <span
                      className="w-8 shrink-0 text-micro px-1 py-0.5 rounded-sm font-semibold text-center"
                      style={{
                        backgroundColor: subjectColor.bg,
                        color: subjectColor.text,
                      }}
                    >
                      {SUBJECT_LABELS[group.subject]}
                    </span>

                    {/* 수업명 */}
                    <span className="flex-1 min-w-0 text-xs text-primary-700 font-medium truncate">
                      {group.className}
                    </span>

                    {/* 강사
                        - classes.pendingTeacher + pendingTeacherDate 가 있고
                          enrollment 시작일이 인수인계 효력일 이상이면 새 담임으로 표시
                        - 이로써 인수인계 이전에 만들어진 "미래 시작 + 이전 담임 staffId" 레거시 enrollment 도
                          UI 상 올바르게 새 담임으로 보임 */}
                    <div className="w-14 shrink-0 flex items-center gap-0.5">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="text-xxs text-primary-700 truncate">
                        {(() => {
                          const pendingT = (actualClass as any)?.pendingTeacher;
                          const pendingD = (actualClass as any)?.pendingTeacherDate;
                          if (pendingT && pendingD && group.startDate && group.startDate >= pendingD) {
                            return getTeacherByIdOrName(pendingT)?.name || pendingT;
                          }
                          return getTeacherByIdOrName(getMainTeacher(group))?.name || actualClass?.teacher || '-';
                        })()}
                      </span>
                    </div>

                    {/* 스케줄 */}
                    <div className="w-40 min-w-0 overflow-hidden">
                      <ScheduleBadge
                        schedule={actualClass?.schedule || group.schedule}
                        subject={group.subject === 'english' ? 'english' : 'math'}
                      />
                    </div>

                    {/* 인원 자리 (수강중과 정렬) */}
                    <div className="w-10 shrink-0 flex items-center justify-center gap-0.5">
                      <Users className="w-3 h-3 text-gray-400" />
                      <span className="text-xxs font-medium text-primary">
                        {actualClass?.studentCount || 0}
                      </span>
                    </div>

                    {/* 시작일 */}
                    {canEditEnrollmentDates && !readOnly && editingDate?.key === `scheduled_${group.subject}_${group.className}_${group.teachers[0] || ''}` && editingDate?.field === 'startDate' ? (
                      <input
                        type="date"
                        className="w-24 shrink-0 text-xxs text-blue-600 text-center border border-blue-300 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        defaultValue={group.startDate || ''}
                        autoFocus
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== group.startDate) {
                            handleDateChange(group, 'startDate', e.target.value);
                          } else {
                            setEditingDate(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingDate(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className={`w-16 shrink-0 text-xxs text-blue-600 font-medium text-center ${canEditEnrollmentDates && !readOnly ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={(e) => {
                          if (canEditEnrollmentDates && !readOnly) {
                            e.stopPropagation();
                            setEditingDate({ key: `scheduled_${group.subject}_${group.className}_${group.teachers[0] || ''}`, field: 'startDate' });
                          }
                        }}
                      >
                        {group.startDate ? formatDate(group.startDate) : '-'}
                      </span>
                    )}

                    {/* 종료 자리 (수강중/지난과 정렬) */}
                    <span className="w-16 shrink-0 text-xxs text-gray-300 text-center">-</span>

                    {/* 삭제 버튼 - readOnly 모드에서는 숨김 */}
                    {!readOnly && (
                      <button
                        onClick={(e) => handleRemoveEnrollment(group, e)}
                        disabled={isDeleting}
                        className="w-5 h-5 shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-sm transition-colors disabled:opacity-50"
                        title="수업 배정 취소"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>

      {/* 지난 수업 섹션 */}
      <div className="mt-4">
        <div
          className="flex items-center gap-2 mb-2 cursor-pointer"
          onClick={() => setShowCompletedClasses(!showCompletedClasses)}
        >
          <h3 className="text-xs font-bold text-primary-700">지난 수업</h3>
          <span className="text-xs text-primary-700">
            ({completedClasses.length}개)
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCompletedClasses ? '' : 'rotate-180'}`} />
        </div>
        {showCompletedClasses && (
        <div className="bg-white border border-gray-200 overflow-hidden">
          {/* 테이블 헤더 - 수강중인 수업과 열 위치 동일하게 */}
          <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-primary-700">
            <span className="w-8 shrink-0">과목</span>
            <span className="flex-1 min-w-0">수업명</span>
            <span className="w-14 shrink-0">강사</span>
            <span className="w-40">스케줄</span>
            <span className="w-10 shrink-0 text-center">인원</span>
            <span className="w-16 shrink-0 text-center">시작</span>
            <span className="w-16 shrink-0 text-center">종료</span>
            <span className="w-5 shrink-0"></span>
          </div>

          {completedClasses.length === 0 ? (
            <div className="text-center py-6">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-xs">지난 수업이 없습니다</p>
            </div>
          ) : (
            <div>
              {sortBySubject(completedClasses).map((group, index) => renderCompletedClassRow(group, index))}
            </div>
          )}
        </div>
        )}
      </div>

      {/* 취소된 예약 섹션 — admin/master 전용. 선생님 실수 대비 안전망 */}
      {canManageClassHistory && cancelledEnrollments.length > 0 && (
        <div className="mt-4">
          <div
            className="flex items-center gap-2 mb-2 cursor-pointer"
            onClick={() => setShowCancelledClasses(!showCancelledClasses)}
          >
            <h3 className="text-xs font-bold text-orange-700">취소된 예약</h3>
            <span className="text-xs text-orange-700">
              ({cancelledEnrollments.length}개)
            </span>
            <span className="text-xxs text-gray-500 bg-orange-50 px-1.5 py-0.5 rounded-sm border border-orange-100">
              관리자 전용 · 복원 가능
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCancelledClasses ? '' : 'rotate-180'}`} />
          </div>
          {showCancelledClasses && (
            <div className="bg-white border border-orange-100 overflow-hidden">
              <div className="flex items-center gap-2 px-2 py-1 bg-orange-50/60 border-b border-orange-100 text-xxs font-medium text-orange-800">
                <span className="w-8 shrink-0">과목</span>
                <span className="flex-1 min-w-0">수업명</span>
                <span className="w-14 shrink-0">강사</span>
                <span className="w-24 shrink-0 text-center">예정 시작일</span>
                <span className="w-20 shrink-0 text-center">취소일</span>
                <span className="w-5 shrink-0"></span>
              </div>
              {cancelledEnrollments.map((c) => {
                const subjectColor = SUBJECT_COLORS[c.subject as keyof typeof SUBJECT_COLORS] || SUBJECT_COLORS.other;
                const teacherName = getTeacherByIdOrName(c.staffId)?.name || c.staffId || '-';
                const isRestoring = restoringEnrollmentId === c.id;
                return (
                  <div
                    key={`cancelled-${c.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 border-b border-orange-50 opacity-80"
                  >
                    <span
                      className="w-8 shrink-0 text-micro px-1 py-0.5 rounded-sm font-semibold text-center"
                      style={{ backgroundColor: subjectColor.bg, color: subjectColor.text }}
                    >
                      {SUBJECT_LABELS[c.subject as keyof typeof SUBJECT_LABELS]}
                    </span>
                    <span className="flex-1 min-w-0 text-xs text-primary-700 truncate">
                      {c.className}
                    </span>
                    <div className="w-14 shrink-0 flex items-center gap-0.5">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="text-xxs text-primary-700 truncate">{teacherName}</span>
                    </div>
                    <span className="w-24 shrink-0 text-xxs text-blue-600 text-center font-medium">
                      {c.startDate ? formatDate(c.startDate) : '-'}
                    </span>
                    <span className="w-20 shrink-0 text-xxs text-orange-600 text-center font-bold">
                      {formatDate(c.cancelledAt)}
                    </span>
                    {!readOnly && (
                      <button
                        onClick={(e) => handleRestoreCancelled(c.id, e)}
                        disabled={isRestoring}
                        className="w-5 h-5 shrink-0 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors disabled:opacity-50"
                        title="이 취소된 예약을 복원 (학생 다시 대기로 돌아감)"
                      >
                        {isRestoring ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

      {/* 학생 시간표 모달 */}
      {showTimetable && (
        <Suspense fallback={null}>
          <StudentTimetableModal
            student={student}
            onClose={() => setShowTimetable(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default CoursesTab;
