import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BookOpen, Search, Plus, Calculator, Settings, Microscope, Book, ChevronDown, X } from 'lucide-react';
import { useClasses, ClassInfo } from '../../hooks/useClasses';
import { useStaff } from '../../hooks/useStaff';
import { SUBJECT_COLORS, SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';
import ClassList from './ClassList';
import ClassDetailModal from './ClassDetailModal';
import AddClassModal from './AddClassModal';
import ClassSettingsModal from './ClassSettingsModal';
import { TabSubNavigation } from '../Common/TabSubNavigation';
import { TabButton } from '../Common/TabButton';

export interface ClassFilters {
  subject: 'all' | SubjectType;
  teacher: string; // 'all' or teacher name
  searchQuery: string;
  sortBy: 'name' | 'studentCount' | 'teacher';
  selectedDays: string[]; // 선택된 요일들 (월~일)
}

const ClassManagementTab: React.FC = () => {
  // 필터 상태
  const [filters, setFilters] = useState<ClassFilters>({
    subject: 'all',
    teacher: 'all',
    searchQuery: '',
    sortBy: 'name',
    selectedDays: [], // 빈 배열 = 전체 요일
  });

  // 요일 목록
  const ALL_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

  // 선택된 수업 (상세 모달용)
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);

  // 새 수업 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);

  // 수업 설정 모달
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // 강사 드롭다운 상태
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const teacherDropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (teacherDropdownRef.current && !teacherDropdownRef.current.contains(e.target as Node)) {
        setShowTeacherDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 데이터 조회 (subject 필터 적용)
  const subjectFilter = filters.subject === 'all' ? undefined : filters.subject;
  const { data: classes, isLoading, error } = useClasses(subjectFilter);

  // 직원 데이터 조회
  const { staff } = useStaff();

  // 강사 목록 추출 (필터용) - 수업에 할당된 강사만
  const teachers = useMemo(() => {
    if (!classes) return [];
    const uniqueTeachers = [...new Set(classes.map(c => c.teacher).filter(Boolean))];
    return uniqueTeachers.sort();
  }, [classes]);

  // 강사를 과목별로 그룹화
  const teachersBySubject = useMemo(() => {
    const result: Record<string, string[]> = {
      math: [],
      english: [],
      science: [],
      korean: [],
      other: [],
    };

    // 수업에 할당된 강사만 대상으로 그룹화
    teachers.forEach(teacherName => {
      const staffMember = staff.find(s => s.name === teacherName || s.englishName === teacherName);
      if (staffMember && staffMember.subjects && staffMember.subjects.length > 0) {
        // 해당 강사의 과목들에 추가
        staffMember.subjects.forEach(subject => {
          if (result[subject]) {
            if (!result[subject].includes(teacherName)) {
              result[subject].push(teacherName);
            }
          } else {
            if (!result.other.includes(teacherName)) {
              result.other.push(teacherName);
            }
          }
        });
      } else {
        // 과목 정보가 없으면 기타로 분류
        if (!result.other.includes(teacherName)) {
          result.other.push(teacherName);
        }
      }
    });

    // 각 과목별 정렬
    Object.keys(result).forEach(key => {
      result[key].sort((a, b) => a.localeCompare(b, 'ko'));
    });

    return result;
  }, [teachers, staff]);

  // 필터링 및 정렬된 수업 목록
  const filteredClasses = useMemo(() => {
    if (!classes) return [];

    let result = [...classes];

    // 강사 필터 (담임 + 부담임 모두 포함)
    if (filters.teacher !== 'all') {
      result = result.filter(c => {
        // 담임 체크
        if (c.teacher === filters.teacher) return true;

        // 부담임 체크 (slotTeachers)
        if (c.slotTeachers) {
          const slotTeacherNames = Object.values(c.slotTeachers);
          if (slotTeacherNames.includes(filters.teacher)) return true;
        }

        return false;
      });
    }

    // 검색어 필터
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(c =>
        c.className.toLowerCase().includes(query) ||
        c.teacher?.toLowerCase().includes(query)
      );
    }

    // 요일 필터 (선택된 요일이 있을 때만)
    if (filters.selectedDays.length > 0) {
      result = result.filter(c => {
        // 수업의 스케줄에서 요일 추출
        const classDays = (c.schedule || []).map(s => s.charAt(0)); // 첫 글자가 요일
        // 선택된 요일 중 하나라도 포함되면 표시
        return filters.selectedDays.some(day => classDays.includes(day));
      });
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

  // 과목 필터 버튼 설정 (모든 과목 지원)
  const subjectFilters: Array<{ value: 'all' | SubjectType; label: string; icon: React.ReactNode }> = [
    { value: 'all', label: '전체', icon: <BookOpen className="w-4 h-4" /> },
    { value: 'math', label: SUBJECT_LABELS.math, icon: <Calculator className="w-4 h-4" /> },
    { value: 'english', label: SUBJECT_LABELS.english, icon: <BookOpen className="w-4 h-4" /> },
    { value: 'science', label: SUBJECT_LABELS.science, icon: <Microscope className="w-4 h-4" /> },
    { value: 'korean', label: SUBJECT_LABELS.korean, icon: <Book className="w-4 h-4" /> },
  ];

  // 상단 영역 높이 (앱 헤더 ~64px + 브레드크럼 ~48px + 필터바 40px + 테이블헤더 36px = ~188px)
  // 여유분 포함해서 200px로 설정
  const SCROLL_OFFSET = 200;

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* 상단 고정 영역 - flex-shrink-0으로 절대 줄어들지 않음 */}
      <div className="flex-shrink-0">
        {/* 상단 네비게이션 바 - 반응형 레이아웃 */}
        <TabSubNavigation variant="compact" className="px-6 py-2 border-b border-white/10">
          {/* 단일 행 - 화면이 좁으면 자동으로 wrap */}
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex flex-wrap items-center gap-3">
              {/* 과목 토글 */}
              <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
                {subjectFilters.map(({ value, label, icon }) => (
                  <TabButton
                    key={value}
                    active={filters.subject === value}
                    onClick={() => setFilters({ ...filters, subject: value })}
                    icon={icon}
                    className="px-3 py-1"
                  >
                    {label}
                  </TabButton>
                ))}
              </div>

              {/* 강사 필터 - 그리드 드롭다운 */}
              {teachers.length > 0 && (
                <div className="relative" ref={teacherDropdownRef}>
                  <button
                    onClick={() => setShowTeacherDropdown(!showTeacherDropdown)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium transition-colors ${
                      filters.teacher !== 'all'
                        ? 'bg-[#fdb813] border-[#fdb813] text-[#081429]'
                        : 'bg-[#1e293b] border-gray-700 text-white hover:border-gray-500'
                    }`}
                  >
                    <span>{filters.teacher === 'all' ? '선생님' : filters.teacher}</span>
                    <ChevronDown size={12} className={`transition-transform ${showTeacherDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showTeacherDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-[#1e293b] border border-gray-700 rounded-lg shadow-xl z-50 min-w-[320px] max-h-[500px] overflow-y-auto">
                      {/* 전체 선택 */}
                      <div className="p-2 border-b border-white/10">
                        <button
                          onClick={() => {
                            setFilters({ ...filters, teacher: 'all' });
                            setShowTeacherDropdown(false);
                          }}
                          className={`w-full px-3 py-1.5 rounded text-xs font-bold text-left ${
                            filters.teacher === 'all'
                              ? 'bg-[#fdb813] text-[#081429]'
                              : 'text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          전체
                        </button>
                      </div>

                      <div className="p-2">
                        {/* 수학 */}
                        {teachersBySubject.math.length > 0 && (
                          <div className="mb-2">
                            <div className="text-[10px] text-blue-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">수학</div>
                            <div className="grid grid-cols-3 gap-0.5">
                              {teachersBySubject.math.map(teacher => (
                                <button
                                  key={`math-${teacher}`}
                                  onClick={() => {
                                    setFilters({ ...filters, teacher });
                                    setShowTeacherDropdown(false);
                                  }}
                                  className={`px-2 py-1 rounded text-xs ${filters.teacher === teacher ? 'bg-blue-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                >
                                  {teacher}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 영어 */}
                        {teachersBySubject.english.length > 0 && (
                          <div className="mb-2">
                            <div className="text-[10px] text-purple-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">영어</div>
                            <div className="grid grid-cols-3 gap-0.5">
                              {teachersBySubject.english.map(teacher => (
                                <button
                                  key={`english-${teacher}`}
                                  onClick={() => {
                                    setFilters({ ...filters, teacher });
                                    setShowTeacherDropdown(false);
                                  }}
                                  className={`px-2 py-1 rounded text-xs ${filters.teacher === teacher ? 'bg-purple-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                >
                                  {teacher}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 과학 */}
                        {teachersBySubject.science.length > 0 && (
                          <div className="mb-2">
                            <div className="text-[10px] text-green-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">과학</div>
                            <div className="grid grid-cols-3 gap-0.5">
                              {teachersBySubject.science.map(teacher => (
                                <button
                                  key={`science-${teacher}`}
                                  onClick={() => {
                                    setFilters({ ...filters, teacher });
                                    setShowTeacherDropdown(false);
                                  }}
                                  className={`px-2 py-1 rounded text-xs ${filters.teacher === teacher ? 'bg-green-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                >
                                  {teacher}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 국어 */}
                        {teachersBySubject.korean.length > 0 && (
                          <div className="mb-2">
                            <div className="text-[10px] text-orange-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">국어</div>
                            <div className="grid grid-cols-3 gap-0.5">
                              {teachersBySubject.korean.map(teacher => (
                                <button
                                  key={`korean-${teacher}`}
                                  onClick={() => {
                                    setFilters({ ...filters, teacher });
                                    setShowTeacherDropdown(false);
                                  }}
                                  className={`px-2 py-1 rounded text-xs ${filters.teacher === teacher ? 'bg-orange-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                >
                                  {teacher}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 기타 */}
                        {teachersBySubject.other.length > 0 && (
                          <div className="mb-2">
                            <div className="text-[10px] text-gray-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">기타</div>
                            <div className="grid grid-cols-3 gap-0.5">
                              {teachersBySubject.other.map(teacher => (
                                <button
                                  key={`other-${teacher}`}
                                  onClick={() => {
                                    setFilters({ ...filters, teacher });
                                    setShowTeacherDropdown(false);
                                  }}
                                  className={`px-2 py-1 rounded text-xs ${filters.teacher === teacher ? 'bg-gray-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                >
                                  {teacher}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 초기화 버튼 */}
                      {filters.teacher !== 'all' && (
                        <div className="p-2 border-t border-white/10">
                          <button
                            onClick={() => {
                              setFilters({ ...filters, teacher: 'all' });
                              setShowTeacherDropdown(false);
                            }}
                            className="w-full px-3 py-1.5 rounded text-xs text-red-400 hover:bg-red-400/10 flex items-center justify-center gap-1"
                          >
                            <X size={12} />
                            초기화
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 요일 필터 */}
              <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
                {ALL_DAYS.map(day => {
                  const isSelected = filters.selectedDays.includes(day);
                  const toggleDay = () => {
                    if (isSelected) {
                      setFilters({ ...filters, selectedDays: filters.selectedDays.filter(d => d !== day) });
                    } else {
                      setFilters({ ...filters, selectedDays: [...filters.selectedDays, day] });
                    }
                  };
                  return (
                    <button
                      key={day}
                      onClick={toggleDay}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${isSelected
                        ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {day}
                    </button>
                  );
                })}
                {filters.selectedDays.length > 0 && (
                  <button
                    onClick={() => setFilters({ ...filters, selectedDays: [] })}
                    className="px-2 py-0.5 rounded text-xs text-gray-400 hover:text-red-400 hover:bg-red-400/10 ml-1"
                    title="요일 필터 초기화"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* 구분선 */}
              <div className="w-px h-4 bg-white/20"></div>

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
              <div className="w-px h-4 bg-white/20"></div>

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

            {/* 우측: 결과 카운트, 버튼들 */}
            <div className="flex items-center gap-2">
              {/* 결과 카운트 */}
              <span className="text-gray-400 text-xs">
                총 <span className="text-[#fdb813] font-bold">{filteredClasses.length}</span>개 수업
              </span>

              {/* 설정 버튼 */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors shadow-sm font-bold"
                title="수업 설정"
              >
                <Settings size={14} />
                <span>설정</span>
              </button>

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
        </TabSubNavigation>

        {/* 테이블 헤더 */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 grid grid-cols-[80px_1fr_100px_100px_1fr_1fr_70px_40px] gap-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="text-center">과목</div>
          <div>수업명</div>
          <div>담임</div>
          <div>부담임</div>
          <div>스케줄</div>
          <div>메모</div>
          <div className="text-center">학생</div>
          <div></div>
        </div>
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 - 명시적 maxHeight로 스크롤 영역 제한 */}
      <div
        className="flex-1 min-h-0 overflow-auto px-6 pb-6"
        style={{ maxHeight: `calc(100vh - ${SCROLL_OFFSET}px)` }}
      >
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

      {/* 수업 설정 모달 */}
      {showSettingsModal && (
        <ClassSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          canEdit={true}
        />
      )}

    </div>
  );
};

export default ClassManagementTab;
