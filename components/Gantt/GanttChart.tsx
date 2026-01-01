import React from 'react';
import { GanttSubTask } from '../../types';

interface GanttChartProps {
    tasks: GanttSubTask[];
}

const GanttChart: React.FC<GanttChartProps> = ({ tasks }) => {
    if (tasks.length === 0) return null;

    // Chart Configuration
    const rowHeight = 48;
    const headerHeight = 40;
    const taskColumnWidth = 140;
    const dayWidth = 40;
    const barHeight = 24;

    const maxDay = Math.max(...tasks.map(t => t.startOffset + t.duration));
    const chartWidth = Math.max(600, maxDay * dayWidth);
    const chartHeight = tasks.length * rowHeight + headerHeight;

    return (
        <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-[#373d41] uppercase tracking-wider">타임라인 시각화</h3>
                <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-[#081429]"></div>
                        <span className="text-slate-500">진행 예정</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-[#fdb813]"></div>
                        <span className="text-slate-500">완료</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 p-4">
                <div style={{ width: taskColumnWidth + chartWidth, height: chartHeight, position: 'relative' }}>

                    {/* Header Row */}
                    <div className="absolute top-0 left-0 w-full flex border-b border-slate-200 bg-white z-10" style={{ height: headerHeight }}>
                        <div
                            className="flex-shrink-0 border-r border-slate-200 bg-slate-50 font-semibold text-xs text-[#373d41] flex items-center pl-4 uppercase"
                            style={{ width: taskColumnWidth }}
                        >
                            Task
                        </div>
                        <div className="flex-1 relative">
                            {Array.from({ length: maxDay + 2 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute top-0 bottom-0 border-r border-slate-100 text-[10px] text-slate-400 flex items-center justify-center pt-1"
                                    style={{ left: i * dayWidth, width: dayWidth, height: headerHeight }}
                                >
                                    Day {i}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="absolute left-0 w-full" style={{ top: headerHeight }}>
                        {tasks.map((task, index) => {
                            const barLeft = task.startOffset * dayWidth;
                            const barW = task.duration * dayWidth;
                            const isCompleted = task.completed;
                            const color = isCompleted ? '#fdb813' : '#081429';

                            return (
                                <div
                                    key={task.id}
                                    className="relative border-b border-slate-50 hover:bg-slate-50 transition-colors group"
                                    style={{ height: rowHeight }}
                                >
                                    {/* Task Name Column */}
                                    <div
                                        className="absolute left-0 top-0 bottom-0 border-r border-slate-200 flex items-center px-4 z-10 bg-white group-hover:bg-slate-50 transition-colors"
                                        style={{ width: taskColumnWidth }}
                                    >
                                        <span className={`text-xs font-medium truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-[#373d41]'}`} title={task.title}>
                                            {task.title}
                                        </span>
                                    </div>

                                    {/* Timeline Area */}
                                    <div
                                        className="absolute top-0 bottom-0"
                                        style={{ left: taskColumnWidth, width: chartWidth }}
                                    >
                                        {/* Grid Lines */}
                                        {Array.from({ length: maxDay + 2 }).map((_, i) => (
                                            <div
                                                key={`grid-${i}`}
                                                className="absolute top-0 bottom-0 border-r border-slate-100"
                                                style={{ left: i * dayWidth, width: dayWidth }}
                                            />
                                        ))}

                                        {/* Task Bar */}
                                        <div
                                            className="absolute rounded-md shadow-sm flex items-center justify-center overflow-hidden transition-all duration-300"
                                            style={{
                                                left: barLeft,
                                                width: barW - 4,
                                                top: (rowHeight - barHeight) / 2,
                                                height: barHeight,
                                                backgroundColor: color,
                                            }}
                                        />

                                        {/* Label next to bar */}
                                        <div
                                            className="absolute flex items-center text-[10px] text-slate-500 font-medium whitespace-nowrap pl-2 pointer-events-none"
                                            style={{
                                                left: barLeft + barW,
                                                top: 0,
                                                bottom: 0,
                                            }}
                                        >
                                            {task.duration}일
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GanttChart;
