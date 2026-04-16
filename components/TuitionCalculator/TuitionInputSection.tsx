import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Trash2, Calculator, ChevronDown, Check, Search, CalendarOff, Calendar, Hash,
} from 'lucide-react';
import { isHolidayDate } from '../../utils/tuitionHolidays';
import { formatSchoolGrade } from '../../utils/studentUtils';
import type { UnifiedStudent } from '../../types/student';
import type {
  TuitionCourse, TuitionSelectedCourse, TuitionExtraItem, TuitionSelectedExtra,
  TuitionDiscountItem, TuitionSelectedDiscount, TuitionStudentInfo,
} from '../../types/tuition';

// 요일 순서
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

// YYYY-MM-DD 문자열을 로컬 시간대 기준 Date로 파싱
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// 기간 내 특정 요일의 수업 횟수 계산 (공휴일 제외 옵션 포함)
const calculateSessions = (
  startDate: string,
  endDate: string,
  selectedDays: string,
  excludeHolidays: boolean = false,
  holidayDateSet: Set<string> = new Set(),
): number => {
  if (!startDate || !endDate || !selectedDays) return 0;
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const dayMap: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  const targetIndexes = selectedDays.split(',').map(d => dayMap[d.trim()]).filter(n => n !== undefined);
  if (targetIndexes.length === 0) return 0;
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (targetIndexes.includes(current.getDay())) {
      if (!(excludeHolidays && isHolidayDate(current, holidayDateSet))) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

// 과목 카테고리 → 세션 카테고리 매핑
const mapCategoryToSessionCategory = (category: string): string | null => {
  if (category === '수학') return '수학';
  if (category === '영어') return '영어';
  if (category === 'EIE') return 'EiE';
  return null;
};

// ─── SearchableDropdown ───────────────────────────────────────────────────────

interface SearchableDropdownProps<T> {
  placeholder: string;
  items: T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
  onSelect: (value: string) => void;
}

function SearchableDropdown<T>({
  placeholder, items, getLabel, getValue, onSelect,
}: SearchableDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = items.filter(item =>
    getLabel(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="text-sm border border-slate-300 rounded p-1.5 max-w-[150px] flex items-center gap-1 bg-white hover:bg-slate-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{placeholder}</span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-[#fdb813] focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-3 text-sm text-slate-400 text-center">검색 결과가 없습니다</div>
            ) : (
              filteredItems.map((item, idx) => (
                <button
                  key={getValue(item) + idx}
                  onClick={() => handleSelect(getValue(item))}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-[#fdb813]/10 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  {getLabel(item)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MultiSelectDropdown ──────────────────────────────────────────────────────

const MultiSelectDropdown = ({
  value, onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedDays = value ? value.split(',') : [];

  const toggleDay = (day: string) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day];
    const sortedDays = newDays.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
    onChange(sortedDays.join(','));
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="w-full p-1 border rounded text-sm text-left flex justify-between items-center bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{value || '요일 선택'}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded shadow-lg p-2 grid grid-cols-4 gap-1 min-w-[160px]">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`text-xs p-1 rounded border flex items-center justify-center gap-1 ${
                selectedDays.includes(day)
                  ? 'bg-[#fdb813]/20 border-[#fdb813] text-[#081429] font-bold'
                  : 'bg-white border-slate-100 text-[#373d41] hover:bg-slate-50'
              }`}
            >
              {day}
              {selectedDays.includes(day) && <Check size={10} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface TuitionInputSectionProps {
  studentInfo: TuitionStudentInfo;
  setStudentInfo: React.Dispatch<React.SetStateAction<TuitionStudentInfo>>;
  students?: UnifiedStudent[];
  availableCourses: TuitionCourse[];
  selectedCourses: TuitionSelectedCourse[];
  addCourse: (courseId: string) => void;
  removeCourse: (uid: string) => void;
  updateCourse: (uid: string, field: keyof TuitionSelectedCourse, value: unknown) => void;
  availableExtras: TuitionExtraItem[];
  selectedExtras: TuitionSelectedExtra[];
  addExtra: (extraId: string) => void;
  removeExtra: (uid: string) => void;
  updateExtra: (uid: string, field: keyof TuitionSelectedExtra, value: unknown) => void;
  availableDiscounts: TuitionDiscountItem[];
  selectedDiscounts: TuitionSelectedDiscount[];
  addDiscount: (discountId: string) => void;
  removeDiscount: (uid: string) => void;
  updateDiscount: (uid: string, field: keyof TuitionSelectedDiscount, value: unknown) => void;
  holidayDateSet: Set<string>;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export const TuitionInputSection: React.FC<TuitionInputSectionProps> = ({
  studentInfo, setStudentInfo, students = [],
  availableCourses, selectedCourses, addCourse, removeCourse, updateCourse,
  availableExtras, selectedExtras, addExtra, removeExtra, updateExtra,
  availableDiscounts, selectedDiscounts, addDiscount, removeDiscount, updateDiscount,
  holidayDateSet,
}) => {
  // 학생 자동완성
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const filteredStudents = useMemo(() => {
    if (!studentInfo.name.trim()) return [];
    const q = studentInfo.name.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.school && s.school.toLowerCase().includes(q)) ||
      (s.grade && s.grade.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [studentInfo.name, students]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node))
        setShowStudentDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectStudent = (student: UnifiedStudent) => {
    setStudentInfo(prev => ({
      ...prev,
      name: student.name,
      school: formatSchoolGrade(student.school, student.grade, { numberLast: true }),
    }));
    setShowStudentDropdown(false);
  };
  // 수강 기간 변경 시 요일이 설정된 과목의 횟수 자동 재계산
  useEffect(() => {
    selectedCourses.forEach(course => {
      if (course.useSessionPeriod) return;
      if (course.fixedMonthly) return; // 월 N회 고정 모드는 자동 재계산 건너뜀
      if (course.days && studentInfo.startDate && studentInfo.endDate) {
        const newSessions = calculateSessions(
          studentInfo.startDate, studentInfo.endDate,
          course.days, course.excludeHolidays, holidayDateSet,
        );
        if (newSessions !== course.sessions) {
          updateCourse(course.uid, 'sessions', newSessions);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentInfo.startDate, studentInfo.endDate]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-[#373d41]/20 h-full overflow-y-auto no-print">
      <h2 className="text-xl font-bold text-[#081429] mb-6 flex items-center gap-2">
        <Calculator className="w-6 h-6 text-[#fdb813]" />
        상담 정보 입력
      </h2>

      {/* 1. 학생 정보 */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">학생 정보</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-1 relative" ref={studentDropdownRef}>
            <input
              type="text"
              placeholder="학생 이름"
              className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-[#fdb813] outline-none"
              value={studentInfo.name}
              onChange={(e) => {
                setStudentInfo(prev => ({ ...prev, name: e.target.value }));
                setShowStudentDropdown(true);
              }}
              onFocus={() => setShowStudentDropdown(true)}
            />
            {showStudentDropdown && filteredStudents.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {filteredStudents.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-[#fdb813]/10 transition-colors border-b border-slate-100 last:border-b-0 flex justify-between"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-slate-400">{formatSchoolGrade(s.school, s.grade, { numberLast: true })}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <input
            type="text"
            placeholder="학교/학년"
            className="col-span-1 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-[#fdb813] outline-none"
            value={studentInfo.school}
            onChange={(e) => setStudentInfo(prev => ({ ...prev, school: e.target.value }))}
          />
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">시작일</label>
              <input
                type="date"
                className="w-full p-2 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-[#fdb813]"
                value={studentInfo.startDate}
                onChange={(e) => setStudentInfo(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">종료일</label>
              <input
                type="date"
                className="w-full p-2 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-[#fdb813]"
                value={studentInfo.endDate}
                onChange={(e) => setStudentInfo(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>
          <input
            type="text"
            placeholder="상담자"
            className="col-span-2 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-[#fdb813] outline-none"
            value={studentInfo.consultant}
            onChange={(e) => setStudentInfo(prev => ({ ...prev, consultant: e.target.value }))}
          />
        </div>
      </section>

      {/* 2. 수강 과목 */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">수강 과목</h3>
          <SearchableDropdown
            placeholder="+ 과목 추가"
            items={availableCourses}
            getLabel={(c) => `[${c.category}] ${c.name}`}
            getValue={(c) => c.id}
            onSelect={addCourse}
          />
        </div>
        <div className="space-y-3">
          {selectedCourses.map((course) => (
            <div key={course.uid} className="bg-slate-50 p-3 rounded border border-slate-200 relative group">
              <button
                onClick={() => removeCourse(course.uid)}
                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="font-medium text-slate-700 pr-6">{course.category} - {course.name}</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <MultiSelectDropdown
                  value={course.days}
                  onChange={(val) => {
                    updateCourse(course.uid, 'days', val);
                    if (course.fixedMonthly) return; // 월 N회 고정 모드는 요일 변경에도 sessions 유지
                    if (studentInfo.startDate && studentInfo.endDate) {
                      const sessions = calculateSessions(
                        studentInfo.startDate, studentInfo.endDate,
                        val, course.excludeHolidays, holidayDateSet,
                      );
                      updateCourse(course.uid, 'sessions', sessions);
                    }
                  }}
                />
                <input
                  type="text"
                  value={course.sessions}
                  onChange={(e) => updateCourse(course.uid, 'sessions', Number(e.target.value))}
                  placeholder="횟수"
                  className="p-1 border rounded text-sm text-right bg-white"
                />
                <input
                  type="number"
                  value={course.price}
                  onChange={(e) => updateCourse(course.uid, 'price', Number(e.target.value))}
                  placeholder="금액"
                  className="p-1 border rounded text-sm text-right"
                />
                <input
                  type="text"
                  value={course.note}
                  onChange={(e) => updateCourse(course.uid, 'note', e.target.value)}
                  placeholder="비고 (예: 2월 12회)"
                  className="p-1 border rounded text-sm"
                />
              </div>
              {/* 공휴일 제외 토글 및 세션 적용 */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const newExcludeHolidays = !course.excludeHolidays;
                    updateCourse(course.uid, 'excludeHolidays', newExcludeHolidays);
                    if (
                      studentInfo.startDate && studentInfo.endDate && course.days &&
                      !course.useSessionPeriod && !course.fixedMonthly
                    ) {
                      const sessions = calculateSessions(
                        studentInfo.startDate, studentInfo.endDate,
                        course.days, newExcludeHolidays, holidayDateSet,
                      );
                      updateCourse(course.uid, 'sessions', sessions);
                    }
                  }}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                    course.excludeHolidays
                      ? 'bg-red-50 border-red-300 text-red-600'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <CalendarOff size={12} />
                  공휴일 제외
                  {course.excludeHolidays && <Check size={10} />}
                </button>

                {mapCategoryToSessionCategory(course.category) && (
                  <button
                    onClick={() => {
                      const newUseSession = !course.useSessionPeriod;
                      updateCourse(course.uid, 'useSessionPeriod', newUseSession);
                      // 세션 적용 ON 시 12회 고정과 배타
                      if (newUseSession && course.fixedMonthly) {
                        updateCourse(course.uid, 'fixedMonthly', false);
                      }
                      if (!newUseSession && studentInfo.startDate && studentInfo.endDate && course.days && !course.fixedMonthly) {
                        const sessions = calculateSessions(
                          studentInfo.startDate, studentInfo.endDate,
                          course.days, course.excludeHolidays, holidayDateSet,
                        );
                        updateCourse(course.uid, 'sessions', sessions);
                      }
                    }}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                      course.useSessionPeriod
                        ? 'bg-blue-50 border-blue-300 text-blue-600'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Calendar size={12} />
                    세션 적용
                    {course.useSessionPeriod && <Check size={10} />}
                  </button>
                )}

                {/* 월 N회 고정 토글 (요일/공휴일/세션 자동 재계산을 건너뛰고 N회로 강제) */}
                <button
                  onClick={() => {
                    const newFixedMonthly = !course.fixedMonthly;
                    const N = course.fixedSessionsCount ?? 12;
                    updateCourse(course.uid, 'fixedMonthly', newFixedMonthly);
                    if (newFixedMonthly) {
                      // 12회 고정 ON: 세션 적용과 배타, sessions = N
                      if (course.useSessionPeriod) {
                        updateCourse(course.uid, 'useSessionPeriod', false);
                      }
                      if (!course.fixedSessionsCount) {
                        updateCourse(course.uid, 'fixedSessionsCount', N);
                      }
                      updateCourse(course.uid, 'sessions', N);
                    } else if (studentInfo.startDate && studentInfo.endDate && course.days) {
                      // OFF: 요일/공휴일 기반 재계산
                      const sessions = calculateSessions(
                        studentInfo.startDate, studentInfo.endDate,
                        course.days, course.excludeHolidays, holidayDateSet,
                      );
                      updateCourse(course.uid, 'sessions', sessions);
                    }
                  }}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                    course.fixedMonthly
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                  title="월 N회로 회수를 강제 (요일/공휴일/세션 자동 재계산 무시)"
                >
                  <Hash size={12} />
                  월 {course.fixedMonthly ? (course.fixedSessionsCount ?? 12) : 'N'}회 고정
                  {course.fixedMonthly && <Check size={10} />}
                </button>

                {course.fixedMonthly && (
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={course.fixedSessionsCount ?? 12}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(50, Number(e.target.value) || 12));
                      updateCourse(course.uid, 'fixedSessionsCount', n);
                      updateCourse(course.uid, 'sessions', n);
                    }}
                    className="w-14 px-1.5 py-0.5 text-xs border border-emerald-300 rounded text-right focus:ring-1 focus:ring-emerald-400 outline-none"
                    title="월 고정 회수"
                  />
                )}
              </div>
            </div>
          ))}
          {selectedCourses.length === 0 && (
            <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 border border-dashed rounded">
              선택된 과목이 없습니다.
            </div>
          )}
        </div>
      </section>

      {/* 3. 교재 및 기타 */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">교재 및 기타</h3>
          <SearchableDropdown
            placeholder="+ 항목 추가"
            items={availableExtras}
            getLabel={(e) => e.name}
            getValue={(e) => e.id}
            onSelect={addExtra}
          />
        </div>
        <div className="space-y-2">
          {selectedExtras.map((extra) => (
            <div key={extra.uid} className="bg-slate-50 p-3 rounded border border-slate-200 relative group">
              <button
                onClick={() => removeExtra(extra.uid)}
                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={extra.name}
                onChange={(e) => updateExtra(extra.uid, 'name', e.target.value)}
                className="font-medium text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#fdb813] outline-none w-full pr-6"
              />
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  value={extra.price}
                  onChange={(e) => updateExtra(extra.uid, 'price', Number(e.target.value))}
                  className="w-24 p-1 border rounded text-sm text-right"
                />
                <input
                  type="text"
                  value={extra.note}
                  onChange={(e) => updateExtra(extra.uid, 'note', e.target.value)}
                  placeholder="비고"
                  className="flex-1 p-1 border rounded text-sm"
                />
              </div>
            </div>
          ))}
          {selectedExtras.length === 0 && (
            <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 border border-dashed rounded">
              선택된 항목이 없습니다.
            </div>
          )}
        </div>
      </section>

      {/* 4. 할인 적용 */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">할인 적용</h3>
          <SearchableDropdown
            placeholder="+ 할인 추가"
            items={availableDiscounts}
            getLabel={(d) => `${d.name} (-${d.amount.toLocaleString()}원)`}
            getValue={(d) => d.id}
            onSelect={addDiscount}
          />
        </div>
        <div className="space-y-2">
          {selectedDiscounts.map((discount) => (
            <div key={discount.uid} className="bg-slate-50 p-3 rounded border border-slate-200 relative group">
              <button
                onClick={() => removeDiscount(discount.uid)}
                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={discount.name}
                onChange={(e) => updateDiscount(discount.uid, 'name', e.target.value)}
                className="font-medium text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#fdb813] outline-none w-full pr-6"
              />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[#fdb813] font-semibold">-</span>
                <input
                  type="number"
                  value={discount.amount}
                  onChange={(e) => updateDiscount(discount.uid, 'amount', Number(e.target.value))}
                  className="w-28 p-1 border rounded text-sm text-right"
                />
                <span className="text-sm text-slate-500">원</span>
              </div>
            </div>
          ))}
          {selectedDiscounts.length === 0 && (
            <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 border border-dashed rounded">
              적용된 할인이 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
