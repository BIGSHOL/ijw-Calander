// English Room Schedule Tab
// 영어 강의실별 시간표 탭 - 자동 생성, 읽기 전용

import React, { useMemo, useState } from 'react';
import { EN_PERIODS, EN_WEEKDAYS, getContrastColor, formatClassNameWithBreaks } from './englishUtils';
import { ClassKeywordColor, Teacher } from '../../../types';

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

interface EnglishRoomTabProps {
    teachers: string[];
    scheduleData: ScheduleData;
    teachersData: Teacher[];
    classKeywords?: ClassKeywordColor[];  // For keyword color coding
    currentUser: any;
}

type ViewSize = 'small' | 'medium' | 'large';

const EnglishRoomTab: React.FC<EnglishRoomTabProps> = ({ teachers, scheduleData, teachersData, classKeywords = [], currentUser }) => {
    const [viewSize, setViewSize] = useState<ViewSize>('medium');
    const [filterRoom, setFilterRoom] = useState<string>('all');
    const [visibleWeekdays, setVisibleWeekdays] = useState<Set<string>>(new Set(EN_WEEKDAYS));

    // Extract unique rooms from schedule data
    const rooms = useMemo(() => {
        const roomSet = new Set<string>();
        Object.values(scheduleData).forEach(cell => {
            if (cell.room) roomSet.add(cell.room);
        });
        return Array.from(roomSet).sort((a, b) => a.localeCompare(b, 'ko'));
    }, [scheduleData]);

    // Filter rooms
    const filteredRooms = useMemo(() => {
        if (filterRoom === 'all') return rooms;
        return rooms.filter(r => r === filterRoom);
    }, [rooms, filterRoom]);

    // Filter weekdays
    const filteredWeekdays = useMemo(() => {
        return EN_WEEKDAYS.filter(day => visibleWeekdays.has(day));
    }, [visibleWeekdays]);

    // Toggle weekday visibility
    const toggleWeekday = (day: string) => {
        setVisibleWeekdays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(day)) {
                newSet.delete(day);
            } else {
                newSet.add(day);
            }
            return newSet;
        });
    };

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
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b flex-shrink-0 relative z-20">
                <div className="flex items-center gap-2">
                    {/* View Size Controls */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mr-2 flex-shrink-0">
                        <button
                            onClick={() => setViewSize('small')}
                            className={`px-2 py-0.5 text-xs font-bold rounded transition-all whitespace-nowrap ${viewSize === 'small' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            작게
                        </button>
                        <button
                            onClick={() => setViewSize('medium')}
                            className={`px-2 py-0.5 text-xs font-bold rounded transition-all whitespace-nowrap ${viewSize === 'medium' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            보통
                        </button>
                        <button
                            onClick={() => setViewSize('large')}
                            className={`px-2 py-0.5 text-xs font-bold rounded transition-all whitespace-nowrap ${viewSize === 'large' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            크게
                        </button>
                    </div>

                    {/* Room Filter */}
                    <select
                        value={filterRoom}
                        onChange={(e) => setFilterRoom(e.target.value)}
                        className="px-2 py-1 text-xs border rounded"
                    >
                        <option value="all">전체 강의실</option>
                        {rooms.map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>

                    <div className="h-6 w-px bg-gray-300 mx-2" />

                    {/* Weekday Visibility Toggles */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                        <span className="text-xxs text-gray-500 mr-1">요일:</span>
                        {EN_WEEKDAYS.map(day => (
                            <label key={day} className="flex items-center gap-0.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={visibleWeekdays.has(day)}
                                    onChange={() => toggleWeekday(day)}
                                    className="w-3 h-3 cursor-pointer"
                                />
                                <span className="text-xxs text-gray-700">{day}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <span className="text-xxs text-indigo-400 font-normal">
                    * 수정은 '강사별 시간표'에서만 가능합니다.
                </span>
            </div>

            {/* Schedule Grid */}
            <div className="flex-1 overflow-auto p-2 bg-gray-100">
                {filteredRooms.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        강의실 데이터가 없습니다.
                    </div>
                ) : (
                    <table className="border-collapse bg-white rounded shadow w-max table-fixed">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className="p-2 border bg-gray-100 text-xs font-bold text-gray-600" rowSpan={2}>교시</th>
                                {filteredRooms.map((room, rIdx) => (
                                    <th
                                        key={room}
                                        colSpan={filteredWeekdays.length}
                                        className={`p-2 bg-indigo-600 text-white text-xs font-bold
                                            ${rIdx === 0 ? 'border-l-2 border-l-gray-400' : 'border-l'}
                                            border-r border-t border-b
                                        `}
                                    >
                                        {room}
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                {filteredRooms.map((room, rIdx) => (
                                    filteredWeekdays.map((day, dIdx) => (
                                        <th
                                            key={`${room}-${day}`}
                                            className={`p-1 bg-gray-50 text-xxs text-gray-500
                                                ${viewSize === 'large' ? 'w-[100px]' : ''}
                                                ${viewSize === 'medium' ? 'w-[70px]' : ''}
                                                ${viewSize === 'small' ? 'w-[40px]' : ''}
                                                ${dIdx === 0 ? 'border-l-2 border-l-gray-400' : 'border-l'}
                                                border-r border-t border-b
                                            `}
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
                                        <div className="text-micro text-gray-400">{period.time}</div>
                                    </td>
                                    {filteredRooms.map((room, rIdx) => (
                                        filteredWeekdays.map((day, dIdx) => {
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

                                            // 셀 높이를 너비와 동일하게 설정 (정사각형)
                                            const cellHeightClass =
                                                viewSize === 'large' ? 'h-[100px]' :
                                                    viewSize === 'medium' ? 'h-[70px]' :
                                                        'h-[40px]';

                                            return (
                                                <td
                                                    key={cellKey}
                                                    className={`p-1 text-center ${cellHeightClass} ${!matchedKw && cellData?.className ? 'bg-indigo-50' : ''}
                                                        ${dIdx === 0 ? 'border-l-2 border-l-gray-400' : 'border-l'}
                                                        border-r border-t border-b
                                                    `}
                                                    style={cellBgStyle}
                                                >
                                                    {cellData?.className && (
                                                        <>
                                                            <div
                                                                className={`${viewSize === 'small' ? 'text-micro' : 'text-xxs'}`}
                                                                style={matchedKw ? { color: matchedKw.textColor } : { color: '#374151' }}
                                                            >
                                                                {formatClassNameWithBreaks(cellData.className).map((part, idx, arr) => (
                                                                    <React.Fragment key={idx}>
                                                                        {part}
                                                                        {idx < arr.length - 1 && <br />}
                                                                    </React.Fragment>
                                                                ))}
                                                            </div>
                                                            {viewSize !== 'small' && (
                                                                <div
                                                                    className="text-micro"
                                                                    style={{ color: matchedKw ? getContrastColor(matchedKw.bgColor) : '#9CA3AF', opacity: matchedKw ? 0.85 : 1 }}
                                                                >
                                                                    {cellData.teacher}
                                                                </div>
                                                            )}
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
