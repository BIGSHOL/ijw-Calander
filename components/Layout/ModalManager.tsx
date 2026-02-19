import React, { Suspense } from 'react';
import { UserProfile, CalendarEvent, StaffMember } from '../../types';
import GlobalSearch from '../Common/GlobalSearch';
import LoginModal from '../Auth/LoginModal';
import { ProfileDropdown } from '../Header/ProfileDropdown';
import { PermissionViewModal } from '../Header/PermissionViewModal';
import { MemoSendModal } from '../TaskMemo/MemoSendModal';
import { MemoDetailModal } from '../TaskMemo/MemoDetailModal';
import { VideoLoading } from '../Common/VideoLoading';
import { PendingApprovalOverlay } from '../Auth/PendingApprovalOverlay';

// Lazy loaded modals
const EventModal = React.lazy(() => import('../Calendar/EventModal'));
const SettingsModal = React.lazy(() => import('../Settings/SettingsModal'));
const TimetableSettingsModal = React.lazy(() => import('../Timetable/TimetableSettingsModal'));
const CalendarSettingsModal = React.lazy(() => import('../Calendar/CalendarSettingsModal'));

interface ModalManagerProps {
  // Global Search
  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (open: boolean) => void;
  handleGlobalSearch: (query: string) => any;
  handleSearchSelect: (result: any) => void;

  // Login
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  currentUser: any;

  // Profile Dropdown
  isProfileMenuOpen: boolean;
  setIsProfileMenuOpen: (open: boolean) => void;
  userProfile: UserProfile | null;
  currentStaffMember?: StaffMember;
  setIsPermissionViewOpen: (open: boolean) => void;
  handleLogout: () => void;

  // Permission View
  isPermissionViewOpen: boolean;
  accessibleTabs: any[];
  rolePermissions: any;

  // Event Modal
  isEventModalOpen: boolean;
  setIsEventModalOpen: (open: boolean) => void;
  setInitialTitle: (title: string) => void;
  setPendingBucketId: (id: string | null) => void;
  setTemplateEvent: (event: CalendarEvent | null) => void;
  handleSaveEvent: (event: CalendarEvent) => Promise<void>;
  handleDeleteEvent: (eventId: string) => Promise<void>;
  selectedDate: string;
  selectedEndDate: string;
  selectedDeptId: string;
  selectedDeptIds: string[];
  initialStartTime: string;
  initialEndTime: string;
  initialTitle: string;
  editingEvent: CalendarEvent | null;
  visibleDepartments: any[];
  usersFromStaff: any[];
  effectiveProfile: UserProfile | null;
  events: CalendarEvent[];
  handleBatchUpdateAttendance: any;
  handleCopyEvent: (event: CalendarEvent) => void;
  templateEvent: CalendarEvent | null;

  // Settings Modal
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  departments: any[];
  holidays: any[];
  sysCategories: string[];
  teachers: any[];
  showArchived: boolean;
  onToggleArchived: () => void;

  // Timetable Settings
  isTimetableSettingsOpen: boolean;
  setIsTimetableSettingsOpen: (open: boolean) => void;
  hasPermission: (permission: string) => boolean;

  // Calendar Settings
  isCalendarSettingsOpen: boolean;
  setIsCalendarSettingsOpen: (open: boolean) => void;

  // Pending Approval
  logoUrl: string;

  // Memo
  isMemoModalOpen: boolean;
  setIsMemoModalOpen: (open: boolean) => void;
  memoRecipients: string[];
  setMemoRecipients: (recipients: string[]) => void;
  memoMessage: string;
  setMemoMessage: (message: string) => void;
  handleSendMemo: () => void;
  formatUserDisplay: (u: any) => string;

  // Memo Detail
  selectedMemo: any;
  setSelectedMemo: (memo: any) => void;
  handleMarkMemoRead: (id: string) => void;
  handleDeleteMemo: (id: string) => void;
}

export const ModalManager: React.FC<ModalManagerProps> = ({
  isGlobalSearchOpen,
  setIsGlobalSearchOpen,
  handleGlobalSearch,
  handleSearchSelect,
  isLoginModalOpen,
  setIsLoginModalOpen,
  currentUser,
  isProfileMenuOpen,
  setIsProfileMenuOpen,
  userProfile,
  currentStaffMember,
  setIsPermissionViewOpen,
  handleLogout,
  isPermissionViewOpen,
  accessibleTabs,
  rolePermissions,
  isEventModalOpen,
  setIsEventModalOpen,
  setInitialTitle,
  setPendingBucketId,
  setTemplateEvent,
  handleSaveEvent,
  handleDeleteEvent,
  selectedDate,
  selectedEndDate,
  selectedDeptId,
  selectedDeptIds,
  initialStartTime,
  initialEndTime,
  initialTitle,
  editingEvent,
  visibleDepartments,
  usersFromStaff,
  effectiveProfile,
  events,
  handleBatchUpdateAttendance,
  handleCopyEvent,
  templateEvent,
  isSettingsOpen,
  setIsSettingsOpen,
  departments,
  holidays,
  sysCategories,
  teachers,
  showArchived,
  onToggleArchived,
  isTimetableSettingsOpen,
  setIsTimetableSettingsOpen,
  hasPermission,
  isCalendarSettingsOpen,
  setIsCalendarSettingsOpen,
  logoUrl,
  isMemoModalOpen,
  setIsMemoModalOpen,
  memoRecipients,
  setMemoRecipients,
  memoMessage,
  setMemoMessage,
  handleSendMemo,
  formatUserDisplay,
  selectedMemo,
  setSelectedMemo,
  handleMarkMemoRead,
  handleDeleteMemo,
}) => {
  return (
    <>
      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onSearch={handleGlobalSearch}
        onSelect={handleSearchSelect}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        canClose={!!currentUser}
      />

      {/* Profile Dropdown Menu */}
      <ProfileDropdown
        isOpen={isProfileMenuOpen}
        onClose={() => setIsProfileMenuOpen(false)}
        userProfile={userProfile}
        currentStaffMember={currentStaffMember}
        onOpenPermissionView={() => setIsPermissionViewOpen(true)}
        onLogout={handleLogout}
      />

      {/* Permission View Modal */}
      <PermissionViewModal
        isOpen={isPermissionViewOpen}
        onClose={() => setIsPermissionViewOpen(false)}
        userProfile={userProfile}
        accessibleTabs={accessibleTabs}
        rolePermissions={rolePermissions}
      />

      {/* Event Modal */}
      {isEventModalOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
              <VideoLoading className="h-screen" />
            </div>
          }
        >
          <EventModal
            isOpen={isEventModalOpen}
            onClose={() => {
              setIsEventModalOpen(false);
              setInitialTitle('');
              setPendingBucketId(null);
              setTemplateEvent(null);
            }}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            initialDate={selectedDate}
            initialEndDate={selectedEndDate}
            initialDepartmentId={selectedDeptId}
            initialDepartmentIds={selectedDeptIds}
            initialStartTime={initialStartTime}
            initialEndTime={initialEndTime}
            initialTitle={initialTitle}
            existingEvent={editingEvent}
            departments={visibleDepartments}
            readOnly={false}
            users={usersFromStaff}
            currentUser={effectiveProfile}
            allEvents={events}
            onBatchUpdateAttendance={handleBatchUpdateAttendance}
            onCopy={handleCopyEvent}
            templateEvent={templateEvent}
          />
        </Suspense>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
              <VideoLoading className="h-screen" />
            </div>
          }
        >
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            departments={departments}
            currentUserProfile={effectiveProfile}
            users={usersFromStaff}
            holidays={holidays}
            events={events}
            sysCategories={sysCategories}
            teachers={teachers}
            showArchived={showArchived}
            onToggleArchived={onToggleArchived}
          />
        </Suspense>
      )}

      {/* Timetable Settings Modal */}
      {isTimetableSettingsOpen && (
        <Suspense fallback={null}>
          <TimetableSettingsModal
            isOpen={isTimetableSettingsOpen}
            onClose={() => setIsTimetableSettingsOpen(false)}
            canEdit={hasPermission('timetable.math.edit') || hasPermission('timetable.english.edit')}
            currentUser={effectiveProfile}
          />
        </Suspense>
      )}

      {/* Calendar Settings Modal */}
      {isCalendarSettingsOpen && (
        <Suspense fallback={null}>
          <CalendarSettingsModal
            isOpen={isCalendarSettingsOpen}
            onClose={() => setIsCalendarSettingsOpen(false)}
            currentUser={effectiveProfile}
          />
        </Suspense>
      )}

      {/* Access Denied / Pending Approval Overlay */}
      {currentUser && userProfile?.status === 'pending' && (
        <PendingApprovalOverlay logoUrl={logoUrl} onLogout={handleLogout} />
      )}

      {/* Memo Send Modal */}
      <MemoSendModal
        isOpen={isMemoModalOpen}
        onClose={() => setIsMemoModalOpen(false)}
        usersFromStaff={usersFromStaff}
        currentUser={currentUser}
        memoRecipients={memoRecipients}
        setMemoRecipients={setMemoRecipients}
        memoMessage={memoMessage}
        setMemoMessage={setMemoMessage}
        handleSendMemo={handleSendMemo}
        formatUserDisplay={formatUserDisplay}
      />

      {/* Memo Detail Modal */}
      <MemoDetailModal
        selectedMemo={selectedMemo}
        onClose={() => setSelectedMemo(null)}
        onReply={(senderUid) => {
          setMemoRecipients([senderUid]);
          setIsMemoModalOpen(true);
          setSelectedMemo(null);
        }}
        handleMarkMemoRead={handleMarkMemoRead}
        handleDeleteMemo={handleDeleteMemo}
      />
    </>
  );
};
