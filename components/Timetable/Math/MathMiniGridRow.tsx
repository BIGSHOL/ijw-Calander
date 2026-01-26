// Math Mini Grid Row
// 영어 MiniGridRow와 동일한 디자인

import React from 'react';
import { MathPeriodInfo, MathScheduleCell } from './hooks/useMathIntegrationClasses';
import { Teacher } from '../../../types';

interface MathMiniGridRowProps {
    period: MathPeriodInfo;
    scheduleMap: Record<string, Record<string, MathScheduleCell>>;
    teachersData: Teacher[];
    displayDays: string[];
    hiddenTeachers?: string[];
    hideTime?: boolean;
    onlyTime?: boolean;
}

const MathMiniGridRow: React.FC<MathMiniGridRowProps> = ({
    period,
    scheduleMap,
    teachersData,
    displayDays,
    hiddenTeachers = [],
    hideTime = false,
    onlyTime = false,
}) => {
    const periodSchedule = scheduleMap[period.id] || {};

    // 강사 색상 가져오기
    const getTeacherColor = (teacherName: string): { bg: string; text: string } => {
        const teacher = teachersData.find(t => t.name === teacherName);
        if (teacher?.color) {
            return { bg: teacher.color, text: '#fff' };
        }
        return { bg: '#e5e7eb', text: '#374151' };
    };

    // Row height: 영어와 동일하게 28px
    const rowHeight = 'h-[28px]';

    if (onlyTime) {
        // 시간 컬럼만 표시 (sticky용)
        return (
            <div className={`flex items-center ${rowHeight} border-b border-gray-200`}>
                <div className="w-[48px] flex flex-col items-center justify-center px-0.5 border-r border-gray-300 h-full">
                    <div className="text-xxs font-bold text-gray-700 leading-none">{period.label}</div>
                    <div className="text-micro text-gray-400 leading-none">{period.time}</div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-center ${rowHeight} border-b border-gray-200 last:border-b-0`}>
            {/* 시간 컬럼 */}
            {!hideTime && (
                <div className="w-[48px] flex flex-col items-center justify-center px-0.5 border-r border-gray-300 h-full bg-gray-50">
                    <div className="text-xxs font-bold text-gray-700 leading-none">{period.label}</div>
                    <div className="text-micro text-gray-400 leading-none">{period.time}</div>
                </div>
            )}

            {/* 요일별 셀 */}
            {displayDays.map(day => {
                const cell = periodSchedule[day];

                if (!cell) {
                    return (
                        <div
                            key={day}
                            className="flex-1 min-w-[28px] h-full border-r border-gray-100 last:border-r-0"
                        />
                    );
                }

                // 숨김 강사 체크
                const isHidden = cell.teacher && hiddenTeachers.includes(cell.teacher);
                if (isHidden) {
                    return (
                        <div
                            key={day}
                            className="flex-1 min-w-[28px] h-full border-r border-gray-100 last:border-r-0"
                        />
                    );
                }

                const colors = cell.teacher ? getTeacherColor(cell.teacher) : { bg: '#f3f4f6', text: '#6b7280' };

                return (
                    <div
                        key={day}
                        className="flex-1 min-w-[28px] h-full flex items-center justify-center border-r border-gray-100 last:border-r-0 px-0.5"
                    >
                        <div
                            className="text-xxs font-bold px-1 py-0.5 rounded truncate max-w-full text-center"
                            style={{
                                backgroundColor: colors.bg,
                                color: colors.text,
                            }}
                            title={`${cell.teacher || ''} ${cell.room ? `(${cell.room})` : ''}`}
                        >
                            {cell.teacher || '-'}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MathMiniGridRow;
