import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { SUBJECT_LABELS } from '../../../utils/styleUtils';
import { SubjectType } from '../../../types';
import { CLASSROOM_COLORS } from '../../Classroom/constants';
import { AssignmentStats } from '../types';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const SUBJECTS: SubjectType[] = ['math', 'english', 'science', 'korean'];

interface RoomGroup {
  label: string;
  rooms: string[];
}

const RE_FLOOR2 = /^2\d{2}/;
const RE_FLOOR3 = /^3\d{2}/;
const RE_FLOOR6 = /^6\d{2}/;

function groupRooms(rooms: string[]): RoomGroup[] {
  const groups: Record<string, string[]> = {
    '2층': [],
    '3층': [],
    '6층': [],
    '프리미엄관': [],
    '기타': [],
  };

  for (const room of rooms) {
    if (RE_FLOOR2.test(room) || room.includes('SKY')) groups['2층'].push(room);
    else if (RE_FLOOR3.test(room)) groups['3층'].push(room);
    else if (RE_FLOOR6.test(room)) groups['6층'].push(room);
    else if (room.includes('프리미엄') || room.includes('LAB')) groups['프리미엄관'].push(room);
    else groups['기타'].push(room);
  }

  groups['2층'].sort((a, b) => {
    const aIsSky = a.includes('SKY') ? 0 : 1;
    const bIsSky = b.includes('SKY') ? 0 : 1;
    return aIsSky - bIsSky || a.localeCompare(b, 'ko');
  });

  return Object.entries(groups)
    .filter(([, rooms]) => rooms.length > 0)
    .map(([label, rooms]) => ({ label, rooms }));
}

function getTodayDay(): string {
  const dayIndex = new Date().getDay();
  const map = ['일', '월', '화', '수', '목', '금', '토'];
  return map[dayIndex];
}

interface AssignmentToolbarProps {
  selectedDay: string;
  onDayChange: (day: string) => void;
  // 강의실 필터
  selectedRooms: Set<string> | null;
  onRoomToggle: (room: string) => void;
  onSelectAllRooms: () => void;
  onDeselectAllRooms: () => void;
  rooms: string[];
  // 배정 무시 강의실
  excludedRooms: Set<string>;
  onExcludedRoomToggle: (room: string) => void;
  // 시간대
  timeRange: { start: number; end: number };
  onTimeRangeChange: (range: { start: number; end: number }) => void;
  // 과목 필터
  selectedSubjects: Set<SubjectType> | null;
  onSubjectToggle: (subject: SubjectType) => void;
  // 자동 배정
  onAutoAssign: () => void;
  onApply: () => void;
  onReset: () => void;
  hasPreview: boolean;
  stats: AssignmentStats | null;
  isApplying: boolean;
}

export const AssignmentToolbar: React.FC<AssignmentToolbarProps> = ({
  selectedDay,
  onDayChange,
  selectedRooms,
  onRoomToggle,
  onSelectAllRooms,
  onDeselectAllRooms,
  rooms,
  excludedRooms,
  onExcludedRoomToggle,
  timeRange,
  onTimeRangeChange,
  selectedSubjects,
  onSubjectToggle,
  onAutoAssign,
  onApply,
  onReset,
  hasPreview,
  stats,
  isApplying,
}) => {
  const today = getTodayDay();
  const allSelected = !selectedRooms || (rooms.length > 0 && rooms.every(r => selectedRooms.has(r)));
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const roomGroups = groupRooms(rooms);
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
    <div className="flex items-center gap-2 px-3 py-2 bg-[#081429] border-b border-gray-700 flex-wrap">
      {/* 요일 선택 */}
      <div className="flex gap-0.5">
        {WEEKDAYS.map(day => (
          <button
            key={day}
            onClick={() => onDayChange(day)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${selectedDay === day
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
            <div className="mb-2 pb-2 border-b border-gray-700">
              <button
                onClick={allSelected ? onDeselectAllRooms : onSelectAllRooms}
                className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${allSelected
                  ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                  : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                  }`}
              >
                전체
              </button>
            </div>

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
                        className={`px-2 py-1 text-[11px] rounded border transition-colors text-center truncate ${isSelected
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

      {/* 설정 (시간대 + 배정 무시) */}
      <div className="relative" ref={settingsRef}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`px-2 py-1 text-xs rounded transition-colors ${excludedRooms.size > 0
              ? 'bg-gray-600 text-[#fdb813] border border-[#fdb813]'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-gray-600'
            }`}
        >
          설정{excludedRooms.size > 0 ? ` (${excludedRooms.size})` : ''}
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

            {/* 배정 무시 강의실 */}
            <div className="text-xxs text-gray-400 mb-2">
              배정 무시 강의실은 자동 배정에서 제외됩니다
            </div>
            {roomGroups.map(group => (
              <div key={group.label} className="mb-2">
                <div className="text-xxs font-bold text-[#fdb813] mb-1">{group.label}</div>
                <div className="grid grid-cols-3 gap-1">
                  {group.rooms.map(room => {
                    const isExcluded = excludedRooms.has(room);
                    return (
                      <button
                        key={room}
                        onClick={() => onExcludedRoomToggle(room)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors text-center truncate ${isExcluded
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

      {/* 구분선 */}
      <div className="h-5 w-px bg-gray-600" />

      {/* 자동 배정 액션 버튼 */}
      <button
        onClick={onAutoAssign}
        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
      >
        <Wand2 size={12} />
        자동 배정
      </button>

      <button
        onClick={onApply}
        disabled={!hasPreview || isApplying}
        className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Save size={12} />
        {isApplying ? '적용 중...' : '적용'}
      </button>

      <button
        onClick={onReset}
        disabled={!hasPreview}
        className="flex items-center gap-1 px-2.5 py-1 bg-gray-600 text-gray-200 text-xs font-medium rounded hover:bg-gray-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RotateCcw size={12} />
        초기화
      </button>

      {/* 통계 */}
      {stats && (
        <>
          <div className="h-5 w-px bg-gray-600" />
          <div className="flex items-center gap-2 text-xxs">
            <span className="text-gray-400">
              전체 <span className="font-semibold text-gray-200">{stats.totalSlots}</span>
            </span>
            <span className="text-emerald-400">
              배정 <span className="font-semibold">{stats.assigned}</span>
            </span>
            {stats.unassigned > 0 && (
              <span className="text-amber-400">
                미배정 <span className="font-semibold">{stats.unassigned}</span>
              </span>
            )}
            {stats.conflicts > 0 && (
              <span className="flex items-center gap-0.5 text-red-400">
                <AlertTriangle size={10} />
                충돌 <span className="font-semibold">{stats.conflicts}</span>
              </span>
            )}
          </div>
        </>
      )}

      {/* 과목 필터 */}
      <div className="flex items-center gap-1 ml-auto">
        {SUBJECTS.map(subject => {
          const isActive = !selectedSubjects || selectedSubjects.has(subject);
          return (
            <button
              key={subject}
              onClick={() => onSubjectToggle(subject)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xxs transition-colors ${isActive ? 'font-medium' : 'opacity-60'
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
