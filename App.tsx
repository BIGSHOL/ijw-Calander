import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { addYears, subYears, format, isToday, isPast, isFuture, parseISO, startOfDay, addDays, addWeeks, addMonths, getDay, getDate, endOfMonth, differenceInDays } from 'date-fns';
import { CalendarEvent, Department, UserProfile, Holiday, ROLE_LABELS, Teacher, BucketItem, TaskMemo, ClassKeywordColor, AppTab } from './types';
import { INITIAL_DEPARTMENTS } from './constants';
import { usePermissions } from './hooks/usePermissions';
import { useDepartments, useTeachers, useHolidays, useClassKeywords, useSystemConfig } from './hooks/useFirebaseQueries';
import { useGanttProjects } from './hooks/useGanttProjects';
import { convertGanttProjectsToCalendarEvents } from './utils/ganttToCalendar';
import { useTabPermissions } from './hooks/useTabPermissions';

// 항상 필요한 컴포넌트 (즉시 로딩)
import EventModal from './components/Calendar/EventModal';
import SettingsModal from './components/settings/SettingsModal';
import LoginModal from './components/Auth/LoginModal';
import CalendarBoard from './components/Calendar/CalendarBoard';
import NavigationBar from './components/Navigation/NavigationBar';

// 탭별 컴포넌트 (lazy loading - 해당 탭 진입 시 로딩)
const TimetableManager = lazy(() => import('./components/Timetable/TimetableManager'));
const AttendanceManager = lazy(() => import('./components/Attendance/AttendanceManager'));
const PaymentReport = lazy(() => import('./components/PaymentReport/PaymentReport'));
const GanttManager = lazy(() => import('./components/Gantt/GanttManager'));
const ConsultationManager = lazy(() => import('./components/Consultation/ConsultationManager'));
const StudentManagementTab = lazy(() => import('./components/StudentManagement/StudentManagementTab'));
const GradesManager = lazy(() => import('./components/Grades/GradesManager'));
const ClassManagementTab = lazy(() => import('./components/ClassManagement').then(m => ({ default: m.ClassManagementTab })));
const ConsultationManagementTab = lazy(() => import('./components/ConsultationManagement').then(m => ({ default: m.ConsultationManagementTab })));

// 신규 탭 (lazy loading)
const BillingManager = lazy(() => import('./components/Billing').then(m => ({ default: m.BillingManager })));
const DailyAttendanceManager = lazy(() => import('./components/DailyAttendance').then(m => ({ default: m.DailyAttendanceManager })));
const StaffManager = lazy(() => import('./components/Staff').then(m => ({ default: m.StaffManager })));
import { Settings, Printer, Plus, Eye, EyeOff, LayoutGrid, Calendar as CalendarIcon, List, CheckCircle2, XCircle, LogOut, LogIn, UserCircle, Lock as LockIcon, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, User as UserIcon, Star, Bell, Mail, Send, Trash2, X, UserPlus, RefreshCw, Search, Save, GraduationCap, Tag, Edit } from 'lucide-react';
import { db, auth } from './firebaseConfig';
import { collection, onSnapshot, setDoc, doc, deleteDoc, writeBatch, query, orderBy, where, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Import Firestore Converters from separate file
import { departmentConverter, eventConverter } from './converters';
import './scripts/migrateStudents'; // Temporary: for v6 migration

// Import Style Utilities
import { INJAEWON_LOGO, getJobTitleStyle } from './utils/styleUtils';

// Lazy loading 폴백 컴포넌트
const TabLoadingFallback = () => (
  <div className="w-full h-64 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-[#fdb813] border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-500">로딩 중...</span>
    </div>
  </div>
);

// Helper to format user display: Name (JobTitle) or Email (JobTitle)
const formatUserDisplay = (u: UserProfile) => {
  const name = u.displayName || u.email.split('@')[0];
  return u.jobTitle ? `${name} (${u.jobTitle})` : name;
};

const App: React.FC = () => {

  // App Mode (Top-level navigation) - null until permissions are loaded
  const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students' | 'grades' | 'classes' | 'student-consultations' | 'billing' | 'daily-attendance' | 'staff' | null>(null);

  const [baseDate, setBaseDate] = useState(new Date());
  const rightDate = subYears(baseDate, 1);  // 2단: 1년 전
  const thirdDate = subYears(baseDate, 2);  // 3단: 2년 전

  // Auth State (Moved up for dependencies)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Firestore Data State - React Query for static data (cached 30-60min)
  const { data: departments = [] } = useDepartments(!!currentUser);
  const { data: teachers = [] } = useTeachers(!!currentUser);
  const { data: holidays = [] } = useHolidays(!!currentUser);
  const { data: classKeywords = [] } = useClassKeywords(!!currentUser);
  const { data: systemConfig } = useSystemConfig(!!currentUser);
  const lookbackYears = systemConfig?.eventLookbackYears || 2;
  const sysCategories = systemConfig?.categories || [];

  // Tab Permissions


  // Real-time data (still uses onSnapshot for events)
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false); // New State
  const [isPermissionViewOpen, setIsPermissionViewOpen] = useState(false); // Permission View Toggle



  // Local Settings
  const [hiddenDeptIds, setHiddenDeptIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('dept_hidden_ids');
    return saved ? JSON.parse(saved) : [];
  });

  // Dark Mode Setting
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('dark_mode');
    return saved === 'true';
  });

  // Apply dark mode class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false); // Phase 9: Global Archive State

  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEndDate, setSelectedEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDeptId, setSelectedDeptId] = useState<string>(''); // For creating new events
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(() => {
    const saved = localStorage.getItem('default_view_mode');
    return (saved as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'monthly';
  });
  const [viewColumns, setViewColumns] = useState<1 | 2 | 3>(2); // 1단, 2단, 3단

  // Force viewColumns to 2 if currently 3 when switching to yearly view
  useEffect(() => {
    if (viewMode === 'yearly' && viewColumns === 3) {
      setViewColumns(2);
    }
  }, [viewMode, viewColumns]);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Student Management Filters (for header integration)
  const [studentFilters, setStudentFilters] = useState({
    searchQuery: '',
    grade: 'all',
    status: 'all' as 'all' | 'active' | 'on_hold' | 'withdrawn',
    subject: 'all',
  });
  const [studentSortBy, setStudentSortBy] = useState<'name' | 'grade' | 'startDate'>('name');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // New Category Filter State

  const [initialStartTime, setInitialStartTime] = useState('');
  const [initialTitle, setInitialTitle] = useState(''); // For bucket-to-event conversion
  const [pendingBucketId, setPendingBucketId] = useState<string | null>(null); // Bucket to delete after event save

  // Derive unique categories from available departments
  const uniqueCategories = Array.from(new Set(departments.map(d => d.category).filter(Boolean))) as string[];
  const [initialEndTime, setInitialEndTime] = useState('');

  // Template Event State for Copy Feature
  const [templateEvent, setTemplateEvent] = useState<CalendarEvent | null>(null);



  // UI State for New Header
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Attendance Navigation State (for App-level attendance bar)
  const [attendanceSubject, setAttendanceSubject] = useState<'math' | 'english'>('math');
  const [attendanceTeacherId, setAttendanceTeacherId] = useState<string | undefined>(undefined);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date());

  // Timetable Filter State (for App-level filter bar)
  const [timetableSubject, setTimetableSubject] = useState<'math' | 'english'>('math');
  const [timetableViewType, setTimetableViewType] = useState<'teacher' | 'room' | 'class'>('teacher');

  // Grades Filter State (for App-level filter bar)
  const [gradesSubjectFilter, setGradesSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
  const [gradesSearchQuery, setGradesSearchQuery] = useState('');

  // Pending Event Moves State (for drag-and-drop)
  const [pendingEventMoves, setPendingEventMoves] = useState<{ original: CalendarEvent, updated: CalendarEvent }[]>([]);

  // Auth State


  // Permission Hook
  const { hasPermission, rolePermissions } = usePermissions(userProfile || null);

  // Modal State for Attendance "Add Student" (lifted from AttendanceManager)
  const [isAttendanceAddStudentModalOpen, setIsAttendanceAddStudentModalOpen] = useState(false);

  // TEMPORARY: Disabled auto-initialization based on permissions
  // TODO: Re-enable after fixing permission configuration
  // Initialize timetable subject based on user's permissions (edit permission takes priority)
  // useEffect(() => {
  //   if (!userProfile) return;

  //   let initialSubject: 'math' | 'english' = 'math';

  //   // Priority 1: Edit permission (user's primary subject)
  //   if (hasPermission('timetable.english.edit')) {
  //     initialSubject = 'english';
  //   } else if (hasPermission('timetable.math.edit')) {
  //     initialSubject = 'math';
  //   }
  //   // Priority 2: View permission (if no edit permission)
  //   else if (hasPermission('timetable.english.view') && !hasPermission('timetable.math.view')) {
  //     initialSubject = 'english';
  //   }
  //   // else: default 'math'

  //   if (timetableSubject !== initialSubject) {
  //     console.log(`[Init] Setting initial timetableSubject to: ${initialSubject}`);
  //     setTimetableSubject(initialSubject);
  //   }
  // }, [userProfile, hasPermission, timetableSubject]);

  // Guard: Strictly enforce permission access to subjects
  // If a user somehow lands on a subject they don't have permission for, switch them.
  // TEMPORARY: Disabled permission guard for timetable subject switching
  // TODO: Re-enable after fixing permission issues
  // useEffect(() => {
  //   if (!userProfile) return;

  //   const canViewMath = hasPermission('timetable.math.view') || hasPermission('timetable.math.edit');
  //   const canViewEnglish = hasPermission('timetable.english.view') || hasPermission('timetable.english.edit');

  //   if (timetableSubject === 'math' && !canViewMath) {
  //     if (canViewEnglish) {
  //       console.log('[Guard] Switching to English due to missing Math permission');
  //       setTimetableSubject('english');
  //     }
  //   } else if (timetableSubject === 'english' && !canViewEnglish) {
  //     if (canViewMath) {
  //       console.log('[Guard] Switching to Math due to missing English permission');
  //       setTimetableSubject('math');
  //     }
  //   }
  // }, [timetableSubject, hasPermission, userProfile]);

  // Initialize attendance subject based on user's permissions
  useEffect(() => {
    if (!userProfile) return;

    const isMasterOrAdmin = userProfile.role === 'master' || userProfile.role === 'admin';
    const canManageMath = hasPermission('attendance.manage_math');
    const canManageEnglish = hasPermission('attendance.manage_english');

    let initialSubject: 'math' | 'english' = 'math';

    if (isMasterOrAdmin) {
      initialSubject = 'math';
    } else if (canManageMath && !canManageEnglish) {
      initialSubject = 'math';
    } else if (canManageEnglish && !canManageMath) {
      initialSubject = 'english';
    }

    setAttendanceSubject(initialSubject);
  }, [userProfile, hasPermission]);

  // Tab Permissions
  /* ----------------------------------------------------
     Tab Access Redirection Logic
     ---------------------------------------------------- */
  const { canAccessTab, accessibleTabs, isLoading: isTabPermissionLoading } = useTabPermissions(userProfile);

  useEffect(() => {
    // Wait for permissions to load
    if (isTabPermissionLoading || !userProfile) return;

    // Priority order for tabs
    const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation' | 'students')[] = ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation', 'students'];

    // Initial setup: if appMode is null, set to first accessible tab (or user's preferred tab)
    if (appMode === null) {
      // Check for user's preferred default tab
      const preferredTab = localStorage.getItem('default_main_tab');

      if (preferredTab && preferredTab !== 'auto' && canAccessTab(preferredTab as AppTab)) {
        console.log(`[Init] Setting appMode to user preferred tab: ${preferredTab}`);
        setAppMode(preferredTab as 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students');
      } else {
        // Fallback to first accessible tab
        const firstAccessibleTab = priority.find(tab => canAccessTab(tab));
        if (firstAccessibleTab) {
          console.log(`[Init] Setting initial appMode to: ${firstAccessibleTab}`);
          setAppMode(firstAccessibleTab);
        } else {
          // Fallback: no accessible tab, show calendar (will display error)
          console.warn('[Init] No accessible tab found, falling back to calendar');
          setAppMode('calendar');
        }
      }
      return;
    }

    // Redirect: if current mode is not accessible, redirect to first accessible tab
    const isAccessible = canAccessTab(appMode);
    if (!isAccessible) {
      const firstValidTab = priority.find(tab => canAccessTab(tab));
      if (firstValidTab) {
        console.log(`[Access Control] Redirecting from ${appMode} to ${firstValidTab}`);
        setAppMode(firstValidTab);
      }
    }
  }, [appMode, canAccessTab, accessibleTabs, isTabPermissionLoading, userProfile]);

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

            // Get master emails from systemConfig (fallback to hardcoded for backward compatibility)
            const masterEmails = systemConfig?.masterEmails || ['st2000423@gmail.com'];
            const isMasterEmail = user.email && masterEmails.includes(user.email);

            // Critical Fix: Force Master Role for master emails if not set
            if (isMasterEmail && userData.role !== 'master') {
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
              // Only update state if content actually changed (prevent infinite re-renders)
              setUserProfile(prev => {
                if (JSON.stringify(prev) === JSON.stringify(userData)) return prev;
                return userData;
              });
            }
          } else {
            // Document doesn't exist - Create it
            // Get master emails from systemConfig (fallback to hardcoded for backward compatibility)
            const masterEmails = systemConfig?.masterEmails || ['st2000423@gmail.com'];
            const isMasterEmail = user.email && masterEmails.includes(user.email);

            if (isMasterEmail) {
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

  // Subscribe to Events (일정) - REAL-TIME (필수)
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

  // Note: 부서목록, 강사목록, 휴일, classKeywords, systemConfig are now handled by React Query hooks


  useEffect(() => {
    localStorage.setItem('dept_hidden_ids', JSON.stringify(hiddenDeptIds));
  }, [hiddenDeptIds]);

  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  // Monthly Bucket List State (Firebase with onSnapshot for cost efficiency)
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([]);

  // Subscribe to Bucket Items (onSnapshot for caching/delta updates)
  // 최적화: 현재 사용자의 아이템만 조회 (읽기 -90%)
  useEffect(() => {
    if (!currentUser) {
      setBucketItems([]);
      return;
    }
    const q = query(
      collection(db, "bucketItems"),
      where("authorId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BucketItem[];
      setBucketItems(items);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Task Memo State - One-way notifications between users
  const [taskMemos, setTaskMemos] = useState<TaskMemo[]>([]);
  const [isMemoDropdownOpen, setIsMemoDropdownOpen] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [memoRecipients, setMemoRecipients] = useState<string[]>([]);
  const [memoMessage, setMemoMessage] = useState('');
  const [selectedMemo, setSelectedMemo] = useState<TaskMemo | null>(null);

  // Subscribe to Task Memos (only current user's received memos)
  // 최적화: 서버 측 필터링 추가 (isDeleted=false, 읽기 -50%)
  useEffect(() => {
    if (!currentUser) {
      setTaskMemos([]);
      return;
    }
    const q = query(
      collection(db, "taskMemos"),
      where("to", "==", currentUser.uid),
      where("isDeleted", "==", false)
      // orderBy("createdAt", "desc") // 복합 인덱스 필요
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaskMemo[];

      // Client-side sort only (filter already done on server)
      const sortedMemos = memos.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTaskMemos(sortedMemos);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Unread memo count
  const unreadMemoCount = taskMemos.filter(m => !m.isRead).length;

  // Send Task Memo (Multi-recipient)
  const handleSendMemo = async () => {
    if (!currentUser || !userProfile || memoRecipients.length === 0 || !memoMessage.trim()) return;

    const batch = writeBatch(db);
    const now = new Date().toISOString();

    memoRecipients.forEach(recipientId => {
      const recipient = users.find(u => u.uid === recipientId);
      if (recipient) {
        const newDocRef = doc(collection(db, "taskMemos"));
        const newMemo: TaskMemo = {
          id: newDocRef.id,
          from: currentUser.uid,
          fromName: formatUserDisplay(userProfile),
          to: recipientId,
          toName: formatUserDisplay(recipient),
          message: memoMessage.trim(),
          createdAt: now,
          isRead: false
        };
        batch.set(newDocRef, newMemo);
      }
    });

    try {
      await batch.commit();
      setMemoMessage('');
      setMemoRecipients([]);
      setIsMemoModalOpen(false);
      alert('메모를 보냈습니다.');
    } catch (error) {
      console.error("Error sending memos:", error);
      alert('메모 전송 중 오류가 발생했습니다.');
    }
  };

  // Mark memo as read
  const handleMarkMemoRead = async (id: string) => {
    await updateDoc(doc(db, "taskMemos", id), { isRead: true });
  };

  // Delete memo (Soft Delete)
  const handleDeleteMemo = async (id: string) => {
    if (!window.confirm("이 메모를 삭제하시겠습니까?")) return;
    try {
      // Soft delete: Mark as deleted instead of removing document
      await updateDoc(doc(db, "taskMemos", id), { isDeleted: true });
      setSelectedMemo(null); // Close modal if open
    } catch (error) {
      console.error("Error deleting memo:", error);
      alert("메모 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleCellClick = (date: string, deptId: string) => {
    if (!hasPermission('events.create')) {
      // Silent return or alert
      return;
    }
    setSelectedDate(date);
    setSelectedEndDate(date);
    setSelectedDeptId(deptId);
    setSelectedDeptIds([deptId]); // Reset to single
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleRangeSelect = (startDate: string, endDate: string, deptId: string, deptIds?: string[]) => {
    console.log('DEBUG: App handleRangeSelect', { startDate, endDate, deptId, deptIds });
    if (!hasPermission('events.create')) return;
    setSelectedDate(startDate);
    setSelectedEndDate(endDate);
    setSelectedDeptId(deptId);
    setSelectedDeptIds(deptIds || [deptId]); // Set multi-dept if present
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(event.startDate);
    setSelectedEndDate(event.endDate);
    setIsEventModalOpen(true);
  };

  // Quick Add: Click date cell in Yearly View to create new event
  const handleQuickAdd = (date: Date) => {
    if (!hasPermission('events.create')) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setSelectedEndDate(dateStr);
    setEditingEvent(null);
    setSelectedDeptId(departments[0]?.id || ''); // Default to first department
    setIsEventModalOpen(true);
  };

  // Bucket List Handlers
  const handleAddBucketItem = async (title: string, targetMonth: string, priority: 'high' | 'medium' | 'low') => {
    if (!hasPermission('events.create')) return;
    const newItem: BucketItem = {
      id: crypto.randomUUID(),
      title,
      targetMonth,
      priority,
      createdAt: new Date().toISOString(),
      authorId: userProfile?.uid || '',
      authorName: userProfile?.displayName || userProfile?.email || '알 수 없음',
    };
    await setDoc(doc(db, "bucketItems", newItem.id), newItem);
  };

  // Helper: Check if user's role is higher than author's role
  const isHigherRole = (authorId: string | undefined): boolean => {
    if (!userProfile || !authorId) return false;
    const hierarchy = ['master', 'admin', 'manager', 'editor', 'user', 'viewer', 'guest'];
    const author = users.find(u => u.uid === authorId);
    if (!author) return false;
    const myIndex = hierarchy.indexOf(userProfile.role);
    const authorIndex = hierarchy.indexOf(author.role);
    return myIndex < authorIndex; // Lower index = higher role
  };

  // Helper: Check if current user can edit/delete a bucket
  const canModifyBucket = (bucket: BucketItem, action: 'edit' | 'delete'): boolean => {
    if (!userProfile) return false;
    // Master can do everything
    if (userProfile.role === 'master') return true;
    // Author can always modify own bucket
    if (bucket.authorId === userProfile.uid) return true;
    // Check permission for lower roles (consolidated to events.bucket)
    if (hasPermission('events.bucket') && isHigherRole(bucket.authorId)) return true;
    return false;
  };

  const handleDeleteBucketItem = async (id: string) => {
    const bucket = bucketItems.find(b => b.id === id);
    if (!bucket) return;

    if (!canModifyBucket(bucket, 'delete')) {
      alert('삭제 권한이 없습니다. 본인이 작성한 버킷만 삭제할 수 있습니다.');
      return;
    }

    await deleteDoc(doc(db, "bucketItems", id));
  };

  const handleEditBucketItem = async (id: string, title: string, priority: 'high' | 'medium' | 'low') => {
    const bucket = bucketItems.find(b => b.id === id);
    if (!bucket) return;

    if (!canModifyBucket(bucket, 'edit')) {
      alert('수정 권한이 없습니다. 본인이 작성한 버킷만 수정할 수 있습니다.');
      return;
    }

    await updateDoc(doc(db, "bucketItems", id), { title, priority });
  };

  const handleConvertBucketToEvent = (bucket: BucketItem) => {
    // Get first day of target month as default date
    const [year, month] = bucket.targetMonth.split('-').map(Number);
    const targetDate = new Date(year, month - 1, 1);
    const dateStr = format(targetDate, 'yyyy-MM-dd');

    // Set up modal with bucket data
    setSelectedDate(dateStr);
    setSelectedEndDate(dateStr);
    setEditingEvent(null);
    setSelectedDeptId(bucket.departmentId || departments[0]?.id || '');
    setInitialTitle(bucket.title); // Pass bucket title to modal
    setPendingBucketId(bucket.id); // Mark bucket for deletion after save
    setIsEventModalOpen(true);
    // NOTE: Do NOT delete bucket here - wait for save confirmation
  };

  const handleCopyEvent = (event: CalendarEvent) => {
    setEditingEvent(null);
    setTemplateEvent(event);
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (event: CalendarEvent) => {
    try {
      // 0. Auto-Restore from Archive Logic
      if (event.isArchived) {
        // Remove from archive collection first
        await deleteDoc(doc(db, 'archived_events', event.id));
        // Remove the flag so it saves as a normal active event
        delete event.isArchived;
      }

      // Check for recurrence
      const recurrenceCount = (event as any)._recurrenceCount;
      delete (event as any)._recurrenceCount; // Clean up temp property

      // 1. Identify Target Departments
      // Use departmentIds if present and valid, otherwise fallback to single departmentId
      const targetDeptIds = (event.departmentIds && event.departmentIds.length > 0)
        ? event.departmentIds
        : [event.departmentId];

      const isMultiDept = targetDeptIds.length > 1;

      // Handle Batch Creation for Recurrence
      if (recurrenceCount && recurrenceCount > 1 && event.recurrenceType) {
        const MAX_BATCH_SIZE = 499; // Firestore batch limit is 500
        let currentBatch = writeBatch(db);
        let operationCount = 0;

        const baseStart = parseISO(event.startDate);
        const baseEnd = parseISO(event.endDate);
        const duration = differenceInDays(baseEnd, baseStart);
        const seriesGroupId = event.id; // Use first event ID as Recurrence Group ID

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
                currentDate = addDays(currentDate, 1);
                while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
                  currentDate = addDays(currentDate, 1);
                }
                break;
              case 'weekends':
                currentDate = addDays(currentDate, 1);
                while (getDay(currentDate) !== 0 && getDay(currentDate) !== 6) {
                  currentDate = addDays(currentDate, 1);
                }
                break;
              case 'weekly':
                currentDate = addWeeks(baseStart, i);
                break;
              case 'monthly':
                // Fix leap year issue: clamp to end of month if date doesn't exist
                let nextDate = addMonths(baseStart, i);
                if (getDate(baseStart) > 28 && getDate(nextDate) < getDate(baseStart)) {
                  nextDate = endOfMonth(nextDate);
                }
                currentDate = nextDate;
                break;
              case 'yearly':
                currentDate = addYears(baseStart, i);
                break;
            }
          }

          // Generate a unique Related Group ID for THIS instance if multi-dept
          // (This links Dept A's Mon event with Dept B's Mon event)
          const instanceRelatedGroupId = isMultiDept ? `group_${Math.random().toString(36).substr(2, 9)}_${Date.now()}_${i}` : undefined;

          // Determine Base Event ID for this recurrence instance
          const baseEventId = i === 0 ? event.id : `${event.id}_r${i + 1}`;
          const newStartDate = format(currentDate, 'yyyy-MM-dd');
          const newEndDate = format(addDays(currentDate, duration), 'yyyy-MM-dd');

          // Create docs for each department
          for (const deptId of targetDeptIds) {
            // Distinguish ID for secondary departments
            // Primary (event.departmentId) gets the base ID to preserve logic? 
            // Or just make sure they are unique.
            // If we use baseEventId for one and suffix for others, it works.
            const isPrimary = deptId === event.departmentId;
            const finalId = isPrimary ? baseEventId : `${baseEventId}_${deptId}`;

            const recurringEvent: CalendarEvent = {
              ...event,
              id: finalId,
              departmentId: deptId, // Specific context
              departmentIds: targetDeptIds, // Maintain list of all
              startDate: newStartDate,
              endDate: newEndDate,
              recurrenceGroupId: seriesGroupId,
              recurrenceIndex: i + 1,
              relatedGroupId: instanceRelatedGroupId,
            };

            const ref = doc(db, "일정", finalId).withConverter(eventConverter);

            // Check batch size limit and commit if necessary
            if (operationCount >= MAX_BATCH_SIZE) {
              await currentBatch.commit();
              currentBatch = writeBatch(db);
              operationCount = 0;
            }

            currentBatch.set(ref, recurringEvent);
            operationCount++;
            createdCount++;
          }
        }

        // Commit remaining operations
        if (operationCount > 0) {
          await currentBatch.commit();
        }

        alert(`${createdCount}개의 반복 일정이 생성되었습니다.`);

      } else {
        // Single Event Save (Create or Update)
        const batch = writeBatch(db);

        // Check if updating an existing Linked Group
        if (event.relatedGroupId) {
          // Strategy: Query all siblings and update them
          const q = query(
            collection(db, "일정").withConverter(eventConverter),
            where("연결그룹ID", "==", event.relatedGroupId)
          );

          const snapshot = await import('firebase/firestore').then(mod => mod.getDocs(q));

          if (!snapshot.empty) {
            // 1. Update Existing Siblings (and Create Missing Ones if necessary)
            // But 'snapshot' only gives us what exists.
            // We need to ensure we cover ALL targetDeptIds.

            // Map existing siblings by Dept ID for easy lookup
            const existingSiblingsMap = new Map();
            snapshot.forEach(d => {
              const data = d.data();
              existingSiblingsMap.set(data.departmentId, d.id);
            });

            // A. Create or Update for all Target Depts
            for (const deptId of targetDeptIds) {
              const isPrimary = deptId === event.departmentId;
              // Determine ID: If it already exists in group, reuse it. If not, generate new.
              // Note: Reuse ID to preserve history/references if possible.
              let finalId = existingSiblingsMap.get(deptId);
              if (!finalId) {
                finalId = isPrimary ? event.id : `${event.id}_${deptId}`;
              }

              const singleEvent: CalendarEvent = {
                ...event,
                id: finalId,
                departmentId: deptId,
                departmentIds: targetDeptIds,
                relatedGroupId: event.relatedGroupId,
                version: (event.version || 0) + 1 // Increment version for concurrency control
              };

              batch.set(doc(db, "일정", finalId).withConverter(eventConverter), singleEvent);
            }

            // B. Delete Orphans (Siblings that are in DB but NOT in targetDeptIds)
            snapshot.forEach(d => {
              const data = d.data();
              const siblingDeptId = data.departmentId;
              // If this sibling's department is NOT in the new selection, delete it.
              if (!targetDeptIds.includes(siblingDeptId)) {
                batch.delete(doc(db, "일정", d.id));
              }
            });

          } else {
            // Fallback: If group checked but not found (data corruption?), treat as new set.
            // ... (Existing fallback logic)
            // Fallback: If group checked but not found (weird), just save as single or recreate?
            // Treat as new creation of set.
            // (See New Set Logic below)
            // Copy-paste creation logic...
            // 2. Generate Grouping if needed
            let relatedGroupId = event.relatedGroupId;
            if (isMultiDept && !relatedGroupId) {
              relatedGroupId = `group_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
            }

            for (const deptId of targetDeptIds) {
              const isPrimary = deptId === event.departmentId;
              const finalId = isPrimary ? event.id : `${event.id}_${deptId}`;

              const singleEvent: CalendarEvent = {
                ...event,
                id: finalId,
                departmentId: deptId,
                departmentIds: targetDeptIds,
                relatedGroupId: relatedGroupId,
                version: (event.version || 0) + 1 // Increment version for concurrency control
              };

              // Check if we need to DELETE an old ID if we renamed/switched primary? 
              // For now, simpler set.
              batch.set(doc(db, "일정", finalId).withConverter(eventConverter), singleEvent);
            }
          }
        } else {
          // New Single Event (or existing one becoming a group)
          let relatedGroupId = event.relatedGroupId;
          if (isMultiDept && !relatedGroupId) {
            relatedGroupId = `group_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
          }

          const plannedIds: string[] = [];

          for (const deptId of targetDeptIds) {
            const isPrimary = deptId === event.departmentId;
            // Careful: If 'event.id' already has a suffix, adding another is bad.
            // Ideally event.id is clean.
            const finalId = isPrimary ? event.id : `${event.id}_${deptId}`;

            plannedIds.push(finalId);

            const singleEvent: CalendarEvent = {
              ...event,
              id: finalId,
              departmentId: deptId,
              departmentIds: targetDeptIds,
              relatedGroupId: relatedGroupId,
              version: (event.version || 0) + 1 // Increment version for concurrency control
            };

            batch.set(doc(db, "일정", finalId).withConverter(eventConverter), singleEvent);
          }

          // Cleanup: If the original event ID is NOT in the new set (meaning Primary Dept changed), delete it.
          if (!plannedIds.includes(event.id)) {
            if (event.createdAt) {
              batch.delete(doc(db, "일정", event.id));
            }
          }
        }

        await batch.commit();
        // Silent success for single saves updates, or alert if preferred
      }

      // If converting from bucket, delete the bucket now after successful save
      if (pendingBucketId) {
        await handleDeleteBucketItem(pendingBucketId);
        setPendingBucketId(null);
        setInitialTitle('');
      }
    } catch (e) {
      console.error("Error saving event: ", e);
      alert("일정 저장 실패");
      // Reset pending bucket on error too
      setPendingBucketId(null);
      setInitialTitle('');
    }
  };

  const handleDeleteEvent = async (id: string, event?: CalendarEvent) => {
    try {
      const batch = writeBatch(db);
      let deleteCount = 0;

      // Helper to delete a linked group for a single event instance
      const deleteLinkedGroup = async (evt: CalendarEvent, existingBatch: any) => {
        if (evt.relatedGroupId) {
          const q = query(
            collection(db, "일정").withConverter(eventConverter),
            where("연결그룹ID", "==", evt.relatedGroupId)
          );
          const snapshot = await import('firebase/firestore').then(mod => mod.getDocs(q));
          snapshot.forEach(d => {
            existingBatch.delete(doc(db, "일정", d.id));
            deleteCount++;
          });
        } else {
          existingBatch.delete(doc(db, "일정", evt.id));
          deleteCount++;
        }
      };

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
          // Note: Since RecurrenceGroupId is shared across Depts, this catches ALL dept copies too.
          const toDelete = events.filter(
            e => e.recurrenceGroupId === groupId && (e.recurrenceIndex || 0) >= currentIndex
          );

          toDelete.forEach(e => {
            batch.delete(doc(db, "일정", e.id));
            deleteCount++;
          });

          await batch.commit();
          alert(`${deleteCount}개의 반복 일정이 삭제되었습니다.`);
        } else {
          // Delete only this event (and its linked siblings)
          if (event.relatedGroupId) {
            const deleteLinked = window.confirm("해당 일정은 다른 부서와 연동되어 있습니다.\n\n[확인]: 연동된 모든 부서의 일정 삭제\n[취소]: 현재 부서의 일정만 삭제");
            if (deleteLinked) {
              await deleteLinkedGroup(event, batch);
            } else {
              batch.delete(doc(db, "일정", event.id));
            }
          } else {
            await deleteLinkedGroup(event, batch);
          }
          await batch.commit();
        }
      } else {
        // Regular single event delete (and siblings)
        if (event) {
          if (event.relatedGroupId) {
            const deleteLinked = window.confirm("해당 일정은 다른 부서와 연동되어 있습니다.\n\n[확인]: 연동된 모든 부서의 일정 삭제\n[취소]: 현재 부서의 일정만 삭제");
            if (deleteLinked) {
              await deleteLinkedGroup(event, batch);
            } else {
              batch.delete(doc(db, "일정", event.id));
            }
          } else {
            await deleteLinkedGroup(event, batch);
          }
        } else {
          // Fallback if event object missing (rare)
          batch.delete(doc(db, "일정", id));
        }
        await batch.commit();
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
    const canEdit = hasPermission(isAuthor ? 'events.manage_own' : 'events.manage_others');
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
      let totalCount = 0;
      for (const move of pendingEventMoves) {
        await handleSaveEvent(move.updated);
        // Count linked events if present, otherwise 1
        totalCount += (move.updated.departmentIds?.length || 1);
      }
      setPendingEventMoves([]);
      alert(`${totalCount}개의 일정이 이동되었습니다.`);
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
    if (userProfile.role === 'master' || userProfile.role === 'admin') return true;
    if (hasPermission('departments.manage')) return true;
    const permission = userProfile.departmentPermissions?.[deptId];
    return permission === 'edit';
  };

  // Fetch Gantt Projects for Calendar Integration (Phase 7.3)
  const { data: ganttProjects = [] } = useGanttProjects(userProfile?.uid);
  const ganttCalendarEvents = useMemo(() =>
    convertGanttProjectsToCalendarEvents(ganttProjects),
    [ganttProjects]);

  // Compute display events (apply pending moves for preview) + Merge Gantt Events
  const displayEvents = useMemo(() => {
    const calendarEventsWithMoves = events.map(event => {
      const pendingMove = pendingEventMoves.find(m => m.original.id === event.id);
      return pendingMove ? pendingMove.updated : event;
    });
    return [...calendarEventsWithMoves, ...ganttCalendarEvents];
  }, [events, pendingEventMoves, ganttCalendarEvents]);

  const pendingEventIds = pendingEventMoves.map(m => m.original.id);

  // Initial Loading Screen (Waiting for Auth or Tab Permissions or appMode initialization)
  // This prevents flashing of unauthorized content before we know which tab user can access.
  if (authLoading || (currentUser && isTabPermissionLoading) || (currentUser && appMode === null)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f9fa] flex-col gap-4">
        {/* Simple Spinner */}
        <div className="w-8 h-8 border-4 border-[#081429] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium">사용자 정보를 불러오는 중...</p>
      </div>
    );
  }

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

            {/* Top-level App Mode Tabs - Grouped Navigation */}
            <div className="hidden md:flex ml-4">
              <NavigationBar
                currentTab={appMode}
                accessibleTabs={accessibleTabs}
                onTabSelect={(tab) => setAppMode(tab as typeof appMode)}
              />
            </div>

            {/* User Info Display (Moved to Left) */}
            {currentUser && (
              <div className="hidden md:flex flex-row items-center gap-1.5 ml-4 pl-4 border-l border-white/10 overflow-hidden">
                {/* Role Badge */}
                {userProfile?.role && userProfile.role !== 'guest' && (
                  <span className={`text-white text-micro px-1 py-0.5 rounded font-black tracking-tighter shadow-sm ${userProfile.role === 'master' ? 'bg-red-600' :
                    userProfile.role === 'admin' ? 'bg-indigo-600' :
                      userProfile.role === 'manager' ? 'bg-purple-600' :
                        userProfile.role === 'editor' ? 'bg-blue-600' :
                          userProfile.role === 'math_lead' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                            userProfile.role === 'english_lead' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                              userProfile.role === 'math_teacher' ? 'bg-green-500' :
                                userProfile.role === 'english_teacher' ? 'bg-orange-500' :
                                  userProfile.role === 'user' ? 'bg-gray-500' :
                                    userProfile.role === 'viewer' ? 'bg-yellow-600' : 'bg-gray-400'
                    }`}>
                    {ROLE_LABELS[userProfile.role] || userProfile.role.toUpperCase()}
                  </span>
                )}
                {/* Name */}
                <span className="text-xs font-bold text-white whitespace-nowrap">
                  {(userProfile?.email || currentUser?.email)?.split('@')[0]}
                </span>
                {/* Job Title Badge */}
                <span className={`text-xxs px-1.5 py-0.5 rounded flex items-center justify-center font-bold tracking-tight whitespace-nowrap ${getJobTitleStyle(userProfile?.jobTitle)}`}>
                  {userProfile?.jobTitle || '직급 미설정'}
                </span>
              </div>
            )}
          </div>


          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-3 w-[250px]">

            {/* 일정 추가 버튼: 일정 탭의 연간 뷰에서만 표시 */}
            {appMode === 'calendar' && viewMode === 'yearly' && (
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
                className="h-7 px-2 bg-[#fdb813] text-[#081429] rounded hover:brightness-110 flex-shrink-0 flex items-center justify-center gap-1 font-bold shadow-sm transition-all active:scale-95 text-xs whitespace-nowrap"
              >
                <Plus size={14} /> <span className="hidden lg:inline">일정 추가</span>
              </button>
            )}

            {hasPermission('settings.access') && (
              <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-white transition-colors">
                <Settings size={20} />
              </button>
            )}
            <button onClick={() => window.print()} className="text-gray-400 hover:text-white transition-colors">
              <Printer size={20} />
            </button>

            {/* Memo Notification Bell */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setIsMemoDropdownOpen(!isMemoDropdownOpen)}
                  className={`relative transition-colors mt-[5px] ${isMemoDropdownOpen ? 'text-[#fdb813]' : 'text-gray-400 hover:text-white'}`}
                >
                  <Bell size={20} />
                  {unreadMemoCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-xxs font-bold rounded-full flex items-center justify-center">
                      {unreadMemoCount}
                    </span>
                  )}
                </button>

                {isMemoDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[99998]" onClick={() => setIsMemoDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-[99999] overflow-hidden">
                      <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <span className="font-bold text-gray-700 text-sm flex items-center gap-2">
                          <Mail size={14} /> 받은 메모
                        </span>
                        <button
                          onClick={() => { setIsMemoModalOpen(true); setIsMemoDropdownOpen(false); }}
                          className="text-xs px-2 py-1 bg-[#081429] text-white rounded font-bold hover:brightness-125"
                        >
                          + 새 메모
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {taskMemos.length === 0 ? (
                          <div className="p-6 text-center text-gray-400 text-sm">받은 메모가 없습니다</div>
                        ) : (
                          taskMemos.map(memo => (
                            <div
                              key={memo.id}
                              className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${!memo.isRead ? 'bg-blue-50/50' : ''}`}
                              onClick={() => {
                                setSelectedMemo(memo);
                                setIsMemoDropdownOpen(false);
                                handleMarkMemoRead(memo.id);
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800 text-sm">{memo.fromName}</span>
                                    {!memo.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                                  </div>
                                  <p className="text-gray-600 text-xs mt-1 line-clamp-2">{memo.message}</p>
                                  <span className="text-gray-400 text-xxs mt-1 block">
                                    {new Date(memo.createdAt).toLocaleString('ko-KR')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Profile Dropdown */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className={`transition-colors mt-[5px] ${isProfileMenuOpen ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <UserIcon size={20} />
                </button>


              </div>
            )}
          </div>
        </div>

        {/* Row 2: Filter Bar (Slate) - Only show in calendar mode */}
        {
          appMode === 'calendar' && (
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
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      className={`
                    px-2 py-0.5 rounded-md text-xs font-bold transition-all
                    ${viewMode === m
                          ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }
                  `}
                    >
                      {m === 'daily' && '일간'}
                      {m === 'weekly' && '주간'}
                      {m === 'monthly' && '월간'}
                      {m === 'yearly' && '연간'}
                    </button>
                  ))}
                </div>

                {/* Column View Toggle (1단/2단/3단) */}
                <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5">
                  {([1, 2, 3] as const)
                    .filter(cols => viewMode !== 'yearly' || cols !== 3)
                    .map((cols) => (
                      <button
                        key={cols}
                        onClick={() => setViewColumns(cols)}
                        className={`
                       px-2 py-0.5 rounded-md text-xs font-bold transition-all
                       ${viewColumns === cols
                            ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }
                     `}
                      >
                        {cols}단
                      </button>
                    ))}
                </div>

              </div>
            </div>
          )
        }

        {/* Row 3: Attendance Navigation Bar - Only show in attendance mode */}
        {appMode === 'attendance' && (() => {
          const isMasterOrAdmin = userProfile?.role === 'master' || userProfile?.role === 'admin';
          const canManageMath = hasPermission('attendance.manage_math');
          const canManageEnglish = hasPermission('attendance.manage_english');
          const canManageCurrentSubject = isMasterOrAdmin ||
            (attendanceSubject === 'math' && canManageMath) ||
            (attendanceSubject === 'english' && canManageEnglish);

          // Available teachers for filter dropdown
          const availableTeachers = canManageCurrentSubject
            ? teachers.filter(t => {
              if (attendanceSubject === 'math') return t.subjects?.includes('math');
              if (attendanceSubject === 'english') return t.subjects?.includes('english');
              return true;
            })
            : [];

          // Determine user's teacherId for filtering
          const currentTeacherId = userProfile?.teacherId
            ? teachers.find(t => t.id === userProfile.teacherId)?.name
            : undefined;

          // Determine which teacherId to filter by
          const filterTeacherId = canManageCurrentSubject
            ? (availableTeachers.some(t => t.name === attendanceTeacherId) && attendanceTeacherId) ||
            (availableTeachers.length > 0 ? availableTeachers[0].name : undefined)
            : currentTeacherId;

          // Month navigation functions
          const changeMonth = (delta: number) => {
            setAttendanceDate(prev => {
              const newDate = new Date(prev);
              newDate.setMonth(newDate.getMonth() + delta);
              return newDate;
            });
          };

          return (
            <div className="bg-[#081429] h-10 flex items-center justify-between px-6 border-b border-white/10 text-xs z-30">
              <div className="flex items-center gap-3">
                {/* Subject Toggle */}
                <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
                  {(canManageMath || isMasterOrAdmin) && (
                    <button
                      onClick={() => setAttendanceSubject('math')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${attendanceSubject === 'math'
                        ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      📐 수학
                    </button>
                  )}
                  {(canManageEnglish || isMasterOrAdmin) && (
                    <button
                      onClick={() => setAttendanceSubject('english')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${attendanceSubject === 'english'
                        ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      📕 영어
                    </button>
                  )}
                </div>

                {/* Teacher Filter */}
                {canManageCurrentSubject && availableTeachers.length > 0 && (
                  <div className="relative">
                    <select
                      value={filterTeacherId || ''}
                      onChange={(e) => setAttendanceTeacherId(e.target.value || undefined)}
                      className="appearance-none bg-[#1e293b] border border-gray-700 rounded-md px-3 py-1 pr-7 text-xs font-medium text-white cursor-pointer hover:border-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                    >
                      {availableTeachers.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                )}

                {/* Separator */}
                <div className="w-px h-4 bg-white/20 mx-1"></div>

                {/* Month Navigation */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="p-1 border border-gray-700 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-2 font-bold text-white text-xs min-w-[100px] text-center">
                    {attendanceDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                  </span>
                  <button
                    onClick={() => changeMonth(1)}
                    className="p-1 border border-gray-700 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-white/20 mx-1"></div>

                {/* Add Student Button (Special Attendance) */}
                <button
                  onClick={() => setIsAttendanceAddStudentModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm ml-2"
                  title="특강/보강 학생 출석부 추가"
                >
                  <UserPlus size={14} />
                  <span className="font-bold text-xs">학생 추가</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Row 4: Students Navigation Bar - Only show in students mode */}
        {appMode === 'students' && (
          <div className="bg-[#081429] h-10 flex items-center justify-between px-6 border-b border-white/10 text-xs z-30">
            <div className="flex items-center gap-3 flex-1">
              {/* Subject Toggle */}
              <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
                <button
                  onClick={() => setStudentFilters(prev => ({ ...prev, subject: 'all' }))}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${studentFilters.subject === 'all' ? 'bg-[#fdb813] text-[#081429] shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  📚 전체
                </button>
                <button
                  onClick={() => setStudentFilters(prev => ({ ...prev, subject: 'math' }))}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${studentFilters.subject === 'math' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  수학
                </button>
                <button
                  onClick={() => setStudentFilters(prev => ({ ...prev, subject: 'english' }))}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${studentFilters.subject === 'english' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  영어
                </button>
              </div>

              {/* Status Toggle */}
              <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
                <button
                  onClick={() => setStudentFilters(prev => ({ ...prev, status: 'all' }))}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${studentFilters.status === 'all' ? 'bg-[#fdb813] text-[#081429] shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  전체
                </button>
                <button
                  onClick={() => setStudentFilters(prev => ({ ...prev, status: 'active' }))}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${studentFilters.status === 'active' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  재원
                </button>
                <button
                  onClick={() => setStudentFilters(prev => ({ ...prev, status: 'on_hold' }))}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${studentFilters.status === 'on_hold' ? 'bg-yellow-500 text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  대기
                </button>
                <button
                  onClick={() => setStudentFilters(prev => ({ ...prev, status: 'withdrawn' }))}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${studentFilters.status === 'withdrawn' ? 'bg-gray-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  퇴원
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="이름, 학교 검색..."
                  value={studentFilters.searchQuery}
                  onChange={(e) => setStudentFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                  className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-[#fdb813]/50 focus:border-[#fdb813]/50"
                />
                {studentFilters.searchQuery && (
                  <button
                    onClick={() => setStudentFilters(prev => ({ ...prev, searchQuery: '' }))}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Grade Filter */}
              <select
                value={studentFilters.grade}
                onChange={(e) => setStudentFilters(prev => ({ ...prev, grade: e.target.value }))}
                className="px-2 py-1.5 bg-white/10 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#fdb813]/50 cursor-pointer"
              >
                <option value="all" className="bg-[#081429]">학년</option>
                <option value="초1" className="bg-[#081429]">초1</option>
                <option value="초2" className="bg-[#081429]">초2</option>
                <option value="초3" className="bg-[#081429]">초3</option>
                <option value="초4" className="bg-[#081429]">초4</option>
                <option value="초5" className="bg-[#081429]">초5</option>
                <option value="초6" className="bg-[#081429]">초6</option>
                <option value="중1" className="bg-[#081429]">중1</option>
                <option value="중2" className="bg-[#081429]">중2</option>
                <option value="중3" className="bg-[#081429]">중3</option>
                <option value="고1" className="bg-[#081429]">고1</option>
                <option value="고2" className="bg-[#081429]">고2</option>
                <option value="고3" className="bg-[#081429]">고3</option>
              </select>

              {/* Sort */}
              <select
                value={studentSortBy}
                onChange={(e) => setStudentSortBy(e.target.value as typeof studentSortBy)}
                className="px-2 py-1.5 bg-white/10 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#fdb813]/50 cursor-pointer"
              >
                <option value="name" className="bg-[#081429]">이름순</option>
                <option value="grade" className="bg-[#081429]">학년순</option>
                <option value="startDate" className="bg-[#081429]">등록일순</option>
              </select>

              {/* Reset Filters */}
              {(studentFilters.searchQuery || studentFilters.grade !== 'all' || studentFilters.status !== 'all' || studentFilters.subject !== 'all') && (
                <button
                  onClick={() => {
                    setStudentFilters({ searchQuery: '', grade: 'all', status: 'all', subject: 'all' });
                    setStudentSortBy('name');
                  }}
                  className="px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                >
                  초기화
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter Popover Panel */}
        {
          appMode === 'calendar' && isFilterOpen && (
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
          )
        }

        {/* Row 2: Timetable Filter Bar - Only show in timetable mode */}
        {
          appMode === 'timetable' && (
            <div className="bg-[#1e293b] h-10 flex items-center px-4 md:px-6 border-b border-gray-700 relative z-40 text-xs">
              {/* Main Filter Toggle - Only show for Math */}
              {/* Main Filter Toggle - Only show for Math */
                /* Removed Global Option Settings Button */
              }

              {/* Current Settings Summary - Clickable Toggles */}
              <div className="flex items-center gap-2 px-4 overflow-hidden flex-1">
                {/* Subject Toggle Button */}
                {hasPermission('timetable.math.view') && hasPermission('timetable.english.view') ? (
                  <button
                    onClick={() => setTimetableSubject(prev => prev === 'math' ? 'english' : 'math')}
                    className="px-2 py-0.5 rounded bg-[#fdb813] text-[#081429] font-bold text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    title="클릭하여 과목 전환"
                  >
                    {timetableSubject === 'math' ? '📐 수학' : '📕 영어'}
                  </button>
                ) : (
                  <div className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 font-bold text-xs">
                    {timetableSubject === 'math' ? '📐 수학' : '📕 영어'}
                  </div>
                )}

                {/* View Type Toggle Button */}
                <button
                  onClick={() => {
                    if (timetableSubject === 'math') {
                      // 수학: 강사별 ↔ 교실별
                      setTimetableViewType(prev => prev === 'teacher' ? 'room' : 'teacher');
                    } else {
                      // 영어: 통합 → 강사별 → 교실별 → 통합 (권한 없으면 통합 스킵)
                      const canViewIntegrated = hasPermission('timetable.integrated.view');
                      setTimetableViewType(prev => {
                        if (prev === 'class') return 'teacher';
                        if (prev === 'teacher') return 'room';
                        // room -> integrated (if permitted) or teacher
                        return canViewIntegrated ? 'class' : 'teacher';
                      });
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-[#081429] border border-gray-700 text-gray-300 font-bold text-xs hover:bg-gray-700 active:scale-95 transition-all cursor-pointer"
                  title="클릭하여 보기방식 전환"
                >
                  {timetableViewType === 'teacher' ? '👨‍🏫 강사별' : (timetableViewType === 'class' ? '📋 통합' : '🏫 교실별')}
                </button>

                {/* Removed Summary Indicators */}


              </div>
            </div>
          )
        }

        {/* Timetable Filter Popover Panel Removed */}

        {/* Row 2: Grades Filter Bar - Only show in grades mode */}
        {appMode === 'grades' && (
          <div className="bg-[#1e293b] h-10 flex items-center px-4 md:px-6 border-b border-gray-700 relative z-40 text-xs">
            <div className="flex items-center gap-4 flex-1">
              {/* Subject Filter Toggle */}
              <div className="flex items-center gap-1 bg-black/20 rounded-lg p-0.5">
                {(['all', 'math', 'english'] as const).map(subject => (
                  <button
                    key={subject}
                    onClick={() => setGradesSubjectFilter(subject)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${gradesSubjectFilter === subject
                      ? 'bg-[#fdb813] text-[#081429]'
                      : 'text-gray-400 hover:text-white'
                      }`}
                  >
                    {subject === 'all' ? '전체' : subject === 'math' ? '수학' : '영어'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header >

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Render Gating: If permission fails, show nothing (Redirect will happen in useEffect) */}
        {!canAccessTab(appMode) ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            {/* Optional: "Not Authorized" message or just blank while redirecting */}
            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : appMode === 'calendar' ? (
          /* Calendar View */
          <div className="w-full flex-1 max-w-full mx-auto h-full print:p-0 flex flex-col xl:flex-row gap-4 print:flex-row print:gap-2">
            {/* 1단: 현재 년도 (항상 표시) */}
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
                onViewChange={setViewMode}
                showSidePanel={viewColumns === 1} // Only show detail side panel in single column mode
                onQuickAdd={handleQuickAdd}
                bucketItems={bucketItems}
                onAddBucket={handleAddBucketItem}
                onEditBucket={handleEditBucketItem}
                onDeleteBucket={handleDeleteBucketItem}
                onConvertBucket={handleConvertBucketToEvent}
                showArchived={showArchived} // Phase 9
              />
            </div>

            {/* 2단: 1년 전 (viewColumns >= 2 일 때 표시) */}
            <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0 transition-all duration-300 ${viewColumns >= 2 ? '' : 'hidden'}`}>
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
                isPrimaryView={false} // Hide My Events
                onViewChange={setViewMode}
                showSidePanel={false} // Always hide side panel for comparison views
                currentUser={userProfile}
                showArchived={showArchived} // Phase 9
              />
            </div>

            {/* 3단: 2년 전 (viewColumns >= 3 일 때 표시) */}
            <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0 transition-all duration-300 ${viewColumns >= 3 ? '' : 'hidden'}`}>
              <CalendarBoard
                currentDate={thirdDate}
                onDateChange={(date) => setBaseDate(addYears(date, 2))}
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
                isPrimaryView={false} // Hide My Events
                onViewChange={setViewMode}
                showSidePanel={false}
                currentUser={userProfile}
                showArchived={showArchived} // Phase 9
              />
            </div>
          </div>
        ) : appMode === 'timetable' ? (
          /* Timetable View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 p-4 md:p-6">
              <TimetableManager
                subjectTab={timetableSubject}
                onSubjectChange={setTimetableSubject}
                viewType={timetableViewType}
                onViewTypeChange={setTimetableViewType}
                currentUser={userProfile}
                /* Removed global state props */
                teachers={teachers}
                classKeywords={classKeywords}
              />
            </div>
          </Suspense>
        ) : appMode === 'payment' ? (
          /* Payment Report View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto">
              <PaymentReport />
            </div>
          </Suspense>
        ) : appMode === 'gantt' ? (
          /* Gantt Chart View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto bg-[#f8f9fa]">
              <GanttManager userProfile={userProfile} allUsers={users} />
            </div>
          </Suspense>
        ) : appMode === 'consultation' ? (
          /* Consultation Manager View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto">
              <ConsultationManager userProfile={userProfile} />
            </div>
          </Suspense>
        ) : appMode === 'attendance' ? (
          /* Attendance Manager View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 flex flex-col overflow-hidden">
              <AttendanceManager
                userProfile={userProfile}
                teachers={teachers}
                selectedSubject={attendanceSubject}
                selectedTeacherId={attendanceTeacherId}
                currentDate={attendanceDate}
                isAddStudentModalOpen={isAttendanceAddStudentModalOpen}
                onCloseAddStudentModal={() => setIsAttendanceAddStudentModalOpen(false)}
              />
            </div>
          </Suspense>
        ) : appMode === 'students' ? (
          /* Student Management View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto">
              <StudentManagementTab
                filters={studentFilters}
                sortBy={studentSortBy}
              />
            </div>
          </Suspense>
        ) : appMode === 'grades' ? (
          /* Grades Management View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto">
              <GradesManager
                subjectFilter={gradesSubjectFilter}
                searchQuery={gradesSearchQuery}
                onSearchChange={setGradesSearchQuery}
              />
            </div>
          </Suspense>
        ) : appMode === 'classes' ? (
          /* Class Management View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto">
              <ClassManagementTab />
            </div>
          </Suspense>
        ) : appMode === 'student-consultations' ? (
          /* Student Consultation Management View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto">
              <ConsultationManagementTab />
            </div>
          </Suspense>
        ) : appMode === 'billing' ? (
          /* Billing Management View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto">
              <BillingManager userProfile={userProfile} />
            </div>
          </Suspense>
        ) : appMode === 'daily-attendance' ? (
          /* Daily Attendance Management View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto">
              <DailyAttendanceManager userProfile={userProfile} />
            </div>
          </Suspense>
        ) : appMode === 'staff' ? (
          /* Staff Management View */
          <Suspense fallback={<TabLoadingFallback />}>
            <div className="w-full flex-1 overflow-auto">
              <StaffManager userProfile={userProfile} />
            </div>
          </Suspense>
        ) : null}

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

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        canClose={false} // Prevent closing without login when forced
      />

      {/* Profile Dropdown Menu (Moved to Root to avoid z-index trap) */}
      {
        isProfileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-[99998]"
              onClick={() => setIsProfileMenuOpen(false)}
            />
            <div
              className="fixed right-4 top-16 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[99999] overflow-hidden text-sm"
              style={{ display: isProfileMenuOpen ? 'block' : 'none' }}
            >
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <p className="font-bold text-gray-800">{userProfile?.email?.split('@')[0]}</p>
                <p className="text-xs text-gray-500 mt-0.5">{userProfile?.jobTitle || '직급 미설정'}</p>
                <p className="text-xs text-blue-600 font-medium mt-1">{ROLE_LABELS[userProfile?.role || 'guest']}</p>
              </div>
              <button
                onClick={() => {
                  setIsPermissionViewOpen(true);
                  setIsProfileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors border-b border-gray-100"
              >
                <Eye size={16} /> 권한 보기
              </button>
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
        )
      }

      {/* Permission View Modal */}
      {
        isPermissionViewOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-[99998]"
              onClick={() => setIsPermissionViewOpen(false)}
            />
            <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] md:max-h-[80vh] bg-white rounded-2xl shadow-2xl z-[99999] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Eye size={18} /> 내 권한
                </h3>
                <button onClick={() => setIsPermissionViewOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 text-sm">
                {/* Role Info */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-blue-800 font-bold">역할: {ROLE_LABELS[userProfile?.role || 'guest']}</p>
                  {userProfile?.role === 'master' && (
                    <p className="text-blue-600 text-xs mt-1">Master는 모든 권한을 보유합니다.</p>
                  )}
                </div>

                {/* Tab Permissions */}
                <div className="mb-4">
                  <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                    📋 허용된 탭
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {accessibleTabs.map(tab => (
                      <span key={tab} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        {tab === 'calendar' && '📅 연간 일정'}
                        {tab === 'timetable' && '📚 시간표'}
                        {tab === 'payment' && '💳 전자 결재'}
                        {tab === 'gantt' && '📊 간트 차트'}
                        {tab === 'consultation' && '💬 상담'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Role Permissions */}
                {userProfile?.role !== 'master' && (
                  <div>
                    <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                      ✅ 허용된 권한
                    </h4>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {(() => {
                        const userPerms = rolePermissions[userProfile?.role as keyof typeof rolePermissions] || {};
                        const enabledPerms = Object.entries(userPerms).filter(([, v]) => v);
                        if (enabledPerms.length === 0) {
                          return <p className="text-gray-400 text-xs">설정된 권한이 없습니다.</p>;
                        }
                        const permLabels: Record<string, string> = {
                          'events.create': '일정 생성',
                          'events.manage_own': '본인 일정 관리',
                          'events.manage_others': '타인 일정 관리',
                          'events.drag_move': '일정 드래그 이동',
                          'events.attendance': '참가 현황 변경',
                          'events.bucket': '버킷리스트',
                          'departments.view_all': '모든 부서 조회',
                          'departments.manage': '부서 관리',
                          'users.view': '사용자 목록 조회',
                          'users.approve': '사용자 승인',
                          'users.change_role': '역할 변경',
                          'users.change_permissions': '세부 권한 변경',
                          'settings.access': '설정 접근',
                          'settings.holidays': '공휴일 관리',
                          'settings.role_permissions': '역할 권한 설정',
                          'settings.manage_categories': '카테고리 관리',
                          'system.teachers.view': '강사 목록 조회',
                          'system.teachers.edit': '강사 수정',
                          'system.classes.view': '수업 목록 조회',
                          'system.classes.edit': '수업 수정',
                          'timetable.math.view': '수학 시간표 조회',
                          'timetable.math.edit': '수학 시간표 수정',
                          'timetable.english.view': '영어 시간표 조회',
                          'timetable.english.edit': '영어 시간표 수정',
                          'timetable.english.simulation': '영어 시뮬레이션',
                          'timetable.english.backup.view': '백업 조회',
                          'timetable.english.backup.restore': '백업 복원',
                          'timetable.integrated.view': '통합 시간표 조회',
                          'gantt.view': '간트 조회',
                          'gantt.create': '간트 생성',
                          'gantt.edit': '간트 수정',
                          'gantt.delete': '간트 삭제',
                          'attendance.manage_own': '본인 출석부 관리',
                          'attendance.edit_all': '전체 출석 수정',
                          'attendance.manage_math': '수학 출석부 관리',
                          'attendance.manage_english': '영어 출석부 관리',
                        };
                        return enabledPerms.map(([permId]) => (
                          <div key={permId} className="flex items-center gap-2 text-xs text-gray-600 py-1">
                            <span className="w-4 h-4 bg-green-500 text-white rounded flex items-center justify-center text-xxs">✓</span>
                            {permLabels[permId] || permId}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )
      }

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => { setIsEventModalOpen(false); setInitialTitle(''); setPendingBucketId(null); setTemplateEvent(null); }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialDate={selectedDate}
        initialEndDate={selectedEndDate}
        initialDepartmentId={selectedDeptId}
        initialDepartmentIds={selectedDeptIds} // Pass multi-select
        initialStartTime={initialStartTime}
        initialEndTime={initialEndTime}
        initialTitle={initialTitle}
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
        onCopy={handleCopyEvent}
        templateEvent={templateEvent}
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
        teachers={teachers}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived(!showArchived)}
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

      {/* Memo Send Modal */}
      {
        isMemoModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-xl shadow-2xl w-[400px] max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Send size={16} /> 메모 보내기
                </h3>
                <button onClick={() => setIsMemoModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">받는 사람</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {users
                      .filter(u => u.uid !== currentUser?.uid)
                      .sort((a, b) => {
                        const isASel = memoRecipients.includes(a.uid);
                        const isBSel = memoRecipients.includes(b.uid);
                        if (isASel && !isBSel) return -1;
                        if (!isASel && isBSel) return 1;
                        return formatUserDisplay(a).localeCompare(formatUserDisplay(b));
                      })
                      .map(u => {
                        const isSelected = memoRecipients.includes(u.uid);
                        return (
                          <label key={u.uid} className={`flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 ${isSelected ? 'bg-blue-50' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMemoRecipients(prev => [...prev, u.uid]);
                                } else {
                                  setMemoRecipients(prev => prev.filter(id => id !== u.uid));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 accent-[#081429]"
                            />
                            <span className="text-sm text-gray-700">{formatUserDisplay(u)}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">메모 내용</label>
                  <textarea
                    value={memoMessage}
                    onChange={(e) => setMemoMessage(e.target.value)}
                    placeholder="예: 오늘 회의 일정 만들어주세요"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#fdb813] outline-none resize-none h-24"
                  />
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                <button
                  onClick={() => setIsMemoModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold"
                >
                  취소
                </button>
                <button
                  onClick={handleSendMemo}
                  disabled={memoRecipients.length === 0 || !memoMessage.trim()}
                  className="px-4 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send size={14} /> 보내기 ({memoRecipients.length}명)
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Memo Detail Modal */}
      {
        selectedMemo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Mail size={16} /> 받은 메모
                </h3>
                <button onClick={() => setSelectedMemo(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <span className="text-xs font-bold text-gray-500 block mb-1">보낸 사람</span>
                  <div className="text-gray-800 font-bold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <UserIcon size={16} />
                    </div>
                    {selectedMemo.fromName}
                  </div>
                </div>
                <div className="mb-6">
                  <span className="text-xs font-bold text-gray-500 block mb-1">내용</span>
                  <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm whitespace-pre-wrap leading-relaxed border border-gray-100">
                    {selectedMemo.message}
                  </div>
                  <div className="text-right mt-2 text-xs text-gray-400">
                    {new Date(selectedMemo.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleDeleteMemo(selectedMemo.id)}
                    className="mr-auto px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-2"
                  >
                    <Trash2 size={14} /> 삭제
                  </button>
                  <button
                    onClick={() => {
                      handleMarkMemoRead(selectedMemo.id);
                      setSelectedMemo(null);
                    }}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50"
                  >
                    확인 (닫기)
                  </button>
                  <button
                    onClick={() => {
                      setMemoRecipients([selectedMemo.from]); // Set recipient to sender
                      setIsMemoModalOpen(true); // Open send modal
                      setSelectedMemo(null); // Close detail modal
                      handleMarkMemoRead(selectedMemo.id); // Mark as read
                    }}
                    className="px-4 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:brightness-125 flex items-center gap-2"
                  >
                    <Send size={14} /> 답장하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default App;
