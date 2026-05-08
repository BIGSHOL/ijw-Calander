/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  ORIGINAL TIMETABLE IS READ-ONLY HERE — DO NOT BREAK THIS  ⚠️    ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  이 파일은 "시간표 테스트" 시뮬레이션 환경입니다.                     ║
 * ║  - 진짜 시간표 컴포넌트(TimetableManager) 코드는 0줄 수정함.         ║
 * ║  - TimetableGrid (시각화 sub-component) 만 직접 호출.                ║
 * ║  - 모든 mutation 핸들러는 no-op 으로 주입 → 편집 불가 (read-only).   ║
 * ║  - 원본 Firestore (`classes` 컬렉션) 에 절대 쓰지 않음.               ║
 * ║                                                                      ║
 * ║  금지 import (절대 추가하지 말 것):                                   ║
 * ║    - firebase/firestore 의 setDoc, updateDoc, addDoc, deleteDoc 등   ║
 * ║    - writeBatch, runTransaction, arrayUnion/Remove, increment        ║
 * ║    - 원본 classes 컬렉션을 mutate 하는 모든 mutation 훅              ║
 * ║                                                                      ║
 * ║  허용 import:                                                        ║
 * ║    - 읽기 전용 훅 (useTimetableClasses, useTeachers 등)              ║
 * ║    - 시각 컴포넌트 (TimetableGrid, ClassCard 등 — props 기반)        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import React, { useMemo } from 'react';
import {
  TimetableClass,
  ClassKeywordColor,
  Teacher,
  UserProfile,
  StaffMember,
} from '../../types';
import { useTimetableClasses } from './Math/hooks/useTimetableClasses';
import { useTeachers, useClassKeywords } from '../../hooks/useFirebaseQueries';
import { VideoLoading } from '../Common/VideoLoading';
import TimetableGrid from './Math/components/TimetableGrid';
import { MATH_PERIODS, ALL_WEEKDAYS } from './constants';

interface TimetableTestProps {
  currentUser: UserProfile | null;
  staffMember?: StaffMember;
}

// 모든 편집/드래그 핸들러를 무력화
const NO_OP_VOID = () => {};
const NO_OP_DRAG = (_e?: React.DragEvent) => {};

const TimetableTest: React.FC<TimetableTestProps> = ({ currentUser, staffMember }) => {
  const myName =
    staffMember?.name ??
    currentUser?.name ??
    currentUser?.koreanName ??
    currentUser?.displayName ??
    '';

  const { classes: allClasses = [], loading: classesLoading } = useTimetableClasses();
  const { data: teachers = [] } = useTeachers();
  const { data: classKeywords = [] } = useClassKeywords();

  // 본인 수업 필터 (담임 또는 부담임으로 등록된 수업)
  const myClasses = useMemo<TimetableClass[]>(() => {
    if (!myName) return [];
    return allClasses.filter((cls: TimetableClass) => {
      if (cls.teacher === myName) return true;
      const slotValues = Object.values(cls.slotTeachers ?? {});
      return slotValues.includes(myName);
    });
  }, [allClasses, myName]);

  // 우선 수학 수업만 (TimetableGrid 가 수학 전용 컴포넌트)
  const myMathClasses = useMemo<TimetableClass[]>(
    () => myClasses.filter((c) => c.subject === 'math' || c.subject === '수학'),
    [myClasses]
  );

  // weekDates: 이번 주 월~일 날짜
  const weekDates = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일, 1=월, ..., 6=토
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const result: Record<string, { date: Date; formatted: string }> = {};
    ALL_WEEKDAYS.forEach((day, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      result[day] = {
        date: d,
        formatted: `${d.getMonth() + 1}/${d.getDate()}`,
      };
    });
    return result;
  }, []);

  // teacher 뷰: 본인 1명만 행으로 표시
  const allResources = useMemo(() => (myName ? [myName] : []), [myName]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center gap-3">
        <span className="text-2xl">🧪</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">시간표 테스트 (시뮬레이션)</h1>
            <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded border border-green-300">
              🔒 원본 보호
            </span>
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded border border-gray-300">
              👁️ read-only
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {myName
              ? `${myName} 님의 수학 시간표만 표시 (본인 필터링 검증)`
              : '로그인 정보 없음'}
          </p>
        </div>
        <span className="text-[10px] text-gray-400 font-mono px-2 py-1 bg-gray-100 rounded">
          4단계 · 진짜 그리드 + 본인 필터
        </span>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {classesLoading ? (
          <div className="flex items-center justify-center flex-1">
            <VideoLoading className="h-32" />
          </div>
        ) : !myName ? (
          <Empty>로그인된 사용자 정보를 가져올 수 없습니다.</Empty>
        ) : myMathClasses.length === 0 ? (
          <Empty>
            <span className="font-semibold">{myName}</span> 님이 담당하는{' '}
            <strong>수학</strong> 수업이 없습니다.
            <div className="text-xs text-gray-500 mt-2">
              · 일치 키: <code className="bg-gray-100 px-1 rounded">teacher === "{myName}"</code> 또는{' '}
              <code className="bg-gray-100 px-1 rounded">slotTeachers</code> 에 본인 이름 포함
            </div>
            <div className="text-xs text-gray-500 mt-1">
              · 영어/과학/국어 시간표 그리드는 후속 단계에서 추가 예정
            </div>
          </Empty>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4 min-h-0">
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded mb-3 text-xs text-blue-900 flex items-start gap-2">
              <span>ℹ️</span>
              <span>
                진짜 시간표와 동일한 그리드 컴포넌트를 사용. 모든 편집/드래그 핸들러는
                no-op으로 무력화되어 있어 원본은 절대 변경되지 않습니다. 본인 필터링이
                의도대로 동작하는지 확인하세요.
              </span>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <TimetableGrid
                filteredClasses={myMathClasses}
                allResources={allResources}
                orderedSelectedDays={ALL_WEEKDAYS}
                weekDates={weekDates}
                viewType="teacher"
                currentPeriods={MATH_PERIODS}
                teachers={teachers as Teacher[]}
                searchQuery=""
                canEdit={false}
                mode="view"
                columnWidth="normal"
                rowHeight="normal"
                fontSize="normal"
                showClassName
                showSchool
                showGrade
                showEmptyRooms={false}
                showStudents
                showHoldStudents
                showWithdrawnStudents={false}
                dragOverClassId={null}
                onClassClick={NO_OP_VOID}
                onDragStart={NO_OP_DRAG}
                onDragOver={NO_OP_DRAG}
                onDragLeave={NO_OP_DRAG}
                onDrop={NO_OP_DRAG}
                currentSubjectFilter="math"
                studentMap={{}}
                timetableViewMode="day-based"
                classKeywords={classKeywords as ClassKeywordColor[]}
                isTestView
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-md mx-auto mt-12 bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-700">
    {children}
  </div>
);

export default TimetableTest;
