import React, { useMemo } from 'react';
import { ClassroomBlock, TimeConfig, makeTimeConfig } from '../types';
import { SubjectType } from '../../../types';
import ClassBlock from './ClassBlock';

interface ClassroomGridProps {
  blocksByRoom: Map<string, ClassroomBlock[]>;
  rooms: string[];
  isWeekend: boolean;
  selectedRooms: Set<string> | null;
  ignoredRooms: Set<string>;
  timeRange: { start: number; end: number };
  onBlockClick?: (block: ClassroomBlock) => void;
  selectedSubjects: Set<SubjectType> | null;
}

interface TimeMarker {
  label: string;
  topPercent: number;
  isHour: boolean;
}

function getTimeMarkers(config: TimeConfig): TimeMarker[] {
  const markers: TimeMarker[] = [];
  // 시작점을 10분 단위로 올림
  const firstTick = Math.ceil((config.start + 1) / 10) * 10;
  for (let m = firstTick; m < config.end; m += 10) {
    const topPercent = ((m - config.start) / config.range) * 100;
    const hour = Math.floor(m / 60);
    const min = m % 60;
    const isHour = min === 0;
    markers.push({
      label: `${hour}:${String(min).padStart(2, '0')}`,
      topPercent,
      isHour,
    });
  }
  return markers;
}

const ClassroomGrid: React.FC<ClassroomGridProps> = ({ blocksByRoom, rooms, isWeekend, selectedRooms, ignoredRooms, timeRange, onBlockClick, selectedSubjects }) => {
  const config = useMemo(() => makeTimeConfig(timeRange.start, timeRange.end), [timeRange]);
  const timeMarkers = useMemo(() => getTimeMarkers(config), [config]);

  const displayRooms = selectedRooms ? rooms.filter(r => selectedRooms.has(r)) : rooms;

  if (displayRooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm bg-white">
        강의실 데이터가 없습니다
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-white">
      {/* 시간 축 (고정) */}
      <div className="relative w-12 flex-shrink-0 border-r border-gray-300 bg-gray-50">
        <div className="h-9 border-b border-gray-300" />
        <div className="relative flex-1 h-[calc(100%-2.25rem)]">
          {timeMarkers.map(m => (
            <div
              key={m.label}
              className="absolute left-0 w-full"
              style={{ top: `${m.topPercent}%` }}
            >
              <span className={`absolute left-1 ${
                m.isHour
                  ? '-top-2.5 text-[10px] font-semibold text-gray-700'
                  : '-top-1.5 text-[8px] text-gray-400'
              }`}>
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 강의실 칼럼들 */}
      <div className="flex flex-1 overflow-x-auto">
        {displayRooms.map(room => {
          const isIgnored = ignoredRooms.has(room);
          const minW = isIgnored ? 'min-w-[420px]' : 'min-w-[140px]';
          const maxW = isIgnored ? 'max-w-[660px]' : 'max-w-[220px]';
          return (
          <div key={room} className={`relative flex flex-col ${minW} flex-1 ${maxW}`}>
            {/* 헤더 */}
            <div className="h-9 flex items-center justify-center border-b border-r border-gray-300 bg-gray-100 px-2">
              <span className="text-xs font-bold text-gray-800 truncate">{room}</span>
            </div>
            {/* 그리드 본체 */}
            <div className="relative flex-1 border-r border-gray-200 bg-white overflow-hidden">
              {/* 시간 가이드 라인 */}
              {timeMarkers.map(m => (
                <div
                  key={m.label}
                  className={`absolute left-0 w-full border-t ${
                    m.isHour ? 'border-gray-300' : 'border-gray-100'
                  }`}
                  style={{ top: `${m.topPercent}%` }}
                />
              ))}
              {/* 수업 블록들 (시간 범위 + 과목 필터) */}
              {(blocksByRoom.get(room) || [])
                .filter(b => b.endMinutes > config.start && b.startMinutes < config.end)
                .filter(b => !selectedSubjects || selectedSubjects.has(b.subject))
                .map(block => (
                <ClassBlock key={block.id} block={block} config={config} onClick={onBlockClick} />
              ))}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClassroomGrid;
