import React, { useState, useMemo } from 'react';
import { UnifiedStudent } from '../../../types';
import { BookOpen, Plus, User, X, Loader2 } from 'lucide-react';
import AssignClassModal from '../AssignClassModal';
import { useStudents } from '../../../hooks/useStudents';
import { useTeachers } from '../../../hooks/useFirebaseQueries';
import { ClassInfo } from '../../../hooks/useClasses';
import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../../utils/styleUtils';
import ClassDetailModal from '../../ClassManagement/ClassDetailModal';
import { doc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';

interface CoursesTabProps {
  student: UnifiedStudent;
}

interface GroupedEnrollment {
  className: string;
  subject: 'math' | 'english';
  teachers: string[];
  days: string[];
  enrollmentIds: string[]; // 삭제를 위해 enrollment ID 저장
}

const CoursesTab: React.FC<CoursesTabProps> = ({ student }) => {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [deletingClass, setDeletingClass] = useState<string | null>(null);
  const { refreshStudents } = useStudents();
  const { data: teachers = [], isLoading: loadingTeachers } = useTeachers();
  const queryClient = useQueryClient();

  // 디버그 로그
  console.log('[CoursesTab] Student:', student.id, student.name);
  console.log('[CoursesTab] Enrollments:', student.enrollments);

  // 같은 수업(className)끼리 그룹화
  const groupedEnrollments = useMemo(() => {
    const groups = new Map<string, GroupedEnrollment>();

    (student.enrollments || []).forEach(enrollment => {
      const key = `${enrollment.subject}_${enrollment.className}`;

      if (groups.has(key)) {
        const existing = groups.get(key)!;
        if (!existing.teachers.includes(enrollment.teacherId)) {
          existing.teachers.push(enrollment.teacherId);
        }
        enrollment.days?.forEach(day => {
          if (!existing.days.includes(day)) {
            existing.days.push(day);
          }
        });
        // enrollment ID 추가
        if ((enrollment as any).id && !existing.enrollmentIds.includes((enrollment as any).id)) {
          existing.enrollmentIds.push((enrollment as any).id);
        }
      } else {
        groups.set(key, {
          className: enrollment.className,
          subject: enrollment.subject,
          teachers: [enrollment.teacherId],
          days: [...(enrollment.days || [])],
          enrollmentIds: (enrollment as any).id ? [(enrollment as any).id] : []
        });
      }
    });

    return Array.from(groups.values());
  }, [student.enrollments]);

  // 수업의 대표 강사 결정
  const getMainTeacher = (group: GroupedEnrollment): string | null => {
    const teacherCounts: Record<string, number> = {};

    student.enrollments
      .filter(e => e.subject === group.subject && e.className === group.className)
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

    if (topTeachers.length === 1) return topTeachers[0][0];

    const nonNativeTeachers = topTeachers.filter(([name]) => {
      const teacherData = teachers.find(t => t.name === name);
      return !teacherData?.isNative;
    });

    return nonNativeTeachers.length > 0 ? nonNativeTeachers[0][0] : topTeachers[0][0];
  };

  // 수업 클릭 시 ClassDetailModal용 ClassInfo 생성
  const handleClassClick = (group: GroupedEnrollment) => {
    const mainTeacher = getMainTeacher(group);
    const classInfo: ClassInfo = {
      id: `${group.subject}_${group.className}`,
      className: group.className,
      subject: group.subject,
      teacher: mainTeacher || group.teachers[0] || '',
      schedule: group.days.map(day => `${day}`),
      studentCount: 0,
    };
    setSelectedClass(classInfo);
  };

  // 수업 배정 취소 (해당 학생의 enrollment만 삭제)
  const handleRemoveEnrollment = async (group: GroupedEnrollment, e: React.MouseEvent) => {
    e.stopPropagation(); // 행 클릭 이벤트 전파 방지

    const confirmMsg = `"${group.className}" 수업에서 ${student.name} 학생을 제외하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    const key = `${group.subject}_${group.className}`;
    setDeletingClass(key);

    try {
      // 1. 저장된 enrollmentIds가 있으면 사용
      if (group.enrollmentIds.length > 0) {
        for (const enrollmentId of group.enrollmentIds) {
          await deleteDoc(doc(db, `students/${student.id}/enrollments`, enrollmentId));
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
          await deleteDoc(docSnap.ref);
        }
      }

      // 캐시 무효화 및 새로고침
      queryClient.invalidateQueries({ queryKey: ['students'] });
      refreshStudents();

    } catch (err) {
      console.error('수업 배정 취소 오류:', err);
      alert('수업 배정 취소에 실패했습니다.');
    } finally {
      setDeletingClass(null);
    }
  };

  const handleAssignSuccess = () => {
    refreshStudents();
  };

  // 요일 정렬 헬퍼
  const sortDays = (days: string[]) => {
    const order = ['월', '화', '수', '목', '금', '토', '일'];
    return [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  };

  if (loadingTeachers) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#fdb813] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500">수업 정보 불러오는 중...</p>
      </div>
    );
  }

  // 과목별 분류
  const mathClasses = groupedEnrollments.filter(g => g.subject === 'math');
  const englishClasses = groupedEnrollments.filter(g => g.subject === 'english');

  // 수업 행 렌더링 함수
  const renderClassRow = (group: GroupedEnrollment, index: number) => {
    const mainTeacher = getMainTeacher(group);
    const visibleTeachers = group.teachers.filter(name => {
      const teacher = teachers.find(t => t.name === name);
      return !teacher?.isHidden;
    });
    const subjectColor = SUBJECT_COLORS[group.subject];
    const key = `${group.subject}_${group.className}`;
    const isDeleting = deletingClass === key;

    return (
      <div
        key={`${group.subject}-${index}`}
        onClick={() => !isDeleting && handleClassClick(group)}
        className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 hover:bg-[#fdb813]/5 transition-colors ${isDeleting ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        {/* 과목 뱃지 */}
        <span
          className="w-12 shrink-0 text-xs px-2 py-1 rounded font-semibold text-center"
          style={{
            backgroundColor: subjectColor.bg,
            color: subjectColor.text,
          }}
        >
          {SUBJECT_LABELS[group.subject]}
        </span>

        {/* 수업명 */}
        <span className="flex-1 text-sm text-[#081429] truncate font-medium">
          {group.className}
        </span>

        {/* 강사 */}
        <div className="w-24 shrink-0 flex items-center gap-1">
          <User className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm text-[#373d41] truncate">
            {mainTeacher || visibleTeachers[0] || '-'}
          </span>
        </div>

        {/* 요일 */}
        <div className="w-16 shrink-0 text-sm text-[#373d41] text-right">
          {sortDays(group.days).join(' ')}
        </div>

        {/* 삭제 버튼 */}
        <button
          onClick={(e) => handleRemoveEnrollment(group, e)}
          disabled={isDeleting}
          className="w-8 h-8 shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          title="수업 배정 취소"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-[#081429]">수강 중인 수업</h3>
          <p className="text-sm text-[#373d41] mt-1">
            총 {groupedEnrollments.length}개 수업
          </p>
        </div>
        <button
          onClick={() => setIsAssignModalOpen(true)}
          className="bg-[#fdb813] text-[#081429] px-4 py-2 rounded-lg font-semibold hover:bg-[#e5a711] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          수업 배정
        </button>
      </div>

      {/* 수업 목록 - 행 스타일 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-[#373d41]">
          <span className="w-12 shrink-0">과목</span>
          <span className="flex-1">수업명</span>
          <span className="w-24 shrink-0">강사</span>
          <span className="w-16 shrink-0 text-right">요일</span>
          <span className="w-8 shrink-0"></span>
        </div>

        {groupedEnrollments.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">수강 중인 수업이 없습니다</p>
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + 수업 배정하기
            </button>
          </div>
        ) : (
          <div>
            {/* 수학 수업 */}
            {mathClasses.map((group, index) => renderClassRow(group, index))}

            {/* 영어 수업 */}
            {englishClasses.map((group, index) => renderClassRow(group, index))}
          </div>
        )}
      </div>

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
    </div>
  );
};

export default CoursesTab;
