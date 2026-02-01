import React, { useState, useRef, useEffect } from 'react';
import { SUBJECT_LABELS } from '../../../utils/styleUtils';
import { SubjectType } from '../../../types';
import { CLASSROOM_COLORS } from '../constants';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const SUBJECTS: SubjectType[] = ['math', 'english', 'science', 'korean'];

interface RoomGroup {
  label: string;
  rooms: string[];
}

function groupRooms(rooms: string[]): RoomGroup[] {
  const groups: Record<string, string[]> = {
    '2층': [],
    '3층': [],
    '6층': [],
    '프리미엄관': [],
    '기타': [],
  };

  for (const room of rooms) {
    if (/^2\d{2}/.test(room) || room.includes('SKY')) groups['2층'].push(room);
    else if (/^3\d{2}/.test(room)) groups['3층'].push(room);
    else if (/^6\d{2}/.test(room)) groups['6층'].push(room);
    else if (room.includes('프리미엄') || room.includes('LAB')) groups['프리미엄관'].push(room);
    else groups['기타'].push(room);
  }

  // SKY 강의실을 2층 그룹 맨 앞으로
  groups['2층'].sort((a, b) => {
    const aIsSky = a.includes('SKY') ? 0 : 1;
    const bIsSky = b.includes('SKY') ? 0 : 1;
    return aIsSky - bIsSky || a.localeCompare(b, 'ko');
  });

  return Object.entries(groups)
    .filter(([, rooms]) => rooms.length > 0)
    .map(([label, rooms]) => ({ label, rooms }));
}

interface ClassroomToolbarProps {
  selectedDay: string;
  onDayChange: (day: string) => void;
  selectedRooms: Set<string> | null;
  onRoomToggle: (room: string) => void;
  onSelectAllRooms: () => void;
  onDeselectAllRooms: () => void;
  rooms: string[];
  ignoredRooms: Set<string>;
  onIgnoredRoomToggle: (room: string) => void;
  timeRange: { start: number; end: number };
  onTimeRangeChange: (range: { start: number; end: number }) => void;
  selectedSubjects: Set<SubjectType> | null;
  onSubjectToggle: (subject: SubjectType) => void;
}

function getTodayDay(): string {
  const dayIndex = new Date().getDay();
  const map = ['일', '월', '화', '수', '목', '금', '토'];
  return map[dayIndex];
}

const ClassroomToolbar: React.FC<ClassroomToolbarProps> = ({
  selectedDay,
  onDayChange,
  selectedRooms,
  onRoomToggle,
  onSelectAllRooms,
  onDeselectAllRooms,
  rooms,
  ignoredRooms,
  onIgnoredRoomToggle,
  timeRange,
  onTimeRangeChange,
  selectedSubjects,
  onSubjectToggle,
}) => {
  const today = getTodayDay();
  const allSelected = !selectedRooms || (rooms.length > 0 && rooms.every(r => selectedRooms.has(r)));
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const roomGroups = groupRooms(rooms);

  // 선택된 강의실 수 표시
  const selectedCount = selectedRooms ? selectedRooms.size : rooms.length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRoomDropdown(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#081429] border-b border-gray-700">
      {/* 요일 선택 */}
      <div className="flex gap-0.5">
        {WEEKDAYS.map(day => (
          <button
            key={day}
            onClick={() => onDayChange(day)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              selectedDay === day
                ? 'bg-[#fdb813] text-[#081429]'
                : day === today
                  ? 'bg-gray-600 text-[#fdb813] hover:bg-gray-500'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* 강의실 드롭다운 */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowRoomDropdown(!showRoomDropdown)}
          className="px-2.5 py-1 text-xs font-medium rounded bg-gray-700 text-gray-200 hover:bg-gray-600 border border-gray-600"
        >
          강의실 {selectedCount}/{rooms.length}
        </button>

        {showRoomDropdown && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#0d1f3c] border border-gray-600 rounded-lg shadow-xl p-3 min-w-[280px]">
            {/* 전체 선택 */}
            <div className="mb-2 pb-2 border-b border-gray-700">
              <button
                onClick={allSelected ? onDeselectAllRooms : onSelectAllRooms}
                className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                  allSelected
                    ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                    : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                }`}
              >
                전체
              </button>
            </div>

            {/* 그룹별 강의실 */}
            {roomGroups.map(group => (
              <div key={group.label} className="mb-2">
                <div className="text-xxs font-bold text-[#fdb813] mb-1">{group.label}</div>
                <div className="grid grid-cols-3 gap-1">
                  {group.rooms.map(room => {
                    const isSelected = !selectedRooms || selectedRooms.has(room);
                    return (
                      <button
                        key={room}
                        onClick={() => onRoomToggle(room)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors text-center truncate ${
                          isSelected
                            ? 'bg-gray-200 text-gray-800 border-gray-400 font-medium'
                            : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                        }`}
                      >
                        {room}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 설정 (충돌 무시 강의실) */}
      <div className="relative" ref={settingsRef}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            ignoredRooms.size > 0
              ? 'bg-gray-600 text-[#fdb813] border border-[#fdb813]'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-gray-600'
          }`}
        >
          설정
        </button>

        {showSettings && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#0d1f3c] border border-gray-600 rounded-lg shadow-xl p-3 min-w-[280px]">
            {/* 시간대 설정 */}
            <div className="mb-3 pb-2 border-b border-gray-700">
              <div className="text-xxs font-bold text-[#fdb813] mb-1.5">표시 시간대</div>
              <div className="flex items-center gap-2">
                <select
                  value={timeRange.start}
                  onChange={e => onTimeRangeChange({ ...timeRange, start: Number(e.target.value) })}
                  className="bg-gray-800 text-gray-200 text-[11px] rounded px-1.5 py-0.5 border border-gray-600"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 7).map(h => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
                <span className="text-gray-400 text-xxs">~</span>
                <select
                  value={timeRange.end}
                  onChange={e => onTimeRangeChange({ ...timeRange, end: Number(e.target.value) })}
                  className="bg-gray-800 text-gray-200 text-[11px] rounded px-1.5 py-0.5 border border-gray-600"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 9).map(h => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 충돌 무시 강의실 */}
            <div className="text-xxs text-gray-400 mb-2">
              충돌 무시 강의실은 경고 없이 수업을 나란히 표시합니다 (3배 가로폭)
            </div>
            {roomGroups.map(group => (
              <div key={group.label} className="mb-2">
                <div className="text-xxs font-bold text-[#fdb813] mb-1">{group.label}</div>
                <div className="grid grid-cols-3 gap-1">
                  {group.rooms.map(room => {
                    const isIgnored = ignoredRooms.has(room);
                    return (
                      <button
                        key={room}
                        onClick={() => onIgnoredRoomToggle(room)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors text-center truncate ${
                          isIgnored
                            ? 'bg-orange-200 text-orange-800 border-orange-400 font-medium'
                            : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                        }`}
                      >
                        {room}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 과목 필터 */}
      <div className="flex items-center gap-1 ml-auto">
        {SUBJECTS.map(subject => {
          const isActive = !selectedSubjects || selectedSubjects.has(subject);
          return (
            <button
              key={subject}
              onClick={() => onSubjectToggle(subject)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xxs transition-colors ${
                isActive
                  ? 'font-medium'
                  : 'opacity-60'
              }`}
              style={{
                backgroundColor: isActive ? CLASSROOM_COLORS[subject].light : '#1f2937',
                borderColor: isActive ? CLASSROOM_COLORS[subject].bg : '#4b5563',
                color: isActive ? CLASSROOM_COLORS[subject].bg : '#6b7280',
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: CLASSROOM_COLORS[subject].bg }}
              />
              {SUBJECT_LABELS[subject]}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ClassroomToolbar;
