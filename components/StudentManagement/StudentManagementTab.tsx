import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { UnifiedStudent } from '../../types';
import { useStudents, searchStudentsByQuery } from '../../hooks/useStudents';
import StudentList from './StudentList';
import StudentDetail from './StudentDetail';
import AddStudentModal from './AddStudentModal';
import { Users, Loader2, RefreshCw, UserPlus, ClipboardList, ArrowLeft, Database, Wrench } from 'lucide-react';

// Performance: bundle-dynamic-imports - Modal components lazy load (~80-100KB bundle reduction)
const StudentMigrationModal = lazy(() => import('./StudentMigrationModal'));
const NormalizeStudentIdsModal = lazy(() => import('./NormalizeStudentIdsModal'));

export interface StudentFilters {
  searchQuery: string;
  grade: string;
  status: 'all' | 'prospect' | 'active' | 'on_hold' | 'withdrawn';
  subject: string;
  teacher: string;  // 'all' 또는 선생님 이름
}

interface StudentManagementTabProps {
  filters: StudentFilters;
  sortBy: 'name' | 'grade' | 'startDate';
}

const StudentManagementTab: React.FC<StudentManagementTabProps> = ({ filters, sortBy }) => {
  const { students, loading, error, refreshStudents } = useStudents(true); // includeWithdrawn: true
  const [selectedStudent, setSelectedStudent] = useState<UnifiedStudent | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [oldWithdrawnStudents, setOldWithdrawnStudents] = useState<UnifiedStudent[]>([]);
  const [isSearchingOld, setIsSearchingOld] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showNormalizeIdsModal, setShowNormalizeIdsModal] = useState(false);

  // 선택된 학생 자동 업데이트 (students 배열 변경 시)
  useEffect(() => {
    if (selectedStudent) {
      const updatedStudent = students.find(s => s.id === selectedStudent.id);
      if (updatedStudent) {
        setSelectedStudent(updatedStudent);
      }
    }
  }, [students, selectedStudent?.id]); // selectedStudent 전체가 아닌 id만 의존성으로 추가

  // 검색어가 있고 메모리 결과가 적으면 과거 퇴원생 자동 검색
  useEffect(() => {
    const searchOldWithdrawn = async () => {
      if (!filters.searchQuery || filters.searchQuery.length < 2) {
        setOldWithdrawnStudents([]);
        return;
      }

      // 메모리 필터링 결과 미리 계산
      const query = filters.searchQuery.toLowerCase();
      const memoryResults = students.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.englishName?.toLowerCase().includes(query) ||
          s.school?.toLowerCase().includes(query)
      );

      // 결과가 5개 미만이면 과거 퇴원생 검색
      if (memoryResults.length < 5) {
        setIsSearchingOld(true);
        try {
          const oldResults = await searchStudentsByQuery(filters.searchQuery);
          setOldWithdrawnStudents(oldResults);
        } catch (err) {
          console.error('과거 퇴원생 검색 실패:', err);
          setOldWithdrawnStudents([]);
        } finally {
          setIsSearchingOld(false);
        }
      } else {
        setOldWithdrawnStudents([]);
      }
    };

    // 디바운스 (300ms)
    const timer = setTimeout(searchOldWithdrawn, 300);
    return () => clearTimeout(timer);
  }, [filters.searchQuery, students]);

  // 필터링 및 정렬된 학생 목록 (App.tsx에서 전달받은 필터 사용 + 과거 퇴원생 추가)
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // 검색어 필터
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.englishName?.toLowerCase().includes(query) ||
          s.school?.toLowerCase().includes(query)
      );

      // 과거 퇴원생 추가 (중복 제거)
      const existingIds = new Set(result.map(s => s.id));
      const oldFiltered = oldWithdrawnStudents.filter(s => !existingIds.has(s.id));
      result = [...result, ...oldFiltered];
    }

    // 학년 필터 (초등/중등/고등 전체 선택 지원)
    if (filters.grade !== 'all') {
      if (filters.grade === 'elementary') {
        // 초등학생 전체 (초1~초6)
        result = result.filter((s) => s.grade?.startsWith('초'));
      } else if (filters.grade === 'middle') {
        // 중학생 전체 (중1~중3)
        result = result.filter((s) => s.grade?.startsWith('중'));
      } else if (filters.grade === 'high') {
        // 고등학생 전체 (고1~고3)
        result = result.filter((s) => s.grade?.startsWith('고'));
      } else if (filters.grade === 'other') {
        // 기타 (초/중/고에 해당하지 않는 학년 - 미취학, 재수생 등)
        result = result.filter((s) => {
          const grade = s.grade;
          if (!grade) return true; // 학년 없는 경우
          return !grade.startsWith('초') && !grade.startsWith('중') && !grade.startsWith('고');
        });
      } else {
        // 특정 학년 (초1, 중2, 고3 등)
        result = result.filter((s) => s.grade === filters.grade);
      }
    }

    // 상태 필터 (prospect/prospective 모두 지원, status 없으면 active로 간주)
    if (filters.status !== 'all') {
      result = result.filter((s) => {
        const studentStatus = s.status || 'active';  // status 없으면 재원으로 간주

        if (filters.status === 'prospect') {
          return studentStatus === 'prospect' || studentStatus === 'prospective';
        }

        // on_hold 필터: student.status='on_hold' 또는 모든 enrollments가 onHold=true인 학생
        if (filters.status === 'on_hold') {
          // 1. student.status가 명시적으로 on_hold인 경우
          if (studentStatus === 'on_hold') return true;

          // 2. status는 active지만 모든 enrollments가 onHold인 경우
          const activeEnrollments = s.enrollments?.filter(e => !e.withdrawalDate) || [];
          if (activeEnrollments.length > 0) {
            const allOnHold = activeEnrollments.every(e => e.onHold === true);
            if (allOnHold) return true;
          }

          return false;
        }

        return studentStatus === filters.status;
      });
    }

    // 수강 과목 필터
    if (filters.subject !== 'all') {
      result = result.filter((s) =>
        s.enrollments.some((e) => e.subject === filters.subject)
      );
    }

    // 선생님 필터
    if (filters.teacher !== 'all') {
      result = result.filter((s) =>
        s.enrollments.some((e) => e.teacherId === filters.teacher)
      );
    }

    // 학년 정렬 우선순위 (고3 -> 고1 -> 중3 -> 중1 -> 초6 -> 초1 -> 기타)
    const getGradeOrder = (grade: string | undefined): number => {
      if (!grade) return 999; // 기타 (맨 뒤)
      const gradeMap: Record<string, number> = {
        '고3': 1, '고2': 2, '고1': 3,
        '중3': 4, '중2': 5, '중1': 6,
        '초6': 7, '초5': 8, '초4': 9, '초3': 10, '초2': 11, '초1': 12,
      };
      return gradeMap[grade] ?? 999; // 목록에 없는 학년은 기타로 처리
    };

    // 정렬
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'ko');
      } else if (sortBy === 'grade') {
        const orderA = getGradeOrder(a.grade);
        const orderB = getGradeOrder(b.grade);
        if (orderA !== orderB) return orderA - orderB;
        // 같은 학년이면 이름순
        return a.name.localeCompare(b.name, 'ko');
      } else if (sortBy === 'startDate') {
        return (b.startDate || '').localeCompare(a.startDate || '');
      }
      return 0;
    });

    return result;
  }, [students, filters, sortBy, oldWithdrawnStudents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#fdb813] mx-auto mb-2" />
          <p className="text-gray-600">학생 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-600">
          <p className="font-semibold">오류 발생</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-50">
      {/* 좌측 패널: 학생 목록 - 모바일에서 학생 선택 시 숨김 */}
      <div className={`
        w-full md:w-[28%] md:min-w-[280px] md:max-w-[350px]
        border-r border-gray-300 bg-white flex flex-col
        ${selectedStudent ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="p-3 border-b border-gray-200 bg-[#081429] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#fdb813]" />
            <span className="text-sm font-bold text-white">학생 목록</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={() => setShowNormalizeIdsModal(true)}
              className="p-1.5 text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1"
              title="학생 ID 정규화"
            >
              <Wrench className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowMigrationModal(true)}
              className="p-1.5 text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1"
              title="데이터 가져오기"
            >
              <Database className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsAddStudentModalOpen(true)}
              className="p-1.5 text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1"
              title="학생 추가"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await refreshStudents();
                setIsRefreshing(false);
              }}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="새로고침"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">
              {filteredStudents.length}/{students.length}명
            </span>
          </div>
        </div>
        {/* 과거 퇴원생 검색 중 안내 */}
        {isSearchingOld && (
          <div className="p-2 bg-[#081429] border-b border-[#373d41]/20">
            <p className="text-xs text-[#fdb813] flex items-center gap-1.5 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              과거 퇴원생 검색 중...
            </p>
          </div>
        )}

        {/* 과거 퇴원생 검색 결과 안내 */}
        {oldWithdrawnStudents.length > 0 && !isSearchingOld && (
          <div className="p-2 bg-[#fdb813]/10 border-b border-[#fdb813]/20">
            <p className="text-xs text-[#081429] font-medium">
              <ClipboardList className="inline-block w-4 h-4 mr-1" />
              과거 퇴원생 {oldWithdrawnStudents.length}명 포함됨 (90일 이전)
            </p>
          </div>
        )}

        <StudentList
          students={filteredStudents}
          selectedStudent={selectedStudent}
          onSelectStudent={setSelectedStudent}
        />
      </div>

      {/* 우측 패널: 학생 상세 정보 - 모바일에서 학생 선택 시 전체 표시 */}
      <div className={`
        flex-1 bg-white flex flex-col
        ${selectedStudent ? 'flex' : 'hidden md:flex'}
      `}>
        {selectedStudent ? (
          <>
            {/* 모바일 전용 뒤로가기 버튼 */}
            <div className="md:hidden p-2 border-b border-gray-200 bg-[#081429]">
              <button
                onClick={() => setSelectedStudent(null)}
                className="flex items-center gap-2 text-white hover:text-[#fdb813] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">목록으로</span>
              </button>
            </div>
            <StudentDetail student={selectedStudent} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center p-4">
              <Users className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 opacity-50" />
              <p className="text-base md:text-lg">학생을 선택하세요</p>
              <p className="text-xs md:text-sm mt-2">좌측 목록에서 학생을 클릭하면 상세 정보가 표시됩니다</p>
            </div>
          </div>
        )}
      </div>

      {/* 학생 추가 모달 */}
      <AddStudentModal
        isOpen={isAddStudentModalOpen}
        onClose={() => setIsAddStudentModalOpen(false)}
        onSuccess={() => {
          refreshStudents();
          setIsAddStudentModalOpen(false);
        }}
      />

      {/* 학생 데이터 마이그레이션 모달 */}
      {showMigrationModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
          <StudentMigrationModal
            onClose={() => {
              refreshStudents();
              setShowMigrationModal(false);
            }}
          />
        </Suspense>
      )}

      {/* 학생 ID 정규화 모달 */}
      {showNormalizeIdsModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
          <NormalizeStudentIdsModal
            onClose={() => {
              refreshStudents();
              setShowNormalizeIdsModal(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default StudentManagementTab;
