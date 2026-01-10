import React, { useState, useMemo } from 'react';
import { BookOpen, Search, Plus, Filter } from 'lucide-react';
import { useClasses, ClassInfo } from '../../hooks/useClasses';
import ClassList from './ClassList';
import ClassDetailModal from './ClassDetailModal';
import AddClassModal from './AddClassModal';

export interface ClassFilters {
  subject: 'all' | 'math' | 'english';
  teacher: string; // 'all' or teacher name
  searchQuery: string;
  sortBy: 'name' | 'studentCount' | 'teacher';
}

const ClassManagementTab: React.FC = () => {
  // 필터 상태
  const [filters, setFilters] = useState<ClassFilters>({
    subject: 'all',
    teacher: 'all',
    searchQuery: '',
    sortBy: 'name',
  });

  // 선택된 수업 (상세 모달용)
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);

  // 새 수업 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);

  // 데이터 조회 (subject 필터 적용)
  const subjectFilter = filters.subject === 'all' ? undefined : filters.subject;
  const { data: classes, isLoading, error } = useClasses(subjectFilter);

  // 강사 목록 추출 (필터용)
  const teachers = useMemo(() => {
    if (!classes) return [];
    const uniqueTeachers = [...new Set(classes.map(c => c.teacher).filter(Boolean))];
    return uniqueTeachers.sort();
  }, [classes]);

  // 필터링 및 정렬된 수업 목록
  const filteredClasses = useMemo(() => {
    if (!classes) return [];

    let result = [...classes];

    // 강사 필터
    if (filters.teacher !== 'all') {
      result = result.filter(c => c.teacher === filters.teacher);
    }

    // 검색어 필터
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(c =>
        c.className.toLowerCase().includes(query) ||
        c.teacher?.toLowerCase().includes(query)
      );
    }

    // 정렬
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return a.className.localeCompare(b.className, 'ko');
        case 'studentCount':
          return (b.studentCount || 0) - (a.studentCount || 0);
        case 'teacher':
          return (a.teacher || '').localeCompare(b.teacher || '', 'ko');
        default:
          return 0;
      }
    });

    return result;
  }, [classes, filters]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 상단 네비게이션 바 (다른 탭과 동일한 스타일) */}
      <div className="bg-[#081429] h-10 flex items-center justify-between px-6 border-b border-white/10 text-xs z-30">
        <div className="flex items-center gap-3">
          {/* 과목 토글 */}
          <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
            <button
              onClick={() => setFilters({ ...filters, subject: 'all' })}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                filters.subject === 'all'
                  ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              📚 전체
            </button>
            <button
              onClick={() => setFilters({ ...filters, subject: 'math' })}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                filters.subject === 'math'
                  ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              📐 수학
            </button>
            <button
              onClick={() => setFilters({ ...filters, subject: 'english' })}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                filters.subject === 'english'
                  ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              📕 영어
            </button>
          </div>

          {/* 구분선 */}
          <div className="w-px h-4 bg-white/20 mx-1"></div>

          {/* 강사 필터 */}
          {teachers.length > 0 && (
            <select
              value={filters.teacher}
              onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}
              className="appearance-none bg-[#1e293b] border border-gray-700 rounded-md px-3 py-1 pr-7 text-xs font-medium text-white cursor-pointer hover:border-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
            >
              <option value="all">전체 강사</option>
              {teachers.map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          )}

          {/* 구분선 */}
          <div className="w-px h-4 bg-white/20 mx-1"></div>

          {/* 정렬 */}
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
            className="appearance-none bg-[#1e293b] border border-gray-700 rounded-md px-3 py-1 pr-7 text-xs font-medium text-white cursor-pointer hover:border-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
          >
            <option value="name">수업명순</option>
            <option value="studentCount">학생수순</option>
            <option value="teacher">강사명순</option>
          </select>

          {/* 구분선 */}
          <div className="w-px h-4 bg-white/20 mx-1"></div>

          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="수업명, 강사명 검색..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="bg-[#1e293b] border border-gray-700 rounded-md pl-8 pr-3 py-1 text-xs text-white placeholder-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none w-48"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 결과 카운트 */}
          <span className="text-gray-400 text-xs">
            총 <span className="text-[#fdb813] font-bold">{filteredClasses.length}</span>개 수업
          </span>

          {/* 새 수업 추가 버튼 */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#fdb813] text-[#081429] hover:bg-[#e5a60f] transition-colors shadow-sm font-bold"
          >
            <Plus size={14} />
            <span>새 수업</span>
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        {/* 에러 상태 */}
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
            <p className="text-red-800">데이터를 불러오는 중 오류가 발생했습니다.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-4 py-2 rounded font-semibold text-sm"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 수업 목록 */}
        <ClassList
          classes={filteredClasses}
          onClassClick={setSelectedClass}
          isLoading={isLoading}
        />
      </div>

      {/* 수업 상세 모달 */}
      {selectedClass && (
        <ClassDetailModal
          classInfo={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}

      {/* 새 수업 추가 모달 */}
      {showAddModal && (
        <AddClassModal
          onClose={() => setShowAddModal(false)}
          defaultSubject={filters.subject === 'all' ? 'math' : filters.subject}
        />
      )}
    </div>
  );
};

export default ClassManagementTab;
