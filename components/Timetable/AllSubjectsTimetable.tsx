import React, { useMemo } from 'react';
import { TimetableClass, TimetableSubjectType } from '../../types';
import { useTimetableClasses } from './Math/hooks/useTimetableClasses';
import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../utils/styleUtils';
import { ALL_WEEKDAYS, MATH_PERIOD_INFO, ENGLISH_PERIOD_INFO } from './constants';
import { VideoLoading } from '../Common/VideoLoading';
import SubjectControls from './shared/SubjectControls';
import type { SubjectType } from '../../types';

const WEEKDAYS = ['월', '화', '수', '목', '금'];
const MAX_PERIOD = 10; // 영어 10교시가 최대

// 과목 한글명 → key 매핑
const SUBJECT_KEY_MAP: Record<string, SubjectType> = {
    '수학': 'math',
    '고등수학': 'highmath',
    '영어': 'english',
    '과학': 'science',
    '국어': 'korean',
};

interface AllSubjectsTimetableProps {
    timetableSubject: TimetableSubjectType;
    setTimetableSubject: (value: TimetableSubjectType) => void;
    setTimetableViewType?: React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>;
    mathViewMode?: 'day-based' | 'teacher-based';
    setMathViewMode?: (value: string) => void;
    hasPermissionFn: (perm: string) => boolean;
    setIsTimetableSettingsOpen?: (value: boolean) => void;
}

interface CellData {
    className: string;
    teacher: string;
    room?: string;
    subject: string;
    subjectKey: SubjectType;
    studentCount: number;
}

export default function AllSubjectsTimetable({
    timetableSubject,
    setTimetableSubject,
    setTimetableViewType,
    mathViewMode,
    setMathViewMode,
    hasPermissionFn,
    setIsTimetableSettingsOpen,
}: AllSubjectsTimetableProps) {
    const { classes, loading } = useTimetableClasses();

    // 스케줄 파싱: "월 1교시" → { day: '월', period: '1' }
    const parseSchedule = (schedule: string): { day: string; period: string } | null => {
        const match = schedule.match(/^([\uAC00-\uD7AF]+)\s+(\d+)교시$/);
        if (!match) return null;
        return { day: match[1], period: match[2] };
    };

    // 셔틀 제외, 모든 과목의 수업을 day/period 그리드에 매핑
    const grid = useMemo(() => {
        const map: Record<string, CellData[]> = {}; // key: "월-1"

        classes.forEach((cls: TimetableClass) => {
            if (!cls.schedule || cls.schedule.length === 0) return;
            const subjectKey = SUBJECT_KEY_MAP[cls.subject];
            if (!subjectKey) return; // 셔틀 등 제외

            cls.schedule.forEach(s => {
                const parsed = parseSchedule(s);
                if (!parsed) return;
                const key = `${parsed.day}-${parsed.period}`;
                if (!map[key]) map[key] = [];
                map[key].push({
                    className: cls.className,
                    teacher: cls.teacher,
                    room: cls.room,
                    subject: cls.subject,
                    subjectKey,
                    studentCount: cls.studentIds?.length ?? 0,
                });
            });
        });

        return map;
    }, [classes]);

    // 실제 사용되는 최대 교시 계산
    const maxPeriod = useMemo(() => {
        let max = 0;
        Object.keys(grid).forEach(key => {
            const period = parseInt(key.split('-')[1]);
            if (period > max) max = period;
        });
        return Math.max(max, 8); // 최소 8교시
    }, [grid]);

    const periods = Array.from({ length: maxPeriod }, (_, i) => String(i + 1));

    if (loading) {
        return <VideoLoading className="flex-1 h-full" />;
    }

    return (
        <div className="flex flex-col h-full">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <SubjectControls
                        timetableSubject={timetableSubject}
                        setTimetableSubject={setTimetableSubject}
                        viewType="excel"
                        setTimetableViewType={setTimetableViewType}
                        mathViewMode={mathViewMode}
                        setMathViewMode={setMathViewMode}
                        hasPermission={hasPermissionFn}
                        setIsTimetableSettingsOpen={setIsTimetableSettingsOpen}
                    />
                    <span className="text-xs text-gray-400 font-medium">읽기 전용</span>
                </div>
                {/* 범례 */}
                <div className="flex items-center gap-2 flex-wrap">
                    {(['math', 'highmath', 'english', 'science', 'korean'] as SubjectType[]).map(key => (
                        <span
                            key={key}
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{
                                backgroundColor: SUBJECT_COLORS[key].light,
                                color: SUBJECT_COLORS[key].text,
                                border: `1px solid ${SUBJECT_COLORS[key].border}`,
                            }}
                        >
                            {SUBJECT_LABELS[key]}
                        </span>
                    ))}
                </div>
            </div>

            {/* 그리드 테이블 */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-1.5 w-12 text-center font-bold text-gray-600 bg-gray-100">
                                교시
                            </th>
                            {WEEKDAYS.map(day => (
                                <th
                                    key={day}
                                    className="border border-gray-300 px-2 py-1.5 text-center font-bold text-gray-600 bg-gray-100"
                                    style={{ width: `${100 / (WEEKDAYS.length + 1)}%` }}
                                >
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {periods.map(period => (
                            <tr key={period} className="hover:bg-gray-50/50">
                                <td className="border border-gray-300 px-2 py-1 text-center font-bold text-gray-500 bg-gray-50 whitespace-nowrap">
                                    {period}교시
                                </td>
                                {WEEKDAYS.map(day => {
                                    const key = `${day}-${period}`;
                                    const cells = grid[key] || [];
                                    return (
                                        <td
                                            key={day}
                                            className="border border-gray-200 p-0.5 align-top"
                                        >
                                            {cells.length > 0 ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {cells.map((cell, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="rounded px-1.5 py-1 text-[10px] leading-tight"
                                                            style={{
                                                                backgroundColor: SUBJECT_COLORS[cell.subjectKey]?.light || '#f9fafb',
                                                                borderLeft: `3px solid ${SUBJECT_COLORS[cell.subjectKey]?.bg || '#9ca3af'}`,
                                                            }}
                                                        >
                                                            <div className="font-bold truncate" style={{ color: SUBJECT_COLORS[cell.subjectKey]?.text }}>
                                                                {cell.className}
                                                            </div>
                                                            <div className="text-gray-500 truncate">
                                                                {cell.teacher}
                                                                {cell.room && <span className="ml-1 text-gray-400">({cell.room})</span>}
                                                                <span className="ml-1 text-gray-400">{cell.studentCount}명</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
