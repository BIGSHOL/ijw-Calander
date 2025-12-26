import React, { useState, useEffect, useRef } from 'react';
import { addYears, subYears, format, isToday, isPast, isFuture, parseISO, startOfDay, addDays, addWeeks, addMonths, getDay, differenceInDays } from 'date-fns';
import { CalendarEvent, Department, UserProfile, Holiday } from './types';
import { INITIAL_DEPARTMENTS } from './constants';
import { usePermissions } from './hooks/usePermissions';
import EventModal from './components/EventModal';
import SettingsModal from './components/SettingsModal';
import LoginModal from './components/LoginModal';
import CalendarBoard from './components/CalendarBoard';
import TimetableManager from './components/Timetable/TimetableManager';
import { Settings, Printer, Plus, Eye, EyeOff, LayoutGrid, Calendar as CalendarIcon, List, CheckCircle2, XCircle, LogOut, LogIn, UserCircle, Lock as LockIcon, Filter, ChevronDown, ChevronUp, User as UserIcon, Star } from 'lucide-react';
import { db, auth } from './firebaseConfig';
import { collection, onSnapshot, setDoc, doc, deleteDoc, writeBatch, query, orderBy, where, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

type ViewMode = 'daily' | 'weekly' | 'monthly';

// Firestore Converters for Korean Localization
const departmentConverter = {
  toFirestore: (dept: Department) => {
    return {
      부서명: dept.name,
      순서: dept.order,
      색상: dept.color,
      기본색상: dept.defaultColor || '#fee2e2',
      기본글자색: dept.defaultTextColor || '#000000',
      기본테두리색: dept.defaultBorderColor || '#fee2e2',
      카테고리: dept.category || '' // Add Category
    };
  },
  fromFirestore: (snapshot: any, options: any) => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      name: data.부서명,
      order: data.순서,
      color: data.색상,
      defaultColor: data.기본색상 || '#fee2e2',
      defaultTextColor: data.기본글자색 || '#000000',
      defaultBorderColor: data.기본테두리색 || '#fee2e2',
      category: data.카테고리 || undefined // Load Category
    } as Department;
  }
};

const eventConverter = {
  toFirestore: (event: CalendarEvent) => {
    const data: Record<string, any> = {
      제목: event.title,
      상세내용: event.description || '',
      참가자: event.participants || '',
      부서ID: event.departmentId,
      시작일: event.startDate,
      종료일: event.endDate,
      시작시간: event.startTime || '',
      종료시간: event.endTime || '',
      하루종일: event.isAllDay || false,
      색상: event.color,
      글자색: event.textColor,
      테두리색: event.borderColor,
      작성자ID: event.authorId || '',
      작성자명: event.authorName || '',
      생성일시: event.createdAt || new Date().toISOString(),
      수정일시: new Date().toISOString(),
      참가현황: event.attendance || {},
      // Recurrence fields
      반복그룹ID: event.recurrenceGroupId || '',
      반복순서: event.recurrenceIndex || 0,
      반복유형: event.recurrenceType || ''
    };
    // Filter out any remaining undefined values
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  },
  fromFirestore: (snapshot: any, options: any) => {
    const data = snapshot.data(options);
    // Robustness: If time is empty, treat as All Day (even if field is missing)
    const inferredAllDay = data.하루종일 || (data.시작시간 === '' && data.종료시간 === '');

    return {
      id: snapshot.id,
      title: data.제목,
      description: data.상세내용,
      participants: data.참가자,
      departmentId: data.부서ID,
      startDate: data.시작일,
      endDate: data.종료일,
      startTime: data.시작시간,
      endTime: data.종료시간,
      isAllDay: inferredAllDay,
      color: data.색상,
      textColor: data.글자색 || '#ffffff', // Default to white for existing events
      borderColor: data.테두리색 || data.색상 || 'transparent', // Default to bg color if missing
      authorId: data.작성자ID,
      authorName: data.작성자명,
      createdAt: data.생성일시,
      updatedAt: data.수정일시,
      attendance: data.참가현황,
      // Recurrence fields
      recurrenceGroupId: data.반복그룹ID || undefined,
      recurrenceIndex: data.반복순서 || undefined,
      recurrenceType: data.반복유형 || undefined
    } as CalendarEvent;
  }
};

// Embedded Injaewon Logo
const INJAEWON_LOGO = "/logo.png";

const getJobTitleStyle = (title: string = '') => {
  if (title.includes('원장') || title.includes('대표')) return 'bg-amber-100 text-amber-700 border border-amber-200';
  if (title.includes('이사')) return 'bg-purple-100 text-purple-700 border border-purple-200';
  if (title.includes('부장')) return 'bg-indigo-100 text-indigo-700 border border-indigo-200'; // Added Boojang
  if (title.includes('실장') || title.includes('팀장')) return 'bg-blue-100 text-blue-700 border border-blue-200';
  if (title.includes('대리')) return 'bg-green-100 text-green-700 border border-green-200';
  if (title.includes('강사')) return 'bg-pink-100 text-pink-700 border border-pink-200';
  return 'bg-gray-100 text-gray-600 border border-gray-200';
};

const App: React.FC = () => {

  // App Mode (Top-level navigation)
  const [appMode, setAppMode] = useState<'calendar' | 'timetable'>('calendar');

  const [baseDate, setBaseDate] = useState(new Date());
  const rightDate = subYears(baseDate, 1);

  // Firestore Data State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false); // New State

  // Local Settings
  const [hiddenDeptIds, setHiddenDeptIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('dept_hidden_ids');
    return saved ? JSON.parse(saved) : [];
  });

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEndDate, setSelectedEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDeptId, setSelectedDeptId] = useState<string>(''); // For creating new events
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [isCompareMode, setIsCompareMode] = useState<boolean>(true);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // New Category Filter State

  const [initialStartTime, setInitialStartTime] = useState('');

  // Derive unique categories from available departments
  const uniqueCategories = Array.from(new Set(departments.map(d => d.category).filter(Boolean))) as string[];
  const [initialEndTime, setInitialEndTime] = useState('');

  // UI State for New Header
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Pending Event Moves State (for drag-and-drop)
  const [pendingEventMoves, setPendingEventMoves] = useState<{ original: CalendarEvent, updated: CalendarEvent }[]>([]);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Permission Hook
  const { hasPermission } = usePermissions(userProfile || null);

  // Auth Listener
  // Auth Listener with Real-time Profile Sync
  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (user) {
        // Real-time listener for User Profile
        const userDocRef = doc(db, 'users', user.uid);

        profileUnsubscribe = onSnapshot(userDocRef, async (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data() as UserProfile;

            // Critical Fix: Force Master Role for specific email if not set
            if (user.email === 'st2000423@gmail.com' && userData.role !== 'master') {
              const updatedProfile: UserProfile = {
                ...userData,
                role: 'master',
                status: 'approved',
                canEdit: true
              };
              await setDoc(userDocRef, updatedProfile);
              // The snapshot will fire again, so we don't need to set state here necessarily, 
              // but for immediate feedback:
              setUserProfile(updatedProfile);
            } else {
              setUserProfile(userData);
            }
          } else {
            // Document doesn't exist - Create it
            if (user.email === 'st2000423@gmail.com') {
              const newMasterProfile: UserProfile = {
                uid: user.uid,
                email: user.email!,
                role: 'master',
                status: 'approved',
                allowedDepartments: [],
                canEdit: true
              };
              await setDoc(userDocRef, newMasterProfile);
              setUserProfile(newMasterProfile);
            } else {
              // Initial user creation handled here
              const newUserProfile: UserProfile = {
                uid: user.uid,
                email: user.email!,
                role: 'user',
                status: 'pending', // Default to pending
                allowedDepartments: [],
                departmentPermissions: {}
              };
              await setDoc(userDocRef, newUserProfile);
              setUserProfile(newUserProfile);
            }
          }
          setAuthLoading(false);
        }, (error) => {
          console.error("Error listening to user profile:", error);
          setAuthLoading(false);
        });

      } else {
        setUserProfile(null);
        setIsLoginModalOpen(true);
        setAuthLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  // Fetch Users (for Participants & Admin)
  useEffect(() => {
    // Optimization: In a real app, might want to restrict this or use cloud functions
    // For now, we fetch all users to support the Participant Selector
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const loadUsers = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(loadUsers);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUserProfile(null);
    localStorage.removeItem('dept_hidden_ids'); // Reset local visibility settings
    window.location.reload(); // Clean state reset
  };

  // Reset visibility when user changes (optional convenience)
  useEffect(() => {
    if (currentUser) {
      // Optional: Reset hidden departments on fresh login to ensure everything is visible
      // setHiddenDeptIds([]); 
    }
  }, [currentUser]);

  // Derive Permissions
  const isMaster = userProfile?.role === 'master';
  const isAdmin = userProfile?.role === 'admin';
  // canEdit is now derived/overridden by departmental permissions, but global override remains for Master
  const canGlobalEdit = isMaster || isAdmin; // Admin generally has high privileges, but let's stick to granular? 
  // User asked for "Admin" who can "give permissions". This implies Admin manages Users.
  // Docs say: "2. 마스터계정과 같이 '권한'들을 내려줄 수 있는 '어드민' 계정 지정"

  // Filter Departments based on RBAC AND Local Toggles
  // Filter Departments based on RBAC AND Local Toggles
  const visibleDepartments = departments.filter(d => {
    // 1. Access Control Check
    let hasAccess = false;

    // Master/Admin has access to everything -> NO, only Master. Admin follows permissions.
    if (isMaster) {
      hasAccess = true;
    }
    // Check Granular Permissions
    else if (userProfile?.departmentPermissions?.[d.id]) {
      hasAccess = true;
    }
    // Legacy Fallback
    else if (userProfile?.allowedDepartments?.includes(d.id)) {
      hasAccess = true;
    }

    if (!hasAccess) return false;

    // 2. Favorites Filter
    if (showFavoritesOnly && userProfile?.favoriteDepartments) {
      if (!userProfile.favoriteDepartments.includes(d.id)) return false;
    }

    // 3. Local Visibility Toggle Check
    // (Users can hide departments locally even if they have access)
    if (hiddenDeptIds.includes(d.id)) return false;

    return true;
  });

  // Handle time slot click from Daily View
  const handleTimeSlotClick = (date: string, time: string) => {
    if (!hasPermission('events.create')) {
      alert("일정 생성 권한이 없습니다.");
      return;
    }
    setSelectedDate(date);
    setSelectedEndDate(date);
    setEditingEvent(null);

    setInitialStartTime(time);

    // Calculate End Time (1 hour later)
    const [h, m] = time.split(':').map(Number);
    const endH = h + 1;
    const endTimeStr = `${String(endH > 23 ? 23 : endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setInitialEndTime(endTimeStr);

    setIsEventModalOpen(true);
  };

  // Subscribe to Departments (부서목록)
  useEffect(() => {
    const q = query(collection(db, "부서목록").withConverter(departmentConverter), orderBy("순서"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadDepts = snapshot.docs.map(doc => doc.data());
      setDepartments(loadDepts);
    });
    return () => unsubscribe();
  }, []);


  // Fetch System Configuration (Lookback Period)
  // Fetch System Configuration (Lookback Period & Categories)
  const [lookbackYears, setLookbackYears] = useState<number>(2);
  const [sysCategories, setSysCategories] = useState<string[]>([]);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  useEffect(() => {
    const q = collection(db, 'holidays');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadHolidays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Holiday));
      setHolidays(loadHolidays);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'system', 'config'), (doc) => {
      if (doc.exists()) {
        const years = doc.data().eventLookbackYears || 2;
        const categories = doc.data().categories || [];
        setLookbackYears(years);
        setSysCategories(categories);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Events (일정)
  useEffect(() => {
    // Optimization: Fetch events from configured lookback years (default 2)
    const queryStartDate = format(subYears(new Date(), lookbackYears), 'yyyy-MM-dd');

    const q = query(
      collection(db, "일정").withConverter(eventConverter),
      where("시작일", ">=", queryStartDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadEvents = snapshot.docs.map(doc => doc.data());
      setEvents(loadEvents);
    });
    return () => unsubscribe();
  }, [lookbackYears]);

  useEffect(() => {
    localStorage.setItem('dept_hidden_ids', JSON.stringify(hiddenDeptIds));
  }, [hiddenDeptIds]);

  const handleCellClick = (date: string, deptId: string) => {
    if (!hasPermission('events.create')) {
      // Silent return or alert
      return;
    }
    setSelectedDate(date);
    setSelectedEndDate(date);
    setSelectedDeptId(deptId);
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleRangeSelect = (startDate: string, endDate: string, deptId: string) => {
    if (!hasPermission('events.create')) return;
    setSelectedDate(startDate);
    setSelectedEndDate(endDate);
    setSelectedDeptId(deptId);
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(event.startDate);
    setSelectedEndDate(event.endDate);
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (event: CalendarEvent) => {
    try {
      // Check for recurrence
      const recurrenceCount = (event as any)._recurrenceCount;
      delete (event as any)._recurrenceCount; // Clean up temp property

      if (recurrenceCount && recurrenceCount > 1 && event.recurrenceType) {
        // Batch create recurring events
        const batch = writeBatch(db);
        const baseStart = parseISO(event.startDate);
        const baseEnd = parseISO(event.endDate);
        const duration = differenceInDays(baseEnd, baseStart);
        const groupId = event.id; // Use first event ID as group ID

        let createdCount = 0;
        let currentDate = baseStart;

        for (let i = 0; i < recurrenceCount; i++) {
          // Calculate next date based on recurrence type
          if (i > 0) {
            switch (event.recurrenceType) {
              case 'daily':
                currentDate = addDays(baseStart, i);
                break;
              case 'weekdays':
                // Skip to next weekday
                currentDate = addDays(currentDate, 1);
                while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
                  currentDate = addDays(currentDate, 1);
                }
                break;
              case 'weekends':
                // Skip to next weekend day
                currentDate = addDays(currentDate, 1);
                while (getDay(currentDate) !== 0 && getDay(currentDate) !== 6) {
                  currentDate = addDays(currentDate, 1);
                }
                break;
              case 'weekly':
                currentDate = addWeeks(baseStart, i);
                break;
              case 'monthly':
                currentDate = addMonths(baseStart, i);
                break;
              case 'yearly':
                currentDate = addYears(baseStart, i);
                break;
            }
          }

          const eventId = i === 0 ? event.id : `${event.id}_r${i + 1}`;
          const newStartDate = format(currentDate, 'yyyy-MM-dd');
          const newEndDate = format(addDays(currentDate, duration), 'yyyy-MM-dd');

          const recurringEvent: CalendarEvent = {
            ...event,
            id: eventId,
            startDate: newStartDate,
            endDate: newEndDate,
            recurrenceGroupId: groupId,
            recurrenceIndex: i + 1,
          };

          const ref = doc(db, "일정", eventId).withConverter(eventConverter);
          batch.set(ref, recurringEvent);
          createdCount++;
        }

        await batch.commit();
        alert(`${createdCount}개의 반복 일정이 생성되었습니다.`);
      } else {
        // Single event save
        const ref = doc(db, "일정", event.id).withConverter(eventConverter);
        await setDoc(ref, event);
      }
    } catch (e) {
      console.error("Error saving event: ", e);
      alert("일정 저장 실패");
    }
  };

  const handleDeleteEvent = async (id: string, event?: CalendarEvent) => {
    try {
      // Check if this is a recurring event (index starts at 1, so > 0 is valid)
      if (event?.recurrenceGroupId && event.recurrenceIndex && event.recurrenceIndex > 0) {
        const deleteAll = window.confirm(
          `이 일정은 반복 일정입니다.\n\n"확인": 이후 모든 반복 일정 삭제\n"취소": 이 일정만 삭제`
        );

        if (deleteAll) {
          // Delete all future events in the recurrence group
          const groupId = event.recurrenceGroupId;
          const currentIndex = event.recurrenceIndex;

          // Find all events in this group with index >= current
          const toDelete = events.filter(
            e => e.recurrenceGroupId === groupId && (e.recurrenceIndex || 0) >= currentIndex
          );

          const batch = writeBatch(db);
          toDelete.forEach(e => {
            batch.delete(doc(db, "일정", e.id));
          });
          await batch.commit();
          alert(`${toDelete.length}개의 반복 일정이 삭제되었습니다.`);
        } else {
          // Delete only this event
          await deleteDoc(doc(db, "일정", id));
        }
      } else {
        // Regular single event delete
        await deleteDoc(doc(db, "일정", id));
      }
    } catch (e) {
      console.error("Error deleting event: ", e);
      alert("일정 삭제 실패");
    }
  };

  const toggleDeptVisibility = (id: string) => {
    setHiddenDeptIds(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const setAllVisibility = (visible: boolean) => {
    if (visible) {
      setHiddenDeptIds([]);
    } else {
      setHiddenDeptIds(departments.map(d => d.id));
    }
  };

  // Toggle Favorite Department
  const toggleFavorite = async (deptId: string) => {
    if (!userProfile) return;
    const current = userProfile.favoriteDepartments || [];
    const updated = current.includes(deptId)
      ? current.filter(id => id !== deptId)
      : [...current, deptId];

    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        favoriteDepartments: updated
      });
    } catch (e) {
      console.error('Error updating favorites:', e);
    }
  };

  // --- Batch Update Attendance for Recurring Events ---
  const handleBatchUpdateAttendance = async (groupId: string, uid: string, status: 'pending' | 'joined' | 'declined') => {
    try {
      const groupEvents = events.filter(e => e.recurrenceGroupId === groupId);
      const batch = writeBatch(db);

      groupEvents.forEach(event => {
        const ref = doc(db, "일정", event.id);
        const updatedAttendance = { ...(event.attendance || {}), [uid]: status };
        batch.update(ref, { 참가현황: updatedAttendance });
      });

      await batch.commit();
      alert(`${groupEvents.length}개의 반복 일정에 참가 상태가 적용되었습니다.`);
    } catch (e) {
      console.error("Error batch updating attendance: ", e);
      alert("참가 상태 일괄 변경 실패");
    }
  };

  // --- Event Drag and Drop ---
  // --- Event Drag and Drop ---
  const handleEventMove = (original: CalendarEvent, updated: CalendarEvent) => {
    // Permission Check
    const isAuthor = original.authorId === userProfile?.uid;
    const canDrag = hasPermission('events.drag_move');
    const canEdit = hasPermission(isAuthor ? 'events.edit_own' : 'events.edit_others');
    const hasDeptAccess = canEditDepartment(original.departmentId);

    if (!canDrag || !canEdit || !hasDeptAccess) {
      alert('일정을 이동할 권한이 없습니다.');
      return;
    }

    setPendingEventMoves(prev => {
      const filtered = prev.filter(m => m.original.id !== original.id);
      return [...filtered, { original, updated }];
    });
  };

  const handleSavePendingMoves = async () => {
    if (pendingEventMoves.length === 0) return;
    try {
      for (const move of pendingEventMoves) {
        await handleSaveEvent(move.updated);
      }
      setPendingEventMoves([]);
      alert(`${pendingEventMoves.length}개의 일정이 이동되었습니다.`);
    } catch (e) {
      console.error(e);
      alert('일정 이동 중 오류가 발생했습니다.');
    }
  };

  const handleCancelPendingMoves = () => {
    setPendingEventMoves([]);
  };

  const canEditDepartment = (deptId: string): boolean => {
    if (!userProfile) return false;
    if (userProfile.role === 'master') return true;
    const permission = userProfile.departmentPermissions?.[deptId];
    return permission === 'edit';
  };

  // Compute display events (apply pending moves for preview)
  const displayEvents = events.map(event => {
    const pendingMove = pendingEventMoves.find(m => m.original.id === event.id);
    return pendingMove ? pendingMove.updated : event;
  });

  const pendingEventIds = pendingEventMoves.map(m => m.original.id);

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f4f8]">
      <header className="no-print z-40 sticky top-0 flex flex-col shadow-2xl relative">
        {/* Row 1: Primary Header (Navy) */}
        <div className="bg-[#081429] h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/10 z-50 relative">

          {/* Left: Branding */}
          <div className="flex items-center gap-3 min-w-[250px]">
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                src={INJAEWON_LOGO}
                alt="Logo"
                className="w-full h-full object-contain filter drop-shadow-md"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-xl font-black text-white tracking-tighter hidden md:flex items-center gap-1 flex-shrink-0">
              인재원 <span className="text-[#fdb813]">학원</span>
            </h1>

            {/* Top-level App Mode Tabs */}
            <div className="hidden md:flex bg-white/10 rounded-lg p-0.5 ml-4">
              <button
                onClick={() => setAppMode('calendar')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${appMode === 'calendar'
                  ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                📅 연간 일정
              </button>
              {/* Timetable - MASTER only */}
              {userProfile?.role === 'master' && (
                <button
                  onClick={() => setAppMode('timetable')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${appMode === 'timetable'
                    ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                >
                  📋 시간표
                </button>
              )}
            </div>

            {/* User Info Display (Moved to Left) */}
            {currentUser && (
              <div className="hidden md:flex flex-row items-center gap-1.5 ml-4 pl-4 border-l border-white/10 overflow-hidden">
                {/* Master Badge */}
                {userProfile?.role === 'master' && (
                  <span className="bg-red-600 text-white text-[9px] px-1 py-0.5 rounded font-black tracking-tighter shadow-sm">MASTER</span>
                )}
                {/* Admin Badge */}
                {userProfile?.role === 'admin' && (
                  <span className="bg-indigo-600 text-white text-[9px] px-1 py-0.5 rounded font-black tracking-tighter shadow-sm">ADMIN</span>
                )}
                {/* Name */}
                <span className="text-xs font-bold text-white whitespace-nowrap">
                  {(userProfile?.email || currentUser?.email)?.split('@')[0]}
                </span>
                {/* Job Title Badge */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center justify-center font-bold tracking-tight whitespace-nowrap ${getJobTitleStyle(userProfile?.jobTitle)}`}>
                  {userProfile?.jobTitle || '직급 미설정'}
                </span>
              </div>
            )}
          </div>


          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-3 w-[250px]">

            <button
              onClick={() => {
                setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                setSelectedEndDate(format(new Date(), 'yyyy-MM-dd'));
                setSelectedDeptId(visibleDepartments[0]?.id || departments[0]?.id);
                setEditingEvent(null);
                setInitialStartTime('');
                setInitialEndTime('');
                setIsEventModalOpen(true);
              }}
              className="h-7 px-2 bg-[#fdb813] text-[#081429] rounded hover:brightness-110 flex-shrink-0 flex items-center justify-center gap-1 font-bold shadow-sm transition-all active:scale-95 text-[11px] whitespace-nowrap"
            >
              <Plus size={14} /> <span className="hidden lg:inline">일정 추가</span>
            </button>

            <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-white transition-colors">
              <Settings size={20} />
            </button>
            <button onClick={() => window.print()} className="text-gray-400 hover:text-white transition-colors">
              <Printer size={20} />
            </button>
            {/* Profile Dropdown */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className={`transition-colors mt-[5px] ${isProfileMenuOpen ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <UserIcon size={20} />
                </button>

                {isProfileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsProfileMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 overflow-hidden text-sm">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                        <p className="font-bold text-gray-800">{userProfile?.email?.split('@')[0]}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{userProfile?.jobTitle || '직급 미설정'}</p>
                      </div>
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                      >
                        <LogOut size={16} /> 로그아웃
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Filter Bar (Slate) - Only show in calendar mode */}
        {appMode === 'calendar' && (
          <div className="bg-[#1e293b] h-10 flex items-center px-4 md:px-6 border-b border-gray-700 relative z-40 text-xs">

            {/* Main Filter Toggle */}
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`
              flex items-center gap-2 px-3 h-full border-r border-gray-700 hover:bg-white/5 transition-colors
              ${isFilterOpen ? 'text-[#fdb813] font-bold bg-white/5' : 'text-gray-300'}
            `}
            >
              <Filter size={14} />
              <span>부서 필터</span>
              {isFilterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Active Filters Summary */}
            <div className="flex items-center gap-2 px-4 overflow-hidden mask-linear-fade flex-1">
              {hiddenDeptIds.length === 0 ? (
                <span className="text-gray-400 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-green-500" /> 모든 부서 표시중
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">표시됨:</span>
                  {visibleDepartments.slice(0, 5).map(d => (
                    <span key={d.id} className="px-1.5 py-0.5 rounded bg-[#081429] border border-gray-700 text-gray-300">
                      {d.name}
                    </span>
                  ))}

                  {visibleDepartments.length > 5 && (
                    <span className="text-gray-500">+{visibleDepartments.length - 5} 더보기</span>
                  )}
                </div>
              )}
            </div>

            {/* View Toggles - Moved from Top Header */}
            <div className="flex items-center gap-2 ml-auto pl-4 border-l border-gray-700 h-[24px] my-auto">
              {/* Daily/Weekly/Monthly */}
              <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5">
                {(['daily', 'weekly', 'monthly'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={`
                    px-2 py-0.5 rounded-md text-[11px] font-bold transition-all
                    ${viewMode === m
                        ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }
                  `}
                  >
                    {m === 'daily' && '일간'}
                    {m === 'weekly' && '주간'}
                    {m === 'monthly' && '월간'}
                  </button>
                ))}
              </div>

              {/* Comparison Mode Toggle (Always visible) */}
              <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5">
                <button
                  onClick={() => setIsCompareMode(false)}
                  className={`
                     px-2 py-0.5 rounded-md text-[11px] font-bold transition-all
                     ${!isCompareMode
                      ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }
                   `}
                >
                  기본
                </button>
                <button
                  onClick={() => setIsCompareMode(true)}
                  className={`
                     px-2 py-0.5 rounded-md text-[11px] font-bold transition-all
                     ${isCompareMode
                      ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }
                   `}
                >
                  비교
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Popover Panel */}
        {appMode === 'calendar' && isFilterOpen && (
          <div className="absolute top-[104px] left-0 w-full bg-[#1e293b]/95 backdrop-blur-xl border-b border-gray-700 shadow-2xl p-6 z-10 animate-in slide-in-from-top-2 duration-200">
            <div className="w-full h-full">
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Filter size={16} className="text-[#fdb813]" /> 부서 선택
                  </h3>

                  {/* Category Filter Chips */}
                  {uniqueCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2 animate-in fade-in duration-300">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${selectedCategory === null
                          ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                          : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                          }`}
                      >
                        전체
                      </button>
                      {uniqueCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(prev => prev === cat ? null : cat)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${selectedCategory === cat
                            ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                            : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                            }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  {/* Favorites Only Toggle */}
                  <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-bold border transition-all ${showFavoritesOnly
                      ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                      : 'bg-transparent text-gray-400 border-gray-700 hover:border-[#fdb813]/50'
                      }`}
                  >
                    <Star size={12} className={showFavoritesOnly ? 'fill-current' : ''} />
                    즐겨찾기만
                  </button>
                  <button onClick={() => setAllVisibility(true)} className="px-3 py-1.5 rounded bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20 hover:bg-green-500/20">
                    모두 켜기
                  </button>
                  <button onClick={() => setAllVisibility(false)} className="px-3 py-1.5 rounded bg-red-500/10 text-red-500 text-xs font-bold border border-red-500/20 hover:bg-red-500/20">
                    모두 끄기
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {departments
                  .filter(d => !selectedCategory || d.category === selectedCategory)
                  .map(dept => {
                    const isHidden = hiddenDeptIds.includes(dept.id);
                    const isAllowed = userProfile?.departmentPermissions?.[dept.id] || userProfile?.allowedDepartments?.includes(dept.id) || isMaster;
                    const isFavorite = userProfile?.favoriteDepartments?.includes(dept.id);

                    if (!isAllowed) return null;

                    return (
                      <div
                        key={dept.id}
                        className={`
                         flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-bold transition-all
                         ${isHidden
                            ? 'bg-transparent border-gray-700 text-gray-500'
                            : 'bg-[#081429] border-[#fdb813]/30 text-white shadow-sm ring-1 ring-[#fdb813]/20'
                          }
                       `}
                      >
                        {/* Favorite Star */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(dept.id);
                          }}
                          className="hover:scale-110 transition-transform"
                        >
                          <Star
                            size={14}
                            className={isFavorite ? 'text-[#fdb813] fill-[#fdb813]' : 'text-gray-600 hover:text-[#fdb813]'}
                          />
                        </button>

                        {/* Toggle Visibility */}
                        <button
                          onClick={() => toggleDeptVisibility(dept.id)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <span className={`w-2 h-2 rounded-full ${isHidden ? 'bg-gray-700' : ''}`} style={{ backgroundColor: !isHidden ? (dept.color?.startsWith('#') ? dept.color : 'white') : undefined }} />
                          <span className="truncate flex-1">{dept.name}</span>
                          {isHidden ? <EyeOff size={12} /> : <Eye size={12} className="text-[#fdb813]" />}
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Close Handle */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full bg-[#1e293b] px-6 py-0.5 rounded-b-xl border-b border-x border-gray-700 cursor-pointer hover:bg-[#081429] transition-colors"
              onClick={() => setIsFilterOpen(false)}
            >
              <ChevronUp size={16} className="text-gray-400" />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {appMode === 'calendar' ? (
          /* Calendar View */
          <div className="w-full flex-1 max-w-full mx-auto min-h-screen print:p-0 flex flex-col xl:flex-row gap-8 print:flex-row print:gap-4">
            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0">
              <CalendarBoard
                currentDate={baseDate}
                onDateChange={setBaseDate}
                departments={visibleDepartments}
                events={displayEvents}
                onCellClick={handleCellClick}
                onRangeSelect={handleRangeSelect}
                onTimeSlotClick={handleTimeSlotClick}
                onEventClick={handleEventClick}
                holidays={holidays}
                viewMode={viewMode}
                currentUser={userProfile}
                onEventMove={handleEventMove}
                canEditDepartment={canEditDepartment}
                pendingEventIds={pendingEventIds}
              />
            </div>

            <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0 transition-all duration-300 ${isCompareMode ? '' : 'hidden'}`}>
              <CalendarBoard
                currentDate={rightDate}
                onDateChange={(date) => setBaseDate(addYears(date, 1))}
                departments={visibleDepartments}
                events={displayEvents}
                onCellClick={handleCellClick}
                onRangeSelect={handleRangeSelect}
                onTimeSlotClick={handleTimeSlotClick}
                onEventClick={handleEventClick}
                holidays={holidays}
                viewMode={viewMode}
                onEventMove={handleEventMove}
                canEditDepartment={canEditDepartment}
                pendingEventIds={pendingEventIds}
              />
            </div>
          </div>
        ) : (
          /* Timetable View */
          <div className="w-full flex-1 p-4 md:p-6">
            <TimetableManager />
          </div>
        )}

        {/* Floating Save Button for Pending Moves */}
        {pendingEventMoves.length > 0 && (
          <div className="fixed bottom-6 right-6 z-50 flex gap-3 animate-in slide-in-from-bottom-4 duration-300">
            <button
              onClick={handleCancelPendingMoves}
              className="px-4 py-3 bg-white text-gray-700 rounded-xl font-bold shadow-lg border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              취소
            </button>
            <button
              onClick={handleSavePendingMoves}
              className="px-6 py-3 bg-[#fdb813] text-[#081429] rounded-xl font-bold shadow-lg hover:brightness-110 transition-all flex items-center gap-2"
            >
              <span className="bg-[#081429] text-white px-2 py-0.5 rounded-full text-xs font-black">{pendingEventMoves.length}</span>
              변경사항 저장
            </button>
          </div>
        )}
      </main>

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialDate={selectedDate}
        initialEndDate={selectedEndDate}
        initialDepartmentId={selectedDeptId}
        initialStartTime={initialStartTime}
        initialEndTime={initialEndTime}
        existingEvent={editingEvent}
        departments={visibleDepartments} // ONLY Pass visible
        // Granular Permission Update: 
        // We do NOT forcefully set readOnly based on global edit anymore.
        // EventModal will check `userProfile.departmentPermissions` vs `selectedDeptId`.
        readOnly={false}
        users={users}
        currentUser={userProfile}
        allEvents={events}
        onBatchUpdateAttendance={handleBatchUpdateAttendance}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        canClose={!!currentUser} // Only allow close if logged in
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        departments={departments}
        currentUserProfile={userProfile}
        users={users} // Pass users
        holidays={holidays}
        events={events}
        sysCategories={sysCategories}
      />

      {/* Access Denied / Pending Approval Overlay */}
      {
        currentUser && userProfile?.status === 'pending' && (
          <div className="fixed inset-0 bg-[#081429] z-50 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in duration-300">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-2 mb-6 shadow-lg shadow-[#fdb813]/20">
              <img src={INJAEWON_LOGO} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-3xl font-black mb-4">관리자 승인 대기중</h2>
            <p className="text-gray-300 max-w-md mb-8 leading-relaxed">
              계정 생성이 완료되었으나, 관리자의 승인이 필요합니다.<br />
              승인이 완료되면 이메일로 알림이 발송되지 않으니,<br />
              잠시 후 다시 로그인해 확인해주세요.
            </p>
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-white text-[#081429] font-bold rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <LogOut size={20} /> 로그아웃
            </button>
          </div>
        )
      }
    </div >
  );
};

export default App;
