import React, { useState, useEffect, useMemo } from 'react';
import { CalendarEvent, Department, UserProfile, DEFAULT_EVENT_TAGS, SeminarEventData, SeminarAttendee } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { EVENT_COLORS } from '../../constants';
import {
  X, Trash2, Clock, Users, AlignLeft, Type, Edit3, Plus, Link as LinkIcon, Eye, Copy,
  ChevronDown, ChevronUp, Hash, Mic, MapPin, FileText, Calendar, UserCheck, Mail, Tag, Palette
} from 'lucide-react';
import { format } from 'date-fns';

interface SeminarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (id: string, event?: CalendarEvent) => void;
  initialDate?: string;
  initialEndDate?: string;
  initialDepartmentId?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialDepartmentIds?: string[];
  existingEvent?: CalendarEvent | null;
  departments: Department[];
  users: UserProfile[];
  currentUser: UserProfile | null;
  readOnly?: boolean;
  onCopy?: (event: CalendarEvent) => void;
}

const SeminarEventModal: React.FC<SeminarEventModalProps> = ({
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
  existingEvent,
  departments,
  users,
  currentUser,
  readOnly,
  onCopy,
}) => {
  // Basic Event Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#8B5CF6'); // Purple for seminars
  const [selectedTextColor, setSelectedTextColor] = useState('#ffffff');
  const [selectedBorderColor, setSelectedBorderColor] = useState('#8B5CF6');
  const [authorId, setAuthorId] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['seminar']);

  // Seminar-specific Fields
  const [speaker, setSpeaker] = useState('');
  const [speakerBio, setSpeakerBio] = useState('');
  const [manager, setManager] = useState('');
  const [managerContact, setManagerContact] = useState('');
  const [maxAttendees, setMaxAttendees] = useState<number | undefined>(undefined);
  const [venue, setVenue] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [materialInput, setMaterialInput] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [attendees, setAttendees] = useState<SeminarAttendee[]>([]);

  // UI State
  const [isViewMode, setIsViewMode] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'details' | 'attendees'>('basic');

  // Permission Logic
  const { hasPermission } = usePermissions(currentUser || null);
  const canCreate = hasPermission('events.create');
  const isAuthor = existingEvent?.authorId === currentUser?.uid;
  const canEdit = hasPermission(isAuthor ? 'events.manage_own' : 'events.manage_others');
  const canDelete = hasPermission(isAuthor ? 'events.manage_own' : 'events.manage_others');

  const isMaster = currentUser?.role === 'master';
  const isAdmin = currentUser?.role === 'admin';
  const hasDeptAccess = isMaster || isAdmin || departmentIds.some(dId => currentUser?.departmentPermissions?.[dId] === 'edit');

  const canSaveEvent = hasDeptAccess && (!existingEvent ? canCreate : canEdit);
  const canDeleteEvent = existingEvent && hasDeptAccess && canDelete;
  const canEditCurrent = canSaveEvent;

  useEffect(() => {
    if (isOpen) {
      const currentTargetId = existingEvent ? existingEvent.id : 'new';

      if (loadedEventId !== currentTargetId) {
        setLoadedEventId(currentTargetId);

        if (existingEvent) {
          setIsViewMode(true);
          setTitle(existingEvent.title);
          setDescription(existingEvent.description || '');
          setReferenceUrl(existingEvent.referenceUrl || '');
          setDepartmentIds(existingEvent.departmentIds || [existingEvent.departmentId]);
          setAuthorId(existingEvent.authorId || '');
          setAuthorName(existingEvent.authorName || '');
          setStartDate(existingEvent.startDate);
          setEndDate(existingEvent.endDate);
          setStartTime(existingEvent.startTime || '');
          setEndTime(existingEvent.endTime || '');
          setIsAllDay(existingEvent.isAllDay || (!existingEvent.startTime && !existingEvent.endTime));
          setSelectedColor(existingEvent.color || '#8B5CF6');
          setSelectedTextColor(existingEvent.textColor || '#ffffff');
          setSelectedBorderColor(existingEvent.borderColor || existingEvent.color || '#8B5CF6');
          setSelectedTags(existingEvent.tags || ['seminar']);

          // Load seminar data
          const seminar = existingEvent.seminarData;
          if (seminar) {
            setSpeaker(seminar.speaker || '');
            setSpeakerBio(seminar.speakerBio || '');
            setManager(seminar.manager || '');
            setManagerContact(seminar.managerContact || '');
            setMaxAttendees(seminar.maxAttendees);
            setVenue(seminar.venue || '');
            setMaterials(seminar.materials || []);
            setRegistrationDeadline(seminar.registrationDeadline || '');
            setIsPublic(seminar.isPublic || false);
            setAttendees(seminar.attendees || []);
          }
        } else {
          // New seminar event
          setIsViewMode(false);
          setTitle('');
          setDescription('');
          setReferenceUrl('');

          if (initialDepartmentIds && initialDepartmentIds.length > 0) {
            setDepartmentIds(initialDepartmentIds);
          } else {
            const targetDeptId = initialDepartmentId || departments[0]?.id || '';
            setDepartmentIds(targetDeptId ? [targetDeptId] : []);
          }

          if (currentUser) {
            const myName = `${currentUser.email.split('@')[0]} ${currentUser.jobTitle ? `(${currentUser.jobTitle})` : ''}`;
            setAuthorId(currentUser.uid);
            setAuthorName(myName);
            setManager(myName); // Auto-fill manager
          }

          setStartDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
          setEndDate(initialEndDate || initialDate || format(new Date(), 'yyyy-MM-dd'));

          const now = new Date();
          setStartTime(initialStartTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
          setEndTime(initialEndTime || `${String((now.getHours() + 2) % 24).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
          setIsAllDay(false);

          // Default seminar colors (purple theme)
          setSelectedColor('#8B5CF6');
          setSelectedTextColor('#ffffff');
          setSelectedBorderColor('#8B5CF6');
          setSelectedTags(['seminar']);

          // Reset seminar fields
          setSpeaker('');
          setSpeakerBio('');
          setManagerContact('');
          setMaxAttendees(undefined);
          setVenue('');
          setMaterials([]);
          setRegistrationDeadline('');
          setIsPublic(false);
          setAttendees([]);
        }
      }
    } else {
      setLoadedEventId(null);
    }
  }, [isOpen, existingEvent, initialDate, initialEndDate, initialDepartmentId, initialStartTime, initialEndTime, departments, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let newId = existingEvent?.id;
    if (!newId) {
      const safeTitle = title.trim().replace(/[^a-zA-Z0-9\uac00-\ud7a3]/g, '').substring(0, 10);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const primaryDeptId = departmentIds[0] || '';
      const deptObj = departments.find(d => d.id === primaryDeptId);
      const safeDeptName = deptObj ? deptObj.name : (primaryDeptId || 'no_dept');
      newId = `${startDate}_${safeDeptName}_${safeTitle}_${randomSuffix}`;
    }

    const now = new Date().toISOString();
    const primaryDeptId = departmentIds[0] || '';

    const seminarData: SeminarEventData = {
      speaker,
      speakerBio,
      manager,
      managerContact,
      maxAttendees,
      venue,
      materials: materials.length > 0 ? materials : undefined,
      registrationDeadline: registrationDeadline || undefined,
      isPublic,
      attendees: attendees.length > 0 ? attendees : undefined,
    };

    const payload: CalendarEvent = {
      id: newId,
      title,
      description,
      departmentId: primaryDeptId,
      departmentIds,
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
      referenceUrl: referenceUrl.trim(),
      tags: selectedTags,
      eventType: 'seminar',
      seminarData,
      relatedGroupId: existingEvent?.relatedGroupId,
    };

    onSave(payload);

    if (existingEvent) {
      setIsViewMode(true);
    } else {
      onClose();
    }
  };

  const handleAddMaterial = () => {
    if (materialInput.trim()) {
      setMaterials([...materials, materialInput.trim()]);
      setMaterialInput('');
    }
  };

  const confirmedCount = attendees.filter(a => a.status === 'confirmed' || a.status === 'attended').length;

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', transform: 'translateZ(0)', transition: 'none', zIndex: 9998 }} onClick={onClose}>
      <div className="bg-white rounded-sm shadow-xl max-w-3xl p-0 relative max-h-[85vh] flex flex-col overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Mic size={18} className="text-purple-500" />
            {isViewMode ? '세미나 상세' : (existingEvent ? '세미나 수정' : '새 세미나 추가')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {[
            { id: 'basic', label: '기본 정보', icon: Type },
            { id: 'details', label: '세미나 상세', icon: Mic },
            { id: 'attendees', label: `참석자 (${confirmedCount}/${maxAttendees || '-'})`, icon: Users },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === tab.id
                  ? 'text-purple-700 border-b-2 border-purple-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3 overflow-y-auto flex-1">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <>
              {/* Section 1: 기본 정보 (제목, 일시, 내용) */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Calendar className="w-3 h-3 text-purple-600" />
                  <h3 className="text-primary font-bold text-xs">기본 정보</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {/* Title Row */}
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span className="w-12 shrink-0 text-xs font-medium text-primary-700">제목 <span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      required
                      value={title}
                      disabled={isViewMode || !canEditCurrent}
                      onChange={(e) => setTitle(e.target.value)}
                      className={`flex-1 px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                      placeholder="세미나 제목을 입력하세요"
                    />
                  </div>

                  {/* Date & Time Row */}
                  <div className="px-2 py-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs font-medium text-primary-700">일시 <span className="text-red-500">*</span></span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAllDay}
                          disabled={isViewMode || !canEditCurrent}
                          onChange={(e) => setIsAllDay(e.target.checked)}
                          className="w-3 h-3 rounded text-purple-600 focus:ring-purple-500 border-gray-300"
                        />
                        <span className="text-xxs text-gray-500">하루종일</span>
                      </label>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 items-center">
                      <div className="flex gap-2 w-full md:w-auto items-center">
                        <input
                          type="date"
                          required
                          value={startDate}
                          disabled={isViewMode || !canEditCurrent}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            if (e.target.value > endDate) setEndDate(e.target.value);
                          }}
                          className={`w-32 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none text-xs ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                        <input
                          type="time"
                          value={startTime}
                          disabled={isViewMode || !canEditCurrent || isAllDay}
                          onChange={(e) => setStartTime(e.target.value)}
                          className={`w-24 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none text-xs ${(!canEditCurrent || isAllDay) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <span className="text-gray-400 text-xs">~</span>
                      <div className="flex gap-2 w-full md:w-auto items-center">
                        <input
                          type="date"
                          required
                          value={endDate}
                          disabled={isViewMode || !canEditCurrent}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate}
                          className={`w-32 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none text-xs ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                        <input
                          type="time"
                          value={endTime}
                          disabled={isViewMode || !canEditCurrent || isAllDay}
                          onChange={(e) => setEndTime(e.target.value)}
                          className={`w-24 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none text-xs ${(!canEditCurrent || isAllDay) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description Row */}
                  <div className="px-2 py-1.5">
                    <span className="text-xs font-medium text-primary-700 block mb-1 flex items-center gap-1">
                      <AlignLeft className="w-3 h-3 text-gray-400" />
                      세미나 소개
                    </span>
                    <textarea
                      value={description}
                      disabled={isViewMode || !canEditCurrent}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`w-full px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none min-h-[80px] resize-y text-xs ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                      placeholder="세미나 내용을 소개해주세요"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: 부서 및 태그 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Tag className="w-3 h-3 text-purple-600" />
                  <h3 className="text-primary font-bold text-xs">부서 및 태그</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {/* Department Row */}
                  <div className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs font-medium text-primary-700">부서 <span className="text-red-500">*</span></span>
                      <div className="flex-1 relative">
                        <button
                          type="button"
                          onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                          className="w-full text-left px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-purple-500 bg-white flex justify-between items-center outline-none"
                        >
                          <span className={`text-xs ${departmentIds.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                            {departmentIds.length === 0
                              ? '부서를 선택하세요'
                              : `${departments.find(d => d.id === departmentIds[0])?.name || departmentIds[0]} ${departmentIds.length > 1 ? `외 ${departmentIds.length - 1}개` : ''}`}
                          </span>
                          {isDeptDropdownOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                        </button>
                        {isDeptDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-white border border-gray-200 shadow-xl z-50 max-h-40 overflow-y-auto">
                            {departments.map(dept => (
                              <label key={dept.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={departmentIds.includes(dept.id)}
                                  disabled={isViewMode}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setDepartmentIds([...departmentIds, dept.id]);
                                    } else {
                                      setDepartmentIds(departmentIds.filter(id => id !== dept.id));
                                    }
                                  }}
                                  className="w-3.5 h-3.5 rounded accent-purple-600"
                                />
                                <span className="text-xs">{dept.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Color Pickers Row */}
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span className="w-12 shrink-0 text-xs font-medium text-primary-700">색상</span>
                    <div className="flex gap-3 items-center">
                      <div className="flex flex-col gap-0.5 items-center">
                        <input
                          type="color"
                          value={selectedColor}
                          disabled={isViewMode || !canEditCurrent}
                          onChange={(e) => setSelectedColor(e.target.value)}
                          className={`w-6 h-6 cursor-pointer border border-gray-200 ${!canEditCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="배경색 선택"
                        />
                        <span className="text-xxs text-gray-400">배경</span>
                      </div>
                      <div className="flex flex-col gap-0.5 items-center">
                        <input
                          type="color"
                          value={selectedTextColor}
                          disabled={isViewMode || !canEditCurrent}
                          onChange={(e) => setSelectedTextColor(e.target.value)}
                          className={`w-6 h-6 cursor-pointer border border-gray-200 ${!canEditCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="글자색 선택"
                        />
                        <span className="text-xxs text-gray-400">글자</span>
                      </div>
                      <div className="flex flex-col gap-0.5 items-center">
                        <input
                          type="color"
                          value={selectedBorderColor}
                          disabled={isViewMode || !canEditCurrent}
                          onChange={(e) => setSelectedBorderColor(e.target.value)}
                          className={`w-6 h-6 cursor-pointer border border-gray-200 ${!canEditCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="테두리색 선택"
                        />
                        <span className="text-xxs text-gray-400">테두리</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <>
              {/* Section 1: 강연자 정보 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Mic className="w-3 h-3 text-purple-600" />
                  <h3 className="text-primary font-bold text-xs">강연자 정보</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {/* Speaker Name Row */}
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span className="w-16 shrink-0 text-xs font-medium text-primary-700">발표자</span>
                    <input
                      type="text"
                      value={speaker}
                      disabled={isViewMode || !canEditCurrent}
                      onChange={(e) => setSpeaker(e.target.value)}
                      className={`flex-1 px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                      placeholder="발표자 이름"
                    />
                  </div>

                  {/* Speaker Bio Row */}
                  <div className="px-2 py-1.5">
                    <span className="text-xs font-medium text-primary-700 block mb-1">발표자 소개</span>
                    <textarea
                      value={speakerBio}
                      disabled={isViewMode || !canEditCurrent}
                      onChange={(e) => setSpeakerBio(e.target.value)}
                      className={`w-full px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none min-h-[60px] resize-y text-xs ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                      placeholder="발표자 약력 및 소개"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: 운영 정보 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <UserCheck className="w-3 h-3 text-purple-600" />
                  <h3 className="text-primary font-bold text-xs">운영 정보</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {/* Manager & Contact Row */}
                  <div className="grid grid-cols-2 gap-2 px-2 py-1.5">
                    <div>
                      <span className="text-xs font-medium text-primary-700 block mb-1">담당자</span>
                      <input
                        type="text"
                        value={manager}
                        disabled={isViewMode || !canEditCurrent}
                        onChange={(e) => setManager(e.target.value)}
                        className={`w-full px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        placeholder="담당자 이름"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-primary-700 block mb-1 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-gray-400" />
                        연락처
                      </span>
                      <input
                        type="text"
                        value={managerContact}
                        disabled={isViewMode || !canEditCurrent}
                        onChange={(e) => setManagerContact(e.target.value)}
                        className={`w-full px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        placeholder="이메일 또는 전화번호"
                      />
                    </div>
                  </div>

                  {/* Venue & Max Attendees Row */}
                  <div className="grid grid-cols-2 gap-2 px-2 py-1.5">
                    <div>
                      <span className="text-xs font-medium text-primary-700 block mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        장소
                      </span>
                      <input
                        type="text"
                        value={venue}
                        disabled={isViewMode || !canEditCurrent}
                        onChange={(e) => setVenue(e.target.value)}
                        className={`w-full px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        placeholder="세미나 장소"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-primary-700 block mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3 text-gray-400" />
                        최대 인원
                      </span>
                      <input
                        type="number"
                        value={maxAttendees || ''}
                        disabled={isViewMode || !canEditCurrent}
                        onChange={(e) => setMaxAttendees(e.target.value ? parseInt(e.target.value) : undefined)}
                        className={`w-full px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        placeholder="제한 없음"
                        min={1}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: 자료 및 링크 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <FileText className="w-3 h-3 text-purple-600" />
                  <h3 className="text-primary font-bold text-xs">자료 및 링크</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {/* Materials Row */}
                  <div className="px-2 py-1.5">
                    <span className="text-xs font-medium text-primary-700 block mb-1">자료 링크</span>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={materialInput}
                        disabled={isViewMode || !canEditCurrent}
                        onChange={(e) => setMaterialInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMaterial();
                          }
                        }}
                        className={`flex-1 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none text-xs ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        placeholder="자료 URL 입력 후 Enter"
                      />
                      <button
                        type="button"
                        onClick={handleAddMaterial}
                        disabled={isViewMode || !canEditCurrent}
                        className="px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        추가
                      </button>
                    </div>
                    {materials.length > 0 && (
                      <div className="space-y-1">
                        {materials.map((mat, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-gray-50 px-2 py-1.5">
                            <LinkIcon size={12} className="text-gray-400" />
                            <a href={mat.startsWith('http') ? mat : `https://${mat}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-blue-600 hover:underline truncate">
                              {mat}
                            </a>
                            {!isViewMode && canEditCurrent && (
                              <button
                                type="button"
                                onClick={() => setMaterials(materials.filter((_, i) => i !== idx))}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Registration Deadline & Public Toggle Row */}
                  <div className="px-2 py-1.5">
                    <div className="mb-2">
                      <span className="text-xs font-medium text-primary-700 block mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        등록 마감일
                      </span>
                      <input
                        type="date"
                        value={registrationDeadline}
                        disabled={isViewMode || !canEditCurrent}
                        onChange={(e) => setRegistrationDeadline(e.target.value)}
                        className={`w-full px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-purple-500 outline-none ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                        max={startDate}
                      />
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-100">
                      <input
                        type="checkbox"
                        id="isPublic"
                        checked={isPublic}
                        disabled={isViewMode || !canEditCurrent}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <label htmlFor="isPublic" className="text-xs font-bold text-gray-700 cursor-pointer">
                          외부 공개 세미나
                        </label>
                        <p className="text-xxs text-gray-500">외부 참가자 등록 가능</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Attendees Tab */}
          {activeTab === 'attendees' && (
            <>
              {/* Section 1: 참가 신청 설정 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <UserCheck className="w-3 h-3 text-purple-600" />
                  <h3 className="text-primary font-bold text-xs">참가 신청 설정</h3>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-purple-50 p-3 text-center">
                      <div className="text-xl font-extrabold text-purple-700">{attendees.length}</div>
                      <div className="text-xxs text-gray-500 font-medium">등록</div>
                    </div>
                    <div className="bg-green-50 p-3 text-center">
                      <div className="text-xl font-extrabold text-green-700">{confirmedCount}</div>
                      <div className="text-xxs text-gray-500 font-medium">확정</div>
                    </div>
                    <div className="bg-gray-50 p-3 text-center">
                      <div className="text-xl font-extrabold text-gray-700">
                        {maxAttendees ? `${maxAttendees - confirmedCount}` : '-'}
                      </div>
                      <div className="text-xxs text-gray-500 font-medium">잔여</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: 참가자 목록 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Users className="w-3 h-3 text-purple-600" />
                  <h3 className="text-primary font-bold text-xs">참가자 목록</h3>
                </div>
                <div className="p-3">
                  {attendees.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Users size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-medium">등록된 참석자가 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attendees.map(attendee => (
                        <div key={attendee.id} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-100">
                          <div>
                            <div className="font-bold text-xs">{attendee.name}</div>
                            {attendee.organization && <div className="text-xxs text-gray-500">{attendee.organization}</div>}
                          </div>
                          <span className={`text-xxs px-2 py-0.5 font-bold ${
                            attendee.status === 'attended' ? 'bg-green-100 text-green-700' :
                            attendee.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                            attendee.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {attendee.status === 'attended' ? '참석완료' :
                             attendee.status === 'confirmed' ? '확정' :
                             attendee.status === 'cancelled' ? '취소' : '등록'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xxs text-gray-400 text-center mt-3">
                    참석자 등록 기능은 추후 업데이트 예정입니다
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            {canDeleteEvent ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('정말 삭제하시겠습니까?')) {
                    onDelete(existingEvent.id, existingEvent);
                    onClose();
                  }
                }}
                className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1 text-xs px-3 py-2 hover:bg-red-50"
              >
                <Trash2 size={14} /> 삭제
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (existingEvent && !isViewMode) {
                    setIsViewMode(true);
                  } else {
                    onClose();
                  }
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 text-xs font-bold"
              >
                {(existingEvent && !isViewMode) ? '취소' : '닫기'}
              </button>

              {isViewMode && existingEvent && onCopy && (
                <button
                  type="button"
                  onClick={() => onCopy(existingEvent)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-bold flex items-center gap-2"
                >
                  <Copy size={14} />
                </button>
              )}

              {isViewMode && canEditCurrent && existingEvent && (
                <button
                  type="button"
                  onClick={() => setIsViewMode(false)}
                  className="px-6 py-2 bg-purple-600 text-white hover:bg-purple-700 text-xs font-extrabold shadow-lg"
                >
                  수정
                </button>
              )}

              {!isViewMode && canEditCurrent && (
                <button
                  type="submit"
                  className="px-6 py-2 bg-purple-600 text-white hover:bg-purple-700 text-xs font-extrabold shadow-lg"
                >
                  저장
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SeminarEventModal;
