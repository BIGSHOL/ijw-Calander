import React from 'react';
import { CalendarEvent, UserProfile } from '../../types';
import { Trash2, Copy, ChevronDown } from 'lucide-react';

interface EventModalActionsProps {
  canDeleteEvent: boolean | undefined;
  existingEvent?: CalendarEvent | null;
  onDelete: (id: string, event?: CalendarEvent) => void;
  onClose: () => void;
  onCopy?: (event: CalendarEvent) => void;
  isViewMode: boolean;
  setIsViewMode: React.Dispatch<React.SetStateAction<boolean>>;
  canEditCurrent: boolean;
  authorId: string;
  setAuthorId: React.Dispatch<React.SetStateAction<string>>;
  authorName: string;
  setAuthorName: React.Dispatch<React.SetStateAction<string>>;
  users: UserProfile[];
  currentUser: UserProfile | null;
  title: string;
  description: string;
  referenceUrl: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  setReferenceUrl: React.Dispatch<React.SetStateAction<string>>;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
  setStartTime: React.Dispatch<React.SetStateAction<string>>;
  setEndTime: React.Dispatch<React.SetStateAction<string>>;
}

const EventModalActions: React.FC<EventModalActionsProps> = ({
  canDeleteEvent,
  existingEvent,
  onDelete,
  onClose,
  onCopy,
  isViewMode,
  setIsViewMode,
  canEditCurrent,
  authorId,
  setAuthorId,
  authorName,
  setAuthorName,
  users,
  currentUser,
  title,
  description,
  referenceUrl,
  startDate,
  endDate,
  startTime,
  endTime,
  setTitle,
  setDescription,
  setReferenceUrl,
  setStartDate,
  setEndDate,
  setStartTime,
  setEndTime,
}) => {
  const handleCancelEdit = () => {
    if (existingEvent && !isViewMode) {
      setIsViewMode(true);
      // Reset to existing event data
      setTitle(existingEvent.title);
      setDescription(existingEvent.description || '');
      setReferenceUrl(existingEvent.referenceUrl || '');
      setStartDate(existingEvent.startDate);
      setEndDate(existingEvent.endDate);
      setStartTime(existingEvent.startTime || '');
      setEndTime(existingEvent.endTime || '');
    } else {
      onClose();
    }
  };

  return (
    <div className="flex justify-between items-center pt-3 border-t border-gray-200 bg-gray-50 -mx-3 -mb-3 px-3 py-2 mt-3">
      {canDeleteEvent ? (
        <button
          type="button"
          onClick={() => {
            if (confirm('정말 삭제하시겠습니까?')) {
              onDelete(existingEvent!.id, existingEvent!);
              onClose();
            }
          }}
          className="text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 text-xs px-3 py-1.5 rounded-sm hover:bg-red-50 transition-all"
        >
          <Trash2 size={14} /> 삭제
        </button>
      ) : canEditCurrent && existingEvent ? (
        <div />
      ) : (
        // Author Display (Bottom Left) for new events
        <div className="flex flex-col justify-center">
          <span className="text-xxs text-gray-400 mb-0.5">작성자</span>
          {(currentUser?.canManageEventAuthors || currentUser?.role === 'master') ? (
            <div className="relative">
              <select
                value={authorId}
                onChange={(e) => {
                  const selectedUser = users.find(u => u.uid === e.target.value);
                  if (selectedUser) {
                    setAuthorId(selectedUser.uid);
                    setAuthorName(`${selectedUser.email.split('@')[0]} ${selectedUser.jobTitle ? `(${selectedUser.jobTitle})` : ''}`);
                  }
                }}
                className="appearance-none bg-white border border-gray-200 text-gray-700 text-xs py-1 pl-2 pr-6 rounded-sm outline-none focus:border-accent cursor-pointer"
              >
                {users.filter(u => u.status === 'approved').map(u => (
                  <option key={u.uid} value={u.uid}>{u.email.split('@')[0]} {u.jobTitle ? `(${u.jobTitle})` : ''}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-500">
                <ChevronDown size={10} />
              </div>
            </div>
          ) : (
            <span className="text-xs text-gray-600">{authorName || 'Unknown'}</span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        {/* Left Side: Close or Cancel */}
        <button
          type="button"
          onClick={handleCancelEdit}
          className="px-4 py-1.5 text-gray-600 hover:bg-gray-200 rounded-sm text-xs font-semibold transition-all"
        >
          {(existingEvent && !isViewMode) ? '취소' : '닫기'}
        </button>

        {/* Copy Button (View Mode Only) */}
        {isViewMode && existingEvent && onCopy && (
          <button
            type="button"
            onClick={() => onCopy(existingEvent)}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-sm hover:bg-gray-300 text-xs font-semibold transition-all flex items-center gap-1"
            title="일정 복사"
          >
            <Copy size={12} />
            <span className="hidden sm:inline">복사</span>
          </button>
        )}

        {/* Edit Button (View Mode Only) */}
        {isViewMode && canEditCurrent && existingEvent && (
          <button
            type="button"
            onClick={() => setIsViewMode(false)}
            className="px-5 py-1.5 bg-accent text-primary rounded-sm hover:brightness-110 text-xs font-bold shadow-sm transition-all"
          >
            수정
          </button>
        )}

        {/* Save Button (Edit Mode Only) */}
        {!isViewMode && canEditCurrent && (
          <button
            type="submit"
            className="px-5 py-1.5 bg-accent text-primary rounded-sm hover:brightness-110 text-xs font-bold shadow-sm transition-all"
          >
            저장
          </button>
        )}
      </div>
    </div>
  );
};

export default EventModalActions;
