import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GanttSubTask } from '../../types';
import { ZoomIn, ZoomOut, Maximize, Calendar, Filter, CheckCircle2, MoreHorizontal, ChevronRight } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';


interface GanttChartProps {
    tasks: GanttSubTask[];
    title?: string;
    startDate?: string; // YYYY-MM-DD format
    onSaveAsTemplate?: () => void;
}

// Phase 2: Neon Gradient Palette with Glow + Arrow Color
const COLORS = [
    { bg: 'bg-gradient-to-r from-cyan-500 to-blue-500', shadow: 'shadow-cyan-500/50', glow: 'rgba(6, 182, 212, 0.4)', arrow: '#06b6d4' },
    { bg: 'bg-gradient-to-r from-orange-500 to-amber-500', shadow: 'shadow-orange-500/50', glow: 'rgba(249, 115, 22, 0.4)', arrow: '#f97316' },
    { bg: 'bg-gradient-to-r from-pink-500 to-rose-500', shadow: 'shadow-pink-500/50', glow: 'rgba(236, 72, 153, 0.4)', arrow: '#ec4899' },
    { bg: 'bg-gradient-to-r from-emerald-500 to-green-500', shadow: 'shadow-emerald-500/50', glow: 'rgba(16, 185, 129, 0.4)', arrow: '#10b981' },
    { bg: 'bg-gradient-to-r from-violet-500 to-purple-500', shadow: 'shadow-violet-500/50', glow: 'rgba(139, 92, 246, 0.4)', arrow: '#8b5cf6' },
    { bg: 'bg-gradient-to-r from-blue-600 to-indigo-600', shadow: 'shadow-blue-600/50', glow: 'rgba(59, 130, 246, 0.4)', arrow: '#3b82f6' },
];

const GanttChart: React.FC<GanttChartProps> = ({ tasks, title = "Website Redesign", startDate, onSaveAsTemplate }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dayWidth, setDayWidth] = useState(50);
    const [isFitToScreen, setIsFitToScreen] = useState(false);
    const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null); // Phase A: Hover Highlight



    // Dynamic Categories Loading (Phase 11)
    const { data: categories = [] } = useQuery<{ id: string; label: string; backgroundColor: string; textColor: string }[]>({
        queryKey: ['ganttCategories'],
        queryFn: async () => {
            const q = query(collection(db, 'gantt_categories'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                // Fallback / Hardcoded defaults if empty (should correspond to seeded data)
                return [
                    { id: 'planning', label: '기획', backgroundColor: '#dbeafe', textColor: '#1d4ed8' }, // blue-100, blue-700
                    { id: 'development', label: '개발', backgroundColor: '#f3e8ff', textColor: '#7e22ce' }, // purple-100, purple-700
                    { id: 'testing', label: '테스트', backgroundColor: '#d1fae5', textColor: '#047857' }, // emerald-100, emerald-700
                    { id: 'other', label: '기타', backgroundColor: '#f3f4f6', textColor: '#374151' } // gray-100, gray-700
                ];
            }
            return snapshot.docs.map(doc => ({
                id: doc.id,
                label: doc.data().label,
                backgroundColor: doc.data().backgroundColor,
                textColor: doc.data().textColor
            }));
        },
        staleTime: 1000 * 60 * 5 // 5 minutes
    });

    const categoryConfig = useMemo(() => {
        const config: Record<string, { title: string; color: string; style?: React.CSSProperties }> = {};
        categories.forEach(cat => {
            // We use inline styles for dynamic colors now, but keeping 'color' prop for compatibility or class-based fallback
            config[cat.id] = {
                title: cat.label,
                color: '', // Deprecated in favor of style
                style: { backgroundColor: cat.backgroundColor, color: cat.textColor, borderColor: cat.backgroundColor } // simplified border
            };
        });
        // Ensure default fallback exists
        if (!config['other']) config['other'] = { title: '기타', color: 'bg-gray-100 text-gray-700', style: { backgroundColor: '#f3f4f6', color: '#374151' } };
        return config;
    }, [categories]);

    const groups = useMemo(() => {
        // Dynamic grouping based on available categories
        // We want to preserve the order of categories as fetched (sorted by order)
        // plus an 'other' bucket if needed (though 'other' should be in categories)

        const grouped: Record<string, typeof tasks> = {};
        categories.forEach(cat => grouped[cat.id] = []);
        // Extra catch-all if tasks have category not in list?
        if (!grouped['other']) grouped['other'] = [];

        tasks.forEach(task => {
            const cat = task.category || 'other';
            if (grouped[cat]) {
                grouped[cat].push(task);
            } else {
                // Determine fallback
                if (grouped['other']) grouped['other'].push(task);
                else {
                    // If no 'other' category defined dynamically, force create it or just push to first? 
                    // Safest is to just add to the first available or create a temp bucket.
                    // Let's assume 'other' exists or add it.
                    if (!grouped['other']) grouped['other'] = [];
                    grouped['other'].push(task);
                }
            }
        });

        return categories.map(cat => ({
            id: cat.id,
            title: cat.label,
            tasks: grouped[cat.id] || [],
            style: { backgroundColor: cat.backgroundColor, color: cat.textColor }
        })).filter(g => g.tasks.length > 0);
    }, [tasks, categories]);

    // Dimensions
    const rowHeight = 60; // Taller rows for 2-line task bars
    const headerHeight = 70;
    const barHeight = 42; // Increased for 2-line content

    const maxDay = useMemo(() => {
        if (tasks.length === 0) return 7;
        const lastDay = Math.max(...tasks.map(t => t.startOffset + t.duration));
        return lastDay + 1; // 최소 7일, 마지막 작업 후 1일 여유
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

        // Timeline header height: pt-4(16px) + height(50px) + pb-2(8px) = 74px
        const timelineHeaderHeight = 74;
        // Padding offset (matches chart container paddingLeft)
        const paddingLeft = 40;
        let cumulativeY = timelineHeaderHeight;

        groups.forEach((group, groupIndex) => {
            // Add group top margin (mt-8 = 32px) for ALL groups to match rendering
            cumulativeY += 32; // mt-8 applied to all groups in actual DOM

            // Group header height (flex items-center gap-2 mb-4)
            const groupHeaderHeight = 24 + 16; // ~24px height + 16px margin-bottom
            cumulativeY += groupHeaderHeight;

            group.tasks.forEach(task => {
                // Include paddingLeft offset in X coordinates
                const startX = paddingLeft + (task.startOffset * dayWidth);
                const endX = paddingLeft + ((task.startOffset + task.duration) * dayWidth);
                const y = cumulativeY + rowHeight / 2; // Center of task row
                positions[task.id] = { x: startX, y, endX };
                cumulativeY += rowHeight; // Move to next task
            });
        });

        return positions;
    }, [groups, dayWidth, rowHeight]);

    // Generate dependency arrows: LEFT VERTICAL LANE pattern
    // All arrows route through a vertical lane on the left side
    const LANE_BASE_X = 25; // Left margin for vertical lane
    const LANE_SPACING = 6; // Spacing between multiple lanes
    const Y_OFFSET_STEP = 4; // Subtle Y offset for arrows from same source

    const dependencyArrows = useMemo(() => {
        const arrows: Array<{ fromId: string; toId: string; path: string; startX: number; startY: number; endX: number; endY: number; color: string }> = [];

        // Collect all unique dependency relationships with source color index
        const allDeps: Array<{ fromId: string; toId: string; fromY: number; toY: number; toX: number; fromX: number; colorIndex: number }> = [];

        // Build a map of taskId -> colorIndex
        let globalTaskIndex = 0;
        const taskColorMap: Record<string, number> = {};
        groups.forEach((group, gIndex) => {
            group.tasks.forEach((task, tIndex) => {
                taskColorMap[task.id] = gIndex * 10 + tIndex; // Same logic as rendering
            });
        });

        groups.forEach((group) => {
            group.tasks.forEach((task) => {
                if (task.dependsOn && task.dependsOn.length > 0) {
                    task.dependsOn.forEach((depId) => {
                        const fromPos = taskPositions[depId];
                        const toPos = taskPositions[task.id];
                        if (fromPos && toPos) {
                            allDeps.push({
                                fromId: depId,
                                toId: task.id,
                                fromY: fromPos.y,
                                toY: toPos.y,
                                toX: toPos.x,
                                fromX: fromPos.x,
                                colorIndex: taskColorMap[depId] || 0
                            });
                        }
                    });
                }
            });
        });

        // Group arrows by source task to calculate Y offsets
        const sourceGroups: Record<string, typeof allDeps> = {};
        allDeps.forEach(dep => {
            if (!sourceGroups[dep.fromId]) sourceGroups[dep.fromId] = [];
            sourceGroups[dep.fromId].push(dep);
        });

        // Group arrows by target task to calculate arrival Y offsets
        const targetGroups: Record<string, typeof allDeps> = {};
        allDeps.forEach(dep => {
            if (!targetGroups[dep.toId]) targetGroups[dep.toId] = [];
            targetGroups[dep.toId].push(dep);
        });

        // Sort dependencies by the range they span (larger spans get outer lanes)
        const sortedDeps = [...allDeps].sort((a, b) => {
            const rangeA = Math.abs(a.toY - a.fromY);
            const rangeB = Math.abs(b.toY - b.fromY);
            return rangeB - rangeA; // Larger ranges first (outer lanes)
        });

        // Track which index each dep has within its source group
        const sourceIndexMap = new Map<string, number>();
        Object.values(sourceGroups).forEach(group => {
            group.sort((a, b) => a.toY - b.toY);
            group.forEach((dep, idx) => {
                const key = `${dep.fromId}-${dep.toId}`;
                sourceIndexMap.set(key, idx);
            });
        });

        // Track which index each dep has within its target group
        const targetIndexMap = new Map<string, number>();
        Object.values(targetGroups).forEach(group => {
            group.sort((a, b) => a.fromY - b.fromY);
            group.forEach((dep, idx) => {
                const key = `${dep.fromId}-${dep.toId}`;
                targetIndexMap.set(key, idx);
            });
        });

        // Assign lane indices
        sortedDeps.forEach((dep, idx) => {
            const fromPos = taskPositions[dep.fromId];
            const toPos = taskPositions[dep.toId];
            if (!fromPos || !toPos) return;

            const depKey = `${dep.fromId}-${dep.toId}`;

            // Calculate source Y offset
            const sourceGroup = sourceGroups[dep.fromId];
            const sourceGroupSize = sourceGroup.length;
            const sourceIndex = sourceIndexMap.get(depKey) || 0;
            const sourceYOffset = sourceGroupSize > 1
                ? (sourceIndex - (sourceGroupSize - 1) / 2) * Y_OFFSET_STEP
                : 0;

            // Calculate target Y offset
            const targetGroup = targetGroups[dep.toId];
            const targetGroupSize = targetGroup.length;
            const targetIndex = targetIndexMap.get(depKey) || 0;
            const targetYOffset = targetGroupSize > 1
                ? (targetIndex - (targetGroupSize - 1) / 2) * Y_OFFSET_STEP
                : 0;

            const startY = fromPos.y + sourceYOffset;
            const endY = toPos.y + targetYOffset;
            const endX = toPos.x - 8;

            // Lane X position: further left for larger spans
            const laneX = LANE_BASE_X - (idx * LANE_SPACING);

            const sourceStartX = fromPos.x - 8;

            let path: string;
            if (Math.abs(startY - endY) < 2) {
                // Same row: simple connection
                path = `M ${sourceStartX} ${startY} L ${endX} ${endY}`;
            } else {
                // Different rows: use left vertical lane
                path = `M ${sourceStartX} ${startY} L ${laneX} ${startY} L ${laneX} ${endY} L ${endX} ${endY}`;
            }

            // Get color from source task
            const arrowColor = COLORS[dep.colorIndex % COLORS.length].arrow;

            arrows.push({
                fromId: dep.fromId,
                toId: dep.toId,
                path,
                startX: sourceStartX,
                startY,
                endX,
                endY,
                color: arrowColor
            });
        });

        return arrows;
    }, [groups, taskPositions]);

    return (
        <div className="w-full h-full bg-white text-gray-700 font-sans flex flex-col overflow-hidden">

            {/* Dashboard Header Content (Simulated as part of the chart area based on image) */}
            <div className="flex-none px-8 py-6 bg-white">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <div className="flex items-center gap-2 text-yellow-400 mb-1">
                            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                            <span className="text-xs font-bold tracking-wider">프로젝트</span>
                            <ChevronRight size={14} className="text-gray-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-6">{title}</h1>

                        {/* Tab Navigation - Only Timeline is active for now */}
                        <div className="flex items-center gap-8 text-sm font-medium border-b border-gray-200 pb-px">
                            <span className="text-emerald-400 border-b-2 border-emerald-400 pb-2 cursor-pointer">타임라인</span>
                            {/* Future tabs - hidden until implemented */}
                            {/* <span className="text-gray-400">List</span> */}
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {/* Filter Button - Will be implemented in Phase 8 */}
                        <button
                            className="text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100 transition-all opacity-50 cursor-not-allowed"
                            title="필터 기능은 곧 추가됩니다"
                            disabled
                        >
                            <Filter size={16} /> 필터
                        </button>

                        {/* Save as Template Button */}
                        {onSaveAsTemplate && (
                            <button
                                onClick={onSaveAsTemplate}
                                className="text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100 transition-all border border-gray-200"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V5a2 2 0 012-2h4.586" />
                                </svg>
                                템플릿으로 저장
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 bg-[#202532] p-1 rounded-full border border-gray-200">
                        <ZoomOut size={14} className="text-gray-400 ml-2" />
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
                        <ZoomIn size={14} className="text-gray-400 mr-2" />
                        <button
                            onClick={() => setIsFitToScreen(true)}
                            className="p-1 rounded-full hover:bg-white/10 text-gray-500"
                        >
                            <Maximize size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Graph Area */}
            <div className="flex-1 w-full overflow-hidden relative bg-gray-50 rounded-tl-3xl border-t border-l border-gray-200 shadow-2xl mx-auto max-w-[98%]">
                <div
                    ref={containerRef}
                    className="h-full overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                >
                    <div
                        className="min-w-fit relative pb-20"
                        style={{ width: chartWidth, paddingLeft: 40, paddingRight: 40 }}
                    >
                        {/* Timeline Header */}
                        <div className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur-sm pt-4 pb-2 border-b border-gray-200">
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
                                            className={`text-[10px] font-mono flex flex-col items-center justify-end border-r border-gray-200 ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}
                                            style={{ width: dayWidth, height: 50 }}
                                        >
                                            {showMonth && (
                                                <span className="text-sm font-bold text-emerald-400 mb-1">{monthLabel}</span>
                                            )}
                                            <span className={isWeekend ? 'text-red-400' : 'text-gray-700'}>{dayNum}</span>
                                            <span className="opacity-50">{weekday}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Dependency Arrows with Mini Nodes */}
                        {dependencyArrows.length > 0 && (
                            <svg
                                className="absolute inset-0 pointer-events-none z-20 overflow-visible"
                                style={{ top: 0, left: 0 }}
                            >
                                {dependencyArrows.map((arrow, idx) => {
                                    // Hover highlight: calculate opacity based on hovered task
                                    const isHighlighted = hoveredTaskId &&
                                        (arrow.fromId === hoveredTaskId || arrow.toId === hoveredTaskId);
                                    const arrowOpacity = !hoveredTaskId ? 0.6 : (isHighlighted ? 1 : 0.15);

                                    return (
                                        <g key={`arrow-${idx}`} className="transition-opacity duration-200">
                                            {/* Unique marker for this arrow's color */}
                                            <defs>
                                                <marker
                                                    id={`arrowhead-${idx}`}
                                                    markerWidth="8"
                                                    markerHeight="6"
                                                    refX="7"
                                                    refY="3"
                                                    orient="auto"
                                                >
                                                    <polygon
                                                        points="0 0, 8 3, 0 6"
                                                        fill={arrow.color}
                                                    />
                                                </marker>
                                            </defs>

                                            {/* Start node - outer */}
                                            <circle
                                                cx={arrow.startX}
                                                cy={arrow.startY}
                                                r="5"
                                                fill={arrow.color}
                                                opacity={arrowOpacity * 0.3}
                                            />
                                            {/* Start node - inner */}
                                            <circle
                                                cx={arrow.startX}
                                                cy={arrow.startY}
                                                r="2"
                                                fill="white"
                                                opacity={arrowOpacity}
                                            />

                                            {/* Solid line */}
                                            <path
                                                d={arrow.path}
                                                fill="none"
                                                stroke={arrow.color}
                                                strokeWidth="2"
                                                markerEnd={`url(#arrowhead-${idx})`}
                                                strokeLinejoin="round"
                                                opacity={arrowOpacity}
                                            />

                                            {/* End node - outer */}
                                            <circle
                                                cx={arrow.endX}
                                                cy={arrow.endY}
                                                r="5"
                                                fill={arrow.color}
                                                opacity={arrowOpacity * 0.3}
                                            />
                                            {/* End node - inner */}
                                            <circle
                                                cx={arrow.endX}
                                                cy={arrow.endY}
                                                r="2"
                                                fill="white"
                                                opacity={arrowOpacity}
                                            />
                                        </g>
                                    );
                                })}
                            </svg>
                        )}

                        {/* Groups */}
                        {groups.map((group, gIndex) => (
                            <div key={group.id} className="mt-8">
                                {/* Group Header */}
                                <div className="flex items-center gap-2 mb-4 sticky left-0 px-2">
                                    <CheckCircle2 size={16} style={{ color: (group as any).style?.color || '#3b82f6' }} />
                                    <span className="text-xs font-bold tracking-wider" style={{ color: (group as any).style?.color || '#374151' }}>{group.title}</span>
                                </div>

                                {/* Tasks Grid */}
                                <div className="relative">
                                    {/* Grid Lines */}
                                    <div className="absolute inset-0 z-0 flex pointer-events-none">
                                        {Array.from({ length: maxDay + 2 }).map((_, i) => (
                                            <div
                                                key={`grid-${i}`}
                                                className="border-r border-gray-200 h-full"
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
                                                className="relative h-[60px] flex items-center group"
                                                onMouseEnter={() => setHoveredTaskId(task.id)}
                                                onMouseLeave={() => setHoveredTaskId(null)}
                                            >
                                                {/* Bar - Pill Style with Gradient */}
                                                <div
                                                    className={`absolute h-[38px] rounded-full flex items-center justify-center gap-2 px-4 ${theme.bg} shadow-xl transition duration-300 hover:scale-105 hover:-translate-y-0.5 cursor-pointer z-10 hover:z-50 group/bar border border-white/20`}
                                                    style={{
                                                        left: task.startOffset * dayWidth,
                                                        width: Math.max(dayWidth * task.duration, 70),
                                                        boxShadow: `0 8px 24px ${theme.glow}, 0 0 0 1px rgba(255,255,255,0.1)`
                                                    }}
                                                >
                                                    {/* Single Line: Title + Assignee */}
                                                    <span className="text-[10px] font-bold text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis">
                                                        {task.title}
                                                    </span>
                                                    {task.assigneeName && task.duration > 2 && (
                                                        <span className="text-[9px] text-white/70 whitespace-nowrap">
                                                            @{task.assigneeName}
                                                        </span>
                                                    )}

                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/bar:block z-[9999] w-max max-w-xs">
                                                        <div className="bg-white text-gray-800 text-xs rounded-lg p-3 shadow-xl border border-gray-200">
                                                            <div className="font-bold mb-1 text-sm text-gray-900">{task.title}</div>
                                                            <div className="text-gray-500 mb-2">{task.description}</div>

                                                            <div className="space-y-1">
                                                                <div className="flex justify-between gap-4">
                                                                    <span className="text-gray-400">기간</span>
                                                                    <span>{task.duration}일</span>
                                                                </div>

                                                                {task.assigneeName && (
                                                                    <div className="flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1">
                                                                        <span className="text-gray-400">담당자</span>
                                                                        <span className="text-emerald-400 font-medium">@{task.assigneeName}</span>
                                                                    </div>
                                                                )}

                                                                {task.departmentIds && task.departmentIds.length > 0 && (
                                                                    <div className="flex flex-col gap-1 border-t border-gray-200 pt-1 mt-1">
                                                                        <span className="text-gray-400">관련 부서</span>
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
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white"></div>
                                                        </div>
                                                    </div>
                                                </div>
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
