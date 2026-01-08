import React, { useState, useMemo } from 'react';
import { UnifiedStudent } from '../../types';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';

interface StudentListProps {
  students: UnifiedStudent[];
  selectedStudent: UnifiedStudent | null;
  onSelectStudent: (student: UnifiedStudent) => void;
}

interface StudentFilters {
  searchQuery: string;
  grade: string;
  status: 'all' | 'active' | 'on_hold' | 'withdrawn';
  subject: string;
}

const StudentList: React.FC<StudentListProps> = ({
  students,
  selectedStudent,
  onSelectStudent,
}) => {
  const [filters, setFilters] = useState<StudentFilters>({
    searchQuery: '',
    grade: 'all',
    status: 'all',
    subject: 'all',
  });
  const [sortBy, setSortBy] = useState<'name' | 'grade' | 'startDate'>('name');
  const [showFilters, setShowFilters] = useState(false);

  // 필터링 및 정렬된 학생 목록
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
    }

    // 학년 필터
    if (filters.grade !== 'all') {
      result = result.filter((s) => s.grade === filters.grade);
    }

    // 상태 필터
    if (filters.status !== 'all') {
      result = result.filter((s) => s.status === filters.status);
    }

    // 수강 과목 필터
    if (filters.subject !== 'all') {
      result = result.filter((s) =>
        s.enrollments.some((e) => e.subject === filters.subject)
      );
    }

    // 정렬
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'grade') {
        const gradeA = a.grade || '';
        const gradeB = b.grade || '';
        return gradeA.localeCompare(gradeB);
      } else if (sortBy === 'startDate') {
        return (b.startDate || '').localeCompare(a.startDate || '');
      }
      return 0;
    });

    return result;
  }, [students, filters, sortBy]);

  // 고유 학년 목록 추출
  const uniqueGrades = useMemo(() => {
    const grades = new Set(students.map((s) => s.grade).filter(Boolean));
    return Array.from(grades).sort();
  }, [students]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">재원</span>;
      case 'on_hold':
        return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">대기</span>;
      case 'withdrawn':
        return <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">퇴원</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 검색 바 */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 학교 검색..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* 필터 토글 버튼 */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-300"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {showFilters ? '필터 숨기기' : '필터 보기'}
        </button>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="p-3 border-b border-gray-200 bg-gray-50 space-y-2">
          {/* 학년 필터 */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">학년</label>
            <select
              value={filters.grade}
              onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              {uniqueGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>

          {/* 상태 필터 */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">재원 상태</label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value as StudentFilters['status'] })
              }
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="active">재원</option>
              <option value="on_hold">대기</option>
              <option value="withdrawn">퇴원</option>
            </select>
          </div>

          {/* 수강 과목 필터 */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">수강 과목</label>
            <select
              value={filters.subject}
              onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="math">수학</option>
              <option value="english">영어</option>
            </select>
          </div>

          {/* 정렬 */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">정렬</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">이름순</option>
              <option value="grade">학년순</option>
              <option value="startDate">등록일순</option>
            </select>
          </div>
        </div>
      )}

      {/* 학생 목록 */}
      <div className="flex-1 overflow-y-auto">
        {filteredStudents.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            조건에 맞는 학생이 없습니다
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredStudents.map((student) => (
              <li
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className={`p-3 cursor-pointer transition-colors ${
                  selectedStudent?.id === student.id
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{student.name}</span>
                      {getStatusBadge(student.status)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                      {student.school && <div>학교: {student.school}</div>}
                      {student.grade && <div>학년: {student.grade}</div>}
                      {student.enrollments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {student.enrollments.map((e, idx) => (
                            <span
                              key={idx}
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                e.subject === 'math'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {e.subject === 'math' ? '수학' : '영어'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default StudentList;
