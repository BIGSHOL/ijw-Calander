import React, { useState } from 'react';
import { X, UserPlus, Users, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  status: 'attending' | 'pending' | 'absent';
}

interface ParticipantsPanelProps {
  isOpen: boolean;
  eventTitle?: string;
  participants?: Participant[];
  onClose: () => void;
  onAddParticipant?: (name: string) => void;
  onUpdateStatus?: (participantId: string, status: 'attending' | 'pending' | 'absent') => void;
  onRemoveParticipant?: (participantId: string) => void;
}

const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  isOpen,
  eventTitle,
  participants = [],
  onClose,
  onAddParticipant,
  onUpdateStatus,
  onRemoveParticipant
}) => {
  const [newParticipantName, setNewParticipantName] = useState('');

  const handleAddParticipant = () => {
    if (newParticipantName.trim() && onAddParticipant) {
      onAddParticipant(newParticipantName.trim());
      setNewParticipantName('');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'attending':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-600" />;
      case 'absent':
        return <XCircle size={16} className="text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'attending':
        return '참석';
      case 'pending':
        return '대기';
      case 'absent':
        return '불참';
      default:
        return '';
    }
  };

  return (
    <>
      {/* Side Panel - No backdrop, positioned relative to modal */}
      <div
        className={`bg-white rounded-sm shadow-2xl w-96 h-[90vh] border border-gray-200 transform transition-all duration-300 ease-in-out ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-accent" />
              <h3 className="text-lg font-bold text-gray-900">참가자 관리</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/80 rounded-sm transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Event Title */}
          {eventTitle && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm text-gray-600">일정</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{eventTitle}</p>
            </div>
          )}

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Add Participant Form */}
            <div className="bg-amber-50 rounded-sm p-4 border border-amber-200">
              <h4 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                <UserPlus size={16} />
                참가자 추가
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                  placeholder="이름 입력"
                  className="flex-1 px-3 py-2 border border-amber-300 rounded-sm text-sm focus:ring-2 focus:ring-accent outline-none"
                />
                <button
                  onClick={handleAddParticipant}
                  disabled={!newParticipantName.trim()}
                  className="px-4 py-2 bg-accent text-primary rounded-sm font-bold text-sm hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  추가
                </button>
              </div>
            </div>

            {/* Participants List */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-gray-700 flex items-center justify-between">
                <span>참가자 목록</span>
                <span className="text-xs font-normal text-gray-500">
                  {participants.length}명
                </span>
              </h4>

              {participants.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">등록된 참가자가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="bg-white rounded-sm border border-gray-200 p-3 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                            {participant.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">
                            {participant.name}
                          </span>
                        </div>
                        {onRemoveParticipant && (
                          <button
                            onClick={() => onRemoveParticipant(participant.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      {/* Status Buttons */}
                      {onUpdateStatus && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => onUpdateStatus(participant.id, 'attending')}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-bold transition-colors ${
                              participant.status === 'attending'
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <CheckCircle size={12} />
                            참석
                          </button>
                          <button
                            onClick={() => onUpdateStatus(participant.id, 'pending')}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-bold transition-colors ${
                              participant.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <Clock size={12} />
                            대기
                          </button>
                          <button
                            onClick={() => onUpdateStatus(participant.id, 'absent')}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-bold transition-colors ${
                              participant.status === 'absent'
                                ? 'bg-red-100 text-red-700 border border-red-300'
                                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <XCircle size={12} />
                            불참
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Statistics */}
            {participants.length > 0 && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-sm p-4 border border-gray-200">
                <h4 className="text-sm font-bold text-gray-700 mb-3">출석 현황</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-sm p-3 text-center">
                    <div className="flex items-center justify-center mb-1">
                      <CheckCircle size={16} className="text-green-600" />
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {participants.filter(p => p.status === 'attending').length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">참석</div>
                  </div>
                  <div className="bg-white rounded-sm p-3 text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Clock size={16} className="text-yellow-600" />
                    </div>
                    <div className="text-xl font-bold text-yellow-600">
                      {participants.filter(p => p.status === 'pending').length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">대기</div>
                  </div>
                  <div className="bg-white rounded-sm p-3 text-center">
                    <div className="flex items-center justify-center mb-1">
                      <XCircle size={16} className="text-red-600" />
                    </div>
                    <div className="text-xl font-bold text-red-600">
                      {participants.filter(p => p.status === 'absent').length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">불참</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ParticipantsPanel;
