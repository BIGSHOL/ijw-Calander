import React, { useState, useEffect } from 'react';
import { UserProfile, StaffMember } from '../../../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
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

  // 강사 이름 (staffMember.name 또는 userProfile.name)
  const teacherName = staffMember?.name || userProfile.name;
  const teacherKoreanName = staffMember?.koreanName || userProfile.koreanName;

  useEffect(() => {
    loadTeacherData();
  }, [teacherName, teacherKoreanName]);

  const loadTeacherData = async () => {
    if (!teacherName) return;

    setLoading(true);
    try {
      // 1. 내 수업 로드 (teacher, mainTeacher, assistants, 또는 slotTeachers에 포함된 수업)
      const classesRef = collection(db, 'classes');

      // 영어 이름으로 검색 (teacher 필드)
      const q1 = query(classesRef, where('teacher', '==', teacherName));
      const snapshot1 = await getDocs(q1);

      // 한글 이름으로 검색 (mainTeacher 필드)
      let snapshot2: any = { docs: [] };
      if (teacherKoreanName) {
        const q2 = query(classesRef, where('mainTeacher', '==', teacherKoreanName));
        snapshot2 = await getDocs(q2);
      }

      // assistants 배열에 포함된 수업 검색
      const q3 = query(classesRef, where('assistants', 'array-contains', teacherName));
      const snapshot3 = await getDocs(q3);

      // 한글 이름도 assistants에 있을 수 있음
      let snapshot4: any = { docs: [] };
      if (teacherKoreanName) {
        const q4 = query(classesRef, where('assistants', 'array-contains', teacherKoreanName));
        snapshot4 = await getDocs(q4);
      }

      // slotTeachers는 객체이므로 Firestore 쿼리로 검색 불가
      // 모든 수업을 가져와서 클라이언트 측에서 필터링
      const allClassesSnapshot = await getDocs(classesRef);

      const classesMap = new Map<string, MyClass>();

      // 기본 쿼리 결과 처리 (teacher, mainTeacher, assistants)
      [...snapshot1.docs, ...snapshot2.docs, ...snapshot3.docs, ...snapshot4.docs].forEach(doc => {
        const data = doc.data();
        if (!classesMap.has(doc.id)) {
          // 담임 판별 로직:
          // 1. mainTeacher 필드가 있으면 그것 사용
          // 2. 없으면 teacher 필드 체크
          // 3. slotTeachers나 assistants에만 있으면 부담임

          let isMainTeacher = false;

          // mainTeacher 필드 우선 체크
          if (data.mainTeacher) {
            isMainTeacher = data.mainTeacher === teacherKoreanName || data.mainTeacher === teacherName;
          }
          // mainTeacher가 없으면 teacher 필드 체크
          else if (data.teacher) {
            isMainTeacher = data.teacher === teacherKoreanName || data.teacher === teacherName;
          }

          // slotTeachers에만 있는지 체크 (부담임 판별)
          if (!isMainTeacher && data.slotTeachers) {
            const slotTeacherNames = Object.values(data.slotTeachers);
            const isInSlotTeachers = slotTeacherNames.includes(teacherName) ||
                                     (teacherKoreanName && slotTeacherNames.includes(teacherKoreanName));
            // slotTeachers에 있으면 담임이 아님 (이미 false이므로 변경 없음)
          }

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

      // slotTeachers에 포함된 수업 추가 (클라이언트 측 필터링)
      allClassesSnapshot.docs.forEach(doc => {
        const data = doc.data();

        // 이미 추가된 수업은 건너뛰기
        if (classesMap.has(doc.id)) return;

        // slotTeachers 체크
        if (data.slotTeachers) {
          const slotTeacherNames = Object.values(data.slotTeachers) as string[];
          const isInSlotTeachers = slotTeacherNames.includes(teacherName) ||
                                   (teacherKoreanName && slotTeacherNames.includes(teacherKoreanName));

          if (isInSlotTeachers) {
            // slotTeachers에만 있으면 부담임
            classesMap.set(doc.id, {
              id: doc.id,
              className: data.className,
              subject: data.subject,
              schedule: data.schedule || [],
              isMainTeacher: false, // slotTeachers에만 있으면 무조건 부담임
              slotTeachers: data.slotTeachers,
            });
          }
        }
      });

      const classes = Array.from(classesMap.values());

      // 2. 각 수업의 학생 수 계산
      for (const cls of classes) {
        const enrollmentsSnapshot = await getDocs(
          query(
            collection(db, 'students'),
            where(`enrollments`, 'array-contains', { className: cls.className, subject: cls.subject })
          )
        );
        cls.studentCount = enrollmentsSnapshot.size;
      }

      setMyClasses(classes);

      // 3. 내 학생 로드 (내 수업에 등록된 학생들)
      const classNames = classes.map(c => c.className);
      const studentsSet = new Set<string>();
      const students: MyStudent[] = [];

      for (const className of classNames) {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        studentsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const enrollments = data.enrollments || [];

          // 해당 수업에 등록된 학생인지 확인
          const hasEnrollment = enrollments.some((e: any) => e.className === className);

          if (hasEnrollment && !studentsSet.has(doc.id) && data.status === 'active') {
            studentsSet.add(doc.id);
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
    <div className="w-full h-full overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <DashboardHeader userProfile={userProfile} staffMember={staffMember} />

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">전체 수업</h3>
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-[#081429]">{myClasses.length}</p>
            <p className="text-xs text-gray-400 mt-1">담당 중인 수업</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">오늘 수업</h3>
              <Calendar className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-[#081429]">{todayClasses.length}</p>
            <p className="text-xs text-gray-400 mt-1">{dayOfWeek}요일 수업</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">내 학생</h3>
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-[#081429]">{myStudents.length}</p>
            <p className="text-xs text-gray-400 mt-1">담당 학생 수</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">상담 예정</h3>
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-3xl font-bold text-[#081429]">0</p>
            <p className="text-xs text-gray-400 mt-1">예정된 상담</p>
          </div>
        </div>

        {/* 내 수업 목록 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-[#081429]" />
            <h2 className="text-lg font-bold text-[#081429]">내 수업</h2>
          </div>

          {myClasses.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>담당 중인 수업이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myClasses.map(cls => {
                // 내가 담당하는 스케줄만 필터링
                let mySchedule = cls.schedule;

                if (cls.slotTeachers && !cls.isMainTeacher) {
                  // 부담임인 경우: 내가 담당하는 교시만 필터링
                  mySchedule = cls.schedule.filter(slot => {
                    const slotKey = `${slot.day}-${slot.periodId}`;
                    const slotTeacher = cls.slotTeachers?.[slotKey];
                    return slotTeacher === teacherName || slotTeacher === teacherKoreanName;
                  });
                }

                const scheduleEntries = formatSchedule(mySchedule, cls.subject);
                // 오늘 수업인지 확인
                const isTodayClass = mySchedule.some(s => s.day === dayOfWeek);

                return (
                  <div
                    key={cls.id}
                    className={`border rounded-lg p-4 transition-all ${
                      isTodayClass
                        ? 'border-[#fdb813] bg-amber-50 shadow-md ring-2 ring-[#fdb813]/20'
                        : 'border-gray-200 hover:border-[#fdb813] hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#081429]">{cls.className}</h3>
                        {cls.isMainTeacher ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                            담임
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">
                            부담임
                          </span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
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

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{cls.studentCount || 0}명</span>
                      </div>

                      {/* 스케줄 표시 */}
                      {scheduleEntries.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {scheduleEntries.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <div className="flex gap-0.5">
                                {entry.days.map((day, dayIdx) => {
                                  const colors = DAY_COLORS[day] || { bg: '#f3f4f6', text: '#374151' };
                                  return (
                                    <span
                                      key={dayIdx}
                                      className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                      style={{ backgroundColor: colors.bg, color: colors.text }}
                                    >
                                      {day}
                                    </span>
                                  );
                                })}
                              </div>
                              <span className="text-xs text-gray-500">{entry.label}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400 italic">
                          <Calendar className="w-4 h-4" />
                          <span className="text-xs">시간표 미지정</span>
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
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#081429]" />
            <h2 className="text-lg font-bold text-[#081429]">내 학생</h2>
          </div>

          {myStudents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>담당 학생이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {myStudents.slice(0, 20).map(student => (
                <div
                  key={student.id}
                  className="border border-gray-200 rounded-lg p-3 hover:border-[#fdb813] hover:shadow-sm transition-all"
                >
                  <div className="font-medium text-[#081429]">{student.name}</div>
                  {student.englishName && (
                    <div className="text-xs text-gray-500">{student.englishName}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {student.school} {student.grade}
                  </div>
                </div>
              ))}
            </div>
          )}

          {myStudents.length > 20 && (
            <div className="text-center mt-4 text-sm text-gray-500">
              외 {myStudents.length - 20}명
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
