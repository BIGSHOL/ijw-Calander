import React from 'react';
import { ClassroomBlock, getBlockPosition } from '../types';
import { SUBJECT_LABELS } from '../../../utils/styleUtils';
import { CLASSROOM_COLORS } from '../constants';

interface ClassBlockProps {
  block: ClassroomBlock;
  isWeekend: boolean;
}

const ClassBlock: React.FC<ClassBlockProps> = ({ block, isWeekend }) => {
  const pos = getBlockPosition(block.startTime, block.endTime, isWeekend);
  const colors = CLASSROOM_COLORS[block.subject] || CLASSROOM_COLORS.math;

  // 충돌 시 나란히 배치: 가로 영역을 conflictTotal 등분
  const totalCols = block.conflictTotal || 1;
  const colIdx = block.conflictIndex || 0;
  const colWidthPercent = 100 / totalCols;
  const leftPercent = colIdx * colWidthPercent;

  return (
    <div
      className="absolute rounded px-1.5 py-1 cursor-default select-none shadow-sm overflow-hidden"
      style={{
        top: `${pos.top}%`,
        height: `${pos.height}%`,
        left: totalCols > 1 ? `${leftPercent}%` : '4px',
        width: totalCols > 1 ? `${colWidthPercent}%` : 'calc(100% - 8px)',
        minHeight: '20px',
        backgroundColor: block.hasConflict ? '#fef2f2' : colors.light,
        borderLeft: `3px solid ${block.hasConflict ? '#ef4444' : colors.bg}`,
        borderTop: `1px solid ${block.hasConflict ? '#ef4444' : colors.border}`,
        borderBottom: `1px solid ${block.hasConflict ? '#ef4444' : colors.border}`,
        borderRight: `1px solid ${block.hasConflict ? '#ef4444' : colors.border}`,
        zIndex: block.hasConflict ? 10 : 1,
      }}
    >
      <div className="flex flex-col justify-start h-full gap-0.5">
        <div className="text-[11px] font-bold leading-tight line-clamp-2" style={{ color: colors.bg }}>
          {block.hasConflict && <span className="mr-0.5 text-red-500">!!</span>}
          {block.className}
        </div>
        <div className="text-[9px] text-gray-500 leading-tight truncate">
          {SUBJECT_LABELS[block.subject]} | {block.teacher}
        </div>
        <div className="text-[9px] text-gray-400 leading-tight">
          {block.startTime}~{block.endTime}
        </div>
        {block.hasConflict && (
          <div className="text-[9px] text-red-500 font-semibold">충돌</div>
        )}
      </div>
    </div>
  );
};

export default ClassBlock;
