/**
 * StudentsNavBar - Students mode sub-navigation bar
 * Phase 2: TabFilterGroup 적용으로 필터 UX 개선
 */

import React, { useEffect, useState } from 'react';
import { XCircle, ChevronDown, Search, X, ChevronsUp, AlertTriangle } from 'lucide-react';
import { TabSubNavigation } from '../Common/TabSubNavigation';
import { TabButton } from '../Common/TabButton';
import { TabFilterGroup } from '../Common/TabFilterGroup';
import { StudentFilters } from '../../hooks/useAppState';

interface TeachersBySubject {
  math: string[];
  english: string[];
  science: string[];
  korean: string[];
}

interface StudentsNavBarProps {
  studentFilters: StudentFilters;
  setStudentFilters: React.Dispatch<React.SetStateAction<StudentFilters>>;
  isSearchFieldDropdownOpen: boolean;
  setIsSearchFieldDropdownOpen: (value: boolean) => void;
  teachersBySubject: TeachersBySubject;
  studentSortBy: 'name' | 'grade' | 'startDate';
  setStudentSortBy: (value: 'name' | 'grade' | 'startDate') => void;
  onGradePromotion?: () => void;
  isPromoting?: boolean;
}

export const StudentsNavBar: React.FC<StudentsNavBarProps> = ({
  studentFilters,
  setStudentFilters,
  isSearchFieldDropdownOpen,
  setIsSearchFieldDropdownOpen,
  teachersBySubject,
  studentSortBy,
  setStudentSortBy,
  onGradePromotion,
  isPromoting,
}) => {
  // 활성 필터 개수 계산
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  useEffect(() => {
    let count = 0;
    if (studentFilters.excludeNoEnrollment) count++;
    if (studentFilters.searchField !== 'all') count++;
    if (studentFilters.grade !== 'all') count++;
    if (studentFilters.teacher !== 'all') count++;
    if (studentFilters.gradeMismatch) count++;
    if (studentSortBy !== 'name') count++;
    setActiveFilterCount(count);
  }, [studentFilters, studentSortBy]);

  return (
    <TabSubNavigation variant="compact" className="justify-between px-6 border-b border-white/10 z-30">
      <TabFilterGroup>
        {/* Primary Filters - 항상 보이는 주요 필터 */}
        <TabFilterGroup.Primary>
          {/* Subject Filter - Grid View */}
          <div className="grid grid-cols-5 gap-1 bg-white/10 rounded-sm p-1 border border-white/10 shadow-sm">
            <TabButton
              active={studentFilters.subjects.length === 0}
              onClick={() => setStudentFilters(prev => ({ ...prev, subjects: [] }))}
              className="px-3 py-1"
            >
              전체
            </TabButton>
            <TabButton
              active={studentFilters.subjects.length > 0 && studentFilters.subjects.includes('math')}
              onClick={() => {
                const hasSubject = studentFilters.subjects.includes('math');
                setStudentFilters(prev => ({
                  ...prev,
                  subjects: hasSubject
                    ? prev.subjects.filter(s => s !== 'math')
                    : [...prev.subjects, 'math']
                }));
              }}
              className="px-3 py-1"
            >
              수학
            </TabButton>
            <TabButton
              active={studentFilters.subjects.length > 0 && studentFilters.subjects.includes('english')}
              onClick={() => {
                const hasSubject = studentFilters.subjects.includes('english');
                setStudentFilters(prev => ({
                  ...prev,
                  subjects: hasSubject
                    ? prev.subjects.filter(s => s !== 'english')
                    : [...prev.subjects, 'english']
                }));
              }}
              className="px-3 py-1"
            >
              영어
            </TabButton>
            <TabButton
              active={studentFilters.subjects.length > 0 && studentFilters.subjects.includes('korean')}
              onClick={() => {
                const hasSubject = studentFilters.subjects.includes('korean');
                setStudentFilters(prev => ({
                  ...prev,
                  subjects: hasSubject
                    ? prev.subjects.filter(s => s !== 'korean')
                    : [...prev.subjects, 'korean']
                }));
              }}
              className="px-3 py-1"
            >
              국어
            </TabButton>
            <TabButton
              active={studentFilters.subjects.length > 0 && studentFilters.subjects.includes('science')}
              onClick={() => {
                const hasSubject = studentFilters.subjects.includes('science');
                setStudentFilters(prev => ({
                  ...prev,
                  subjects: hasSubject
                    ? prev.subjects.filter(s => s !== 'science')
                    : [...prev.subjects, 'science']
                }));
              }}
              className="px-3 py-1"
            >
              과학
            </TabButton>
          </div>

          {/* Subject Filter Mode Toggle - OR/AND */}
          {studentFilters.subjects.length > 1 && (
            <button
              onClick={() => setStudentFilters(prev => ({
                ...prev,
                subjectFilterMode: prev.subjectFilterMode === 'OR' ? 'AND' : 'OR'
              }))}
              className="px-2 py-1 bg-white/10 border border-white/10 rounded-sm text-xxs text-white hover:bg-white/20 transition-colors"
              title={studentFilters.subjectFilterMode === 'OR' ? '하나라도 수강 (클릭하면 모두 수강으로 변경)' : '모두 수강 (클릭하면 하나라도 수강으로 변경)'}
            >
              {studentFilters.subjectFilterMode === 'OR' ? '또는' : '그리고'}
            </button>
          )}

          {/* Status Toggle */}
          <div className="flex bg-white/10 rounded-sm p-0.5 border border-white/10 shadow-sm">
            <TabButton
              active={studentFilters.status === 'all'}
              onClick={() => setStudentFilters(prev => ({ ...prev, status: 'all' }))}
              className="px-3 py-1"
            >
              전체
            </TabButton>
            <TabButton
              active={studentFilters.status === 'prospect'}
              onClick={() => setStudentFilters(prev => ({ ...prev, status: 'prospect' }))}
              variant="tab-status-active"
              className="px-3 py-1"
            >
              예비
            </TabButton>
            <TabButton
              active={studentFilters.status === 'active'}
              onClick={() => setStudentFilters(prev => ({ ...prev, status: 'active' }))}
              variant="tab-status-completed"
              className="px-3 py-1"
            >
              재원
            </TabButton>
            <TabButton
              active={studentFilters.status === 'on_hold'}
              onClick={() => setStudentFilters(prev => ({ ...prev, status: 'on_hold' }))}
              variant="tab-status-pending"
              className="px-3 py-1"
            >
              휴원
            </TabButton>
            <TabButton
              active={studentFilters.status === 'withdrawn'}
              onClick={() => setStudentFilters(prev => ({ ...prev, status: 'withdrawn' }))}
              variant="tab-status-cancelled"
              className="px-3 py-1"
            >
              퇴원
            </TabButton>
            <TabButton
              active={studentFilters.status === 'no_enrollment'}
              onClick={() => setStudentFilters(prev => ({ ...prev, status: 'no_enrollment' }))}
              variant="tab-status-cancelled"
              className="px-3 py-1"
            >
              미수강
            </TabButton>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="이름, 학교 검색..."
              value={studentFilters.searchQuery}
              onChange={(e) => setStudentFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-white/10 rounded-sm text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50"
            />
            {studentFilters.searchQuery && (
              <button
                onClick={() => setStudentFilters(prev => ({ ...prev, searchQuery: '' }))}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </TabFilterGroup.Primary>

        {/* Advanced Filters - 드롭다운으로 숨겨지는 고급 필터 */}
        <TabFilterGroup.Advanced label="고급 필터">
          {/* Exclude No Enrollment Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">미수강 학생 제외</span>
            <button
              onClick={() => setStudentFilters(prev => ({ ...prev, excludeNoEnrollment: !prev.excludeNoEnrollment }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border transition-all ${
                studentFilters.excludeNoEnrollment
                  ? 'bg-accent border-accent text-primary font-medium'
                  : 'bg-white/10 border-white/10 text-white hover:border-white/30'
              }`}
            >
              <XCircle size={14} />
              <span className="text-xs">{studentFilters.excludeNoEnrollment ? '제외 중' : '포함'}</span>
            </button>
          </div>

          {/* Grade-School Mismatch Filter */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">학제/학년 불일치</span>
            <button
              onClick={() => setStudentFilters(prev => ({ ...prev, gradeMismatch: !prev.gradeMismatch }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border transition-all ${
                studentFilters.gradeMismatch
                  ? 'bg-orange-500 border-orange-500 text-white font-medium'
                  : 'bg-white/10 border-white/10 text-white hover:border-white/30'
              }`}
            >
              <AlertTriangle size={14} />
              <span className="text-xs">{studentFilters.gradeMismatch ? '필터 중' : '전체'}</span>
            </button>
          </div>

          {/* Search Field Selector */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">검색 필드</span>
            <div className="relative">
              <button
                onClick={() => setIsSearchFieldDropdownOpen(!isSearchFieldDropdownOpen)}
                className={`px-3 py-1.5 bg-white/10 border border-white/10 rounded-sm text-xs cursor-pointer hover:border-white/30 transition-colors min-w-[120px] text-left ${studentFilters.searchField !== 'all' ? 'text-accent border-accent/50' : 'text-white'}`}
              >
                {studentFilters.searchField === 'all' && '전체'}
                {studentFilters.searchField === 'name' && '이름'}
                {studentFilters.searchField === 'phone' && '전화번호'}
                {studentFilters.searchField === 'school' && '학교'}
                {studentFilters.searchField === 'address' && '주소'}
                {studentFilters.searchField === 'parent' && '보호자'}
                {studentFilters.searchField === 'memo' && '메모'}
                {studentFilters.searchField === 'email' && '이메일'}
                {studentFilters.searchField === 'etc' && '기타'}
                <ChevronDown size={12} className="inline ml-2 float-right" />
              </button>
              {isSearchFieldDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={() => setIsSearchFieldDropdownOpen(false)}
                  />
                  <div className="absolute top-full right-0 mt-1 bg-[#1e293b] border border-white/20 rounded-sm shadow-xl p-2 z-[70] min-w-[180px]">
                    <div className="grid grid-cols-2 gap-0.5">
                      <button
                        onClick={() => {
                          setStudentFilters(prev => ({ ...prev, searchField: 'all' }));
                          setIsSearchFieldDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-xs ${studentFilters.searchField === 'all' ? 'bg-accent text-primary font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        전체
                      </button>
                      <button
                        onClick={() => {
                          setStudentFilters(prev => ({ ...prev, searchField: 'name' }));
                          setIsSearchFieldDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-xs ${studentFilters.searchField === 'name' ? 'bg-blue-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        이름
                      </button>
                      <button
                        onClick={() => {
                          setStudentFilters(prev => ({ ...prev, searchField: 'phone' }));
                          setIsSearchFieldDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-xs ${studentFilters.searchField === 'phone' ? 'bg-purple-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        전화번호
                      </button>
                      <button
                        onClick={() => {
                          setStudentFilters(prev => ({ ...prev, searchField: 'school' }));
                          setIsSearchFieldDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-xs ${studentFilters.searchField === 'school' ? 'bg-green-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        학교
                      </button>
                      <button
                        onClick={() => {
                          setStudentFilters(prev => ({ ...prev, searchField: 'address' }));
                          setIsSearchFieldDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-xs ${studentFilters.searchField === 'address' ? 'bg-orange-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        주소
                      </button>
                      <button
                        onClick={() => {
                          setStudentFilters(prev => ({ ...prev, searchField: 'parent' }));
                          setIsSearchFieldDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-xs ${studentFilters.searchField === 'parent' ? 'bg-pink-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        보호자
                      </button>
                      <button
                        onClick={() => {
                          setStudentFilters(prev => ({ ...prev, searchField: 'memo' }));
                          setIsSearchFieldDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-xs ${studentFilters.searchField === 'memo' ? 'bg-indigo-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        메모
                      </button>
                      <button
                        onClick={() => {
                          setStudentFilters(prev => ({ ...prev, searchField: 'email' }));
                          setIsSearchFieldDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-xs ${studentFilters.searchField === 'email' ? 'bg-teal-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        이메일
                      </button>
                      <button
                        onClick={() => {
                          setStudentFilters(prev => ({ ...prev, searchField: 'etc' }));
                          setIsSearchFieldDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-xs col-span-2 ${studentFilters.searchField === 'etc' ? 'bg-gray-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                      >
                        기타
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Grade Filter */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">학년</span>
            <select
              value={studentFilters.grade}
              onChange={(e) => setStudentFilters(prev => ({ ...prev, grade: e.target.value }))}
              className="px-3 py-1.5 bg-white/10 border border-white/10 rounded-sm text-white text-xs focus:outline-none focus:ring-1 focus:ring-accent/50 cursor-pointer min-w-[120px]"
            >
              <option value="all" className="bg-primary">전체</option>
              <option value="elementary" className="bg-primary">--- 초등학생 ---</option>
              <option value="초1" className="bg-primary">초1</option>
              <option value="초2" className="bg-primary">초2</option>
              <option value="초3" className="bg-primary">초3</option>
              <option value="초4" className="bg-primary">초4</option>
              <option value="초5" className="bg-primary">초5</option>
              <option value="초6" className="bg-primary">초6</option>
              <option value="middle" className="bg-primary">--- 중학생 ---</option>
              <option value="중1" className="bg-primary">중1</option>
              <option value="중2" className="bg-primary">중2</option>
              <option value="중3" className="bg-primary">중3</option>
              <option value="high" className="bg-primary">--- 고등학생 ---</option>
              <option value="고1" className="bg-primary">고1</option>
              <option value="고2" className="bg-primary">고2</option>
              <option value="고3" className="bg-primary">고3</option>
              <option value="other" className="bg-primary">--- 기타 ---</option>
            </select>
          </div>

          {/* Teacher Filter - 과목별 그룹화 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">선생님</span>
            <div className="relative group">
              <button
                className={`px-3 py-1.5 bg-white/10 border border-white/10 rounded-sm text-xs cursor-pointer hover:border-white/30 transition-colors min-w-[120px] text-left ${studentFilters.teacher !== 'all' ? 'text-accent border-accent/50' : 'text-white'}`}
              >
                {studentFilters.teacher === 'all' ? '전체' : studentFilters.teacher}
                <ChevronDown size={12} className="inline ml-2 float-right" />
              </button>
              <div className="absolute top-full right-0 mt-1 bg-[#1e293b] border border-white/20 rounded-sm shadow-xl p-2 hidden group-hover:block z-[70] min-w-[200px]">
                <button
                  onClick={() => setStudentFilters(prev => ({ ...prev, teacher: 'all' }))}
                  className={`w-full text-left px-2 py-1 rounded text-xs mb-1 ${studentFilters.teacher === 'all' ? 'bg-accent text-primary font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                >
                  전체
                </button>
                {/* 수학 선생님 */}
                {teachersBySubject.math.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xxs text-blue-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">수학</div>
                    <div className="grid grid-cols-2 gap-0.5">
                      {teachersBySubject.math.map(teacher => (
                        <button
                          key={`math-${teacher}`}
                          onClick={() => setStudentFilters(prev => ({ ...prev, teacher }))}
                          className={`px-2 py-1 rounded text-xs ${studentFilters.teacher === teacher ? 'bg-blue-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                        >
                          {teacher}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* 영어 선생님 */}
                {teachersBySubject.english.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xxs text-purple-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">영어</div>
                    <div className="grid grid-cols-2 gap-0.5">
                      {teachersBySubject.english.map(teacher => (
                        <button
                          key={`english-${teacher}`}
                          onClick={() => setStudentFilters(prev => ({ ...prev, teacher }))}
                          className={`px-2 py-1 rounded text-xs ${studentFilters.teacher === teacher ? 'bg-purple-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                        >
                          {teacher}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* 과학 선생님 */}
                {teachersBySubject.science.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xxs text-green-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">과학</div>
                    <div className="grid grid-cols-2 gap-0.5">
                      {teachersBySubject.science.map(teacher => (
                        <button
                          key={`science-${teacher}`}
                          onClick={() => setStudentFilters(prev => ({ ...prev, teacher }))}
                          className={`px-2 py-1 rounded text-xs ${studentFilters.teacher === teacher ? 'bg-green-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                        >
                          {teacher}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* 국어 선생님 */}
                {teachersBySubject.korean.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xxs text-orange-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">국어</div>
                    <div className="grid grid-cols-2 gap-0.5">
                      {teachersBySubject.korean.map(teacher => (
                        <button
                          key={`korean-${teacher}`}
                          onClick={() => setStudentFilters(prev => ({ ...prev, teacher }))}
                          className={`px-2 py-1 rounded text-xs ${studentFilters.teacher === teacher ? 'bg-orange-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                        >
                          {teacher}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">정렬</span>
            <select
              value={studentSortBy}
              onChange={(e) => setStudentSortBy(e.target.value as typeof studentSortBy)}
              className="px-3 py-1.5 bg-white/10 border border-white/10 rounded-sm text-white text-xs focus:outline-none focus:ring-1 focus:ring-accent/50 cursor-pointer min-w-[120px]"
            >
              <option value="name" className="bg-primary">이름순</option>
              <option value="grade" className="bg-primary">학년순</option>
              <option value="startDate" className="bg-primary">등록일순</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(studentFilters.searchQuery || studentFilters.grade !== 'all' || studentFilters.status !== 'all' || studentFilters.subjects.length > 0 || studentFilters.teacher !== 'all' || studentFilters.excludeNoEnrollment || studentFilters.gradeMismatch || studentSortBy !== 'name') && (
            <div className="pt-2 border-t border-white/10 mt-2">
              <button
                onClick={() => {
                  setStudentFilters({ searchQuery: '', searchField: 'all', grade: 'all', status: 'all', subjects: [], subjectFilterMode: 'OR', teacher: 'all', excludeNoEnrollment: false, gradeMismatch: false });
                  setStudentSortBy('name');
                }}
                className="w-full px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors text-xs font-bold"
              >
                모든 필터 초기화
              </button>
            </div>
          )}
        </TabFilterGroup.Advanced>
      </TabFilterGroup>

      {/* 학년 진급 버튼 - 2행 가장 우측 */}
      {onGradePromotion && (
        <button
          onClick={onGradePromotion}
          disabled={isPromoting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/10 text-white hover:bg-white/20 rounded-sm text-xs font-bold transition-all shrink-0 disabled:opacity-50"
          title="전체 재원 학생 학년 +1 진급"
        >
          <ChevronsUp size={14} />
          <span>{isPromoting ? '진급 중...' : '학년 진급'}</span>
        </button>
      )}
    </TabSubNavigation>
  );
};
