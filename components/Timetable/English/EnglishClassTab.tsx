// English Class Integration Tab
// 영어 통합 시간표 탭 - 수업별 컬럼 뷰

import React, { useState, useMemo } from 'react';
import { Search, Settings, Eye, EyeOff } from 'lucide-react';
import { EN_PERIODS, EN_WEEKDAYS, getTeacherColor } from './englishUtils';

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

interface EnglishClassTabProps {
    teachers: string[];
    scheduleData: ScheduleData;
}

interface ClassInfo {
    name: string;
    teacher: string;
    room: string;
    periods: { periodId: string; day: string }[];
    startPeriod: number;
}

const EnglishClassTab: React.FC<EnglishClassTabProps> = ({
    teachers,
    scheduleData,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [mode, setMode] = useState<'view' | 'hide'>('view');
    const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());

    // Extract unique classes from schedule data
    const classes = useMemo(() => {
        const classMap = new Map<string, ClassInfo>();

        Object.entries(scheduleData).forEach(([key, cell]) => {
            if (!cell.className) return;

            const parts = key.split('-');
            if (parts.length !== 3) return;
            const [teacher, periodId, day] = parts;

            if (!classMap.has(cell.className)) {
                classMap.set(cell.className, {
                    name: cell.className,
                    teacher: teacher,
                    room: cell.room || '',
                    periods: [],
                    startPeriod: parseInt(periodId),
                });
            }

            const classInfo = classMap.get(cell.className)!;
            classInfo.periods.push({ periodId, day });
            classInfo.startPeriod = Math.min(classInfo.startPeriod, parseInt(periodId));
        });

        return Array.from(classMap.values())
            .filter(c => !searchTerm || c.name.includes(searchTerm))
            .sort((a, b) => a.startPeriod - b.startPeriod || a.name.localeCompare(b.name, 'ko'));
    }, [scheduleData, searchTerm]);

    // Group classes by start period
    const groupedClasses = useMemo(() => {
        const groups: { periodIndex: number; label: string; classes: ClassInfo[] }[] = [];

        classes.forEach(cls => {
            if (hiddenClasses.has(cls.name) && mode === 'view') return;

            let group = groups.find(g => g.periodIndex === cls.startPeriod);
            if (!group) {
                group = {
                    periodIndex: cls.startPeriod,
                    label: `${cls.startPeriod}교시 시작`,
                    classes: [],
                };
                groups.push(group);
            }
            group.classes.push(cls);
        });

        return groups.sort((a, b) => a.periodIndex - b.periodIndex);
    }, [classes, hiddenClasses, mode]);

    const toggleHidden = (className: string) => {
        setHiddenClasses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(className)) {
                newSet.delete(className);
            } else {
                newSet.add(className);
            }
            return newSet;
        });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                    {/* Mode Toggle */}
                    <div className="flex bg-gray-200 rounded-lg p-0.5">
                        <button
                            onClick={() => setMode('view')}
                            className={`px-2 py-1 text-xs font-bold rounded transition-all ${mode === 'view' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}
                        >
                            👁️ 조회
                        </button>
                        <button
                            onClick={() => setMode('hide')}
                            className={`px-2 py-1 text-xs font-bold rounded transition-all ${mode === 'hide' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            🙈 숨김
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="수업명 검색..."
                            className="pl-7 pr-3 py-1.5 text-xs border rounded-full w-48 focus:ring-2 focus:ring-indigo-400 outline-none"
                        />
                    </div>
                </div>

                {hiddenClasses.size > 0 && (
                    <span className="text-xs text-gray-400">
                        {hiddenClasses.size}개 숨김
                    </span>
                )}
            </div>

            {/* Teacher Legend */}
            <div className="px-4 py-2 bg-white border-b flex flex-wrap gap-2 items-center flex-shrink-0">
                <span className="text-[11px] font-bold text-gray-400 mr-1">강사 목록:</span>
                {teachers.map(teacher => (
                    <div
                        key={teacher}
                        className="px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: getTeacherColor(teacher) }}
                    >
                        {teacher}
                    </div>
                ))}
            </div>

            {/* Classes Grid */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
                {groupedClasses.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        데이터가 없습니다.
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {groupedClasses.map(group => (
                            <div key={group.periodIndex} className="bg-white rounded-lg shadow border overflow-hidden">
                                {/* Group Header */}
                                <div className="bg-gray-800 text-white px-4 py-2 font-bold text-sm flex items-center gap-2">
                                    <span>🕒 {group.label}</span>
                                    <span className="text-xs bg-gray-600 px-2 py-0.5 rounded">
                                        {group.classes.length}개 수업
                                    </span>
                                </div>

                                {/* Classes Row */}
                                <div className="flex overflow-x-auto p-2 gap-2">
                                    {group.classes.map(cls => (
                                        <div
                                            key={cls.name}
                                            className={`flex-shrink-0 w-[150px] rounded-lg border overflow-hidden transition-all ${hiddenClasses.has(cls.name) ? 'opacity-50' : ''
                                                }`}
                                            style={{ borderColor: getTeacherColor(cls.teacher) }}
                                        >
                                            {/* Class Header */}
                                            <div
                                                className="px-2 py-1.5 text-white text-xs font-bold flex justify-between items-center"
                                                style={{ backgroundColor: getTeacherColor(cls.teacher) }}
                                            >
                                                <span className="truncate">{cls.name}</span>
                                                {mode === 'hide' && (
                                                    <button
                                                        onClick={() => toggleHidden(cls.name)}
                                                        className="ml-1 p-0.5 rounded hover:bg-white/20"
                                                    >
                                                        {hiddenClasses.has(cls.name) ? (
                                                            <Eye size={12} />
                                                        ) : (
                                                            <EyeOff size={12} />
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Class Info */}
                                            <div className="p-2 bg-white">
                                                <div className="text-[10px] text-gray-500 mb-1">
                                                    {cls.teacher} | {cls.room || '미지정'}
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {cls.periods.slice(0, 5).map((p, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] text-gray-600"
                                                        >
                                                            {p.day} {p.periodId}교시
                                                        </span>
                                                    ))}
                                                    {cls.periods.length > 5 && (
                                                        <span className="text-[9px] text-gray-400">
                                                            +{cls.periods.length - 5}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnglishClassTab;
