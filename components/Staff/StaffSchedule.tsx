import React, { useState } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { StaffMember, WeeklySchedule, STAFF_ROLE_LABELS } from '../../types';

interface StaffScheduleProps {
  staff: StaffMember[];
}

const DAYS = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
] as const;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 9); // 9:00 ~ 20:00

const StaffSchedule: React.FC<StaffScheduleProps> = ({ staff }) => {
  const [selectedDay, setSelectedDay] = useState<typeof DAYS[number]['key']>('mon');
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');

  // Get staff with schedules for the selected day
  const getStaffForDay = (dayKey: string) => {
    return staff.filter(s => {
      const schedule = s.workSchedule?.[dayKey as keyof WeeklySchedule];
      return schedule && schedule.length > 0;
    });
  };

  // Parse time range (e.g., "09:00-12:00") to get start and end hours
  const parseTimeRange = (timeRange: string) => {
    const [start, end] = timeRange.split('-');
    return {
      startHour: parseInt(start.split(':')[0]),
      endHour: parseInt(end.split(':')[0]),
    };
  };

  // Check if staff is working at specific hour on specific day
  const isWorkingAt = (staffMember: StaffMember, dayKey: string, hour: number) => {
    const schedule = staffMember.workSchedule?.[dayKey as keyof WeeklySchedule];
    if (!schedule) return false;

    return schedule.some(timeRange => {
      const { startHour, endHour } = parseTimeRange(timeRange);
      return hour >= startHour && hour < endHour;
    });
  };

  // Get staff color based on role
  const getStaffColor = (role: StaffMember['role']) => {
    const colors = {
      teacher: 'bg-blue-100 border-blue-300 text-blue-800',
      admin: 'bg-purple-100 border-purple-300 text-purple-800',
      staff: 'bg-gray-100 border-gray-300 text-gray-800',
    };
    return colors[role];
  };

  const renderWeekView = () => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-600 w-32">
              시간
            </th>
            {DAYS.map(day => (
              <th
                key={day.key}
                className={`border border-gray-200 px-4 py-3 text-center text-sm font-semibold ${
                  day.key === 'sat' ? 'text-blue-600' :
                  day.key === 'sun' ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map(hour => (
            <tr key={hour} className="hover:bg-gray-50">
              <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600 font-medium">
                {hour.toString().padStart(2, '0')}:00
              </td>
              {DAYS.map(day => {
                const workingStaff = staff.filter(s => isWorkingAt(s, day.key, hour));
                return (
                  <td key={day.key} className="border border-gray-200 px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {workingStaff.map(s => (
                        <span
                          key={s.id}
                          className={`text-xs px-2 py-0.5 rounded border ${getStaffColor(s.role)}`}
                          title={`${s.name} (${STAFF_ROLE_LABELS[s.role]})`}
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderDayView = () => {
    const dayStaff = getStaffForDay(selectedDay);
    const dayLabel = DAYS.find(d => d.key === selectedDay)?.label;

    return (
      <div>
        {/* Day selector */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => {
              const currentIndex = DAYS.findIndex(d => d.key === selectedDay);
              const prevIndex = (currentIndex - 1 + DAYS.length) % DAYS.length;
              setSelectedDay(DAYS[prevIndex].key);
            }}
            className="p-2 hover:bg-gray-100 rounded-sm transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-1">
            {DAYS.map(day => (
              <button
                key={day.key}
                onClick={() => setSelectedDay(day.key)}
                className={`px-4 py-2 rounded-sm font-medium transition-colors ${
                  selectedDay === day.key
                    ? 'bg-primary text-white'
                    : day.key === 'sat'
                    ? 'text-blue-600 hover:bg-blue-50'
                    : day.key === 'sun'
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const currentIndex = DAYS.findIndex(d => d.key === selectedDay);
              const nextIndex = (currentIndex + 1) % DAYS.length;
              setSelectedDay(DAYS[nextIndex].key);
            }}
            className="p-2 hover:bg-gray-100 rounded-sm transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Staff list for selected day */}
        {dayStaff.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">{dayLabel}요일 근무자가 없습니다</p>
            <p className="text-sm">직원 정보에서 근무 일정을 등록해주세요</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dayStaff.map(member => {
              const schedule = member.workSchedule?.[selectedDay as keyof WeeklySchedule] || [];
              return (
                <div
                  key={member.id}
                  className={`rounded-sm border-2 p-4 ${getStaffColor(member.role)}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white rounded-sm flex items-center justify-center text-lg font-bold">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold">{member.name}</div>
                      <div className="text-xs opacity-70">{STAFF_ROLE_LABELS[member.role]}</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {schedule.map((time, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>{time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary" />
          <h2 className="text-lg font-bold text-primary">근무 일정</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
              viewMode === 'day'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            일별
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
              viewMode === 'week'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            주간
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-6 text-sm">
        <span className="text-gray-500">범례:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-200 border border-blue-300" />
          <span className="text-gray-600">강사</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-purple-200 border border-purple-300" />
          <span className="text-gray-600">관리자</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-200 border border-gray-300" />
          <span className="text-gray-600">직원</span>
        </span>
      </div>

      {/* Content */}
      {viewMode === 'week' ? renderWeekView() : renderDayView()}

      {/* Empty state */}
      {staff.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">등록된 근무 일정이 없습니다</p>
          <p className="text-sm">직원 추가 후 근무 일정을 설정해주세요</p>
        </div>
      )}
    </div>
  );
};

export default StaffSchedule;
