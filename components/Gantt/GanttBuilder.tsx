import React, { useState, useEffect, useMemo } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { GanttSubTask, GanttTemplate, UserProfile } from '../../types';
import { Plus, X, User, Building2, Calendar, Clock, FileText, ChevronRight, Save, Edit2, RotateCcw } from 'lucide-react';

interface GanttBuilderProps {
    onSave: (template: GanttTemplate) => void;
    onCancel: () => void;
    initialData?: GanttTemplate;
    allUsers: UserProfile[];
    currentUser?: UserProfile | null;
    templates?: GanttTemplate[];
}

const GanttBuilder: React.FC<GanttBuilderProps> = ({ onSave, onCancel, initialData, allUsers, currentUser, templates }) => {
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

    // Phase 7: Assignee & Department - Default to current user
    const [assigneeId, setAssigneeId] = useState<string>(currentUser?.uid || '');
    const [assigneeName, setAssigneeName] = useState<string>(currentUser?.displayName || currentUser?.email?.split('@')[0] || '');
    const [assigneeEmail, setAssigneeEmail] = useState<string>(currentUser?.email || '');
    const [departmentIds, setDepartmentIds] = useState<string[]>([]);

    // Phase 9: Category & Dependencies
    const [category, setCategory] = useState<'planning' | 'development' | 'testing' | 'other'>('planning');
    const [dependsOn, setDependsOn] = useState<string[]>([]);

    // Sorted users: current user first, then by displayName (가나다순)
    const sortedUsers = useMemo(() => {
        const eligible = allUsers.filter(u => ['master', 'admin', 'manager', 'editor', 'math_lead', 'english_lead'].includes(u.role));
        return eligible.sort((a, b) => {
            // Current user always first
            if (a.uid === currentUser?.uid) return -1;
            if (b.uid === currentUser?.uid) return 1;
            // Then by jobTitle (호칭) / displayName (가나다순)
            const nameA = a.jobTitle || a.displayName || a.email.split('@')[0];
            const nameB = b.jobTitle || b.displayName || b.email.split('@')[0];
            return nameA.localeCompare(nameB, 'ko');
        });
    }, [allUsers, currentUser]);

    // Format user display: "호칭 (이메일)" or just "이메일"
    const formatUserDisplay = (user: UserProfile) => {
        const title = user.jobTitle || user.displayName;
        if (title) {
            return `${title} (${user.email})`;
        }
        return user.email;
    };

    // Format task date from offset: "1월 2일" format
    const formatTaskDate = (offset: number) => {
        if (!startDate) return `Day ${offset}`;
        try {
            const baseDate = parseISO(startDate);
            const taskDate = addDays(baseDate, offset);
            return format(taskDate, 'M월 d일', { locale: ko });
        } catch {
            return `Day ${offset}`;
        }
    };

    const DEPARTMENTS = [
        { id: 'math', label: '수학부', color: 'bg-cyan-500' },
        { id: 'english', label: '영어부', color: 'bg-orange-500' },
        { id: 'admin', label: '행정팀', color: 'bg-pink-500' },
        { id: 'facilities', label: '시설관리', color: 'bg-emerald-500' }
    ];

    const CATEGORIES = [
        { id: 'planning', label: '기획', color: 'bg-blue-600', inactiveColor: 'bg-blue-900/40' },
        { id: 'development', label: '개발', color: 'bg-purple-600', inactiveColor: 'bg-purple-900/40' },
        { id: 'testing', label: '테스트', color: 'bg-green-600', inactiveColor: 'bg-green-900/40' },
        { id: 'other', label: '기타', color: 'bg-slate-600', inactiveColor: 'bg-slate-700/60' }
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

    const handleImportTemplate = (templateId: string) => {
        if (!templates) return;
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        if (tasks.length > 0 && !window.confirm(`'${template.title}' 템플릿을 불러오시겠습니까? 기존에 입력한 태스크는 초기화됩니다.`)) {
            return;
        }

        // Deep copy tasks
        const importedTasks = JSON.parse(JSON.stringify(template.tasks));
        setTasks(importedTasks);
        if (!title && title !== template.title) setTitle(`${template.title} (복사본)`);
        if (!desc) setDesc(template.description || '');
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

                {/* Template Import (Only for New Projects) */}
                {!initialData && templates && templates.length > 0 && (
                    <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-24 h-24 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" /><path d="M7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" /></svg>
                        </div>
                        <label className="block text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V5a2 2 0 012-2h4.586" />
                            </svg>
                            템플릿에서 불러오기
                        </label>
                        <select
                            className="w-full p-3 bg-[#15171e] text-slate-300 text-sm rounded-lg border border-white/10 focus:border-blue-500 outline-none shadow-inner"
                            onChange={(e) => handleImportTemplate(e.target.value)}
                            defaultValue=""
                        >
                            <option value="" disabled>사용할 템플릿을 선택하세요...</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Project Details - Compact Layout */}
                <div className="space-y-3 mb-6">
                    {/* Row 1: Title (left) + Start Date (right) */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                <FileText size={10} className="inline mr-1" /> 프로젝트 제목
                            </label>
                            <input
                                type="text"
                                className="w-full p-2.5 bg-[#252a38] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition"
                                placeholder="예: 내신 대비 4주 완성"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>
                        <div className="w-40">
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                📅 시작일
                            </label>
                            <input
                                type="date"
                                className="w-full p-2.5 bg-[#252a38] border border-white/10 rounded-lg text-sm text-white focus:border-emerald-500 outline-none transition"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* Row 2: Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">설명 (선택)</label>
                        <input
                            type="text"
                            className="w-full p-2.5 bg-[#252a38] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition"
                            placeholder="프로젝트에 대한 간단한 설명"
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                        />
                    </div>
                </div>

                {/* Side-by-Side Layout: Form (Left) + Task List (Right) */}
                <div className="flex gap-4 flex-1 min-h-0">
                    {/* LEFT: Task Form - Compact */}
                    <div id="task-form" className={`w-1/2 bg-[#252a38] border ${editingTaskId ? 'border-yellow-500/50' : 'border-white/10'} rounded-xl p-3 shadow-lg transition-all flex flex-col`}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className={`text-xs font-bold flex items-center gap-1.5 ${editingTaskId ? 'text-yellow-400' : 'text-white'}`}>
                                {editingTaskId ? <><Edit2 size={12} /> 항목 수정</> : <><Plus size={12} className="text-emerald-400" /> 항목 추가</>}
                            </h3>
                            {editingTaskId && (
                                <button onClick={resetForm} className="text-[9px] text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded">
                                    <RotateCcw size={8} />재설정
                                </button>
                            )}
                        </div>

                        {/* Row 1: Name + Offset + Duration */}
                        <div className="flex gap-2 mb-2">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    className="w-full p-1.5 bg-[#1c202b] border border-white/5 rounded text-xs text-white placeholder-slate-600 focus:border-emerald-500 outline-none"
                                    placeholder="항목명"
                                    value={taskTitle}
                                    onChange={(e) => setTaskTitle(e.target.value)}
                                />
                            </div>
                            <div className="w-16">
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full p-1.5 bg-[#1c202b] border border-white/5 rounded text-xs text-white text-center focus:border-emerald-500 outline-none"
                                    placeholder="D0"
                                    title="시작일 (Day)"
                                    value={startOffset}
                                    onChange={(e) => setStartOffset(parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="w-14">
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full p-1.5 bg-[#1c202b] border border-white/5 rounded text-xs text-white text-center focus:border-emerald-500 outline-none"
                                    placeholder="1일"
                                    title="기간 (일)"
                                    value={duration}
                                    onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                                />
                            </div>
                        </div>

                        {/* Row 2: Assignee + Category */}
                        <div className="flex gap-2 mb-2">
                            <select
                                className="w-32 p-1.5 bg-[#1c202b] border border-white/5 rounded text-xs text-white focus:border-emerald-500 outline-none cursor-pointer truncate"
                                value={assigneeId}
                                onChange={(e) => handleAssigneeChange(e.target.value)}
                            >
                                <option value="">담당자 없음</option>
                                {sortedUsers.map(u => (
                                    <option key={u.uid} value={u.uid}>{formatUserDisplay(u)}</option>
                                ))}
                            </select>
                            <div className="flex gap-1 flex-1 justify-end">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategory(cat.id as typeof category)}
                                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${category === cat.id
                                            ? `${cat.color} text-white shadow-lg`
                                            : `${cat.inactiveColor} text-slate-400 hover:text-white`
                                            }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Row 3: Departments */}
                        <div className="flex gap-1 mb-2">
                            {DEPARTMENTS.map(dept => (
                                <button
                                    key={dept.id}
                                    type="button"
                                    onClick={() => toggleDepartment(dept.id)}
                                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${departmentIds.includes(dept.id)
                                        ? `${dept.color} text-white`
                                        : 'bg-[#1c202b] text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    {dept.label}
                                </button>
                            ))}
                        </div>

                        {/* Row 4: Dependency */}
                        <div className="mb-2">
                            <select
                                className="w-full p-1.5 bg-[#1c202b] border border-white/5 rounded text-xs text-white focus:border-emerald-500 outline-none cursor-pointer"
                                value=""
                                onChange={(e) => {
                                    if (e.target.value && !dependsOn.includes(e.target.value)) {
                                        setDependsOn([...dependsOn, e.target.value]);
                                    }
                                }}
                            >
                                <option value="">선행 작업 선택...</option>
                                {tasks
                                    .filter(t => t.id !== editingTaskId)
                                    .filter(t => !dependsOn.includes(t.id))
                                    .filter(t => t.startOffset !== startOffset) // Exclude same-date tasks
                                    .map(t => (
                                        <option key={t.id} value={t.id}>{t.title} (Day {t.startOffset})</option>
                                    ))}
                            </select>
                            {dependsOn.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {dependsOn.map(depId => {
                                        const depTask = tasks.find(t => t.id === depId);
                                        return (
                                            <span key={depId} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded flex items-center gap-1">
                                                {depTask?.title || depId}
                                                <button type="button" onClick={() => setDependsOn(dependsOn.filter(id => id !== depId))} className="hover:text-white">
                                                    <X size={10} />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={handleSaveTask}
                            disabled={!taskTitle.trim()}
                            className={`w-full py-2 text-xs text-white rounded font-bold flex items-center justify-center gap-1 transition-all disabled:bg-slate-700 disabled:text-slate-500 ${editingTaskId
                                ? 'bg-yellow-500 hover:bg-yellow-600'
                                : 'bg-emerald-500 hover:bg-emerald-600'
                                }`}
                        >
                            {editingTaskId ? <><Save size={12} /> 수정 완료</> : <><Plus size={12} /> 추가</>}
                        </button>
                    </div>

                    {/* RIGHT: Task List */}
                    <div className="w-1/2 bg-[#252a38] border border-white/10 rounded-xl p-3 flex flex-col">
                        <h4 className="text-xs font-bold text-slate-400 mb-2">등록된 항목 ({tasks.length})</h4>
                        {tasks.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <span className="text-2xl mb-2">📋</span>
                                <p className="text-slate-500 text-xs">항목이 없습니다</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                                {tasks.map((task, idx) => {
                                    const colors = ['bg-cyan-500', 'bg-orange-500', 'bg-pink-500', 'bg-emerald-500', 'bg-purple-500'];
                                    const barColor = colors[idx % colors.length];
                                    const isEditing = editingTaskId === task.id;
                                    const dependencyNames = task.dependsOn?.map(depId => tasks.find(t => t.id === depId)?.title || depId) || [];

                                    return (
                                        <div
                                            key={task.id}
                                            className={`flex items-center gap-3 bg-[#252a38] border p-2.5 rounded-lg transition-all cursor-pointer group ${isEditing
                                                ? 'border-yellow-500 ring-1 ring-yellow-500/50'
                                                : 'border-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            <div className={`w-1 h-10 rounded-full ${barColor}`}></div>
                                            <div className="flex-1 min-w-0" onClick={() => handleEditTask(task)}>
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className={`text-sm font-bold truncate ${isEditing ? 'text-yellow-400' : 'text-white'}`}>
                                                        {task.title}
                                                    </span>
                                                    {isEditing && (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-medium">
                                                            수정중
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                                                    <span style={{ color: '#fdb813' }}>{formatTaskDate(task.startOffset)}</span>
                                                    <span>• {task.duration}일</span>
                                                    {task.assigneeName && (
                                                        <span className="text-emerald-400">@{task.assigneeName}</span>
                                                    )}
                                                    {dependencyNames.length > 0 && (
                                                        <span className="text-blue-400">← {dependencyNames.join(', ')}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                                                    className="p-1.5 rounded hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 transition-all"
                                                    title="수정"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleRemoveTask(task.id, e)}
                                                    className="p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                                                    title="삭제"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
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
