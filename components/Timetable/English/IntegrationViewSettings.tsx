import React, { useState, useMemo } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { initializeApp, deleteApp } from 'firebase/app';

import { getTeacherColor } from './englishUtils';
import { Teacher } from '../../../types';

export interface CustomGroup {
    id: string;
    title: string;
    classes: string[];
    useInjaePeriod?: boolean;  // 인재원 시간표 사용 여부 (55분 단위)
}

export interface IntegrationSettings {
    viewMode: 'START_PERIOD' | 'CUSTOM_GROUP';
    customGroups: CustomGroup[];
    showOthersGroup: boolean;
    othersGroupTitle: string;
    displayOptions?: DisplayOptions;
    hiddenTeachers?: string[]; // 시간표에서 숨김 (Grid Cell)
    hiddenLegendTeachers?: string[]; // 강사 목록에서 제외 (Top Legend)
}

export interface DisplayOptions {
    showStudents: boolean;
    showRoom: boolean;
    showTeacher: boolean;
    showSchedule: boolean;
}

export interface ClassEntry {
    classId: string;
    className: string;
}

interface IntegrationViewSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    settings: IntegrationSettings;
    onChange: (nextSettings: IntegrationSettings) => void;
    allClasses: ClassEntry[];
    teachers?: string[];
    teachersData?: Teacher[];
}

// Legacy Firebase project configuration (academy-app - injaewon-project-8ea38)
// Used for data migration/integration from old system
// Credentials now loaded from environment variables (.env.local)
const OLD_FIREBASE_CONFIG = {
    apiKey: import.meta.env.VITE_OLD_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_OLD_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_OLD_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_OLD_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_OLD_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_OLD_FIREBASE_APP_ID
};

const IntegrationViewSettings: React.FC<IntegrationViewSettingsProps> = ({
    isOpen,
    onClose,
    settings,
    onChange,
    allClasses,
    teachers = [],
    teachersData = [],
}) => {
    const safeSettings = settings || ({} as IntegrationSettings);
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
        onChange(next as IntegrationSettings);
    };

    const handleToggleShowOthers = () => {
        const next = {
            ...safeSettings,
            showOthersGroup: !showOthersGroup,
        };
        onChange(next as IntegrationSettings);
    };

    const handleOthersTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = {
            ...safeSettings,
            othersGroupTitle: e.target.value,
        };
        onChange(next as IntegrationSettings);
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
        } as IntegrationSettings; // Forced cast or validate
        onChange(next);
    };

    const handleRemoveGroup = (groupId: string) => {
        const nextGroups = customGroups.filter((g) => g.id !== groupId);
        const next = {
            ...safeSettings,
            customGroups: nextGroups,
        };
        onChange(next as IntegrationSettings);
    };

    const handleGroupTitleChange = (groupId: string, title: string) => {
        const nextGroups = customGroups.map((g) =>
            g.id === groupId ? { ...g, title } : g
        );
        const next = {
            ...safeSettings,
            customGroups: nextGroups,
        };
        onChange(next as IntegrationSettings);
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
        onChange(next as IntegrationSettings);
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
        onChange(next as IntegrationSettings);
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
        onChange(next as IntegrationSettings);
    };

    const handleToggleInjaePeriod = (groupId: string, checked: boolean) => {
        const nextGroups = customGroups.map((g) =>
            g.id === groupId ? { ...g, useInjaePeriod: checked } : g
        );
        const next = { ...safeSettings, customGroups: nextGroups };
        onChange(next as IntegrationSettings);
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

    const handleToggleLegendTeacher = (teacher: string) => {
        const currentHidden = safeSettings.hiddenLegendTeachers || [];
        const isHidden = currentHidden.includes(teacher);
        const newHidden = isHidden
            ? currentHidden.filter(t => t !== teacher)
            : [...currentHidden, teacher];

        onChange({
            ...safeSettings,
            hiddenLegendTeachers: newHidden
        });
    };

    // 구 프로젝트(injaewon-project-8ea38)에서 데이터 마이그레이션 (일회성 기능)
    // 참고: 구 프로젝트의 english_schedules 컬렉션에서 가져옴 (현재 프로젝트와 무관)
    const handleMigrateFromAcademy = async () => {
        if (!confirm('기존 Academy App (injaewon-project-8ea38)에서 데이터를 가져오시겠습니까?')) return;

        let secondaryApp;
        try {
            // 1. Initialize Secondary App
            secondaryApp = initializeApp(OLD_FIREBASE_CONFIG, "secondary");
            const oldDb = getFirestore(secondaryApp);

            // 2. Fetch General Settings (구 프로젝트의 레거시 경로)
            const settingsRef = doc(oldDb, 'english_schedules', 'integration_settings');
            const settingsSnap = await getDoc(settingsRef);
            let newSettings = { ...safeSettings };

            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                newSettings = {
                    ...newSettings,
                    viewMode: data.viewMode || newSettings.viewMode,
                    showOthersGroup: typeof data.showOthersGroup === 'boolean' ? data.showOthersGroup : newSettings.showOthersGroup,
                    othersGroupTitle: data.othersGroupTitle || newSettings.othersGroupTitle,
                };
            }

            // 3. Fetch Custom Groups
            const groupsRef = doc(oldDb, 'english_schedules', 'customGroups');
            const groupsSnap = await getDoc(groupsRef);

            if (groupsSnap.exists()) {
                const groupsData = groupsSnap.data();
                const groups = groupsData.customGroups || groupsData.groups || [];
                newSettings.customGroups = groups;
                console.log("Fetched groups:", groups);
            } else {
                console.warn("No customGroups document found in old DB");
            }

            // 4. Apply to Current DB (primary app)
            onChange(newSettings as IntegrationSettings);
            alert(`데이터 가져오기 성공! (${newSettings.customGroups.length}개 그룹)`);
        } catch (e) {
            console.error('Migration failed:', e);
            alert('데이터 가져오기 실패. 콘솔을 확인해주세요:\n' + e);
        } finally {
            if (secondaryApp) {
                await deleteApp(secondaryApp);
            }
        }
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
                            통합 시간표 뷰 설정
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            실험 기능
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
                            <GroupCard
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
                                onToggleInjaePeriod={(checked) => handleToggleInjaePeriod(group.id, checked)}
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
                            <div className="text-xxs text-gray-400 space-x-2">
                                <span>시간표 숨김: {safeSettings.hiddenTeachers?.length || 0}</span>
                                <span>목록 제외: {safeSettings.hiddenLegendTeachers?.length || 0}</span>
                            </div>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center text-xxs font-bold text-gray-500 bg-gray-100 border-b border-gray-200 px-2 py-1.5">
                                <div className="flex-1">강사명</div>
                                <div className="w-16 text-center" title="시간표 타임라인에서 숨깁니다">시간표 숨김</div>
                                <div className="w-16 text-center" title="상단 강사 목록(범례)에서 제외합니다">목록 제외</div>
                            </div>

                            {/* List */}
                            <div className="max-h-60 overflow-y-auto custom-scrollbar bg-white">
                                {teachers.map(teacher => {
                                    const isScheduleHidden = safeSettings.hiddenTeachers?.includes(teacher);
                                    const isLegendHidden = safeSettings.hiddenLegendTeachers?.includes(teacher);
                                    const colors = getTeacherColor(teacher, teachersData);

                                    return (
                                        <div key={teacher} className="flex items-center border-b border-gray-100 last:border-b-0 px-2 py-1.5 hover:bg-gray-50">
                                            {/* Name Badge */}
                                            <div className="flex-1 flex items-center">
                                                <div
                                                    className={`px-2 py-0.5 rounded text-xs font-bold border ${isScheduleHidden ? 'opacity-50 line-through' : ''}`}
                                                    style={{ backgroundColor: colors.bg, color: colors.text, borderColor: 'rgba(0,0,0,0.1)' }}
                                                >
                                                    {teacher}
                                                </div>
                                            </div>

                                            {/* Schedule Hidden Toggle */}
                                            <div className="w-16 flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isScheduleHidden || false}
                                                    onChange={() => handleToggleHiddenTeacher(teacher)}
                                                    className="rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
                                                    title="체크 시 시간표에서 숨김"
                                                />
                                            </div>

                                            {/* Legend Hidden Toggle */}
                                            <div className="w-16 flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isLegendHidden || false}
                                                    onChange={() => handleToggleLegendTeacher(teacher)}
                                                    className="rounded border-gray-300 text-gray-500 focus:ring-gray-500 cursor-pointer"
                                                    title="체크 시 강사 목록에서 제외"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="text-xxs text-gray-400 mt-1">
                            • <b>시간표 숨김</b>: 해당 강사의 수업이 시간표 셀에서 보이지 않게 됩니다.<br />
                            • <b>목록 제외</b>: 상단 '강사 목록' 범례에서 해당 이름이 빠집니다. (LAB 등)
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
            </div >
        </div >
    );
};

interface GroupCardProps {
    group: CustomGroup;
    allClasses: ClassEntry[];
    classToGroupId: Record<string, string>;
    onTitleChange: (title: string) => void;
    onToggleClass: (classId: string, checked: boolean) => void;
    onDelete: () => void;
    isFirst: boolean;
    isLast: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onMoveClass: (classIndex: number, direction: 'up' | 'down') => void;
    onToggleInjaePeriod: (checked: boolean) => void;
}

const GroupCard = React.memo<GroupCardProps>(({
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
    onToggleInjaePeriod,
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

            {/* Injae Period Toggle */}
            <label className="flex items-center gap-2 text-xs cursor-pointer px-1 py-1.5 bg-amber-50 rounded border border-amber-200">
                <input
                    type="checkbox"
                    checked={group.useInjaePeriod || false}
                    onChange={(e) => onToggleInjaePeriod(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-3 w-3"
                />
                <span className="text-amber-700 font-medium">인재원 시간표 사용 (55분 단위)</span>
            </label>

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

export default IntegrationViewSettings;
