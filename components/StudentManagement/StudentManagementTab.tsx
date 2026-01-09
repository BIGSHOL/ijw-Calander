import React, { useState, useMemo, useEffect } from 'react';
import { UnifiedStudent } from '../../types';
import { useStudents, searchStudentsByQuery } from '../../hooks/useStudents';
import StudentList from './StudentList';
import StudentDetail from './StudentDetail';
import { Users, Loader2, RefreshCw } from 'lucide-react';

export interface StudentFilters {
  searchQuery: string;
  grade: string;
  status: 'all' | 'active' | 'on_hold' | 'withdrawn';
  subject: string;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
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
    <div className="flex h-full bg-gray-50">
      {/* 좌측 패널: 학생 목록 (28% - 축소됨) */}
      <div className="w-[28%] min-w-[280px] max-w-[350px] border-r border-gray-300 bg-white flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-[#081429] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#fdb813]" />
            <span className="text-sm font-bold text-white">학생 목록</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await refreshStudents();
                setIsRefreshing(false);
              }}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
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
              📋 과거 퇴원생 {oldWithdrawnStudents.length}명 포함됨 (90일 이전)
            </p>
          </div>
        )}

        <StudentList
          students={filteredStudents}
          selectedStudent={selectedStudent}
          onSelectStudent={setSelectedStudent}
        />
      </div>

      {/* 우측 패널: 학생 상세 정보 (72% - 확장됨) */}
      <div className="flex-1 bg-white">
        {selectedStudent ? (
          <StudentDetail student={selectedStudent} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">학생을 선택하세요</p>
              <p className="text-sm mt-2">좌측 목록에서 학생을 클릭하면 상세 정보가 표시됩니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentManagementTab;
