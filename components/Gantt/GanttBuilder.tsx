import React, { useState } from 'react';
import { GanttSubTask, GanttTemplate } from '../../types';

interface GanttBuilderProps {
    onSave: (template: GanttTemplate) => void;
    onCancel: () => void;
    initialData?: GanttTemplate;
}

const GanttBuilder: React.FC<GanttBuilderProps> = ({ onSave, onCancel, initialData }) => {
    const [title, setTitle] = useState(initialData?.title || '');
    const [desc, setDesc] = useState(initialData?.description || '');
    const [tasks, setTasks] = useState<GanttSubTask[]>(initialData?.tasks ? JSON.parse(JSON.stringify(initialData.tasks)) : []);

    // Form state for new task
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDesc, setTaskDesc] = useState('');
    const [startOffset, setStartOffset] = useState<number>(0);
    const [duration, setDuration] = useState<number>(1);

    const handleAddTask = () => {
        if (!taskTitle.trim()) return;

        const newTask: GanttSubTask = {
            id: `task-${Date.now()}`,
            title: taskTitle,
            description: taskDesc,
            startOffset: Number(startOffset),
            duration: Number(duration),
            completed: false,
        };

        setTasks([...tasks, newTask].sort((a, b) => a.startOffset - b.startOffset));

        // Reset task form
        setTaskTitle('');
        setTaskDesc('');
        setStartOffset(0);
        setDuration(1);
    };

    const handleRemoveTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    const handleSaveTemplate = () => {
        if (!title.trim() || tasks.length === 0) {
            alert("프로젝트 제목과 최소 1개 이상의 항목이 필요합니다.");
            return;
        }

        const template: GanttTemplate = {
            id: initialData?.id || `template-${Date.now()}`,
            title,
            description: desc,
            tasks,
            createdAt: initialData?.createdAt || Date.now(),
        };

        onSave(template);
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 md:p-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-[#081429] mb-6">
                {initialData ? '간트 차트 수정' : '새 간트 차트 등록'}
            </h2>

            {/* Project Details */}
            <div className="space-y-4 mb-8">
                <div>
                    <label className="block text-sm font-medium text-[#373d41] mb-1">프로젝트 제목</label>
                    <input
                        type="text"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none transition text-[#373d41]"
                        placeholder="예: 신입 사원 온보딩 프로세스"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[#373d41] mb-1">설명 (선택)</label>
                    <input
                        type="text"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none transition text-[#373d41]"
                        placeholder="이 프로젝트에 대한 간단한 설명"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                    />
                </div>
            </div>

            <hr className="border-slate-100 my-6" />

            {/* Task Creation Form */}
            <h3 className="text-lg font-semibold text-[#081429] mb-4">항목 추가</h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-[#373d41] uppercase mb-1">항목명</label>
                    <input
                        type="text"
                        className="w-full p-2 border border-slate-300 rounded focus:border-[#081429] outline-none text-[#373d41]"
                        placeholder="할 일 입력"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                    />
                </div>
                <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-[#373d41] uppercase mb-1">상세 설명</label>
                    <input
                        type="text"
                        className="w-full p-2 border border-slate-300 rounded focus:border-[#081429] outline-none text-[#373d41]"
                        placeholder="팁이나 세부사항"
                        value={taskDesc}
                        onChange={(e) => setTaskDesc(e.target.value)}
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#373d41] uppercase mb-1">시작일 (Day)</label>
                    <input
                        type="number"
                        min="0"
                        className="w-full p-2 border border-slate-300 rounded focus:border-[#081429] outline-none text-[#373d41]"
                        value={startOffset}
                        onChange={(e) => setStartOffset(parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-[#373d41] uppercase mb-1">기간</label>
                    <input
                        type="number"
                        min="1"
                        className="w-full p-2 border border-slate-300 rounded focus:border-[#081429] outline-none text-[#373d41]"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                    />
                </div>
                <div className="md:col-span-1">
                    <button
                        onClick={handleAddTask}
                        disabled={!taskTitle.trim()}
                        className="w-full p-2 bg-[#081429] text-white rounded font-medium hover:bg-[#081429]/90 disabled:bg-slate-300 transition"
                    >
                        추가
                    </button>
                </div>
            </div>

            {/* Task List Preview */}
            <div className="mb-8">
                <h4 className="text-sm font-semibold text-[#373d41] mb-2">등록된 항목 ({tasks.length})</h4>
                {tasks.length === 0 ? (
                    <p className="text-[#373d41]/60 text-sm italic">아직 등록된 항목이 없습니다. 위에서 추가해주세요.</p>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {tasks.map((task, idx) => (
                            <div key={task.id} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-full text-xs font-bold text-[#081429]">{idx + 1}</span>
                                    <div>
                                        <p className="font-medium text-[#081429] text-sm">{task.title}</p>
                                        <p className="text-xs text-[#373d41]/70">Day {task.startOffset}부터 {task.duration}일간</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveTask(task.id)}
                                    className="text-red-400 hover:text-red-600 p-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
                <button
                    onClick={onCancel}
                    className="px-6 py-2.5 rounded-lg border border-slate-300 text-[#373d41] font-medium hover:bg-slate-50 transition"
                >
                    취소
                </button>
                <button
                    onClick={handleSaveTemplate}
                    className="px-6 py-2.5 rounded-lg bg-[#081429] text-white font-medium hover:bg-[#081429]/90 shadow-md hover:shadow-lg transition"
                >
                    {initialData ? '수정 완료' : '간트 등록 완료'}
                </button>
            </div>
        </div>
    );
};

export default GanttBuilder;
