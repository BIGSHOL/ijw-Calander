// components/DailyAttendance/DailyAttendanceManager.tsx
// Main component for daily attendance management
import React, { useState, useMemo } from 'react';
import { Calendar, Users, BarChart3, RefreshCw, LayoutGrid } from 'lucide-react';
import { UserProfile, TimetableClass, DailyAttendanceRecord, AttendanceStatus } from '../../types';
import { useDailyAttendanceByDate } from '../../hooks/useDailyAttendance';
import { useClasses } from '../../hooks/useClasses';
import AttendanceCalendar from './AttendanceCalendar';
import ClassAttendanceList from './ClassAttendanceList';
import ClassAttendanceCards from './ClassAttendanceCards';
import AttendanceStats from './AttendanceStats';

interface DailyAttendanceManagerProps {
  userProfile: UserProfile | null;
}

const DailyAttendanceManager: React.FC<DailyAttendanceManagerProps> = ({
  userProfile,
}) => {
  // State
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'stats'>('cards');
  const [selectedSubject, setSelectedSubject] = useState<'all' | 'english' | 'math'>('all');

  // Fetch attendance records for the selected date
  const {
    data: attendanceRecords = [],
    isLoading: isLoadingAttendance,
    refetch: refetchAttendance,
  } = useDailyAttendanceByDate(selectedDate);

  // Fetch classes for the filter dropdown
  const { data: classes = [] } = useClasses();

  // Filter records by selected class
  const filteredRecords = useMemo(() => {
    if (!selectedClassId) return attendanceRecords;
    return attendanceRecords.filter(record => record.classId === selectedClassId);
  }, [attendanceRecords, selectedClassId]);

  // Get unique classes from records
  const classesInRecords = useMemo(() => {
    const classMap = new Map<string, { id: string; name: string }>();
    attendanceRecords.forEach(record => {
      if (!classMap.has(record.classId)) {
        classMap.set(record.classId, { id: record.classId, name: record.className });
      }
    });
    return Array.from(classMap.values());
  }, [attendanceRecords]);

  // Handle date change
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  // Handle class filter change
  const handleClassChange = (classId: string | null) => {
    setSelectedClassId(classId);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Compact Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg shadow-sm">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">출결 관리</h1>
              <p className="text-xs text-gray-500">일별 출결 체크 및 통계</p>
            </div>
          </div>

          {/* Compact View Mode Toggle */}
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">수업별</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">전체</span>
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'stats'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">통계</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Compact Left Sidebar */}
        <div className="w-64 bg-white/90 backdrop-blur-sm border-r border-gray-200 flex flex-col shadow-sm">
          {/* Compact Calendar */}
          <div className="p-3 border-b border-gray-200">
            <AttendanceCalendar
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
            />
          </div>

          {/* Compact Class Filter */}
          <div className="p-3 border-b border-gray-200">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              수업 필터
            </label>
            <select
              value={selectedClassId || ''}
              onChange={(e) => handleClassChange(e.target.value || null)}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="">전체 수업</option>
              {(classesInRecords.length > 0 ? classesInRecords : classes).map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name || (cls as TimetableClass).className}
                </option>
              ))}
            </select>
          </div>

          {/* Compact Stats Grid */}
          <div className="p-3 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">오늘의 요약</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200/50">
                <div className="text-xs text-emerald-600 font-medium mb-0.5">출석</div>
                <div className="text-lg font-bold text-emerald-700">
                  {filteredRecords.filter(r => r.status === 'present').length}
                </div>
              </div>
              <div className="p-2 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200/50">
                <div className="text-xs text-amber-600 font-medium mb-0.5">지각</div>
                <div className="text-lg font-bold text-amber-700">
                  {filteredRecords.filter(r => r.status === 'late').length}
                </div>
              </div>
              <div className="p-2 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200/50">
                <div className="text-xs text-red-600 font-medium mb-0.5">결석</div>
                <div className="text-lg font-bold text-red-700">
                  {filteredRecords.filter(r => r.status === 'absent').length}
                </div>
              </div>
              <div className="p-2 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200/50">
                <div className="text-xs text-orange-600 font-medium mb-0.5">조퇴</div>
                <div className="text-lg font-bold text-orange-700">
                  {filteredRecords.filter(r => r.status === 'early_leave').length}
                </div>
              </div>
              <div className="col-span-2 p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200/50">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-blue-600 font-medium">사유결석</div>
                  <div className="text-lg font-bold text-blue-700">
                    {filteredRecords.filter(r => r.status === 'excused').length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Compact Toolbar */}
          <div className="bg-white/80 backdrop-blur-sm px-4 py-2 border-b border-gray-200 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-900">
                  {new Date(selectedDate).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
              </div>
              <div className="h-4 w-px bg-gray-300" />

              {/* Subject Filter - Only show in cards view */}
              {viewMode === 'cards' && (
                <>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setSelectedSubject('all')}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                        selectedSubject === 'all'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      전체
                    </button>
                    <button
                      onClick={() => setSelectedSubject('english')}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                        selectedSubject === 'english'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      영어
                    </button>
                    <button
                      onClick={() => setSelectedSubject('math')}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                        selectedSubject === 'math'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      수학
                    </button>
                  </div>
                  <div className="h-4 w-px bg-gray-300" />
                </>
              )}

              <span className="text-xs text-gray-500 font-medium">
                총 {filteredRecords.length}명
              </span>
            </div>

            <button
              onClick={() => refetchAttendance()}
              disabled={isLoadingAttendance}
              className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAttendance ? 'animate-spin' : ''}`} />
              <span className="text-xs font-medium">새로고침</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {viewMode === 'cards' ? (
              <ClassAttendanceCards
                records={attendanceRecords}
                selectedDate={selectedDate}
                userProfile={userProfile}
                onRefresh={refetchAttendance}
                isLoading={isLoadingAttendance}
                selectedSubject={selectedSubject}
              />
            ) : viewMode === 'list' ? (
              <ClassAttendanceList
                records={filteredRecords}
                selectedDate={selectedDate}
                isLoading={isLoadingAttendance}
                userProfile={userProfile}
                onRefresh={refetchAttendance}
              />
            ) : (
              <AttendanceStats
                date={selectedDate}
                records={filteredRecords}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyAttendanceManager;
