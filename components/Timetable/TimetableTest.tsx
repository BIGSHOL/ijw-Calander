/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  ORIGINAL TIMETABLE IS READ-ONLY HERE — DO NOT BREAK THIS  ⚠️    ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  이 파일은 "시간표 테스트" 시뮬레이션 환경입니다.                     ║
 * ║  - 진짜 시간표 컴포넌트(TimetableManager) 코드는 0줄 수정함.         ║
 * ║  - TimetableGrid (시각화 sub-component) 만 직접 호출.                ║
 * ║  - 모든 mutation 핸들러는 no-op 으로 주입 → 편집 불가 (read-only).   ║
 * ║  - 원본 Firestore (`classes` 컬렉션) 에 절대 쓰지 않음.               ║
 * ║  - 강사 visibility 토글 UI(IntegrationViewSettings) 도 import 안 함  ║
 * ║    → 진짜 시간표와 같은 localStorage 키를 건드릴 통로 자체가 없음.    ║
 * ║                                                                      ║
 * ║  허용 import (read 값만 destructure, update 함수는 호출 X):           ║
 * ║    - useTimetableClasses, useTeachers                                ║
 * ║    - useMathConfig (mathConfig 만 사용, handleSave* 호출 X)           ║
 * ║    - useStudents (students 만 destructure, mutation 함수 X)          ║
 * ║                                                                      ║
 * ║  금지 (절대 호출하지 말 것):                                          ║
 * ║    - firebase/firestore 의 setDoc, updateDoc, addDoc, deleteDoc 등   ║
 * ║    - useStudents 가 반환하는 add/update/delete 등 mutation 함수      ║
 * ║    - useMathConfig 가 반환하는 handleSave* mutation 함수             ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import React, { useMemo } from 'react';
import {
  TimetableClass,
  Teacher,
  UserProfile,
  StaffMember,
  UnifiedStudent,
} from '../../types';
import { useTimetableClasses } from './Math/hooks/useTimetableClasses';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { useMathConfig } from './Math/hooks/useMathConfig';
import { useStudents } from '../../hooks/useStudents';
import { VideoLoading } from '../Common/VideoLoading';
import TimetableGrid from './Math/components/TimetableGrid';
import { MATH_PERIODS, ALL_WEEKDAYS } from './constants';

interface TimetableTestProps {
  currentUser: UserProfile | null;
  staffMember?: StaffMember;
}

const NO_OP_VOID = () => {};
const NO_OP_DRAG = (_e?: React.DragEvent) => {};

const TimetableTest: React.FC<TimetableTestProps> = ({ currentUser, staffMember }) => {
  const myName =
    staffMember?.name ??
    currentUser?.name ??
    currentUser?.koreanName ??
    currentUser?.displayName ??
    '';

  // 데이터 fetch (전부 read 만 — mutation 함수 destructure 안 함)
  const { classes: allClasses = [], loading: classesLoading } = useTimetableClasses();
  const { data: teachers = [] } = useTeachers();
  const { mathConfig } = useMathConfig();
  const { students: globalStudents = [] } = useStudents(true);

  // 본인 수업 필터 (담임 또는 부담임)
  const myClasses = useMemo<TimetableClass[]>(() => {
    if (!myName) return [];
    return allClasses.filter((cls: TimetableClass) => {
      if (cls.teacher === myName) return true;
      const slotValues = Object.values(cls.slotTeachers ?? {});
      return slotValues.includes(myName);
    });
  }, [allClasses, myName]);

  // 수학 수업만 (TimetableGrid 가 수학 전용 컴포넌트)
  const myMathClasses = useMemo<TimetableClass[]>(
    () => myClasses.filter((c) => c.subject === 'math' || c.subject === '수학'),
    [myClasses]
  );

  // studentMap — 진짜 시간표와 동일 패턴 (TimetableManager.tsx:1520)
  const studentMap = useMemo<Record<string, UnifiedStudent>>(() => {
    const map: Record<string, UnifiedStudent> = {};
    globalStudents.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [globalStudents]);

  // 이번 주 월~일 날짜
  const weekDates = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
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

  // teacher 뷰: 본인 1명만
  const allResources = useMemo(() => (myName ? [myName] : []), [myName]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
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
              ? `${myName} 님의 수학 시간표 (진짜 시간표와 동일 UI · 본인 필터링)`
              : '로그인 정보 없음'}
          </p>
        </div>
        <span className="text-[10px] text-gray-400 font-mono px-2 py-1 bg-gray-100 rounded">
          진짜 그리드 · 통합테이블 · 본인 필터
        </span>
      </div>

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
          </Empty>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4 min-h-0">
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded mb-3 text-xs text-blue-900 flex items-start gap-2">
              <span>ℹ️</span>
              <span>
                진짜 시간표의 통합 테이블 모드(teacher-based + isUnifiedTable + weekdayGroupOrder)와 동일.
                모든 편집/드래그 핸들러는 no-op으로 무력화되어 원본 데이터는 절대 변경되지 않습니다.
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
                studentMap={studentMap}
                timetableViewMode="teacher-based"
                isUnifiedTable
                weekdayGroupOrder={mathConfig.weekdayGroupOrder}
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