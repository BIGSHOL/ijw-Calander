import React, { useState, useEffect, useRef } from 'react';
import { addYears, subYears, format, isToday, isPast, isFuture, parseISO, startOfDay } from 'date-fns';
import { CalendarEvent, Department, UserProfile } from './types';
import { INITIAL_DEPARTMENTS } from './constants';
import EventModal from './components/EventModal';
import SettingsModal from './components/SettingsModal';
import LoginModal from './components/LoginModal';
import CalendarBoard from './components/CalendarBoard';
import { Settings, Printer, Plus, Eye, EyeOff, LayoutGrid, Calendar as CalendarIcon, List, CheckCircle2, XCircle, LogOut, LogIn, UserCircle, Lock as LockIcon, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { db, auth } from './firebaseConfig';
import { collection, onSnapshot, setDoc, doc, deleteDoc, writeBatch, query, orderBy, where, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

type ViewMode = 'daily' | 'weekly' | 'monthly';

// Firestore Converters for Korean Localization
const departmentConverter = {
  toFirestore: (dept: Department) => {
    return {
      부서명: dept.name,
      순서: dept.order,
      색상: dept.color
    };
  },
  fromFirestore: (snapshot: any, options: any) => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      name: data.부서명,
      order: data.순서,
      color: data.색상
    } as Department;
  }
};

const eventConverter = {
  toFirestore: (event: CalendarEvent) => {
    return {
      제목: event.title,
      상세내용: event.description || '',
      참가자: event.participants || '',
      부서ID: event.departmentId,
      시작일: event.startDate,
      종료일: event.endDate,
      시작시간: event.startTime || '',
      종료시간: event.endTime || '',
      하루종일: event.isAllDay || false,
      색상: event.color
    };
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
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [baseDate, setBaseDate] = useState(new Date());
  const rightDate = subYears(baseDate, 1);

  // Firestore Data State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Local Settings
  const [hiddenDeptIds, setHiddenDeptIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('dept_hidden_ids');
    return saved ? JSON.parse(saved) : [];
  });

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEndDate, setSelectedEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [initialStartTime, setInitialStartTime] = useState('');
  const [initialEndTime, setInitialEndTime] = useState('');

  // UI State for New Header
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;

            // Critical Fix: Force Master Role for specific email if not set
            if (user.email === 'st2000423@gmail.com' && userData.role !== 'master') {
              console.log("Auto-promoting master account...");
              const updatedProfile: UserProfile = {
                ...userData,
                role: 'master',
                status: 'approved',
                canEdit: true
              };
              await setDoc(userDocRef, updatedProfile);
              setUserProfile(updatedProfile);
            } else {
              setUserProfile(userData);
            }
          } else {
            // ... existing fallback ...
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
              setUserProfile(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUserProfile(null);
        setIsLoginModalOpen(true); // Force open login modal
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
    return () => unsubscribe();
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
  const canEdit = isMaster || userProfile?.canEdit === true;

  // Filter Departments based on RBAC AND Local Toggles
  const visibleDepartments = departments.filter(d => {
    // 1. RBAC Check
    let allowed = false;
    if (isMaster) allowed = true;
    else if (userProfile?.allowedDepartments?.includes(d.id)) allowed = true;

    if (!allowed) return false;

    // 2. Local Toggle Check
    if (hiddenDeptIds.includes(d.id)) return false;

    return true;
  });

  // Handle time slot click from Daily View
  const handleTimeSlotClick = (date: string, time: string) => {
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
  const [lookbackYears, setLookbackYears] = useState<number>(2);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'system', 'config'), (doc) => {
      if (doc.exists()) {
        const years = doc.data().eventLookbackYears || 2;
        setLookbackYears(years);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Events (일정)
  useEffect(() => {
    // Optimization: Fetch events from configured lookback years (default 2)
    const queryStartDate = format(subYears(new Date(), lookbackYears), 'yyyy-MM-dd');
    console.log(`Fetching events from ${queryStartDate} (Lookback: ${lookbackYears} years)`);

    const q = query(
      collection(db, "일정").withConverter(eventConverter),
      where("시작일", ">=", queryStartDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadEvents = snapshot.docs.map(doc => doc.data());
      setEvents(loadEvents);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('dept_hidden_ids', JSON.stringify(hiddenDeptIds));
  }, [hiddenDeptIds]);

  const handleCellClick = (date: string, deptId: string) => {
    setSelectedDate(date);
    setSelectedEndDate(date);
    setSelectedDeptId(deptId);
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleRangeSelect = (startDate: string, endDate: string, deptId: string) => {
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
      const ref = doc(db, "일정", event.id).withConverter(eventConverter);
      await setDoc(ref, event);
    } catch (e) {
      console.error("Error saving event: ", e);
      alert("일정 저장 실패");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, "일정", id));
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

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f4f8]">
      <header className="no-print z-20 sticky top-0 flex flex-col shadow-2xl relative">
        {/* Row 1: Primary Header (Navy) */}
        <div className="bg-[#081429] h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/10 z-30 relative">

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

            {/* User Info Display (Moved to Left) */}
            {currentUser && (
              <div className="hidden md:flex flex-row items-center gap-1.5 ml-4 pl-4 border-l border-white/10 overflow-hidden">
                {/* Master Badge */}
                {userProfile?.role === 'master' && (
                  <span className="bg-red-600 text-white text-[9px] px-1 py-0.5 rounded font-black tracking-tighter shadow-sm">MASTER</span>
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

          {/* Center: View Mode Switcher */}
          <div className="flex-1 flex justify-center">
            <div className="flex bg-[#373d41]/50 p-1 rounded-full border border-white/10 backdrop-blur-sm">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${viewMode === 'daily' ? 'bg-[#fdb813] text-[#081429] shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                일간
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${viewMode === 'weekly' ? 'bg-[#fdb813] text-[#081429] shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                주간
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${viewMode === 'monthly' ? 'bg-[#fdb813] text-[#081429] shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                월간
              </button>
            </div>
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
            {currentUser && (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10 ml-2">
                <UserCircle size={20} />
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Filter Bar (Slate) */}
        <div className="bg-[#1e293b] h-10 flex items-center px-4 md:px-6 border-b border-gray-700 relative z-20 text-xs">

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
        </div>

        {/* Filter Popover Panel */}
        {isFilterOpen && (
          <div className="absolute top-[104px] left-0 w-full bg-[#1e293b]/95 backdrop-blur-xl border-b border-gray-700 shadow-2xl p-6 z-10 animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-[1920px] mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Filter size={16} className="text-[#fdb813]" /> 부서 선택
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => setAllVisibility(true)} className="px-3 py-1.5 rounded bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20 hover:bg-green-500/20">
                    모두 켜기
                  </button>
                  <button onClick={() => setAllVisibility(false)} className="px-3 py-1.5 rounded bg-red-500/10 text-red-500 text-xs font-bold border border-red-500/20 hover:bg-red-500/20">
                    모두 끄기
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {departments.map(dept => {
                  const isHidden = hiddenDeptIds.includes(dept.id);
                  const isAllowed = userProfile?.allowedDepartments?.includes(dept.id) || isMaster;

                  if (!isAllowed) return null;

                  return (
                    <button
                      key={dept.id}
                      onClick={() => toggleDeptVisibility(dept.id)}
                      className={`
                         flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-bold transition-all text-left
                         ${isHidden
                          ? 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'
                          : 'bg-[#081429] border-[#fdb813]/30 text-white shadow-sm ring-1 ring-[#fdb813]/20'
                        }
                       `}
                    >
                      <span className={`w-2 h-2 rounded-full ${isHidden ? 'bg-gray-700' : ''}`} style={{ backgroundColor: !isHidden ? (dept.color.startsWith('#') ? dept.color : 'white') : undefined }} />
                      <span className="truncate flex-1">{dept.name}</span>
                      {isHidden ? <EyeOff size={12} /> : <Eye size={12} className="text-[#fdb813]" />}
                    </button>
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
        <div className="w-full flex-1 max-w-[1920px] mx-auto min-h-screen print:p-0 flex flex-col xl:flex-row gap-8 print:flex-row print:gap-4">
          <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0">
            <CalendarBoard
              currentDate={baseDate}
              onDateChange={setBaseDate}
              departments={visibleDepartments}
              events={events}
              onCellClick={handleCellClick}
              onRangeSelect={handleRangeSelect}
              onTimeSlotClick={handleTimeSlotClick} // Pass handler
              onEventClick={handleEventClick}
              viewMode={viewMode}
            />
          </div>

          <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0">
            <CalendarBoard
              currentDate={rightDate}
              onDateChange={(date) => setBaseDate(addYears(date, 1))}
              departments={visibleDepartments}
              events={events}
              onCellClick={handleCellClick}
              onRangeSelect={handleRangeSelect}
              onTimeSlotClick={handleTimeSlotClick} // Pass handler
              onEventClick={handleEventClick}
              viewMode={viewMode}
            />
          </div>
        </div>
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
        readOnly={!canEdit} // Pass readOnly prop
        users={users}
        currentUser={userProfile}
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
      />

      {/* Access Denied / Pending Approval Overlay */}
      {currentUser && userProfile?.status === 'pending' && (
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
      )}
    </div >
  );
};

export default App;
