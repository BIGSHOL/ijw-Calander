import React from 'react';
import { isHolidayDate } from '../../utils/tuitionHolidays';
import { TuitionSubjectType } from '../../types/tuition';
import type {
  TuitionSelectedCourse, TuitionSelectedExtra, TuitionSelectedDiscount,
  TuitionStudentInfo, TuitionSessionPeriod, TuitionDateRange,
} from '../../types/tuition';

interface TuitionInvoicePreviewProps {
  studentInfo: TuitionStudentInfo;
  selectedCourses: TuitionSelectedCourse[];
  selectedExtras: TuitionSelectedExtra[];
  selectedDiscounts: TuitionSelectedDiscount[];
  sessionPeriods: TuitionSessionPeriod[];
  holidayDateSet: Set<string>;
}

// 월별 분리된 과목 행 타입
interface MonthlyCourseLine {
  month: string;
  category: string;
  name: string;
  days: string;
  sessions: number;
  price: number;
  note: string;
  originalUid: string;
  isSubtotal?: boolean;
}

// YYYY-MM-DD 문자열을 로컬 시간대 기준 Date로 파싱
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// 요일 문자열을 요일 인덱스 배열로 변환
const parseDays = (daysStr: string): number[] => {
  const dayMap: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  return daysStr.split(',').map(d => dayMap[d.trim()]).filter(n => n !== undefined);
};

// 기간 내 특정 요일의 횟수 계산 (공휴일 제외 옵션 포함)
const countSessionsInRange = (
  start: Date, end: Date, dayIndexes: number[],
  excludeHolidays: boolean = false, holidayDateSet: Set<string> = new Set(),
): number => {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (dayIndexes.includes(current.getDay())) {
      if (!(excludeHolidays && isHolidayDate(current, holidayDateSet))) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

// 과목 카테고리 → 세션 카테고리 매핑 (Firestore 세션은 영문 키 사용)
const mapCategoryToSessionCategory = (category: string): string | null => {
  if (category === '수학') return 'math';
  if (category === '영어') return 'english';
  if (category === 'EIE') return 'eie';
  return null;
};

// 두 기간의 겹치는 범위 반환
const getOverlappingRange = (
  start1: Date, end1: Date, start2: Date, end2: Date,
): { start: Date; end: Date } | null => {
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  return overlapStart <= overlapEnd ? { start: overlapStart, end: overlapEnd } : null;
};

// 과목을 월별로 분리 (세션 적용 과목 포함)
const splitCoursesByMonth = (
  courses: TuitionSelectedCourse[],
  startDate: string,
  endDate: string,
  sessionPeriods: TuitionSessionPeriod[],
  holidayDateSet: Set<string>,
): MonthlyCourseLine[] => {
  if (!startDate || !endDate) return [];

  const enrollStart = parseLocalDate(startDate);
  const enrollEnd = parseLocalDate(endDate);
  const result: MonthlyCourseLine[] = [];

  for (const course of courses) {
    const dayIndexes = course.days ? parseDays(course.days) : [];
    const courseLines: MonthlyCourseLine[] = [];
    let courseSubtotal = 0;
    let courseTotalSessions = 0;

    if (course.useSessionPeriod) {
      // 세션 적용 과목: 세션 기간 기반으로 월별 분리
      const sessionCategory = mapCategoryToSessionCategory(course.category);
      if (sessionCategory) {
        const relevantSessions = sessionPeriods.filter(
          s => s.category === sessionCategory && s.ranges && s.ranges.length > 0
        );

        for (const session of relevantSessions) {
          for (const range of session.ranges as TuitionDateRange[]) {
            const rangeStart = parseLocalDate(range.startDate);
            const rangeEnd = parseLocalDate(range.endDate);
            const overlap = getOverlappingRange(enrollStart, enrollEnd, rangeStart, rangeEnd);

            if (overlap) {
              const sessionsInRange = dayIndexes.length > 0
                ? countSessionsInRange(overlap.start, overlap.end, dayIndexes, course.excludeHolidays, holidayDateSet)
                : 0;

              if (sessionsInRange > 0) {
                const existingLine = courseLines.find(l => l.month === `${session.month}월`);
                if (existingLine) {
                  existingLine.sessions += sessionsInRange;
                } else {
                  courseLines.push({
                    month: `${session.month}월`,
                    category: course.category,
                    name: course.name,
                    days: course.days,
                    sessions: sessionsInRange,
                    price: 0,
                    note: '',
                    originalUid: course.uid,
                  });
                }
                courseTotalSessions += sessionsInRange;
              }
            }
          }
        }

        // 월 순서로 정렬
        courseLines.sort((a, b) => parseInt(a.month) - parseInt(b.month));

        // 회당 단가로 금액 계산
        if (courseTotalSessions > 0) {
          courseLines.forEach((line, idx) => {
            line.price = course.defaultPrice * line.sessions;
            courseSubtotal += line.price;
            if (idx === 0) line.note = course.note || '';
          });
        }
      }
    } else {
      // 기존 방식: 수강 기간 기준 월별 분리
      const months: Array<{ year: number; month: number; start: Date; end: Date }> = [];
      const current = new Date(enrollStart.getFullYear(), enrollStart.getMonth(), 1);

      while (current <= enrollEnd) {
        const monthStart = new Date(Math.max(
          new Date(current.getFullYear(), current.getMonth(), 1).getTime(),
          enrollStart.getTime()
        ));
        const monthEnd = new Date(Math.min(
          new Date(current.getFullYear(), current.getMonth() + 1, 0).getTime(),
          enrollEnd.getTime()
        ));
        months.push({ year: current.getFullYear(), month: current.getMonth() + 1, start: monthStart, end: monthEnd });
        current.setMonth(current.getMonth() + 1);
      }

      const totalSessions = course.sessions || 1;
      const pricePerSession = course.price / totalSessions;

      for (const monthInfo of months) {
        const sessionsInMonth = dayIndexes.length > 0
          ? countSessionsInRange(monthInfo.start, monthInfo.end, dayIndexes, course.excludeHolidays, holidayDateSet)
          : 0;

        if (sessionsInMonth > 0) {
          const monthPrice = Math.round(pricePerSession * sessionsInMonth);
          courseSubtotal += monthPrice;
          courseTotalSessions += sessionsInMonth;
          courseLines.push({
            month: `${monthInfo.month}월`,
            category: course.category,
            name: course.name,
            days: course.days,
            sessions: sessionsInMonth,
            price: monthPrice,
            note: courseLines.length === 0 ? (course.note || '') : '',
            originalUid: course.uid,
          });
        }
      }
    }

    result.push(...courseLines);

    // 2개월 이상에 걸치면 소계 행 추가
    if (courseLines.length > 1) {
      result.push({
        month: '',
        category: course.category,
        name: `${course.name} 소계`,
        days: '',
        sessions: courseTotalSessions,
        price: courseSubtotal,
        note: '',
        originalUid: course.uid,
        isSubtotal: true,
      });
    }
  }

  return result;
};

export const TuitionInvoicePreview: React.FC<TuitionInvoicePreviewProps> = ({
  studentInfo, selectedCourses, selectedExtras, selectedDiscounts, sessionPeriods, holidayDateSet,
}) => {
  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });

  const monthlyLines = splitCoursesByMonth(
    selectedCourses, studentInfo.startDate, studentInfo.endDate, sessionPeriods, holidayDateSet,
  );

  const isSingleMonth = () => {
    if (!studentInfo.startDate || !studentInfo.endDate) return true;
    const start = parseLocalDate(studentInfo.startDate);
    const end = parseLocalDate(studentInfo.endDate);
    return start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  };

  const displayLines = isSingleMonth() ? null : monthlyLines;

  const courseTotal = selectedCourses.reduce((acc, curr) => acc + curr.price, 0);
  const extraTotal = selectedExtras.reduce((acc, curr) => acc + curr.price, 0);
  const discountTotal = selectedDiscounts.reduce((acc, curr) => acc + curr.amount, 0);
  const finalTotal = courseTotal + extraTotal - discountTotal;

  return (
    <div className="w-full h-full bg-white shadow-2xl print:shadow-none flex flex-col overflow-hidden">
      {/* 로고 */}
      <div className="p-4 print:p-2 print:pb-1">
        <img
          src="/logo_garo.png"
          alt="인재원 로고"
          className="h-16 print:h-12 object-contain"
        />
      </div>

      {/* 헤더 */}
      <div className="p-8 pt-2 pb-4 print:px-0 print:py-2 print:pb-1 border-b-4 border-double border-[#081429]">
        <h1 className="text-3xl print:text-xl font-black text-center text-[#081429] mb-8 print:mb-2 tracking-widest">
          수강료 안내문
        </h1>
        <div className="border-2 border-[#081429]">
          <div className="flex border-b border-[#373d41]">
            <div className="w-24 bg-[#081429]/10 p-2 text-center font-bold flex items-center justify-center text-sm border-r border-[#373d41] text-[#081429]">학생 이름</div>
            <div className="flex-1 p-2 text-center font-medium flex items-center justify-center border-r border-[#373d41]">{studentInfo.name || '-'}</div>
            <div className="w-24 bg-[#081429]/10 p-2 text-center font-bold flex items-center justify-center text-sm border-r border-[#373d41] text-[#081429]">학교/학년</div>
            <div className="flex-1 p-2 text-center font-medium flex items-center justify-center border-r border-[#373d41]">{studentInfo.school || '-'}</div>
            <div className="w-24 bg-[#081429]/10 p-2 text-center font-bold flex items-center justify-center text-sm border-r border-[#373d41] text-[#081429]">작성일</div>
            <div className="flex-1 p-2 text-center font-medium flex items-center justify-center">{currentDate}</div>
          </div>
          <div className="flex">
            <div className="w-24 bg-[#081429]/10 p-2 text-center font-bold flex items-center justify-center text-sm border-r border-[#373d41] text-[#081429]">수강 기간</div>
            <div className="flex-1 p-2 text-center font-medium text-[#373d41] flex items-center justify-center">
              {studentInfo.startDate || '____.__.__'}
              <span className="mx-2">~</span>
              {studentInfo.endDate || '____.__.__'}
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 pt-4 print:px-0 print:py-1 flex-1 flex flex-col">
        {/* 과목 테이블 */}
        <div className="mb-4 print:mb-1">
          <table className="w-full text-sm print:text-xs border-collapse border-2 border-[#081429]">
            <thead>
              <tr className="bg-[#fdb813]/20 text-[#081429]">
                <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[15%]">과목</th>
                <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[30%]">반</th>
                <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[15%]">요일</th>
                <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[10%]">시수</th>
                <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[15%]">금액</th>
                <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[15%]">기타</th>
              </tr>
            </thead>
            <tbody>
              {displayLines ? (
                displayLines.map((line, idx) => {
                  const isSubtotal = line.isSubtotal;
                  return (
                    <tr key={idx} className={isSubtotal ? 'bg-[#081429]/5' : ''}>
                      <td className={`border border-[#373d41] p-1.5 print:p-0.5 text-center font-bold ${
                        line.category === TuitionSubjectType.ENGLISH ? 'text-[#081429]' : 'text-[#373d41]'
                      }`}>
                        {isSubtotal ? '' : `${line.month} ${line.category}`}
                      </td>
                      <td className={`border border-[#373d41] p-1.5 print:p-0.5 text-center ${isSubtotal ? 'font-bold text-[#081429]' : ''}`}>
                        {line.name}
                      </td>
                      <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center">{line.days}</td>
                      <td className={`border border-[#373d41] p-1.5 print:p-0.5 text-center ${isSubtotal ? 'font-bold' : ''}`}>
                        {`${line.sessions}회`}
                      </td>
                      <td className={`border border-[#373d41] p-1.5 print:p-0.5 text-right font-medium ${isSubtotal ? 'font-bold text-[#081429]' : ''}`}>
                        {`${line.price.toLocaleString()}원`}
                      </td>
                      <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center text-xs text-[#373d41]">{line.note}</td>
                    </tr>
                  );
                })
              ) : (
                selectedCourses.map((course, idx) => (
                  <tr key={idx}>
                    <td className={`border border-[#373d41] p-1.5 print:p-0.5 text-center font-bold ${
                      course.category === TuitionSubjectType.ENGLISH ? 'text-[#081429]' : 'text-[#373d41]'
                    }`}>
                      {course.category}
                    </td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center">{course.name}</td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center">{course.days}</td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center">{`${course.sessions}회`}</td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-right font-medium">
                      {`${course.price.toLocaleString()}원`}
                    </td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center text-xs text-[#373d41]">{course.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 기타/할인 테이블 */}
        {(selectedExtras.length > 0 || selectedDiscounts.length > 0) && (
          <div className="mb-4 print:mb-1">
            <table className="w-full text-sm print:text-xs border-collapse border-2 border-[#081429]">
              <thead>
                <tr className="bg-[#fdb813]/20 text-[#081429]">
                  <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[25%]">구분</th>
                  <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[45%]">상세내용</th>
                  <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[15%]">금액</th>
                  <th className="border border-[#373d41] p-1.5 print:p-0.5 w-[15%]">기타</th>
                </tr>
              </thead>
              <tbody>
                {selectedExtras.map((extra, idx) => (
                  <tr key={`extra-${idx}`}>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center">
                      {extra.category === 'textbook' ? '교재비' : extra.name}
                    </td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center">
                      {extra.category === 'textbook' ? extra.name : (extra.note || '-')}
                    </td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-right">
                      {extra.price.toLocaleString()}원
                    </td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center text-xs text-[#373d41]">
                      {extra.category === 'textbook' ? extra.note : ''}
                    </td>
                  </tr>
                ))}
                {selectedExtras.length > 1 && (
                  <tr className="bg-[#081429]/5">
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center"></td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center font-bold text-[#081429]">기타 소계</td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-right font-bold text-[#081429]">{extraTotal.toLocaleString()}원</td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center"></td>
                  </tr>
                )}
                {selectedDiscounts.map((discount, idx) => (
                  <tr key={`discount-${idx}`}>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center font-bold text-[#081429]">할인</td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center text-[#081429]">{discount.name}</td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-right font-bold text-[#081429]">
                      -{discount.amount.toLocaleString()}원
                    </td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center"></td>
                  </tr>
                ))}
                {selectedDiscounts.length > 1 && (
                  <tr className="bg-[#081429]/5">
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center"></td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center font-bold text-[#081429]">할인 소계</td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-right font-bold text-[#081429]">
                      -{discountTotal.toLocaleString()}원
                    </td>
                    <td className="border border-[#373d41] p-1.5 print:p-0.5 text-center"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 최종 납부 금액 */}
        <div className="flex justify-end mb-4 print:mb-1">
          <div className="flex items-center border-2 border-[#081429]">
            <div className="bg-[#081429]/10 px-3 py-1.5 print:px-2 print:py-0.5">
              <span className="font-bold text-[#081429] text-sm print:text-xs">최종 납부 금액</span>
            </div>
            <div className="bg-[#fdb813] px-4 py-1.5 print:px-3 print:py-0.5">
              <span className="text-xl print:text-base font-black text-[#081429]">{finalTotal.toLocaleString()} 원</span>
            </div>
          </div>
        </div>

        {/* 학원 수칙 및 환불 규정 */}
        <div className="mt-auto">
          <h3 className="text-base print:text-sm font-bold text-center text-[#081429] mb-2 print:mb-1">
            학원 수칙 및 환불 규정
          </h3>
          <div className="bg-[#081429]/5 p-3 print:p-2 rounded-lg border border-[#373d41]/30 text-[#373d41] leading-relaxed">
            <h4 className="font-bold text-[#081429] mb-1.5 print:mb-1 text-sm print:text-[10px]">학원 수칙</h4>
            <ul className="list-decimal pl-4 print:pl-3 mb-3 print:mb-2 space-y-0.5 print:space-y-0 text-[13px] print:text-[9px] leading-snug">
              <li>
                규칙적인 학습을 위해 지각, 결석을 허용하지 않으며 별도의 보강이 없습니다.
                <br /><span className="text-[#373d41]/80">(단, 건강상의 문제나 증명가능한 공식행사는 예외 보강이 1회 이루어집니다.)</span>
              </li>
              <li>
                선생님의 지시나 규정을 따르지 않거나 선생님께 무례한행동을 한 경우, 수업 분위기를 해칠 경우, 숙제를 해오지 않을경우 경고장을 받게 됩니다.
                <br /><span className="text-[#373d41]/80">(3회 경고시 퇴원조치 됩니다)</span>
              </li>
              <li>
                학생들의 수업 관리를 위해 수업 최소단위를 준수 합니다.
                <br /><span className="text-[#373d41]/80">(이를 위해 시험기간 중에는 학원 일정에 따라 선 수업으로 진행될 수 있습니다)</span>
              </li>
            </ul>

            <h4 className="font-bold text-[#081429] mb-1.5 print:mb-1 text-sm print:text-[10px]">환불 규정</h4>
            <table className="w-full border-collapse border border-[#373d41]/50 text-[12px] print:text-[8px] text-center mb-2 print:mb-1">
              <thead>
                <tr className="bg-[#081429]/10 font-bold text-[#081429]">
                  <th className="border border-[#373d41]/50 p-1 w-[25%]">구분</th>
                  <th className="border border-[#373d41]/50 p-1 w-[45%]" colSpan={2}>반환사유 발생일</th>
                  <th className="border border-[#373d41]/50 p-1 w-[30%]">반환금액</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-[#373d41]/50 p-1 px-2 text-left">제18조 제2항 제1호 및 제2호의 반환사유에 해당하는 경우</td>
                  <td className="border border-[#373d41]/50 p-1 px-2 text-left" colSpan={2}>교습을 할 수 없거나 교습 장소를 제공할 수 없게 된 날</td>
                  <td className="border border-[#373d41]/50 p-1 px-2 text-left">이미 납부한 교습비등을 일할(日割) 계산한 금액</td>
                </tr>
                <tr>
                  <td className="border border-[#373d41]/50 p-1 px-2 text-left" rowSpan={6}>제18조 제2항 제3호의 반환사유에 해당하는 경우</td>
                  <td className="border border-[#373d41]/50 p-1" rowSpan={4}>교습기간이 1개월 이내인 경우</td>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">교습 시작 전</td>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">이미 납부한 교습비등의 전액</td>
                </tr>
                <tr>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">총 교습시간의 1/3 경과 전</td>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">이미 납부한 교습비등의 2/3에 해당하는 금액</td>
                </tr>
                <tr>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">총 교습시간의 1/2 경과 전</td>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">이미 납부한 교습비 등의 1/2에 해당하는 금액</td>
                </tr>
                <tr>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">총 교습시간의 1/2 경과 후</td>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">반환하지 않음</td>
                </tr>
                <tr>
                  <td className="border border-[#373d41]/50 p-1" rowSpan={2}>교습기간이 1개월을 초과하는 경우</td>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">교습 시작 전</td>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">이미 납부한 교습비등의 전액</td>
                </tr>
                <tr>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2">교습 시작 후</td>
                  <td className="border border-[#373d41]/50 p-1 text-left px-2 break-keep">
                    반환사유가 발생한 해당 월의 반환 대상 교습비등(교습기간이 1개월 이내인 경우의 기준에 따라 산출한 금액을 말한다)과 나머지 월의 교습비 등의 전액을 합산한 금액
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="space-y-0.5 print:space-y-0">
              <p className="text-[12px] print:text-[8px] text-[#373d41] leading-snug">
                1. 총 교습시간은 교습기간 중의 총 교습기간을 말하며, 반환금액의 산정은 반환사유가 발생한 날까지 경과된 교습시간을 기준으로 한다.
              </p>
              <p className="text-[12px] print:text-[8px] text-[#081429] font-bold leading-snug">
                2. 원격교습의 경우 반환금액은 교습내용을 실제 수강한 부분(인터넷으로 수강하거나 학습기기로 저장한 것을 말한다)에 해당하는 금액을 뺀 금액으로 한다.
              </p>
            </div>

            <div className="mt-2 print:mt-1 text-[#373d41]/60 text-[11px] print:text-[7px] text-right">
              * 본 영수증은 소득공제용(현금영수증)으로 사용하실 수 없습니다. 별도 요청 부탁드립니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
