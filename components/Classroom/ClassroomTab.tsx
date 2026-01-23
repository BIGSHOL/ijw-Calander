import React, { useState, useCallback, useEffect } from 'react';
import { useClassroomData } from './hooks/useClassroomData';
import ClassroomToolbar from './components/ClassroomToolbar';
import ClassroomGrid from './components/ClassroomGrid';

const IGNORED_ROOMS_KEY = 'classroom_ignored_rooms';

function getInitialDay(): string {
  const dayIndex = new Date().getDay();
  const map = ['일', '월', '화', '수', '목', '금', '토'];
  const today = map[dayIndex];
  return (today === '토' || today === '일') ? '월' : today;
}

const ClassroomTab: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState(getInitialDay);
  const [selectedRooms, setSelectedRooms] = useState<Set<string> | null>(null); // null = 전체
  const [ignoredRooms, setIgnoredRooms] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(IGNORED_ROOMS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem(IGNORED_ROOMS_KEY, JSON.stringify([...ignoredRooms]));
  }, [ignoredRooms]);

  const { blocksByRoom, rooms, loading } = useClassroomData(selectedDay, selectedRooms, ignoredRooms);
  const isWeekend = selectedDay === '토' || selectedDay === '일';

  const handleRoomToggle = useCallback((room: string) => {
    setSelectedRooms(prev => {
      if (!prev) {
        // 전체 선택 상태 → 해당 방만 해제
        const next = new Set(rooms);
        next.delete(room);
        return next;
      }
      const next = new Set(prev);
      if (next.has(room)) {
        next.delete(room);
      } else {
        next.add(room);
      }
      return next;
    });
  }, [rooms]);

  const handleSelectAll = useCallback(() => {
    setSelectedRooms(null);
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedRooms(new Set());
  }, []);

  const handleIgnoredRoomToggle = useCallback((room: string) => {
    setIgnoredRooms(prev => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        강의실 데이터 로딩 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ClassroomToolbar
        selectedDay={selectedDay}
        onDayChange={setSelectedDay}
        selectedRooms={selectedRooms}
        onRoomToggle={handleRoomToggle}
        onSelectAllRooms={handleSelectAll}
        onDeselectAllRooms={handleDeselectAll}
        rooms={rooms}
        ignoredRooms={ignoredRooms}
        onIgnoredRoomToggle={handleIgnoredRoomToggle}
      />
      <ClassroomGrid
        blocksByRoom={blocksByRoom}
        rooms={rooms}
        isWeekend={isWeekend}
        selectedRooms={selectedRooms}
        ignoredRooms={ignoredRooms}
      />
    </div>
  );
};

export default ClassroomTab;
