import React from 'react';
import { AssignmentSlot } from '../types';
import { TimeConfig, parseTimeToMinutes } from '../../Classroom/types';
import { SUBJECT_LABELS } from '../../../utils/styleUtils';
import { CLASSROOM_COLORS } from '../../Classroom/constants';

interface AssignmentBlockProps {
  slot: AssignmentSlot;
  config: TimeConfig;
  hasConflict: boolean;
  onDragStart: (e: React.DragEvent, slot: AssignmentSlot) => void;
}

export const AssignmentBlock: React.FC<AssignmentBlockProps> = React.memo(({
  slot,
  config,
  hasConflict,
  onDragStart,
}) => {
  const startMin = parseTimeToMinutes(slot.startTime);
  const endMin = parseTimeToMinutes(slot.endTime);
  // 픽셀 기반 위치 계산 (시간당 고정 높이)
  const pos = {
    top: ((startMin - config.start) / config.range) * config.totalHeight,
    height: ((endMin - startMin) / config.range) * config.totalHeight,
  };
  const colors = CLASSROOM_COLORS[slot.subject] || CLASSROOM_COLORS.math;

  // 배정 소스에 따른 시각적 구분
  const isAuto = slot.assignmentSource === 'auto';
  const isManual = slot.assignmentSource === 'manual';
  const showBadge = isAuto || isManual;

  const bgColor = hasConflict
    ? '#fffbeb'
    : isAuto
      ? '#ecfdf5'  // emerald-50
      : isManual
        ? '#fffbeb' // amber-50
        : colors.light;

  const borderColor = hasConflict
    ? '#f59e0b'
    : isAuto
      ? '#10b981'  // emerald-500
      : isManual
        ? '#f59e0b' // amber-500
        : colors.bg;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, slot)}
      className={`absolute rounded px-1.5 py-1 cursor-grab active:cursor-grabbing select-none shadow-sm overflow-hidden hover:brightness-95 transition-[filter]`}
      style={{
        top: `${pos.top}px`,
        height: `${pos.height}px`,
        left: '4px',
        width: 'calc(100% - 8px)',
        minHeight: '20px',
        backgroundColor: bgColor,
        borderLeft: `3px solid ${borderColor}`,
        borderTop: `1px solid ${hasConflict ? '#fbbf24' : isAuto ? '#6ee7b7' : isManual ? '#fbbf24' : colors.border}`,
        borderBottom: `1px solid ${hasConflict ? '#fbbf24' : isAuto ? '#6ee7b7' : isManual ? '#fbbf24' : colors.border}`,
        borderRight: `1px solid ${hasConflict ? '#fbbf24' : isAuto ? '#6ee7b7' : isManual ? '#fbbf24' : colors.border}`,
        zIndex: hasConflict ? 10 : 1,
      }}
    >
      {/* 배정 소스 배지 */}
      {showBadge && (
        <div className={`absolute top-0.5 right-0.5 text-white text-[8px] font-bold px-1 rounded-sm leading-tight ${isAuto ? 'bg-emerald-500' : 'bg-amber-500'
          }`}>
          {isAuto ? '자동' : '수동'}
        </div>
      )}
      {hasConflict && (
        <div className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[8px] font-bold px-1 rounded-sm leading-tight">
          충돌
        </div>
      )}
      <div className="flex flex-col justify-start h-full gap-0.5">
        <div className="text-[11px] font-bold leading-tight line-clamp-2" style={{ color: hasConflict ? '#b45309' : isAuto ? '#059669' : colors.bg }}>
          {hasConflict && <span className="mr-0.5">⚠</span>}
          {slot.className}
        </div>
        <div className="text-[9px] text-gray-500 leading-tight truncate">
          {SUBJECT_LABELS[slot.subject]} | {slot.teacher}
        </div>
        <div className="text-[9px] text-gray-400 leading-tight">
          {slot.startTime}~{slot.endTime}
        </div>
        {slot.studentCount > 0 && (
          <div className="text-[9px] text-gray-400 leading-tight">
            {slot.studentCount}명
          </div>
        )}
      </div>
    </div>
  );
});
