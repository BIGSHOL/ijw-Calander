
import React, { useState, useEffect } from 'react';
import { CalendarEvent, Department, UserProfile } from '../types';
import { EVENT_COLORS } from '../constants';
// Added Edit3 and Plus to the imports to fix "Cannot find name" errors on line 95
import { X, Trash2, Clock, Users, AlignLeft, Type, Edit3, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  initialDate?: string;
  initialEndDate?: string;
  initialDepartmentId?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  existingEvent?: CalendarEvent | null;
  departments: Department[];
  users: UserProfile[];
  currentUser: UserProfile | null;
  readOnly?: boolean;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  initialEndDate,
  initialDepartmentId,
  initialStartTime,
  initialEndTime,
  existingEvent,
  departments,
  users,
  currentUser,
  readOnly
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#fee2e2');
  const [selectedTextColor, setSelectedTextColor] = useState('#ffffff');
  const [selectedBorderColor, setSelectedBorderColor] = useState('#fee2e2');
  const [authorId, setAuthorId] = useState('');
  const [authorName, setAuthorName] = useState('');

  // Track which event ID we last loaded to prevent unnecessary resets
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Determine current target ID (existing ID or 'new')
      const currentTargetId = existingEvent ? existingEvent.id : 'new';

      // Only reset form if we are opening a different event or freshly opening 'new'
      if (loadedEventId !== currentTargetId) {
        setLoadedEventId(currentTargetId);

        if (existingEvent) {
          setTitle(existingEvent.title);
          setDescription(existingEvent.description || '');
          // Robustness: Handle if participants is string (expected) or array (legacy/error)
          const rawParticipants = existingEvent.participants;
          if (typeof rawParticipants === 'string') {
            setParticipants(rawParticipants.split(', '));
          } else if (Array.isArray(rawParticipants)) {
            setParticipants(rawParticipants);
          } else {
            setParticipants([]);
          }
          setDepartmentId(existingEvent.departmentId);
          setAuthorId(existingEvent.authorId || '');
          setAuthorName(existingEvent.authorName || '');
          setStartDate(existingEvent.startDate);
          setEndDate(existingEvent.endDate);
          setStartTime(existingEvent.startTime || '');
          setEndTime(existingEvent.endTime || '');
          // Legacy support/Robustness: If time is missing, it must be All Day
          const isTimeEmpty = !existingEvent.startTime && !existingEvent.endTime;
          setIsAllDay(existingEvent.isAllDay || isTimeEmpty);

          // Handle Color
          const colorVal = existingEvent.color;
          const knownColor = EVENT_COLORS.find(c => c.value === colorVal);
          const initialBgColor = knownColor ? knownColor.value : (colorVal.startsWith('#') ? colorVal : '#fee2e2');
          setSelectedColor(initialBgColor);

          // Handle Text & Border Colors
          setSelectedTextColor(existingEvent.textColor || '#ffffff');
          setSelectedBorderColor(existingEvent.borderColor || initialBgColor);
        } else {
          setTitle('');
          setDescription('');
          // Default Logic: Auto-select Current User
          if (currentUser) {
            const myName = `${currentUser.email.split('@')[0]} ${currentUser.jobTitle ? `(${currentUser.jobTitle})` : ''}`;
            setParticipants([myName]);
            setAuthorId(currentUser.uid);
            setAuthorName(myName);
          } else {
            setParticipants([]);
            setAuthorId('');
            setAuthorName('');
          }
          setDepartmentId(initialDepartmentId || departments[0]?.id || '');
          setStartDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
          setEndDate(initialEndDate || initialDate || format(new Date(), 'yyyy-MM-dd'));
          setStartTime(initialStartTime || '');
          setEndTime(initialEndTime || '');
          setIsAllDay(false);
          setSelectedColor('#fee2e2');
          setSelectedTextColor('#ffffff');
          setSelectedBorderColor('#fee2e2');
        }
      }
    } else {
      // When closed, reset loaded ID so it re-initializes next time
      setLoadedEventId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existingEvent, initialDate, initialEndDate, initialDepartmentId, initialStartTime, initialEndTime, departments]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Generate ID for new events
    let newId = existingEvent?.id;
    if (!newId) {
      // 1. Sanitize Title (remove special chars, limit length)
      const safeTitle = title.trim().replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 10);
      // 2. Random suffix (4 chars)
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      // 3. Department Name (Korean) - Fallback to ID if not found
      const deptObj = departments.find(d => d.id === departmentId);
      const safeDeptName = deptObj ? deptObj.name : (departmentId || 'no_dept');

      // Format: YYYY-MM-DD_DeptName_Title_Random
      newId = `${startDate}_${safeDeptName}_${safeTitle}_${randomSuffix}`;
    }

    const payload = {
      id: newId,
      title,
      description,
      participants: participants.join(', '),
      departmentId,
      startDate,
      endDate,
      startTime: isAllDay ? '' : startTime,
      endTime: isAllDay ? '' : endTime,
      isAllDay,
      color: selectedColor,
      textColor: selectedTextColor,
      borderColor: selectedBorderColor,
      authorId,
      authorName
    };
    console.log('DEBUG: selectedColor', selectedColor);
    console.log('DEBUG: selectedTextColor', selectedTextColor);
    console.log('DEBUG: selectedBorderColor', selectedBorderColor);
    console.log('EventModal handleSubmit payload:', payload);
    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-0 relative max-h-[90vh] overflow-hidden border border-gray-200">
        <div className="bg-[#081429] p-4 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {existingEvent ? <Edit3 size={20} className="text-[#fdb813]" /> : <Plus size={20} className="text-[#fdb813]" />}
            {existingEvent ? '일정 수정' : '새 일정 추가'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-64px)]">
          {/* Title */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Type size={14} className="text-[#fdb813]" /> 제목
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none transition-all font-medium"
              placeholder="일정 제목을 입력하세요"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5">
              부서
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none bg-white font-medium cursor-pointer"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time Range */}
          <div className="grid grid-cols-1 gap-4">
            {/* Start */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider flex items-center gap-1">
                <Clock size={14} className="text-[#fdb813]" /> 시작
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="w-4 h-4 rounded text-[#fdb813] focus:ring-[#fdb813] border-gray-300"
                  />
                  <label htmlFor="allDay" className="text-xs font-bold text-gray-500 cursor-pointer select-none">
                    하루종일
                  </label>
                </div>
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                />
                {!isAllDay && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-36 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                  />
                )}
              </div>
            </div>

            {/* End */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider flex items-center gap-1">
                <Clock size={14} className="text-[#fdb813]" /> 종료
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                />
                {!isAllDay && (
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-36 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Participants - Multi Select Checkbox List */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2 flex items-center gap-1">
              <Users size={14} className="text-[#fdb813]" /> 참가자
            </label>
            <div className="border border-gray-300 rounded-xl p-3 max-h-40 overflow-y-auto bg-gray-50/50">
              {/* Current User (Always first) */}
              {users.filter(u => u.status === 'approved').map(u => {
                const displayName = `${u.email.split('@')[0]} ${u.jobTitle ? `(${u.jobTitle})` : ''}`;
                const isSelected = participants.includes(displayName);
                return (
                  <label key={u.uid} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setParticipants([...participants, displayName]);
                        } else {
                          setParticipants(participants.filter(p => p !== displayName));
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 accent-[#081429]"
                    />
                    <span className={`text-sm ${isSelected ? 'font-bold text-[#081429]' : 'text-gray-600'}`}>{displayName}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlignLeft size={14} className="text-[#fdb813]" /> 상세 내용
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none min-h-[100px] resize-y font-medium text-sm"
              placeholder="일정의 자세한 내용을 입력하세요"
            />
          </div>

          {/* Color Pickers */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2">
              색상 스타일
            </label>
            <div className="flex gap-6 items-center">
              {/* Background Color */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm transition-transform hover:scale-105 active:scale-95">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] cursor-pointer p-0 border-0"
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-500">배경색</span>
              </div>

              {/* Text Color */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm transition-transform hover:scale-105 active:scale-95">
                  <input
                    type="color"
                    value={selectedTextColor}
                    onChange={(e) => setSelectedTextColor(e.target.value)}
                    className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] cursor-pointer p-0 border-0"
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-500">글자색</span>
              </div>

              {/* Border Color */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm transition-transform hover:scale-105 active:scale-95">
                  <input
                    type="color"
                    value={selectedBorderColor}
                    onChange={(e) => setSelectedBorderColor(e.target.value)}
                    className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] cursor-pointer p-0 border-0"
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-500">테두리색</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          {/* <div className="border-t border-gray-100 my-2"></div> */}

          {/* Edit Mode: Author Display logic needs to be here too if existing event */}
          {existingEvent && (
            <div>
              <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2">
                작성자 정보
              </label>
              {currentUser?.canManageEventAuthors ? (
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
                    className="w-full appearance-none bg-white border border-gray-300 text-gray-700 text-sm font-bold py-2.5 px-4 rounded-xl outline-none focus:border-[#fdb813] cursor-pointer focus:ring-2 focus:ring-[#fdb813]"
                  >
                    {users.filter(u => u.status === 'approved').map(u => (
                      <option key={u.uid} value={u.uid}>{u.email.split('@')[0]} {u.jobTitle ? `(${u.jobTitle})` : ''}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-bold text-sm">
                  {authorName || '작성자 정보 없음'}
                </div>
              )}
            </div>
          )
          }

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-100">
            {existingEvent ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('정말 삭제하시겠습니까?')) {
                    onDelete(existingEvent.id);
                    onClose();
                  }
                }}
                className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1 text-sm px-4 py-2 rounded-xl hover:bg-red-50 transition-all"
              >
                <Trash2 size={18} /> 삭제
              </button>
            ) : (
              // Author Display (Bottom Left)
              <div className="flex flex-col justify-center px-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">작성자</span>
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
                      className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg outline-none focus:border-[#fdb813] cursor-pointer"
                    >
                      {users.filter(u => u.status === 'approved').map(u => (
                        <option key={u.uid} value={u.uid}>{u.email.split('@')[0]} {u.jobTitle ? `(${u.jobTitle})` : ''}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                      <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-gray-600">{authorName || 'Unknown'}</span>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-[#373d41] hover:bg-gray-100 rounded-xl text-sm font-bold transition-all"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-8 py-2.5 bg-[#fdb813] text-[#081429] rounded-xl hover:brightness-110 text-sm font-extrabold shadow-lg transition-all"
              >
                저장
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
