import React, { useState, useEffect } from 'react';
import { UserProfile, StaffMember } from '../../../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DashboardHeader from '../DashboardHeader';
import { Users, BookOpen, TrendingUp, Calendar, DollarSign, UserCheck, Clock } from 'lucide-react';
import { isTeacherMatch, isTeacherInSlotTeachers, isSlotTeacherMatch } from '../../../utils/teacherUtils';
import { SUBJECT_COLORS, SUBJECT_LABELS, SubjectType } from '../../../utils/styleUtils';

interface ManagerDashboardProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

interface ClassInfo {
  id: string;
  className: string;
  subject: 'math' | 'english' | 'science' | 'korean';
  teacher?: string;
  mainTeacher?: string;
  studentCount?: number;
  schedule?: { day: string; periodId: string; }[];
  slotTeachers?: Record<string, string>;
}

interface TeacherStats {
  name: string;
  englishName?: string;
  classCount: number;
  studentCount: number;
}

/**
 * 매니저 대시보드
 * - 전체 학원 운영 통계
 * - 강사별 성과
 * - 반 관리 현황
 */
const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ userProfile, staffMember }) => {
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [teacherStats, setTeacherStats] = useState<TeacherStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. 전체 학생 수 로드
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const allStudents = studentsSnapshot.docs.map(doc => doc.data());
      const activeStudentsList = allStudents.filter((s: any) => s.status === 'active');

      setTotalStudents(allStudents.length);
      setActiveStudents(activeStudentsList.length);

      // 2. 전체 수업 로드
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const allClasses: ClassInfo[] = [];

      for (const doc of classesSnapshot.docs) {
        const data = doc.data();

        // 각 수업의 학생 수 계산
        const enrollmentsSnapshot = await getDocs(
          query(
            collection(db, 'students'),
            where('enrollments', 'array-contains', { className: data.className, subject: data.subject })
          )
        );

        allClasses.push({
          id: doc.id,
          className: data.className,
          subject: data.subject,
          teacher: data.teacher,
          mainTeacher: data.mainTeacher,
          studentCount: enrollmentsSnapshot.size,
          schedule: data.schedule || [],
          slotTeachers: data.slotTeachers,
        });
      }

      setTotalClasses(allClasses.length);
      setClasses(allClasses);

      // 3. 강사별 통계 계산
      const teacherMap = new Map<string, TeacherStats>();

      allClasses.forEach(cls => {
        const teacherName = cls.teacher || cls.mainTeacher;
        if (!teacherName) return;

        if (!teacherMap.has(teacherName)) {
          teacherMap.set(teacherName, {
            name: teacherName,
            classCount: 0,
            studentCount: 0,
          });
        }

        const stats = teacherMap.get(teacherName)!;
        stats.classCount += 1;
        stats.studentCount += cls.studentCount || 0;
      });

      const sortedTeachers = Array.from(teacherMap.values())
        .sort((a, b) => b.studentCount - a.studentCount);

      setTeacherStats(sortedTeachers);
    } catch (error) {
      console.error('대시보드 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 오늘 요일
  const today = new Date();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];

  // 선생님 필터링 함수
  const isTeacherInClass = (cls: ClassInfo, teacherFilter: string): boolean => {
    if (teacherFilter === 'all') return true;

    // 담임 체크 (유틸 함수 사용)
    if (isTeacherMatch(cls.teacher || '', teacherFilter) ||
        isTeacherMatch(cls.mainTeacher || '', teacherFilter)) {
      return true;
    }

    // 부담임 체크 (유틸 함수 사용)
    if (isTeacherInSlotTeachers(cls.slotTeachers, teacherFilter)) {
      return true;
    }

    return false;
  };

  // 스케줄 필터링 함수 (선생님이 담당하는 교시만)
  const filterScheduleByTeacher = (
    schedule: { day: string; periodId: string; }[] | undefined,
    teacher: string | undefined,
    mainTeacher: string | undefined,
    slotTeachers: Record<string, string> | undefined,
    teacherFilter: string
  ): { day: string; periodId: string; }[] | undefined => {
    if (!schedule || teacherFilter === 'all') return schedule;

    // slotTeachers가 있으면 교시별로 필터링
    if (slotTeachers && Object.keys(slotTeachers).length > 0) {
      return schedule.filter(slot => {
        const slotKey = `${slot.day}-${slot.periodId}`;

        // slotTeacher가 지정되어 있으면 그것과 비교 (유틸 함수 사용)
        if (isSlotTeacherMatch(slotTeachers, slotKey, teacherFilter)) {
          return true;
        }

        // slotTeacher가 없는 교시는 담임이 담당 (유틸 함수 사용)
        return !slotTeachers[slotKey] && (
          isTeacherMatch(teacher || '', teacherFilter) ||
          isTeacherMatch(mainTeacher || '', teacherFilter)
        );
      });
    }

    // slotTeachers가 없으면 전체 스케줄 반환 (담임이면)
    return schedule;
  };

  // 필터링된 수업 목록
  const filteredClasses = classes.filter(cls => isTeacherInClass(cls, selectedTeacher));

  // 오늘 수업
  const todayClasses = filteredClasses.filter(cls =>
    cls.schedule?.some(s => s.day === dayOfWeek)
  );

  if (loading) {
    return (
      <div className="w-full h-full overflow-auto p-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <DashboardHeader userProfile={userProfile} staffMember={staffMember} />
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-sm h-12 w-12 border-4 border-[#fdb813] border-t-transparent"></div>
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
          <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">전체 학생</h3>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-[#081429]">{totalStudents}</p>
            <p className="text-xxs text-gray-400 mt-0.5">재원 {activeStudents}명</p>
          </div>

          <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">전체 수업</h3>
              <BookOpen className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-[#081429]">{totalClasses}</p>
            <p className="text-xxs text-gray-400 mt-0.5">운영 중인 수업</p>
          </div>

          <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">오늘 수업</h3>
              <Calendar className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-[#081429]">{todayClasses.length}</p>
            <p className="text-xxs text-gray-400 mt-0.5">{dayOfWeek}요일 수업</p>
          </div>

          <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-medium text-gray-500">강사</h3>
              <UserCheck className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-[#081429]">{teacherStats.length}</p>
            <p className="text-xxs text-gray-400 mt-0.5">활동 중인 강사</p>
          </div>
        </div>

        {/* 강사별 성과 */}
        <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#081429]" />
            <h2 className="text-sm font-bold text-[#081429]">강사별 성과</h2>
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
                        <div className="text-xs font-medium text-[#081429]">{teacher.name}</div>
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
              <BookOpen className="w-4 h-4 text-[#081429]" />
              <h2 className="text-sm font-bold text-[#081429]">수업 현황</h2>
            </div>

            {/* 선생님 필터 */}
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-sm text-xs focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
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
                // 선택된 선생님이 담당하는 스케줄만 필터링
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
                  className="border border-gray-200 rounded-sm p-2 hover:border-[#fdb813] hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-sm font-bold text-[#081429]">{cls.className}</h3>
                    <span className={`text-xxs px-1.5 py-0.5 rounded-sm font-medium ${SUBJECT_COLORS[cls.subject as SubjectType]?.badge || SUBJECT_COLORS.other.badge}`}>
                      {SUBJECT_LABELS[cls.subject as SubjectType] || cls.subject}
                    </span>
                  </div>

                  <div className="space-y-0.5 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      <span>{cls.teacher || cls.mainTeacher || '미지정'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{cls.studentCount || 0}명</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span className="text-xxs">
                        {filteredSchedule && filteredSchedule.length > 0
                          ? filteredSchedule.map(s => s.day).join(', ')
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
