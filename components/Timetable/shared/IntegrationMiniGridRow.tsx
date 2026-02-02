// Shared Integration Mini Grid Row
// 영어/수학 통합뷰 공용 미니그리드 행

import React from 'react';
import { Teacher } from '../../../types';
import { getTeacherColor } from '../English/englishUtils';

// 공용 교시 정보 타입
export interface PeriodInfo {
    id: string;
    label: string;
    time: string;
}

// 공용 스케줄 셀 타입
export interface ScheduleCell {
    className?: string;
    classId?: string;
    room?: string;
    teacher?: string;
    underline?: boolean;
}

interface IntegrationMiniGridRowProps {
    period: PeriodInfo;
    scheduleMap: Record<string, Record<string, ScheduleCell>>;
    teachersData: Teacher[];
    displayDays: string[];
    hiddenTeachers?: string[];
    hideTime?: boolean;
    onlyTime?: boolean;
    weekendShift?: number;  // 영어 전용 (기본값 0)
}

const IntegrationMiniGridRow: React.FC<IntegrationMiniGridRowProps> = ({
    period,
    scheduleMap,
    teachersData,
    displayDays,
    hiddenTeachers = [],
    hideTime = false,
    onlyTime = false,
    weekendShift = 0,
}) => {
    // 시간 파싱 (예: "14:20~15:00" -> ["14:20", "15:00"])
    const timeParts = period.time.split('~');
    const startTime = timeParts[0] || '';
    const endTime = timeParts[1] || '';

    if (onlyTime) {
        // 시간 컬럼만 표시 (sticky용)
        return (
            <div className="flex border-b border-gray-100 h-[32px]">
                <div className="w-[48px] border-r border-gray-100 flex flex-col items-center justify-center bg-gray-50 shrink-0 py-0.5">
                    <span className="text-micro font-bold text-gray-700 tracking-tighter leading-none">{startTime}</span>
                    <span className="text-micro text-gray-500 tracking-tighter leading-none">~{endTime}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex border-b border-gray-100 h-[32px]">
            {/* 시간 컬럼 */}
            {!hideTime && (
                <div className="w-[48px] border-r border-gray-100 flex flex-col items-center justify-center bg-gray-50 shrink-0 py-0.5">
                    <span className="text-micro font-bold text-gray-700 tracking-tighter leading-none">{startTime}</span>
                    <span className="text-micro text-gray-500 tracking-tighter leading-none">~{endTime}</span>
                </div>
            )}

            {/* 요일별 셀 */}
            {displayDays.map(day => {
                const dayIndex = ['월', '화', '수', '목', '금', '토', '일'].indexOf(day);
                const isWeekend = dayIndex >= 5;

                // 주말 시프트 로직 (영어용)
                let effectivePeriodId = period.id;
                if (isWeekend && weekendShift > 0) {
                    const currentNum = parseInt(period.id, 10);
                    if (!isNaN(currentNum)) {
                        effectivePeriodId = String(currentNum - weekendShift);
                    }
                }

                const cell = scheduleMap[effectivePeriodId]?.[day];
                const isHidden = cell?.teacher && hiddenTeachers.includes(cell.teacher);

                // 강사 데이터 및 표시 이름
                const teacherData = cell?.teacher ? teachersData.find(t => t.name === cell.teacher || t.englishName === cell.teacher) : null;
                const displayName = teacherData?.englishName || cell?.teacher || '';

                // 스타일
                let cellStyle: React.CSSProperties = {};
                if (cell?.teacher && !isHidden) {
                    const colors = getTeacherColor(cell.teacher, teachersData);
                    if (cell.underline) {
                        cellStyle = { backgroundColor: colors.bg, color: '#2563eb' };
                    } else {
                        cellStyle = { backgroundColor: colors.bg, color: colors.text };
                    }
                } else if (isWeekend) {
                    // 주말 빈 셀은 회색 배경
                    cellStyle = { backgroundColor: '#f3f4f6' };
                }

                return (
                    <div
                        key={day}
                        className={`flex-1 border-r border-gray-100 last:border-r-0 flex flex-col justify-center items-center text-center px-0.5 overflow-hidden text-xxs ${isWeekend && !cell?.teacher ? 'bg-gray-100' : ''}`}
                        style={cellStyle}
                        title={displayName}
                    >
                        {cell && !isHidden && (
                            <span className={`leading-tight whitespace-nowrap ${cell.underline ? 'underline italic' : ''}`}>
                                {displayName.slice(0, 4)}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default IntegrationMiniGridRow;
