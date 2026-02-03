import React from 'react';
import { GanttTemplate } from '../../types';

interface GanttTemplateSelectorProps {
    templates: GanttTemplate[];
    onSelect: (template: GanttTemplate) => void;
    onCreateNew: () => void;
    onDelete: (id: string) => void;
    onEdit: (template: GanttTemplate) => void;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

const GanttTemplateSelector: React.FC<GanttTemplateSelectorProps> = ({
    templates,
    onSelect,
    onCreateNew,
    onDelete,
    onEdit,
    canCreate = true,
    canEdit = true,
    canDelete = true,
}) => {
    return (
        <div className="w-full animate-fade-in-up">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-[#081429]">프로젝트 선택</h2>
                    <p className="text-[#373d41] mt-1">실행할 프로젝트를 선택하거나 새로 만드세요.</p>
                </div>
                {canCreate && (
                    <button
                        onClick={onCreateNew}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-[#081429] text-[#081429] font-medium rounded-sm hover:bg-[#081429] hover:text-[#fdb813] transition shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        새 간트 생성
                    </button>
                )}
            </div>

            {templates.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-sm border border-dashed border-slate-300">
                    <div className="inline-block p-4 rounded-sm bg-slate-50 mb-4">
                        <svg className="w-8 h-8 text-[#373d41]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                    </div>
                    <h3 className="text-lg font-medium text-[#081429]">등록된 간트 차트가 없습니다</h3>
                    <p className="text-[#373d41] mt-1 mb-6">새 프로젝트를 등록해보세요.</p>
                    {canCreate && (
                        <button
                            onClick={onCreateNew}
                            className="px-6 py-3 bg-[#081429] text-gray-800 font-medium rounded-sm hover:bg-[#081429]/90 shadow-md transition"
                        >
                            새 프로젝트 만들기
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="group bg-white rounded-sm border border-slate-200 p-6 flex flex-col h-full relative hover:border-[#fdb813] hover:shadow-lg transition-all duration-300"
                        >
                            <div
                                className="cursor-pointer flex-1"
                                onClick={() => onSelect(template)}
                            >
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-[#081429] group-hover:text-[#081429] transition-colors pr-16">
                                        {template.title}
                                    </h3>
                                    {template.description && (
                                        <p className="text-sm text-[#373d41] mt-1 line-clamp-2">{template.description}</p>
                                    )}
                                </div>

                                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-[#373d41]/70">
                                    <span className="bg-slate-100 px-2 py-1 rounded">항목 {template.tasks.length}개</span>
                                    <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="absolute top-4 right-4 flex gap-1">
                                {canEdit && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(template);
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-[#081429] hover:bg-slate-100 rounded-sm transition-colors z-10"
                                        title="수정"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                    </button>
                                )}
                                {canDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(template.id);
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-sm transition-colors z-10"
                                        title="삭제"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GanttTemplateSelector;
