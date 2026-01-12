// components/DailyAttendance/AttendanceCalendar.tsx
// Mini calendar component for date selection
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AttendanceCalendarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  selectedDate,
  onDateChange,
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date(selectedDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: Array<{ date: Date | null; dateString: string }> = [];

    // Padding for days before month starts
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ date: null, dateString: '' });
    }

    // Days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        dateString: date.toISOString().split('T')[0],
      });
    }

    return days;
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onDateChange(today.toISOString().split('T')[0]);
  };

  const isToday = (dateString: string) => {
    return dateString === new Date().toISOString().split('T')[0];
  };

  const isSelected = (dateString: string) => {
    return dateString === selectedDate;
  };

  const isWeekend = (dayIndex: number) => {
    const adjustedIndex = dayIndex % 7;
    return adjustedIndex === 0 || adjustedIndex === 6;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <div className="text-center">
          <h3 className="font-medium text-gray-900">
            {currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
          </h3>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Today Button */}
      <div className="flex justify-center mb-3">
        <button
          onClick={handleToday}
          className="px-3 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-full hover:bg-emerald-100 transition-colors"
        >
          오늘
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS.map((day, index) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-1 ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-500'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (!day.date) {
            return <div key={`empty-${index}`} className="h-8" />;
          }

          const dateIsToday = isToday(day.dateString);
          const dateIsSelected = isSelected(day.dateString);
          const dayOfWeek = (calendarDays.filter(d => d.date === null).length + index) % 7;
          const weekend = isWeekend(index);

          return (
            <button
              key={day.dateString}
              onClick={() => onDateChange(day.dateString)}
              className={`h-8 w-full rounded-lg text-sm font-medium transition-all
                ${dateIsSelected
                  ? 'bg-emerald-500 text-white'
                  : dateIsToday
                    ? 'bg-emerald-100 text-emerald-700'
                    : weekend
                      ? dayOfWeek === 0
                        ? 'text-red-500 hover:bg-red-50'
                        : 'text-blue-500 hover:bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              {day.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceCalendar;
