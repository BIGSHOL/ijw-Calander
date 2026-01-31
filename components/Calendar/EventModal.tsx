import React from 'react';
import { CalendarEvent, Department, UserProfile } from '../../types';
import { X, Eye, Edit3, Plus } from 'lucide-react';
import { useEventModalState } from './hooks/useEventModalState';
import EventFormFields from './EventFormFields';
import ParticipantSelector from './ParticipantSelector';
import EventModalActions from './EventModalActions';
import SeminarPanel from './SeminarPanel';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (id: string, event?: CalendarEvent) => void;
  initialDate?: string;
  initialEndDate?: string;
  initialDepartmentId?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialTitle?: string;
  initialDepartmentIds?: string[];
  existingEvent?: CalendarEvent | null;
  departments: Department[];
  users: UserProfile[];
  currentUser: UserProfile | null;
  readOnly?: boolean;
  allEvents?: CalendarEvent[];
  onBatchUpdateAttendance?: (groupId: string, uid: string, status: 'pending' | 'joined' | 'declined') => void;
  onCopy?: (event: CalendarEvent) => void;
  templateEvent?: CalendarEvent | null;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  initialEndDate,
  initialDepartmentId,
  initialDepartmentIds,
  initialStartTime,
  initialEndTime,
  initialTitle,
  existingEvent,
  departments,
  users,
  currentUser,
  readOnly,
  allEvents = [],
  onBatchUpdateAttendance,
  onCopy,
  templateEvent
}) => {
  const state = useEventModalState({
    isOpen,
    onClose,
    onSave,
    initialDate,
    initialEndDate,
    initialDepartmentId,
    initialDepartmentIds,
    initialStartTime,
    initialEndTime,
    initialTitle,
    existingEvent,
    departments,
    users,
    currentUser,
    templateEvent
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 gap-4 p-4" onClick={onClose}>
      {/* Main Event Modal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-0 relative h-[90vh] overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#081429] p-4 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {existingEvent ? (state.isViewMode ? <Eye size={20} className="text-[#fdb813]" /> : <Edit3 size={20} className="text-[#fdb813]" />) : <Plus size={20} className="text-[#fdb813]" />}
            {state.isViewMode ? '일정 상세' : (existingEvent ? '일정 수정' : '새 일정 추가')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={state.handleSubmit} className="p-6 space-y-3 overflow-y-auto h-[calc(90vh-64px)]">
          <EventFormFields
            title={state.title}
            description={state.description}
            departmentIds={state.departmentIds}
            startDate={state.startDate}
            endDate={state.endDate}
            startTime={state.startTime}
            endTime={state.endTime}
            isAllDay={state.isAllDay}
            selectedColor={state.selectedColor}
            selectedTextColor={state.selectedTextColor}
            selectedBorderColor={state.selectedBorderColor}
            authorId={state.authorId}
            authorName={state.authorName}
            referenceUrl={state.referenceUrl}
            isViewMode={state.isViewMode}
            recurrenceType={state.recurrenceType}
            recurrenceCount={state.recurrenceCount}
            isDeptDropdownOpen={state.isDeptDropdownOpen}
            selectedTags={state.selectedTags}
            availableTags={state.availableTags}
            seminarTags={state.seminarTags}
            setTitle={state.setTitle}
            setDescription={state.setDescription}
            setDepartmentIds={state.setDepartmentIds}
            setStartDate={state.setStartDate}
            setEndDate={state.setEndDate}
            setStartTime={state.setStartTime}
            setEndTime={state.setEndTime}
            setIsAllDay={state.setIsAllDay}
            setSelectedColor={state.setSelectedColor}
            setSelectedTextColor={state.setSelectedTextColor}
            setSelectedBorderColor={state.setSelectedBorderColor}
            setAuthorId={state.setAuthorId}
            setAuthorName={state.setAuthorName}
            setReferenceUrl={state.setReferenceUrl}
            setRecurrenceType={state.setRecurrenceType}
            setRecurrenceCount={state.setRecurrenceCount}
            setIsDeptDropdownOpen={state.setIsDeptDropdownOpen}
            setSelectedTags={state.setSelectedTags}
            existingEvent={existingEvent}
            departments={departments}
            users={users}
            allEvents={allEvents}
            canEditCurrent={state.canEditCurrent}
            isMaster={state.isMaster}
            isAdmin={state.isAdmin}
            currentUser={currentUser}
          />

          <ParticipantSelector
            participants={state.participants}
            setParticipants={state.setParticipants}
            attendance={state.attendance}
            setAttendance={state.setAttendance}
            users={users}
            currentUser={currentUser}
            isViewMode={state.isViewMode}
            canEditCurrent={state.canEditCurrent}
            isMaster={state.isMaster}
            isAdmin={state.isAdmin}
            canManageAttendance={state.canManageAttendance}
            existingEvent={existingEvent}
            onBatchUpdateAttendance={onBatchUpdateAttendance}
            isParticipantsDropdownOpen={state.isParticipantsDropdownOpen}
            setIsParticipantsDropdownOpen={state.setIsParticipantsDropdownOpen}
          />

          <EventModalActions
            canDeleteEvent={state.canDeleteEvent}
            existingEvent={existingEvent}
            onDelete={onDelete}
            onClose={onClose}
            onCopy={onCopy}
            isViewMode={state.isViewMode}
            setIsViewMode={state.setIsViewMode}
            canEditCurrent={state.canEditCurrent}
            authorId={state.authorId}
            setAuthorId={state.setAuthorId}
            authorName={state.authorName}
            setAuthorName={state.setAuthorName}
            users={users}
            currentUser={currentUser}
            title={state.title}
            description={state.description}
            referenceUrl={state.referenceUrl}
            startDate={state.startDate}
            endDate={state.endDate}
            startTime={state.startTime}
            endTime={state.endTime}
            setTitle={state.setTitle}
            setDescription={state.setDescription}
            setReferenceUrl={state.setReferenceUrl}
            setStartDate={state.setStartDate}
            setEndDate={state.setEndDate}
            setStartTime={state.setStartTime}
            setEndTime={state.setEndTime}
          />
        </form>
      </div>

      {/* Seminar Management Side Panel */}
      <div onClick={(e) => e.stopPropagation()}>
        <SeminarPanel
          isOpen={state.isPanelOpen}
          eventTitle={state.title}
          seminarData={state.seminarData}
          students={state.students}
          users={users}
          onClose={() => state.setIsPanelOpen(false)}
          onUpdateSeminarData={(data) => state.setSeminarData(data)}
        />
      </div>
    </div>
  );
};

export default EventModal;
