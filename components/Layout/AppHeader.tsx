import React from 'react';
import { Settings, User as UserIcon, ChevronUp, ChevronDown, FlaskConical } from 'lucide-react';
import { AppTab, UserProfile, StaffMember } from '../../types';
import { BreadcrumbItem } from '../Common/Breadcrumb';
import Breadcrumb from '../Common/Breadcrumb';
import { TimetableNavBar } from '../Header/TimetableNavBar';
import { CalendarFilterBar } from '../Header/CalendarFilterBar';
import { CalendarFilterPopover } from '../Header/CalendarFilterPopover';
import { AttendanceNavBar } from '../Header/AttendanceNavBar';
import { StudentsNavBar } from '../Header/StudentsNavBar';
import { MemoDropdown } from '../Header/MemoDropdown';
import { ROLE_LABELS } from '../../types';
import { getJobTitleStyle } from '../../utils/styleUtils';

interface AppHeaderProps {
  appMode: AppTab | null;
  isHeaderCollapsed: boolean;
  setIsHeaderCollapsed: (collapsed: boolean) => void;
  breadcrumbItems: BreadcrumbItem[];

  // User info
  currentUser: any;
  userProfile: UserProfile | null;
  currentStaffMember?: StaffMember;
  isProfileMenuOpen: boolean;
  setIsProfileMenuOpen: (open: boolean) => void;

  // Actions
  hasPermission: (permission: string) => boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isRoleSimulationOpen: boolean;
  setIsRoleSimulationOpen: (open: boolean) => void;

  // Memo
  isMemoDropdownOpen: boolean;
  setIsMemoDropdownOpen: (open: boolean) => void;
  unreadMemoCount: number;
  taskMemos: any[];
  setIsMemoModalOpen: (open: boolean) => void;
  setSelectedMemo: (memo: any) => void;
  handleMarkMemoRead: (id: string) => void;

  // Calendar filter props
  calendarFilterProps?: {
    isFilterOpen: boolean;
    setIsFilterOpen: (open: boolean) => void;
    hiddenDeptIds: string[];
    visibleDepartments: any[];
    viewMode: any;
    setViewMode: (mode: any) => void;
    viewColumns: number;
    setViewColumns: (columns: number) => void;
    setIsCalendarSettingsOpen: (open: boolean) => void;
    departments: any[];
    effectiveProfile: UserProfile | null;
    isMaster: boolean;
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    uniqueCategories: string[];
    showFavoritesOnly: boolean;
    setShowFavoritesOnly: (show: boolean) => void;
    toggleDeptVisibility: (id: string) => void;
    setAllVisibility: (visible: boolean) => void;
    toggleFavorite: (deptId: string) => void;
  };

  // Attendance props
  attendanceProps?: {
    effectiveProfile: UserProfile | null;
    hasPermission: (permission: string) => boolean;
    teachers: any[];
    attendanceSubject: 'math' | 'english';
    setAttendanceSubject: (subject: 'math' | 'english') => void;
    attendanceStaffId?: string;
    setAttendanceStaffId: (id: string | undefined) => void;
    attendanceDate: Date;
    setAttendanceDate: (date: Date) => void;
    attendanceViewMode: any;
    setAttendanceViewMode: (mode: any) => void;
    selectedSession: any;
    setSelectedSession: (session: any) => void;
    sessions: any[];
    setIsAttendanceAddStudentModalOpen: (open: boolean) => void;
  };

  // Students props
  studentsProps?: {
    studentFilters: any;
    setStudentFilters: (filters: any) => void;
    isSearchFieldDropdownOpen: boolean;
    setIsSearchFieldDropdownOpen: (open: boolean) => void;
    teachersBySubject: any;
    studentSortBy: string;
    setStudentSortBy: (sort: string) => void;
    onGradePromotion?: () => void;
    isPromoting?: boolean;
  };

  // Timetable props
  timetableProps?: {
    timetableSubject: 'math' | 'english' | 'science' | 'korean';
    setTimetableSubject: (subject: 'math' | 'english' | 'science' | 'korean') => void;
    timetableViewType: string;
    setTimetableViewType: (type: string) => void;
    mathViewMode: string;
    setMathViewMode: (mode: string) => void;
    hasPermission: (permission: string) => boolean;
    setIsTimetableSettingsOpen: (open: boolean) => void;
  };
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  appMode,
  isHeaderCollapsed,
  setIsHeaderCollapsed,
  breadcrumbItems,
  currentUser,
  userProfile,
  currentStaffMember,
  isProfileMenuOpen,
  setIsProfileMenuOpen,
  hasPermission,
  setIsSettingsOpen,
  isRoleSimulationOpen,
  setIsRoleSimulationOpen,
  isMemoDropdownOpen,
  setIsMemoDropdownOpen,
  unreadMemoCount,
  taskMemos,
  setIsMemoModalOpen,
  setSelectedMemo,
  handleMarkMemoRead,
  calendarFilterProps,
  attendanceProps,
  studentsProps,
  timetableProps,
}) => {
  return (
    <header
      className={`no-print z-40 sticky top-0 bg-[#081429] shadow-lg flex flex-col transition-all duration-300 ${
        isHeaderCollapsed ? 'overflow-hidden' : ''
      }`}
      role="banner"
    >
      {/* Row 1: Primary Header (Navy) */}
      <div
        className={`bg-[#081429] flex items-center justify-between px-4 md:px-6 z-50 relative transition-all duration-300 ${
          isHeaderCollapsed ? 'h-10 border-b-0' : 'h-16 border-b border-white/10'
        }`}
      >
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {!isHeaderCollapsed && <Breadcrumb items={breadcrumbItems} showHome={false} />}

          {/* User Info Display (Desktop) */}
          {currentUser && !isHeaderCollapsed && (
            <div className="hidden lg:flex flex-row items-center gap-1.5 ml-4 pl-4 border-l border-white/10">
              {/* Role Badge */}
              {userProfile?.role && (
                <span
                  className={`text-white text-micro px-1 py-0.5 font-black tracking-tighter shadow-sm ${
                    userProfile.role === 'master'
                      ? 'bg-red-600'
                      : userProfile.role === 'admin'
                      ? 'bg-indigo-600'
                      : userProfile.role === 'manager'
                      ? 'bg-purple-600'
                      : userProfile.role === 'math_lead'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                      : userProfile.role === 'english_lead'
                      ? 'bg-gradient-to-r from-orange-500 to-red-500'
                      : userProfile.role === 'math_teacher'
                      ? 'bg-green-500'
                      : userProfile.role === 'english_teacher'
                      ? 'bg-orange-500'
                      : 'bg-gray-500'
                  }`}
                >
                  {ROLE_LABELS[userProfile.role] || userProfile.role.toUpperCase()}
                </span>
              )}
              {/* Name */}
              <span className="text-xs font-bold text-white whitespace-nowrap">
                {currentStaffMember
                  ? currentStaffMember.englishName
                    ? `${currentStaffMember.name}(${currentStaffMember.englishName})`
                    : currentStaffMember.name
                  : userProfile?.displayName || (userProfile?.email || currentUser?.email)?.split('@')[0]}
              </span>
              {/* Job Title Badge */}
              <span
                className={`text-xxs px-1.5 py-0.5 flex items-center justify-center font-bold tracking-tight whitespace-nowrap ${getJobTitleStyle(
                  userProfile?.jobTitle
                )}`}
              >
                {userProfile?.jobTitle || '직급 미설정'}
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div
          className={`flex items-center justify-end gap-3 transition-all duration-300 ${
            isHeaderCollapsed ? 'w-auto' : 'w-[250px]'
          }`}
        >
          {/* Header Collapse Toggle */}
          <button
            onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
            className="text-gray-400 hover:text-white transition-colors"
            title={isHeaderCollapsed ? '네비게이션 펼치기' : '네비게이션 접기'}
          >
            {isHeaderCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={20} />}
          </button>

          {!isHeaderCollapsed && hasPermission('settings.access') && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Settings size={20} />
            </button>
          )}

          {/* Role Simulation Button - Master Only */}
          {!isHeaderCollapsed && userProfile?.role === 'master' && (
            <button
              onClick={() => setIsRoleSimulationOpen(!isRoleSimulationOpen)}
              className={`transition-colors ${
                isRoleSimulationOpen ? 'text-amber-400' : 'text-gray-400 hover:text-white'
              }`}
              title="권한 테스트 모드"
            >
              <FlaskConical size={20} />
            </button>
          )}

          {/* Memo/Messenger */}
          {!isHeaderCollapsed && currentUser && (
            <MemoDropdown
              isMemoDropdownOpen={isMemoDropdownOpen}
              setIsMemoDropdownOpen={setIsMemoDropdownOpen}
              unreadMemoCount={unreadMemoCount}
              taskMemos={taskMemos}
              setIsMemoModalOpen={setIsMemoModalOpen}
              setSelectedMemo={setSelectedMemo}
              handleMarkMemoRead={handleMarkMemoRead}
            />
          )}

          {/* Profile Dropdown */}
          {!isHeaderCollapsed && currentUser && (
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={`transition-colors mt-[5px] ${
                  isProfileMenuOpen ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <UserIcon size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Calendar Filter Bar */}
      {appMode === 'calendar' && !isHeaderCollapsed && calendarFilterProps && (
        <CalendarFilterBar
          isFilterOpen={calendarFilterProps.isFilterOpen}
          setIsFilterOpen={calendarFilterProps.setIsFilterOpen}
          hiddenDeptIds={calendarFilterProps.hiddenDeptIds}
          visibleDepartments={calendarFilterProps.visibleDepartments}
          viewMode={calendarFilterProps.viewMode}
          setViewMode={calendarFilterProps.setViewMode}
          viewColumns={calendarFilterProps.viewColumns as 1 | 2 | 3}
          setViewColumns={calendarFilterProps.setViewColumns}
          setIsCalendarSettingsOpen={calendarFilterProps.setIsCalendarSettingsOpen}
        />
      )}

      {/* Row 3: Attendance Navigation Bar */}
      {appMode === 'attendance' && !isHeaderCollapsed && attendanceProps && (
        <AttendanceNavBar
          effectiveProfile={attendanceProps.effectiveProfile}
          hasPermission={attendanceProps.hasPermission}
          teachers={attendanceProps.teachers}
          attendanceSubject={attendanceProps.attendanceSubject}
          setAttendanceSubject={attendanceProps.setAttendanceSubject}
          attendanceStaffId={attendanceProps.attendanceStaffId}
          setAttendanceStaffId={attendanceProps.setAttendanceStaffId}
          attendanceDate={attendanceProps.attendanceDate}
          setAttendanceDate={attendanceProps.setAttendanceDate}
          attendanceViewMode={attendanceProps.attendanceViewMode}
          setAttendanceViewMode={attendanceProps.setAttendanceViewMode}
          selectedSession={attendanceProps.selectedSession}
          setSelectedSession={attendanceProps.setSelectedSession}
          sessions={attendanceProps.sessions}
          setIsAttendanceAddStudentModalOpen={attendanceProps.setIsAttendanceAddStudentModalOpen}
        />
      )}

      {/* Row 4: Students Navigation Bar */}
      {appMode === 'students' && !isHeaderCollapsed && studentsProps && (
        <StudentsNavBar
          studentFilters={studentsProps.studentFilters}
          setStudentFilters={studentsProps.setStudentFilters}
          isSearchFieldDropdownOpen={studentsProps.isSearchFieldDropdownOpen}
          setIsSearchFieldDropdownOpen={studentsProps.setIsSearchFieldDropdownOpen}
          teachersBySubject={studentsProps.teachersBySubject}
          studentSortBy={studentsProps.studentSortBy as any}
          setStudentSortBy={studentsProps.setStudentSortBy}
          onGradePromotion={studentsProps.onGradePromotion}
          isPromoting={studentsProps.isPromoting}
        />
      )}

      {/* Calendar Filter Popover Panel */}
      {appMode === 'calendar' && !isHeaderCollapsed && calendarFilterProps && (
        <CalendarFilterPopover
          isFilterOpen={calendarFilterProps.isFilterOpen}
          setIsFilterOpen={calendarFilterProps.setIsFilterOpen}
          departments={calendarFilterProps.departments}
          hiddenDeptIds={calendarFilterProps.hiddenDeptIds}
          effectiveProfile={calendarFilterProps.effectiveProfile}
          isMaster={calendarFilterProps.isMaster}
          selectedCategory={calendarFilterProps.selectedCategory}
          setSelectedCategory={calendarFilterProps.setSelectedCategory}
          uniqueCategories={calendarFilterProps.uniqueCategories}
          showFavoritesOnly={calendarFilterProps.showFavoritesOnly}
          setShowFavoritesOnly={calendarFilterProps.setShowFavoritesOnly}
          toggleDeptVisibility={calendarFilterProps.toggleDeptVisibility}
          setAllVisibility={calendarFilterProps.setAllVisibility}
          toggleFavorite={calendarFilterProps.toggleFavorite}
        />
      )}

      {/* Row 2: Timetable Filter Bar */}
      {appMode === 'timetable' && !isHeaderCollapsed && timetableProps && (
        <TimetableNavBar
          timetableSubject={timetableProps.timetableSubject}
          setTimetableSubject={timetableProps.setTimetableSubject}
          timetableViewType={timetableProps.timetableViewType as any}
          setTimetableViewType={timetableProps.setTimetableViewType as any}
          mathViewMode={timetableProps.mathViewMode as any}
          setMathViewMode={timetableProps.setMathViewMode}
          hasPermission={timetableProps.hasPermission}
          setIsTimetableSettingsOpen={timetableProps.setIsTimetableSettingsOpen}
        />
      )}
    </header>
  );
};
