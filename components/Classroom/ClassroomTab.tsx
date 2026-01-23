import React, { useState, useCallback, useEffect } from 'react';
import { useClassroomData } from './hooks/useClassroomData';
import ClassroomToolbar from './components/ClassroomToolbar';
import ClassroomGrid from './components/ClassroomGrid';
import ClassDetailModal from '../ClassManagement/ClassDetailModal';
import { ClassInfo } from '../../hooks/useClasses';
import { ClassroomBlock } from './types';
import { SubjectType } from '../../types';

const IGNORED_ROOMS_KEY = 'classroom_ignored_rooms';
const TIME_RANGE_KEY = 'classroom_time_range';

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
  const [timeRange, setTimeRange] = useState<{ start: number; end: number }>(() => {
    try {
      const saved = localStorage.getItem(TIME_RANGE_KEY);
      return saved ? JSON.parse(saved) : { start: 9, end: 22 };
    } catch { return { start: 9, end: 22 }; }
  });

  useEffect(() => {
    localStorage.setItem(IGNORED_ROOMS_KEY, JSON.stringify([...ignoredRooms]));
  }, [ignoredRooms]);

  useEffect(() => {
    localStorage.setItem(TIME_RANGE_KEY, JSON.stringify(timeRange));
  }, [timeRange]);

  const [selectedSubjects, setSelectedSubjects] = useState<Set<SubjectType> | null>(null); // null = 전체
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);

  const { blocksByRoom, rooms, loading, classes } = useClassroomData(selectedDay, selectedRooms, ignoredRooms);
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

  const handleSubjectToggle = useCallback((subject: SubjectType) => {
    setSelectedSubjects(prev => {
      if (!prev) {
        // 전체 → 해당 과목만 해제
        const next = new Set<SubjectType>(['math', 'english', 'science', 'korean']);
        next.delete(subject);
        return next;
      }
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
        if (next.size === 0) return null; // 전부 해제 → 전체로
      } else {
        next.add(subject);
        if (next.size === 4) return null; // 전부 선택 → 전체로
      }
      return next;
    });
  }, []);

  const handleBlockClick = useCallback((block: ClassroomBlock) => {
    const cls = classes.find(c => c.id === block.classId);
    if (cls) {
      setSelectedClass({
        id: cls.id,
        className: cls.className,
        teacher: cls.teacher,
        subject: cls.subject,
        schedule: cls.schedule,
        room: cls.room,
        slotTeachers: cls.slotTeachers,
        slotRooms: cls.slotRooms,
      });
    }
  }, [classes]);

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
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        selectedSubjects={selectedSubjects}
        onSubjectToggle={handleSubjectToggle}
      />
      <ClassroomGrid
        blocksByRoom={blocksByRoom}
        rooms={rooms}
        isWeekend={isWeekend}
        selectedRooms={selectedRooms}
        ignoredRooms={ignoredRooms}
        timeRange={timeRange}
        onBlockClick={handleBlockClick}
        selectedSubjects={selectedSubjects}
      />
      {selectedClass && (
        <ClassDetailModal
          classInfo={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
};

export default ClassroomTab;
