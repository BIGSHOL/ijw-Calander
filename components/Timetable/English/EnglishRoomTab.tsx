// English Room Schedule Tab
// 영어 강의실별 시간표 탭 - 자동 생성, 읽기 전용

import React, { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { EN_PERIODS, EN_WEEKDAYS, getContrastColor, formatClassNameWithBreaks } from './englishUtils';
import { ClassKeywordColor, Teacher } from '../../../types';
import PortalTooltip from '../../Common/PortalTooltip';
import { useClassStudents } from './hooks/useClassStudents';

interface MergedClass {
    className: string;
    classId?: string;
    room: string;
    underline?: boolean;
    lastMovedAt?: string;
}

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: MergedClass[];
    underline?: boolean;
    lastMovedAt?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

type ViewSize = 'small' | 'medium' | 'large';

interface EnglishRoomTabProps {
    teachers: string[];
    scheduleData: ScheduleData;
    teachersData: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
    labRooms?: string[];
    studentMap?: Record<string, any>;
    currentWeekStart?: Date;  // 주차 시작일 (날짜 표시용)
    // 부모(EnglishTimetable)에서 관리하는 뷰 설정
    viewSize?: ViewSize;
    visibleWeekdays?: Set<string>;
    filterRoom?: string;  // 강의실 필터 (부모에서 관리)
}

const EnglishRoomTab: React.FC<EnglishRoomTabProps> = ({ teachers, scheduleData, teachersData, classKeywords = [], currentUser, labRooms = [], studentMap = {}, currentWeekStart, viewSize = 'medium', visibleWeekdays: propVisibleWeekdays, filterRoom: propFilterRoom = 'all' }) => {
    // 부모에서 전달받은 visibleWeekdays 사용 (없으면 전체 요일)
    const visibleWeekdays = propVisibleWeekdays || new Set(EN_WEEKDAYS);
    // 강의실 필터는 부모에서 관리
    const filterRoom = propFilterRoom;

    // localStorage에서 강의실 순서 로드
    const roomOrder = useMemo<string[]>(() => {
        try {
            const saved = localStorage.getItem('english_room_order');
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return [];
    }, []);

    // Extract unique rooms from schedule data, apply custom order
    const rooms = useMemo(() => {
        const roomSet = new Set<string>();
        Object.values(scheduleData).forEach(cell => {
            if (cell.room) roomSet.add(cell.room);
        });
        const allRooms = Array.from(roomSet);

        if (roomOrder.length === 0) {
            return allRooms.sort((a, b) => a.localeCompare(b, 'ko'));
        }

        // roomOrder 순서 적용
        const ordered: string[] = [];
        roomOrder.forEach(r => {
            if (allRooms.includes(r)) ordered.push(r);
        });
        allRooms.forEach(r => {
            if (!ordered.includes(r)) ordered.push(r);
        });
        return ordered;
    }, [scheduleData, roomOrder]);

    // Filter rooms
    const filteredRooms = useMemo(() => {
        if (filterRoom === 'all') return rooms;
        return rooms.filter(r => r === filterRoom);
    }, [rooms, filterRoom]);

    // Filter weekdays
    const filteredWeekdays = useMemo(() => {
        return EN_WEEKDAYS.filter(day => visibleWeekdays.has(day));
    }, [visibleWeekdays]);

    // 요일별 날짜 계산 (2/12 형식)
    const weekDates = useMemo(() => {
        if (!currentWeekStart) return {};
        const dayToIndex: Record<string, number> = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
        const dates: Record<string, string> = {};
        EN_WEEKDAYS.forEach(day => {
            const idx = dayToIndex[day];
            if (idx !== undefined) {
                const date = addDays(currentWeekStart, idx);
                dates[day] = format(date, 'M/d');
            }
        });
        return dates;
    }, [currentWeekStart]);

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

            if (result[roomKey]) {
                // 같은 강의실-교시-요일에 이미 수업이 있으면 merged로 추가
                const existing = result[roomKey];
                const existingMerged = existing.merged || [];
                result[roomKey] = {
                    ...existing,
                    merged: [
                        ...existingMerged,
                        { className: cell.className, room: cell.room, underline: cell.underline, lastMovedAt: (cell as any).lastMovedAt },
                    ],
                };
            } else {
                result[roomKey] = {
                    ...cell,
                    teacher: teacher,
                };
            }
        });

        return result;
    }, [scheduleData]);

    // LAB실 수업명 목록 추출 (학생수 조회용)
    const labClassNames = useMemo(() => {
        if (labRooms.length === 0) return [];
        const classNameSet = new Set<string>();
        Object.entries(roomScheduleData).forEach(([key, cell]) => {
            const roomName = key.split('-')[0];
            if (!labRooms.includes(roomName)) return;
            if (cell.className) classNameSet.add(cell.className);
            cell.merged?.forEach(m => {
                if (m.className) classNameSet.add(m.className);
            });
        });
        return Array.from(classNameSet);
    }, [roomScheduleData, labRooms]);

    // LAB실 학생수 조회
    const { classDataMap } = useClassStudents(labClassNames, false, studentMap);

    // 학생수 헬퍼: 퇴원/휴원 제외 재원 학생수
    // slotUnderline: 슬롯의 밑줄 여부 → 밑줄 슬롯이면 밑줄 학생만, 비밑줄 슬롯이면 비밑줄 학생만 카운트
    const getActiveStudentCount = (className: string, slotUnderline?: boolean): number => {
        const data = classDataMap[className];
        if (!data) return 0;
        const active = data.studentList.filter(s => !s.withdrawalDate && !s.onHold);

        // 밑줄 정보가 있고, 해당 수업에 밑줄 학생이 존재하면 필터링
        if (slotUnderline !== undefined) {
            const hasAnyUnderline = active.some(s => s.underline);
            if (hasAnyUnderline) {
                return active.filter(s => !!s.underline === slotUnderline).length;
            }
        }
        return active.length;
    };

    // Get cell key for room view
    const getCellKey = (room: string, periodId: string, day: string) => {
        return `${room}-${periodId}-${day}`;
    };

    return (
        <div className="flex flex-col h-full">
            {/* Schedule Grid */}
            <div className="flex-1 overflow-auto p-2 bg-gray-100">
                {filteredRooms.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        강의실 데이터가 없습니다.
                    </div>
                ) : (
                    <table className="border-collapse bg-white shadow w-max table-fixed">
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
                                        {labRooms.includes(room) && (
                                            <span className="ml-1 text-micro opacity-75">LAB</span>
                                        )}
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
                                            {weekDates[day] ? `${weekDates[day]} (${day})` : day}
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
                                            const isLabRoom = labRooms.includes(room);

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

                                            // LAB실 학생수 계산
                                            let mainCount = 0;
                                            let totalCount = 0;
                                            if (isLabRoom && cellData?.className) {
                                                mainCount = getActiveStudentCount(cellData.className, cellData.underline);
                                                totalCount = mainCount;
                                                if (cellData.merged && cellData.merged.length > 0) {
                                                    cellData.merged.forEach(m => {
                                                        totalCount += getActiveStudentCount(m.className, m.underline);
                                                    });
                                                }
                                            }

                                            return (
                                                <td
                                                    key={cellKey}
                                                    className={`p-1 text-center relative ${cellHeightClass} ${!matchedKw && cellData?.className ? 'bg-indigo-50' : ''}
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

                                                            {/* LAB실 학생수 표시 */}
                                                            {isLabRoom && totalCount > 0 && (
                                                                <div className="absolute bottom-0.5 left-0.5 bg-indigo-600 text-white text-micro font-bold px-1 rounded-sm shadow-sm z-10 leading-tight">
                                                                    {totalCount}명
                                                                </div>
                                                            )}

                                                            {/* Merged Badge & Tooltip */}
                                                            {cellData.merged && cellData.merged.length > 0 && (
                                                                <PortalTooltip
                                                                    position="top"
                                                                    triggerClassName="absolute top-0.5 right-0.5 bg-red-500 text-white text-micro font-bold px-1 rounded-sm shadow-sm z-20 cursor-help pointer-events-auto hover:scale-110 transition-transform"
                                                                    content={
                                                                        <div className="w-48 bg-slate-800 text-white p-2 rounded-sm shadow-xl z-50 text-left pointer-events-none">
                                                                            <div className="flex justify-between items-center bg-slate-700/50 px-2 py-1 -mx-2 -mt-2 mb-2 rounded-t border-b border-slate-700">
                                                                                <span className="text-xxs font-bold text-slate-300">합반 수업 목록</span>
                                                                                <span className="text-micro bg-slate-700 px-1 rounded-sm ml-1 text-slate-400">총 {cellData.merged.length + 1}개</span>
                                                                            </div>
                                                                            <div className="flex flex-col gap-1.5">
                                                                                {/* 메인 수업 */}
                                                                                <div className="flex justify-between items-center">
                                                                                    <div className="text-xxs font-bold text-slate-200">{cellData.className}</div>
                                                                                    <div className="flex items-center gap-1">
                                                                                        {isLabRoom && <span className="text-micro text-indigo-300">{mainCount}명</span>}
                                                                                        {cellData.room && <span className="text-micro bg-slate-700 px-1.5 py-0.5 rounded-sm text-blue-300 font-mono">{cellData.room}</span>}
                                                                                    </div>
                                                                                </div>
                                                                                {/* 합반 수업들 */}
                                                                                {cellData.merged.map((m, idx) => {
                                                                                    const isMoved = m.lastMovedAt && (() => {
                                                                                        const diff = new Date().getTime() - new Date(m.lastMovedAt!).getTime();
                                                                                        return diff / (1000 * 60 * 60 * 24) <= 14;
                                                                                    })();
                                                                                    const mCount = isLabRoom ? getActiveStudentCount(m.className, m.underline) : 0;
                                                                                    return (
                                                                                        <div key={idx} className="flex justify-between items-center" style={isMoved ? { backgroundColor: '#dcfce7', padding: '2px', borderRadius: '4px' } : {}}>
                                                                                            <div className={`text-xxs font-bold ${isMoved ? 'text-green-800' : 'text-slate-200'}`}>{m.className}</div>
                                                                                            <div className="flex items-center gap-1">
                                                                                                {isLabRoom && mCount > 0 && <span className="text-micro text-indigo-300">{mCount}명</span>}
                                                                                                {m.room && <span className="text-micro bg-slate-700 px-1.5 py-0.5 rounded-sm text-blue-300 font-mono">{m.room}</span>}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            {/* 합산 */}
                                                                            {isLabRoom && totalCount > 0 && (
                                                                                <div className="mt-1.5 pt-1.5 border-t border-slate-700 flex justify-between items-center">
                                                                                    <span className="text-micro text-slate-400">합계</span>
                                                                                    <span className="text-xxs font-bold text-indigo-300">{totalCount}명</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 transform"></div>
                                                                        </div>
                                                                    }
                                                                >
                                                                    +{cellData.merged.length}
                                                                </PortalTooltip>
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
