import React, { useState, useEffect, useMemo } from 'react';
import { UnifiedStudent, Teacher } from '../../../types';
import { BookOpen, User, Calendar, Loader2 } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

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

    student.enrollments.forEach(enrollment => {
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

  // 담임 강사 결정 (영어 시간표 로직과 동일)
  const determineMainTeacher = (group: GroupedEnrollment) => {
    // 각 강사별 수업 횟수 계산 (isHidden 강사 제외)
    const teacherCounts: Record<string, number> = {};

    student.enrollments
      .filter(e => e.className === group.className)
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

  // isHidden이 아닌 강사만 필터링하고 담임/부담임 구분
  const getTeacherInfo = (group: GroupedEnrollment) => {
    const visibleTeachers = group.teachers.filter(name => {
      const teacher = teachers.find(t => t.name === name);
      return !teacher?.isHidden;
    });

    const mainTeacher = determineMainTeacher(group);
    const subTeachers = visibleTeachers.filter(name => name !== mainTeacher);

    return { mainTeacher, subTeachers };
  };

  if (student.enrollments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">수강 중인 강좌가 없습니다</p>
      </div>
    );
  }

  if (loadingTeachers) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          수강 중인 강좌 ({groupedEnrollments.length}개)
        </h3>
      </div>

      {groupedEnrollments.map((group, index) => {
        const subjectInfo =
          group.subject === 'math'
            ? { label: '수학', color: 'bg-blue-100 text-blue-800 border-blue-200' }
            : { label: '영어', color: 'bg-green-100 text-green-800 border-green-200' };

        const { mainTeacher, subTeachers } = getTeacherInfo(group);

        return (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-gray-600" />
                  <h4 className="text-base font-semibold text-gray-800">
                    {group.className}
                  </h4>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border ${subjectInfo.color}`}>
                  {subjectInfo.label}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* 담임 강사 */}
              {mainTeacher && (
                <div className="flex items-start">
                  <div className="flex items-center gap-2 w-1/3 text-gray-600">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">담임 강사</span>
                  </div>
                  <div className="w-2/3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-800 font-semibold">{mainTeacher}</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">
                        담임
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 부담임 강사 */}
              {subTeachers.length > 0 && (
                <div className="flex items-start">
                  <div className="flex items-center gap-2 w-1/3 text-gray-600">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">부담임</span>
                  </div>
                  <div className="w-2/3">
                    <div className="flex flex-wrap gap-2">
                      {subTeachers.map((teacherName, idx) => (
                        <span key={idx} className="text-sm text-gray-600">
                          {teacherName}
                          {idx < subTeachers.length - 1 && ','}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 수업 요일 */}
              <div className="flex items-start">
                <div className="flex items-center gap-2 w-1/3 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">수업 요일</span>
                </div>
                <div className="w-2/3">
                  <div className="flex flex-wrap gap-1">
                    {group.days && group.days.length > 0 ? (
                      group.days.map((day, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                        >
                          {day}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400 italic">요일 정보 없음</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 추가 기능 안내 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>향후 추가 예정:</strong> 출석률, 수강 기간, 성적 정보 등이 표시됩니다.
        </p>
      </div>
    </div>
  );
};

export default CoursesTab;
