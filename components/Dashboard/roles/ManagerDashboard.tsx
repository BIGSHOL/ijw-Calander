import React, { useState, useEffect } from 'react';
import { UserProfile, StaffMember } from '../../../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DashboardHeader from '../DashboardHeader';
import { Users, BookOpen, TrendingUp, Calendar, DollarSign, UserCheck, Clock } from 'lucide-react';

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

  // 오늘 수업
  const todayClasses = classes.filter(cls =>
    cls.schedule?.some(s => s.day === dayOfWeek)
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
              <h3 className="text-sm font-medium text-gray-500">전체 학생</h3>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-[#081429]">{totalStudents}</p>
            <p className="text-xs text-gray-400 mt-1">재원 {activeStudents}명</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">전체 수업</h3>
              <BookOpen className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-[#081429]">{totalClasses}</p>
            <p className="text-xs text-gray-400 mt-1">운영 중인 수업</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">오늘 수업</h3>
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-[#081429]">{todayClasses.length}</p>
            <p className="text-xs text-gray-400 mt-1">{dayOfWeek}요일 수업</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">강사</h3>
              <UserCheck className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-3xl font-bold text-[#081429]">{teacherStats.length}</p>
            <p className="text-xs text-gray-400 mt-1">활동 중인 강사</p>
          </div>
        </div>

        {/* 강사별 성과 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#081429]" />
            <h2 className="text-lg font-bold text-[#081429]">강사별 성과</h2>
          </div>

          {teacherStats.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>강사 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">강사명</th>
                    <th className="text-center py-3 px-4 text-sm font-bold text-gray-700">담당 수업</th>
                    <th className="text-center py-3 px-4 text-sm font-bold text-gray-700">담당 학생</th>
                    <th className="text-center py-3 px-4 text-sm font-bold text-gray-700">평균 학생/수업</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherStats.map((teacher, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#081429]">{teacher.name}</div>
                      </td>
                      <td className="text-center py-3 px-4 text-gray-600">
                        {teacher.classCount}개
                      </td>
                      <td className="text-center py-3 px-4 text-gray-600">
                        {teacher.studentCount}명
                      </td>
                      <td className="text-center py-3 px-4 text-gray-600">
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
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-[#081429]" />
            <h2 className="text-lg font-bold text-[#081429]">수업 현황</h2>
          </div>

          {classes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>수업 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.slice(0, 12).map(cls => (
                <div
                  key={cls.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-[#fdb813] hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-[#081429]">{cls.className}</h3>
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

                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-4 h-4" />
                      <span>{cls.teacher || cls.mainTeacher || '미지정'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{cls.studentCount || 0}명</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {cls.schedule && cls.schedule.length > 0
                          ? cls.schedule.map(s => s.day).join(', ')
                          : '시간표 미지정'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {classes.length > 12 && (
            <div className="text-center mt-4 text-sm text-gray-500">
              외 {classes.length - 12}개 수업
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
