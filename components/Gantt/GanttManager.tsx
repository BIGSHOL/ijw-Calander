import React, { useState, useCallback, useMemo } from 'react';
import { GanttSubTask, GanttTemplate, UserProfile } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useGanttTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '../../hooks/useGanttTemplates';
import GanttBuilder from './GanttBuilder';
import GanttChart from './GanttChart';
import GanttTaskList from './GanttTaskList';
import GanttProgressBar from './GanttProgressBar';
import GanttTemplateSelector from './GanttTemplateSelector';

interface GanttManagerProps {
    userProfile: UserProfile | null;
    allUsers: UserProfile[]; // Prop drilled to avoid duplicate fetching
}

const GanttManager: React.FC<GanttManagerProps> = ({ userProfile, allUsers }) => {
    const { hasPermission } = usePermissions(userProfile);

    const [viewMode, setViewMode] = useState<'home' | 'create' | 'edit' | 'execute'>('home');
    const [activeTasks, setActiveTasks] = useState<GanttSubTask[]>([]);
    const [activeProjectTitle, setActiveProjectTitle] = useState<string>('');
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
    const [activeStartDate, setActiveStartDate] = useState<string | undefined>(undefined);
    const [editingTemplate, setEditingTemplate] = useState<GanttTemplate | null>(null);

    // Permission checks
    const canView = hasPermission('gantt.view');
    const canCreate = hasPermission('gantt.create');
    const canEdit = hasPermission('gantt.edit');
    const canDelete = hasPermission('gantt.delete');

    // Firestore hooks (Phase 10: Pass userProfile for permission filtering)
    const { data: templates = [], isLoading } = useGanttTemplates({
        userId: userProfile?.uid,
        userProfile: userProfile
    });
    const createTemplate = useCreateTemplate();
    const updateTemplate = useUpdateTemplate();
    const deleteTemplate = useDeleteTemplate();

    const projects = useMemo(() => templates.filter(t => !t.isTemplate), [templates]);
    const savedTemplates = useMemo(() => templates.filter(t => t.isTemplate), [templates]);

    const saveNewTemplate = (newTemplate: GanttTemplate) => {
        if (!userProfile?.uid) {
            alert("로그인이 필요합니다.");
            return;
        }
        const templateWithAuthor = {
            ...newTemplate,
            createdBy: userProfile.uid,
            createdByEmail: userProfile.email || '',
        };
        createTemplate.mutate(templateWithAuthor, {
            onSuccess: () => {
                setViewMode('home');
            },
            onError: (error) => {
                console.error("Failed to create template:", error);
                alert("프로젝트 생성 중 오류가 발생했습니다.");
            }
        });
    };

    const handleUpdateTemplate = (updatedTemplate: GanttTemplate) => {
        updateTemplate.mutate({
            id: updatedTemplate.id,
            updates: updatedTemplate,
        }, {
            onSuccess: () => {
                // Refresh active tasks with the updated data
                const freshTasks = updatedTemplate.tasks.map(t => ({ ...t }));
                setActiveTasks(freshTasks);
                setActiveProjectTitle(updatedTemplate.title);
                setActiveTemplateId(updatedTemplate.id);
                setActiveStartDate(updatedTemplate.startDate);

                setEditingTemplate(null);
                setViewMode('execute'); // Go directly to view the updated project
            },
            onError: (error) => {
                console.error("Failed to update template:", error);
                alert("프로젝트 수정 중 오류가 발생했습니다.");
            }
        });
    };

    const handleDeleteTemplate = (templateId: string) => {
        if (window.confirm("정말로 이 템플릿을 삭제하시겠습니까?")) {
            deleteTemplate.mutate(templateId, {
                onSuccess: () => {
                    // If the deleted project is the one currently being viewed, go back to home
                    if (activeTemplateId === templateId) {
                        setViewMode('home');
                        setActiveTasks([]);
                        setActiveProjectTitle('');
                        setActiveTemplateId(null);
                        setActiveStartDate(undefined);
                    }
                }
            });
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
        setActiveTemplateId(template.id);
        setActiveStartDate(template.startDate);
        setViewMode('execute');
    };

    const handleToggleTask = useCallback((taskId: string) => {
        setActiveTasks(prevTasks =>
            prevTasks.map(t =>
                t.id === taskId ? { ...t, completed: !t.completed } : t
            )
        );
    }, []);

    const handleSaveAsTemplate = () => {
        if (!activeTemplateId) return;
        const currentTemplate = templates.find(t => t.id === activeTemplateId);
        if (!currentTemplate) return;

        const templateName = prompt("새 템플릿의 이름을 입력하세요:", `${currentTemplate.title} (템플릿)`);
        if (!templateName) return;

        const newTemplate: GanttTemplate = {
            ...currentTemplate,
            // id will be generated by Firestore
            title: templateName,
            isTemplate: true,
            createdAt: Date.now(),
            startDate: undefined,
            createdBy: userProfile?.uid,
            createdByEmail: userProfile?.email,
        };

        // Remove ID to let Firestore generate one
        // @ts-ignore
        delete newTemplate.id;

        createTemplate.mutate(newTemplate, {
            onSuccess: () => {
                alert("템플릿이 성공적으로 저장되었습니다.");
            },
            onError: (err) => {
                console.error(err);
                alert("템플릿 저장 실패");
            }
        });
    };


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

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <div className="text-4xl mb-4">📊</div>
                    <p className="text-gray-500">템플릿을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-gray-50 overflow-hidden font-sans text-gray-600">
            {/* Left Sidebar - Firebase Style */}
            {/* Icon Navigation Strip */}
            <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-4 shrink-0">
                {/* Logo */}
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>

                {/* Icon Buttons */}
                <div className="flex flex-col gap-2">
                    <button className="w-9 h-9 rounded-lg bg-blue-50/50 text-blue-500 flex items-center justify-center" title="프로젝트">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </button>
                    <button className="w-9 h-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-800 flex items-center justify-center transition-colors" title="알림">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </button>
                    <button className="w-9 h-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-800 flex items-center justify-center transition-colors" title="검색">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </button>
                </div>

                {/* Bottom Icons */}
                <div className="mt-auto flex flex-col gap-2">
                    <button className="w-9 h-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-800 flex items-center justify-center transition-colors" title="설정">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                </div>
            </div>

            {/* Main Sidebar Panel */}
            <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800">간트 차트</h2>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-gray-200">
                    {/* 프로젝트 바로가기 Section */}
                    <div className="px-3 mb-6">
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
                            프로젝트 바로가기
                        </div>
                        <div className="space-y-1">

                            {projects.map(tmpl => (
                                <div
                                    key={tmpl.id}
                                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${activeProjectTitle === tmpl.title
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <div
                                        className="flex items-center gap-2 flex-1 min-w-0"
                                        onClick={() => selectTemplate(tmpl)}
                                    >
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                        </svg>
                                        <span className="text-sm font-medium truncate">{tmpl.title}</span>
                                    </div>

                                    {/* Edit/Delete Buttons */}
                                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                                        {canEdit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEditStart(tmpl); }}
                                                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-blue-400 transition-colors"
                                                title="수정"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id); }}
                                                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                                                title="삭제"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                        </div>
                    </div>

                    {/* 템플릿 라이브러리 Section */}
                    {savedTemplates.length > 0 && (
                        <div className="px-3 mb-6">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V5a2 2 0 012-2h4.586" />
                                </svg>
                                템플릿 라이브러리
                            </div>
                            <div className="space-y-1">
                                {savedTemplates.map(tmpl => (
                                    <div
                                        key={tmpl.id}
                                        className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${activeProjectTitle === tmpl.title
                                            ? 'bg-purple-500/20 text-purple-400'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        <div
                                            className="flex items-center gap-2 flex-1 min-w-0"
                                            onClick={() => selectTemplate(tmpl)}
                                        >
                                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                            </svg>
                                            <span className="text-sm font-medium truncate">{tmpl.title}</span>
                                        </div>

                                        {/* Edit/Delete Buttons */}
                                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                                            {canEdit && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEditStart(tmpl); }}
                                                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-blue-400 transition-colors"
                                                    title="수정"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id); }}
                                                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                                                    title="삭제"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* 프로젝트 관리 Section */}
                    <div className="px-3 mb-6">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">
                            프로젝트 관리
                        </div>
                        <div className="space-y-1">
                            {canCreate && (
                                <button
                                    onClick={() => setViewMode('create')}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    <span className="text-sm font-medium">새 프로젝트</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-gray-50 relative overflow-hidden">
                {viewMode === 'create' && canCreate ? (
                    <GanttBuilder
                        onSave={saveNewTemplate}
                        onCancel={() => setViewMode('home')}
                        allUsers={allUsers}
                        currentUser={userProfile}
                        templates={savedTemplates}
                    />
                ) : viewMode === 'edit' && editingTemplate ? (
                    <GanttBuilder initialData={editingTemplate} onSave={handleUpdateTemplate} onCancel={() => { setEditingTemplate(null); setViewMode('home'); }} allUsers={allUsers} currentUser={userProfile} />
                ) : activeTasks.length > 0 ? (
                    <GanttChart
                        tasks={activeTasks}
                        title={activeProjectTitle}
                        startDate={activeStartDate}
                        onSaveAsTemplate={handleSaveAsTemplate}
                    />
                ) : (
                    // Empty State or Welcome
                    <div className="h-full flex flex-col items-center justify-center text-center p-12">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-gray-200">
                            <span className="text-4xl">🚀</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">프로젝트를 선택하세요</h2>
                        <p className="text-gray-500 max-w-md">사이드바에서 프로젝트를 선택하면 타임라인이 표시됩니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GanttManager;
