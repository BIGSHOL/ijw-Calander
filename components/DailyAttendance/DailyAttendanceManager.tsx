// components/DailyAttendance/DailyAttendanceManager.tsx
// Main component for daily attendance management
import React, { useState, useMemo } from 'react';
import { Calendar, Users, BarChart3, RefreshCw } from 'lucide-react';
import { UserProfile, TimetableClass, DailyAttendanceRecord, AttendanceStatus } from '../../types';
import { useDailyAttendanceByDate } from '../../hooks/useDailyAttendance';
import { useClasses } from '../../hooks/useClasses';
import AttendanceCalendar from './AttendanceCalendar';
import ClassAttendanceList from './ClassAttendanceList';
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
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');

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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">출결 관리</h1>
              <p className="text-sm text-gray-500">일별 출결 체크 및 통계</p>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">출결 목록</span>
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                viewMode === 'stats'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm font-medium">통계</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar - Calendar & Filters */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Date Selector */}
          <div className="p-4 border-b border-gray-200">
            <AttendanceCalendar
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
            />
          </div>

          {/* Class Filter */}
          <div className="p-4 border-b border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수업 필터
            </label>
            <select
              value={selectedClassId || ''}
              onChange={(e) => handleClassChange(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">전체 수업</option>
              {(classesInRecords.length > 0 ? classesInRecords : classes).map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name || (cls as TimetableClass).className}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Stats Summary */}
          <div className="p-4 flex-1">
            <h3 className="text-sm font-medium text-gray-700 mb-3">오늘의 요약</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-emerald-50 rounded-lg">
                <span className="text-sm text-emerald-700">출석</span>
                <span className="font-medium text-emerald-800">
                  {filteredRecords.filter(r => r.status === 'present').length}명
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-amber-50 rounded-lg">
                <span className="text-sm text-amber-700">지각</span>
                <span className="font-medium text-amber-800">
                  {filteredRecords.filter(r => r.status === 'late').length}명
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                <span className="text-sm text-red-700">결석</span>
                <span className="font-medium text-red-800">
                  {filteredRecords.filter(r => r.status === 'absent').length}명
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-orange-50 rounded-lg">
                <span className="text-sm text-orange-700">조퇴</span>
                <span className="font-medium text-orange-800">
                  {filteredRecords.filter(r => r.status === 'early_leave').length}명
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-700">사유결석</span>
                <span className="font-medium text-blue-800">
                  {filteredRecords.filter(r => r.status === 'excused').length}명
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="bg-white px-6 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">
                  {new Date(selectedDate).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                총 {filteredRecords.length}명
              </span>
            </div>

            <button
              onClick={() => refetchAttendance()}
              disabled={isLoadingAttendance}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingAttendance ? 'animate-spin' : ''}`} />
              <span className="text-sm">새로고침</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {viewMode === 'list' ? (
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
