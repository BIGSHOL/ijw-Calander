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

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', transform: 'translateZ(0)', transition: 'none', zIndex: 9998, display: isOpen ? 'flex' : 'none' }} onClick={onClose}>
      {/* Main Event Modal */}
      <div className="bg-white rounded-sm shadow-xl max-w-2xl relative max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header - StudentDetailModal 스타일 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            {existingEvent ? (state.isViewMode ? <Eye size={16} className="text-accent" /> : <Edit3 size={16} className="text-accent" />) : <Plus size={16} className="text-accent" />}
            {state.isViewMode ? '일정 상세' : (existingEvent ? '일정 수정' : '새 일정 추가')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={state.handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-3">
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
            canManageAllDepts={state.canManageAllDepts}
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
            canManageAllDepts={state.canManageAllDepts}
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
      {state.isPanelOpen && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2" onClick={(e) => e.stopPropagation()}>
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
      )}
    </div>
  );
};

export default EventModal;
