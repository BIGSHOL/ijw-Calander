import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { UnifiedStudent, UserProfile } from '../../types';
import { useStudents, searchStudentsByQuery } from '../../hooks/useStudents';
import { usePermissions } from '../../hooks/usePermissions';
import { StudentFilters } from '../../hooks/useAppState';
import { useStudentFilters } from '../../hooks/useStudentFilters';
import StudentList from './StudentList';
import StudentDetail from './StudentDetail';
import AddStudentModal from './AddStudentModal';
import { Users, Loader2, RefreshCw, UserPlus, ClipboardList, ArrowLeft, Database, GitMerge, Trash2, AlertTriangle, Languages, Download } from 'lucide-react';

// Performance: bundle-dynamic-imports - Modal components lazy load (~80-100KB bundle reduction)
const StudentMigrationModal = lazy(() => import('./StudentMigrationModal'));
const StudentMergeModal = lazy(() => import('./StudentMergeModal'));
const StudentDataCleanupModal = lazy(() => import('./StudentDataCleanupModal'));
const DuplicateNamesViewModal = lazy(() => import('./DuplicateNamesViewModal'));
const BulkEnglishNameUpdateModal = lazy(() => import('./BulkEnglishNameUpdateModal'));

export type SearchField =
  | 'all'           // 전체
  | 'name'          // 이름
  | 'phone'         // 전화번호 (학생/보호자/집)
  | 'school'        // 학교
  | 'address'       // 주소
  | 'parent'        // 보호자
  | 'memo'          // 메모
  | 'email'         // 이메일
  | 'etc';          // 기타 (생년월일, 기타항목, 퇴원사유 등)

interface StudentManagementTabProps {
  filters: StudentFilters;
  sortBy: 'name' | 'grade' | 'startDate';
  currentUser?: UserProfile | null;
  initialSelectedStudentId?: string;  // 다른 탭에서 이동 시 자동 선택할 학생 ID
  onStudentSelected?: () => void;      // 학생 선택 후 콜백 (initialSelectedStudentId 초기화용)
}

const StudentManagementTab: React.FC<StudentManagementTabProps> = ({ filters, sortBy, currentUser, initialSelectedStudentId, onStudentSelected }) => {
  const { hasPermission } = usePermissions(currentUser);
  const isMaster = currentUser?.role === 'master';
  const canView = isMaster || hasPermission('students.view');
  const canEdit = isMaster || hasPermission('students.edit');
  const canManageEnrollment = isMaster || hasPermission('classes.edit');  // 수강배정은 수업 관리 권한 필요

  const { students, loading, error, refreshStudents } = useStudents(true); // includeWithdrawn: true
  const [selectedStudent, setSelectedStudent] = useState<UnifiedStudent | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [oldWithdrawnStudents, setOldWithdrawnStudents] = useState<UnifiedStudent[]>([]);
  const [isSearchingOld, setIsSearchingOld] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showDuplicateNamesModal, setShowDuplicateNamesModal] = useState(false);
  const [showBulkEnglishNameModal, setShowBulkEnglishNameModal] = useState(false);

  // 선택된 학생 자동 업데이트 (students 배열 변경 시)
  useEffect(() => {
    if (selectedStudent) {
      const updatedStudent = students.find(s => s.id === selectedStudent.id);
      if (updatedStudent) {
        setSelectedStudent(updatedStudent);
      }
    }
  }, [students, selectedStudent?.id]); // selectedStudent 전체가 아닌 id만 의존성으로 추가

  // 다른 탭에서 이동 시 학생 자동 선택 (initialSelectedStudentId 사용)
  useEffect(() => {
    if (initialSelectedStudentId && students.length > 0) {
      const targetStudent = students.find(s => s.id === initialSelectedStudentId);
      if (targetStudent) {
        setSelectedStudent(targetStudent);
        onStudentSelected?.(); // 콜백 호출하여 initialSelectedStudentId 초기화
      }
    }
  }, [initialSelectedStudentId, students, onStudentSelected]);

  // 검색어가 있고 메모리 결과가 적으면 과거 퇴원생 자동 검색
  useEffect(() => {
    const searchOldWithdrawn = async () => {
      if (!filters.searchQuery || filters.searchQuery.length < 2) {
        setOldWithdrawnStudents([]);
        return;
      }

      // 메모리 필터링 결과 미리 계산 (searchField 반영)
      const query = filters.searchQuery.toLowerCase();
      const field = filters.searchField || 'all';
      const memoryResults = students.filter((s) => {
        switch (field) {
          case 'name':
            return (s.name || '').toLowerCase().includes(query) ||
              s.englishName?.toLowerCase().includes(query) ||
              s.nickname?.toLowerCase().includes(query);
          case 'phone':
            return s.studentPhone?.includes(query) ||
              s.parentPhone?.includes(query) ||
              s.homePhone?.includes(query);
          case 'school':
            return s.school?.toLowerCase().includes(query);
          case 'all':
          default:
            return (s.name || '').toLowerCase().includes(query) ||
              s.englishName?.toLowerCase().includes(query) ||
              s.school?.toLowerCase().includes(query) ||
              s.memo?.toLowerCase().includes(query) ||
              s.parentName?.toLowerCase().includes(query);
        }
      });

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
  }, [filters.searchQuery, filters.searchField, students]);

  // 필터링 및 정렬된 학생 목록
  // OPTIMIZATION: Vercel React Best Practices (rerender-derived-state)
  // - 250+ 줄 useMemo → useStudentFilters 커스텀 훅으로 분리
  // - 각 필터가 독립적으로 메모이제이션되어 불필요한 재계산 방지
  const filteredStudents = useStudentFilters(students, filters, sortBy, oldWithdrawnStudents);

  // 필터링된 학생 이름 내보내기
  const handleExportNames = () => {
    const names = filteredStudents.map(s => s.name).filter(Boolean).join('\n');
    const blob = new Blob([names], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `학생명단_${filteredStudents.length}명_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-2" />
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
        border-r border-gray-300 bg-white flex flex-col min-h-0 overflow-hidden
        ${selectedStudent ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="p-3 border-b border-gray-200 bg-primary flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-white">학생 목록</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            {isMaster && (
              <>
                <button
                  onClick={() => setShowMigrationModal(true)}
                  className="p-1.5 text-white hover:bg-white/10 rounded-sm transition-colors flex items-center gap-1"
                  title="데이터 가져오기"
                >
                  <Database className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowMergeModal(true)}
                  className="p-1.5 text-white hover:bg-white/10 rounded-sm transition-colors flex items-center gap-1"
                  title="중복 학생 병합"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowDuplicateNamesModal(true)}
                  className="p-1.5 text-amber-400 hover:bg-white/10 rounded-sm transition-colors flex items-center gap-1"
                  title="중복 이름 확인"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowCleanupModal(true)}
                  className="p-1.5 text-orange-400 hover:bg-white/10 rounded-sm transition-colors flex items-center gap-1"
                  title="데이터 정리 (숫자 ID 삭제)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowBulkEnglishNameModal(true)}
                  className="p-1.5 text-accent hover:bg-white/10 rounded-sm transition-colors flex items-center gap-1"
                  title="일괄 영어이름 업데이트"
                >
                  <Languages className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {canEdit && (
              <button
                onClick={() => setIsAddStudentModalOpen(true)}
                className="p-1.5 text-white hover:bg-white/10 rounded-sm transition-colors flex items-center gap-1"
                title="학생 추가"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleExportNames}
              className="p-1.5 text-emerald-400 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
              title="이름 내보내기"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await refreshStudents();
                setIsRefreshing(false);
              }}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
              title="새로고침"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-sm">
              {filteredStudents.length}/{students.length}명
            </span>
          </div>
        </div>
        {/* 과거 퇴원생 검색 중 안내 */}
        {isSearchingOld && (
          <div className="p-2 bg-primary border-b border-primary-700/20">
            <p className="text-xs text-accent flex items-center gap-1.5 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              과거 퇴원생 검색 중...
            </p>
          </div>
        )}

        {/* 과거 퇴원생 검색 결과 안내 */}
        {oldWithdrawnStudents.length > 0 && !isSearchingOld && (
          <div className="p-2 bg-accent/10 border-b border-accent/20">
            <p className="text-xs text-primary font-medium">
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
            <div className="md:hidden p-2 border-b border-gray-200 bg-primary">
              <button
                onClick={() => setSelectedStudent(null)}
                className="flex items-center gap-2 text-white hover:text-accent transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">목록으로</span>
              </button>
            </div>
            <StudentDetail student={selectedStudent} readOnly={!canEdit} currentUser={currentUser} />
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

      {/* 중복 학생 병합 모달 */}
      {showMergeModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
          <StudentMergeModal
            onClose={() => {
              refreshStudents();
              setShowMergeModal(false);
            }}
          />
        </Suspense>
      )}

      {/* 데이터 정리 모달 (숫자 ID 삭제) */}
      {showCleanupModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
          <StudentDataCleanupModal
            students={students}
            onClose={() => {
              refreshStudents();
              setShowCleanupModal(false);
            }}
          />
        </Suspense>
      )}

      {/* 중복 이름 확인 모달 */}
      {showDuplicateNamesModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
          <DuplicateNamesViewModal
            students={students}
            onRefresh={refreshStudents}
            onClose={() => {
              refreshStudents();
              setShowDuplicateNamesModal(false);
            }}
          />
        </Suspense>
      )}

      {/* 일괄 영어이름 업데이트 모달 */}
      {showBulkEnglishNameModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
          <BulkEnglishNameUpdateModal
            students={students}
            onClose={() => {
              refreshStudents();
              setShowBulkEnglishNameModal(false);
            }}
          />
        </Suspense>
      )}

    </div>
  );
};

export default StudentManagementTab;
