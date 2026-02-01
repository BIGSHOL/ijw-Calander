import React, { useMemo, useState } from 'react';
import { AssignmentSlot, RoomConfig } from '../types';
import { TimeConfig, makeTimeConfig, parseTimeToMinutes } from '../../Classroom/types';
import { AssignmentBlock } from './AssignmentBlock';

interface AssignmentGridProps {
  slots: AssignmentSlot[];
  rooms: RoomConfig[];
  conflictSlotIds: Set<string>;
  onSlotDrop: (slotId: string, targetRoom: string) => void;
  timeRange: { start: number; end: number };
}

interface TimeMarker {
  label: string;
  topPx: number; // 픽셀 기반
  isHour: boolean;
}

function getTimeMarkers(config: TimeConfig): TimeMarker[] {
  const markers: TimeMarker[] = [];
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

export const AssignmentGrid: React.FC<AssignmentGridProps> = ({
  slots,
  rooms,
  conflictSlotIds,
  onSlotDrop,
  timeRange,
}) => {
  const [dragOverRoom, setDragOverRoom] = useState<string | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<AssignmentSlot | null>(null);

  const config = useMemo(() => makeTimeConfig(timeRange.start, timeRange.end), [timeRange]);
  const timeMarkers = useMemo(() => getTimeMarkers(config), [config]);

  const handleDragStart = (e: React.DragEvent, slot: AssignmentSlot) => {
    e.dataTransfer.setData('text/plain', slot.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSlot(slot);
  };

  const handleDragOver = (e: React.DragEvent, roomName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverRoom(roomName);
  };

  const handleDragLeave = () => {
    setDragOverRoom(null);
  };

  const handleDrop = (e: React.DragEvent, roomName: string) => {
    e.preventDefault();
    const slotId = e.dataTransfer.getData('text/plain');
    if (slotId) {
      onSlotDrop(slotId, roomName);
    }
    setDragOverRoom(null);
    setDraggedSlot(null);
  };

  const handleDragEnd = () => {
    setDragOverRoom(null);
    setDraggedSlot(null);
  };

  // 슬롯을 강의실별로 그룹핑
  const slotsByRoom = useMemo(() => {
    const map = new Map<string, AssignmentSlot[]>();
    for (const slot of slots) {
      const room = slot.assignedRoom;
      if (!room) continue;
      if (!map.has(room)) map.set(room, []);
      map.get(room)!.push(slot);
    }
    return map;
  }, [slots]);

  // 미배정 슬롯
  const unassignedSlots = useMemo(() => slots.filter(s => !s.assignedRoom), [slots]);

  const displayRooms = rooms.map(r => r.name);

  if (displayRooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm bg-white">
        강의실 데이터가 없습니다
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* 미배정 슬롯 영역 */}
      {unassignedSlots.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <div className="text-xxs font-semibold text-amber-700 mb-1">
            미배정 수업 ({unassignedSlots.length}개) - 아래 강의실로 드래그하세요
          </div>
          <div className="flex flex-wrap gap-1">
            {unassignedSlots.map(slot => (
              <div
                key={slot.id}
                draggable
                onDragStart={(e) => handleDragStart(e, slot)}
                onDragEnd={handleDragEnd}
                className="px-2 py-1 bg-white border border-amber-300 rounded text-xxs cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
              >
                <span className="font-medium">{slot.className}</span>
                <span className="text-gray-400 ml-1">{slot.teacher}</span>
                <span className="text-gray-400 ml-1">{slot.startTime}~{slot.endTime}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 그리드 (고정 높이 기반 레이아웃 + Sticky 스크롤) */}
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
                    ? '-top-2.5 text-xxs font-semibold text-gray-700'
                    : '-top-1.5 text-nano text-gray-400'
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
              const roomSlots = (slotsByRoom.get(room) || [])
                .filter(b => b.endMinutes > config.start && b.startMinutes < config.end);
              const isDragTarget = dragOverRoom === room;
              const wouldConflict = draggedSlot && isDragTarget && roomSlots.some(
                s => s.startMinutes < draggedSlot.endMinutes &&
                  draggedSlot.startMinutes < s.endMinutes &&
                  s.classId !== draggedSlot.classId
              );

              return (
                <div
                  key={room}
                  className="relative flex flex-col w-[180px] flex-shrink-0 border-r border-gray-200"
                  onDragOver={(e) => handleDragOver(e, room)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, room)}
                >
                  {/* 헤더 (세로 스크롤 시 상단 고정) */}
                  <div className={`sticky top-0 z-10 flex items-center justify-center h-9 border-b border-gray-300 px-2 transition-colors shadow-sm ${isDragTarget
                    ? wouldConflict ? 'bg-red-100' : 'bg-blue-100'
                    : 'bg-gray-100'
                    }`}>
                    <span className="text-xs font-bold text-gray-800 truncate">{room}</span>
                  </div>

                  {/* 그리드 본체 */}
                  <div
                    className={`relative flex-1 overflow-hidden transition-colors ${isDragTarget
                      ? wouldConflict ? 'bg-red-50' : 'bg-blue-50'
                      : 'bg-white'
                      }`}
                  >
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
                    {roomSlots.map(slot => (
                      <AssignmentBlock
                        key={slot.id}
                        slot={slot}
                        config={config}
                        hasConflict={conflictSlotIds.has(slot.id)}
                        onDragStart={handleDragStart}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
