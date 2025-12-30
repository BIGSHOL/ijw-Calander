// English Room Schedule Tab
// 영어 강의실별 시간표 탭 - 자동 생성, 읽기 전용

import React, { useMemo } from 'react';
import { EN_PERIODS, EN_WEEKDAYS, getContrastColor } from './englishUtils';
import { ClassKeywordColor } from '../../../types';

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

interface EnglishRoomTabProps {
    scheduleData: ScheduleData;
    classKeywords?: ClassKeywordColor[];  // For keyword color coding
}

const EnglishRoomTab: React.FC<EnglishRoomTabProps> = ({ scheduleData, classKeywords = [] }) => {
    // Extract unique rooms from schedule data
    const rooms = useMemo(() => {
        const roomSet = new Set<string>();
        Object.values(scheduleData).forEach(cell => {
            if (cell.room) roomSet.add(cell.room);
        });
        return Array.from(roomSet).sort((a, b) => a.localeCompare(b, 'ko'));
    }, [scheduleData]);

    // Transform data to room-based view
    const roomScheduleData = useMemo(() => {
        const result: Record<string, ScheduleCell> = {};

        Object.entries(scheduleData).forEach(([key, cell]) => {
            if (!cell.room || !cell.className) return;

            const parts = key.split('-');
            if (parts.length !== 3) return;
            const [teacher, periodId, day] = parts;

            // New key: room-period-day
            const roomKey = `${cell.room}-${periodId}-${day}`;
            result[roomKey] = {
                ...cell,
                teacher: teacher,
            };
        });

        return result;
    }, [scheduleData]);

    // Get cell key for room view
    const getCellKey = (room: string, periodId: string, day: string) => {
        return `${room}-${periodId}-${day}`;
    };

    return (
        <div className="flex flex-col h-full">
            {/* Info Bar */}
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700 font-bold flex justify-between items-center flex-shrink-0">
                <span>🚪 강의실별 시간표 (자동 생성)</span>
                <span className="text-[10px] text-indigo-400 font-normal">
                    * 수정은 '강사별 시간표'에서만 가능합니다.
                </span>
            </div>

            {/* Schedule Grid */}
            <div className="flex-1 overflow-auto p-2 bg-gray-100">
                {rooms.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        강의실 데이터가 없습니다.
                    </div>
                ) : (
                    <table className="border-collapse bg-white rounded shadow">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className="p-2 border bg-gray-100 text-xs font-bold text-gray-600" rowSpan={2}>교시</th>
                                {rooms.map(room => (
                                    <th
                                        key={room}
                                        colSpan={EN_WEEKDAYS.length}
                                        className="p-2 border bg-indigo-600 text-white text-xs font-bold"
                                    >
                                        {room}
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                {rooms.map(room => (
                                    EN_WEEKDAYS.map(day => (
                                        <th
                                            key={`${room}-${day}`}
                                            className="p-1 border bg-gray-50 text-[10px] font-bold text-gray-500 min-w-[60px]"
                                        >
                                            {day}
                                        </th>
                                    ))
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {EN_PERIODS.map(period => (
                                <tr key={period.id}>
                                    <td className="p-2 border bg-gray-50 text-xs font-bold text-gray-600 text-center whitespace-nowrap">
                                        <div>{period.label}</div>
                                        <div className="text-[9px] text-gray-400">{period.time}</div>
                                    </td>
                                    {rooms.map(room => (
                                        EN_WEEKDAYS.map(day => {
                                            const cellKey = getCellKey(room, period.id, day);
                                            const cellData = roomScheduleData[cellKey];

                                            // 키워드 색상 매칭
                                            const matchedKw = cellData?.className
                                                ? classKeywords.find(kw => cellData.className?.includes(kw.keyword))
                                                : null;

                                            // 셀 배경 스타일
                                            const cellBgStyle = matchedKw
                                                ? { backgroundColor: matchedKw.bgColor }
                                                : {};

                                            return (
                                                <td
                                                    key={cellKey}
                                                    className={`p-1 border text-center min-h-[40px] ${!matchedKw && cellData?.className ? 'bg-indigo-50' : ''}`}
                                                    style={cellBgStyle}
                                                >
                                                    {cellData?.className && (
                                                        <>
                                                            <div
                                                                className="text-[10px] font-bold"
                                                                style={matchedKw ? { color: matchedKw.textColor } : { color: '#374151' }}
                                                            >
                                                                {cellData.className}
                                                            </div>
                                                            <div
                                                                className="text-[9px]"
                                                                style={{ color: matchedKw ? getContrastColor(matchedKw.bgColor) : '#9CA3AF', opacity: matchedKw ? 0.85 : 1 }}
                                                            >
                                                                {cellData.teacher}
                                                            </div>
                                                        </>
                                                    )}
                                                </td>
                                            );
                                        })
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default EnglishRoomTab;
