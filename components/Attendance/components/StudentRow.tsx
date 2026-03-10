import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Student, SalaryConfig } from '../types';
import { Exam, StudentScore, GRADE_COLORS } from '../../../types';
import { StudentTermSummary } from '../../../types/enrollmentTerm';
import { formatDateDisplay, formatDateKey, getBadgeStyle, getStudentStatus, isDateValidForStudent, getSchoolLevelSalarySetting, getLocalYearMonth, getDaysInMonth, getEffectiveUnitPrice, calculateClassRate } from '../utils';
import { formatSchoolGrade } from '../../../utils/studentUtils';
import { LogOut, Check } from 'lucide-react';
import { PREDEFINED_CELL_COLORS } from './cellColors';

export interface StudentRowProps {
  student: Student;
  idx: number;
  days: Date[];
  currentDate: Date;
  salaryConfig: SalaryConfig;
  subject?: string; // 현재 출석부의 과목 (영어/수학)
  onEditStudent: (student: Student) => void;
  onCellClick: (studentId: string, className: string, dateKey: string, currentValue: number | undefined, isValid: boolean) => void;
  onContextMenu: (e: React.MouseEvent, student: Student, dateKey: string, isValid: boolean) => void;
  onSalarySettingChange?: (studentId: string, className: string, salarySettingId: string | null) => void;
  pendingUpdates?: Record<string, number | null>;
  pendingMemos?: Record<string, string>;
  examsByDate?: Map<string, Exam[]>;
  scoresByStudent?: Map<string, Map<string, StudentScore>>;
  onHomeworkChange?: (studentId: string, className: string, dateKey: string, value: boolean) => void;
  highlightWeekends?: boolean;
  showExpectedBilling?: boolean;
  showSettlement?: boolean;
  holidayDateSet?: Set<string>;
  holidayNameMap?: Map<string, string>;
  hasHiddenDates?: boolean;
  enrollmentTerm?: StudentTermSummary;
  onEnrollmentTermClick?: (studentId: string, studentName: string, rect: { top: number; left: number }) => void;
}

const StudentRow = React.memo(({
  student,
  idx,
  days,
  currentDate,
  salaryConfig,
  subject,
  onEditStudent,
  onCellClick,
  onContextMenu,
  onSalarySettingChange,
  pendingUpdates,
  pendingMemos,
  examsByDate,
  scoresByStudent,
  onHomeworkChange,
  highlightWeekends = false,
  showExpectedBilling = false,
  showSettlement = false,
  holidayDateSet = new Set(),
  holidayNameMap = new Map(),
  hasHiddenDates = false,
  enrollmentTerm,
  onEnrollmentTermClick
}: StudentRowProps) => {
  const [showSalaryDropdown, setShowSalaryDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const salaryBtnRef = useRef<HTMLButtonElement>(null);
  const salaryDropdownRef = useRef<HTMLDivElement>(null);
  const currentMonthStr = getLocalYearMonth(currentDate);

  // 발행예정금액 계산: 이달 등원일 × 수업 단가
  const expectedBilling = useMemo(() => {
    if (!showExpectedBilling) return 0;
    const salarySettingOverrideId = student.salarySettingOverrides?.[student.group || ''];
    const effectiveSalarySettingId = salarySettingOverrideId || student.salarySettingId;
    const settingItem = effectiveSalarySettingId
      ? (salaryConfig.items.find(item => item.id === effectiveSalarySettingId)
         || getSchoolLevelSalarySetting(student.school, salaryConfig.items))
      : getSchoolLevelSalarySetting(student.school, salaryConfig.items);
    const unitPrice = getEffectiveUnitPrice(settingItem);
    if (unitPrice <= 0) return 0;

    const allDays = getDaysInMonth(currentDate);
    let scheduledCount = 0;
    allDays.forEach(day => {
      const dateKey = formatDateKey(day);
      if (!isDateValidForStudent(dateKey, student)) return;
      if (holidayDateSet.has(dateKey)) return;
      const { day: dayName } = formatDateDisplay(day);
      if (student.days && student.days.includes(dayName)) scheduledCount++;
    });
    return scheduledCount * unitPrice;
  }, [showExpectedBilling, student, salaryConfig, currentDate, holidayDateSet]);

  // 정산액 계산: 출석횟수 × 회당 정산액 (선생님 급여)
  const settlementAmount = useMemo(() => {
    if (!showSettlement) return 0;
    const salarySettingOverrideId = student.salarySettingOverrides?.[student.group || ''];
    const effectiveSalarySettingId = salarySettingOverrideId || student.salarySettingId;
    const settingItem = effectiveSalarySettingId
      ? (salaryConfig.items.find(item => item.id === effectiveSalarySettingId)
         || getSchoolLevelSalarySetting(student.school, salaryConfig.items))
      : getSchoolLevelSalarySetting(student.school, salaryConfig.items);
    if (!settingItem) return 0;
    // 출석횟수 합산 (attendance에서 양수 값만)
    let classUnits = 0;
    Object.entries(student.attendance).forEach(([, val]) => {
      if (typeof val === 'number' && val > 0) classUnits += val;
    });
    if (classUnits <= 0) return 0;
    return Math.ceil(classUnits * calculateClassRate(settingItem, salaryConfig.academyFee));
  }, [showSettlement, student, salaryConfig]);

  // 반이동 여부 감지: endDate가 있지만 다른 수업에 활성 enrollment가 존재
  // 현재 반이 끝날 때 다음 활성 반이 있는지 확인 (to 다음 반)
  const transferToInfo = useMemo(() => {
    if (!student.endDate || !student.enrollments?.length || !student.group) return null;
    const today = formatDateKey(new Date());
    const target = student.enrollments.find((e: any) => {
      const className = e.className || e.group || '';
      if (className === student.group) return false;
      const startDate = typeof e.startDate === 'string' ? e.startDate : '';
      const endDate = e.endDate || e.withdrawalDate || '';
      return startDate <= today && (!endDate || endDate >= today);
    });
    if (!target) return null;
    return {
      teacher: target.teacher || '',
      className: target.className || target.group || '',
    };
  }, [student.endDate, student.enrollments, student.group]);

  // 과목 판별 헬퍼 함수 (className 기반)
  const getSubjectFromClassName = useCallback((className: string): string => {
    if (!className) return 'unknown';
    // 영어: 대문자 2~3글자 + 숫자 패턴 (예: AB1, ABC2)
    if (/^[A-Z]{2,3}\d/.test(className)) return 'english';
    // 수학: 그 외 모든 경우
    return 'math';
  }, []);

  // 특정 날짜에 현재 반 시작 전에 **같은 과목**의 다른 반이 있었는지 확인 (from 이전 반)
  const getPreviousEnrollmentOnDate = useCallback((dateKey: string) => {
    if (!student.enrollments?.length || !student.group) return null;

    // 현재 반의 enrollmentDate 찾기
    const currentEnrollment = student.enrollments.find((e: any) => {
      const className = e.className || e.group || '';
      return className === student.group;
    });

    if (!currentEnrollment) return null;
    const currentStartDate = currentEnrollment.enrollmentDate || currentEnrollment.startDate || '';

    // dateKey가 현재 반 시작일이 아니면 null
    if (dateKey !== currentStartDate) return null;

    // 현재 반의 과목 판별 (subject prop 우선, 없으면 className으로 유추)
    const currentSubject = subject || getSubjectFromClassName(student.group);

    // 현재 반 시작일 이전에 시작한 **같은 과목**의 다른 반이 있는지 찾기
    const target = student.enrollments.find((e: any) => {
      const className = e.className || e.group || '';
      if (className === student.group) return false; // 현재 반 제외

      // 과목이 다르면 제외 (영어 출석부에서는 영어 반만, 수학 출석부에서는 수학 반만)
      const enrollmentSubject = getSubjectFromClassName(className);
      if (enrollmentSubject !== currentSubject) return false;

      const startDate = typeof e.startDate === 'string' ? e.startDate : e.enrollmentDate || '';

      // 이전 반: 시작일이 현재 반 시작일보다 이전이면 OK
      return startDate && startDate < currentStartDate;
    });

    if (!target) return null;
    return {
      teacher: target.teacher || '',
      className: target.className || target.group || '',
    };
  }, [student.enrollments, student.group, subject, getSubjectFromClassName]);

  // 드롭다운 위치 계산 및 열기/닫기
  const toggleDropdown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSalarySettingChange) return;
    if (showSalaryDropdown) {
      setShowSalaryDropdown(false);
      return;
    }
    const btn = salaryBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowSalaryDropdown(true);
  }, [onSalarySettingChange, showSalaryDropdown]);

  // 급여 설정 드롭다운 외부 클릭 시 닫기 + 스크롤 시 닫기
  useEffect(() => {
    if (!showSalaryDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        salaryBtnRef.current?.contains(target) ||
        salaryDropdownRef.current?.contains(target)
      ) return;
      setShowSalaryDropdown(false);
    };
    const handleScroll = () => setShowSalaryDropdown(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showSalaryDropdown]);

  // Merge attendance with pending updates for stats calculation within the row
  // Note: This only affects the "Attended Units" count displayed in the row.
  const attendanceDisplay = { ...student.attendance, ...pendingUpdates };

  const attendedUnits = Object.entries(attendanceDisplay)
    .filter(([k, v]) => k.startsWith(currentMonthStr) && (v as number) > 0)
    .reduce((acc, [_, v]) => acc + (v as number), 0);

  // 급여 설정 우선순위: 수업별 override > 학생 기본값 > 학교 기반 자동 매칭
  const salarySettingOverrideId = student.salarySettingOverrides?.[student.group || ''];
  const effectiveSalarySettingId = salarySettingOverrideId || student.salarySettingId;
  const salarySetting = effectiveSalarySettingId
    ? salaryConfig.items.find(item => item.id === effectiveSalarySettingId)
    : getSchoolLevelSalarySetting(student.school, salaryConfig.items);
  const levelName = salarySetting ? salarySetting.name : '미설정';
  const badgeStyle = salarySetting ? getBadgeStyle(salarySetting.color) : undefined;
  const badgeClass = salarySetting ? 'border' : 'bg-gray-100 text-gray-500 border-gray-200';
  const { isNew, isLeaving } = getStudentStatus(student, currentDate);

  return (
    <tr className="group hover:bg-gray-50 transition-colors">
      {/* Fixed Columns - Compact */}
      <td className="p-1 sticky left-0 z-[90] bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 text-center text-primary-700/50 font-mono text-xxs align-middle w-8">
        {idx}
      </td>
      <td className="p-1 sticky left-8 z-[90] bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 align-middle w-[90px]">
        <button
          onClick={() => onEditStudent(student)}
          className="text-left w-full hover:text-primary font-bold text-primary-700 truncate flex items-center gap-0.5 text-xs"
        >
          <span className="truncate">{student.name}</span>
          {isNew && (
            <span className="inline-flex items-center px-1 py-0.5 rounded-sm bg-accent text-primary text-nano font-extrabold">
              N
            </span>
          )}
          {isLeaving && (
            <span className="inline-flex items-center p-0.5 rounded-sm bg-red-100 text-red-600" title="퇴원 예정">
              <LogOut size={10} />
            </span>
          )}
        </button>
      </td>
      <td className="p-1 sticky left-[122px] z-[90] bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 align-middle w-[80px]">
        <div className="flex flex-col gap-0.5 justify-center">
          <div className="text-xxs text-primary-700 font-medium truncate" title={formatSchoolGrade(student.school, student.grade, { numberLast: true })}>
            {formatSchoolGrade(student.school, student.grade, { numberLast: true })}
          </div>
          <button
            ref={salaryBtnRef}
            type="button"
            onClick={toggleDropdown}
            className={`text-micro px-1.5 py-0.5 rounded-sm w-fit font-bold ${badgeClass} ${onSalarySettingChange ? 'cursor-pointer hover:opacity-80 active:scale-95 transition-all' : ''}`}
            style={badgeStyle}
            title={onSalarySettingChange ? '클릭하여 급여 설정 변경' : undefined}
          >
            {levelName}
          </button>
          {/* 급여 설정 드롭다운 - Portal로 body에 렌더링하여 overflow/z-index 문제 회피 */}
          {showSalaryDropdown && onSalarySettingChange && dropdownPos && createPortal(
            <div
              ref={salaryDropdownRef}
              className="fixed bg-white rounded-sm shadow-xl border border-gray-200 py-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
              style={{ top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
            >
              <div className="px-2 py-1 text-micro font-semibold text-gray-400 border-b border-gray-100">
                급여 설정 선택
              </div>
              {/* 자동 (미설정) 옵션 */}
              <button
                type="button"
                onClick={() => {
                  onSalarySettingChange(student.id, student.group || '', null);
                  setShowSalaryDropdown(false);
                }}
                className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 ${!salarySettingOverrideId ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}
              >
                <span className="w-2 h-2 rounded-sm bg-gray-300"></span>
                자동 (학교 기반)
              </button>
              {/* 급여 설정 항목들 */}
              {salaryConfig.items.map((item) => {
                const itemBadgeStyle = getBadgeStyle(item.color);
                const isSelected = salarySettingOverrideId === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      onSalarySettingChange(student.id, student.group || '', item.id);
                      setShowSalaryDropdown(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}
                  >
                    <span
                      className="w-2 h-2 rounded-sm border"
                      style={{ backgroundColor: itemBadgeStyle?.backgroundColor, borderColor: itemBadgeStyle?.borderColor }}
                    ></span>
                    {item.name}
                  </button>
                );
              })}
            </div>,
            document.body
          )}
        </div>
      </td>

      {/* Stat Cells - Compact & Sticky */}
      <td className="p-1 sticky left-[202px] z-[90] border-r border-b border-gray-200 text-center text-gray-500 bg-[#f8f9fa] font-mono align-middle w-[70px]">
        <div className="flex flex-wrap justify-center gap-0.5">
          {[...(student.days || [])].sort((a, b) => {
            const order = ['월', '화', '수', '목', '금', '토', '일'];
            return order.indexOf(a[0]) - order.indexOf(b[0]);
          }).map(d => {
            const dayChar = d[0];
            let colorClass = "bg-gray-200 text-gray-800";
            if (dayChar === '토') colorClass = "bg-blue-200 text-blue-800";
            if (dayChar === '일') colorClass = "bg-red-200 text-red-800";
            return (
              <span key={d} className={`text-xxs px-1.5 py-px rounded-sm font-bold ${colorClass}`}>{dayChar}</span>
            );
          })}
        </div>
      </td>
      {showExpectedBilling && (
        <td className="p-1 sticky left-[272px] z-[90] border-r border-b border-gray-200 text-center bg-[#fefce8] align-middle w-[60px]" title={`발행예정: ${expectedBilling.toLocaleString()}원`}>
          <span className="text-xxs font-bold text-amber-700">{expectedBilling > 0 ? expectedBilling.toLocaleString() : '-'}</span>
        </td>
      )}
      {showSettlement && (
        <td className="p-1 sticky z-[90] border-r border-b border-gray-200 text-center bg-[#eff6ff] align-middle w-[60px]" style={{ left: 272 + (showExpectedBilling ? 60 : 0) }} title={`정산액: ${settlementAmount.toLocaleString()}원`}>
          <span className="text-xxs font-bold text-blue-700">{settlementAmount > 0 ? settlementAmount.toLocaleString() : '-'}</span>
        </td>
      )}
      <td className="p-1 sticky z-[90] border-r border-b border-gray-200 text-center font-bold text-primary bg-[#f0f4f8] align-middle w-[36px] text-xs" style={{ left: 272 + (showExpectedBilling ? 60 : 0) + (showSettlement ? 60 : 0) }}>
        {attendedUnits}
      </td>

      {/* 등록차수 셀 */}
      <td className="p-1 sticky z-[90] border-r border-b border-gray-200 text-center bg-white group-hover:bg-gray-50 align-middle w-[36px]" style={{ left: 308 + (showExpectedBilling ? 60 : 0) + (showSettlement ? 60 : 0) }}>
        {enrollmentTerm && enrollmentTerm.currentTermNumber > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              onEnrollmentTermClick?.(student.id, student.name, { top: rect.bottom + 4, left: rect.left });
            }}
            className="text-xxs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1 py-0.5 rounded transition-colors"
            title={`${enrollmentTerm.currentTermNumber}차 등록 (클릭하여 상세보기)`}
          >
            {enrollmentTerm.currentTermNumber}차
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              onEnrollmentTermClick?.(student.id, student.name, { top: rect.bottom + 4, left: rect.left });
            }}
            className="text-xxs text-gray-300 hover:text-gray-500 hover:bg-gray-50 px-1 py-0.5 rounded transition-colors"
            title="등록차수 없음 (클릭하여 추가)"
          >
            -
          </button>
        )}
      </td>

      {/* 숨긴 열 표시 칸 (헤더의 Eye 아이콘 열과 정렬) */}
      {hasHiddenDates && (
        <td className="p-0 border-r border-b border-gray-200 w-[30px] bg-gray-50" />
      )}

      {/* Attendance Cells - 4-Quadrant Design */}
      {days.map((day, dayIndex) => {
        const dateKey = formatDateKey(day);
        const compositeKey = `${student.group || ''}::${dateKey}`;
        const { day: dayName } = formatDateDisplay(day);
        const status = pendingUpdates?.[compositeKey] ?? student.attendance[compositeKey] ?? student.attendance[dateKey];
        const memo = pendingMemos?.[compositeKey] ?? student.memos?.[compositeKey] ?? student.memos?.[dateKey];
        const isSaturday = day.getDay() === 6;
        const isSunday = day.getDay() === 0;
        const isHoliday = holidayDateSet.has(dateKey);
        const holidayName = holidayNameMap.get(dateKey);
        const isWeekend = isSaturday || isSunday;
        // 공휴일은 수업 없음 - 출석 요일이어도 흰색 처리
        const isScheduled = !isHoliday && (student.days || []).includes(dayName);

        // Validity Check
        const isValid = isDateValidForStudent(dateKey, student);

        // 첫수업/퇴원 경계 감지 (회색→흰색 전환점에 라벨 표시)
        const nextDay = dayIndex + 1 < days.length ? days[dayIndex + 1] : null;
        const prevDay = dayIndex > 0 ? days[dayIndex - 1] : null;
        const nextIsValid = nextDay ? isDateValidForStudent(formatDateKey(nextDay), student) : false;
        const prevIsValid = prevDay ? isDateValidForStudent(formatDateKey(prevDay), student) : false;
        const isFirstClassBoundary = !isValid && nextIsValid; // 회색 셀인데 다음이 흰색 → "첫수업" or "반이동"
        const isEndBoundary = !isValid && prevIsValid; // 회색 셀인데 이전이 흰색 → "퇴원" or "반이동"

        // 시작 경계: 이전 반에서 왔는지 확인
        const transferFromInfo = isFirstClassBoundary ? getPreviousEnrollmentOnDate(dateKey) : null;

        // 과제 완료 여부 (Q2: 1시 방향)
        const homeworkDone = student.homework?.[compositeKey] ?? student.homework?.[dateKey] ?? false;

        // 해당 날짜의 시험 목록 조회
        const examsOnDate = examsByDate?.get(dateKey) || [];

        // 해당 학생의 시험 점수 조회
        const studentScores = scoresByStudent?.get(student.id);

        // 시험 점수 데이터 추출 (최대 2개: Q4=쪽지시험, Q3=기타시험)
        let dailyExamScore: StudentScore | null = null;
        let otherExamScore: StudentScore | null = null;

        examsOnDate.forEach(exam => {
          const score = studentScores?.get(exam.id);
          if (score) {
            if (exam.type === 'daily') {
              dailyExamScore = score;
            } else if (!otherExamScore) {
              otherExamScore = score;
            }
          }
        });

        // Cell base class for invalid/valid states
        let cellBaseClass = "";
        if (!isValid) {
          cellBaseClass = "bg-slate-200 bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%,transparent_50%,#cbd5e1_50%,#cbd5e1_75%,transparent_75%,transparent)] bg-[length:8px_8px] cursor-not-allowed shadow-inner border-slate-200";
        }

        // 커스텀 셀 색상 조회 (복합키 우선, 레거시 dateKey 폴백)
        const customCellColor = student.cellColors?.[compositeKey] ?? student.cellColors?.[dateKey];
        const customColorConfig = customCellColor ? PREDEFINED_CELL_COLORS.find(c => c.key === customCellColor) : null;

        // 커스텀 색상이 있으면 전체 셀에 적용
        const hasCustomColor = !!customColorConfig;
        const customBgStyle: React.CSSProperties | undefined = hasCustomColor
          ? { backgroundColor: customColorConfig.hex }
          : undefined;
        const customBgLightStyle: React.CSSProperties | undefined = hasCustomColor
          ? { backgroundColor: customColorConfig.hex, opacity: 0.6 }
          : undefined;

        // Q1 (출석) 스타일 - 커스텀 색상 또는 기본 색상 유지 (출석값과 무관)
        let q1BgClass = "";
        let q1BgStyle: React.CSSProperties | undefined;
        let q1Content: React.ReactNode = null;

        if (isValid) {
          // 배경색: 커스텀 색상 > 등록요일 주황색 > 비등록 흰색 (출석값과 무관하게 유지)
          if (hasCustomColor) {
            q1BgStyle = customBgStyle;
            q1BgClass = "hover:brightness-95";
          } else if (isScheduled) {
            q1BgClass = "bg-orange-200 hover:bg-orange-300";
          } else {
            q1BgClass = highlightWeekends && isWeekend ? "bg-gray-300 hover:bg-gray-400" : "bg-white hover:bg-gray-50";
          }

          // 출석값 표시
          if (status !== undefined && status !== null) {
            if (status === 0) {
              // 결석: 배경 빨간색으로 강조
              q1BgClass = "bg-red-500 hover:bg-red-600";
              q1BgStyle = undefined;
              q1Content = <span className="text-white font-black text-xs drop-shadow-sm">0</span>;
            } else {
              q1Content = <span className="text-gray-800 font-bold text-xs">{status}</span>;
            }
          }
        }

        // Q2, Q3, Q4 배경 - 커스텀 색상 전체 적용 또는 등록 요일 색상
        const getQuadrantBg = (isLighter: boolean = true) => {
          if (!isValid) return { className: "bg-white" };
          if (hasCustomColor) {
            // 커스텀 색상 전체 적용 (연한 버전)
            return { style: isLighter ? customBgLightStyle : customBgStyle, className: "hover:brightness-95" };
          }
          // 주말/공휴일 회색 처리
          const defaultBg = highlightWeekends && isWeekend ? "bg-gray-300" : "bg-white";
          return { className: isScheduled ? "bg-orange-100/50" : defaultBg };
        };
        const otherQuadrantProps = getQuadrantBg(true);

        return (
          <td
            key={dateKey}
            onContextMenu={(e) => onContextMenu(e, student, dateKey, isValid)}
            className={`p-0 border-r border-b border-gray-200 text-center text-xxs font-medium relative ${cellBaseClass} align-middle ${
              highlightWeekends && isWeekend && isValid ? 'bg-gray-300' : ''
            }`}
            title={holidayName ? `🎉 ${holidayName}${memo ? ` | 메모: ${memo}` : ''}` : (memo ? `메모: ${memo}` : undefined)}
          >
            {isValid ? (
              // 4등분 레이아웃 - 주말/공휴일 회색 처리 시 배경색 조정
              <div className={`grid grid-cols-2 grid-rows-2 w-full h-full min-h-[36px] ${
                highlightWeekends && isWeekend ? 'bg-gray-300' : ''
              }`}>
                {/* Q1: 출석 (좌상단) - 11시 방향 */}
                <div
                  onClick={() => onCellClick(student.id, student.group || '', dateKey, status, isValid)}
                  className={`flex items-center justify-center border-r border-b ${highlightWeekends && isWeekend ? 'border-gray-400' : 'border-gray-300/50'} cursor-pointer transition-colors ${q1BgClass}`}
                  style={q1BgStyle}
                >
                  {q1Content}
                </div>
                {/* Q2: 과제 (우상단) - 1시 방향 */}
                <div
                  onClick={() => onHomeworkChange?.(student.id, student.group || '', dateKey, !homeworkDone)}
                  className={`flex items-center justify-center border-b ${highlightWeekends && isWeekend ? 'border-gray-400' : 'border-gray-300/50'} cursor-pointer transition-colors ${
                    homeworkDone
                      ? 'bg-emerald-100 hover:bg-emerald-200'
                      : otherQuadrantProps.className || 'hover:brightness-95'
                  }`}
                  style={!homeworkDone ? otherQuadrantProps.style : undefined}
                  title={homeworkDone ? '과제 완료' : '과제 미완료'}
                >
                  {homeworkDone && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                </div>
                {/* Q4: 쪽지시험 (좌하단) - 7시 방향 */}
                <div
                  className={`flex items-center justify-center border-r ${highlightWeekends && isWeekend ? 'border-gray-400' : 'border-gray-300/50'} ${
                    dailyExamScore
                      ? GRADE_COLORS[dailyExamScore.grade || 'F'].bg
                      : otherQuadrantProps.className || ''
                  }`}
                  style={!dailyExamScore ? otherQuadrantProps.style : undefined}
                  title={dailyExamScore ? `쪽지시험: ${dailyExamScore.score}/${dailyExamScore.maxScore} (${dailyExamScore.grade})` : undefined}
                >
                  {dailyExamScore && (
                    <span className={`text-nano font-bold ${GRADE_COLORS[dailyExamScore.grade || 'F'].text}`}>
                      {dailyExamScore.grade || Math.round(dailyExamScore.percentage || 0)}
                    </span>
                  )}
                </div>
                {/* Q3: 시험 (우하단) - 5시 방향 */}
                <div
                  className={`flex items-center justify-center ${
                    otherExamScore
                      ? GRADE_COLORS[otherExamScore.grade || 'F'].bg
                      : otherQuadrantProps.className || ''
                  }`}
                  style={!otherExamScore ? otherQuadrantProps.style : undefined}
                  title={otherExamScore ? `시험: ${otherExamScore.score}/${otherExamScore.maxScore} (${otherExamScore.grade})` : undefined}
                >
                  {otherExamScore && (
                    <span className={`text-nano font-bold ${GRADE_COLORS[otherExamScore.grade || 'F'].text}`}>
                      {otherExamScore.grade || Math.round(otherExamScore.percentage || 0)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full min-h-[36px] flex items-center justify-center">
                {isFirstClassBoundary && (
                  transferFromInfo
                    ? <span
                        className="text-micro font-black text-violet-700 bg-violet-100 border border-violet-400 rounded-sm px-1 py-0.5 animate-pulse whitespace-nowrap cursor-help"
                        title={`반이동: ${transferFromInfo.teacher ? transferFromInfo.teacher + ' 선생님' : ''} ${transferFromInfo.className} → ${student.group}`.trim()}
                      >반이동</span>
                    : <span className="text-micro font-black text-emerald-700 bg-emerald-100 border border-emerald-400 rounded-sm px-1 py-0.5 animate-pulse whitespace-nowrap">첫수업</span>
                )}
                {isEndBoundary && (
                  transferToInfo
                    ? <span
                        className="text-micro font-black text-violet-700 bg-violet-100 border border-violet-400 rounded-sm px-1 py-0.5 animate-pulse whitespace-nowrap cursor-help"
                        title={`반이동: ${student.group} → ${transferToInfo.teacher ? transferToInfo.teacher + ' 선생님' : ''} ${transferToInfo.className}`.trim()}
                      >반이동</span>
                    : <span className="text-micro font-black text-gray-700 bg-gray-100 border border-gray-400 rounded-sm px-1 py-0.5 whitespace-nowrap">퇴원</span>
                )}
              </div>
            )}
            {/* Memo Indicator: Red Triangle in top-right */}
            {memo && (
              <div className="absolute top-0 right-0 w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-red-500/80 z-10" />
            )}
          </td>
        );
      })}
    </tr>
  );
});

StudentRow.displayName = 'StudentRow';

export default StudentRow;
