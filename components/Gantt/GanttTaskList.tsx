import React from 'react';
import { GanttSubTask } from '../../types';

interface GanttTaskListProps {
    tasks: GanttSubTask[];
    onToggleTask: (taskId: string) => void;
}

const GanttTaskList: React.FC<GanttTaskListProps> = ({ tasks, onToggleTask }) => {
    return (
        <div className="bg-white rounded-sm shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[500px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-semibold text-primary-700 uppercase tracking-wider">실행 목록 (Checklist)</h3>
            </div>
            <div className="overflow-y-auto p-2 space-y-2 flex-1">
                {tasks.map((task, index) => (
                    <div
                        key={task.id}
                        onClick={() => onToggleTask(task.id)}
                        className={`
              group flex items-start p-3 rounded-sm cursor-pointer border transition-all duration-200
              ${task.completed
                                ? 'bg-accent/10 border-accent/30'
                                : 'bg-white border-transparent hover:border-primary/20 hover:bg-slate-50 hover:shadow-sm'
                            }
            `}
                    >
                        {/* Checkbox Visual */}
                        <div className={`
              mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors
              ${task.completed ? 'bg-accent border-accent' : 'bg-white border-slate-300 group-hover:border-primary'}
            `}>
                            {task.completed && (
                                <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm font-medium truncate ${task.completed ? 'text-primary-700/60 line-through' : 'text-primary'}`}>
                                    {index + 1}. {task.title}
                                </span>
                                <span className="text-xs text-primary-700/70 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {task.duration}일
                                </span>
                            </div>
                            <p className={`text-xs ${task.completed ? 'text-primary-700/50' : 'text-primary-700'}`}>
                                {task.description}
                            </p>
                        </div>
                    </div>
                ))}
                {tasks.length === 0 && (
                    <div className="text-center p-8 text-primary-700/50 text-sm">
                        임무를 기다리는 중...
                    </div>
                )}
            </div>
        </div>
    );
};

export default GanttTaskList;
