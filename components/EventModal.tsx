
import React, { useState, useEffect } from 'react';
import { CalendarEvent, Department, UserProfile } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { EVENT_COLORS } from '../constants';
// Added Edit3 and Plus to the imports to fix "Cannot find name" errors on line 95
import { X, Trash2, Clock, Users, AlignLeft, Type, Edit3, Plus, Link as LinkIcon, Eye, Copy } from 'lucide-react';
import { format } from 'date-fns';

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
  initialTitle?: string; // For bucket-to-event conversion
  existingEvent?: CalendarEvent | null;
  departments: Department[];
  users: UserProfile[];
  currentUser: UserProfile | null;
  readOnly?: boolean;
  allEvents?: CalendarEvent[]; // For counting recurring events
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]); // Changed to array for multi-select
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
  const [referenceUrl, setReferenceUrl] = useState('');
  // New: View Mode State
  const [isViewMode, setIsViewMode] = useState(false);

  // New State for Attendance
  const [attendance, setAttendance] = useState<Record<string, 'pending' | 'joined' | 'declined'>>({});

  // Recurrence State (only for new events)
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [recurrenceCount, setRecurrenceCount] = useState(1);


  // Permission Logic
  const { hasPermission } = usePermissions(currentUser || null);
  const canCreate = hasPermission('events.create');
  // Authorship check for granular permissions
  const isAuthor = existingEvent?.authorId === currentUser?.uid;
  const canEdit = hasPermission(isAuthor ? 'events.edit_own' : 'events.edit_others');
  const canDelete = hasPermission(isAuthor ? 'events.delete_own' : 'events.delete_others');

  const isMaster = currentUser?.role === 'master';
  const isAdmin = currentUser?.role === 'admin';
  const hasDeptAccess = isMaster || isAdmin || departmentIds.some(dId => currentUser?.departmentPermissions?.[dId] === 'edit');

  const canSaveEvent = hasDeptAccess && (!existingEvent ? canCreate : canEdit);
  const canDeleteEvent = existingEvent && hasDeptAccess && canDelete;

  const canEditCurrent = canSaveEvent; // Alias for existing JSX compatibility

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
          setIsViewMode(true); // Default to View Mode for existing events
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
          setReferenceUrl(existingEvent.referenceUrl || '');
          setDepartmentIds(existingEvent.departmentIds || [existingEvent.departmentId]);
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

          // Fix: Reset recurrence state for existing events to prevent state pollution
          setRecurrenceType(existingEvent.recurrenceType || 'none');
          setRecurrenceCount(1); // Default count for edit mode (usually not used unless new recurrence started)
          setRecurrenceType(existingEvent.recurrenceType || 'none');
          setRecurrenceCount(1); // Default count for edit mode (usually not used unless new recurrence started)
        } else if (templateEvent) {
          // --- COPY MODE (Template) ---
          setIsViewMode(false); // Edit Mode for new event
          setTitle(templateEvent.title); // Or `[복사] ${templateEvent.title}` if requested
          setDescription(templateEvent.description || '');

          const rawParticipants = templateEvent.participants;
          if (typeof rawParticipants === 'string') {
            setParticipants(rawParticipants.split(', '));
          } else if (Array.isArray(rawParticipants)) {
            setParticipants(rawParticipants);
          } else {
            setParticipants([]);
          }

          setReferenceUrl(templateEvent.referenceUrl || '');
          setDepartmentIds(templateEvent.departmentIds || [templateEvent.departmentId]);
          // Author: Should be CURRENT USER because they are creating the copy
          if (currentUser) {
            const myName = `${currentUser.email.split('@')[0]} ${currentUser.jobTitle ? `(${currentUser.jobTitle})` : ''}`;
            setAuthorId(currentUser.uid);
            setAuthorName(myName);
          } else {
            setAuthorId('');
            setAuthorName('');
          }

          // Dates: Keep original dates but user can edit
          setStartDate(templateEvent.startDate);
          setEndDate(templateEvent.endDate);
          setStartTime(templateEvent.startTime || '');
          setEndTime(templateEvent.endTime || '');
          const isTimeEmpty = !templateEvent.startTime && !templateEvent.endTime;
          setIsAllDay(templateEvent.isAllDay || isTimeEmpty);

          const colorVal = templateEvent.color;
          const knownColor = EVENT_COLORS.find(c => c.value === colorVal);
          const initialBgColor = knownColor ? knownColor.value : (colorVal.startsWith('#') ? colorVal : '#fee2e2');
          setSelectedColor(initialBgColor);
          setSelectedTextColor(templateEvent.textColor || '#ffffff');
          setSelectedBorderColor(templateEvent.borderColor || initialBgColor);

          setRecurrenceType('none'); // Do not copy recurrence rules by default to avoid complexity
          setRecurrenceCount(1);
        } else {
          setIsViewMode(false); // Default to Edit Mode for new events
          setTitle(initialTitle || '');
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
          setReferenceUrl('');

          if (initialDepartmentIds && initialDepartmentIds.length > 0) {
            setDepartmentIds(initialDepartmentIds);
          } else {
            const targetDeptId = initialDepartmentId || departments[0]?.id || '';
            setDepartmentIds(targetDeptId ? [targetDeptId] : []);
          }
          setStartDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
          setEndDate(initialEndDate || initialDate || format(new Date(), 'yyyy-MM-dd'));

          // Auto-fill current time for new events
          const now = new Date();
          const currentHour = now.getHours().toString().padStart(2, '0');
          const currentMin = now.getMinutes().toString().padStart(2, '0');
          const nextHour = ((now.getHours() + 1) % 24).toString().padStart(2, '0');
          setStartTime(initialStartTime || `${currentHour}:${currentMin}`);
          setEndTime(initialEndTime || `${nextHour}:${currentMin}`);
          setIsAllDay(false);

          // Reset recurrence settings for new events
          setRecurrenceType('none');
          setRecurrenceCount(1);


          // Apply Department Defaults
          // Resolution: If multi-selected, pick the FIRST one for default color.
          const effectiveTargetDeptId = (initialDepartmentIds && initialDepartmentIds[0])
            ? initialDepartmentIds[0]
            : (initialDepartmentId || departments[0]?.id || '');

          const targetDept = departments.find(d => d.id === effectiveTargetDeptId);
          setSelectedColor(targetDept?.defaultColor || '#fee2e2');
          setSelectedTextColor(targetDept?.defaultTextColor || '#ffffff');
          setSelectedBorderColor(targetDept?.defaultBorderColor || targetDept?.defaultColor || '#fee2e2');
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
      const primaryDeptId = departmentIds[0] || '';
      const deptObj = departments.find(d => d.id === primaryDeptId);
      const safeDeptName = deptObj ? deptObj.name : (primaryDeptId || 'no_dept');

      // Format: YYYY-MM-DD_DeptName_Title_Random
      newId = `${startDate}_${safeDeptName}_${safeTitle}_${randomSuffix}`;
    }

    const now = new Date().toISOString();
    const primaryDeptId = departmentIds[0] || '';
    const payload: CalendarEvent = {
      id: newId,
      title,
      description,
      participants: participants.join(', '),
      departmentId: primaryDeptId, // Primary department for backward compatibility
      departmentIds: departmentIds, // All selected departments
      startDate,
      endDate,
      startTime: isAllDay ? '' : startTime,
      endTime: isAllDay ? '' : endTime,
      isAllDay,
      color: selectedColor,
      textColor: selectedTextColor,
      borderColor: selectedBorderColor,
      authorId,
      authorName,
      createdAt: existingEvent?.createdAt || now,
      updatedAt: now,
      attendance: attendance,
      referenceUrl: referenceUrl.trim(),
      // Include recurrence info for new events
      recurrenceType: recurrenceType !== 'none' ? recurrenceType : undefined,
      // Fix: Pass relatedGroupId to persist Linked Group association
      relatedGroupId: existingEvent?.relatedGroupId,
    };

    console.log('DEBUG: selectedColor', selectedColor);
    console.log('DEBUG: selectedTextColor', selectedTextColor);
    console.log('DEBUG: selectedBorderColor', selectedBorderColor);
    console.log('EventModal handleSubmit payload:', payload);
    console.log('Recurrence:', recurrenceType, 'Count:', recurrenceCount);

    // Pass recurrence count via a custom property for App.tsx to handle
    (payload as any)._recurrenceCount = recurrenceType !== 'none' ? recurrenceCount : undefined;

    onSave(payload);

    // UI Behavior:
    // If Editing (existingEvent): Switch back to View Mode
    // If Creating (new): Close Modal (default behavior, or consistent view mode if ID management allows)
    if (existingEvent) {
      setIsViewMode(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-0 relative max-h-[90vh] overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#081429] p-4 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {existingEvent ? (isViewMode ? <Eye size={20} className="text-[#fdb813]" /> : <Edit3 size={20} className="text-[#fdb813]" />) : <Plus size={20} className="text-[#fdb813]" />}
            {isViewMode ? '일정 상세' : (existingEvent ? '일정 수정' : '새 일정 추가')}
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
              disabled={isViewMode || !canEditCurrent}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none transition-all font-medium ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              placeholder="일정 제목을 입력하세요"
            />
          </div>

          {/* Department (Multi-Select) */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5">
              부서 (다중 선택 가능)
            </label>
            <div className="border border-gray-300 rounded-xl p-3 max-h-40 overflow-y-auto bg-gray-50/50">
              {departments.map((dept) => {
                const isSelected = departmentIds.includes(dept.id);
                const hasEditAccess = isMaster || isAdmin || currentUser?.departmentPermissions?.[dept.id] === 'edit';
                const hasViewAccess = currentUser?.departmentPermissions?.[dept.id] === 'view';

                return (
                  <label
                    key={dept.id}
                    className={`flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer ${isSelected ? 'bg-white' : ''} ${isViewMode ? 'cursor-default opacity-80' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isViewMode || !hasEditAccess}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newIds = [...departmentIds, dept.id];
                          setDepartmentIds(newIds);
                          // Apply first selected department's default colors
                          if (newIds.length === 1) {
                            setSelectedColor(dept.defaultColor || '#fee2e2');
                            setSelectedTextColor(dept.defaultTextColor || '#ffffff');
                            setSelectedBorderColor(dept.defaultBorderColor || dept.defaultColor || '#fee2e2');
                          }
                        } else {
                          setDepartmentIds(departmentIds.filter(id => id !== dept.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 accent-[#081429]"
                    />
                    <span className={`text-sm ${isSelected ? 'font-bold text-[#081429]' : 'text-gray-600'}`}>
                      {dept.name}
                    </span>
                    {!hasEditAccess && hasViewAccess && (
                      <span className="text-[10px] text-gray-400 ml-auto">(조회전용)</span>
                    )}
                  </label>
                );
              })}
            </div>
            {departmentIds.length === 0 && (
              <p className="text-xs text-red-500 mt-1">최소 한 개의 부서를 선택해주세요.</p>
            )}
            {departmentIds.length > 1 && (
              <p className="text-xs text-blue-500 mt-1">선택된 부서: {departmentIds.length}개</p>
            )}
          </div>

          {/* Read Only Notice */}
          {!canEditCurrent && (
            <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 mb-2 flex items-center gap-2">
              <span className="text-lg">⚠️</span> 이 부서의 일정은 조회만 가능합니다.
            </div>
          )}

          {/* Recurrence Info for Existing Events */}
          {existingEvent?.recurrenceGroupId && existingEvent?.recurrenceIndex && (() => {
            const totalInGroup = allEvents.filter(e => e.recurrenceGroupId === existingEvent.recurrenceGroupId).length;
            const lastEvent = allEvents
              .filter(e => e.recurrenceGroupId === existingEvent.recurrenceGroupId)
              .sort((a, b) => (b.recurrenceIndex || 0) - (a.recurrenceIndex || 0))[0];
            const lastDate = lastEvent?.startDate || '';

            return (
              <div className="bg-blue-50 text-blue-700 text-xs font-bold p-3 rounded-xl border border-blue-200 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔄</span>
                  <span>
                    반복 일정 ({
                      existingEvent.recurrenceType === 'daily' ? '매일' :
                        existingEvent.recurrenceType === 'weekdays' ? '평일' :
                          existingEvent.recurrenceType === 'weekends' ? '주말' :
                            existingEvent.recurrenceType === 'weekly' ? '매주' :
                              existingEvent.recurrenceType === 'monthly' ? '매월' :
                                existingEvent.recurrenceType === 'yearly' ? '매년' : '알수없음'
                    }) - {existingEvent.recurrenceIndex}/{totalInGroup}번째
                  </span>
                </div>
                {lastDate && (
                  <span className="text-[10px] text-blue-500 ml-7">
                    마지막 반복: {lastDate}
                  </span>
                )}
              </div>
            );
          })()}

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
                    disabled={isViewMode || !canEditCurrent}
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
                  disabled={isViewMode || !canEditCurrent}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                />
                {!isAllDay && (
                  <input
                    type="time"
                    value={startTime}
                    disabled={isViewMode || !canEditCurrent}
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
                  disabled={isViewMode || !canEditCurrent}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                />
                {!isAllDay && (
                  <input
                    type="time"
                    value={endTime}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-36 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Recurrence Options (New Events Only) */}
          {!existingEvent && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2 flex items-center gap-1">
                🔄 반복 설정
              </label>
              <div className="flex gap-3 flex-wrap">
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as any)}
                  className="flex-1 min-w-[140px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold bg-white"
                >
                  <option value="none">반복 없음</option>
                  <option value="daily">매일</option>
                  <option value="weekdays">평일 (월-금)</option>
                  <option value="weekends">주말 (토-일)</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매월</option>
                  <option value="yearly">매년</option>
                </select>
                {recurrenceType !== 'none' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">반복 횟수:</span>
                    <select
                      value={recurrenceCount}
                      onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold bg-white"
                    >
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}회</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {recurrenceType !== 'none' && (
                <p className="text-xs text-gray-500 mt-2">
                  총 {recurrenceCount}개의 일정이 생성됩니다.
                </p>
              )}
            </div>
          )}

          {/* Participants - Multi Select Checkbox List */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2 flex items-center gap-1">
              <Users size={14} className="text-[#fdb813]" /> 참가자
            </label>
            <div className="border border-gray-300 rounded-xl p-3 max-h-40 overflow-y-auto bg-gray-50/50">
              {/* Current User (Always first), then Selected, then Unselected */}
              {users
                .filter(u => u.status === 'approved')
                .sort((a, b) => {
                  // Helper: Get display name for selection check
                  const getDisplayName = (user: typeof a) => {
                    const name = user.displayName || user.email.split('@')[0];
                    return user.jobTitle ? `${name} (${user.jobTitle})` : name;
                  };

                  const aSelected = participants.includes(getDisplayName(a));
                  const bSelected = participants.includes(getDisplayName(b));

                  // 1. Current User comes first
                  if (currentUser && a.uid === currentUser.uid) return -1;
                  if (currentUser && b.uid === currentUser.uid) return 1;

                  // 2. Selected participants come before unselected
                  if (aSelected && !bSelected) return -1;
                  if (!aSelected && bSelected) return 1;

                  // 3. Within same group, alphabetical order
                  const nameA = `${a.email.split('@')[0]} ${a.jobTitle || ''}`;
                  const nameB = `${b.email.split('@')[0]} ${b.jobTitle || ''}`;
                  return nameA.localeCompare(nameB);
                })
                .map(u => {
                  const name = u.displayName || u.email.split('@')[0];
                  const displayName = u.jobTitle ? `${name} (${u.jobTitle})` : name;
                  const isSelected = participants.includes(displayName);
                  const currentStatus = attendance[u.uid] || 'pending';

                  // Permission Check
                  const canEditStatus = currentUser?.uid === u.uid || isMaster || isAdmin;

                  const cycleStatus = () => {
                    const next: Record<string, 'pending' | 'joined' | 'declined'> = {
                      'pending': 'joined',
                      'joined': 'declined',
                      'declined': 'pending'
                    };
                    const newStatus = next[currentStatus];

                    // Check if this is a recurring event and offer batch update
                    if (existingEvent?.recurrenceGroupId && onBatchUpdateAttendance) {
                      const applyToAll = window.confirm(
                        `참가 상태를 "${newStatus === 'joined' ? '참석' : newStatus === 'declined' ? '불참' : '미정'}"(으)로 변경합니다.\n\n모든 반복 일정에도 적용하시겠습니까?`
                      );

                      if (applyToAll) {
                        onBatchUpdateAttendance(existingEvent.recurrenceGroupId, u.uid, newStatus);
                      }
                    }

                    // Always update current event's local state
                    setAttendance(prev => ({
                      ...prev,
                      [u.uid]: newStatus
                    }));
                  };

                  return (
                    <div key={u.uid} className="flex items-center justify-between p-2 hover:bg-white rounded-lg transition-colors group">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isViewMode || !canEditCurrent}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setParticipants([...participants, displayName]);
                              setAttendance(prev => ({ ...prev, [u.uid]: 'pending' })); // Default to pending
                            } else {
                              setParticipants(participants.filter(p => p !== displayName));
                              const newAtt = { ...attendance };
                              delete newAtt[u.uid];
                              setAttendance(newAtt);
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 accent-[#081429]"
                        />
                        <span className={`text-sm ${isSelected ? 'font-bold text-[#081429]' : 'text-gray-600'}`}>{displayName}</span>
                      </label>

                      {/* Attendance Status Toggle */}
                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (canEditStatus) cycleStatus();
                          }}
                          disabled={!canEditStatus}
                          className={`
                                text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border flex items-center gap-1 transition-all
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
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlignLeft size={14} className="text-[#fdb813]" /> 상세 내용
            </label>
            <textarea
              value={description}
              disabled={isViewMode || !canEditCurrent}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none min-h-[100px] resize-y font-medium text-sm ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              placeholder="일정의 자세한 내용을 입력하세요"
            />
          </div>

          {/* Reference URL */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <LinkIcon size={14} className="text-[#fdb813]" /> 참조 (Link)
            </label>
            {isViewMode && referenceUrl ? (
              <a
                href={referenceUrl.startsWith('http') ? referenceUrl : `https://${referenceUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium text-sm flex items-center gap-2 truncate"
              >
                <LinkIcon size={14} />
                {referenceUrl}
              </a>
            ) : (
              <input
                type="text"
                value={referenceUrl}
                disabled={isViewMode || !canEditCurrent}
                onChange={(e) => setReferenceUrl(e.target.value)}
                className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none transition-all font-medium text-sm ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                placeholder="외부 링크를 입력하세요 (예: Notion, 구글 시트 URL)"
              />
            )}
          </div>

          {/* Color Pickers */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2">
              색상 스타일
            </label>
            <div className="flex gap-6 items-center">
              {/* Background Color */}
              <div className="flex flex-col items-center gap-1">
                <div className={`relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm transition-transform ${isViewMode || !canEditCurrent ? 'opacity-80 cursor-default' : 'hover:scale-105 active:scale-95 cursor-pointer'}`}>
                  <input
                    type="color"
                    value={selectedColor}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] cursor-pointer p-0 border-0 disabled:cursor-not-allowed"
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-500">배경색</span>
              </div>

              {/* Text Color */}
              <div className="flex flex-col items-center gap-1">
                <div className={`relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm transition-transform ${isViewMode || !canEditCurrent ? 'opacity-80 cursor-default' : 'hover:scale-105 active:scale-95 cursor-pointer'}`}>
                  <input
                    type="color"
                    value={selectedTextColor}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setSelectedTextColor(e.target.value)}
                    className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] cursor-pointer p-0 border-0 disabled:cursor-not-allowed"
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-500">글자색</span>
              </div>

              {/* Border Color */}
              <div className="flex flex-col items-center gap-1">
                <div className={`relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm transition-transform ${isViewMode || !canEditCurrent ? 'opacity-80 cursor-default' : 'hover:scale-105 active:scale-95 cursor-pointer'}`}>
                  <input
                    type="color"
                    value={selectedBorderColor}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setSelectedBorderColor(e.target.value)}
                    className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] cursor-pointer p-0 border-0 disabled:cursor-not-allowed"
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-500">테두리색</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          {/* <div className="border-t border-gray-100 my-2"></div> */}

          {/* Edit Mode: Author Display logic needs to be here too if existing event */}
          {
            existingEvent && (
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

                {/* Timestamps Display */}
                <div className="mt-2 flex flex-col gap-0.5 text-[10px] text-gray-400 font-medium px-1">
                  {existingEvent.createdAt && (
                    <span>생성: {format(new Date(existingEvent.createdAt), 'yyyy-MM-dd HH:mm')}</span>
                  )}
                  {existingEvent.updatedAt && (
                    <span>수정: {format(new Date(existingEvent.updatedAt), 'yyyy-MM-dd HH:mm')}</span>
                  )}
                </div>
              </div>
            )
          }

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-100">
            {canDeleteEvent ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('정말 삭제하시겠습니까?')) {
                    onDelete(existingEvent.id, existingEvent);
                    onClose();
                  }
                }}
                className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1 text-sm px-4 py-2 rounded-xl hover:bg-red-50 transition-all"
              >
                <Trash2 size={18} /> 삭제
              </button>
            ) : canEditCurrent && existingEvent ? (
              // Should not happen as handled below, but strictly logic wise
              <div />
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
              {/* Left Side: Close or Cancel */}
              <button
                type="button"
                onClick={() => {
                  if (existingEvent && !isViewMode) {
                    // Revert to View Mode and reset forms logic handled by re-entering View Mode?
                    // Actually, easiest is to just toggle mode back to true.
                    // But we also need to reset data.
                    // Implementation: Just close for now or reload?
                    // Better: If we toggle view mode, we should ideally reset state.
                    // For simplicity as per plan: Close if new, Revert if existing.
                    setIsViewMode(true);
                    // Trigger a reload of data from existingEvent to reset changes?
                    // We can reuse the logic in useEffect by toggling loadedEventId? No.
                    const reset = () => {
                      setTitle(existingEvent.title);
                      setDescription(existingEvent.description || '');
                      setReferenceUrl(existingEvent.referenceUrl || '');
                      setStartDate(existingEvent.startDate);
                      setEndDate(existingEvent.endDate);
                      setStartTime(existingEvent.startTime || '');
                      setEndTime(existingEvent.endTime || '');
                      const rawParticipants = existingEvent.participants;
                      // ... (We might need to duplicate reset logic or extract it)
                      // For now, let's just use setLoadedEventId(null) to force useEffect re-run?
                      // No, that works on open.
                      // Let's manually reset the key fields visible.
                    };
                    reset();
                  } else {
                    onClose();
                  }
                }}
                className="px-6 py-2.5 text-[#373d41] hover:bg-gray-100 rounded-xl text-sm font-bold transition-all"
              >
                {/* Logic: Existing + EditMode = '취소', Else (ViewMode or New) = '닫기' */}
                {(existingEvent && !isViewMode) ? '취소' : '닫기'}
              </button>

              {/* Copy Button (View Mode Only) */}
              {isViewMode && existingEvent && onCopy && (
                <button
                  type="button"
                  onClick={() => onCopy(existingEvent)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-bold transition-all flex items-center gap-2"
                  title="일정 복사"
                >
                  <Copy size={16} />
                  <span className="hidden sm:inline">복사</span>
                </button>
              )}

              {/* Edit Button (View Mode Only) */}
              {isViewMode && canEditCurrent && existingEvent && (
                <button
                  type="button"
                  onClick={() => setIsViewMode(false)}
                  className="px-8 py-2.5 bg-[#fdb813] text-[#081429] rounded-xl hover:brightness-110 text-sm font-extrabold shadow-lg transition-all"
                >
                  수정
                </button>
              )}

              {/* Save Button (Edit Mode Only) */}
              {!isViewMode && canEditCurrent && (
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-[#fdb813] text-[#081429] rounded-xl hover:brightness-110 text-sm font-extrabold shadow-lg transition-all"
                >
                  저장
                </button>
              )}
            </div>
          </div>
        </form >
      </div >
    </div >
  );
};

export default EventModal;
