import React, { useState, useEffect } from 'react';
import { UserProfile, StaffMember } from '../../../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DashboardHeader from '../DashboardHeader';
import { BookOpen, Users, Calendar, CheckSquare, Clock } from 'lucide-react';

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
}

interface MyStudent {
  id: string;
  name: string;
  englishName?: string;
  grade?: string;
  school?: string;
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
      // 1. 내 수업 로드 (teacher 또는 mainTeacher가 나인 수업)
      const classesRef = collection(db, 'classes');

      // 영어 이름으로 검색
      const q1 = query(classesRef, where('teacher', '==', teacherName));
      const snapshot1 = await getDocs(q1);

      // 한글 이름으로도 검색 (mainTeacher에 한글 이름이 저장될 수 있음)
      let snapshot2: any = { docs: [] };
      if (teacherKoreanName) {
        const q2 = query(classesRef, where('mainTeacher', '==', teacherKoreanName));
        snapshot2 = await getDocs(q2);
      }

      const classesMap = new Map<string, MyClass>();

      [...snapshot1.docs, ...snapshot2.docs].forEach(doc => {
        const data = doc.data();
        if (!classesMap.has(doc.id)) {
          classesMap.set(doc.id, {
            id: doc.id,
            className: data.className,
            subject: data.subject,
            schedule: data.schedule || [],
          });
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
              {myClasses.map(cls => (
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
                      <Users className="w-4 h-4" />
                      <span>{cls.studentCount || 0}명</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {cls.schedule.length > 0
                          ? cls.schedule.map(s => s.day).join(', ')
                          : '시간표 미지정'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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
