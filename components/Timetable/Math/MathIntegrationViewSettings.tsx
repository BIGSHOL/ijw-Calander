import React, { useState, useMemo } from 'react';
import { MathIntegrationSettings, MathCustomGroup, MathDisplayOptions } from './hooks/useMathSettings';
import { Teacher } from '../../../types';

export interface MathClassEntry {
    classId: string;
    className: string;
}

interface MathIntegrationViewSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    settings: MathIntegrationSettings;
    onChange: (nextSettings: MathIntegrationSettings) => void;
    allClasses: MathClassEntry[];
    teachers?: string[];
    teachersData?: Teacher[];
}

const MathIntegrationViewSettings: React.FC<MathIntegrationViewSettingsProps> = ({
    isOpen,
    onClose,
    settings,
    onChange,
    allClasses,
    teachers = [],
    teachersData = [],
}) => {
    const safeSettings = settings || ({} as MathIntegrationSettings);
    const viewMode = safeSettings.viewMode || "START_PERIOD";
    const showOthersGroup = typeof safeSettings.showOthersGroup === "boolean" ? safeSettings.showOthersGroup : true;
    const othersGroupTitle = safeSettings.othersGroupTitle || "기타 수업";

    // Ensure customGroups is stable
    const customGroups = useMemo(() => {
        return safeSettings.customGroups || [];
    }, [safeSettings.customGroups]);

    // Map classId -> group ID
    const classToGroupId = useMemo(() => {
        const map: Record<string, string> = {};
        customGroups.forEach((g) => {
            (g.classes || []).forEach((classRef) => {
                map[classRef] = g.id;
            });
        });
        return map;
    }, [customGroups]);

    const handleViewModeChange = (nextMode: 'START_PERIOD' | 'CUSTOM_GROUP') => {
        const next = {
            ...safeSettings,
            viewMode: nextMode,
        };
        onChange(next as MathIntegrationSettings);
    };

    const handleToggleShowOthers = () => {
        const next = {
            ...safeSettings,
            showOthersGroup: !showOthersGroup,
        };
        onChange(next as MathIntegrationSettings);
    };

    const handleOthersTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = {
            ...safeSettings,
            othersGroupTitle: e.target.value,
        };
        onChange(next as MathIntegrationSettings);
    };

    const handleAddGroup = () => {
        const newId = `group_${Date.now()}`;
        const nextGroups = [
            ...customGroups,
            {
                id: newId,
                title: `새 그룹`,
                classes: [],
            },
        ];
        const next = {
            ...safeSettings,
            viewMode: "CUSTOM_GROUP",
            customGroups: nextGroups,
        } as MathIntegrationSettings;
        onChange(next);
    };

    const handleRemoveGroup = (groupId: string) => {
        const nextGroups = customGroups.filter((g) => g.id !== groupId);
        const next = {
            ...safeSettings,
            customGroups: nextGroups,
        };
        onChange(next as MathIntegrationSettings);
    };

    const handleGroupTitleChange = (groupId: string, title: string) => {
        const nextGroups = customGroups.map((g) =>
            g.id === groupId ? { ...g, title } : g
        );
        const next = {
            ...safeSettings,
            customGroups: nextGroups,
        };
        onChange(next as MathIntegrationSettings);
    };

    const handleToggleClassInGroup = (groupId: string, classId: string, checked: boolean) => {
        // Remove from all groups first (one class -> one group rule)
        let nextGroups = customGroups.map((g) => ({
            ...g,
            classes: (g.classes || []).filter((c) => c !== classId),
        }));

        if (checked) {
            nextGroups = nextGroups.map((g) =>
                g.id === groupId ? { ...g, classes: [...g.classes, classId] } : g
            );
        }

        const next = {
            ...safeSettings,
            customGroups: nextGroups,
        };
        onChange(next as MathIntegrationSettings);
    };

    const handleMoveGroup = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === customGroups.length - 1) return;

        const newGroups = [...customGroups];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap
        [newGroups[index], newGroups[targetIndex]] = [newGroups[targetIndex], newGroups[index]];

        const next = {
            ...safeSettings,
            customGroups: newGroups,
        };
        onChange(next as MathIntegrationSettings);
    };

    const handleMoveClassInGroup = (groupId: string, classIndex: number, direction: 'up' | 'down') => {
        const nextGroups = customGroups.map((g) => {
            if (g.id !== groupId) return g;

            const newClasses = [...(g.classes || [])];
            if (direction === 'up') {
                if (classIndex === 0) return g;
                [newClasses[classIndex - 1], newClasses[classIndex]] = [newClasses[classIndex], newClasses[classIndex - 1]];
            } else {
                if (classIndex === newClasses.length - 1) return g;
                [newClasses[classIndex], newClasses[classIndex + 1]] = [newClasses[classIndex + 1], newClasses[classIndex]];
            }
            return { ...g, classes: newClasses };
        });

        const next = { ...safeSettings, customGroups: nextGroups };
        onChange(next as MathIntegrationSettings);
    };

    const handleToggleHiddenTeacher = (teacher: string) => {
        const currentHidden = safeSettings.hiddenTeachers || [];
        const isHidden = currentHidden.includes(teacher);
        const newHidden = isHidden
            ? currentHidden.filter(t => t !== teacher)
            : [...currentHidden, teacher];

        onChange({
            ...safeSettings,
            hiddenTeachers: newHidden
        });
    };

    // Helper to get teacher color
    const getTeacherColor = (teacher: string): { bg: string; text: string } => {
        const teacherData = teachersData.find(t => t.name === teacher);
        if (teacherData?.color) {
            return { bg: teacherData.color, text: '#fff' };
        }
        // Default color
        return { bg: '#e5e7eb', text: '#374151' };
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/20" onClick={onClose} />

            {/* Right Panel */}
            <div
                className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-xl border-l border-gray-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">
                            수학 통합 시간표 뷰 설정
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs text-gray-500 hover:text-gray-700"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 space-y-4 text-xs text-gray-800">
                    {/* 1. View Mode */}
                    <section className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="font-bold text-gray-700 mb-1">뷰 모드</div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="viewMode"
                                value="START_PERIOD"
                                checked={viewMode === "START_PERIOD"}
                                onChange={() => handleViewModeChange("START_PERIOD")}
                            />
                            <span>시작 교시 기준 (기존 방식)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="viewMode"
                                value="CUSTOM_GROUP"
                                checked={viewMode === "CUSTOM_GROUP"}
                                onChange={() => handleViewModeChange("CUSTOM_GROUP")}
                            />
                            <span>커스텀 그룹 기준 (내가 행 구성)</span>
                        </label>
                    </section>

                    {/* 2. Custom Group Settings */}
                    <section className="border border-gray-200 rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-700">커스텀 그룹 구성</span>
                            <button
                                type="button"
                                onClick={handleAddGroup}
                                className="px-2 py-1 rounded border border-indigo-900 text-indigo-900 text-xs hover:bg-gray-50"
                            >
                                + 그룹 추가
                            </button>
                        </div>

                        {customGroups.length === 0 && (
                            <div className="text-xs text-gray-400">
                                아직 그룹이 없습니다. "그룹 추가" 버튼을 눌러 새 그룹을 만들어보세요.
                            </div>
                        )}

                        {customGroups.map((group, index) => (
                            <MathGroupCard
                                key={group.id}
                                group={group}
                                allClasses={allClasses}
                                classToGroupId={classToGroupId}
                                onTitleChange={(title) => handleGroupTitleChange(group.id, title)}
                                onToggleClass={(classId, checked) => handleToggleClassInGroup(group.id, classId, checked)}
                                onDelete={() => handleRemoveGroup(group.id)}
                                isFirst={index === 0}
                                isLast={index === customGroups.length - 1}
                                onMoveUp={() => handleMoveGroup(index, 'up')}
                                onMoveDown={() => handleMoveGroup(index, 'down')}
                                onMoveClass={(clsIdx, dir) => handleMoveClassInGroup(group.id, clsIdx, dir)}
                            />
                        ))}
                    </section>

                    {/* 3. Others Group Options */}
                    <section className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showOthersGroup}
                                    onChange={handleToggleShowOthers}
                                />
                                <span className="font-bold text-gray-700">
                                    기타 그룹 자동 생성
                                </span>
                            </label>
                        </div>
                        {showOthersGroup && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">제목</span>
                                <input
                                    type="text"
                                    value={othersGroupTitle}
                                    onChange={handleOthersTitleChange}
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                />
                            </div>
                        )}
                        <div className="text-xs text-gray-400">
                            어떤 그룹에도 속하지 않은 수업은 "기타 그룹"에 자동으로 모아집니다.
                        </div>
                    </section>

                    {/* 4. Filter Hidden Teachers */}
                    <section className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-gray-700">강사 설정 (표시/숨김)</span>
                            <div className="text-xxs text-gray-400">
                                <span>숨김: {safeSettings.hiddenTeachers?.length || 0}</span>
                            </div>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center text-xxs font-bold text-gray-500 bg-gray-100 border-b border-gray-200 px-2 py-1.5">
                                <div className="flex-1">강사명</div>
                                <div className="w-16 text-center" title="시간표에서 숨깁니다">숨김</div>
                            </div>

                            {/* List */}
                            <div className="max-h-60 overflow-y-auto custom-scrollbar bg-white">
                                {teachers.map(teacher => {
                                    const isHidden = safeSettings.hiddenTeachers?.includes(teacher);
                                    const colors = getTeacherColor(teacher);

                                    return (
                                        <div key={teacher} className="flex items-center border-b border-gray-100 last:border-b-0 px-2 py-1.5 hover:bg-gray-50">
                                            {/* Name Badge */}
                                            <div className="flex-1 flex items-center">
                                                <div
                                                    className={`px-2 py-0.5 rounded text-xs font-bold border ${isHidden ? 'opacity-50 line-through' : ''}`}
                                                    style={{ backgroundColor: colors.bg, color: colors.text, borderColor: 'rgba(0,0,0,0.1)' }}
                                                >
                                                    {teacher}
                                                </div>
                                            </div>

                                            {/* Hidden Toggle */}
                                            <div className="w-16 flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isHidden || false}
                                                    onChange={() => handleToggleHiddenTeacher(teacher)}
                                                    className="rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
                                                    title="체크 시 시간표에서 숨김"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="text-xxs text-gray-400 mt-1">
                            • <b>숨김</b>: 해당 강사의 수업이 시간표 셀에서 보이지 않게 됩니다.
                        </div>
                    </section>
                </div>

                {/* Footer Buttons */}
                <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-100"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

// GroupCard 컴포넌트 (인재원 시간표 옵션 제외)
interface MathGroupCardProps {
    group: MathCustomGroup;
    allClasses: MathClassEntry[];
    classToGroupId: Record<string, string>;
    onTitleChange: (title: string) => void;
    onToggleClass: (classId: string, checked: boolean) => void;
    onDelete: () => void;
    isFirst: boolean;
    isLast: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onMoveClass: (classIndex: number, direction: 'up' | 'down') => void;
}

const MathGroupCard = React.memo<MathGroupCardProps>(({
    group,
    allClasses,
    classToGroupId,
    onTitleChange,
    onToggleClass,
    onDelete,
    isFirst,
    isLast,
    onMoveUp,
    onMoveDown,
    onMoveClass,
}) => {
    const [searchTerm, setSearchTerm] = useState("");

    // Local state for title to prevent IME issues and re-renders
    const [localTitle, setLocalTitle] = useState(group.title || "");

    // Sync local state when prop changes
    React.useEffect(() => {
        setLocalTitle(group.title || "");
    }, [group.title]);

    // classId → className 매핑
    const classIdToName = useMemo(() => {
        const map: Record<string, string> = {};
        allClasses.forEach(c => { map[c.classId] = c.className; });
        return map;
    }, [allClasses]);

    const filteredClasses = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return allClasses;
        return allClasses.filter((c) => c.className.toLowerCase().includes(term));
    }, [searchTerm, allClasses]);

    // group.classes에 저장된 classId 배열
    const checkedClassIds = group.classes || [];

    return (
        <div className="border border-gray-200 rounded-md p-2 space-y-2 bg-white">
            {/* Group Title + Delete Button */}
            <div className="flex items-center justify-between gap-2">
                <input
                    type="text"
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    onBlur={() => {
                        if (localTitle !== group.title) {
                            onTitleChange(localTitle);
                        }
                    }}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                    placeholder="그룹 제목"
                />
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={isFirst}
                        className={`p-1 rounded text-xs border ${isFirst ? 'text-gray-300 border-gray-200' : 'text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                        title="위로 이동"
                    >
                        ▲
                    </button>
                    <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={isLast}
                        className={`p-1 rounded text-xs border ${isLast ? 'text-gray-300 border-gray-200' : 'text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                        title="아래로 이동"
                    >
                        ▼
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="ml-1 text-xs text-red-500 hover:text-red-600 px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                    >
                        삭제
                    </button>
                </div>
            </div>

            {/* Selected Classes (Ordered List) */}
            <div className="space-y-1 bg-gray-50 p-2 rounded border border-gray-100">
                <div className="text-xxs text-gray-500 font-bold mb-1">
                    선택된 수업 (순서 변경 가능)
                </div>
                {checkedClassIds.length === 0 && (
                    <div className="text-xs text-gray-400 italic text-center py-2">
                        선택된 수업이 없습니다. 아래에서 검색하여 추가하세요.
                    </div>
                )}
                {checkedClassIds.map((classId, idx) => (
                    <div key={`${classId}-${idx}`} className="flex items-center justify-between text-xs bg-white px-2 py-1.5 rounded border border-gray-200 shadow-sm">
                        <span className="font-medium text-gray-700 truncate flex-1">{classIdToName[classId] || classId}</span>
                        <div className="flex items-center gap-1 ml-2">
                            <button
                                onClick={() => onMoveClass(idx, 'up')}
                                disabled={idx === 0}
                                className={`p-0.5 rounded ${idx === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                title="위로"
                            >
                                ▲
                            </button>
                            <button
                                onClick={() => onMoveClass(idx, 'down')}
                                disabled={idx === checkedClassIds.length - 1}
                                className={`p-0.5 rounded ${idx === checkedClassIds.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                title="아래로"
                            >
                                ▼
                            </button>
                            <button
                                onClick={() => onToggleClass(classId, false)}
                                className="ml-1 text-gray-400 hover:text-red-500 px-1"
                                title="제거"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Class Search & Add */}
            <div className="pt-2 border-t border-gray-100">
                <div className="text-xxs text-gray-500 font-bold mb-1 px-1">
                    수업 추가
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="수업 검색..."
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
            </div>

            {/* Class Checkbox List */}
            <div className="max-h-32 overflow-auto space-y-0.5 mt-1">
                {(() => {
                    const displayedClasses = filteredClasses.filter(c => !checkedClassIds.includes(c.classId));

                    if (displayedClasses.length === 0) {
                        return (
                            <div className="text-xs text-gray-400 px-1 py-1 italic">
                                {searchTerm ? "검색 결과가 없거나 이미 추가되었습니다." : "추가할 수업을 검색하세요."}
                            </div>
                        );
                    }

                    return displayedClasses.map((entry) => {
                        const assignedToOther = classToGroupId[entry.classId] && classToGroupId[entry.classId] !== group.id;

                        return (
                            <label
                                key={entry.classId}
                                className="flex items-center gap-2 cursor-pointer px-1 py-0.5 hover:bg-gray-50 rounded"
                            >
                                <input
                                    type="checkbox"
                                    checked={false}
                                    onChange={() =>
                                        onToggleClass(entry.classId, true)
                                    }
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                                />
                                <span
                                    className={`truncate text-xs ${assignedToOther
                                        ? "text-gray-400 line-through"
                                        : "text-gray-700"
                                        }`}
                                    title={entry.className}
                                >
                                    {entry.className}
                                </span>
                            </label>
                        );
                    });
                })()}
            </div>
        </div>
    );
});

export default MathIntegrationViewSettings;
