import React, { useState, useEffect, useMemo } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { GanttSubTask, GanttTemplate, UserProfile, ProjectVisibility, ProjectMember, ProjectMemberRole } from '../../types';
import { useGanttCategories } from '../../hooks/useGanttCategories';
import { useGanttDepartments } from '../../hooks/useGanttDepartments';
import { Plus, X, User, Building2, Calendar, Clock, FileText, ChevronRight, Save, Edit2, RotateCcw, Lock, Globe, ClipboardList } from 'lucide-react';

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

    // Phase 10: Visibility & Members
    const [visibility, setVisibility] = useState<ProjectVisibility>(initialData?.visibility || 'private');
    const [projectMembers, setProjectMembers] = useState<ProjectMember[]>(initialData?.members || []);
    const [projectDepartmentIds, setProjectDepartmentIds] = useState<string[]>(initialData?.departmentIds || []);

    // Phase 9: Category & Dependencies (Phase 11: Dynamic categories)
    const [category, setCategory] = useState<string>('planning');
    const [dependsOn, setDependsOn] = useState<string[]>([]);

    // Phase 6: Dynamic Department Loading - P2 개선: 중앙화된 hook 사용
    const { data: dynamicDepartments = [] } = useGanttDepartments();
    // Type guard to ensure array for safe usage
    const departments = Array.isArray(dynamicDepartments) ? dynamicDepartments : [];

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



    // Dynamic Categories (Phase 11 - P2 리팩토링: 중앙화된 hook 사용)
    const { data: dynamicCategories = [] } = useGanttCategories();

    const CATEGORIES = useMemo(() => {
        return dynamicCategories.map(cat => ({
            id: cat.id,
            label: cat.label,
            // Map dynamic colors to class-like strings or use style directly?
            // GanttBuilder uses `color` prop for classNames like `bg-blue-600` in the CONSTANT.
            // But now we have hex values.
            // We need to adjust how these are consumed.
            // The existing `color` prop was `bg-blue-600`.
            // We should change the consumer to use `style` instead or adapt.
            // For now, let's keep the object structure but add `style` field and use it in rendering.
            color: '', // Deprecated class
            inactiveColor: '', // Deprecated class
            style: { backgroundColor: cat.backgroundColor, color: cat.textColor, borderColor: cat.backgroundColor }, // Active style
            inactiveStyle: { backgroundColor: '#ffffff', color: '#9ca3af', borderColor: '#e5e7eb' } // Default inactive
        }));
    }, [dynamicCategories]);

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

    // Phase 10: Toggle Project Member with Role
    const toggleProjectMember = (uid: string, role: ProjectMemberRole = 'viewer') => {
        const user = allUsers.find(u => u.uid === uid);
        if (!user) return;

        setProjectMembers(prev => {
            const existingIndex = prev.findIndex(m => m.userId === uid);
            if (existingIndex >= 0) {
                return prev.filter(m => m.userId !== uid);
            } else {
                const newMember: ProjectMember = {
                    userId: uid,
                    userName: user.displayName || user.email.split('@')[0],
                    userEmail: user.email,
                    role: role,
                    addedAt: Date.now(),
                    addedBy: currentUser?.uid || ''
                };
                return [...prev, newMember];
            }
        });
    };

    const updateMemberRole = (uid: string, newRole: ProjectMemberRole) => {
        setProjectMembers(prev => prev.map(m =>
            m.userId === uid ? { ...m, role: newRole } : m
        ));
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
            // Phase 10
            visibility,
            members: projectMembers,
            ownerId: initialData?.ownerId || currentUser?.uid,
            departmentIds: visibility === 'department' ? projectDepartmentIds : undefined,
            memberIds: projectMembers.map(m => m.userId), // Phase 10: Query optimization
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
        <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 font-sans flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-none px-6 py-4 bg-primary border-b border-accent/20 shadow-lg">
                <div className="flex items-center gap-2 text-accent mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-sm bg-accent animate-pulse"></div>
                    <span className="text-xxs font-bold tracking-widest uppercase">Project Builder</span>
                    <ChevronRight size={12} className="text-primary-700" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                    {initialData ? '프로젝트 수정' : '새 프로젝트 생성'}
                </h1>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-5 bg-transparent">

                {/* Template Import (Only for New Projects) */}
                {!initialData && templates && templates.length > 0 && (
                    <div className="mb-4 p-3 bg-white border border-accent/30 rounded-sm shadow-md relative overflow-hidden group hover:shadow-lg transition-shadow">
                        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-16 h-16 text-accent" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" /><path d="M7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" /></svg>
                        </div>
                        <label className="block text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V5a2 2 0 012-2h4.586" />
                            </svg>
                            템플릿 불러오기
                        </label>
                        <select
                            className="w-full p-2 bg-white text-primary text-xs rounded-sm border border-gray-300 focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm font-medium"
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
                <div className="space-y-2.5 mb-4">
                    {/* Row 1: Title (left) + Start Date (right) */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-xxs font-bold text-primary-700 mb-1 uppercase tracking-wide flex items-center gap-1">
                                <FileText size={10} className="text-accent" /> 프로젝트 제목
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-sm text-primary placeholder-gray-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm font-medium"
                                placeholder="예: 내신 대비 4주 완성"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>
                        <div className="w-36">
                            <label className="block text-xxs font-bold text-primary-700 mb-1 uppercase tracking-wide flex items-center gap-1">
                                <Calendar size={10} className="text-accent" /> 시작일
                            </label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-sm text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm font-medium"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* Row 2: Description */}
                    <div>
                        <label className="block text-xxs font-bold text-primary-700 mb-1 uppercase tracking-wide">설명 (선택)</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-sm text-primary placeholder-gray-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm"
                            placeholder="프로젝트에 대한 간단한 설명"
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                        />
                    </div>
                </div>

                {/* Phase 10: Project Members */}
                <div className="mb-4">
                    <label className="block text-xxs font-bold text-primary-700 mb-2 uppercase tracking-wide flex items-center gap-1">
                        <User size={10} className="text-accent" /> 프로젝트 멤버
                    </label>
                    <div className="bg-white border border-gray-300 rounded-sm p-3 shadow-sm">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {sortedUsers.map(user => {
                                const member = projectMembers.find(m => m.userId === user.uid);
                                const isSelected = !!member;
                                return (
                                    <button
                                        key={user.uid}
                                        type="button"
                                        onClick={() => toggleProjectMember(user.uid, 'viewer')}
                                        className={`px-2.5 py-1 rounded-sm text-xxs font-bold transition-all ${isSelected
                                            ? 'bg-accent text-primary shadow-md'
                                            : 'bg-gray-100 text-primary-700 hover:bg-gray-200 border border-gray-300'
                                            }`}
                                    >
                                        {formatUserDisplay(user)}
                                        {isSelected && <span className="ml-1 opacity-70">✓</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {projectMembers.length > 0 && (
                            <div className="border-t border-gray-200 pt-2 mt-2">
                                <p className="text-micro text-primary-700 mb-1.5 font-medium">역할 설정:</p>
                                <div className="space-y-1">
                                    {projectMembers.map(member => (
                                        <div key={member.userId} className="flex items-center justify-between bg-gray-50 rounded-sm px-2.5 py-1.5 border border-gray-200">
                                            <span className="text-xxs text-primary font-medium">{member.userName || member.userEmail}</span>
                                            <select
                                                value={member.role}
                                                onChange={(e) => updateMemberRole(member.userId, e.target.value as ProjectMemberRole)}
                                                className="text-micro px-2 py-0.5 rounded font-bold cursor-pointer outline-none bg-white border border-gray-300 focus:border-accent focus:ring-1 focus:ring-accent"
                                            >
                                                <option value="viewer">관찰자</option>
                                                <option value="editor">편집자</option>
                                                <option value="admin">관리자</option>
                                                <option value="owner">소유자</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Phase 10: Visibility */}
                <div className="mb-4">
                    <label className="block text-xxs font-bold text-primary-700 mb-2 uppercase tracking-wide flex items-center gap-1">
                        <Globe size={10} className="text-accent" /> 공개 범위
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setVisibility('private')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-xxs font-bold transition-all shadow-sm ${visibility === 'private'
                                ? 'bg-primary-700 text-white ring-2 ring-[#373d41]/50'
                                : 'bg-white text-primary-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            <Lock size={12} />
                            <span>비공개</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setVisibility('department')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-xxs font-bold transition-all shadow-sm ${visibility === 'department'
                                ? 'bg-purple-600 text-white ring-2 ring-purple-400/50'
                                : 'bg-white text-primary-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            <Building2 size={12} />
                            <span>부서</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setVisibility('public')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-xxs font-bold transition-all shadow-sm ${visibility === 'public'
                                ? 'bg-green-600 text-white ring-2 ring-green-400/50'
                                : 'bg-white text-primary-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            <Globe size={12} />
                            <span>전체</span>
                        </button>
                    </div>

                    {/* Phase 6: Department Selector */}
                    {visibility === 'department' && (
                        <div className="mt-2 p-2.5 bg-purple-50 rounded-sm border border-purple-200">
                            <p className="text-micro text-purple-700 mb-1.5 font-bold">공개할 부서:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {departments.map(dept => {
                                    const isSelected = projectDepartmentIds.includes(dept.id);
                                    return (
                                        <button
                                            key={dept.id}
                                            type="button"
                                            onClick={() => {
                                                setProjectDepartmentIds(prev =>
                                                    prev.includes(dept.id)
                                                        ? prev.filter(id => id !== dept.id)
                                                        : [...prev, dept.id]
                                                );
                                            }}
                                            className={`px-2.5 py-1 rounded-sm text-xxs font-bold transition-all ${isSelected
                                                ? 'bg-purple-500 text-white shadow-md'
                                                : 'bg-white text-primary-700 hover:bg-gray-100 border border-gray-300'
                                                }`}
                                        >
                                            {dept.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Side-by-Side Layout: Form (Left) + Task List (Right) */}
                <div className="flex gap-3 flex-1 min-h-0">
                    {/* LEFT: Task Form - Compact */}
                    <div id="task-form" className={`w-1/2 bg-white border-2 ${editingTaskId ? 'border-accent' : 'border-gray-300'} rounded-sm p-3 shadow-md transition-all flex flex-col`}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className={`text-xs font-bold flex items-center gap-1.5 ${editingTaskId ? 'text-accent' : 'text-primary'}`}>
                                {editingTaskId ? <><Edit2 size={12} /> 항목 수정</> : <><Plus size={12} className="text-accent" /> 항목 추가</>}
                            </h3>
                            {editingTaskId && (
                                <button onClick={resetForm} className="text-micro text-primary-700 hover:text-primary flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-sm font-bold">
                                    <RotateCcw size={8} />재설정
                                </button>
                            )}
                        </div>

                        {/* Row 1: Name + Offset + Duration */}
                        <div className="flex gap-1.5 mb-2">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-sm text-xs text-primary placeholder-gray-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none font-medium"
                                    placeholder="항목명"
                                    value={taskTitle}
                                    onChange={(e) => setTaskTitle(e.target.value)}
                                />
                            </div>
                            <div className="w-14">
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-sm text-xs text-primary text-center focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder-gray-400 font-bold"
                                    placeholder="D0"
                                    title="시작일 (Day)"
                                    value={startOffset}
                                    onChange={(e) => setStartOffset(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                />
                            </div>
                            <div className="w-12">
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-sm text-xs text-primary text-center focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder-gray-400 font-bold"
                                    placeholder="1"
                                    title="기간 (일)"
                                    value={duration}
                                    onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                />
                            </div>
                        </div>

                        {/* Row 2: Assignee + Category */}
                        <div className="flex gap-1.5 mb-2">
                            <select
                                className="w-28 px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-sm text-xxs text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none cursor-pointer truncate font-bold"
                                value={assigneeId}
                                onChange={(e) => handleAssigneeChange(e.target.value)}
                            >
                                <option value="">담당자</option>
                                {sortedUsers.map(u => (
                                    <option key={u.uid} value={u.uid}>{formatUserDisplay(u)}</option>
                                ))}
                            </select>
                            <div className="flex gap-1 flex-1 justify-end flex-wrap">
                                {CATEGORIES.map(cat => {
                                    const isSelected = category === cat.id;
                                    const activeStyle = {
                                        backgroundColor: cat.style?.backgroundColor,
                                        color: cat.style?.color,
                                        borderColor: cat.style?.borderColor
                                    };

                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategory(cat.id as typeof category)}
                                            style={isSelected ? activeStyle : undefined}
                                            className={`px-2 py-1 rounded-sm text-micro font-bold transition-all border ${isSelected
                                                ? 'shadow-sm ring-1 ring-[#fdb813]/50'
                                                : 'bg-white text-primary-700 border-gray-300 hover:bg-gray-100'
                                                }`}
                                        >
                                            {cat.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Row 3: Departments (Task Level - Phase 6: Dynamic) */}
                        <div className="flex gap-1 mb-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            {departments.map(dept => (
                                <button
                                    key={dept.id}
                                    type="button"
                                    onClick={() => toggleDepartment(dept.id)}
                                    className={`px-2 py-0.5 rounded-sm text-micro font-bold whitespace-nowrap transition-all ${departmentIds.includes(dept.id)
                                        ? 'bg-purple-500 text-white shadow-sm'
                                        : 'bg-gray-100 text-primary-700 hover:bg-gray-200 border border-gray-300'
                                        }`}
                                >
                                    {dept.label}
                                </button>
                            ))}
                        </div>

                        {/* Row 4: Dependency */}
                        <div className="mb-2">
                            <select
                                className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-sm text-xxs text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none cursor-pointer font-medium"
                                value=""
                                onChange={(e) => {
                                    const newDepId = e.target.value;
                                    if (!newDepId || dependsOn.includes(newDepId)) return;

                                    // BUG #9 Fix: 순환 의존성 검증 (2026-01-04)
                                    const hasCycle = (taskId: string, depId: string): boolean => {
                                        const visited = new Set<string>();
                                        const stack = [depId];
                                        while (stack.length > 0) {
                                            const current = stack.pop()!;
                                            if (current === taskId) return true;
                                            if (visited.has(current)) continue;
                                            visited.add(current);
                                            const task = tasks.find(t => t.id === current);
                                            if (task?.dependsOn) stack.push(...task.dependsOn);
                                        }
                                        return false;
                                    };

                                    if (editingTaskId && hasCycle(editingTaskId, newDepId)) {
                                        alert('순환 의존성은 추가할 수 없습니다.');
                                        return;
                                    }

                                    setDependsOn([...dependsOn, newDepId]);
                                }}
                            >
                                <option value="">선행 작업</option>
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
                                            <span key={depId} className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-micro rounded-sm flex items-center gap-1 font-bold">
                                                {depTask?.title || depId}
                                                <button type="button" onClick={() => setDependsOn(dependsOn.filter(id => id !== depId))} className="hover:text-blue-800">
                                                    <X size={9} />
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
                            className={`w-full py-2.5 text-xs text-primary rounded-sm font-black flex items-center justify-center gap-1.5 transition-all shadow-md disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none ${editingTaskId
                                ? 'bg-accent hover:bg-accent/90 shadow-[#fdb813]/30'
                                : 'bg-accent hover:bg-accent/90 shadow-[#fdb813]/30'
                                }`}
                        >
                            {editingTaskId ? <><Save size={13} /> 수정 완료</> : <><Plus size={13} /> 추가</>}
                        </button>
                    </div>

                    {/* RIGHT: Task List */}
                    <div className="w-1/2 bg-white border-2 border-gray-300 rounded-sm p-3 flex flex-col shadow-md">
                        <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                            <span>등록된 항목</span>
                            <span className="text-accent">({tasks.length})</span>
                        </h4>
                        {tasks.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                                <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-sm flex items-center justify-center mb-2 shadow-inner">
                                    <ClipboardList className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="text-primary text-xxs font-bold">항목이 없습니다</p>
                                <p className="text-gray-400 text-micro mt-1">왼쪽 폼에서 항목을 추가하세요</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-gray-300">
                                {tasks.map((task, idx) => {
                                    const colors = ['bg-cyan-500', 'bg-orange-500', 'bg-pink-500', 'bg-emerald-500', 'bg-purple-500'];
                                    const barColor = colors[idx % colors.length];
                                    const isEditing = editingTaskId === task.id;
                                    const dependencyNames = task.dependsOn?.map(depId => tasks.find(t => t.id === depId)?.title || depId) || [];

                                    return (
                                        <div
                                            key={task.id}
                                            className={`flex items-center gap-2 bg-gradient-to-r from-white to-gray-50 border-2 p-2 rounded-sm transition-all cursor-pointer group hover:shadow-md ${isEditing
                                                ? 'border-accent ring-2 ring-[#fdb813]/30'
                                                : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            <div className={`w-1 h-9 rounded-sm ${barColor} shadow-sm`}></div>
                                            <div className="flex-1 min-w-0" onClick={() => handleEditTask(task)}>
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className={`text-xs font-bold truncate ${isEditing ? 'text-accent' : 'text-primary'}`}>
                                                        {task.title}
                                                    </span>
                                                    {isEditing && (
                                                        <span className="text-nano px-1.5 py-0.5 bg-accent/20 text-accent rounded-sm font-black uppercase">
                                                            수정중
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1.5 text-micro text-primary-700">
                                                    <span className="text-accent font-bold">{formatTaskDate(task.startOffset)}</span>
                                                    <span>• {task.duration}일</span>
                                                    {task.assigneeName && (
                                                        <span className="text-emerald-600 font-medium">@{task.assigneeName}</span>
                                                    )}
                                                    {dependencyNames.length > 0 && (
                                                        <span className="text-blue-600 font-medium">← {dependencyNames.join(', ')}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                                                    className="p-1 rounded-sm hover:bg-blue-100 text-primary-700 hover:text-blue-600 transition-all"
                                                    title="수정"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleRemoveTask(task.id, e)}
                                                    className="p-1 rounded-sm hover:bg-red-100 text-primary-700 hover:text-red-600 transition-all"
                                                    title="삭제"
                                                >
                                                    <X size={12} />
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
                <div className="flex gap-3 justify-end pt-4 border-t-2 border-gray-300 mt-4">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2.5 rounded-sm border-2 border-gray-300 text-primary-700 font-bold hover:bg-gray-100 hover:border-gray-400 transition-all text-sm shadow-sm"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSaveTemplate}
                        className="px-8 py-2.5 rounded-sm bg-primary hover:bg-primary/90 text-white font-black flex items-center gap-2 shadow-lg shadow-[#081429]/30 transition-all text-sm border-2 border-accent"
                    >
                        <Save size={15} />
                        {initialData ? '수정 완료' : '프로젝트 생성'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GanttBuilder;
