import React, { useState, useEffect } from 'react';
import { GanttSubTask, GanttTemplate, UserProfile } from '../../types';
import { Plus, X, User, Building2, Calendar, Clock, FileText, ChevronRight, Save, Edit2, RotateCcw } from 'lucide-react';

interface GanttBuilderProps {
    onSave: (template: GanttTemplate) => void;
    onCancel: () => void;
    initialData?: GanttTemplate;
    allUsers: UserProfile[];
}

const GanttBuilder: React.FC<GanttBuilderProps> = ({ onSave, onCancel, initialData, allUsers }) => {
    const [title, setTitle] = useState(initialData?.title || '');
    const [desc, setDesc] = useState(initialData?.description || '');
    const [startDate, setStartDate] = useState(initialData?.startDate || new Date().toISOString().split('T')[0]);
    // Deep copy tasks to avoid reference issues
    const [tasks, setTasks] = useState<GanttSubTask[]>(initialData?.tasks ? JSON.parse(JSON.stringify(initialData.tasks)) : []);

    // Form state for new/editing task
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDesc, setTaskDesc] = useState('');
    const [startOffset, setStartOffset] = useState<number>(0);
    const [duration, setDuration] = useState<number>(1);

    // Phase 7: Assignee & Department
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [assigneeName, setAssigneeName] = useState<string>('');
    const [assigneeEmail, setAssigneeEmail] = useState<string>('');
    const [departmentIds, setDepartmentIds] = useState<string[]>([]);

    // Phase 9: Category & Dependencies
    const [category, setCategory] = useState<'planning' | 'development' | 'testing' | 'other'>('planning');
    const [dependsOn, setDependsOn] = useState<string[]>([]);

    const DEPARTMENTS = [
        { id: 'math', label: '수학부', color: 'bg-cyan-500' },
        { id: 'english', label: '영어부', color: 'bg-orange-500' },
        { id: 'admin', label: '행정팀', color: 'bg-pink-500' },
        { id: 'facilities', label: '시설관리', color: 'bg-emerald-500' }
    ];

    const CATEGORIES = [
        { id: 'planning', label: '기획', color: 'bg-blue-500' },
        { id: 'development', label: '개발', color: 'bg-purple-500' },
        { id: 'testing', label: '테스트', color: 'bg-green-500' },
        { id: 'other', label: '기타', color: 'bg-slate-500' }
    ];

    const resetForm = () => {
        setEditingTaskId(null);
        setTaskTitle('');
        setTaskDesc('');
        setStartOffset(0);
        setDuration(1);
        setAssigneeId('');
        setAssigneeName('');
        setAssigneeEmail('');
        setDepartmentIds([]);
        setCategory('planning');
        setDependsOn([]);
    };

    const handleEditTask = (task: GanttSubTask) => {
        setEditingTaskId(task.id);
        setTaskTitle(task.title);
        setTaskDesc(task.description || '');
        setStartOffset(task.startOffset);
        setDuration(task.duration);
        setAssigneeId(task.assigneeId || '');
        setAssigneeName(task.assigneeName || '');
        setAssigneeEmail(task.assigneeEmail || '');
        setDepartmentIds(task.departmentIds || []);
        setCategory(task.category || 'planning');
        setDependsOn(task.dependsOn || []);

        // Scroll to form (optional UX improvement)
        const formElement = document.getElementById('task-form');
        if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSaveTask = () => {
        if (!taskTitle.trim()) return;

        const taskData: GanttSubTask = {
            id: editingTaskId || `task-${Date.now()}`,
            title: taskTitle,
            description: taskDesc,
            startOffset: Number(startOffset),
            duration: Number(duration),
            completed: false, // Reset completed status on edit? Maybe keep it. For builder it's template, so always false usually.
            assigneeId: assigneeId || undefined,
            assigneeName: assigneeName || undefined,
            assigneeEmail: assigneeEmail || undefined,
            departmentIds: departmentIds.length > 0 ? departmentIds : undefined,
            category: category,
            dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
        };

        if (editingTaskId) {
            // Update existing
            setTasks(prev => prev.map(t => t.id === editingTaskId ? taskData : t).sort((a, b) => a.startOffset - b.startOffset));
        } else {
            // Create new
            setTasks(prev => [...prev, taskData].sort((a, b) => a.startOffset - b.startOffset));
        }

        resetForm();
    };

    const handleRemoveTask = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering edit if row is clicked
        if (window.confirm("항목을 삭제하시겠습니까?")) {
            setTasks(prev => prev.filter(t => t.id !== id));
            if (editingTaskId === id) {
                resetForm();
            }
        }
    };

    const handleSaveTemplate = () => {
        if (!title.trim() || tasks.length === 0) {
            alert("프로젝트 제목과 최소 1개 이상의 항목이 필요합니다.");
            return;
        }
        const template: GanttTemplate = {
            ...initialData, // Preserve existing fields
            id: initialData?.id || `template-${Date.now()}`,
            title,
            description: desc,
            startDate,
            tasks,
            createdAt: initialData?.createdAt || Date.now(),
        };
        // Sanitize to remove undefined values (Firestore rejects explicitly undefined fields)
        const sanitizedTemplate = JSON.parse(JSON.stringify(template));
        onSave(sanitizedTemplate);
    };

    const handleAssigneeChange = (uid: string) => {
        if (!uid) {
            setAssigneeId('');
            setAssigneeName('');
            setAssigneeEmail('');
            return;
        }
        const user = allUsers.find(u => u.uid === uid);
        if (user) {
            setAssigneeId(user.uid);
            setAssigneeName(user.displayName || user.email.split('@')[0]);
            setAssigneeEmail(user.email);
        }
    };

    const toggleDepartment = (deptId: string) => {
        setDepartmentIds(prev =>
            prev.includes(deptId)
                ? prev.filter(id => id !== deptId)
                : [...prev, deptId]
        );
    };

    return (
        <div className="h-full bg-[#15171e] text-slate-300 font-sans flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-none px-8 py-6 bg-[#15171e] border-b border-white/5">
                <div className="flex items-center gap-2 text-yellow-400 mb-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                    <span className="text-xs font-bold tracking-wider">프로젝트</span>
                    <ChevronRight size={14} className="text-slate-500" />
                </div>
                <h1 className="text-3xl font-bold text-white">
                    {initialData ? '프로젝트 수정' : '새 프로젝트 생성'}
                </h1>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-8 bg-[#1c202b] rounded-tl-3xl border-t border-l border-white/5">
                {/* Project Details */}
                <div className="space-y-6 mb-10">
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">
                            <FileText size={12} className="inline mr-1" /> 프로젝트 제목
                        </label>
                        <input
                            type="text"
                            className="w-full p-4 bg-[#252a38] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition"
                            placeholder="예: 내신 대비 4주 완성"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">
                            설명 (선택)
                        </label>
                        <input
                            type="text"
                            className="w-full p-4 bg-[#252a38] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition"
                            placeholder="프로젝트에 대한 간단한 설명"
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">
                            📅 시작 날짜
                        </label>
                        <input
                            type="date"
                            className="w-full p-4 bg-[#252a38] border border-white/10 rounded-xl text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* Task Form Card */}
                <div id="task-form" className={`bg-[#252a38] border ${editingTaskId ? 'border-yellow-500/50 shadow-yellow-500/10' : 'border-white/10'} rounded-2xl p-6 mb-8 shadow-xl transition-all`}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className={`text-lg font-bold flex items-center gap-2 ${editingTaskId ? 'text-yellow-400' : 'text-white'}`}>
                            {editingTaskId ? (
                                <>
                                    <Edit2 size={18} />
                                    항목 수정 중
                                </>
                            ) : (
                                <>
                                    <Plus size={18} className="text-emerald-400" />
                                    항목 추가
                                </>
                            )}
                        </h3>
                        {editingTaskId && (
                            <button
                                onClick={resetForm}
                                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-full"
                            >
                                <RotateCcw size={10} /> 수정 취소 (새 항목 모드)
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
                        <div className="md:col-span-8">
                            <label className="block text-sm font-bold text-slate-500 mb-2">항목명</label>
                            <input
                                type="text"
                                className="w-full p-3 bg-[#1c202b] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:border-emerald-500 outline-none transition"
                                placeholder="할 일을 입력하세요"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-500 mb-2 flex items-center gap-1">
                                <Calendar size={10} /> 시작일 (Offset)
                            </label>
                            <input
                                type="number"
                                min="0"
                                className="w-full p-3 bg-[#1c202b] border border-white/5 rounded-lg text-white focus:border-emerald-500 outline-none transition"
                                value={startOffset}
                                onChange={(e) => setStartOffset(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-500 mb-2 flex items-center gap-1">
                                <Clock size={10} /> 기간 (일)
                            </label>
                            <input
                                type="number"
                                min="1"
                                className="w-full p-3 bg-[#1c202b] border border-white/5 rounded-lg text-white focus:border-emerald-500 outline-none transition"
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-500 mb-2">상세 설명</label>
                        <input
                            type="text"
                            className="w-full p-3 bg-[#1c202b] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:border-emerald-500 outline-none transition"
                            placeholder="팁이나 세부사항 (선택)"
                            value={taskDesc}
                            onChange={(e) => setTaskDesc(e.target.value)}
                        />
                    </div>

                    {/* Assignee & Departments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-2 flex items-center gap-1">
                                <User size={10} /> 담당자
                            </label>
                            <select
                                className="w-full p-3 bg-[#1c202b] border border-white/5 rounded-lg text-white focus:border-emerald-500 outline-none transition appearance-none cursor-pointer"
                                value={assigneeId}
                                onChange={(e) => handleAssigneeChange(e.target.value)}
                            >
                                <option value="">담당자 없음</option>
                                {allUsers
                                    .filter(u => ['master', 'admin', 'manager', 'editor', 'math_lead', 'english_lead'].includes(u.role))
                                    .map(u => (
                                        <option key={u.uid} value={u.uid}>
                                            {u.displayName || u.email.split('@')[0]} ({u.jobTitle || u.role})
                                        </option>
                                    ))
                                }
                            </select>
                            {assigneeEmail && (
                                <p className="text-xs text-emerald-400 mt-2">📧 {assigneeEmail}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-2 flex items-center gap-1">
                                <Building2 size={10} /> 관련 부서
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {DEPARTMENTS.map(dept => (
                                    <button
                                        key={dept.id}
                                        type="button"
                                        onClick={() => toggleDepartment(dept.id)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${departmentIds.includes(dept.id)
                                            ? `${dept.color} text-white border-transparent shadow-lg`
                                            : 'bg-[#1c202b] text-slate-400 border-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        {dept.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Phase 9: Category & Dependencies */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-2">카테고리</label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategory(cat.id as typeof category)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${category === cat.id
                                            ? `${cat.color} text-white border-transparent shadow-lg`
                                            : 'bg-[#1c202b] text-slate-400 border-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-2">선행 작업 (의존성)</label>
                            <select
                                className="w-full p-3 bg-[#1c202b] border border-white/5 rounded-lg text-white focus:border-emerald-500 outline-none transition appearance-none cursor-pointer"
                                value=""
                                onChange={(e) => {
                                    if (e.target.value && !dependsOn.includes(e.target.value)) {
                                        setDependsOn([...dependsOn, e.target.value]);
                                    }
                                }}
                            >
                                <option value="">선행 작업 선택...</option>
                                {tasks
                                    .filter(t => t.id !== editingTaskId) // Cannot depend on self
                                    .filter(t => !dependsOn.includes(t.id))
                                    .map(t => (
                                        <option key={t.id} value={t.id}>{t.title}</option>
                                    ))}
                            </select>
                            {dependsOn.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {dependsOn.map(depId => {
                                        const depTask = tasks.find(t => t.id === depId);
                                        return (
                                            <span
                                                key={depId}
                                                className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1"
                                            >
                                                {depTask?.title || depId}
                                                <button
                                                    type="button"
                                                    onClick={() => setDependsOn(dependsOn.filter(id => id !== depId))}
                                                    className="hover:text-white"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end mt-6">
                        <button
                            onClick={handleSaveTask}
                            disabled={!taskTitle.trim()}
                            className={`px-6 py-3 text-white rounded-full font-bold flex items-center gap-2 shadow-lg transition-all disabled:shadow-none disabled:bg-slate-700 disabled:text-slate-500 ${editingTaskId
                                ? 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20'
                                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                                }`}
                        >
                            {editingTaskId ? (
                                <>
                                    <Save size={16} /> 수정 완료
                                </>
                            ) : (
                                <>
                                    <Plus size={16} /> 항목 추가
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Task List */}
                <div className="mb-8">
                    <h4 className="text-sm font-bold text-slate-400 mb-4 flex justify-between items-center">
                        <span>등록된 항목 ({tasks.length})</span>
                        <span className="text-xs font-normal text-slate-500">클릭하여 수정 가능</span>
                    </h4>
                    {tasks.length === 0 ? (
                        <div className="text-center py-12 bg-[#252a38] rounded-xl border border-dashed border-white/10">
                            <span className="text-4xl mb-4 block">📋</span>
                            <p className="text-slate-500">아직 등록된 항목이 없습니다.</p>
                            <p className="text-slate-600 text-sm">위에서 항목을 추가해주세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                            {tasks.map((task, idx) => {
                                const colors = ['bg-cyan-500', 'bg-orange-500', 'bg-pink-500', 'bg-emerald-500', 'bg-purple-500'];
                                const barColor = colors[idx % colors.length];
                                const isEditing = editingTaskId === task.id;

                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => handleEditTask(task)} // Click to edit
                                        className={`flex items-center gap-4 bg-[#252a38] border p-4 rounded-xl transition-all cursor-pointer group ${isEditing
                                            ? 'border-yellow-500 ring-1 ring-yellow-500/50'
                                            : 'border-white/5 hover:border-white/20 hover:bg-[#2a2f3d]'
                                            }`}
                                    >
                                        <div className={`w-1 h-12 rounded-full ${barColor}`}></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`font-bold truncate ${isEditing ? 'text-yellow-400' : 'text-white'}`}>
                                                    {task.title}
                                                </span>
                                                {task.assigneeName && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                                                        @{task.assigneeName}
                                                    </span>
                                                )}
                                                {isEditing && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-medium animate-pulse">
                                                        수정 중
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={10} /> Day {task.startOffset}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={10} /> {task.duration}일
                                                </span>
                                                {task.departmentIds && task.departmentIds.length > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Building2 size={10} />
                                                        {task.departmentIds.map(dId => DEPARTMENTS.find(d => d.id === dId)?.label || dId).join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleRemoveTask(task.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                                            title="삭제"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-end pt-6 border-t border-white/5">
                    <button
                        onClick={onCancel}
                        className="px-6 py-3 rounded-xl border border-white/10 text-slate-400 font-medium hover:bg-white/5 hover:text-white transition-all"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSaveTemplate}
                        className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                    >
                        <Save size={16} />
                        {initialData ? '수정 완료' : '프로젝트 생성'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GanttBuilder;
