import React from 'react';
import { CalendarEvent, UserProfile } from '../../types';
import { Users, ChevronDown, ChevronUp, X } from 'lucide-react';

interface ParticipantSelectorProps {
  participants: string[];
  setParticipants: React.Dispatch<React.SetStateAction<string[]>>;
  attendance: Record<string, 'pending' | 'joined' | 'declined'>;
  setAttendance: React.Dispatch<React.SetStateAction<Record<string, 'pending' | 'joined' | 'declined'>>>;
  users: UserProfile[];
  currentUser: UserProfile | null;
  isViewMode: boolean;
  canEditCurrent: boolean;
  isMaster: boolean;
  isAdmin: boolean;
  canManageAttendance: boolean;
  existingEvent?: CalendarEvent | null;
  onBatchUpdateAttendance?: (groupId: string, uid: string, status: 'pending' | 'joined' | 'declined') => void;
  isParticipantsDropdownOpen: boolean;
  setIsParticipantsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ParticipantSelector: React.FC<ParticipantSelectorProps> = ({
  participants,
  setParticipants,
  attendance,
  setAttendance,
  users,
  currentUser,
  isViewMode,
  canEditCurrent,
  isMaster,
  isAdmin,
  canManageAttendance,
  existingEvent,
  onBatchUpdateAttendance,
  isParticipantsDropdownOpen,
  setIsParticipantsDropdownOpen,
}) => {
  return (
    <div>
      <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2 flex items-center gap-1">
        <Users size={14} className="text-[#fdb813]" /> 참가자
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsParticipantsDropdownOpen(!isParticipantsDropdownOpen)}
          className="w-full text-left px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] bg-white flex justify-between items-center outline-none transition-all"
        >
          <span className={`text-sm font-medium ${participants.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
            {participants.length === 0
              ? '참가자를 선택하세요'
              : `${participants[0]} 외 ${participants.length - 1}명`}
          </span>
          {isParticipantsDropdownOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>

        {isParticipantsDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
            {users
              .filter(u => u.status === 'approved')
              .sort((a, b) => {
                const getDisplayName = (user: typeof a) => {
                  const name = user.displayName || user.email.split('@')[0];
                  return user.jobTitle ? `${name} (${user.jobTitle})` : name;
                };
                const aSelected = participants.includes(getDisplayName(a));
                const bSelected = participants.includes(getDisplayName(b));
                if (currentUser && a.uid === currentUser.uid) return -1;
                if (currentUser && b.uid === currentUser.uid) return 1;
                if (aSelected && !bSelected) return -1;
                if (!aSelected && bSelected) return 1;
                const nameA = `${a.email.split('@')[0]} ${a.jobTitle || ''}`;
                const nameB = `${b.email.split('@')[0]} ${b.jobTitle || ''}`;
                return nameA.localeCompare(nameB);
              })
              .map(u => {
                const name = u.displayName || u.email.split('@')[0];
                const displayName = u.jobTitle ? `${name} (${u.jobTitle})` : name;
                const isSelected = participants.includes(displayName);
                const currentStatus = attendance[u.uid] || 'pending';
                const canEditStatus = currentUser?.uid === u.uid || isMaster || isAdmin || canManageAttendance;
                const cycleStatus = () => {
                  const next: Record<string, 'pending' | 'joined' | 'declined'> = {
                    'pending': 'joined',
                    'joined': 'declined',
                    'declined': 'pending'
                  };
                  const newStatus = next[currentStatus];
                  if (existingEvent?.recurrenceGroupId && onBatchUpdateAttendance) {
                    const applyToAll = window.confirm(
                      `참가 상태를 "${newStatus === 'joined' ? '참석' : newStatus === 'declined' ? '불참' : '미정'}"(으)로 변경합니다.\n\n모든 반복 일정에도 적용하시겠습니까?`
                    );
                    if (applyToAll) {
                      onBatchUpdateAttendance(existingEvent.recurrenceGroupId, u.uid, newStatus);
                    }
                  }
                  setAttendance(prev => ({ ...prev, [u.uid]: newStatus }));
                };

                return (
                  <div key={u.uid} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors group">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isViewMode || !canEditCurrent}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setParticipants([...participants, displayName]);
                            setAttendance(prev => ({ ...prev, [u.uid]: 'pending' }));
                          } else {
                            setParticipants(participants.filter(p => p !== displayName));
                            const newAtt = { ...attendance };
                            delete newAtt[u.uid];
                            setAttendance(newAtt);
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 accent-[#081429]"
                      />
                      <span className={`text-sm ${isSelected ? 'font-bold text-[#081429]' : 'text-gray-700'}`}>{displayName}</span>
                    </label>

                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (canEditStatus) cycleStatus();
                        }}
                        disabled={!canEditStatus}
                        className={`
                              text-xxs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border flex items-center gap-1 transition-all
                              ${currentStatus === 'joined' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                              ${currentStatus === 'declined' ? 'bg-red-100 text-red-700 border-red-200' : ''}
                              ${currentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : ''}
                              ${canEditStatus ? 'cursor-pointer hover:brightness-95' : 'cursor-default opacity-80'}
                          `}
                      >
                        {currentStatus === 'joined' && '참석'}
                        {currentStatus === 'declined' && '불참'}
                        {currentStatus === 'pending' && '미정'}
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {participants.map(p => (
            <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              {p}
              {!isViewMode && canEditCurrent && (
                <button
                  type="button"
                  onClick={() => {
                    setParticipants(participants.filter(part => part !== p));
                  }}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParticipantSelector;
