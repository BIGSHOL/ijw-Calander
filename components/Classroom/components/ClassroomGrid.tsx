import React from 'react';
import { ClassroomBlock, TimeConfig, WEEKDAY_CONFIG, WEEKEND_CONFIG } from '../types';
import ClassBlock from './ClassBlock';

interface ClassroomGridProps {
  blocksByRoom: Map<string, ClassroomBlock[]>;
  rooms: string[];
  isWeekend: boolean;
  selectedRooms: Set<string> | null;
  ignoredRooms: Set<string>;
}

function getHourMarkers(config: TimeConfig): { label: string; topPercent: number }[] {
  const markers: { label: string; topPercent: number }[] = [];
  const firstHour = Math.ceil(config.start / 60);
  const lastHour = Math.floor(config.end / 60);
  for (let h = firstHour; h <= lastHour; h++) {
    const minutes = h * 60;
    if (minutes <= config.start || minutes >= config.end) continue;
    const topPercent = ((minutes - config.start) / config.range) * 100;
    markers.push({ label: `${h}:00`, topPercent });
  }
  return markers;
}

const ClassroomGrid: React.FC<ClassroomGridProps> = ({ blocksByRoom, rooms, isWeekend, selectedRooms, ignoredRooms }) => {
  const config = isWeekend ? WEEKEND_CONFIG : WEEKDAY_CONFIG;
  const hourMarkers = getHourMarkers(config);

  const displayRooms = selectedRooms ? rooms.filter(r => selectedRooms.has(r)) : rooms;

  if (displayRooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm bg-white">
        강의실 데이터가 없습니다
      </div>
    );
  }

  const startLabel = `${Math.floor(config.start / 60)}:${String(config.start % 60).padStart(2, '0')}`;
  const endLabel = `${Math.floor(config.end / 60)}:${String(config.end % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-white">
      {/* 시간 축 (고정) */}
      <div className="relative w-14 flex-shrink-0 border-r border-gray-300 bg-gray-50">
        <div className="h-9 border-b border-gray-300" />
        <div className="relative flex-1 h-[calc(100%-2.25rem)]">
          <div className="absolute top-0.5 left-1 text-[10px] font-medium text-gray-600">{startLabel}</div>
          {hourMarkers.map(m => (
            <div
              key={m.label}
              className="absolute left-0 w-full"
              style={{ top: `${m.topPercent}%` }}
            >
              <span className="absolute -top-2 left-1 text-[10px] font-medium text-gray-600">{m.label}</span>
            </div>
          ))}
          <div className="absolute bottom-0.5 left-1 text-[10px] font-medium text-gray-600">{endLabel}</div>
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
            <div className="relative flex-1 border-r border-gray-200 bg-white">
              {/* 시간 가이드 라인 */}
              {hourMarkers.map(m => (
                <div
                  key={m.label}
                  className="absolute left-0 w-full border-t border-gray-300"
                  style={{ top: `${m.topPercent}%` }}
                />
              ))}
              {/* 수업 블록들 */}
              {(blocksByRoom.get(room) || []).map(block => (
                <ClassBlock key={block.id} block={block} isWeekend={isWeekend} />
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
