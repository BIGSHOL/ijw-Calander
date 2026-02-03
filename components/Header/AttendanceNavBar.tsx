/**
 * AttendanceNavBar - Attendance mode sub-navigation bar
 * Extracted from App.tsx Phase 5
 */

import React from 'react';
import { Calculator, BookOpen, ChevronDown, ChevronLeft, ChevronRight, List, Calendar as CalendarIcon, UserPlus } from 'lucide-react';
import { TabSubNavigation } from '../Common/TabSubNavigation';
import { TabButton } from '../Common/TabButton';
import { Teacher, UserProfile } from '../../types';
import { AttendanceViewMode, SessionPeriod } from '../Attendance/types';

interface AttendanceNavBarProps {
  effectiveProfile: UserProfile | undefined;
  hasPermission: (perm: string) => boolean;
  teachers: Teacher[];
  attendanceSubject: 'math' | 'english';
  setAttendanceSubject: (value: 'math' | 'english') => void;
  attendanceStaffId: string | undefined;
  setAttendanceStaffId: (value: string | undefined) => void;
  attendanceDate: Date;
  setAttendanceDate: React.Dispatch<React.SetStateAction<Date>>;
  attendanceViewMode: AttendanceViewMode;
  setAttendanceViewMode: (mode: AttendanceViewMode) => void;
  selectedSession: SessionPeriod | null;
  setSelectedSession: (session: SessionPeriod | null) => void;
  sessions: SessionPeriod[];
  setIsAttendanceAddStudentModalOpen: (value: boolean) => void;
}

export const AttendanceNavBar: React.FC<AttendanceNavBarProps> = ({
  effectiveProfile,
  hasPermission,
  teachers,
  attendanceSubject,
  setAttendanceSubject,
  attendanceStaffId,
  setAttendanceStaffId,
  attendanceDate,
  setAttendanceDate,
  attendanceViewMode,
  setAttendanceViewMode,
  selectedSession,
  setSelectedSession,
  sessions,
  setIsAttendanceAddStudentModalOpen,
}) => {
  const isMasterOrAdmin = effectiveProfile?.role === 'master' || effectiveProfile?.role === 'admin';
  const canManageMath = hasPermission('attendance.manage_math');
  const canManageEnglish = hasPermission('attendance.manage_english');
  const canManageCurrentSubject = isMasterOrAdmin ||
    (attendanceSubject === 'math' && canManageMath) ||
    (attendanceSubject === 'english' && canManageEnglish);

  const availableTeachers = canManageCurrentSubject
    ? teachers.filter(t => {
      if (attendanceSubject === 'math') return t.subjects?.includes('math');
      if (attendanceSubject === 'english') return t.subjects?.includes('english');
      return true;
    })
    : [];

  const changeMonth = (delta: number) => {
    setAttendanceDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const changeSession = (delta: number) => {
    if (!sessions || sessions.length === 0) return;

    const currentYear = attendanceDate.getFullYear();
    const currentMonth = attendanceDate.getMonth() + 1;
    const currentIdx = sessions.findIndex(s => s.year === currentYear && s.month === currentMonth);

    if (currentIdx === -1) {
      const firstSession = sessions[0];
      setSelectedSession(firstSession);
      setAttendanceDate(new Date(firstSession.year, firstSession.month - 1, 1));
      return;
    }

    const newIdx = currentIdx + delta;
    if (newIdx >= 0 && newIdx < sessions.length) {
      const newSession = sessions[newIdx];
      setSelectedSession(newSession);
      setAttendanceDate(new Date(newSession.year, newSession.month - 1, 1));
    } else if (newIdx < 0) {
      const prevYear = attendanceDate.getFullYear() - 1;
      setAttendanceDate(new Date(prevYear, 11, 1));
      setSelectedSession(null);
    } else {
      const nextYear = attendanceDate.getFullYear() + 1;
      setAttendanceDate(new Date(nextYear, 0, 1));
      setSelectedSession(null);
    }
  };

  return (
    <TabSubNavigation variant="compact" className="justify-between px-6 border-b border-white/10 z-30">
      <div className="flex items-center gap-3">
        {/* Subject Toggle */}
        <div className="flex bg-white/10 rounded-sm p-0.5 border border-white/10 shadow-sm">
          {(canManageMath || isMasterOrAdmin) && (
            <TabButton
              active={attendanceSubject === 'math'}
              onClick={() => setAttendanceSubject('math')}
              icon={<Calculator size={14} />}
              className="px-2 py-0.5"
            >
              수학
            </TabButton>
          )}
          {(canManageEnglish || isMasterOrAdmin) && (
            <TabButton
              active={attendanceSubject === 'english'}
              onClick={() => setAttendanceSubject('english')}
              icon={<BookOpen size={14} />}
              className="px-2 py-0.5"
            >
              영어
            </TabButton>
          )}
        </div>

        {/* Teacher Filter */}
        {canManageCurrentSubject && availableTeachers.length > 0 && (
          <div className="relative">
            <select
              value={attendanceStaffId || ''}
              onChange={(e) => setAttendanceStaffId(e.target.value || undefined)}
              className="appearance-none bg-[#1e293b] border border-gray-700 rounded-sm px-3 py-1 pr-7 text-xs font-medium text-white cursor-pointer hover:border-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
            >
              {availableTeachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Separator */}
        <div className="w-px h-4 bg-white/20 mx-1"></div>

        {/* View Mode Toggle (월별/세션) */}
        <div className="flex bg-white/10 rounded-sm p-0.5 border border-white/10 shadow-sm">
          <TabButton
            active={attendanceViewMode === 'monthly'}
            onClick={() => {
              setAttendanceViewMode('monthly');
              setSelectedSession(null);
            }}
            icon={<List size={14} />}
            className="px-2 py-0.5"
          >
            월별
          </TabButton>
          <TabButton
            active={attendanceViewMode === 'session'}
            onClick={() => {
              if (sessions.length === 0) {
                alert('현재 과목/연도에 세션 데이터가 없습니다. 출석부 설정에서 세션을 먼저 생성해주세요.');
                return;
              }
              setAttendanceViewMode('session');
            }}
            icon={<CalendarIcon size={14} />}
            className="px-2 py-0.5"
          >
            세션별{sessions.length === 0 && attendanceViewMode !== 'session' ? '' : ''}
          </TabButton>
        </div>

        {/* Month/Session Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => attendanceViewMode === 'monthly' ? changeMonth(-1) : changeSession(-1)}
            disabled={attendanceViewMode === 'session' && sessions.length === 0}
            className="p-1 border border-gray-700 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 font-bold text-white text-xs min-w-[120px] text-center">
            {attendanceViewMode === 'monthly'
              ? attendanceDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
              : selectedSession
                ? `${selectedSession.year}년 ${selectedSession.month}월 세션`
                : sessions.length === 0
                  ? '세션 없음'
                  : `${attendanceDate.getFullYear()}년 ${attendanceDate.getMonth() + 1}월 세션`
            }
          </span>
          <button
            onClick={() => attendanceViewMode === 'monthly' ? changeMonth(1) : changeSession(1)}
            disabled={attendanceViewMode === 'session' && sessions.length === 0}
            className="p-1 border border-gray-700 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-white/20 mx-1"></div>

        {/* Add Student Button (Special Attendance) */}
        <button
          onClick={() => setIsAttendanceAddStudentModalOpen(true)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm ml-2"
          title="특강/보강 학생 출석부 추가"
        >
          <UserPlus size={14} />
          <span className="font-bold text-xs">학생 추가</span>
        </button>
      </div>
    </TabSubNavigation>
  );
};
