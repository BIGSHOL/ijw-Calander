import React, { useMemo, useState } from 'react';
import { UserProfile, StaffMember } from '../../../types';
import DashboardHeader from '../DashboardHeader';
import { Users, BookOpen, TrendingUp, Calendar, UserCheck } from 'lucide-react';
import { isTeacherMatch, isTeacherInSlotTeachers, isSlotTeacherMatch } from '../../../utils/teacherUtils';
import { SUBJECT_COLORS, SUBJECT_LABELS, SubjectType } from '../../../utils/styleUtils';
import { useStudents } from '../../../hooks/useStudents';
import { useClasses } from '../../../hooks/useClasses';
import { isActiveStudent } from '../../../utils/dashboardUtils';
import { getTodayKST } from '../../../utils/dateUtils';

interface ManagerDashboardProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

interface ScheduleSlot {
  day: string;
  periodId: string;
}

interface NormalizedClass {
  id: string;
  className: string;
  subject: SubjectType;
  teacher?: string;
  mainTeacher?: string;
  studentCount: number;
  schedule: ScheduleSlot[];
  slotTeachers?: Record<string, string>;
}

interface TeacherStats {
  name: string;
  classCount: number;
  studentCount: number;
}

/**
 * 매니저 대시보드
 * - 데이터 출처: useStudents(true) + useClasses() — MasterDashboard와 동일 캐시 공유 (정합성)
 * - 학생 수 카운트: 공통 isActiveStudent (status='active' + 활성 enrollment 1개 이상)
 * - 수업별 학생 수: useClasses() 내부에서 KST 기준 활성 학생만 카운트 (퇴원/미래배정 제외)
 */
const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ userProfile, staffMember }) => {
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');

  // ── 캐시 기반 데이터 로딩 (MasterDashboard와 동일) ──
  const { students = [], loading: studentsLoading } = useStudents(true);
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const loading = studentsLoading || classesLoading;

  // ── 학생 카운트 ──
  const today = useMemo(() => getTodayKST(), []);
  const totalStudents = students.length;
  const activeStudents = useMemo(
    () => students.filter(s => isActiveStudent(s, today)).length,
    [students, today]
  );

  // ── 수업 정규화 (schedule은 string | object 혼재 가능 → ScheduleSlot[]로 통일) ──
  const classes: NormalizedClass[] = useMemo(() => {
    return allClasses.map((c: any) => {
      const rawSchedule = Array.isArray(c.schedule) ? c.schedule : [];
      const schedule: ScheduleSlot[] = rawSchedule
        .map((slot: any): ScheduleSlot | null => {
          if (slot && typeof slot === 'object' && 'day' in slot) {
            return { day: String(slot.day || ''), periodId: String(slot.periodId || '') };
          }
          if (typeof slot === 'string') {
            // "월-1" / "월 1" / "월1" 등의 패턴 파싱
            const match = slot.match(/^([월화수목금토일])\s*[-_]?\s*(.+)$/);
            if (match) return { day: match[1], periodId: match[2].trim() };
            // 첫 글자가 요일인 단순 케이스
            const first = slot.charAt(0);
            if ('월화수목금토일'.includes(first)) {
              return { day: first, periodId: slot.slice(1).trim() };
            }
          }
          return null;
        })
        .filter((s): s is ScheduleSlot => s !== null);

      return {
        id: c.id,
        className: c.className,
        subject: c.subject as SubjectType,
        teacher: c.teacher,
        mainTeacher: (c as any).mainTeacher,
        studentCount: c.studentCount || 0,
        schedule,
        slotTeachers: c.slotTeachers,
      };
    });
  }, [allClasses]);

  // ── 강사별 통계 ──
  const teacherStats: TeacherStats[] = useMemo(() => {
    const teacherMap = new Map<string, TeacherStats>();
    classes.forEach(cls => {
      const teacherName = cls.teacher || cls.mainTeacher;
      if (!teacherName) return;
      if (!teacherMap.has(teacherName)) {
        teacherMap.set(teacherName, { name: teacherName, classCount: 0, studentCount: 0 });
      }
      const stats = teacherMap.get(teacherName)!;
      stats.classCount += 1;
      stats.studentCount += cls.studentCount;
    });
    return Array.from(teacherMap.values()).sort((a, b) => b.studentCount - a.studentCount);
  }, [classes]);

  // ── 강사 필터링 ──
  const isTeacherInClass = (cls: NormalizedClass, teacherFilter: string): boolean => {
    if (teacherFilter === 'all') return true;
    if (isTeacherMatch(cls.teacher || '', teacherFilter) ||
        isTeacherMatch(cls.mainTeacher || '', teacherFilter)) return true;
    if (isTeacherInSlotTeachers(cls.slotTeachers, teacherFilter)) return true;
    return false;
  };

  const filterScheduleByTeacher = (
    schedule: ScheduleSlot[],
    teacher: string | undefined,
    mainTeacher: string | undefined,
    slotTeachers: Record<string, string> | undefined,
    teacherFilter: string
  ): ScheduleSlot[] => {
    if (teacherFilter === 'all') return schedule;
    if (slotTeachers && Object.keys(slotTeachers).length > 0) {
      return schedule.filter(slot => {
        const slotKey = `${slot.day}-${slot.periodId}`;
        if (isSlotTeacherMatch(slotTeachers, slotKey, teacherFilter)) return true;
        return !slotTeachers[slotKey] && (
          isTeacherMatch(teacher || '', teacherFilter) ||
          isTeacherMatch(mainTeacher || '', teacherFilter)
        );
      });
    }
    return schedule;
  };

  const filteredClasses = useMemo(
    () => classes.filter(cls => isTeacherInClass(cls, selectedTeacher)),
    [classes, selectedTeacher]
  );

  // ── 오늘 요일 (KST) ──
  const dayOfWeek = useMemo(() => {
    const baseDate = new Date(`${today}T00:00:00+09:00`);
    return ['일', '월', '화', '수', '목', '금', '토'][baseDate.getDay()];
  }, [today]);

  const todayClasses = useMemo(
    () => filteredClasses.filter(cls => cls.schedule.some(s => s.day === dayOfWeek)),
    [filteredClasses, dayOfWeek]
  );

  if (loading) {
    return (
      <div className="w-full p-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <DashboardHeader userProfile={userProfile} staffMember={staffMember} />
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-sm h-12 w-12 border-4 border-accent border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-3 bg-gray-50 overflow-x-auto">
      <div className="max-w-[1800px] mx-auto min-w-[768px] space-y-3">
        <DashboardHeader userProfile={userProfile} staffMember={staffMember} />

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">전체 학생</h3>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-primary">{totalStudents}</p>
            <p className="text-xxs text-gray-400 mt-0.5">재원 {activeStudents}명</p>
          </div>

          <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">전체 수업</h3>
              <BookOpen className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-primary">{classes.length}</p>
            <p className="text-xxs text-gray-400 mt-0.5">운영 중인 수업</p>
          </div>

          <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">오늘 수업</h3>
              <Calendar className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-primary">{todayClasses.length}</p>
            <p className="text-xxs text-gray-400 mt-0.5">{dayOfWeek}요일 수업</p>
          </div>

          <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">강사</h3>
              <UserCheck className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-primary">{teacherStats.length}</p>
            <p className="text-xxs text-gray-400 mt-0.5">활동 중인 강사</p>
          </div>
        </div>

        {/* 강사별 성과 */}
        <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-primary">강사별 성과</h2>
          </div>

          {teacherStats.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">강사 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-xs font-bold text-gray-700">강사명</th>
                    <th className="text-center py-2 px-2 text-xs font-bold text-gray-700">담당 수업</th>
                    <th className="text-center py-2 px-2 text-xs font-bold text-gray-700">담당 학생</th>
                    <th className="text-center py-2 px-2 text-xs font-bold text-gray-700">평균 학생/수업</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherStats.map((teacher, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <div className="text-xs font-medium text-primary">{teacher.name}</div>
                      </td>
                      <td className="text-center py-2 px-2 text-xs text-gray-600">
                        {teacher.classCount}개
                      </td>
                      <td className="text-center py-2 px-2 text-xs text-gray-600">
                        {teacher.studentCount}명
                      </td>
                      <td className="text-center py-2 px-2 text-xs text-gray-600">
                        {teacher.classCount > 0
                          ? (teacher.studentCount / teacher.classCount).toFixed(1)
                          : '0'}명
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 수업 현황 */}
        <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-primary">수업 현황</h2>
            </div>

            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-sm text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">전체 선생님</option>
              {teacherStats.map(teacher => (
                <option key={teacher.name} value={teacher.name}>
                  {teacher.name} ({teacher.classCount}개 수업)
                </option>
              ))}
            </select>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">수업 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredClasses.slice(0, 12).map(cls => {
                const filteredSchedule = filterScheduleByTeacher(
                  cls.schedule,
                  cls.teacher,
                  cls.mainTeacher,
                  cls.slotTeachers,
                  selectedTeacher
                );

                return (
                  <div
                    key={cls.id}
                    className="border border-gray-200 rounded-sm p-2 hover:border-accent hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-sm font-bold text-primary">{cls.className}</h3>
                      <span className={`text-xxs px-1.5 py-0.5 rounded-sm font-medium ${SUBJECT_COLORS[cls.subject]?.badge || SUBJECT_COLORS.other.badge}`}>
                        {SUBJECT_LABELS[cls.subject] || cls.subject}
                      </span>
                    </div>

                    <div className="space-y-0.5 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        <span>{cls.teacher || cls.mainTeacher || '미지정'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{cls.studentCount}명</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span className="text-xxs">
                          {filteredSchedule.length > 0
                            ? Array.from(new Set(filteredSchedule.map(s => s.day))).join(', ')
                            : '시간표 미지정'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredClasses.length > 12 && (
            <div className="text-center mt-2 text-xs text-gray-500">
              외 {filteredClasses.length - 12}개 수업
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
