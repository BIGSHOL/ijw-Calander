import React, { useState, useCallback, useMemo } from 'react';
import { GanttSubTask, GanttTemplate, UserProfile } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useGanttTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '../../hooks/useGanttTemplates';
import GanttBuilder from './GanttBuilder';
import GanttChart from './GanttChart';
import GanttTaskList from './GanttTaskList';
import GanttProgressBar from './GanttProgressBar';
import GanttTemplateSelector from './GanttTemplateSelector';
import TabSubNavigation from '../Common/TabSubNavigation';
import { FolderKanban, Plus, Edit2, Trash2, BookmarkPlus, BarChart3, Settings } from 'lucide-react';
import GanttSettingsModal from './GanttSettingsModal';

interface GanttManagerProps {
    userProfile: UserProfile | null;
    allUsers: UserProfile[];
}

const GanttManager: React.FC<GanttManagerProps> = ({ userProfile, allUsers }) => {
    const { hasPermission } = usePermissions(userProfile);

    const [viewMode, setViewMode] = useState<'home' | 'create' | 'edit' | 'execute'>('home');
    const [activeTasks, setActiveTasks] = useState<GanttSubTask[]>([]);
    const [activeProjectTitle, setActiveProjectTitle] = useState<string>('');
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
    const [activeStartDate, setActiveStartDate] = useState<string | undefined>(undefined);
    const [editingTemplate, setEditingTemplate] = useState<GanttTemplate | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Permission checks
    const canView = hasPermission('gantt.view');
    const canCreate = hasPermission('gantt.create');
    const canEdit = hasPermission('gantt.edit');
    const canDelete = hasPermission('gantt.delete');

    // Firestore hooks
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
                const freshTasks = updatedTemplate.tasks.map(t => ({ ...t }));
                setActiveTasks(freshTasks);
                setActiveProjectTitle(updatedTemplate.title);
                setActiveTemplateId(updatedTemplate.id);
                setActiveStartDate(updatedTemplate.startDate);

                setEditingTemplate(null);
                setViewMode('execute');
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
        setActiveTasks(prevTasks => {
            const newTasks = prevTasks.map(t =>
                t.id === taskId ? { ...t, completed: !t.completed } : t
            );

            // P1: 진행률을 Firestore에 저장
            if (activeTemplateId) {
                updateTemplate.mutate({
                    id: activeTemplateId,
                    updates: { tasks: newTasks }
                }, {
                    onError: (error) => {
                        console.error("진행률 저장 실패:", error);
                    }
                });
            }

            return newTasks;
        });
    }, [activeTemplateId, updateTemplate]);

    const handleSaveAsTemplate = () => {
        if (!activeTemplateId) return;
        const currentTemplate = templates.find(t => t.id === activeTemplateId);
        if (!currentTemplate) return;

        const templateName = prompt("새 템플릿의 이름을 입력하세요:", `${currentTemplate.title} (템플릿)`);
        if (!templateName) return;

        // id를 제외한 새 템플릿 객체 생성 (Omit 패턴 사용)
        const { id: _excludedId, ...templateWithoutId } = currentTemplate;
        const newTemplate: Omit<GanttTemplate, 'id'> & { id?: string } = {
            ...templateWithoutId,
            title: templateName,
            isTemplate: true,
            createdAt: Date.now(),
            startDate: undefined,
            createdBy: userProfile?.uid,
            createdByEmail: userProfile?.email,
        };

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
                    <h2 className="text-xl font-bold text-primary mb-2">접근 권한 없음</h2>
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
                    <div className="mb-4">
                        <BarChart3 className="w-16 h-16 mx-auto text-gray-300" />
                    </div>
                    <p className="text-gray-500">템플릿을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* REFACTORED: Top Sub-Navigation (통일된 디자인) */}
            <TabSubNavigation>
                {/* Project Selector Dropdown */}
                <div className="relative">
                    <select
                        value={activeTemplateId || ''}
                        onChange={(e) => {
                            const template = templates.find(t => t.id === e.target.value);
                            if (template) selectTemplate(template);
                        }}
                        className="appearance-none bg-[#1e293b] border border-gray-700 rounded-sm px-3 py-1.5 pr-8 text-xs font-medium text-white cursor-pointer hover:border-gray-500 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    >
                        <option value="">프로젝트 선택</option>
                        {projects.length > 0 && (
                            <optgroup label="프로젝트">
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </optgroup>
                        )}
                        {savedTemplates.length > 0 && (
                            <optgroup label="템플릿">
                                {savedTemplates.map(t => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                    <svg className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-white/20"></div>

                {/* Active Project Info */}
                {activeProjectTitle && (
                    <>
                        <div className="flex items-center gap-2 text-white">
                            <FolderKanban size={14} />
                            <span className="font-bold">{activeProjectTitle}</span>
                        </div>
                        <div className="w-px h-4 bg-white/20"></div>
                    </>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 ml-auto">
                    {/* Edit Button (only if viewing a project) */}
                    {canEdit && activeTemplateId && viewMode === 'execute' && (
                        <button
                            onClick={() => {
                                const template = templates.find(t => t.id === activeTemplateId);
                                if (template) handleEditStart(template);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-sm text-xs font-bold hover:bg-blue-700 transition-colors"
                            title="프로젝트 수정"
                        >
                            <Edit2 size={12} />
                            수정
                        </button>
                    )}

                    {/* Delete Button */}
                    {canDelete && activeTemplateId && viewMode === 'execute' && (
                        <button
                            onClick={() => handleDeleteTemplate(activeTemplateId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/90 text-white rounded-sm text-xs font-bold hover:bg-red-700 transition-colors"
                            title="프로젝트 삭제"
                        >
                            <Trash2 size={12} />
                            삭제
                        </button>
                    )}

                    {/* Save as Template Button */}
                    {viewMode === 'execute' && activeTemplateId && (
                        <button
                            onClick={handleSaveAsTemplate}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-sm text-xs font-bold hover:bg-purple-700 transition-colors"
                            title="템플릿으로 저장"
                        >
                            <BookmarkPlus size={12} />
                            템플릿 저장
                        </button>
                    )}

                    {/* New Project Button */}
                    {canCreate && (
                        <button
                            onClick={() => setViewMode('create')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-primary rounded-sm text-xs font-bold hover:bg-accent/90 transition-colors shadow-sm"
                        >
                            <Plus size={14} />
                            새 프로젝트
                        </button>
                    )}

                    {/* Settings Button */}
                    {(userProfile?.role === 'master' || userProfile?.role === 'admin' || hasPermission('gantt.edit')) && (
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
                            title="간트 차트 설정"
                        >
                            <Settings size={16} />
                        </button>
                    )}
                </div>
            </TabSubNavigation>

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
                    <GanttBuilder
                        initialData={editingTemplate}
                        onSave={handleUpdateTemplate}
                        onCancel={() => {
                            setEditingTemplate(null);
                            setViewMode('home');
                        }}
                        allUsers={allUsers}
                        currentUser={userProfile}
                    />
                ) : activeTasks.length > 0 ? (
                    <GanttChart
                        tasks={activeTasks}
                        title={activeProjectTitle}
                        startDate={activeStartDate}
                        onSaveAsTemplate={handleSaveAsTemplate}
                        currentUser={userProfile}
                    />
                ) : (
                    // Empty State
                    <div className="h-full flex flex-col items-center justify-center text-center p-12">
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-purple-50 rounded-sm flex items-center justify-center mb-6 shadow-lg">
                            <FolderKanban size={48} className="text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">프로젝트를 선택하세요</h2>
                        <p className="text-gray-500 max-w-md">
                            상단 드롭다운에서 프로젝트를 선택하거나<br />
                            우측 상단의 <span className="font-semibold text-accent">+ 새 프로젝트</span> 버튼으로 시작하세요.
                        </p>
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            <GanttSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                currentUser={userProfile}
            />
        </div>
    );
};

export default GanttManager;
