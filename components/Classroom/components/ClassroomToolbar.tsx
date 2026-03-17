import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Settings } from 'lucide-react';
import { SUBJECT_LABELS } from '../../../utils/styleUtils';
import { SubjectType } from '../../../types';
import { CLASSROOM_COLORS } from '../constants';
import { RoomData, RoomCategory, RoomCategoryData, detectCategory, detectFloor, addRoom, updateRoom, deactivateRoom, renameRoomInClasses, addCategory, updateCategory, deleteCategory, getCategoryColors, CATEGORY_COLOR_OPTIONS, useRoomCategories } from '../../../hooks/useRooms';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const SUBJECTS: SubjectType[] = ['math', 'english', 'science', 'korean'];

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

  // 동적 카테고리
  const { data: categories = [], invalidate: invalidateCategories } = useRoomCategories();

  // 강의실 추가 폼
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState<RoomCategory>('');
  const [newRoomCapacity, setNewRoomCapacity] = useState(20);

  // 강의실 수정
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<RoomCategory>('');
  const [editName, setEditName] = useState('');

  // 카테고리 관리
  const [showCategoryManage, setShowCategoryManage] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('');

  // 첫 번째 카테고리를 기본값으로
  useEffect(() => {
    if (categories.length > 0 && !newRoomCategory) {
      setNewRoomCategory(categories[0].name);
    }
  }, [categories, newRoomCategory]);

  // roomDataList 기반 카테고리 그룹 (드롭다운, 설정, 관리 모두 동일 소스)
  const categoryGroups = useMemo(() => {
    const catNames = categories.map(c => c.name);
    const groups: Record<string, RoomData[]> = {};
    for (const name of catNames) groups[name] = [];
    for (const room of roomDataList) {
      const cat = room.category || detectCategory(room.name);
      if (!groups[cat]) groups[cat] = []; // 카테고리가 삭제된 경우 대비
      groups[cat].push(room);
    }
    const naturalSort = (a: RoomData, b: RoomData) =>
      a.name.localeCompare(b.name, 'ko', { numeric: true });
    for (const cat of catNames) {
      groups[cat]?.sort(naturalSort);
    }
    return catNames.map(cat => ({ label: cat, rooms: groups[cat] || [] }));
  }, [roomDataList, categories]);

  // 카테고리별 색상 조회 헬퍼
  const getCatColors = (catName: string) => {
    const catData = categories.find(c => c.name === catName);
    return getCategoryColors(catData?.color || 'blue');
  };

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
      setNewRoomCategory(categories[0]?.name || '본원');
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
        // 동일 이름의 기존 강의실이 있는지 확인
        const existing = roomDataList.find(r => r.name === trimmed && r.id !== roomId);
        if (existing) {
          alert(`"${trimmed}" 강의실이 이미 존재합니다. 다른 이름을 입력해주세요.`);
          return;
        }
        updates.name = trimmed;
        // classes의 room/slotRooms에서 이전 이름을 새 이름으로 일괄 변경
        await renameRoomInClasses(originalName, trimmed);
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
                <div className={`text-xxs font-bold mb-1 ${getCatColors(group.label).text}`}>
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowCategoryManage(!showCategoryManage)}
                  className={`flex items-center gap-1 px-2 py-0.5 text-xxs rounded border ${
                    showCategoryManage ? 'bg-gray-600 text-accent border-accent' : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
                  }`}
                  title="카테고리 관리"
                >
                  <Settings size={11} /> 카테고리
                </button>
                <button
                  onClick={() => { setAddingRoom(true); setNewRoomName(''); setNewRoomCategory(categories[0]?.name || ''); setNewRoomCapacity(20); }}
                  className="flex items-center gap-1 px-2 py-0.5 text-xxs rounded bg-accent text-primary font-bold hover:bg-accent/80"
                >
                  <Plus size={12} /> 추가
                </button>
              </div>
            </div>

            {/* 카테고리 관리 */}
            {showCategoryManage && (
              <div className="mb-3 p-2 bg-gray-800/50 rounded border border-gray-600">
                <div className="text-xxs font-bold text-gray-300 mb-2">카테고리 관리</div>
                <div className="space-y-1 mb-2">
                  {categories.map(cat => {
                    const colors = getCategoryColors(cat.color);
                    if (editingCatId === cat.id) {
                      return (
                        <div key={cat.id} className="p-1.5 bg-gray-900 rounded border border-gray-600 space-y-1.5">
                          <input
                            value={editCatName}
                            onChange={e => setEditCatName(e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-gray-800 text-gray-200 rounded border border-gray-600"
                            autoFocus
                          />
                          <div className="flex gap-1 flex-wrap">
                            {CATEGORY_COLOR_OPTIONS.map(c => (
                              <button
                                key={c.key}
                                onClick={() => setEditCatColor(c.key)}
                                className={`w-5 h-5 rounded-full border-2 ${c.bg} ${
                                  editCatColor === c.key ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                                title={c.label}
                              />
                            ))}
                          </div>
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => setEditingCatId(null)} className="px-2 py-0.5 text-xxs rounded bg-gray-700 text-gray-400 hover:bg-gray-600">취소</button>
                            <button
                              onClick={async () => {
                                const trimmed = editCatName.trim();
                                if (!trimmed) return;
                                if (trimmed !== cat.name && categories.some(c => c.name === trimmed)) {
                                  alert('동일한 이름의 카테고리가 이미 존재합니다.');
                                  return;
                                }
                                await updateCategory(cat.id, { name: trimmed, color: editCatColor });
                                setEditingCatId(null);
                                invalidateCategories();
                                onRoomsChanged();
                              }}
                              className="px-2 py-0.5 text-xxs rounded bg-accent text-primary font-bold hover:bg-accent/80"
                            >저장</button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={cat.id} className="flex items-center justify-between px-2 py-1 hover:bg-gray-800 rounded group">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                          <span className="text-xs text-gray-200">{cat.name}</span>
                          <span className="text-xxs text-gray-500">({categoryGroups.find(g => g.label === cat.name)?.rooms.length || 0})</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); setEditCatColor(cat.color); }}
                            className="p-0.5 text-gray-500 hover:text-accent"
                            title="수정"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={async () => {
                              if (categories.length <= 1) { alert('최소 1개의 카테고리가 필요합니다.'); return; }
                              const roomCount = categoryGroups.find(g => g.label === cat.name)?.rooms.length || 0;
                              const fallback = categories.find(c => c.name !== cat.name)!.name;
                              if (!confirm(`"${cat.name}" 카테고리를 삭제하시겠습니까?${roomCount > 0 ? `\n소속 강의실 ${roomCount}개는 "${fallback}"(으)로 이동됩니다.` : ''}`)) return;
                              await deleteCategory(cat.id, fallback);
                              invalidateCategories();
                              onRoomsChanged();
                            }}
                            className="p-0.5 text-gray-500 hover:text-red-400"
                            title="삭제"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* 카테고리 추가 */}
                {addingCategory ? (
                  <div className="p-1.5 bg-gray-900 rounded border border-gray-600 space-y-1.5">
                    <input
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      placeholder="카테고리명"
                      className="w-full px-2 py-1 text-xs bg-gray-800 text-gray-200 rounded border border-gray-600"
                      autoFocus
                    />
                    <div className="flex gap-1 flex-wrap">
                      {CATEGORY_COLOR_OPTIONS.map(c => (
                        <button
                          key={c.key}
                          onClick={() => setNewCatColor(c.key)}
                          className={`w-5 h-5 rounded-full border-2 ${c.bg} ${
                            newCatColor === c.key ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setAddingCategory(false)} className="px-2 py-0.5 text-xxs rounded bg-gray-700 text-gray-400 hover:bg-gray-600">취소</button>
                      <button
                        onClick={async () => {
                          const trimmed = newCatName.trim();
                          if (!trimmed) return;
                          if (categories.some(c => c.name === trimmed)) { alert('동일한 이름의 카테고리가 이미 존재합니다.'); return; }
                          await addCategory({ name: trimmed, color: newCatColor, order: categories.length });
                          setNewCatName('');
                          setAddingCategory(false);
                          invalidateCategories();
                        }}
                        className="px-2 py-0.5 text-xxs rounded bg-accent text-primary font-bold hover:bg-accent/80"
                      >저장</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingCategory(true); setNewCatName(''); setNewCatColor('blue'); }}
                    className="flex items-center gap-1 px-2 py-0.5 text-xxs rounded bg-gray-700 text-gray-400 hover:bg-gray-600 w-full justify-center"
                  >
                    <Plus size={11} /> 카테고리 추가
                  </button>
                )}
              </div>
            )}

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
                <div className="flex gap-1 mb-2 flex-wrap">
                  {categories.map(cat => {
                    const colors = getCategoryColors(cat.color);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setNewRoomCategory(cat.name)}
                        className={`flex-1 min-w-[60px] py-1 text-xxs font-bold rounded border ${
                          newRoomCategory === cat.name
                            ? `${colors.bg} text-white ${colors.border}`
                            : 'bg-gray-700 text-gray-400 border-gray-600'
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
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
                <div className={`text-xxs font-bold mb-1.5 flex items-center gap-1.5 ${getCatColors(group.label).text}`}>
                  <div className={`w-2 h-2 rounded-full ${getCatColors(group.label).bg}`} />
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
                            <div className="flex gap-0.5 flex-wrap">
                              {categories.map(cat => {
                                const colors = getCategoryColors(cat.color);
                                return (
                                  <button
                                    key={cat.id}
                                    onClick={() => setEditCategory(cat.name)}
                                    className={`flex-1 min-w-[40px] py-0.5 text-[9px] font-bold rounded ${
                                      editCategory === cat.name
                                        ? `${colors.bg} text-white`
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                                  >
                                    {cat.name}
                                  </button>
                                );
                              })}
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
                <div className={`text-xxs font-bold mb-1 ${getCatColors(group.label).text}`}>
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
