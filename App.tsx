
import React, { useState, useEffect, useRef } from 'react';
import { addYears, subYears, format, isToday, isPast, isFuture, parseISO, startOfDay } from 'date-fns';
import { CalendarEvent, Department } from './types';
import { INITIAL_DEPARTMENTS } from './constants';
import EventModal from './components/EventModal';
import SettingsModal from './components/SettingsModal';
import CalendarBoard from './components/CalendarBoard';
import { Settings, Printer, Plus, Eye, EyeOff, LayoutGrid, Calendar as CalendarIcon, List, CheckCircle2, XCircle } from 'lucide-react';

type ViewMode = 'daily' | 'weekly' | 'monthly';

// Embedded Injaewon Logo
const INJAEWON_LOGO = "/logo.png";

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [baseDate, setBaseDate] = useState(new Date());
  const rightDate = subYears(baseDate, 1);

  const [departments, setDepartments] = useState<Department[]>(() => {
    const saved = localStorage.getItem('dept_departments');
    return saved ? JSON.parse(saved) : INITIAL_DEPARTMENTS;
  });
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('dept_events');
    return saved ? JSON.parse(saved) : [];
  });
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

  useEffect(() => {
    localStorage.setItem('dept_departments', JSON.stringify(departments));
  }, [departments]);

  useEffect(() => {
    localStorage.setItem('dept_events', JSON.stringify(events));
  }, [events]);

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

  const handleSaveEvent = (event: CalendarEvent) => {
    if (editingEvent) {
      setEvents(events.map(e => e.id === event.id ? event : e));
    } else {
      setEvents([...events, event]);
    }
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
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

  const visibleDepartments = departments.filter(d => !hiddenDeptIds.includes(d.id));

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f4f8]">
      <header className="bg-[#081429] no-print shadow-2xl z-20 sticky top-0 border-b border-white/10 flex flex-row">

        {/* Left Section: Branding - Spans Full Height */}
        <div className="flex-none px-10 flex flex-col justify-center items-center border-r border-white/10 bg-[#081429] relative z-30 min-w-[240px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1 border-2 border-[#fdb813] shadow-[0_0_15px_rgba(253,184,19,0.3)]">
              <img src={INJAEWON_LOGO} alt="인재원 로고" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
              인재원 <span className="text-[#fdb813]">학원</span>
            </h1>
          </div>
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#fdb813]/50 to-transparent mt-2" />
        </div>

        {/* Right Section: Controls - Stacked Rows */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Row: Action Buttons */}
          <div className="px-6 py-2.5 flex items-center justify-end gap-2 border-b border-white/5">
            <button
              onClick={() => {
                setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                setSelectedEndDate(format(new Date(), 'yyyy-MM-dd'));
                setSelectedDeptId(visibleDepartments[0]?.id || departments[0]?.id);
                setEditingEvent(null);
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
          <div className="px-6 py-2 flex items-center justify-end gap-6 bg-black/20 overflow-x-auto no-scrollbar">
            {/* View Mode Switcher */}
            <div className="flex bg-[#373d41]/80 p-1 rounded-xl border border-white/5 shrink-0">
              <button
                onClick={() => setViewMode('daily')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${viewMode === 'daily' ? 'bg-[#fdb813] text-[#081429] shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                <List size={14} /> 일간
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${viewMode === 'weekly' ? 'bg-[#fdb813] text-[#081429] shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                <CalendarIcon size={14} /> 주간
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${viewMode === 'monthly' ? 'bg-[#fdb813] text-[#081429] shadow-md' : 'text-gray-400 hover:text-white'}`}
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
                        : `border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.1)] hover:brightness-110 text-[#081429] ${dept.color} ring-1 ring-white/10 transform hover:-translate-y-0.5`
                      }
                                `}
                  >
                    {dept.name}
                    {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8 print:p-0">
        <div className="max-w-[1920px] mx-auto min-h-screen print:p-0">
          <div className="flex flex-col xl:flex-row gap-8 print:flex-row print:gap-4">
            <CalendarBoard
              currentDate={baseDate}
              onDateChange={setBaseDate}
              departments={visibleDepartments}
              events={events}
              onCellClick={handleCellClick}
              onRangeSelect={handleRangeSelect}
              onEventClick={handleEventClick}
              viewMode={viewMode}
            />

            <CalendarBoard
              currentDate={rightDate}
              onDateChange={(date) => setBaseDate(addYears(date, 1))}
              departments={visibleDepartments}
              events={events}
              onCellClick={handleCellClick}
              onRangeSelect={handleRangeSelect}
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
        existingEvent={editingEvent}
        initialDepartmentId={selectedDeptId}
        departments={departments}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        departments={departments}
        setDepartments={setDepartments}
      />
    </div>
  );
};

export default App;
