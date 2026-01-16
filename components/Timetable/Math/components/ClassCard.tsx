import React, { useMemo, useState } from 'react';
import { TimetableClass, ClassKeywordColor } from '../../../../types';
import { getSubjectTheme } from '../utils/gridUtils';
import { Clock } from 'lucide-react';
import { MATH_PERIOD_INFO, MATH_PERIOD_TIMES, WEEKEND_PERIOD_INFO, WEEKEND_PERIOD_TIMES } from '../../constants';

interface ClassCardProps {
    cls: TimetableClass;
    span: number;
    searchQuery: string;
    showStudents: boolean;
    showClassName: boolean;
    showSchool: boolean;
    showGrade: boolean;
    canEdit: boolean;
    dragOverClassId: string | null;
    onClick: (cls: TimetableClass) => void;
    onDragStart: (e: React.DragEvent, studentId: string, fromClassId: string) => void;
    onDragOver: (e: React.DragEvent, classId: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, toClassId: string) => void;
    studentMap: Record<string, any>;
    classKeywords?: ClassKeywordColor[];
    onStudentClick?: (studentId: string) => void;
}

const ClassCard: React.FC<ClassCardProps> = ({
    cls,
    span,
    searchQuery,
    showStudents,
    showClassName,
    showSchool,
    showGrade,
    canEdit,
    dragOverClassId,
    onClick,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    studentMap,
    classKeywords = [],
    onStudentClick
}) => {
    const theme = getSubjectTheme(cls.subject);
    const [showScheduleTooltip, setShowScheduleTooltip] = useState(false);

    // 수업 스케줄 정보 생성 (마우스 오버 툴팁용)
    const scheduleInfo = useMemo(() => {
        if (!cls.schedule || cls.schedule.length === 0) return [];

        const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
        const scheduleByDay: Record<string, { periods: string[]; times: string[] }> = {};

        // schedule 배열에서 요일별 교시와 시간 정보 추출
        // schedule 형식: ["월 1-1", "목 1-2"] 또는 ["월 1", "목 2"]
        cls.schedule.forEach(item => {
            const parts = item.split(' ');
            if (parts.length < 2) return;

            const day = parts[0];
            const periodId = parts[1];

            if (!scheduleByDay[day]) {
                scheduleByDay[day] = { periods: [], times: [] };
            }

            const isWeekend = day === '토' || day === '일';

            // 레거시 형식(1-1, 1-2) 또는 통일된 형식(1, 2) 모두 지원
            let timeStr = '';
            if (isWeekend) {
                timeStr = WEEKEND_PERIOD_TIMES[periodId] || WEEKEND_PERIOD_INFO[periodId]?.time || '';
            } else {
                timeStr = MATH_PERIOD_TIMES[periodId] || MATH_PERIOD_INFO[periodId]?.time || '';
            }
            if (!timeStr) return;

            if (!scheduleByDay[day].periods.includes(periodId)) {
                scheduleByDay[day].periods.push(periodId);
                scheduleByDay[day].times.push(timeStr);
            }
        });

        // 요일 순서대로 정렬하여 반환
        const sortedDays = Object.keys(scheduleByDay).sort(
            (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
        );

        return sortedDays.map(day => {
            const info = scheduleByDay[day];
            const validTimes = info.times.filter(t => t && t.includes('~'));
            if (validTimes.length === 0) return { day, timeRange: '시간 미정' };

            // 시간 순서대로 정렬
            const sortedIndices = info.periods
                .map((p, i) => ({ period: p, index: i }))
                .filter(item => info.times[item.index] && info.times[item.index].includes('~'))
                .sort((a, b) => {
                    const timeA = info.times[a.index].split('~')[0];
                    const timeB = info.times[b.index].split('~')[0];
                    return timeA.localeCompare(timeB);
                });

            if (sortedIndices.length === 0) return { day, timeRange: '시간 미정' };

            const sortedTimes = sortedIndices.map(item => info.times[item.index]);
            const firstTime = sortedTimes[0];
            const lastTime = sortedTimes[sortedTimes.length - 1];

            const startTime = firstTime.split('~')[0];
            const endTime = lastTime.split('~')[1];

            const timeRange = sortedTimes.length > 1
                ? `${startTime}~${endTime}`
                : firstTime;

            return { day, timeRange };
        }).filter(item => item.timeRange !== '시간 미정');
    }, [cls.schedule]);

    // 키워드 매칭으로 색상 결정
    const matchedKeyword = useMemo(() => {
        return classKeywords.find(kw => cls.className?.includes(kw.keyword));
    }, [cls.className, classKeywords]);
    const hasSearchMatch = searchQuery && cls.studentList?.some(s => s.name.includes(searchQuery));

    // 학생 목록을 재원생, 대기생, 퇴원생으로 분류
    const { activeStudents, holdStudents, withdrawnStudents } = useMemo(() => {
        let allStudents: any[] = [];

        if (cls.studentIds && cls.studentIds.length > 0) {
            allStudents = cls.studentIds
                .map(id => studentMap[id])
                .filter(Boolean);
        } else if (cls.studentList && cls.studentList.length > 0) {
            allStudents = [...cls.studentList];
        }

        const active = allStudents
            .filter(s => !s.withdrawalDate && !s.onHold)
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        const hold = allStudents
            .filter(s => s.onHold && !s.withdrawalDate)
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        const withdrawn = allStudents
            .filter(s => s.withdrawalDate)
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        return { activeStudents: active, holdStudents: hold, withdrawnStudents: withdrawn };
    }, [cls.studentIds, cls.studentList, studentMap]);

    // 카드 전체 배경색 스타일 (키워드 색상 또는 흰색)
    const cardBgStyle = matchedKeyword
        ? { backgroundColor: matchedKeyword.bgColor }
        : { backgroundColor: '#ffffff' };

    return (
        <div
            onClick={() => canEdit && onClick(cls)}
            onDragOver={(e) => canEdit && onDragOver(e, cls.id)}
            onDragLeave={canEdit ? onDragLeave : undefined}
            onDrop={(e) => canEdit && onDrop(e, cls.id)}
            className={`flex flex-col h-full overflow-hidden transition-all hover:brightness-95 ${dragOverClassId === cls.id ? 'ring-2 ring-indigo-400 scale-[1.02]' : (canEdit ? 'cursor-pointer' : '')} ${hasSearchMatch ? 'ring-2 ring-yellow-400' : ''}`}
            style={cardBgStyle}
        >
            {/* Class Name Header - 키워드 색상 적용, 마우스 오버시 스케줄 툴팁 */}
            {showClassName && (
                <div
                    className="text-center font-bold py-1 px-1 text-xxs border-b border-gray-300 relative cursor-help"
                    style={matchedKeyword
                        ? { color: matchedKeyword.textColor }
                        : { color: '#1f2937' }
                    }
                    onMouseEnter={() => setShowScheduleTooltip(true)}
                    onMouseLeave={() => setShowScheduleTooltip(false)}
                >
                    {cls.className}

                    {/* Schedule Tooltip (마우스 오버 시 실제 스케줄 표시) */}
                    {showScheduleTooltip && scheduleInfo.length > 0 && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 p-2 min-w-[140px] whitespace-nowrap">
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-gray-700">
                                <Clock size={12} className="text-yellow-400" />
                                <span className="font-bold">수업 시간</span>
                            </div>
                            <div className="space-y-1">
                                {scheduleInfo.map(({ day, timeRange }) => (
                                    <div key={day} className="flex justify-between gap-3">
                                        <span className={`font-bold ${day === '토' || day === '일' ? 'text-red-400' : 'text-blue-300'}`}>
                                            {day}
                                        </span>
                                        <span className="text-gray-200">{timeRange}</span>
                                    </div>
                                ))}
                            </div>
                            {/* 툴팁 화살표 */}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                        </div>
                    )}
                </div>
            )}

            {/* Student List - 3 Sections */}
            {showStudents && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* 재원생 Section - flex-1로 남은 공간 채움, 8명 이상 시 스크롤 */}
                    <div className="flex-1 p-1 border-b border-gray-200 overflow-y-auto" style={{ minHeight: '140px' }}>
                        <div className="text-micro font-bold text-indigo-600 mb-0.5 px-1">재원생 ({activeStudents.length}명)</div>
                        <ul className="flex flex-col gap-0.5">
                            {activeStudents.map(s => {
                                const isHighlighted = searchQuery && s.name.includes(searchQuery);
                                let displayText = s.name;
                                if (showSchool && s.school) {
                                    displayText += `/${s.school}`;
                                }
                                if (showGrade && s.grade) {
                                    displayText += showSchool ? s.grade : `/${s.grade}`;
                                }
                                return (
                                    <li
                                        key={s.id}
                                        draggable={canEdit}
                                        onDragStart={(e) => canEdit && onDragStart(e, s.id, cls.id)}
                                        onClick={(e) => {
                                            if (onStudentClick && !canEdit) {
                                                e.stopPropagation();
                                                onStudentClick(s.id);
                                            }
                                        }}
                                        className={`py-0.5 px-1 rounded text-center text-xxs transition-colors truncate flex items-center justify-between group
                                        ${canEdit ? 'cursor-grab' : onStudentClick ? 'cursor-pointer' : ''}
                                        ${isHighlighted ? 'bg-yellow-300 font-bold text-black' : `hover:bg-white/80 ${theme.text}`}`}
                                    >
                                        <span className="truncate flex-1">{displayText}</span>
                                        <span className="text-gray-400 opacity-0 group-hover:opacity-100 ml-1">⋮</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* 하단 고정 영역: 대기 + 퇴원 + 총인원 */}
                    <div className="flex-shrink-0">
                        {/* 대기생 Section - 3명 고정 높이, 초과 시 스크롤 */}
                        <div className="px-1 py-0.5 bg-violet-50 border-b border-violet-200 overflow-y-auto" style={{ minHeight: '52px', maxHeight: '52px' }}>
                            <div className="text-micro font-bold text-violet-600">대기 ({holdStudents.length}명)</div>
                            {holdStudents.length > 0 ? (
                                <ul className="flex flex-col gap-0.5 mt-0.5">
                                    {holdStudents.map(s => (
                                        <li key={s.id} className="text-micro bg-violet-100 text-violet-800 px-1 rounded truncate" title={s.name}>
                                            {s.name}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <span className="text-micro text-violet-300">-</span>
                            )}
                        </div>

                        {/* 퇴원생 Section - 3명 고정 높이, 초과 시 스크롤 */}
                        <div className="px-1 py-0.5 bg-gray-100 overflow-y-auto" style={{ minHeight: '52px', maxHeight: '52px' }}>
                            <div className="text-micro font-bold text-gray-600">퇴원 ({withdrawnStudents.length}명)</div>
                            {withdrawnStudents.length > 0 ? (
                                <ul className="flex flex-col gap-0.5 mt-0.5">
                                    {withdrawnStudents.map(s => (
                                        <li
                                            key={s.id}
                                            className="text-micro bg-black text-white px-1 rounded truncate"
                                            title={s.withdrawalDate ? `${s.name} (퇴원: ${s.withdrawalDate})` : s.name}
                                        >
                                            {s.name}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <span className="text-micro text-gray-400">-</span>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassCard;
