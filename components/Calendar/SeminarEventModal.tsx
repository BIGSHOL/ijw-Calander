import React, { useState, useEffect, useMemo } from 'react';
import { CalendarEvent, Department, UserProfile, DEFAULT_EVENT_TAGS, SeminarEventData, SeminarAttendee } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { EVENT_COLORS } from '../../constants';
import {
  X, Trash2, Clock, Users, AlignLeft, Type, Edit3, Plus, Link as LinkIcon, Eye, Copy,
  ChevronDown, ChevronUp, Hash, Mic, MapPin, FileText, Calendar, UserCheck, Mail
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-0 relative max-h-[90vh] overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-4 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mic size={20} className="text-purple-200" />
            {isViewMode ? '세미나 상세' : (existingEvent ? '세미나 수정' : '새 세미나 추가')}
          </h2>
          <button onClick={onClose} className="text-purple-200 hover:text-white transition-colors">
            <X size={24} />
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-160px)]">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <>
              {/* Title */}
              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Type size={14} className="text-purple-500" /> 세미나 제목
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  disabled={isViewMode || !canEditCurrent}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-medium"
                  placeholder="세미나 제목을 입력하세요"
                />
              </div>

              {/* Date & Time */}
              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Clock size={14} className="text-purple-500" /> 일시
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="seminarAllDay"
                      checked={isAllDay}
                      disabled={isViewMode || !canEditCurrent}
                      onChange={(e) => setIsAllDay(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="seminarAllDay" className="text-xs font-bold text-gray-500 cursor-pointer">
                      하루종일
                    </label>
                  </div>
                </label>
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
                      className="w-36 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-sm"
                    />
                    <input
                      type="time"
                      value={startTime}
                      disabled={isViewMode || !canEditCurrent || isAllDay}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={`w-36 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-sm ${isAllDay ? 'bg-gray-100' : ''}`}
                    />
                  </div>
                  <span className="text-gray-400 font-bold">~</span>
                  <div className="flex gap-2 w-full md:w-auto items-center">
                    <input
                      type="date"
                      required
                      value={endDate}
                      disabled={isViewMode || !canEditCurrent}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-36 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-sm"
                    />
                    <input
                      type="time"
                      value={endTime}
                      disabled={isViewMode || !canEditCurrent || isAllDay}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={`w-36 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-sm ${isAllDay ? 'bg-gray-100' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <AlignLeft size={14} className="text-purple-500" /> 세미나 소개
                </label>
                <textarea
                  value={description}
                  disabled={isViewMode || !canEditCurrent}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none min-h-[120px] resize-y font-medium text-sm"
                  placeholder="세미나 내용을 소개해주세요"
                />
              </div>

              {/* Department Selection */}
              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                  부서
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                    className="w-full text-left px-4 py-2.5 border border-gray-300 rounded-xl bg-white flex justify-between items-center"
                  >
                    <span className={departmentIds.length === 0 ? 'text-gray-400' : 'text-gray-800'}>
                      {departmentIds.length === 0
                        ? '부서를 선택하세요'
                        : `${departments.find(d => d.id === departmentIds[0])?.name || departmentIds[0]} ${departmentIds.length > 1 ? `외 ${departmentIds.length - 1}개` : ''}`}
                    </span>
                    {isDeptDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {isDeptDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                      {departments.map(dept => (
                        <label key={dept.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
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
                            className="w-4 h-4 rounded accent-purple-600"
                          />
                          <span className="text-sm">{dept.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Seminar Details Tab */}
          {activeTab === 'details' && (
            <>
              {/* Speaker */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Mic size={14} className="text-purple-500" /> 발표자 / 강연자
                  </label>
                  <input
                    type="text"
                    value={speaker}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setSpeaker(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                    placeholder="발표자 이름"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <UserCheck size={14} className="text-purple-500" /> 담당자
                  </label>
                  <input
                    type="text"
                    value={manager}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setManager(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                    placeholder="담당자 이름"
                  />
                </div>
              </div>

              {/* Speaker Bio */}
              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                  발표자 소개
                </label>
                <textarea
                  value={speakerBio}
                  disabled={isViewMode || !canEditCurrent}
                  onChange={(e) => setSpeakerBio(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none min-h-[80px] resize-y font-medium text-sm"
                  placeholder="발표자 약력 및 소개"
                />
              </div>

              {/* Manager Contact & Max Attendees */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Mail size={14} className="text-purple-500" /> 담당자 연락처
                  </label>
                  <input
                    type="text"
                    value={managerContact}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setManagerContact(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                    placeholder="이메일 또는 전화번호"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Users size={14} className="text-purple-500" /> 최대 참석 인원
                  </label>
                  <input
                    type="number"
                    value={maxAttendees || ''}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setMaxAttendees(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                    placeholder="제한 없음"
                    min={1}
                  />
                </div>
              </div>

              {/* Venue & Registration Deadline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <MapPin size={14} className="text-purple-500" /> 장소
                  </label>
                  <input
                    type="text"
                    value={venue}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                    placeholder="세미나 장소"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Calendar size={14} className="text-purple-500" /> 등록 마감일
                  </label>
                  <input
                    type="date"
                    value={registrationDeadline}
                    disabled={isViewMode || !canEditCurrent}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                    max={startDate}
                  />
                </div>
              </div>

              {/* Materials */}
              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <FileText size={14} className="text-purple-500" /> 자료 링크
                </label>
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    placeholder="자료 URL 입력 후 Enter"
                  />
                  <button
                    type="button"
                    onClick={handleAddMaterial}
                    disabled={isViewMode || !canEditCurrent}
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 font-bold text-sm"
                  >
                    추가
                  </button>
                </div>
                {materials.length > 0 && (
                  <div className="space-y-1">
                    {materials.map((mat, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                        <LinkIcon size={14} className="text-gray-400" />
                        <a href={mat.startsWith('http') ? mat : `https://${mat}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-blue-600 hover:underline truncate">
                          {mat}
                        </a>
                        {!isViewMode && canEditCurrent && (
                          <button
                            type="button"
                            onClick={() => setMaterials(materials.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Public Toggle */}
              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  disabled={isViewMode || !canEditCurrent}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <label htmlFor="isPublic" className="text-sm font-bold text-gray-700 cursor-pointer">
                    외부 공개 세미나
                  </label>
                  <p className="text-xs text-gray-500">체크하면 외부 참가자 등록이 가능합니다</p>
                </div>
              </div>
            </>
          )}

          {/* Attendees Tab */}
          {activeTab === 'attendees' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-purple-50 p-4 rounded-xl text-center">
                  <div className="text-2xl font-extrabold text-purple-700">{attendees.length}</div>
                  <div className="text-xs text-gray-500 font-medium">등록</div>
                </div>
                <div className="bg-green-50 p-4 rounded-xl text-center">
                  <div className="text-2xl font-extrabold text-green-700">{confirmedCount}</div>
                  <div className="text-xs text-gray-500 font-medium">확정</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl text-center">
                  <div className="text-2xl font-extrabold text-gray-700">
                    {maxAttendees ? `${maxAttendees - confirmedCount}` : '-'}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">잔여</div>
                </div>
              </div>

              {/* Attendee List */}
              {attendees.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="font-medium">등록된 참석자가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attendees.map(attendee => (
                    <div key={attendee.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <div className="font-bold text-sm">{attendee.name}</div>
                        {attendee.organization && <div className="text-xs text-gray-500">{attendee.organization}</div>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
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

              <p className="text-xs text-gray-400 text-center">
                참석자 등록 기능은 추후 업데이트 예정입니다
              </p>
            </div>
          )}

          {/* Footer */}
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
                className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1 text-sm px-4 py-2 rounded-xl hover:bg-red-50"
              >
                <Trash2 size={18} /> 삭제
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (existingEvent && !isViewMode) {
                    setIsViewMode(true);
                  } else {
                    onClose();
                  }
                }}
                className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-bold"
              >
                {(existingEvent && !isViewMode) ? '취소' : '닫기'}
              </button>

              {isViewMode && existingEvent && onCopy && (
                <button
                  type="button"
                  onClick={() => onCopy(existingEvent)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-bold flex items-center gap-2"
                >
                  <Copy size={16} />
                </button>
              )}

              {isViewMode && canEditCurrent && existingEvent && (
                <button
                  type="button"
                  onClick={() => setIsViewMode(false)}
                  className="px-8 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 text-sm font-extrabold shadow-lg"
                >
                  수정
                </button>
              )}

              {!isViewMode && canEditCurrent && (
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 text-sm font-extrabold shadow-lg"
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
