// English Class Integration Tab
// 영어 통합 시간표 탭 - 수업별 컬럼 뷰 (Refactored to match academy-app style with Logic Port)

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Settings, ArrowRightLeft, Copy, Upload, Save, GraduationCap, RotateCcw, Download } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../../../utils/localStorage';
import { EN_PERIODS, EN_WEEKDAYS, getTeacherColor, INJAE_PERIODS, isInjaeClass, numberLevelUp, classLevelUp, isMaxLevel, isValidLevel, DEFAULT_ENGLISH_LEVELS, CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';
import { usePermissions } from '../../../hooks/usePermissions';
import { Teacher, TimetableStudent, ClassKeywordColor, EnglishLevel } from '../../../types';
import IntegrationViewSettings, { IntegrationSettings } from './IntegrationViewSettings';
import LevelSettingsModal from './LevelSettingsModal';
import LevelUpConfirmModal from './LevelUpConfirmModal';
import StudentModal from './StudentModal';
import EditClassModal from '../../ClassManagement/EditClassModal';

import { doc, onSnapshot, setDoc, collection, query, where, writeBatch, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

// Hooks
import { useEnglishSettings } from './hooks/useEnglishSettings';
import { useEnglishStats } from './hooks/useEnglishStats';
import { useEnglishChanges, MoveChange } from './hooks/useEnglishChanges';
import { useEnglishClasses, ScheduleCell, ClassInfo } from './hooks/useEnglishClasses';
import { useClassStudents } from './hooks/useClassStudents';
import { useScenario } from './context/SimulationContext';
import IntegrationClassCard from '../shared/IntegrationClassCard';
import { ClassInfo as ClassInfoFromHook } from '../../../hooks/useClasses';
import ClassDetailModal from '../../ClassManagement/ClassDetailModal';
import StudentDetailModal from '../../StudentManagement/StudentDetailModal';
import { UnifiedStudent } from '../../../types';
import ExportImageModal, { ExportGroup } from '../../Common/ExportImageModal';


// ScheduleCell, ScheduleData, ClassInfo definitions removed (imported from hooks)
interface ScheduleData extends Record<string, ScheduleCell> { }

interface EnglishClassTabProps {
    teachers: string[];
    scheduleData: ScheduleData;
    teachersData?: Teacher[];
    classKeywords?: ClassKeywordColor[];  // For keyword color coding
    currentUser: any;
    isSimulationMode?: boolean;  // 시뮬레이션 모드 여부
    studentMap: Record<string, any>;
    classesData?: ClassInfoFromHook[];  // classes 컬렉션에서 담임 정보
    // Simulation controls
    canSimulation?: boolean;
    onToggleSimulation?: () => void;
    onCopyLiveToDraft?: () => void;
    onPublishToLive?: () => void;
    onOpenScenarioModal?: () => void;
    canPublish?: boolean;
    onSimulationLevelUp?: (oldName: string, newName: string) => boolean;
    // 주차 이동 시 배정 예정/퇴원 예정 미리보기용
    currentWeekStart?: Date;
    // 조회/수정 모드, 검색어 (상위 컴포넌트에서 관리)
    mode?: 'view' | 'edit';
    setMode?: (mode: 'view' | 'edit') => void;
    searchTerm?: string;
    setSearchTerm?: (term: string) => void;
    // 설정 모달 (상위 컴포넌트에서 관리)
    isSettingsOpen?: boolean;
    setIsSettingsOpen?: (open: boolean) => void;
    isLevelSettingsOpen?: boolean;
    setIsLevelSettingsOpen?: (open: boolean) => void;
    // 이미지 저장 모달 (상위 컴포넌트에서 관리)
    isExportModalOpen?: boolean;
    setIsExportModalOpen?: (open: boolean) => void;
}

// ClassInfo removed (imported from hooks)

const KOR_DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

const EnglishClassTab: React.FC<EnglishClassTabProps> = ({
    teachers,
    scheduleData,
    teachersData = [],
    classKeywords = [],
    currentUser,
    isSimulationMode = false,
    studentMap,
    classesData = [],
    canSimulation = false,
    onToggleSimulation,
    onCopyLiveToDraft,
    onPublishToLive,
    onOpenScenarioModal,
    canPublish = false,
    onSimulationLevelUp,
    currentWeekStart,
    mode: modeProp,
    setMode: setModeProp,
    searchTerm: searchTermProp,
    setSearchTerm: setSearchTermProp,
    isSettingsOpen: isSettingsOpenProp,
    setIsSettingsOpen: setIsSettingsOpenProp,
    isLevelSettingsOpen: isLevelSettingsOpenProp,
    setIsLevelSettingsOpen: setIsLevelSettingsOpenProp,
    isExportModalOpen: isExportModalOpenProp,
    setIsExportModalOpen: setIsExportModalOpenProp,
}) => {
    const { hasPermission } = usePermissions(currentUser);
    const canEditEnglish = hasPermission('timetable.english.edit');
    const canManageStudents = hasPermission('students.edit');

    // Fallback 패턴: props 또는 local state 사용
    const [searchTermLocal, setSearchTermLocal] = useState('');
    const searchTerm = searchTermProp ?? searchTermLocal;
    const setSearchTerm = setSearchTermProp ?? setSearchTermLocal;

    const [modeLocal, setModeLocal] = useState<'view' | 'edit'>(isSimulationMode ? 'edit' : 'view');
    const mode = modeProp ?? modeLocal;
    const setMode = setModeProp ?? setModeLocal;

    const [isSettingsOpenLocal, setIsSettingsOpenLocal] = useState(false);
    const isSettingsOpen = isSettingsOpenProp ?? isSettingsOpenLocal;
    const setIsSettingsOpen = setIsSettingsOpenProp ?? setIsSettingsOpenLocal;

    const [isLevelSettingsOpenLocal, setIsLevelSettingsOpenLocal] = useState(false);
    const isLevelSettingsOpen = isLevelSettingsOpenProp ?? isLevelSettingsOpenLocal;
    const setIsLevelSettingsOpen = setIsLevelSettingsOpenProp ?? setIsLevelSettingsOpenLocal;

    // 레벨 드롭다운 상태
    const [isLevelDropdownOpen, setIsLevelDropdownOpen] = useState(false);
    const levelDropdownRef = useRef<HTMLDivElement>(null);

    // 시뮬레이션 모드에서는 항상 수정모드
    useEffect(() => {
        if (isSimulationMode) setMode('edit');
    }, [isSimulationMode]);

    // 레벨 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        if (!isLevelDropdownOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (levelDropdownRef.current && !levelDropdownRef.current.contains(event.target as Node)) {
                setIsLevelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isLevelDropdownOpen]);

    const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());

    // UI States
    const [selectedClassDetail, setSelectedClassDetail] = useState<ClassInfoFromHook | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<UnifiedStudent | null>(null);
    const [editingClassId, setEditingClassId] = useState<string | null>(null);  // 시뮬레이션 수업 편집

    // 이미지 저장 모달 상태 (상위 컴포넌트에서 제어 가능)
    const [localExportModalOpen, setLocalExportModalOpen] = useState(false);
    const isExportModalOpen = isExportModalOpenProp ?? localExportModalOpen;
    const setIsExportModalOpen = setIsExportModalOpenProp ?? setLocalExportModalOpen;
    const gridRef = useRef<HTMLDivElement>(null);
    // 이미지 내보내기용 그룹 상태
    const [exportGroups, setExportGroups] = useState<ExportGroup[]>([]);
    const [exportVisibleGroups, setExportVisibleGroups] = useState<number[] | undefined>(undefined);


    // --- Hook Integration ---
    // 1. Settings & Levels
    const { settings: liveSettings, settingsLoading, englishLevels, updateSettings: updateLiveSettings } = useEnglishSettings();

    // 2. Scenario Context (시뮬레이션 모드용)
    const scenario = useScenario();
    const scenarioClasses = scenario?.scenarioClasses || {};
    const scenarioViewSettings = scenario?.scenarioViewSettings;

    // 3. Merged Settings: 시뮬레이션 모드에서는 시나리오 전용 뷰 설정 사용
    const settings = useMemo(() => {
        if (isSimulationMode && scenarioViewSettings) {
            return {
                ...liveSettings,
                // 시나리오 전용 그룹 설정으로 오버라이드
                viewMode: scenarioViewSettings.viewMode,
                customGroups: scenarioViewSettings.customGroups,
                showOthersGroup: scenarioViewSettings.showOthersGroup,
                othersGroupTitle: scenarioViewSettings.othersGroupTitle,
            };
        }
        return liveSettings;
    }, [isSimulationMode, scenarioViewSettings, liveSettings]);

    // 4. Settings Update Handler (시뮬레이션 모드: 시나리오 설정, 실시간: Firebase)
    const updateSettings = useCallback((newSettings: IntegrationSettings) => {
        if (isSimulationMode && scenario?.updateScenarioViewSettings) {
            // 시뮬레이션 모드: 시나리오 전용 뷰 설정 업데이트
            scenario.updateScenarioViewSettings({
                viewMode: newSettings.viewMode,
                customGroups: newSettings.customGroups,
                showOthersGroup: newSettings.showOthersGroup,
                othersGroupTitle: newSettings.othersGroupTitle,
            });
            // displayOptions 등 개인 설정은 여전히 실시간 설정에 저장
            if (newSettings.displayOptions || newSettings.hiddenTeachers || newSettings.hiddenLegendTeachers) {
                updateLiveSettings(newSettings);
            }
        } else {
            updateLiveSettings(newSettings);
        }
    }, [isSimulationMode, scenario, updateLiveSettings]);

    // 주차 기준일 (YYYY-MM-DD)
    const referenceDate = useMemo(() => {
        if (!currentWeekStart) return undefined;
        const y = currentWeekStart.getFullYear();
        const m = String(currentWeekStart.getMonth() + 1).padStart(2, '0');
        const d = String(currentWeekStart.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, [currentWeekStart]);

    // 5. Student Statistics (now uses enrollments + studentMap)
    const studentStats = useEnglishStats(scheduleData, isSimulationMode, studentMap, referenceDate);

    // 6. Move Changes
    const { moveChanges, isSaving, handleMoveStudent, handleCancelChanges, handleSaveChanges } = useEnglishChanges(isSimulationMode);

    // 7. Classes Data Transformation (classesData 또는 scenarioClasses로부터 담임 정보 전달)
    const rawClasses = useEnglishClasses(scheduleData, settings, teachersData, classesData, isSimulationMode, scenarioClasses);

    // 6. Centralized Student Data Fetch (Cost Optimization)
    const classNames = useMemo(() => rawClasses.map(c => c.name), [rawClasses]);
    const { classDataMap, refetch: refetchClassStudents } = useClassStudents(classNames, isSimulationMode, studentMap, referenceDate);

    // Filter by search term (Original 'classes' variable name preserved for compatibility)
    const classes = useMemo(() => {
        return rawClasses
            .filter(c => !searchTerm || (c.name || '').includes(searchTerm))
            .sort((a, b) => a.startPeriod - b.startPeriod || (a.name || '').localeCompare(b.name || '', 'ko'));
    }, [rawClasses, searchTerm]);
    // --- End Hook Integration ---
    // 2. Group classes by start period OR Custom Groups
    const groupedClasses = useMemo(() => {
        const groups: { periodIndex: number; label: string; classes: ClassInfo[]; useInjaePeriod?: boolean }[] = [];

        if (settings.viewMode === 'CUSTOM_GROUP') {
            // --- Custom Group Mode ---
            const assignedClasses = new Set<string>();

            // 1. Defined Groups (classId 기반 매칭, 하위호환: className도 지원)
            settings.customGroups.forEach((g, idx) => {
                const groupClasses: ClassInfo[] = [];
                // 중복 classRef 제거 (같은 그룹 내 중복 방지)
                const uniqueClassRefs = [...new Set(g.classes)];
                uniqueClassRefs.forEach(classRef => {
                    const cls = classes.find(c => c.classId === classRef) || classes.find(c => c.name === classRef);
                    if (cls) {
                        if (hiddenClasses.has(cls.name) && mode === 'view') return;
                        // 중복 방지: 이미 다른 그룹에 할당된 수업은 건너뛰기
                        if (assignedClasses.has(cls.name)) return;
                        groupClasses.push(cls);
                        assignedClasses.add(cls.name);
                    }
                });

                if (groupClasses.length > 0 || mode === 'edit') { // Show empty groups in edit mode
                    // Academy app shows them. Let's show if it has classes.
                    if (groupClasses.length > 0 || mode === 'edit') {
                        groups.push({
                            periodIndex: idx, // Use index for sorting
                            label: g.title,
                            classes: groupClasses,
                            useInjaePeriod: g.useInjaePeriod
                        });
                    }
                }
            });

            // 2. Others Group
            if (settings.showOthersGroup) {
                const otherClasses = classes.filter(c => !assignedClasses.has(c.name));
                const visibleOthers = otherClasses.filter(c => !(hiddenClasses.has(c.name) && mode === 'view'));

                if (visibleOthers.length > 0) {
                    groups.push({
                        periodIndex: 999,
                        label: settings.othersGroupTitle || '기타 수업',
                        classes: visibleOthers.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
                    });
                }
            }

        } else {
            // --- Start Period Mode (Existing) ---
            classes.forEach(cls => {
                if (hiddenClasses.has(cls.name) && mode === 'view') return;

                let group = groups.find(g => g.periodIndex === cls.startPeriod);
                if (!group) {
                    // Find label from EN_PERIODS
                    const pLabel = EN_PERIODS.find(p => parseInt(p.id) === cls.startPeriod)?.label || `${cls.startPeriod}교시`;

                    group = {
                        periodIndex: cls.startPeriod,
                        label: `${pLabel} 시작`,
                        classes: [],
                    };
                    groups.push(group);
                }
                group.classes.push(cls);
            });
            groups.sort((a, b) => a.periodIndex - b.periodIndex);
        }

        return groups;
    }, [classes, hiddenClasses, mode, settings]);

    // 그룹 정보 업데이트 (이미지 내보내기용)
    // 이전 그룹 ID를 추적하여 실제 변경 시에만 상태 업데이트 (무한 루프 방지)
    const prevGroupIdsRef = useRef<string>('');
    useEffect(() => {
        if (groupedClasses.length > 0) {
            const groupIds = groupedClasses.map(g => g.periodIndex).join(',');
            if (groupIds !== prevGroupIdsRef.current) {
                prevGroupIdsRef.current = groupIds;
                setExportGroups(groupedClasses.map(g => ({
                    id: g.periodIndex,
                    label: g.label,
                })));
            }
        }
    }, [groupedClasses]);

    // 이미지 내보내기: 선택된 그룹 변경 시 처리
    const handleExportGroupsChanged = useCallback((selectedIds: (string | number)[]) => {
        setExportVisibleGroups(selectedIds.map(id => Number(id)));
    }, []);

    // 모달 닫힐 때 그룹 필터 초기화
    const handleExportModalClose = useCallback(() => {
        setIsExportModalOpen(false);
        setExportVisibleGroups(undefined); // 모든 그룹 표시로 복원
    }, []);

    const toggleHidden = (className: string) => {
        setHiddenClasses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(className)) newSet.delete(className);
            else newSet.add(className);
            return newSet;
        });
    };

    // 수업 종료 취소 (퇴원생 복구)
    const handleRestoreEnrollment = async (studentId: string, className: string) => {
        try {
            // Find the enrollment document
            const enrollmentsQuery = query(
                collection(db, 'students', studentId, 'enrollments'),
                where('subject', '==', 'english'),
                where('className', '==', className)
            );
            const snapshot = await getDocs(enrollmentsQuery);

            if (snapshot.empty) {
                alert('해당 수강 정보를 찾을 수 없습니다.');
                return;
            }

            // Remove endDate and withdrawalDate from the enrollment
            for (const docSnap of snapshot.docs) {
                await updateDoc(docSnap.ref, {
                    endDate: deleteField(),
                    withdrawalDate: deleteField(),
                });
            }

            // Refresh class students data
            await refetchClassStudents();
            alert('수업 종료가 취소되었습니다.');
        } catch (error) {
            console.error('수업 종료 취소 오류:', error);
            alert('수업 종료 취소에 실패했습니다.');
        }
    };

    // Show loading spinner while settings are loading to prevent flicker
    if (settingsLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-100">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-sm animate-spin"></div>
                    <span className="text-sm text-gray-500 font-medium">설정 로딩중...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white select-none">
            {/* Simulation Action Bar */}
            {isSimulationMode && canEditEnglish && (
                <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-orange-50 border-b border-orange-200 flex-shrink-0">
                    <button
                        onClick={onCopyLiveToDraft}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-sm text-xs font-bold hover:bg-orange-50 shadow-sm transition-colors"
                        title="현재 실시간 시간표를 복사해옵니다"
                    >
                        <Copy size={12} />
                        현재 상태 가져오기
                    </button>
                    {canPublish && (
                        <button
                            onClick={onPublishToLive}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-sm text-xs font-bold hover:bg-orange-700 shadow-sm transition-colors"
                            title="시뮬레이션 내용을 실제 시간표에 적용합니다"
                        >
                            <Upload size={12} />
                            실제 반영
                        </button>
                    )}
                    <button
                        onClick={onOpenScenarioModal}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 border border-purple-300 text-purple-700 rounded-sm text-xs font-bold hover:bg-purple-200 shadow-sm transition-colors"
                        title="시나리오 저장/불러오기"
                    >
                        <Save size={12} />
                        시나리오 관리
                    </button>
                </div>
            )}

            {/* Teacher Legend + Controls */}
            <div className="px-4 py-2 bg-white border-b flex items-center justify-between flex-shrink-0">
                {/* Left: 강사 목록 */}
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-bold text-gray-400 mr-1">강사 목록:</span>
                    {teachers.filter(t => {
                        if (settings.hiddenLegendTeachers?.includes(t)) return false;
                        const td = teachersData.find(td => td.name === t || td.englishName === t);
                        if (td?.isHidden) return false;
                        return true;
                    }).map(teacher => {
                        const colors = getTeacherColor(teacher, teachersData);
                        // 영어이름(한글이름) 형식으로 표시
                        const staffMember = teachersData?.find(t => t.name === teacher || t.englishName === teacher);
                        const displayName = staffMember?.englishName
                            ? `${staffMember.englishName}(${staffMember.name})`
                            : teacher;

                        return (
                            <div
                                key={teacher}
                                className="px-2 py-0.5 rounded-sm text-xs font-bold shadow-sm border border-black/5"
                                style={{ backgroundColor: colors.bg, color: colors.text }}
                            >
                                {displayName}
                            </div>
                        );
                    })}
                </div>

                {/* Right: 설정 버튼들 */}
                <div className="flex items-center gap-2 ml-4">
                    {/* 수정 모드 버튼들 */}
                    {mode === 'edit' && canEditEnglish && (
                        <>
                            {/* 그룹 설정 (보기 설정) */}
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-50 text-xs font-bold"
                            >
                                <Settings size={12} />
                                그룹 설정
                            </button>
                            {/* 레벨 드롭다운 (화살표 없음) */}
                            {!isSimulationMode && (
                                <div className="relative" ref={levelDropdownRef}>
                                    <button
                                        onClick={() => setIsLevelDropdownOpen(!isLevelDropdownOpen)}
                                        className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-50 text-xs font-bold"
                                    >
                                        <GraduationCap size={12} />
                                        레벨
                                    </button>
                                    {isLevelDropdownOpen && (
                                        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-sm shadow-lg z-50 min-w-[140px]">
                                            <button
                                                onClick={() => {
                                                    setIsLevelSettingsOpen(true);
                                                    setIsLevelDropdownOpen(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left"
                                            >
                                                <Settings size={12} />
                                                레벨 설정
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // 기본값 초기화 기능 - 직접 접근
                                                    if (confirm('기본 레벨 데이터(DP~MEC)로 초기화하시겠습니까?')) {
                                                        // LevelSettingsModal에서 처리하므로 모달 열기
                                                        setIsLevelSettingsOpen(true);
                                                    }
                                                    setIsLevelDropdownOpen(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left border-t border-gray-100"
                                            >
                                                <RotateCcw size={12} />
                                                기본값 초기화
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Classes Grid */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100 custom-scrollbar">
                {groupedClasses.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        데이터가 없습니다.
                    </div>
                ) : (
                    <div ref={gridRef} className="flex flex-col gap-6">
                        {groupedClasses
                            .filter(group => !exportVisibleGroups || exportVisibleGroups.includes(group.periodIndex))
                            .map(group => (
                            <div key={group.periodIndex} data-group-id={group.periodIndex} className="bg-white shadow border border-gray-300 overflow-hidden w-max max-w-full">
                                {/* Group Header */}
                                <div className="bg-gray-800 text-white px-4 py-2 font-bold text-sm flex items-center gap-2">
                                    <span>🕒 {group.label}</span>
                                    <span className="text-xs bg-gray-600 px-2 py-0.5 rounded-sm text-gray-200 font-normal">
                                        {group.classes.length}개 수업
                                    </span>
                                    {group.useInjaePeriod && (
                                        <span className="text-xs bg-amber-500 px-2 py-0.5 rounded-sm text-white font-medium">
                                            인재원 시간표
                                        </span>
                                    )}
                                </div>

                                {/* Classes Row (Horizontal Scroll) */}
                                <div className="overflow-x-auto custom-scrollbar">
                                    <div className="flex items-stretch w-max border-b border-gray-200">
                                        {/* Sticky Time Column */}
                                        {group.classes.length > 0 && (
                                            <div className="sticky left-0 z-20 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.1)] self-stretch">
                                                <IntegrationClassCard
                                                    classInfo={group.classes[0]}
                                                    mode={'view'}
                                                    subject="english"
                                                    displayOptions={settings.displayOptions}
                                                    teachersData={teachersData}
                                                    classKeywords={[]}
                                                    currentUser={currentUser}
                                                    isSimulationMode={isSimulationMode}
                                                    classStudentData={classDataMap[group.classes[0].name]}
                                                    isTimeColumnOnly={true}
                                                    englishLevels={englishLevels}
                                                    hiddenTeacherList={settings.hiddenTeachers}
                                                    currentWeekStart={currentWeekStart}
                                                />
                                            </div>
                                        )}

                                        {group.classes.map(cls => (
                                            <IntegrationClassCard
                                                key={cls.name}
                                                classInfo={cls}
                                                mode={mode}
                                                subject="english"
                                                isHidden={hiddenClasses.has(cls.name)}
                                                onToggleHidden={() => toggleHidden(cls.name)}
                                                displayOptions={settings.displayOptions}
                                                teachersData={teachersData}
                                                classKeywords={classKeywords}
                                                currentUser={currentUser}
                                                englishLevels={englishLevels}
                                                isSimulationMode={isSimulationMode}
                                                onSimulationLevelUp={onSimulationLevelUp}
                                                moveChanges={moveChanges}
                                                onMoveStudent={handleMoveStudent}
                                                classStudentData={classDataMap[cls.name]}
                                                hideTime={true}
                                                useInjaePeriod={group.useInjaePeriod}
                                                hiddenTeacherList={settings.hiddenTeachers}
                                                onClassClick={(mode === 'edit' && !isSimulationMode) ? () => {
                                                    // 실시간 모드에서만 수업 상세 모달 열기
                                                    // 시뮬레이션 모드에서는 학생 배정 변경 비활성화
                                                    const classDetail: ClassInfoFromHook = {
                                                        id: cls.classId,
                                                        className: cls.name,
                                                        subject: 'english',
                                                        teacher: cls.mainTeacher,
                                                        room: cls.mainRoom,
                                                        studentCount: classDataMap[cls.name]?.studentList?.filter((s: any) => !s.withdrawalDate && !s.onHold).length || 0,
                                                    };
                                                    setSelectedClassDetail(classDetail);
                                                } : undefined}
                                                onStudentClick={!isSimulationMode ? (studentId) => {
                                                    // 시뮬레이션 모드에서는 학생 클릭 비활성화 (실시간 데이터 수정 방지)
                                                    const student = studentMap[studentId];
                                                    if (student) {
                                                        setSelectedStudent(student as UnifiedStudent);
                                                    }
                                                } : undefined}
                                                onRestoreEnrollment={!isSimulationMode ? handleRestoreEnrollment : undefined}
                                                onEditClass={isSimulationMode ? (classId) => setEditingClassId(classId) : undefined}
                                                currentWeekStart={currentWeekStart}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <IntegrationViewSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onChange={updateSettings}
                allClasses={classes.map(c => ({ classId: c.classId, className: c.name }))}
                teachers={teachers}
                teachersData={teachersData}
            />
            <LevelSettingsModal
                isOpen={isLevelSettingsOpen}
                onClose={() => setIsLevelSettingsOpen(false)}
            />

            {/* 수업 상세 모달 */}
            {selectedClassDetail && (
                <ClassDetailModal
                    classInfo={selectedClassDetail}
                    onClose={() => setSelectedClassDetail(null)}
                />
            )}

            {/* 학생 상세 모달 - 학생관리 권한에 따라 조회/수정 모드 결정 */}
            {selectedStudent && (
                <StudentDetailModal
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    readOnly={!canManageStudents}
                    currentUser={currentUser}
                />
            )}

            {/* 시뮬레이션 모드 수업 편집 모달 */}
            {editingClassId && isSimulationMode && (() => {
                const scenarioClass = scenarioClasses[editingClassId];
                if (!scenarioClass) return null;

                // ScenarioClass를 EditClassModal이 기대하는 ClassInfo 형식으로 변환
                // schedule: { day, periodId }[] -> "월 5" 형식의 문자열 배열로 변환
                const scheduleStrings = scenarioClass.schedule.map(s => `${s.day} ${s.periodId}`);

                const classInfo = {
                    id: editingClassId,
                    className: scenarioClass.className,
                    teacher: scenarioClass.teacher,
                    subject: 'english' as const,
                    schedule: scheduleStrings,
                    room: scenarioClass.room,
                    slotTeachers: scenarioClass.slotTeachers,
                    slotRooms: scenarioClass.slotRooms,
                };

                return (
                    <EditClassModal
                        classInfo={classInfo}
                        initialSlotTeachers={scenarioClass.slotTeachers}
                        onClose={() => setEditingClassId(null)}
                        isSimulationMode={true}
                    />
                );
            })()}

            {/* 이미지 저장 모달 */}
            <ExportImageModal
                isOpen={isExportModalOpen}
                onClose={handleExportModalClose}
                targetRef={gridRef}
                title="영어 통합 시간표 저장"
                subtitle="저장할 행을 선택하세요"
                fileName={`영어_통합시간표_${new Date().toISOString().split('T')[0]}`}
                groups={exportGroups}
                onGroupsChanged={handleExportGroupsChanged}
            />
        </div>
    );
};

// --- Sub Components ---

// --- Sub Components ---
// ClassCard and MiniGridRow have been extracted to their own files.


export default EnglishClassTab;
