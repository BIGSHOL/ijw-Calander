import React, { useState, useEffect, useMemo } from 'react';
import { UnifiedStudent, Teacher } from '../../../types';
import { BookOpen, User, Calendar, Loader2, Plus } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import AssignClassModal from '../AssignClassModal';
import { useStudents } from '../../../hooks/useStudents';

interface CoursesTabProps {
  student: UnifiedStudent;
}

interface GroupedEnrollment {
  className: string;
  subject: 'math' | 'english';
  teachers: string[];  // 담당 강사 배열
  days: string[];      // 모든 수업 요일 합침 (중복 제거)
}

const CoursesTab: React.FC<CoursesTabProps> = ({ student }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const { refreshStudents } = useStudents();

  // Teachers 컬렉션 조회
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const q = query(collection(db, '강사목록'));
        const snapshot = await getDocs(q);
        const teacherList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Teacher));
        setTeachers(teacherList);
      } catch (error) {
        console.error('강사 목록 조회 오류:', error);
      } finally {
        setLoadingTeachers(false);
      }
    };

    fetchTeachers();
  }, []);

  // 같은 수업(className)끼리 그룹화
  const groupedEnrollments = useMemo(() => {
    const groups = new Map<string, GroupedEnrollment>();

    (student.enrollments || []).forEach(enrollment => {
      const key = enrollment.className;

      if (groups.has(key)) {
        const existing = groups.get(key)!;
        // 강사 추가 (중복 제거)
        if (!existing.teachers.includes(enrollment.teacherId)) {
          existing.teachers.push(enrollment.teacherId);
        }
        // 요일 추가 (중복 제거)
        enrollment.days?.forEach(day => {
          if (!existing.days.includes(day)) {
            existing.days.push(day);
          }
        });
      } else {
        groups.set(key, {
          className: enrollment.className,
          subject: enrollment.subject,
          teachers: [enrollment.teacherId],
          days: [...(enrollment.days || [])]
        });
      }
    });

    return Array.from(groups.values());
  }, [student.enrollments]);

  // 과목별 담임 강사 결정
  const determineMainTeacherBySubject = (subject: 'math' | 'english') => {
    const teacherCounts: Record<string, number> = {};

    (student.enrollments || [])
      .filter(e => e.subject === subject)
      .forEach(enrollment => {
        const teacherName = enrollment.teacherId;
        // isHidden 강사는 담임 계산에서 제외
        const teacherData = teachers.find(t => t.name === teacherName);
        if (teacherData?.isHidden) return;

        const dayCount = enrollment.days?.length || 0;
        teacherCounts[teacherName] = (teacherCounts[teacherName] || 0) + dayCount;
      });

    const teacherEntries = Object.entries(teacherCounts);
    if (teacherEntries.length === 0) return null;

    // 최대 수업 횟수 찾기
    const maxCount = Math.max(...teacherEntries.map(([, count]) => count));
    const topTeachers = teacherEntries.filter(([, count]) => count === maxCount);

    // 1명이면 바로 담임
    if (topTeachers.length === 1) {
      return topTeachers[0][0];
    }

    // 동점이면 원어민이 아닌 강사 우선
    const nonNativeTopTeachers = topTeachers.filter(([name]) => {
      const teacherData = teachers.find(t => t.name === name);
      return !teacherData?.isNative;
    });

    if (nonNativeTopTeachers.length > 0) {
      return nonNativeTopTeachers[0][0];
    }

    return topTeachers[0][0];
  };

  // 영어: 같은 수업(className) 내에서 담임 강사 결정
  const determineMainTeacherForEnglishClass = (group: GroupedEnrollment) => {
    const teacherCounts: Record<string, number> = {};

    student.enrollments
      .filter(e => e.className === group.className)
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

    if (topTeachers.length === 1) {
      return topTeachers[0][0];
    }

    const nonNativeTopTeachers = topTeachers.filter(([name]) => {
      const teacherData = teachers.find(t => t.name === name);
      return !teacherData?.isNative;
    });

    if (nonNativeTopTeachers.length > 0) {
      return nonNativeTopTeachers[0][0];
    }

    return topTeachers[0][0];
  };

  // 수학: 과목 전체에서 담임/부담임 구분
  const getMathTeacherInfo = (group: GroupedEnrollment) => {
    const visibleTeachers = group.teachers.filter(name => {
      const teacher = teachers.find(t => t.name === name);
      return !teacher?.isHidden;
    });

    const mathMainTeacher = determineMainTeacherBySubject('math');

    // 담임을 맨 앞으로 정렬
    const sortedTeachers = [...visibleTeachers].sort((a, b) => {
      if (a === mathMainTeacher) return -1;
      if (b === mathMainTeacher) return 1;
      return 0;
    });

    return {
      teachers: sortedTeachers,
      mainTeacher: mathMainTeacher,
      isMainTeacherInClass: visibleTeachers.includes(mathMainTeacher || '')
    };
  };

  // 영어: 같은 수업 내에서 담임/부담임 구분
  const getEnglishTeacherInfo = (group: GroupedEnrollment) => {
    const visibleTeachers = group.teachers.filter(name => {
      const teacher = teachers.find(t => t.name === name);
      return !teacher?.isHidden;
    });

    const mainTeacher = determineMainTeacherForEnglishClass(group);
    const subTeachers = visibleTeachers.filter(name => name !== mainTeacher);

    return { mainTeacher, subTeachers };
  };

  const handleAssignSuccess = () => {
    refreshStudents();
  };

  if (student.enrollments.length === 0) {
    return (
      <>
        <div className="text-center py-12 text-gray-500">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">수강 중인 강좌가 없습니다</p>
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="mt-4 px-4 py-2 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:bg-[#fdb813]/90 transition-colors inline-flex items-center gap-2"
          >
            <Plus size={16} />
            <span>수업 배정하기</span>
          </button>
        </div>
        <AssignClassModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          student={student}
          onSuccess={handleAssignSuccess}
        />
      </>
    );
  }

  if (loadingTeachers) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // 과목별로 그룹화
  const mathClasses = groupedEnrollments
    .filter(g => g.subject === 'math')
    .sort((a, b) => {
      // 담임 선생님이 있는 수업을 위로 올림
      const { isMainTeacherInClass: aIsMain } = getMathTeacherInfo(a);
      const { isMainTeacherInClass: bIsMain } = getMathTeacherInfo(b);
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return 0;
    });
  const englishClasses = groupedEnrollments.filter(g => g.subject === 'english');

  return (
    <>
      <div className="space-y-4">
        {/* 수업 배정 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="px-4 py-2 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:bg-[#fdb813]/90 transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} />
            <span>수업 배정</span>
          </button>
        </div>

        {/* 수학 과목 카드 */}
      {mathClasses.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-blue-200 shadow-sm">
          <div className="p-4 bg-blue-50 border-b-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-blue-800">수학</h3>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-300 font-semibold">
                {mathClasses.length}개 수업
              </span>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {mathClasses.map((group, index) => {
              const { teachers, mainTeacher, isMainTeacherInClass } = getMathTeacherInfo(group);

              return (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-800">{group.className}</h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* 강사 목록 (담임/부담임 구분) */}
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-gray-500" />
                      <span className="text-gray-600">강사:</span>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {teachers.map((teacherName, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className={`${teacherName === mainTeacher ? 'text-gray-800 font-semibold' : 'text-gray-700'}`}>
                              {teacherName}
                            </span>
                            {teacherName === mainTeacher && (
                              <span className="text-micro bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded font-bold">
                                담임
                              </span>
                            )}
                            {teacherName !== mainTeacher && (
                              <span className="text-micro bg-gray-100 text-gray-600 px-1 py-0.5 rounded font-bold">
                                부담임
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 수업 요일 */}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span className="text-gray-600">요일:</span>
                      <div className="flex flex-wrap gap-1">
                        {[...group.days].sort((a, b) => {
                          const order = ['월', '화', '수', '목', '금', '토', '일'];
                          return order.indexOf(a) - order.indexOf(b);
                        }).map((day, idx) => (
                          <span
                            key={idx}
                            className="text-xxs px-1.5 py-0.5 bg-white text-gray-700 rounded border border-gray-300"
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 영어 과목 카드 */}
      {englishClasses.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-green-200 shadow-sm">
          <div className="p-4 bg-green-50 border-b-2 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-bold text-green-800">영어</h3>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-300 font-semibold">
                {englishClasses.length}개 수업
              </span>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {englishClasses.map((group, index) => {
              const { mainTeacher, subTeachers } = getEnglishTeacherInfo(group);

              return (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-800">{group.className}</h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* 담임 강사 */}
                    {mainTeacher && (
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600">담임:</span>
                        <span className="text-gray-800 font-semibold">{mainTeacher}</span>
                        <span className="text-micro bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded font-bold">
                          담임
                        </span>
                      </div>
                    )}

                    {/* 부담임 강사 */}
                    {subTeachers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600">부담임:</span>
                        <span className="text-gray-700">
                          {subTeachers.join(', ')}
                        </span>
                      </div>
                    )}

                    {/* 수업 요일 */}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span className="text-gray-600">요일:</span>
                      <div className="flex flex-wrap gap-1">
                        {[...group.days].sort((a, b) => {
                          const order = ['월', '화', '수', '목', '금', '토', '일'];
                          return order.indexOf(a) - order.indexOf(b);
                        }).map((day, idx) => (
                          <span
                            key={idx}
                            className="text-xxs px-1.5 py-0.5 bg-white text-gray-700 rounded border border-gray-300"
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 추가 기능 안내 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>향후 추가 예정:</strong> 출석률, 수강 기간, 성적 정보 등이 표시됩니다.
        </p>
      </div>
    </div>

    {/* 수업 배정 모달 */}
    <AssignClassModal
      isOpen={isAssignModalOpen}
      onClose={() => setIsAssignModalOpen(false)}
      student={student}
      onSuccess={handleAssignSuccess}
    />
  </>
  );
};

export default CoursesTab;
