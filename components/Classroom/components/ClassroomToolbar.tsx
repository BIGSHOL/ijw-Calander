import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { SUBJECT_LABELS } from '../../../utils/styleUtils';
import { SubjectType } from '../../../types';
import { CLASSROOM_COLORS } from '../constants';
import { RoomData, RoomCategory, ROOM_CATEGORIES, detectCategory, detectFloor, addRoom, updateRoom, deactivateRoom } from '../../../hooks/useRooms';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const SUBJECTS: SubjectType[] = ['math', 'english', 'science', 'korean'];

const CATEGORY_COLORS: Record<RoomCategory, { bg: string; text: string; border: string }> = {
  '본원': { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500' },
  '바른': { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500' },
  '고등': { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500' },
};

interface ClassroomToolbarProps {
  selectedDay: string;
  onDayChange: (day: string) => void;
  selectedRooms: Set<string> | null;
  onRoomToggle: (room: string) => void;
  onSelectAllRooms: () => void;
  onDeselectAllRooms: () => void;
  rooms: string[];
  roomDataList: RoomData[];
  onRoomsChanged: () => void;
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
  roomDataList,
  onRoomsChanged,
  ignoredRooms,
  onIgnoredRoomToggle,
  timeRange,
  onTimeRangeChange,
  selectedSubjects,
  onSubjectToggle,
}) => {
  const today = getTodayDay();
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRoomManage, setShowRoomManage] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const manageRef = useRef<HTMLDivElement>(null);

  // 강의실 추가 폼
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState<RoomCategory>('본원');
  const [newRoomCapacity, setNewRoomCapacity] = useState(20);

  // 강의실 수정
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<RoomCategory>('본원');
  const [editName, setEditName] = useState('');

  // roomDataList 기반 카테고리 그룹 (드롭다운, 설정, 관리 모두 동일 소스)
  const categoryGroups = useMemo(() => {
    const groups: Record<RoomCategory, RoomData[]> = { '본원': [], '바른': [], '고등': [] };
    for (const room of roomDataList) {
      const cat = room.category || detectCategory(room.name);
      groups[cat].push(room);
    }
    return ROOM_CATEGORIES.map(cat => ({ label: cat, rooms: groups[cat] }));
  }, [roomDataList]);

  const allRoomNames = useMemo(() => roomDataList.map(r => r.name), [roomDataList]);
  const allSelected = !selectedRooms || (allRoomNames.length > 0 && allRoomNames.every(r => selectedRooms.has(r)));
  const selectedCount = selectedRooms ? selectedRooms.size : allRoomNames.length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRoomDropdown(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
      if (manageRef.current && !manageRef.current.contains(e.target as Node)) {
        setShowRoomManage(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      await addRoom({
        name: newRoomName.trim(),
        floor: detectFloor(newRoomName.trim()),
        capacity: newRoomCapacity,
        preferredSubjects: [],
        building: newRoomCategory === '바른' ? '바른학습관' : newRoomCategory === '고등' ? '고등' : '본원',
        category: newRoomCategory,
        order: roomDataList.length + 1,
        isActive: true,
      });
      setNewRoomName('');
      setAddingRoom(false);
      onRoomsChanged();
    } catch (err) {
      console.error('강의실 추가 실패:', err);
    }
  };

  const handleSaveEdit = async (roomId: string, originalName: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      const updates: Partial<RoomData> = { category: editCategory };
      if (trimmed !== originalName) {
        updates.name = trimmed;
      }
      await updateRoom(roomId, updates);
      setEditingRoomId(null);
      onRoomsChanged();
    } catch (err) {
      console.error('강의실 수정 실패:', err);
    }
  };

  const handleDeactivate = async (roomId: string, roomName: string) => {
    if (!confirm(`"${roomName}" 강의실을 비활성화하시겠습니까?`)) return;
    try {
      await deactivateRoom(roomId);
      onRoomsChanged();
    } catch (err) {
      console.error('강의실 비활성화 실패:', err);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary border-b border-gray-700">
      {/* 요일 선택 */}
      <div className="flex gap-0.5">
        {WEEKDAYS.map(day => (
          <button
            key={day}
            onClick={() => onDayChange(day)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              selectedDay === day
                ? 'bg-accent text-primary'
                : day === today
                  ? 'bg-gray-600 text-accent hover:bg-gray-500'
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
          강의실 {selectedCount}/{allRoomNames.length}
        </button>

        {showRoomDropdown && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#0d1f3c] border border-gray-600 rounded-sm shadow-xl p-3 min-w-[280px]">
            {/* 전체 선택 */}
            <div className="mb-2 pb-2 border-b border-gray-700">
              <button
                onClick={allSelected ? onDeselectAllRooms : onSelectAllRooms}
                className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                  allSelected
                    ? 'bg-accent text-primary border-accent'
                    : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                }`}
              >
                전체
              </button>
            </div>

            {/* 카테고리별 강의실 */}
            {categoryGroups.filter(g => g.rooms.length > 0).map(group => (
              <div key={group.label} className="mb-2">
                <div className={`text-xxs font-bold mb-1 ${CATEGORY_COLORS[group.label as RoomCategory]?.text || 'text-accent'}`}>
                  {group.label}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {group.rooms.map(room => {
                    const isSelected = !selectedRooms || selectedRooms.has(room.name);
                    return (
                      <button
                        key={room.id}
                        onClick={() => onRoomToggle(room.name)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors text-center truncate ${
                          isSelected
                            ? 'bg-gray-200 text-gray-800 border-gray-400 font-medium'
                            : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                        }`}
                      >
                        {room.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 강의실 관리 */}
      <div className="relative" ref={manageRef}>
        <button
          onClick={() => setShowRoomManage(!showRoomManage)}
          className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-400 hover:bg-gray-600 border border-gray-600"
        >
          강의실 관리
        </button>

        {showRoomManage && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#0d1f3c] border border-gray-600 rounded-sm shadow-xl p-3 min-w-[340px] max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
              <span className="text-xs font-bold text-gray-200">강의실 관리</span>
              <button
                onClick={() => { setAddingRoom(true); setNewRoomName(''); setNewRoomCategory('본원'); setNewRoomCapacity(20); }}
                className="flex items-center gap-1 px-2 py-0.5 text-xxs rounded bg-accent text-primary font-bold hover:bg-accent/80"
              >
                <Plus size={12} /> 추가
              </button>
            </div>

            {/* 강의실 추가 폼 */}
            {addingRoom && (
              <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                <div className="flex gap-2 mb-2">
                  <input
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    placeholder="강의실명"
                    className="flex-1 px-2 py-1 text-xs bg-gray-900 text-gray-200 rounded border border-gray-600"
                    autoFocus
                  />
                  <input
                    type="number"
                    value={newRoomCapacity}
                    onChange={e => setNewRoomCapacity(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs bg-gray-900 text-gray-200 rounded border border-gray-600"
                    placeholder="인원"
                  />
                </div>
                <div className="flex gap-1 mb-2">
                  {ROOM_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setNewRoomCategory(cat)}
                      className={`flex-1 py-1 text-xxs font-bold rounded border ${
                        newRoomCategory === cat
                          ? `${CATEGORY_COLORS[cat].bg} text-white ${CATEGORY_COLORS[cat].border}`
                          : 'bg-gray-700 text-gray-400 border-gray-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 justify-end">
                  <button onClick={() => setAddingRoom(false)} className="px-2 py-0.5 text-xxs rounded bg-gray-700 text-gray-400 hover:bg-gray-600">
                    취소
                  </button>
                  <button onClick={handleAddRoom} className="px-2 py-0.5 text-xxs rounded bg-accent text-primary font-bold hover:bg-accent/80">
                    저장
                  </button>
                </div>
              </div>
            )}

            {/* 카테고리별 강의실 목록 */}
            {categoryGroups.map(group => (
              <div key={group.label} className="mb-3">
                <div className={`text-xxs font-bold mb-1.5 flex items-center gap-1.5 ${CATEGORY_COLORS[group.label as RoomCategory]?.text || 'text-accent'}`}>
                  <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[group.label as RoomCategory]?.bg || 'bg-gray-500'}`} />
                  {group.label}
                  <span className="text-gray-500 font-normal">({group.rooms.length})</span>
                </div>
                {group.rooms.length === 0 ? (
                  <div className="text-xxs text-gray-600 pl-3">강의실 없음</div>
                ) : (
                  <div className="space-y-0.5">
                    {group.rooms.map(room => (
                      <div key={room.id}>
                        {editingRoomId === room.id ? (
                          <div className="p-1.5 bg-gray-800 rounded border border-gray-600 space-y-1.5">
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-gray-900 text-gray-200 rounded border border-gray-600"
                              autoFocus
                            />
                            <div className="flex gap-0.5">
                              {ROOM_CATEGORIES.map(cat => (
                                <button
                                  key={cat}
                                  onClick={() => setEditCategory(cat)}
                                  className={`flex-1 py-0.5 text-[9px] font-bold rounded ${
                                    editCategory === cat
                                      ? `${CATEGORY_COLORS[cat].bg} text-white`
                                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => setEditingRoomId(null)} className="px-2 py-0.5 text-xxs rounded bg-gray-700 text-gray-400 hover:bg-gray-600">
                                취소
                              </button>
                              <button onClick={() => handleSaveEdit(room.id, room.name)} className="px-2 py-0.5 text-xxs rounded bg-accent text-primary font-bold hover:bg-accent/80">
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-2 py-1 hover:bg-gray-800 rounded group">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-200">{room.name}</span>
                              <span className="text-xxs text-gray-500">{room.capacity}명</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingRoomId(room.id); setEditName(room.name); setEditCategory(room.category || detectCategory(room.name)); }}
                                className="p-0.5 text-gray-500 hover:text-accent"
                                title="수정"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={() => handleDeactivate(room.id, room.name)}
                                className="p-0.5 text-gray-500 hover:text-red-400"
                                title="비활성화"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
              ? 'bg-gray-600 text-accent border border-accent'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-gray-600'
          }`}
        >
          설정
        </button>

        {showSettings && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#0d1f3c] border border-gray-600 rounded-sm shadow-xl p-3 min-w-[280px]">
            {/* 시간대 설정 */}
            <div className="mb-3 pb-2 border-b border-gray-700">
              <div className="text-xxs font-bold text-accent mb-1.5">표시 시간대</div>
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
            {categoryGroups.filter(g => g.rooms.length > 0).map(group => (
              <div key={group.label} className="mb-2">
                <div className={`text-xxs font-bold mb-1 ${CATEGORY_COLORS[group.label as RoomCategory]?.text || 'text-accent'}`}>
                  {group.label}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {group.rooms.map(room => {
                    const isIgnored = ignoredRooms.has(room.name);
                    return (
                      <button
                        key={room.id}
                        onClick={() => onIgnoredRoomToggle(room.name)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors text-center truncate ${
                          isIgnored
                            ? 'bg-orange-200 text-orange-800 border-orange-400 font-medium'
                            : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                        }`}
                      >
                        {room.name}
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
