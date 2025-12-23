import React, { useState, useEffect, useRef } from 'react';
import { addYears, subYears, format, isToday, isPast, isFuture, parseISO, startOfDay } from 'date-fns';
import { CalendarEvent, Department, UserProfile } from './types';
import { INITIAL_DEPARTMENTS } from './constants';
import EventModal from './components/EventModal';
import SettingsModal from './components/SettingsModal';
import LoginModal from './components/LoginModal';
import CalendarBoard from './components/CalendarBoard';
import { Settings, Printer, Plus, Eye, EyeOff, LayoutGrid, Calendar as CalendarIcon, List, CheckCircle2, XCircle, LogOut, LogIn, UserCircle } from 'lucide-react';
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

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [baseDate, setBaseDate] = useState(new Date());
  const rightDate = subYears(baseDate, 1);

  // Firestore Data State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

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
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            // Fallback for users without profile (e.g. initial master setup manually?)
            // For now, treat as Guest with no permissions or minimal?
            setUserProfile(null);
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

  // Subscribe to Events (일정)
  useEffect(() => {
    // Optimization: Fetch events from 10 years ago to ensure all history is visible
    const oneYearAgo = format(subYears(new Date(), 10), 'yyyy-MM-dd');
    const q = query(
      collection(db, "일정").withConverter(eventConverter),
      where("시작일", ">=", oneYearAgo)
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
      <header className="bg-[#081429] no-print shadow-2xl z-20 sticky top-0 border-b border-white/10 flex flex-col md:flex-row">

        {/* Left Section: Branding - Spans Full Height */}
        <div className="flex-none px-6 py-3 md:px-10 md:py-0 flex flex-col justify-center items-center border-b md:border-b-0 md:border-r border-white/10 bg-[#081429] relative z-30 w-full md:w-auto md:min-w-[320px]">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1 border-2 border-[#fdb813] shadow-[0_0_15px_rgba(253,184,19,0.3)] overflow-hidden">
                {/* Fallback to text if image fails, or use icon */}
                <img
                  src={INJAEWON_LOGO}
                  alt="Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('bg-[#fdb813]');
                  }}
                />
                {/* Fallback Icon (hidden by default, shown via CSS if img fails could be complex, but let's just assume img works or we see blank) */}
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
                  인재원 <span className="text-[#fdb813]">학원</span>
                </h1>
                {/* User Info Here */}
                {currentUser && (
                  <div className="text-[11px] text-white/60 font-medium flex items-center gap-1.5 mt-0.5">
                    <UserCircle size={12} />
                    <span>{userProfile?.email || currentUser.email}</span>
                    <span className="text-[#fdb813]">
                      ({isMaster ? '최고관리자' : '직원'})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Controls - Stacked Rows */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Row: Action Buttons */}
          <div className="px-6 py-2.5 flex items-center justify-end gap-2 border-b border-white/5">
            {/* Removed User Info from here */}

            <button
              onClick={() => {
                setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                setSelectedEndDate(format(new Date(), 'yyyy-MM-dd'));
                setSelectedDeptId(visibleDepartments[0]?.id || departments[0]?.id);
                setEditingEvent(null);
                setInitialStartTime(''); // Reset
                setInitialEndTime('');   // Reset
                setIsEventModalOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2 bg-[#fdb813] text-[#081429] rounded-xl hover:brightness-110 transition-all shadow-lg text-sm font-black border border-[#fdb813] active:scale-95"
            >
              <Plus size={18} /> <span>일정 추가</span>
            </button>
            <div className="h-8 w-px bg-white/10 mx-2" />
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5"
              title="설정"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5"
              title="인쇄"
            >
              <Printer size={20} />
            </button>
          </div>

          {/* Bottom Row: Filters & Navigation */}
          <div className="px-4 md:px-6 py-2 flex items-center justify-start md:justify-end gap-4 md:gap-6 bg-black/20 overflow-x-auto no-scrollbar w-full">
            {/* View Mode Switcher */}
            <div className="flex bg-[#373d41]/80 p-1 rounded-xl border border-white/5 shrink-0">
              <button
                onClick={() => setViewMode('daily')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${viewMode === 'daily' ? 'bg-[#fdb813] text-[#081429] shadow-md' : 'text-gray-400 hover:text-white'} `}
              >
                <List size={14} /> 일간
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${viewMode === 'weekly' ? 'bg-[#fdb813] text-[#081429] shadow-md' : 'text-gray-400 hover:text-white'} `}
              >
                <CalendarIcon size={14} /> 주간
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${viewMode === 'monthly' ? 'bg-[#fdb813] text-[#081429] shadow-md' : 'text-gray-400 hover:text-white'} `}
              >
                <LayoutGrid size={14} /> 월간
              </button>
            </div>

            <div className="h-6 w-px bg-white/10 shrink-0" />

            {/* Global Visibility Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setAllVisibility(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[11px] font-black rounded-lg border border-green-500/20 transition-all uppercase tracking-tighter"
              >
                <CheckCircle2 size={13} /> 켜기
              </button>
              <button
                onClick={() => setAllVisibility(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-black rounded-lg border border-red-500/20 transition-all uppercase tracking-tighter"
              >
                <XCircle size={13} /> 끄기
              </button>
            </div>

            {/* Department Tags (Right aligned flow) */}
            <div className="flex items-center gap-2 pr-4 overflow-visible">
              {departments.map(dept => {
                const isHidden = hiddenDeptIds.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    onClick={() => toggleDeptVisibility(dept.id)}
                    className={`
                      whitespace-nowrap px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all duration-300 border flex items-center gap-2 select-none
                      ${isHidden
                        ? 'bg-white/5 text-gray-500 border-white/5 opacity-40 hover:opacity-100'
                        : `border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.1)] hover:brightness-110 text-[#081429] ring-1 ring-white/10 transform hover:-translate-y-0.5`
                      }
                      ${!isHidden && !dept.color.startsWith('#') ? dept.color : ''}
                    `}
                    style={{
                      backgroundColor: !isHidden && dept.color.startsWith('#') ? dept.color : undefined
                    }}
                  >
                    {dept.name}
                    {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </header >

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
      />

      {/* Access Denied / Pending Approval Overlay */}
      {currentUser && userProfile?.status === 'pending' && (
        <div className="fixed inset-0 bg-[#081429] z-50 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in duration-300">
          <div className="bg-white/10 p-6 rounded-full mb-6">
            <Lock size={48} className="text-[#fdb813]" />
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
