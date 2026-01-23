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
  topPx: number; // 픽셀 기반
  isHour: boolean;
}

function getTimeMarkers(config: TimeConfig): TimeMarker[] {
  const markers: TimeMarker[] = [];
  // 시작점을 10분 단위로 올림
  const firstTick = Math.ceil((config.start + 1) / 10) * 10;
  for (let m = firstTick; m < config.end; m += 10) {
    const topPx = ((m - config.start) / config.range) * config.totalHeight;
    const hour = Math.floor(m / 60);
    const min = m % 60;
    const isHour = min === 0;
    markers.push({
      label: `${hour}:${String(min).padStart(2, '0')}`,
      topPx,
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
    // 최상위 컨테이너가 가로/세로 스크롤 모두 담당
    <div className="flex-1 min-h-0 overflow-auto bg-white relative">
      <div className="flex" style={{ minWidth: 'min-content', height: `${config.totalHeight + 36}px` }}> {/* 36px = header height */}

        {/* 시간 축 (가로 스크롤 시 좌측 고정) */}
        <div className="sticky left-0 z-20 flex-shrink-0 w-12 border-r border-gray-300 bg-gray-50">
          {/* 시간축 헤더 빈 공간 (세로 스크롤 시 상단 고정) */}
          <div className="sticky top-0 z-30 h-9 border-b border-gray-300 bg-gray-50" />

          {/* 시간 마커들 */}
          <div className="relative w-full h-full">
            {timeMarkers.map(m => (
              <div
                key={m.label}
                className="absolute left-0 w-full"
                style={{ top: `${m.topPx}px` }}
              >
                <span className={`absolute left-1 ${m.isHour
                  ? '-top-2.5 text-[10px] font-semibold text-gray-700'
                  : '-top-1.5 text-[8px] text-gray-400'
                  }`}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 강의실 컬럼들 */}
        <div className="flex">
          {displayRooms.map(room => {
            const isIgnored = ignoredRooms.has(room);
            const fixedWidth = isIgnored ? 'w-[480px]' : 'w-[180px]';
            return (
              <div key={room} className={`relative flex flex-col ${fixedWidth} flex-shrink-0 border-r border-gray-200`}>

                {/* 헤더 (세로 스크롤 시 상단 고정) */}
                <div className="sticky top-0 z-10 flex items-center justify-center h-9 border-b border-gray-300 bg-gray-100 px-2 shadow-sm">
                  <span className="text-xs font-bold text-gray-800 truncate">{room}</span>
                </div>

                {/* 그리드 본체 */}
                <div className="relative bg-white overflow-hidden flex-1">
                  {/* 시간 가이드 라인 */}
                  {timeMarkers.map(m => (
                    <div
                      key={m.label}
                      className={`absolute left-0 w-full border-t ${m.isHour ? 'border-gray-300' : 'border-gray-100'
                        }`}
                      style={{ top: `${m.topPx}px` }}
                    />
                  ))}
                  {/* 수업 블록들 */}
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
    </div>
  );
};

export default ClassroomGrid;
