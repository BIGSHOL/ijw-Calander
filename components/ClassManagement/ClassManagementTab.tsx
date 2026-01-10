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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 헤더 */}
      <div className="bg-[#081429] text-white rounded-lg p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">수업 관리</h1>
              <p className="text-sm text-gray-300 mt-1">
                수업 중심으로 학생과 시간표를 관리합니다
              </p>
            </div>
          </div>
          <button
            className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-5 h-5" />
            새 수업 추가
          </button>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border border-[#081429] border-opacity-10">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-[#081429]" />
          <h2 className="text-[#081429] font-bold text-lg">필터</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 과목 필터 */}
          <div>
            <label className="block text-[#373d41] text-sm font-medium mb-2">
              과목
            </label>
            <select
              value={filters.subject}
              onChange={(e) => setFilters({ ...filters, subject: e.target.value as any })}
              className="w-full px-4 py-2 border border-[#081429] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] text-[#081429]"
            >
              <option value="all">전체</option>
              <option value="math">수학</option>
              <option value="english">영어</option>
            </select>
          </div>

          {/* 강사 필터 */}
          <div>
            <label className="block text-[#373d41] text-sm font-medium mb-2">
              강사
            </label>
            <select
              value={filters.teacher}
              onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}
              className="w-full px-4 py-2 border border-[#081429] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] text-[#081429]"
            >
              <option value="all">전체 강사</option>
              {teachers.map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </div>

          {/* 정렬 */}
          <div>
            <label className="block text-[#373d41] text-sm font-medium mb-2">
              정렬
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
              className="w-full px-4 py-2 border border-[#081429] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] text-[#081429]"
            >
              <option value="name">수업명</option>
              <option value="studentCount">학생 수</option>
              <option value="teacher">강사명</option>
            </select>
          </div>

          {/* 검색 */}
          <div>
            <label className="block text-[#373d41] text-sm font-medium mb-2">
              검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#373d41]" />
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                placeholder="수업명 또는 강사명"
                className="w-full pl-10 pr-4 py-2 border border-[#081429] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] text-[#081429]"
              />
            </div>
          </div>
        </div>

        {/* 결과 카운트 */}
        <div className="mt-4 pt-4 border-t border-[#081429] border-opacity-10">
          <p className="text-[#373d41] text-sm">
            총 <span className="text-[#fdb813] font-semibold">{filteredClasses.length}</span>개 수업
          </p>
        </div>
      </div>

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
