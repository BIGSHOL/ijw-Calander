// English Class Integration Tab
// 영어 통합 시간표 탭 - 수업별 컬럼 뷰 (Refactored to match academy-app style with Logic Port)

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Settings, Eye, ChevronDown, Users, Home, User } from 'lucide-react';
import { EN_PERIODS, EN_WEEKDAYS, getTeacherColor, INJAE_PERIODS, isInjaeClass, numberLevelUp, classLevelUp, isMaxLevel, isValidLevel, DEFAULT_ENGLISH_LEVELS, CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';
import { usePermissions } from '../../../hooks/usePermissions';
import { Teacher, TimetableStudent, ClassKeywordColor, EnglishLevel } from '../../../types';
import IntegrationViewSettings, { IntegrationSettings } from './IntegrationViewSettings';
import LevelSettingsModal from './LevelSettingsModal';
import LevelUpConfirmModal from './LevelUpConfirmModal';
import StudentModal from './StudentModal';
import { doc, onSnapshot, setDoc, collection, query, where, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

// Hooks
import { useEnglishSettings } from './hooks/useEnglishSettings';
import { useEnglishStats } from './hooks/useEnglishStats';
import { useEnglishChanges, MoveChange } from './hooks/useEnglishChanges';
import { useEnglishClasses, ScheduleCell, ClassInfo } from './hooks/useEnglishClasses';
import ClassCard from './ClassCard';


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
    studentMap
}) => {
    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditEnglish = hasPermission('timetable.english.edit') || isMaster;
    const [searchTerm, setSearchTerm] = useState('');
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());

    // UI States
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isLevelSettingsOpen, setIsLevelSettingsOpen] = useState(false);
    const [openMenuClass, setOpenMenuClass] = useState<string | null>(null);
    const [isDisplayOptionsOpen, setIsDisplayOptionsOpen] = useState(false);
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);

    // --- Hook Integration ---
    // 1. Settings & Levels
    const { settings, settingsLoading, englishLevels, updateSettings } = useEnglishSettings();

    // 2. Student Statistics
    const studentStats = useEnglishStats(scheduleData, isSimulationMode);

    // 3. Move Changes
    const { moveChanges, isSaving, handleMoveStudent, handleCancelChanges, handleSaveChanges } = useEnglishChanges(isSimulationMode);

    // 4. Classes Data Transformation
    const rawClasses = useEnglishClasses(scheduleData, settings, teachersData);

    // Filter by search term (Original 'classes' variable name preserved for compatibility)
    const classes = useMemo(() => {
        return rawClasses
            .filter(c => !searchTerm || c.name.includes(searchTerm))
            .sort((a, b) => a.startPeriod - b.startPeriod || a.name.localeCompare(b.name, 'ko'));
    }, [rawClasses, searchTerm]);
    // --- End Hook Integration ---



    useEffect(() => {
        const hasSeenGuide = localStorage.getItem('english_timetable_guide_shown');
        if (!hasSeenGuide) {
            // Show tooltip after a slight delay to draw attention
            const timer = setTimeout(() => setIsTooltipVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const dismissTooltip = () => {
        setIsTooltipVisible(false);
        localStorage.setItem('english_timetable_guide_shown', 'true');
    };



    // Close Display Options when clicking outside
    useEffect(() => {
        if (!isDisplayOptionsOpen) return;
        const handleClickOutside = () => setIsDisplayOptionsOpen(false);
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isDisplayOptionsOpen]);

    // 2. Group classes by start period OR Custom Groups
    const groupedClasses = useMemo(() => {
        const groups: { periodIndex: number; label: string; classes: ClassInfo[]; useInjaePeriod?: boolean }[] = [];

        if (settings.viewMode === 'CUSTOM_GROUP') {
            // --- Custom Group Mode ---
            const assignedClasses = new Set<string>();

            // 1. Defined Groups
            settings.customGroups.forEach((g, idx) => {
                const groupClasses: ClassInfo[] = [];
                g.classes.forEach(cName => {
                    const cls = classes.find(c => c.name === cName);
                    if (cls) {
                        if (hiddenClasses.has(cls.name) && mode === 'view') return;
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
                        classes: visibleOthers.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
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

    const toggleHidden = (className: string) => {
        setHiddenClasses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(className)) newSet.delete(className);
            else newSet.add(className);
            return newSet;
        });
    };

    // Show loading spinner while settings are loading to prevent flicker
    if (settingsLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-100">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-500 font-medium">설정 로딩중...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white select-none">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                    {/* Mode Toggle */}
                    <div className="flex bg-gray-200 rounded-lg p-0.5">
                        <button
                            onClick={() => setMode('view')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'view' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            👁️ 조회
                        </button>
                        {canEditEnglish && (
                            <button
                                onClick={() => setMode('edit')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                            >
                                ✏️ 수정
                            </button>
                        )}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="수업명 검색..."
                            className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-full w-48 focus:ring-2 focus:ring-indigo-400 outline-none shadow-sm"
                        />
                    </div>

                    {/* Student Stats Badges */}
                    <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                            재원 {studentStats.active}
                        </span>
                        {studentStats.new1 > 0 && (
                            <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-[10px] font-bold">
                                신입1 {studentStats.new1}
                            </span>
                        )}
                        {studentStats.new2 > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">
                                신입2 {studentStats.new2}
                            </span>
                        )}
                        {studentStats.withdrawn > 0 && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[10px] font-bold">
                                퇴원 {studentStats.withdrawn}
                            </span>
                        )}
                    </div>
                </div>



                {/* Right Section: Hidden Count + Settings Buttons */}
                <div className="flex items-center gap-2">
                    {/* Batch Save Controls (Visible when changes exist) */}
                    {moveChanges.size > 0 && mode === 'edit' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                {moveChanges.size}명
                            </span>
                            <button
                                onClick={handleSaveChanges}
                                disabled={isSaving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                            >
                                {isSaving ? '...' : '💾'}
                            </button>
                            <button
                                onClick={handleCancelChanges}
                                disabled={isSaving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold shadow-sm transition-colors"
                            >
                                ✖
                            </button>
                        </div>
                    )}

                    {hiddenClasses.size > 0 && (
                        <span className="text-xs text-gray-400 font-medium">
                            {hiddenClasses.size}개 숨김
                        </span>
                    )}

                    {/* Display Options Dropdown */}
                    <div className="relative group">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDisplayOptionsOpen(!isDisplayOptionsOpen);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold shadow-sm"
                        >
                            <Eye size={14} />
                            <span className="hidden md:inline">표시 옵션</span>
                            <ChevronDown size={12} className={`transition-transform ${isDisplayOptionsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isDisplayOptionsOpen && (
                            <div
                                className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-lg border border-gray-200 z-20 py-2 min-w-[180px]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.displayOptions?.showStudents ?? true}
                                        onChange={(e) => updateSettings({
                                            ...settings,
                                            displayOptions: {
                                                ...settings.displayOptions!,
                                                showStudents: e.target.checked
                                            }
                                        })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <Users size={14} className="text-gray-500" />
                                    <span className="text-xs text-gray-700">학생 목록</span>
                                </label>

                                <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.displayOptions?.showRoom ?? true}
                                        onChange={(e) => updateSettings({
                                            ...settings,
                                            displayOptions: {
                                                ...settings.displayOptions!,
                                                showRoom: e.target.checked
                                            }
                                        })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <Home size={14} className="text-gray-500" />
                                    <span className="text-xs text-gray-700">강의실</span>
                                </label>

                                <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.displayOptions?.showTeacher ?? true}
                                        onChange={(e) => updateSettings({
                                            ...settings,
                                            displayOptions: {
                                                ...settings.displayOptions!,
                                                showTeacher: e.target.checked
                                            }
                                        })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <User size={14} className="text-gray-500" />
                                    <span className="text-xs text-gray-700">담임 정보</span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Guide Tooltip */}
                    {isTooltipVisible && (
                        <div className="absolute top-full right-0 mt-2 bg-indigo-600 text-white text-xs p-3 rounded-lg shadow-xl z-50 w-64 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="absolute top-[-4px] right-4 w-2 h-2 bg-indigo-600 rotate-45"></div>
                            <div className="flex flex-col gap-2">
                                <div className="font-bold flex items-center gap-1">
                                    💡 보기 설정이 여기로 이동했어요!
                                </div>
                                <p className="leading-relaxed opacity-90">
                                    학생 목록, 강의실, 담임 정보 표시 여부를<br />
                                    여기서 개별적으로 설정할 수 있습니다.
                                </p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dismissTooltip();
                                    }}
                                    className="self-end bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-[10px] font-bold transition-colors"
                                >
                                    알겠습니다
                                </button>
                            </div>
                        </div>
                    )}

                    {mode === 'edit' && canEditEnglish && (
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold shadow-sm"
                        >
                            <Settings size={14} />
                            뷰 설정
                        </button>
                    )}
                    {mode === 'edit' && canEditEnglish && (
                        <button
                            onClick={() => setIsLevelSettingsOpen(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold shadow-sm"
                        >
                            <Settings size={14} />
                            레벨 설정
                        </button>
                    )}
                </div>
            </div>

            {/* Teacher Legend */}
            <div className="px-4 py-2 bg-white border-b flex flex-wrap gap-2 items-center flex-shrink-0">
                <span className="text-[11px] font-bold text-gray-400 mr-1">강사 목록:</span>
                {teachers.filter(t => !settings.hiddenLegendTeachers?.includes(t)).map(teacher => {
                    const colors = getTeacherColor(teacher, teachersData);

                    return (
                        <div
                            key={teacher}
                            className="px-2 py-0.5 rounded text-[11px] font-bold shadow-sm border border-black/5"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                            {teacher}
                        </div>
                    );
                })}
            </div>

            {/* Classes Grid */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100 custom-scrollbar">
                {groupedClasses.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        데이터가 없습니다.
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {groupedClasses.map(group => (
                            <div key={group.periodIndex} className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden w-max max-w-full">
                                {/* Group Header */}
                                <div className="bg-gray-800 text-white px-4 py-2 font-bold text-sm flex items-center gap-2">
                                    <span>🕒 {group.label}</span>
                                    <span className="text-xs bg-gray-600 px-2 py-0.5 rounded text-gray-200 font-normal">
                                        {group.classes.length}개 수업
                                    </span>
                                    {group.useInjaePeriod && (
                                        <span className="text-xs bg-amber-500 px-2 py-0.5 rounded text-white font-medium">
                                            인재원 시간표
                                        </span>
                                    )}
                                </div>

                                {/* Classes Row (Horizontal Scroll) */}
                                <div className="overflow-x-auto custom-scrollbar">
                                    <div className="flex w-max border-b border-gray-200">
                                        {group.classes.map(cls => (
                                            <ClassCard
                                                key={cls.name}
                                                classInfo={cls}
                                                mode={mode}
                                                isHidden={hiddenClasses.has(cls.name)}
                                                onToggleHidden={() => toggleHidden(cls.name)}
                                                teachersData={teachersData}
                                                classKeywords={classKeywords}
                                                isMenuOpen={openMenuClass === cls.name}
                                                onMenuToggle={(open) => setOpenMenuClass(open ? cls.name : null)}
                                                displayOptions={settings.displayOptions}
                                                hiddenTeacherList={settings.hiddenTeachers}
                                                currentUser={currentUser}
                                                englishLevels={englishLevels}
                                                isSimulationMode={isSimulationMode}
                                                // Drag & Drop Props
                                                moveChanges={moveChanges}
                                                onMoveStudent={handleMoveStudent}
                                                studentMap={studentMap}
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
                allClasses={classes.map(c => c.name)}
                teachers={teachers}
                teachersData={teachersData}
            />
            <LevelSettingsModal
                isOpen={isLevelSettingsOpen}
                onClose={() => setIsLevelSettingsOpen(false)}
            />
        </div>
    );
};

// --- Sub Components ---

// --- Sub Components ---
// ClassCard and MiniGridRow have been extracted to their own files.


export default EnglishClassTab;
