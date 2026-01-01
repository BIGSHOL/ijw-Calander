import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GanttSubTask, GanttTemplate, UserProfile } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import GanttBuilder from './GanttBuilder';
import GanttChart from './GanttChart';
import GanttTaskList from './GanttTaskList';
import GanttProgressBar from './GanttProgressBar';
import GanttTemplateSelector from './GanttTemplateSelector';

interface GanttManagerProps {
    userProfile: UserProfile | null;
}

const GanttManager: React.FC<GanttManagerProps> = ({ userProfile }) => {
    const { hasPermission } = usePermissions(userProfile);

    const [viewMode, setViewMode] = useState<'home' | 'create' | 'edit' | 'execute'>('home');
    const [templates, setTemplates] = useState<GanttTemplate[]>([]);
    const [activeTasks, setActiveTasks] = useState<GanttSubTask[]>([]);
    const [activeProjectTitle, setActiveProjectTitle] = useState<string>('');
    const [editingTemplate, setEditingTemplate] = useState<GanttTemplate | null>(null);

    // Permission checks
    const canView = hasPermission('gantt.view');
    const canCreate = hasPermission('gantt.create');
    const canEdit = hasPermission('gantt.edit');
    const canDelete = hasPermission('gantt.delete');

    // Load templates from localStorage (will be replaced with Firestore later)
    useEffect(() => {
        const savedTemplates = localStorage.getItem('custom-gantt-templates');
        if (savedTemplates) {
            try {
                setTemplates(JSON.parse(savedTemplates));
            } catch (e) {
                console.error("Failed to parse templates", e);
            }
        }
    }, []);

    const saveNewTemplate = (newTemplate: GanttTemplate) => {
        const templateWithAuthor = {
            ...newTemplate,
            createdBy: userProfile?.uid,
            createdByEmail: userProfile?.email,
        };
        const updatedTemplates = [templateWithAuthor, ...templates];
        setTemplates(updatedTemplates);
        localStorage.setItem('custom-gantt-templates', JSON.stringify(updatedTemplates));
        setViewMode('home');
    };

    const updateTemplate = (updatedTemplate: GanttTemplate) => {
        const updatedTemplates = templates.map(t =>
            t.id === updatedTemplate.id ? updatedTemplate : t
        );
        setTemplates(updatedTemplates);
        localStorage.setItem('custom-gantt-templates', JSON.stringify(updatedTemplates));
        setEditingTemplate(null);
        setViewMode('home');
    };

    const deleteTemplate = (templateId: string) => {
        if (window.confirm("정말로 이 프로젝트를 삭제하시겠습니까?")) {
            const updatedTemplates = templates.filter(t => t.id !== templateId);
            setTemplates(updatedTemplates);
            localStorage.setItem('custom-gantt-templates', JSON.stringify(updatedTemplates));
        }
    };

    const handleEditStart = (template: GanttTemplate) => {
        setEditingTemplate(template);
        setViewMode('edit');
    };

    const selectTemplate = (template: GanttTemplate) => {
        const freshTasks = template.tasks.map(t => ({ ...t, completed: false }));
        setActiveTasks(freshTasks);
        setActiveProjectTitle(template.title);
        setViewMode('execute');
    };

    const handleToggleTask = useCallback((taskId: string) => {
        setActiveTasks(prevTasks =>
            prevTasks.map(task =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
            )
        );
    }, []);

    const progress = useMemo(() => {
        if (activeTasks.length === 0) return 0;
        const completedCount = activeTasks.filter(t => t.completed).length;
        return (completedCount / activeTasks.length) * 100;
    }, [activeTasks]);

    const handleGoHome = () => {
        if (viewMode === 'execute' && activeTasks.some(t => t.completed)) {
            if (!window.confirm("현재 진행 상황이 초기화됩니다. 홈으로 돌아가시겠습니까?")) {
                return;
            }
        }
        setViewMode('home');
        setActiveTasks([]);
        setActiveProjectTitle('');
        setEditingTemplate(null);
    };

    // No permission
    if (!canView) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-xl font-bold text-[#081429] mb-2">접근 권한 없음</h2>
                    <p className="text-gray-500">간트 차트 기능에 접근할 권한이 없습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">

            {/* Home View: Template Selector */}
            {viewMode === 'home' && (
                <GanttTemplateSelector
                    templates={templates}
                    onSelect={selectTemplate}
                    onCreateNew={() => setViewMode('create')}
                    onDelete={deleteTemplate}
                    onEdit={handleEditStart}
                    canCreate={canCreate}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />
            )}

            {/* Create View: Gantt Builder */}
            {viewMode === 'create' && canCreate && (
                <GanttBuilder
                    onSave={saveNewTemplate}
                    onCancel={() => setViewMode('home')}
                />
            )}

            {/* Edit View: Gantt Builder with Initial Data */}
            {viewMode === 'edit' && editingTemplate && canEdit && (
                <GanttBuilder
                    initialData={editingTemplate}
                    onSave={updateTemplate}
                    onCancel={() => {
                        setEditingTemplate(null);
                        setViewMode('home');
                    }}
                />
            )}

            {/* Execute View: Running the Project */}
            {viewMode === 'execute' && (
                <div className="animate-fade-in-up">
                    <div
                        className="flex items-center gap-2 mb-6 text-[#373d41] text-sm cursor-pointer hover:text-[#081429] w-fit"
                        onClick={handleGoHome}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                        </svg>
                        목록으로 돌아가기
                    </div>

                    <h2 className="text-3xl font-bold text-[#081429] mb-6">{activeProjectTitle}</h2>

                    <GanttProgressBar progress={progress} />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="h-full">
                            <GanttTaskList tasks={activeTasks} onToggleTask={handleToggleTask} />
                        </div>
                        <div className="h-full">
                            <GanttChart tasks={activeTasks} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GanttManager;
