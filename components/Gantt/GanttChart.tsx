import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GanttSubTask } from '../../types';
import { ZoomIn, ZoomOut, Maximize, Calendar, Filter, CheckCircle2, MoreHorizontal, ChevronRight } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

interface GanttChartProps {
    tasks: GanttSubTask[];
    title?: string;
    startDate?: string; // YYYY-MM-DD format
}

// Neon Palette from the image
const COLORS = [
    { bg: 'bg-[#0ea5e9]', shadow: 'shadow-[#0ea5e9]/40' }, // Cyan
    { bg: 'bg-[#f59e0b]', shadow: 'shadow-[#f59e0b]/40' }, // Orange
    { bg: 'bg-[#ec4899]', shadow: 'shadow-[#ec4899]/40' }, // Pink
    { bg: 'bg-[#10b981]', shadow: 'shadow-[#10b981]/40' }, // Green
    { bg: 'bg-[#8b5cf6]', shadow: 'shadow-[#8b5cf6]/40' }, // Purple
    { bg: 'bg-[#3b82f6]', shadow: 'shadow-[#3b82f6]/40' }, // Blue
];

const GanttChart: React.FC<GanttChartProps> = ({ tasks, title = "Website Redesign", startDate }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dayWidth, setDayWidth] = useState(50);
    const [isFitToScreen, setIsFitToScreen] = useState(false);

    // Category-based grouping (Phase 9)
    const CATEGORY_CONFIG = {
        planning: { title: '기획', color: 'text-blue-400' },
        development: { title: '개발', color: 'text-purple-400' },
        testing: { title: '테스트', color: 'text-green-400' },
        other: { title: '기타', color: 'text-slate-400' }
    };

    const groups = useMemo(() => {
        const grouped: Record<string, typeof tasks> = {
            planning: [],
            development: [],
            testing: [],
            other: []
        };

        tasks.forEach(task => {
            const cat = task.category || 'other';
            if (grouped[cat]) {
                grouped[cat].push(task);
            } else {
                grouped.other.push(task);
            }
        });

        return Object.entries(grouped)
            .filter(([, catTasks]) => catTasks.length > 0)
            .map(([id, catTasks]) => ({
                id,
                title: CATEGORY_CONFIG[id as keyof typeof CATEGORY_CONFIG]?.title || id,
                tasks: catTasks,
                color: CATEGORY_CONFIG[id as keyof typeof CATEGORY_CONFIG]?.color || 'text-slate-400'
            }));
    }, [tasks]);

    // Dimensions
    const rowHeight = 48; // Taller rows
    const headerHeight = 70;
    const barHeight = 28;

    const maxDay = useMemo(() => {
        if (tasks.length === 0) return 10;
        const lastDay = Math.max(...tasks.map(t => t.startOffset + t.duration));
        return Math.max(lastDay + 2, 10); // 최소 10일, 마지막 작업 후 2일 여유
    }, [tasks]);

    // Auto Fit
    useEffect(() => {
        if (isFitToScreen && containerRef.current) {
            const availableWidth = containerRef.current.clientWidth - 32;
            const newDayWidth = Math.max(30, availableWidth / (maxDay + 2));
            setDayWidth(newDayWidth);
        }
    }, [isFitToScreen, maxDay]);

    const chartWidth = (maxDay + 2) * dayWidth;

    // Phase 9: Calculate task positions for dependency arrows
    const taskPositions = useMemo(() => {
        const positions: Record<string, { x: number; y: number; endX: number }> = {};
        let globalRowIndex = 0;

        groups.forEach(group => {
            globalRowIndex++; // Group header takes a row
            group.tasks.forEach(task => {
                const startX = task.startOffset * dayWidth;
                const endX = (task.startOffset + task.duration) * dayWidth;
                const y = globalRowIndex * rowHeight + rowHeight / 2;
                positions[task.id] = { x: startX, y, endX };
                globalRowIndex++;
            });
        });

        return positions;
    }, [groups, dayWidth, rowHeight]);

    // Phase 9: Generate dependency arrows
    const dependencyArrows = useMemo(() => {
        const arrows: Array<{ fromId: string; toId: string; path: string }> = [];

        tasks.forEach(task => {
            if (task.dependsOn && task.dependsOn.length > 0) {
                task.dependsOn.forEach(depId => {
                    const fromPos = taskPositions[depId];
                    const toPos = taskPositions[task.id];
                    if (fromPos && toPos) {
                        // Bezier curve from end of dependency task to start of current task
                        const startX = fromPos.endX;
                        const startY = fromPos.y;
                        const endX = toPos.x;
                        const endY = toPos.y;
                        const midX = (startX + endX) / 2;

                        const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
                        arrows.push({ fromId: depId, toId: task.id, path });
                    }
                });
            }
        });

        return arrows;
    }, [tasks, taskPositions]);

    return (
        <div className="w-full h-full bg-[#15171e] text-slate-300 font-sans flex flex-col overflow-hidden">

            {/* Dashboard Header Content (Simulated as part of the chart area based on image) */}
            <div className="flex-none px-8 py-6 bg-[#15171e]">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <div className="flex items-center gap-2 text-yellow-400 mb-1">
                            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                            <span className="text-xs font-bold tracking-wider">프로젝트</span>
                            <ChevronRight size={14} className="text-slate-500" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-6">{title}</h1>

                        {/* Tab Navigation - Only Timeline is active for now */}
                        <div className="flex items-center gap-8 text-sm font-medium border-b border-white/10 pb-px">
                            <span className="text-emerald-400 border-b-2 border-emerald-400 pb-2 cursor-pointer">타임라인</span>
                            {/* Future tabs - hidden until implemented */}
                            {/* <span className="text-slate-500">List</span> */}
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {/* Filter Button - Will be implemented in Phase 8 */}
                        <button
                            className="text-slate-400 hover:text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-white/5 transition-all opacity-50 cursor-not-allowed"
                            title="필터 기능은 곧 추가됩니다"
                            disabled
                        >
                            <Filter size={16} /> 필터
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-[#202532] p-1 rounded-full border border-white/5">
                        <ZoomOut size={14} className="text-slate-500 ml-2" />
                        <input
                            type="range"
                            min="30"
                            max="100"
                            value={dayWidth}
                            onChange={(e) => {
                                setDayWidth(Number(e.target.value));
                                setIsFitToScreen(false);
                            }}
                            className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <ZoomIn size={14} className="text-slate-500 mr-2" />
                        <button
                            onClick={() => setIsFitToScreen(true)}
                            className="p-1 rounded-full hover:bg-white/10 text-slate-400"
                        >
                            <Maximize size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Graph Area */}
            <div className="flex-1 w-full overflow-hidden relative bg-[#1c202b] rounded-tl-3xl border-t border-l border-white/5 shadow-2xl mx-auto max-w-[98%]">
                <div
                    ref={containerRef}
                    className="h-full overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                >
                    <div
                        className="min-w-fit relative pb-20"
                        style={{ width: chartWidth, paddingLeft: 40, paddingRight: 40 }}
                    >
                        {/* Timeline Header */}
                        <div className="sticky top-0 z-40 bg-[#1c202b]/95 backdrop-blur-sm pt-4 pb-2 border-b border-white/5">
                            {/* Days with Month Labels */}
                            <div className="flex">
                                {Array.from({ length: maxDay + 2 }).map((_, i) => {
                                    const baseDate = startDate ? parseISO(startDate) : new Date();
                                    const date = addDays(baseDate, i);
                                    const prevDate = i > 0 ? addDays(baseDate, i - 1) : null;
                                    const dayNum = format(date, 'd');
                                    const weekday = format(date, 'EEE', { locale: ko });
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                                    // Show month label on first day OR when month changes
                                    const currentMonth = format(date, 'M');
                                    const prevMonth = prevDate ? format(prevDate, 'M') : null;
                                    const showMonth = i === 0 || currentMonth !== prevMonth;
                                    const monthLabel = format(date, 'M월', { locale: ko });

                                    return (
                                        <div
                                            key={i}
                                            className={`text-[10px] font-mono flex flex-col items-center justify-end border-r border-white/5 ${isWeekend ? 'text-red-400' : 'text-slate-500'}`}
                                            style={{ width: dayWidth, height: 50 }}
                                        >
                                            {showMonth && (
                                                <span className="text-sm font-bold text-emerald-400 mb-1">{monthLabel}</span>
                                            )}
                                            <span className={isWeekend ? 'text-red-400' : 'text-slate-300'}>{dayNum}</span>
                                            <span className="opacity-50">{weekday}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Phase 9: Dependency Arrows SVG Overlay */}
                        {dependencyArrows.length > 0 && (
                            <svg
                                className="absolute inset-0 pointer-events-none z-20 overflow-visible"
                                style={{ top: headerHeight + 60 }}
                            >
                                <defs>
                                    <marker
                                        id="arrowhead"
                                        markerWidth="10"
                                        markerHeight="7"
                                        refX="9"
                                        refY="3.5"
                                        orient="auto"
                                    >
                                        <polygon
                                            points="0 0, 10 3.5, 0 7"
                                            fill="#60a5fa"
                                        />
                                    </marker>
                                </defs>
                                {dependencyArrows.map((arrow, idx) => (
                                    <path
                                        key={`arrow-${idx}`}
                                        d={arrow.path}
                                        fill="none"
                                        stroke="#60a5fa"
                                        strokeWidth="2"
                                        strokeDasharray="6 4"
                                        markerEnd="url(#arrowhead)"
                                        opacity="0.6"
                                    />
                                ))}
                            </svg>
                        )}

                        {/* Groups */}
                        {groups.map((group, gIndex) => (
                            <div key={group.id} className="mt-8">
                                {/* Group Header */}
                                <div className="flex items-center gap-2 mb-4 sticky left-0 px-2">
                                    <CheckCircle2 size={16} className="text-blue-500" />
                                    <span className="text-xs font-bold text-slate-300 tracking-wider">{group.title}</span>
                                </div>

                                {/* Tasks Grid */}
                                <div className="relative">
                                    {/* Grid Lines */}
                                    <div className="absolute inset-0 z-0 flex pointer-events-none">
                                        {Array.from({ length: maxDay + 2 }).map((_, i) => (
                                            <div
                                                key={`grid-${i}`}
                                                className="border-r border-white/5 h-full"
                                                style={{ width: dayWidth }}
                                            />
                                        ))}
                                    </div>

                                    {/* Task Rows */}
                                    {group.tasks.map((task, index) => {
                                        // Pick color cyclically based on global index to simulate variety
                                        const globalIndex = gIndex * 10 + index;
                                        const theme = COLORS[globalIndex % COLORS.length];

                                        return (
                                            <div
                                                key={task.id}
                                                className="relative h-[48px] flex items-center group"
                                            >
                                                {/* Bar */}
                                                <div
                                                    className={`absolute h-[32px] rounded-full flex items-center px-4 ${theme.bg} ${theme.shadow} shadow-lg transition-all hover:scale-[1.02] cursor-pointer z-10 group/bar`}
                                                    style={{
                                                        left: task.startOffset * dayWidth,
                                                        width: Math.max(dayWidth * task.duration, 40)
                                                    }}
                                                >
                                                    {/* Internal Text: Only if duration > 2 */}
                                                    {task.duration > 2 && (
                                                        <span className="text-[11px] font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2">
                                                            {task.title}
                                                            {task.assigneeName && <span className="text-[9px] bg-black/20 px-1.5 rounded text-white/90">@{task.assigneeName}</span>}
                                                        </span>
                                                    )}

                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/bar:block z-[9999] w-max max-w-xs">
                                                        <div className="bg-[#1f2937] text-white text-xs rounded-lg p-3 shadow-xl border border-white/10">
                                                            <div className="font-bold mb-1 text-sm">{task.title}</div>
                                                            <div className="text-slate-400 mb-2">{task.description}</div>

                                                            <div className="space-y-1">
                                                                <div className="flex justify-between gap-4">
                                                                    <span className="text-slate-500">Duration</span>
                                                                    <span>{task.duration} days</span>
                                                                </div>

                                                                {task.assigneeName && (
                                                                    <div className="flex justify-between gap-4 border-t border-white/10 pt-1 mt-1">
                                                                        <span className="text-slate-500">Assignee</span>
                                                                        <span className="text-emerald-400 font-medium">@{task.assigneeName}</span>
                                                                    </div>
                                                                )}

                                                                {task.departmentIds && task.departmentIds.length > 0 && (
                                                                    <div className="flex flex-col gap-1 border-t border-white/10 pt-1 mt-1">
                                                                        <span className="text-slate-500">Departments</span>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {task.departmentIds.map(d => (
                                                                                <span key={d} className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                                                                                    {d.toUpperCase()}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Arrow */}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#1f2937]"></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* External Text: Only if duration <= 2 */}
                                                {task.duration <= 2 && (
                                                    <div
                                                        className="absolute flex items-center gap-2 z-0 animate-fadeIn"
                                                        style={{
                                                            left: (task.startOffset * dayWidth) + Math.max(dayWidth * task.duration, 40) + 12,
                                                            opacity: 0.9
                                                        }}
                                                    >
                                                        <span className="text-[12px] font-bold text-white/90 whitespace-nowrap shadow-black drop-shadow-md">
                                                            {task.title}
                                                        </span>
                                                        {task.assigneeName && (
                                                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-300">
                                                                @{task.assigneeName}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GanttChart;
