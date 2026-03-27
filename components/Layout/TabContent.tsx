import React, { Suspense } from 'react';
import { AppTab, UserProfile } from '../../types';
import { VideoLoading } from '../Common/VideoLoading';
import ErrorBoundary from '../Common/ErrorBoundary';
import { StaffMember } from '../../types';

// Lazy loaded components
const DashboardTab = React.lazy(() => import('../Dashboard/DashboardTab'));
const CalendarBoard = React.lazy(() => import('../Calendar/CalendarBoard').then(m => ({ default: m.default })));
const TimetableManager = React.lazy(() => import('../Timetable/TimetableManager'));
const PaymentReport = React.lazy(() => import('../PaymentReport/PaymentReport'));
const GanttManager = React.lazy(() => import('../Gantt/GanttManager'));
const ConsultationManager = React.lazy(() => import('../RegistrationConsultation/ConsultationManager'));
const AttendanceManager = React.lazy(() => import('../Attendance/AttendanceManager'));
const StudentManagementTab = React.lazy(() => import('../StudentManagement/StudentManagementTab'));
const GradesManager = React.lazy(() => import('../Grades/GradesManager'));
const ClassManagementTab = React.lazy(() => import('../ClassManagement').then(m => ({ default: m.ClassManagementTab })));
const ClassroomTab = React.lazy(() => import('../Classroom').then(m => ({ default: m.ClassroomTab })));
const ClassroomAssignmentTab = React.lazy(() => import('../ClassroomAssignment').then(m => ({ default: m.ClassroomAssignmentTab })));
const StudentConsultationTab = React.lazy(() => import('../StudentConsultation').then(m => ({ default: m.ConsultationManagementTab })));
const BillingManager = React.lazy(() => import('../Billing').then(m => ({ default: m.BillingManager })));
const DailyAttendanceManager = React.lazy(() => import('../DailyAttendance').then(m => ({ default: m.DailyAttendanceManager })));
const StaffManager = React.lazy(() => import('../Staff').then(m => ({ default: m.StaffManager })));
const RoleManagementPage = React.lazy(() => import('../RoleManagement/RoleManagementPage'));
const ResourceDashboard = React.lazy(() => import('../Resources').then(m => ({ default: m.ResourceDashboard })));
const WithdrawalManagementTab = React.lazy(() => import('../WithdrawalManagement/WithdrawalManagementTab'));
const HelpTab = React.lazy(() => import('../Help/HelpTab'));
const NoticesTab = React.lazy(() => import('../Notices').then(m => ({ default: m.NoticesTab })));
const ParentPortalTab = React.lazy(() => import('../ParentPortal').then(m => ({ default: m.ParentPortalTab })));
const AnalyticsTab = React.lazy(() => import('../Analytics').then(m => ({ default: m.AnalyticsTab })));
const PayrollTab = React.lazy(() => import('../Payroll').then(m => ({ default: m.PayrollTab })));
const ExpensesTab = React.lazy(() => import('../Expenses').then(m => ({ default: m.ExpensesTab })));
const HomeworkTab = React.lazy(() => import('../Homework').then(m => ({ default: m.HomeworkTab })));
const NotificationsTab = React.lazy(() => import('../Notifications').then(m => ({ default: m.NotificationsTab })));
const TextbooksTab = React.lazy(() => import('../Textbooks').then(m => ({ default: m.TextbooksTab })));
const ExamsTab = React.lazy(() => import('../Exams').then(m => ({ default: m.ExamsTab })));
const ContractsTab = React.lazy(() => import('../Contracts').then(m => ({ default: m.ContractsTab })));
const ReportsTab = React.lazy(() => import('../Reports').then(m => ({ default: m.ReportsTab })));
const ShuttleTab = React.lazy(() => import('../Shuttle').then(m => ({ default: m.ShuttleTab })));
const MarketingTab = React.lazy(() => import('../Marketing').then(m => ({ default: m.MarketingTab })));
const TimetableDistributionTab = React.lazy(() => import('../TimetableDistribution').then(m => ({ default: m.TimetableDistributionTab })));

const LogsTab = React.lazy(() => import('../Logs/LogsTab'));
const TuitionCalculatorTab = React.lazy(() => import('../TuitionCalculator').then(m => ({ default: m.TuitionCalculatorTab })));
const MeetingMinutesTab = React.lazy(() => import('../MeetingMinutes').then(m => ({ default: m.MeetingMinutesTab })));

// Loading fallback
const TabLoadingFallback = () => <VideoLoading className="flex-1 h-full" />;

interface TabContentProps {
  appMode: AppTab | null;
  canAccessTab: (tab: AppTab | null) => boolean;
  effectiveProfile: UserProfile | null;
  effectiveStaffMember?: StaffMember;

  // Calendar props
  calendarProps?: {
    baseDate: Date;
    setBaseDate: (date: Date) => void;
    rightDate: Date;
    thirdDate: Date;
    visibleDepartments: any[];
    displayEvents: any[];
    handleCellClick: (date: string, deptId: string) => void;
    handleRangeSelect: (startDate: string, endDate: string, deptId: string, deptIds?: string[]) => void;
    handleTimeSlotClick: (date: string, time: string) => void;
    handleEventClick: (event: any) => void;
    holidays: any[];
    viewMode: string;
    handleEventMove: (original: any, updated: any) => void;
    canEditDepartment: (deptId: string) => boolean;
    pendingEventIds: string[];
    setViewMode: (mode: any) => void;
    handleQuickAdd: (date: Date) => void;
    bucketItems: any[];
    handleAddBucketItem: any;
    handleEditBucketItem: any;
    handleDeleteBucketItem: any;
    handleConvertBucketToEvent: any;
    showArchived: boolean;
    viewColumns: number;
  };

  // Timetable props
  timetableProps?: {
    timetableSubject: 'math' | 'english' | 'science' | 'korean' | 'highmath' | 'shuttle' | 'all';
    setTimetableSubject: (subject: 'math' | 'english' | 'science' | 'korean' | 'highmath' | 'shuttle' | 'all') => void;
    timetableViewType: string;
    setTimetableViewType: (type: string) => void;
    teachers: any[];
    classKeywords: any[];
    mathViewMode: string;
    setMathViewMode: (mode: string) => void;
    hasPermission: (perm: string) => boolean;
    setIsTimetableSettingsOpen: (open: boolean) => void;
  };

  // Gantt props
  ganttProps?: {
    usersFromStaff: any[];
  };

  // Consultation props
  consultationProps?: {
    onNavigateToStudent: (studentId: string) => void;
  };

  // Attendance props
  attendanceProps?: {
    teachers: any[];
    attendanceSubject: 'math' | 'english';
    attendanceStaffId?: string;
    attendanceDate: Date;
    isAttendanceAddStudentModalOpen: boolean;
    setIsAttendanceAddStudentModalOpen: (open: boolean) => void;
    attendanceViewMode: any;
    selectedSession: any;
  };

  // Students props
  studentsProps?: {
    studentFilters: any;
    studentSortBy: string;
    consultationToStudentId?: string;
    setConsultationToStudentId: (id: string | undefined) => void;
  };

  // Grades props
  gradesProps?: {
    gradesSubjectFilter: string;
    gradesSearchQuery: string;
    setGradesSearchQuery: (query: string) => void;
    setGradesSubjectFilter: (filter: string) => void;
  };

  // 탭 전환
  onNavigateToTab?: (tab: AppTab) => void;
}

export const TabContent: React.FC<TabContentProps> = ({
  appMode,
  canAccessTab,
  effectiveProfile,
  effectiveStaffMember,
  calendarProps,
  timetableProps,
  ganttProps,
  consultationProps,
  attendanceProps,
  studentsProps,
  gradesProps,
  onNavigateToTab,
}) => {
  // Render gating: if permission fails, show loading
  if (!canAccessTab(appMode)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <VideoLoading className="flex-1 h-full" />
      </div>
    );
  }

  return (
    <ErrorBoundary key={appMode}>
      {appMode === 'dashboard' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-auto bg-gray-50">
            <DashboardTab userProfile={effectiveProfile} staffMember={effectiveStaffMember} />
          </div>
        </Suspense>
      ) : appMode === 'calendar' && calendarProps ? (
        <div className="w-full flex-1 max-w-full mx-auto h-full print:p-0 flex flex-col xl:flex-row print:flex-row print:gap-2 overflow-x-auto">
          <Suspense fallback={<TabLoadingFallback />}>
            {/* 1단: 현재 년도 */}
            <div className={`flex-1 flex flex-col overflow-y-auto ${calendarProps.viewColumns >= 2 ? 'min-w-[320px] border-r-4 border-gray-400' : 'min-w-0'}`}>
              <CalendarBoard
                currentDate={calendarProps.baseDate}
                onDateChange={calendarProps.setBaseDate}
                departments={calendarProps.visibleDepartments}
                events={calendarProps.displayEvents}
                onCellClick={calendarProps.handleCellClick}
                onRangeSelect={calendarProps.handleRangeSelect}
                onTimeSlotClick={calendarProps.handleTimeSlotClick}
                onEventClick={calendarProps.handleEventClick}
                holidays={calendarProps.holidays}
                viewMode={calendarProps.viewMode as any}
                currentUser={effectiveProfile}
                onEventMove={calendarProps.handleEventMove}
                canEditDepartment={calendarProps.canEditDepartment}
                pendingEventIds={calendarProps.pendingEventIds}
                onViewChange={calendarProps.setViewMode}
                showSidePanel={calendarProps.viewColumns === 1}
                onQuickAdd={calendarProps.handleQuickAdd}
                bucketItems={calendarProps.bucketItems}
                onAddBucket={calendarProps.handleAddBucketItem}
                onEditBucket={calendarProps.handleEditBucketItem}
                onDeleteBucket={calendarProps.handleDeleteBucketItem}
                onConvertBucket={calendarProps.handleConvertBucketToEvent}
                showArchived={calendarProps.showArchived}
              />
            </div>

            {/* 2단: 1년 전 */}
            <div className={`flex-1 flex flex-col overflow-hidden min-w-[320px] transition-all duration-300 ${calendarProps.viewColumns >= 2 ? (calendarProps.viewColumns >= 3 ? 'border-r-4 border-gray-400' : '') : 'hidden'}`}>
              <CalendarBoard
                currentDate={calendarProps.rightDate}
                onDateChange={(date: Date) => calendarProps.setBaseDate(new Date(date.getFullYear() + 1, date.getMonth(), date.getDate()))}
                departments={calendarProps.visibleDepartments}
                events={calendarProps.displayEvents}
                onCellClick={calendarProps.handleCellClick}
                onRangeSelect={calendarProps.handleRangeSelect}
                onTimeSlotClick={calendarProps.handleTimeSlotClick}
                onEventClick={calendarProps.handleEventClick}
                holidays={calendarProps.holidays}
                viewMode={calendarProps.viewMode as any}
                onEventMove={calendarProps.handleEventMove}
                canEditDepartment={calendarProps.canEditDepartment}
                pendingEventIds={calendarProps.pendingEventIds}
                isPrimaryView={false}
                onViewChange={calendarProps.setViewMode}
                showSidePanel={false}
                currentUser={effectiveProfile}
                showArchived={calendarProps.showArchived}
              />
            </div>

            {/* 3단: 2년 전 */}
            <div className={`flex-1 flex flex-col overflow-hidden min-w-[320px] transition-all duration-300 ${calendarProps.viewColumns >= 3 ? '' : 'hidden'}`}>
              <CalendarBoard
                currentDate={calendarProps.thirdDate}
                onDateChange={(date: Date) => calendarProps.setBaseDate(new Date(date.getFullYear() + 2, date.getMonth(), date.getDate()))}
                departments={calendarProps.visibleDepartments}
                events={calendarProps.displayEvents}
                onCellClick={calendarProps.handleCellClick}
                onRangeSelect={calendarProps.handleRangeSelect}
                onTimeSlotClick={calendarProps.handleTimeSlotClick}
                onEventClick={calendarProps.handleEventClick}
                holidays={calendarProps.holidays}
                viewMode={calendarProps.viewMode as any}
                onEventMove={calendarProps.handleEventMove}
                canEditDepartment={calendarProps.canEditDepartment}
                pendingEventIds={calendarProps.pendingEventIds}
                isPrimaryView={false}
                onViewChange={calendarProps.setViewMode}
                showSidePanel={false}
                currentUser={effectiveProfile}
                showArchived={calendarProps.showArchived}
              />
            </div>
          </Suspense>
        </div>
      ) : appMode === 'timetable' && timetableProps ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 min-h-0">
            <TimetableManager
              subjectTab={timetableProps.timetableSubject}
              onSubjectChange={timetableProps.setTimetableSubject}
              viewType={timetableProps.timetableViewType as any}
              onViewTypeChange={timetableProps.setTimetableViewType}
              currentUser={effectiveProfile}
              teachers={timetableProps.teachers}
              classKeywords={timetableProps.classKeywords}
              mathViewMode={timetableProps.mathViewMode as any}
              onMathViewModeChange={timetableProps.setMathViewMode}
              hasPermissionFn={timetableProps.hasPermission}
              setIsTimetableSettingsOpen={timetableProps.setIsTimetableSettingsOpen}
            />
          </div>
        </Suspense>
      ) : appMode === 'payment' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-auto">
            <PaymentReport />
          </div>
        </Suspense>
      ) : appMode === 'gantt' && ganttProps ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden bg-[#f8f9fa]">
            <GanttManager userProfile={effectiveProfile} allUsers={ganttProps.usersFromStaff} />
          </div>
        </Suspense>
      ) : appMode === 'consultation' && consultationProps ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 flex flex-col overflow-hidden">
            <ConsultationManager
              userProfile={effectiveProfile}
              onNavigateToStudent={consultationProps.onNavigateToStudent}
            />
          </div>
        </Suspense>
      ) : appMode === 'attendance' && attendanceProps ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 flex flex-col overflow-hidden">
            <AttendanceManager
              userProfile={effectiveProfile}
              teachers={attendanceProps.teachers}
              selectedSubject={attendanceProps.attendanceSubject}
              selectedStaffId={attendanceProps.attendanceStaffId}
              currentDate={attendanceProps.attendanceDate}
              isAddStudentModalOpen={attendanceProps.isAttendanceAddStudentModalOpen}
              onCloseAddStudentModal={() => attendanceProps.setIsAttendanceAddStudentModalOpen(false)}
              viewMode={attendanceProps.attendanceViewMode}
              selectedSession={attendanceProps.selectedSession}
            />
          </div>
        </Suspense>
      ) : appMode === 'students' && studentsProps ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 min-h-0 overflow-hidden">
            <StudentManagementTab
              filters={studentsProps.studentFilters}
              sortBy={studentsProps.studentSortBy as any}
              currentUser={effectiveProfile}
              initialSelectedStudentId={studentsProps.consultationToStudentId}
              onStudentSelected={() => studentsProps.setConsultationToStudentId(undefined)}
            />
          </div>
        </Suspense>
      ) : appMode === 'grades' && gradesProps ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <GradesManager
              subjectFilter={gradesProps.gradesSubjectFilter as any}
              searchQuery={gradesProps.gradesSearchQuery}
              onSearchChange={gradesProps.setGradesSearchQuery}
              onSubjectFilterChange={gradesProps.setGradesSubjectFilter}
              currentUser={effectiveProfile}
            />
          </div>
        </Suspense>
      ) : appMode === 'classes' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 min-h-0 overflow-hidden">
            <ClassManagementTab currentUser={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'classroom' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 min-h-0 overflow-hidden">
            <ClassroomTab />
          </div>
        </Suspense>
      ) : appMode === 'classroom-assignment' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 min-h-0 overflow-hidden">
            <ClassroomAssignmentTab />
          </div>
        </Suspense>
      ) : appMode === 'student-consultations' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <StudentConsultationTab currentUser={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'billing' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <BillingManager userProfile={effectiveProfile} onNavigateToTextbooks={onNavigateToTab ? () => onNavigateToTab('textbooks') : undefined} />
          </div>
        </Suspense>
      ) : appMode === 'daily-attendance' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <DailyAttendanceManager userProfile={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'staff' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <StaffManager currentUserProfile={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'role-management' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <RoleManagementPage currentUser={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'resources' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <ResourceDashboard userProfile={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'withdrawal' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <WithdrawalManagementTab currentUser={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'help' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <HelpTab currentUser={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'logs' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <LogsTab />
          </div>
        </Suspense>
      ) : appMode === 'notices' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <NoticesTab />
          </div>
        </Suspense>
      ) : appMode === 'parent-portal' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <ParentPortalTab />
          </div>
        </Suspense>
      ) : appMode === 'analytics' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden bg-gray-50">
            <AnalyticsTab />
          </div>
        </Suspense>
      ) : appMode === 'payroll' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <PayrollTab />
          </div>
        </Suspense>
      ) : appMode === 'expenses' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <ExpensesTab currentUser={effectiveProfile} staffMember={effectiveStaffMember} />
          </div>
        </Suspense>
      ) : appMode === 'homework' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <HomeworkTab />
          </div>
        </Suspense>
      ) : appMode === 'sms-notifications' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <NotificationsTab />
          </div>
        </Suspense>
      ) : appMode === 'textbooks' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <TextbooksTab currentUser={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'exams' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <ExamsTab />
          </div>
        </Suspense>
      ) : appMode === 'contracts' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <ContractsTab />
          </div>
        </Suspense>
      ) : appMode === 'reports' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <ReportsTab />
          </div>
        </Suspense>
      ) : appMode === 'shuttle' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <ShuttleTab />
          </div>
        </Suspense>
      ) : appMode === 'marketing' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <MarketingTab />
          </div>
        </Suspense>
      ) : appMode === 'timetable-distribution' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <TimetableDistributionTab />
          </div>
        </Suspense>
      ) : appMode === 'tuition-calculator' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-auto">
            <TuitionCalculatorTab userProfile={effectiveProfile} />
          </div>
        </Suspense>
      ) : appMode === 'meeting-minutes' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <div className="w-full flex-1 overflow-hidden">
            <MeetingMinutesTab userProfile={effectiveProfile} />
          </div>
        </Suspense>
      ) : null}
    </ErrorBoundary>
  );
};
