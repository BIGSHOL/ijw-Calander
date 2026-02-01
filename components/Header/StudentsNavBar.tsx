/**
 * StudentsNavBar - Students mode sub-navigation bar
 * Extracted from App.tsx Phase 5
 */

import React from 'react';
import { XCircle, ChevronDown, Search, X } from 'lucide-react';
import { TabSubNavigation } from '../Common/TabSubNavigation';
import { TabButton } from '../Common/TabButton';
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
}

export const StudentsNavBar: React.FC<StudentsNavBarProps> = ({
  studentFilters,
  setStudentFilters,
  isSearchFieldDropdownOpen,
  setIsSearchFieldDropdownOpen,
  teachersBySubject,
  studentSortBy,
  setStudentSortBy,
}) => {
  return (
    <TabSubNavigation variant="compact" className="justify-between px-6 border-b border-white/10 z-30">
      <div className="flex items-center gap-3 flex-1">
        {/* Subject Filter - Grid View */}
        <div className="grid grid-cols-5 gap-1 bg-white/10 rounded-lg p-1 border border-white/10 shadow-sm">
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

        {/* Exclude No Enrollment Toggle */}
        <button
          onClick={() => setStudentFilters(prev => ({ ...prev, excludeNoEnrollment: !prev.excludeNoEnrollment }))}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
            studentFilters.excludeNoEnrollment
              ? 'bg-[#fdb813] border-[#fdb813] text-[#081429] font-medium'
              : 'bg-white/10 border-white/10 text-white hover:border-white/30'
          }`}
          title="미수강 학생 제외"
        >
          <XCircle size={14} />
          <span className="text-xs">미수강 제외</span>
        </button>

        {/* Status Toggle */}
        <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
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
        </div>

        {/* Search Field Selector */}
        <div className="relative">
          <button
            onClick={() => setIsSearchFieldDropdownOpen(!isSearchFieldDropdownOpen)}
            className={`px-2 py-1.5 bg-white/10 border border-white/10 rounded-lg text-xs cursor-pointer hover:border-white/30 transition-colors ${studentFilters.searchField !== 'all' ? 'text-[#fdb813] border-[#fdb813]/50' : 'text-white'}`}
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
            <ChevronDown size={12} className="inline ml-1" />
          </button>
          {isSearchFieldDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-[#1e293b] border border-white/20 rounded-lg shadow-xl p-2 z-50 min-w-[180px]">
              <div className="grid grid-cols-2 gap-0.5">
                <button
                  onClick={() => {
                    setStudentFilters(prev => ({ ...prev, searchField: 'all' }));
                    setIsSearchFieldDropdownOpen(false);
                  }}
                  className={`px-2 py-1 rounded text-xs ${studentFilters.searchField === 'all' ? 'bg-[#fdb813] text-[#081429] font-bold' : 'text-gray-300 hover:bg-white/10'}`}
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
          )}
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="이름, 학교 검색..."
            value={studentFilters.searchQuery}
            onChange={(e) => setStudentFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-[#fdb813]/50 focus:border-[#fdb813]/50"
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

        {/* Grade Filter */}
        <select
          value={studentFilters.grade}
          onChange={(e) => setStudentFilters(prev => ({ ...prev, grade: e.target.value }))}
          className="px-2 py-1.5 bg-white/10 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#fdb813]/50 cursor-pointer"
        >
          <option value="all" className="bg-[#081429]">학년</option>
          <option value="elementary" className="bg-[#081429]">--- 초등학생 ---</option>
          <option value="초1" className="bg-[#081429]">초1</option>
          <option value="초2" className="bg-[#081429]">초2</option>
          <option value="초3" className="bg-[#081429]">초3</option>
          <option value="초4" className="bg-[#081429]">초4</option>
          <option value="초5" className="bg-[#081429]">초5</option>
          <option value="초6" className="bg-[#081429]">초6</option>
          <option value="middle" className="bg-[#081429]">--- 중학생 ---</option>
          <option value="중1" className="bg-[#081429]">중1</option>
          <option value="중2" className="bg-[#081429]">중2</option>
          <option value="중3" className="bg-[#081429]">중3</option>
          <option value="high" className="bg-[#081429]">--- 고등학생 ---</option>
          <option value="고1" className="bg-[#081429]">고1</option>
          <option value="고2" className="bg-[#081429]">고2</option>
          <option value="고3" className="bg-[#081429]">고3</option>
          <option value="other" className="bg-[#081429]">--- 기타 ---</option>
        </select>

        {/* Teacher Filter - 과목별 그룹화 */}
        <div className="relative group">
          <button
            className={`px-2 py-1.5 bg-white/10 border border-white/10 rounded-lg text-xs cursor-pointer hover:border-white/30 transition-colors ${studentFilters.teacher !== 'all' ? 'text-[#fdb813] border-[#fdb813]/50' : 'text-white'}`}
          >
            {studentFilters.teacher === 'all' ? '선생님' : studentFilters.teacher}
            <ChevronDown size={12} className="inline ml-1" />
          </button>
          <div className="absolute top-full left-0 mt-1 bg-[#1e293b] border border-white/20 rounded-lg shadow-xl p-2 hidden group-hover:block z-50 min-w-[200px]">
            <button
              onClick={() => setStudentFilters(prev => ({ ...prev, teacher: 'all' }))}
              className={`w-full text-left px-2 py-1 rounded text-xs mb-1 ${studentFilters.teacher === 'all' ? 'bg-[#fdb813] text-[#081429] font-bold' : 'text-gray-300 hover:bg-white/10'}`}
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

        {/* Sort */}
        <select
          value={studentSortBy}
          onChange={(e) => setStudentSortBy(e.target.value as typeof studentSortBy)}
          className="px-2 py-1.5 bg-white/10 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#fdb813]/50 cursor-pointer"
        >
          <option value="name" className="bg-[#081429]">이름순</option>
          <option value="grade" className="bg-[#081429]">학년순</option>
          <option value="startDate" className="bg-[#081429]">등록일순</option>
        </select>

        {/* Reset Filters */}
        {(studentFilters.searchQuery || studentFilters.grade !== 'all' || studentFilters.status !== 'all' || studentFilters.subjects.length > 0 || studentFilters.teacher !== 'all') && (
          <button
            onClick={() => {
              setStudentFilters({ searchQuery: '', searchField: 'all', grade: 'all', status: 'all', subjects: [], teacher: 'all', excludeNoEnrollment: false });
              setStudentSortBy('name');
            }}
            className="px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
          >
            초기화
          </button>
        )}
      </div>
    </TabSubNavigation>
  );
};
