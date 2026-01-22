import React, { useState, useEffect } from 'react';
import { UserProfile, StaffMember } from '../../../types';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DashboardHeader from '../DashboardHeader';
import { BookOpen, Users, Calendar, CheckSquare, Clock, User, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  MATH_PERIOD_INFO,
  ENGLISH_PERIOD_INFO,
  WEEKEND_PERIOD_INFO,
} from '../../Timetable/constants';
import { isTeacherMatch, isTeacherInSlotTeachers, isSlotTeacherMatch, isEnglishAssistantTeacher } from '../../../utils/teacherUtils';

interface TeacherDashboardProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

interface MyClass {
  id: string;
  className: string;
  subject: 'math' | 'english' | 'science' | 'korean';
  schedule: { day: string; periodId: string; }[];
  studentCount?: number;
  isMainTeacher: boolean; // 담임 여부
  slotTeachers?: Record<string, string>; // 교시별 담당 선생님
}

interface MyStudent {
  id: string;
  name: string;
  englishName?: string;
  grade?: string;
  school?: string;
}

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

// 스케줄을 포맷팅하는 함수
function formatSchedule(
  schedule: { day: string; periodId: string; }[],
  subject: 'math' | 'english' | 'science' | 'korean'
): Array<{ days: string[]; label: string }> {
  if (!schedule || schedule.length === 0) {
    return [];
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
    const day = item.day;
    const periodId = item.periodId || '';
    const periodInfo = getPeriodInfoForDay(day);
    if (!periodId || !periodInfo[periodId]) continue;

    if (!dayPeriods.has(day)) {
      dayPeriods.set(day, []);
    }
    dayPeriods.get(day)!.push(periodId);
  }

  if (dayPeriods.size === 0) {
    return [];
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

  return entries;
}

/**
 * 강사 대시보드
 * - 내 수업 목록
 * - 내 학생 목록
 * - 상담 일정
 * - 출석 현황
 */
const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ userProfile, staffMember }) => {
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [myStudents, setMyStudents] = useState<MyStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [classPage, setClassPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const [studentSortBy, setStudentSortBy] = useState<'name' | 'school' | 'grade'>('name');
  const [studentSortOrder, setStudentSortOrder] = useState<'asc' | 'desc'>('asc');

  // 강사 이름 (영어 이름 우선, 없으면 한글 이름)
  const teacherName = staffMember?.englishName || staffMember?.name || userProfile.name;
  const teacherKoreanName = staffMember?.name || userProfile.koreanName;

  useEffect(() => {
    loadStaffData();
  }, []);

  useEffect(() => {
    loadTeacherData();
  }, [teacherName, teacherKoreanName, staff]);

  const loadStaffData = async () => {
    try {
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const staffData = staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember));
      setStaff(staffData);
    } catch (error) {
      console.error('Failed to load staff data:', error);
    }
  };

  const loadTeacherData = async () => {
    if (!teacherName) return;

    // staff 데이터가 로드될 때까지 대기
    if (staff.length === 0) return;

    setLoading(true);
    try {
      // 1. 내 수업 로드 (teacher, mainTeacher 또는 slotTeachers에 포함된 수업)
      // 모든 수업을 가져와서 클라이언트 측에서 필터링 (한글/영어 이름 매칭 위해)
      const classesRef = collection(db, 'classes');
      const allClassesSnapshot = await getDocs(classesRef);

      const classesMap = new Map<string, MyClass>();

      // 모든 수업을 순회하며 내가 담당하는 수업 찾기
      allClassesSnapshot.docs.forEach(doc => {
        const data = doc.data();

        // 담임 여부 체크
        let isMainTeacher = false;
        let isMyClass = false;

        // 1. mainTeacher 필드 체크 (우선순위 높음)
        if (data.mainTeacher && isTeacherMatch(data.mainTeacher, teacherName, teacherKoreanName, staff)) {
          isMainTeacher = true;
          isMyClass = true;
        }
        // 2. teacher 필드 체크
        else if (data.teacher && isTeacherMatch(data.teacher, teacherName, teacherKoreanName, staff)) {
          isMainTeacher = true;
          isMyClass = true;
        }

        // 3. slotTeachers 체크 (부담임)
        if (!isMyClass && isTeacherInSlotTeachers(data.slotTeachers, teacherName, teacherKoreanName, staff)) {
          isMyClass = true;
          isMainTeacher = false; // slotTeachers에만 있으면 부담임
        }

        // 내 수업이면 추가
        if (isMyClass) {
          classesMap.set(doc.id, {
            id: doc.id,
            className: data.className,
            subject: data.subject,
            schedule: data.schedule || [],
            isMainTeacher,
            slotTeachers: data.slotTeachers,
          });
        }
      });

      const classes = Array.from(classesMap.values());

      // 2. 각 수업의 학생 수 계산 (enrollments 서브컬렉션 사용)
      const enrollmentsSnapshot = await getDocs(collectionGroup(db, 'enrollments'));

      // 수업명별 학생 수 집계 (중복 학생 제거)
      const classStudentCount = new Map<string, Set<string>>();

      enrollmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const className = data.className as string;
        const studentId = doc.ref.parent.parent?.id;

        if (className && studentId) {
          if (!classStudentCount.has(className)) {
            classStudentCount.set(className, new Set());
          }
          classStudentCount.get(className)!.add(studentId);
        }
      });

      // 각 수업에 학생 수 할당
      for (const cls of classes) {
        cls.studentCount = classStudentCount.get(cls.className)?.size || 0;
      }

      setMyClasses(classes);

      // 3. 내 학생 로드 (teacherId 기반 - 학생관리 탭과 동일한 방식)
      const studentsSet = new Set<string>();
      const students: MyStudent[] = [];

      // enrollments 서브컬렉션에서 내가 담임인 학생 ID 수집
      // teacherId가 나인 enrollment를 찾되, 담임인 수업만 필터링
      const mainTeacherClasses = classes.filter(c => c.isMainTeacher);
      const mainClassNames = mainTeacherClasses.map(c => c.className);

      enrollmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const enrollmentTeacherId = data.teacherId as string;
        const className = data.className as string;
        const studentId = doc.ref.parent.parent?.id;

        // teacherId로 매칭 (이름 비교) + 담임 수업인지 확인
        const isMyTeacher =
          enrollmentTeacherId === teacherName ||
          enrollmentTeacherId === teacherKoreanName ||
          enrollmentTeacherId === staffMember?.id;

        // 담임 수업의 학생만 포함
        if (isMyTeacher && mainClassNames.includes(className) && studentId && !studentsSet.has(studentId)) {
          studentsSet.add(studentId);
        }
      });

      // 학생 정보 가져오기 (청크 처리: 10명씩)
      if (studentsSet.size > 0) {
        const studentIdsArray = Array.from(studentsSet);

        for (let i = 0; i < studentIdsArray.length; i += 10) {
          const chunk = studentIdsArray.slice(i, i + 10);
          const studentsSnapshot = await getDocs(
            query(
              collection(db, 'students'),
              where('__name__', 'in', chunk),
              where('status', '==', 'active')
            )
          );

          studentsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            students.push({
              id: doc.id,
              name: data.name,
              englishName: data.englishName,
              grade: data.grade,
              school: data.school,
            });
          });
        }
      }

      setMyStudents(students);
    } catch (error) {
      console.error('강사 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 오늘 요일
  const today = new Date();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];

  // 오늘 내 수업
  const todayClasses = myClasses.filter(cls =>
    cls.schedule.some(s => s.day === dayOfWeek)
  );

  // 내가 담당하는 스케줄만 반환하는 헬퍼 함수
  const getMySchedule = (cls: MyClass): { day: string; periodId: string }[] => {
    let mySchedule = cls.schedule;

    // slotTeachers가 있으면 해당 교시만 필터링
    if (cls.slotTeachers && Object.keys(cls.slotTeachers).length > 0) {
      mySchedule = cls.schedule.filter(slot => {
        const slotKey = `${slot.day}-${slot.periodId}`;

        // slotTeacher가 지정되어 있으면 그것과 비교
        if (isSlotTeacherMatch(cls.slotTeachers, slotKey, teacherName, teacherKoreanName, staff)) {
          return true;
        }

        // slotTeacher가 없는 교시는 담임이 담당 (담임이면 표시, 아니면 숨김)
        return cls.isMainTeacher && !cls.slotTeachers?.[slotKey];
      });
    }

    return mySchedule;
  };

  // 수업 정렬: 오늘 수업 → 담임 수업 → (오늘이면 교시순) → 요일순 → 수업명순
  const sortedClasses = React.useMemo(() => {
    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];

    // 오늘 교시의 가장 빠른 periodId 구하기 (숫자로 변환)
    const getTodayFirstPeriod = (schedule: { day: string; periodId: string }[]): number => {
      const todaySlots = schedule.filter(s => s.day === dayOfWeek);
      if (todaySlots.length === 0) return Infinity;

      // periodId에서 숫자 추출 (예: "4", "1-1" 등)
      const periodNumbers = todaySlots.map(s => {
        const match = s.periodId.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : Infinity;
      });
      return Math.min(...periodNumbers);
    };

    return [...myClasses].sort((a, b) => {
      // 내가 담당하는 스케줄 기준으로 오늘 수업 여부 판단
      const aMySchedule = getMySchedule(a);
      const bMySchedule = getMySchedule(b);
      const aHasToday = aMySchedule.some(s => s.day === dayOfWeek);
      const bHasToday = bMySchedule.some(s => s.day === dayOfWeek);

      // 1. 오늘 수업 여부로 먼저 구분
      if (aHasToday !== bHasToday) {
        return aHasToday ? -1 : 1;
      }

      // 2. 오늘 수업 여부가 같으면 담임/부담임으로 구분
      if (a.isMainTeacher !== b.isMainTeacher) {
        return a.isMainTeacher ? -1 : 1;
      }

      // 3. 둘 다 오늘 수업이면 교시 순서로 정렬
      if (aHasToday && bHasToday) {
        const aPeriod = getTodayFirstPeriod(aMySchedule);
        const bPeriod = getTodayFirstPeriod(bMySchedule);
        if (aPeriod !== bPeriod) {
          return aPeriod - bPeriod;
        }
      }

      // 4. 요일순 정렬 (내 스케줄의 첫 요일 기준)
      const aFirstDay = aMySchedule[0]?.day || '';
      const bFirstDay = bMySchedule[0]?.day || '';

      const aIndex = dayOrder.indexOf(aFirstDay);
      const bIndex = dayOrder.indexOf(bFirstDay);

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }

      // 5. 요일도 같으면 수업명으로 정렬
      return a.className.localeCompare(b.className, 'ko-KR');
    });
  }, [myClasses, dayOfWeek, teacherName, teacherKoreanName, staff]);

  // 학생 정렬
  const sortedStudents = React.useMemo(() => {
    return [...myStudents].sort((a, b) => {
      let compareValue = 0;

      if (studentSortBy === 'name') {
        compareValue = (a.name || '').localeCompare(b.name || '', 'ko-KR');
      } else if (studentSortBy === 'school') {
        compareValue = (a.school || '').localeCompare(b.school || '', 'ko-KR');
      } else if (studentSortBy === 'grade') {
        compareValue = (a.grade || '').localeCompare(b.grade || '', 'ko-KR');
      }

      return studentSortOrder === 'asc' ? compareValue : -compareValue;
    });
  }, [myStudents, studentSortBy, studentSortOrder]);

  // 정렬 토글 함수
  const handleSortChange = (sortBy: 'name' | 'school' | 'grade') => {
    if (studentSortBy === sortBy) {
      // 같은 컬럼을 클릭하면 정렬 순서 토글
      setStudentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // 다른 컬럼을 클릭하면 해당 컬럼으로 오름차순 정렬
      setStudentSortBy(sortBy);
      setStudentSortOrder('asc');
    }
    // 페이지를 첫 페이지로 리셋
    setStudentPage(1);
  };

  if (loading) {
    return (
      <div className="w-full h-full overflow-auto p-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <DashboardHeader userProfile={userProfile} staffMember={staffMember} />
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#fdb813] border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto p-3 bg-gray-50">
      <div className="max-w-[2000px] mx-auto space-y-3">
        <DashboardHeader userProfile={userProfile} staffMember={staffMember} />

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">전체 수업</h3>
              <BookOpen className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-[#081429]">{myClasses.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">담당 중인 수업</p>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">오늘 수업</h3>
              <Calendar className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-[#081429]">{todayClasses.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{dayOfWeek}요일 수업</p>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">내 학생</h3>
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-[#081429]">{myStudents.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">담당 학생 수</p>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">상담 예정</h3>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-[#081429]">0</p>
            <p className="text-[10px] text-gray-400 mt-0.5">예정된 상담</p>
          </div>
        </div>

        {/* 내 수업 | 내 학생 2단 레이아웃 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 내 수업 목록 */}
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#081429]" />
                <h2 className="text-sm font-bold text-[#081429]">내 수업</h2>
                <span className="text-xs text-gray-500">({sortedClasses.length}개)</span>
              </div>
              {sortedClasses.length > 10 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setClassPage(p => Math.max(1, p - 1))}
                    disabled={classPage === 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-600">
                    {classPage} / {Math.ceil(sortedClasses.length / 10)}
                  </span>
                  <button
                    onClick={() => setClassPage(p => Math.min(Math.ceil(sortedClasses.length / 10), p + 1))}
                    disabled={classPage >= Math.ceil(sortedClasses.length / 10)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {sortedClasses.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">담당 중인 수업이 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ minHeight: '400px' }}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-700">수업명</th>
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-700">과목</th>
                      <th className="text-center py-2 px-2 text-xs font-bold text-gray-700">담임</th>
                      <th className="text-center py-2 px-2 text-xs font-bold text-gray-700">학생수</th>
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-700">시간표</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClasses.slice((classPage - 1) * 10, classPage * 10).map(cls => {
                      // 내가 담당하는 스케줄만 필터링 (담임/부담임 구분 없이)
                      let mySchedule = cls.schedule;

                      // slotTeachers가 있으면 해당 교시만 필터링
                      if (cls.slotTeachers && Object.keys(cls.slotTeachers).length > 0) {
                        mySchedule = cls.schedule.filter(slot => {
                          const slotKey = `${slot.day}-${slot.periodId}`;

                          // slotTeacher가 지정되어 있으면 그것과 비교
                          if (isSlotTeacherMatch(cls.slotTeachers, slotKey, teacherName, teacherKoreanName, staff)) {
                            return true;
                          }

                          // slotTeacher가 없는 교시는 담임이 담당 (담임이면 표시, 아니면 숨김)
                          return cls.isMainTeacher && !cls.slotTeachers?.[slotKey];
                        });
                      }

                      const scheduleEntries = formatSchedule(mySchedule, cls.subject);
                      // 오늘 수업인지 확인
                      const isTodayClass = mySchedule.some(s => s.day === dayOfWeek);

                      return (
                        <tr
                          key={cls.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${isTodayClass ? 'bg-amber-50' : ''
                            }`}
                        >
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-[#081429]">{cls.className}</span>
                              {isTodayClass && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-200 text-amber-800 font-bold">
                                  오늘
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cls.subject === 'math' ? 'bg-blue-100 text-blue-700' :
                              cls.subject === 'english' ? 'bg-green-100 text-green-700' :
                                cls.subject === 'science' ? 'bg-purple-100 text-purple-700' :
                                  'bg-orange-100 text-orange-700'
                              }`}>
                              {cls.subject === 'math' ? '수학' :
                                cls.subject === 'english' ? '영어' :
                                  cls.subject === 'science' ? '과학' : '국어'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {cls.isMainTeacher ? (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                                담임
                              </span>
                            ) : (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">
                                부담임
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center text-xs text-gray-600">
                            {cls.studentCount || 0}명
                          </td>
                          <td className="py-2 px-2">
                            {scheduleEntries.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {scheduleEntries.map((entry, idx) => (
                                  <div key={idx} className="flex items-center gap-0.5">
                                    {entry.days.map((day, dayIdx) => {
                                      const colors = DAY_COLORS[day] || { bg: '#f3f4f6', text: '#374151' };
                                      return (
                                        <span
                                          key={dayIdx}
                                          className="text-[9px] px-1 py-0.5 rounded font-bold"
                                          style={{ backgroundColor: colors.bg, color: colors.text }}
                                        >
                                          {day}
                                        </span>
                                      );
                                    })}
                                    <span className="text-[10px] text-gray-500">{entry.label}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">미지정</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 내 학생 목록 */}
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#081429]" />
                <h2 className="text-sm font-bold text-[#081429]">내 학생</h2>
                <span className="text-xs text-gray-500">({myStudents.length}명)</span>
              </div>
              {myStudents.length > 10 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                    disabled={studentPage === 1}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-600">
                    {studentPage} / {Math.ceil(myStudents.length / 10)}
                  </span>
                  <button
                    onClick={() => setStudentPage(p => Math.min(Math.ceil(myStudents.length / 10), p + 1))}
                    disabled={studentPage === Math.ceil(myStudents.length / 10)}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {myStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">담당 학생이 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ minHeight: '400px' }}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-700">
                        <button
                          onClick={() => handleSortChange('name')}
                          className="flex items-center gap-1 hover:text-[#081429] transition-colors"
                        >
                          이름
                          {studentSortBy === 'name' ? (
                            studentSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-700">영문명</th>
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-700">
                        <button
                          onClick={() => handleSortChange('school')}
                          className="flex items-center gap-1 hover:text-[#081429] transition-colors"
                        >
                          학교
                          {studentSortBy === 'school' ? (
                            studentSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-700">
                        <button
                          onClick={() => handleSortChange('grade')}
                          className="flex items-center gap-1 hover:text-[#081429] transition-colors"
                        >
                          학년
                          {studentSortBy === 'grade' ? (
                            studentSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.slice((studentPage - 1) * 10, studentPage * 10).map(student => (
                      <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 text-xs font-medium text-[#081429]">{student.name}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{student.englishName || '-'}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{student.school || '-'}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{student.grade || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
