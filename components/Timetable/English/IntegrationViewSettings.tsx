import React, { useState, useMemo } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { initializeApp, deleteApp } from 'firebase/app';

export interface CustomGroup {
    id: string;
    title: string;
    classes: string[];
}

export interface IntegrationSettings {
    viewMode: 'START_PERIOD' | 'CUSTOM_GROUP';
    customGroups: CustomGroup[];
    showOthersGroup: boolean;
    othersGroupTitle: string;
    // ... potentially other settings like teacherColors
}

interface IntegrationViewSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    settings: IntegrationSettings;
    onChange: (nextSettings: IntegrationSettings) => void;
    allClasses: String[]; // List of all class names
}

// Config from academy-app (injaewon-project-8ea38)
const OLD_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAAdN14OfxYgkDv8svA8mPxp9W_zupRRkU",
    authDomain: "injaewon-project-8ea38.firebaseapp.com",
    projectId: "injaewon-project-8ea38",
    storageBucket: "injaewon-project-8ea38.firebasestorage.app",
    messagingSenderId: "519647947511",
    appId: "1:519647947511:web:1e0ee3660bf0bc83d3c1f2"
};

const IntegrationViewSettings: React.FC<IntegrationViewSettingsProps> = ({
    isOpen,
    onClose,
    settings,
    onChange,
    allClasses,
}) => {
    const safeSettings = settings || {};
    const viewMode = safeSettings.viewMode || "START_PERIOD";
    const showOthersGroup = typeof safeSettings.showOthersGroup === "boolean" ? safeSettings.showOthersGroup : true;
    const othersGroupTitle = safeSettings.othersGroupTitle || "기타 수업";

    // Ensure customGroups is stable
    const customGroups = useMemo(() => {
        return safeSettings.customGroups || [];
    }, [safeSettings.customGroups]);

    // Map class -> group ID
    const classToGroupId = useMemo(() => {
        const map: Record<string, string> = {};
        customGroups.forEach((g) => {
            (g.classes || []).forEach((c) => {
                map[c] = g.id;
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

    const handleToggleClassInGroup = (groupId: string, className: string, checked: boolean) => {
        // Remove from all groups first (one class -> one group rule)
        let nextGroups = customGroups.map((g) => ({
            ...g,
            classes: (g.classes || []).filter((c) => c !== className),
        }));

        if (checked) {
            nextGroups = nextGroups.map((g) =>
                g.id === groupId ? { ...g, classes: [...g.classes, className] } : g
            );
        }

        const next = {
            ...safeSettings,
            customGroups: nextGroups,
        };
        onChange(next as IntegrationSettings);
    };

    const handleMigrateFromAcademy = async () => {
        if (!confirm('기존 Academy App (injaewon-project-8ea38)에서 데이터를 가져오시겠습니까?')) return;

        let secondaryApp;
        try {
            // 1. Initialize Secondary App
            secondaryApp = initializeApp(OLD_FIREBASE_CONFIG, "secondary");
            const oldDb = getFirestore(secondaryApp);

            // 2. Fetch General Settings
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
        <div className="absolute inset-0 z-50">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/20" onClick={onClose} />

            {/* Right Panel */}
            <div className="absolute top-0 right-0 h-full w-[420px] bg-white shadow-xl border-l border-gray-200 flex flex-col">
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

                        {customGroups.map((group) => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                allClasses={allClasses}
                                classToGroupId={classToGroupId}
                                onTitleChange={(title) => handleGroupTitleChange(group.id, title)}
                                onToggleClass={(className, checked) => handleToggleClassInGroup(group.id, className, checked)}
                                onDelete={() => handleRemoveGroup(group.id)}
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
                        <div className="text-[11px] text-gray-400">
                            어떤 그룹에도 속하지 않은 수업은 "기타 그룹"에 자동으로 모아집니다.
                        </div>
                    </section>
                </div>

                {/* Footer Buttons */}
                <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex justify-between">
                    <button
                        type="button"
                        onClick={handleMigrateFromAcademy}
                        className="px-3 py-1.5 text-xs rounded border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100"
                    >
                        📤 기존 데이터 가져오기
                    </button>
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

interface GroupCardProps {
    group: CustomGroup;
    allClasses: String[];
    classToGroupId: Record<string, string>;
    onTitleChange: (title: string) => void;
    onToggleClass: (className: string, checked: boolean) => void;
    onDelete: () => void;
}

const GroupCard = React.memo<GroupCardProps>(({
    group,
    allClasses,
    classToGroupId,
    onTitleChange,
    onToggleClass,
    onDelete,
}) => {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredClasses = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return allClasses;
        return allClasses.filter((c) => c.toString().toLowerCase().includes(term));
    }, [searchTerm, allClasses]);

    const checkedClasses = group.classes || [];

    return (
        <div className="border border-gray-200 rounded-md p-2 space-y-2 bg-white">
            {/* Group Title + Delete Button */}
            <div className="flex items-center justify-between gap-2">
                <input
                    type="text"
                    value={group.title || ""}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                    placeholder="그룹 제목"
                />
                <button
                    type="button"
                    onClick={onDelete}
                    className="text-xs text-red-500 hover:text-red-600"
                >
                    삭제
                </button>
            </div>

            {/* Class Search */}
            <div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="수업 검색..."
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 focus:bg-white"
                />
            </div>

            {/* Class Checkbox List */}
            <div className="max-h-40 overflow-auto border-t border-gray-100 pt-2 space-y-1">
                {filteredClasses.length === 0 ? (
                    <div className="text-xs text-gray-400 px-1 py-1">
                        검색 결과가 없습니다.
                    </div>
                ) : (
                    filteredClasses.map((className) => {
                        const strClass = className.toString();
                        const checked = checkedClasses.includes(strClass);
                        const assignedToOther = classToGroupId[strClass] && classToGroupId[strClass] !== group.id;

                        return (
                            <label
                                key={strClass}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                        onToggleClass(strClass, e.target.checked)
                                    }
                                />
                                <span
                                    className={`truncate ${assignedToOther
                                        ? "text-gray-400 line-through"
                                        : ""
                                        }`}
                                    title={strClass}
                                >
                                    {strClass}
                                </span>
                            </label>
                        );
                    })
                )}
            </div>
        </div>
    );
});

export default IntegrationViewSettings;
