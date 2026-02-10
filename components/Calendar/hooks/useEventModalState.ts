import { useState, useEffect } from 'react';
import { CalendarEvent, Department, UserProfile, EventTag, DEFAULT_EVENT_TAGS, SeminarEventData } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';
import { useStudents } from '../../../hooks/useStudents';
import { EVENT_COLORS } from '../../../constants';
import { format } from 'date-fns';
import { db } from '../../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { listenerRegistry } from '../../../utils/firebaseCleanup';

interface UseEventModalStateProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  initialDate?: string;
  initialEndDate?: string;
  initialDepartmentId?: string;
  initialDepartmentIds?: string[];
  initialStartTime?: string;
  initialEndTime?: string;
  initialTitle?: string;
  existingEvent?: CalendarEvent | null;
  departments: Department[];
  users: UserProfile[];
  currentUser: UserProfile | null;
  templateEvent?: CalendarEvent | null;
}

export interface UseEventModalStateReturn {
  // State values
  title: string;
  description: string;
  participants: string[];
  departmentIds: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  selectedColor: string;
  selectedTextColor: string;
  selectedBorderColor: string;
  authorId: string;
  authorName: string;
  referenceUrl: string;
  isViewMode: boolean;
  attendance: Record<string, 'pending' | 'joined' | 'declined'>;
  recurrenceType: 'none' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly';
  recurrenceCount: number;
  isDeptDropdownOpen: boolean;
  isParticipantsDropdownOpen: boolean;
  selectedTags: string[];
  availableTags: EventTag[];
  seminarTags: string[];
  isPanelOpen: boolean;
  seminarData: SeminarEventData;

  // Setters
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  setParticipants: React.Dispatch<React.SetStateAction<string[]>>;
  setDepartmentIds: React.Dispatch<React.SetStateAction<string[]>>;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
  setStartTime: React.Dispatch<React.SetStateAction<string>>;
  setEndTime: React.Dispatch<React.SetStateAction<string>>;
  setIsAllDay: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedColor: React.Dispatch<React.SetStateAction<string>>;
  setSelectedTextColor: React.Dispatch<React.SetStateAction<string>>;
  setSelectedBorderColor: React.Dispatch<React.SetStateAction<string>>;
  setAuthorId: React.Dispatch<React.SetStateAction<string>>;
  setAuthorName: React.Dispatch<React.SetStateAction<string>>;
  setReferenceUrl: React.Dispatch<React.SetStateAction<string>>;
  setIsViewMode: React.Dispatch<React.SetStateAction<boolean>>;
  setAttendance: React.Dispatch<React.SetStateAction<Record<string, 'pending' | 'joined' | 'declined'>>>;
  setRecurrenceType: React.Dispatch<React.SetStateAction<'none' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly'>>;
  setRecurrenceCount: React.Dispatch<React.SetStateAction<number>>;
  setIsDeptDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsParticipantsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSeminarData: React.Dispatch<React.SetStateAction<SeminarEventData>>;

  // Computed
  students: any;
  canEditCurrent: boolean;
  canDeleteEvent: boolean | undefined;
  canManageAttendance: boolean;
  canManageAllDepts: boolean;

  // Handlers
  handleSubmit: (e: React.FormEvent) => void;
}

export const useEventModalState = (props: UseEventModalStateProps): UseEventModalStateReturn => {
  const {
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
  } = props;

  // State declarations
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
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
  const [isViewMode, setIsViewMode] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, 'pending' | 'joined' | 'declined'>>({});
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [recurrenceCount, setRecurrenceCount] = useState(1);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isParticipantsDropdownOpen, setIsParticipantsDropdownOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<EventTag[]>(DEFAULT_EVENT_TAGS);
  const [seminarTags, setSeminarTags] = useState<string[]>(['seminar', 'workshop', 'meeting']);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [seminarData, setSeminarData] = useState<SeminarEventData>({});

  // Load Students
  const { students } = useStudents();

  // Permission Logic
  const { hasPermission } = usePermissions(currentUser || null);
  const canCreate = hasPermission('events.create');
  const isAuthor = existingEvent?.authorId === currentUser?.uid;
  const canEdit = hasPermission(isAuthor ? 'events.manage_own' : 'events.manage_others');
  const canDelete = hasPermission(isAuthor ? 'events.manage_own' : 'events.manage_others');
  const canManageAttendance = hasPermission('events.attendance');

  const canManageAllDepts = hasPermission('departments.manage');
  const hasDeptAccess = canManageAllDepts || departmentIds.some(dId => currentUser?.departmentPermissions?.[dId] === 'edit');

  const canSaveEvent = hasDeptAccess && (!existingEvent ? canCreate : canEdit);
  const canDeleteEvent = existingEvent && hasDeptAccess && canDelete;
  const canEditCurrent = canSaveEvent;

  // Track which event ID we last loaded to prevent unnecessary resets
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null);

  // Main initialization effect
  useEffect(() => {
    if (isOpen) {
      const currentTargetId = existingEvent ? existingEvent.id : 'new';

      if (loadedEventId !== currentTargetId) {
        setLoadedEventId(currentTargetId);

        if (existingEvent) {
          setIsViewMode(true);
          setTitle(existingEvent.title);
          setDescription(existingEvent.description || '');
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
          const isTimeEmpty = !existingEvent.startTime && !existingEvent.endTime;
          setIsAllDay(existingEvent.isAllDay || isTimeEmpty);

          const colorVal = existingEvent.color;
          const knownColor = EVENT_COLORS.find(c => c.value === colorVal);
          const initialBgColor = knownColor ? knownColor.value : (colorVal.startsWith('#') ? colorVal : '#fee2e2');
          setSelectedColor(initialBgColor);

          setSelectedTextColor(existingEvent.textColor || '#ffffff');
          setSelectedBorderColor(existingEvent.borderColor || initialBgColor);

          setRecurrenceType(existingEvent.recurrenceType || 'none');
          setRecurrenceCount(1);

          setSelectedTags(existingEvent.tags || []);
          setAttendance(existingEvent.attendance || {});
        } else if (templateEvent) {
          setIsViewMode(false);
          setTitle(templateEvent.title);
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
          if (currentUser) {
            const myName = `${currentUser.email.split('@')[0]} ${currentUser.jobTitle ? `(${currentUser.jobTitle})` : ''}`;
            setAuthorId(currentUser.uid);
            setAuthorName(myName);
          } else {
            setAuthorId('');
            setAuthorName('');
          }

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

          setRecurrenceType('none');
          setRecurrenceCount(1);

          setSelectedTags(templateEvent.tags || []);
          setAttendance(templateEvent.attendance || {});
        } else {
          setIsViewMode(false);
          setTitle(initialTitle || '');
          setDescription('');
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

          const now = new Date();
          const currentHour = now.getHours().toString().padStart(2, '0');
          const currentMin = now.getMinutes().toString().padStart(2, '0');
          const nextHour = ((now.getHours() + 1) % 24).toString().padStart(2, '0');
          setStartTime(initialStartTime || `${currentHour}:${currentMin}`);
          setEndTime(initialEndTime || `${nextHour}:${currentMin}`);
          setIsAllDay(false);

          setRecurrenceType('none');
          setRecurrenceCount(1);

          setSelectedTags([]);
          setAttendance({});

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
      setLoadedEventId(null);
    }
  }, [
    isOpen,
    existingEvent,
    templateEvent,
    currentUser,
    initialDate,
    initialEndDate,
    initialDepartmentId,
    initialDepartmentIds,
    initialStartTime,
    initialEndTime,
    initialTitle,
    departments,
    loadedEventId
  ]);

  // Load hashtag configuration from Firebase
  useEffect(() => {
    const docRef = doc(db, 'settings', 'hashtag_config');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setAvailableTags(data.tags || DEFAULT_EVENT_TAGS);
        setSeminarTags(data.seminarTags || ['seminar', 'workshop', 'meeting']);
      }
    });
    return listenerRegistry.register('EventModal', unsubscribe);
  }, []);

  // Auto-open panel when seminar tags are selected
  useEffect(() => {
    const showPanel = selectedTags.some(tagId => seminarTags.includes(tagId));
    setIsPanelOpen(showPanel);
  }, [selectedTags, seminarTags]);

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let newId = existingEvent?.id;
    if (!newId) {
      const safeTitle = title.trim().replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 10);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const primaryDeptId = departmentIds[0] || '';
      const deptObj = departments.find(d => d.id === primaryDeptId);
      const safeDeptName = deptObj ? deptObj.name : (primaryDeptId || 'no_dept');

      newId = `${startDate}_${safeDeptName}_${safeTitle}_${randomSuffix}`;
    }

    const now = new Date().toISOString();
    const primaryDeptId = departmentIds[0] || '';
    const payload: CalendarEvent = {
      id: newId,
      title,
      description,
      participants: participants.join(', '),
      departmentId: primaryDeptId,
      departmentIds: departmentIds,
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
      recurrenceType: recurrenceType !== 'none' ? recurrenceType : undefined,
      relatedGroupId: existingEvent?.relatedGroupId,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    };

    (payload as any)._recurrenceCount = recurrenceType !== 'none' ? recurrenceCount : undefined;

    onSave(payload);

    if (existingEvent) {
      setIsViewMode(true);
    } else {
      onClose();
    }
  };

  return {
    title,
    description,
    participants,
    departmentIds,
    startDate,
    endDate,
    startTime,
    endTime,
    isAllDay,
    selectedColor,
    selectedTextColor,
    selectedBorderColor,
    authorId,
    authorName,
    referenceUrl,
    isViewMode,
    attendance,
    recurrenceType,
    recurrenceCount,
    isDeptDropdownOpen,
    isParticipantsDropdownOpen,
    selectedTags,
    availableTags,
    seminarTags,
    isPanelOpen,
    seminarData,
    setTitle,
    setDescription,
    setParticipants,
    setDepartmentIds,
    setStartDate,
    setEndDate,
    setStartTime,
    setEndTime,
    setIsAllDay,
    setSelectedColor,
    setSelectedTextColor,
    setSelectedBorderColor,
    setAuthorId,
    setAuthorName,
    setReferenceUrl,
    setIsViewMode,
    setAttendance,
    setRecurrenceType,
    setRecurrenceCount,
    setIsDeptDropdownOpen,
    setIsParticipantsDropdownOpen,
    setSelectedTags,
    setIsPanelOpen,
    setSeminarData,
    students,
    canEditCurrent,
    canDeleteEvent,
    canManageAttendance,
    canManageAllDepts,
    handleSubmit,
  };
};
