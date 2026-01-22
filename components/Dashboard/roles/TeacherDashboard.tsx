import React, { useState, useEffect } from 'react';
import { UserProfile, StaffMember } from '../../../types';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DashboardHeader from '../DashboardHeader';
import { BookOpen, Users, Calendar, CheckSquare, Clock, User } from 'lucide-react';
import {
  MATH_PERIOD_INFO,
  ENGLISH_PERIOD_INFO,
  WEEKEND_PERIOD_INFO,
} from '../../Timetable/constants';

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

  // 강사 이름 (영어 이름 우선, 없으면 한글 이름)
  const teacherName = staffMember?.englishName || staffMember?.name || userProfile.name;
  const teacherKoreanName = staffMember?.name || userProfile.koreanName;

  // 선생님 이름 비교 헬퍼 함수 (한글/영어 이름 모두 체크)
  const isTeacherMatch = (teacherNameInClass: string, myName: string, myKoreanName?: string): boolean => {
    if (!teacherNameInClass) return false;

    // 정확히 일치하면 true
    if (teacherNameInClass === myName || teacherNameInClass === myKoreanName) {
      return true;
    }

    // staff 데이터에서 해당 선생님 찾기
    const staffMember = staff?.find(s => s.name === teacherNameInClass || s.englishName === teacherNameInClass);
    if (!staffMember) return false;

    // 내 이름이 해당 staff의 한글 이름 또는 영어 이름과 일치하는지 확인
    return staffMember.name === myName ||
           staffMember.englishName === myName ||
           staffMember.name === myKoreanName ||
           staffMember.englishName === myKoreanName;
  };

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
        if (data.mainTeacher && isTeacherMatch(data.mainTeacher, teacherName, teacherKoreanName)) {
          isMainTeacher = true;
          isMyClass = true;
        }
        // 2. teacher 필드 체크
        else if (data.teacher && isTeacherMatch(data.teacher, teacherName, teacherKoreanName)) {
          isMainTeacher = true;
          isMyClass = true;
        }

        // 3. slotTeachers 체크 (부담임)
        if (!isMyClass && data.slotTeachers) {
          const slotTeacherNames = Object.values(data.slotTeachers) as string[];
          const isInSlotTeachers = slotTeacherNames.some(name =>
            isTeacherMatch(name, teacherName, teacherKoreanName)
          );

          if (isInSlotTeachers) {
            isMyClass = true;
            isMainTeacher = false; // slotTeachers에만 있으면 부담임
          }
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

      // 3. 내 학생 로드 (담임인 수업의 학생들만)
      const mainTeacherClasses = classes.filter(c => c.isMainTeacher);
      const mainClassNames = mainTeacherClasses.map(c => c.className);
      const studentsSet = new Set<string>();
      const students: MyStudent[] = [];

      // enrollments 서브컬렉션에서 담임 수업에 속한 학생 ID 수집
      enrollmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const className = data.className as string;
        const studentId = doc.ref.parent.parent?.id;

        if (mainClassNames.includes(className) && studentId && !studentsSet.has(studentId)) {
          studentsSet.add(studentId);
        }
      });

      // 학생 정보 가져오기
      if (studentsSet.size > 0) {
        const studentsSnapshot = await getDocs(
          query(
            collection(db, 'students'),
            where('status', '==', 'active')
          )
        );

        studentsSnapshot.docs.forEach(doc => {
          if (studentsSet.has(doc.id)) {
            const data = doc.data();
            students.push({
              id: doc.id,
              name: data.name,
              englishName: data.englishName,
              grade: data.grade,
              school: data.school,
            });
          }
        });
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
      <div className="max-w-[1800px] mx-auto space-y-3">
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

        {/* 내 수업 목록 */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-[#081429]" />
            <h2 className="text-sm font-bold text-[#081429]">내 수업</h2>
          </div>

          {myClasses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">담당 중인 수업이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {myClasses.map(cls => {
                // 내가 담당하는 스케줄만 필터링 (담임/부담임 구분 없이)
                let mySchedule = cls.schedule;

                // slotTeachers가 있으면 해당 교시만 필터링
                if (cls.slotTeachers && Object.keys(cls.slotTeachers).length > 0) {
                  mySchedule = cls.schedule.filter(slot => {
                    const slotKey = `${slot.day}-${slot.periodId}`;
                    const slotTeacher = cls.slotTeachers?.[slotKey];

                    // slotTeacher가 지정되어 있으면 그것과 비교
                    if (slotTeacher) {
                      return isTeacherMatch(slotTeacher, teacherName, teacherKoreanName);
                    }

                    // slotTeacher가 없는 교시는 담임이 담당 (담임이면 표시, 아니면 숨김)
                    return cls.isMainTeacher;
                  });
                }

                const scheduleEntries = formatSchedule(mySchedule, cls.subject);
                // 오늘 수업인지 확인
                const isTodayClass = mySchedule.some(s => s.day === dayOfWeek);

                return (
                  <div
                    key={cls.id}
                    className={`border rounded-lg p-2 transition-all ${
                      isTodayClass
                        ? 'border-[#fdb813] bg-amber-50 shadow-md ring-2 ring-[#fdb813]/20'
                        : 'border-gray-200 hover:border-[#fdb813] hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <h3 className="text-sm font-bold text-[#081429]">{cls.className}</h3>
                        {cls.isMainTeacher ? (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                            담임
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">
                            부담임
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        cls.subject === 'math' ? 'bg-blue-100 text-blue-700' :
                        cls.subject === 'english' ? 'bg-green-100 text-green-700' :
                        cls.subject === 'science' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {cls.subject === 'math' ? '수학' :
                         cls.subject === 'english' ? '영어' :
                         cls.subject === 'science' ? '과학' : '국어'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{cls.studentCount || 0}명</span>
                      </div>

                      {/* 스케줄 표시 */}
                      {scheduleEntries.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {scheduleEntries.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <div className="flex gap-0.5">
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
                              </div>
                              <span className="text-[10px] text-gray-500">{entry.label}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400 italic">
                          <Calendar className="w-3 h-3" />
                          <span className="text-[10px]">시간표 미지정</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 내 학생 목록 */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#081429]" />
            <h2 className="text-sm font-bold text-[#081429]">내 학생</h2>
          </div>

          {myStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">담당 학생이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {myStudents.slice(0, 20).map(student => (
                <div
                  key={student.id}
                  className="border border-gray-200 rounded-lg p-2 hover:border-[#fdb813] hover:shadow-sm transition-all"
                >
                  <div className="text-xs font-medium text-[#081429]">{student.name}</div>
                  {student.englishName && (
                    <div className="text-[10px] text-gray-500">{student.englishName}</div>
                  )}
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {student.school} {student.grade}
                  </div>
                </div>
              ))}
            </div>
          )}

          {myStudents.length > 20 && (
            <div className="text-center mt-2 text-xs text-gray-500">
              외 {myStudents.length - 20}명
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
