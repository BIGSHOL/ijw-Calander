// English Class Integration Tab
// 영어 통합 시간표 탭 - 수업별 컬럼 뷰 (Refactored to match academy-app style with Logic Port)

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Eye, EyeOff, Settings, UserPlus, MoreVertical, TrendingUp, ArrowUpCircle, ChevronDown, Users, Home, User } from 'lucide-react';
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

// ScheduleCell, ScheduleData, ClassInfo definitions removed (imported from hooks)
interface ScheduleData extends Record<string, ScheduleCell> { }

interface EnglishClassTabProps {
    teachers: string[];
    scheduleData: ScheduleData;
    teachersData?: Teacher[];
    classKeywords?: ClassKeywordColor[];  // For keyword color coding
    currentUser: any;
    isSimulationMode?: boolean;  // 시뮬레이션 모드 여부
}

// ClassInfo removed (imported from hooks)

const KOR_DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

const EnglishClassTab: React.FC<EnglishClassTabProps> = ({
    teachers,
    scheduleData,
    teachersData = [],
    classKeywords = [],
    currentUser,
    isSimulationMode = false
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

const ClassCard: React.FC<{
    classInfo: ClassInfo,
    mode: 'view' | 'edit',
    isHidden: boolean,
    onToggleHidden: () => void,
    teachersData: Teacher[],
    classKeywords: ClassKeywordColor[],
    isMenuOpen: boolean,
    onMenuToggle: (isOpen: boolean) => void,
    displayOptions?: import('./IntegrationViewSettings').DisplayOptions,
    hiddenTeacherList?: string[],
    currentUser: any,
    englishLevels: EnglishLevel[],
    isSimulationMode?: boolean,
    moveChanges?: Map<string, MoveChange>,
    onMoveStudent?: (student: TimetableStudent, fromClass: string, toClass: string) => void
}> = ({ classInfo, mode, isHidden, onToggleHidden, teachersData, classKeywords, isMenuOpen, onMenuToggle, displayOptions, hiddenTeacherList, currentUser, englishLevels, isSimulationMode = false, moveChanges, onMoveStudent }) => {
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentCount, setStudentCount] = useState<number>(0);
    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [displayStudents, setDisplayStudents] = useState<TimetableStudent[]>([]);
    const [levelUpModal, setLevelUpModal] = useState<{ isOpen: boolean; type: 'number' | 'class'; newName: string }>({ isOpen: false, type: 'number', newName: '' });

    // Drag Handlers
    const handleDragOver = (e: React.DragEvent) => {
        if (mode === 'edit') {
            e.preventDefault(); // Enable Drop
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (mode !== 'edit') return;
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data && data.student && onMoveStudent) {
                // Ignore if dropping on same class
                // But fromClass is in data.
                onMoveStudent(data.student, data.fromClass, classInfo.name);
            }
        } catch (err) {
            console.error('Drop parse error', err);
        }
    };

    const handleDragStart = (e: React.DragEvent, student: TimetableStudent) => {
        if (mode !== 'edit') return;
        if (student.withdrawalDate || student.enrollmentDate) {
            e.preventDefault(); // Withdrawn or New students are not draggable
            return;
        }
        e.dataTransfer.setData('text/plain', JSON.stringify({
            student,
            fromClass: classInfo.name
        }));
    };

    // Realtime student list subscription & Local Changes Merge
    useEffect(() => {
        const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;
        const q = query(collection(db, targetCollection), where('className', '==', classInfo.name));
        const unsub = onSnapshot(q, (snapshot) => {
            let list: TimetableStudent[] = [];
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                list = (data.studentList || []) as TimetableStudent[];
                // DB level students
                setStudents(list);
            } else {
                setStudents([]);
            }
        });
        return () => unsub();
    }, [classInfo.name, isSimulationMode]);

    // Compute Display List (DB + Local Changes)
    useEffect(() => {
        let currentList = [...students];

        if (moveChanges) {
            // 1. Remove students moved OUT
            currentList = currentList.filter(s => {
                const change = moveChanges.get(s.id);
                // If there is a change where fromClass is THIS class, remove it.
                // Unless it moved back here (handled in handleMoveStudent logic, the entry is delted if moving back)
                // So if an entry exists, it means it is moved somewhere else.
                return !(change && change.fromClass === classInfo.name);
            });

            // 2. Add students moved IN
            moveChanges.forEach(change => {
                if (change.toClass === classInfo.name) {
                    // Check duplicate to be safe
                    if (!currentList.find(s => s.id === change.student.id)) {
                        // Mark as temporary for highlighting
                        const tempStudent = { ...change.student, isTempMoved: true };
                        currentList.push(tempStudent);
                    }
                }
            });
        }

        // Update Count (Active Only)
        const activeCount = currentList.filter(s => !s.withdrawalDate && !s.onHold).length;
        setStudentCount(activeCount);
        setDisplayStudents(currentList);

    }, [students, moveChanges, classInfo.name]);

    return (
        <>
            <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`w-[280px] flex flex-col border-r border-gray-300 shrink-0 bg-white transition-opacity ${isHidden && mode === 'edit' ? 'opacity-50' : ''} ${mode === 'edit' ? 'hover:bg-gray-50' : ''}`}
            >
                {/* Header - 키워드 색상 적용 */}
                {(() => {
                    const matchedKw = classKeywords.find(kw => classInfo.name?.includes(kw.keyword));
                    return (
                        <div
                            className="p-2 text-center font-bold text-sm border-b border-gray-300 flex items-center justify-center h-[50px] break-keep leading-tight relative group"
                            style={matchedKw ? { backgroundColor: matchedKw.bgColor, color: matchedKw.textColor } : { backgroundColor: '#EFF6FF', color: '#1F2937' }}
                        >
                            {classInfo.name}
                            {/* Edit Controls: Menu & Hide (Edit Mode Only) */}
                            {mode === 'edit' && (
                                <>
                                    {/* Hide Toggle - Right 7 (approx 28px left of menu) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
                                        className="absolute top-1 right-7 p-1 rounded hover:bg-black/10 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title={isHidden ? "보이기" : "숨기기"}
                                    >
                                        {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>

                                    {/* Menu Button - Right 1 */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onMenuToggle(!isMenuOpen); }}
                                        className="absolute top-1 right-1 p-1 rounded hover:bg-black/10 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreVertical size={14} />
                                    </button>

                                    {/* Level Up Dropdown */}
                                    {isMenuOpen && (
                                        <div className="absolute top-8 right-1 bg-white shadow-lg rounded-lg border border-gray-200 z-20 py-1 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => {
                                                    // Check if class level is valid
                                                    if (!isValidLevel(classInfo.name, englishLevels)) {
                                                        alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                        onMenuToggle(false);
                                                        return;
                                                    }

                                                    const newName = numberLevelUp(classInfo.name);
                                                    if (newName) {
                                                        setLevelUpModal({ isOpen: true, type: 'number', newName });
                                                    }
                                                    onMenuToggle(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-indigo-50 text-gray-700"
                                            >
                                                <TrendingUp size={14} className="text-indigo-500" />
                                                숫자 레벨업
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Check if class level is valid
                                                    if (!isValidLevel(classInfo.name, englishLevels)) {
                                                        alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                        onMenuToggle(false);
                                                        return;
                                                    }

                                                    const newName = classLevelUp(classInfo.name, englishLevels);
                                                    if (newName) {
                                                        setLevelUpModal({ isOpen: true, type: 'class', newName });
                                                    }
                                                    onMenuToggle(false);
                                                }}
                                                disabled={isMaxLevel(classInfo.name, englishLevels)}
                                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${isMaxLevel(classInfo.name, englishLevels) ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-orange-50 text-gray-700'}`}
                                            >
                                                <ArrowUpCircle size={14} className={isMaxLevel(classInfo.name, englishLevels) ? 'text-gray-300' : 'text-orange-500'} />
                                                클래스 레벨업
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })()}

                {/* Info Summary (Teacher/Room) */}
                {(displayOptions?.showTeacher || displayOptions?.showRoom) && (
                    <div className="bg-orange-50 border-b border-gray-300 text-xs flex flex-col">
                        {displayOptions?.showTeacher && (
                            <div className="flex border-b border-orange-200">
                                <div className="w-[70px] bg-orange-100 p-1 text-center font-bold border-r border-orange-200 flex items-center justify-center text-orange-800">
                                    담임
                                </div>
                                <div className="flex-1 p-1 text-center font-bold text-gray-900 flex items-center justify-center">
                                    {classInfo.mainTeacher}
                                </div>
                            </div>
                        )}
                        {displayOptions?.showRoom && (
                            <div className="flex">
                                <div className="w-[70px] bg-orange-100 p-1 text-center font-bold border-r border-orange-200 flex items-center justify-center text-orange-800">
                                    강의실
                                </div>
                                <div className="flex-1 p-1 text-center font-bold text-navy flex items-center justify-center break-words px-1 leading-tight py-1.5 min-h-[40px]">
                                    {classInfo.formattedRoomStr || classInfo.mainRoom}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="border-b border-gray-300 flex-none">
                    {/* Grid Header */}
                    <div className="flex bg-gray-200 text-[10px] font-bold border-b border-gray-400 h-[30px]">
                        <div className="w-[48px] flex items-center justify-center border-r border-gray-400 text-gray-600">시간</div>
                        {classInfo.finalDays.map((d) => (
                            <div key={d} className={`flex-1 flex items-center justify-center border-r border-gray-400 last:border-r-0 text-gray-700 ${d === '토' || d === '일' ? 'text-red-600' : ''}`}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Grid Rows */}
                    <div className="bg-white">
                        {classInfo.visiblePeriods.map(p => (
                            <MiniGridRow
                                key={p.id}
                                period={p}
                                scheduleMap={classInfo.scheduleMap}
                                weekendShift={classInfo.weekendShift}
                                teachersData={teachersData}
                                displayDays={classInfo.finalDays}
                                hiddenTeachers={hiddenTeacherList}
                            />
                        ))}
                    </div>
                </div>

                {/* Dynamic Content Section: Student List */}
                {displayOptions?.showStudents ? (
                    <div className="flex-1 flex flex-col bg-white min-h-[100px]">
                        <button
                            className={`p-1.5 text-center text-[13px] font-bold border-b border-gray-300 shadow-sm bg-gray-100 text-gray-600 flex items-center justify-center gap-2 transition-colors w-full ${mode === 'edit' ? 'cursor-pointer hover:bg-gray-200' : 'cursor-default'}`}
                            onClick={() => mode === 'edit' && setIsStudentModalOpen(true)}
                            aria-label={`${classInfo.name} 학생 명단 열기. 현재 ${studentCount}명`}
                        >
                            <span>학생 명단</span>
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[12px]">
                                {studentCount}명
                            </span>
                            {mode === 'edit' && <UserPlus size={12} className="text-gray-400" />}
                        </button>
                        {/* Student Name Preview - 3 Section Layout */}
                        <div className="flex-1 overflow-y-auto px-2 py-1.5 text-[10px] flex flex-col">
                            {displayStudents.length === 0 ? (
                                <div
                                    className={`flex flex-col items-center justify-center h-full text-gray-300 ${mode === 'edit' ? 'cursor-pointer hover:text-gray-400' : 'cursor-default'}`}
                                    onClick={() => mode === 'edit' && setIsStudentModalOpen(true)}
                                >
                                    <span>학생이 없습니다</span>
                                    {mode === 'edit' && <span className="text-indigo-400 mt-0.5 hover:underline">+ 추가</span>}
                                </div>
                            ) : (() => {
                                // Split students into 3 groups
                                const activeStudents = displayStudents.filter(s => !s.withdrawalDate && !s.onHold);
                                const holdStudents = displayStudents.filter(s => s.onHold && !s.withdrawalDate);
                                const withdrawnStudents = displayStudents.filter(s => s.withdrawalDate);

                                // Sort active students: Underline(0) → Normal(1) → Pink(2) → Red(3)
                                const sortedActive = [...activeStudents].sort((a, b) => {
                                    const getWeight = (s: TimetableStudent) => {
                                        if (s.underline) return 0; // 1순위: 밑줄
                                        if (s.enrollmentDate) {
                                            const days = Math.ceil((Date.now() - new Date(s.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                                            if (days <= 30) return 3; // 4순위: 1개월차 (Red)
                                            if (days <= 60) return 2; // 3순위: 2개월차 (Pink)
                                        }
                                        return 1; // 2순위: 일반 학생
                                    };
                                    const wA = getWeight(a), wB = getWeight(b);
                                    return wA !== wB ? wA - wB : a.name.localeCompare(b.name, 'ko');
                                });

                                // Helper to get row style based on enrollment date
                                const getRowStyle = (student: TimetableStudent & { isTempMoved?: boolean }) => {
                                    if (student.isTempMoved) return { className: 'bg-green-100 ring-1 ring-green-300', textClass: 'text-green-800 font-bold', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };

                                    // 반이동 + 밑줄 (우선순위 높음)
                                    if (student.isMoved && student.underline) return { className: 'bg-green-50 ring-1 ring-green-300', textClass: 'underline decoration-blue-600 text-green-800 font-bold underline-offset-2', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };

                                    // 반이동 (단독)
                                    if (student.isMoved) return { className: 'bg-green-100 ring-1 ring-green-300', textClass: 'text-green-800 font-bold', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };

                                    if (student.underline) return { className: 'bg-blue-50', textClass: 'underline decoration-blue-600 text-blue-600 underline-offset-2', subTextClass: 'text-blue-500', englishTextClass: 'text-blue-600' };
                                    if (student.enrollmentDate) {
                                        const days = Math.ceil((Date.now() - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                                        if (days <= 30) return { className: 'bg-red-500', textClass: 'text-white font-bold', subTextClass: 'text-white', englishTextClass: 'text-white/80' }; // Red: 붉은 배경, 흰색 글씨
                                        if (days <= 60) return { className: 'bg-pink-100', textClass: 'text-black font-bold', subTextClass: 'text-black', englishTextClass: 'text-gray-600' }; // Pink: 연분홍 배경, 검은 글씨
                                    }
                                    return { className: '', textClass: 'text-gray-800', subTextClass: 'text-gray-500', englishTextClass: 'text-gray-500' };
                                };

                                return (
                                    <>
                                        {/* Active Students Section */}
                                        <div className="flex-1">
                                            {sortedActive.slice(0, 12).map((student: TimetableStudent & { isTempMoved?: boolean }) => {
                                                const style = getRowStyle(student);
                                                return (
                                                    <div
                                                        key={student.id}
                                                        draggable={mode === 'edit' && !student.isTempMoved} // Prevent dragging temp moved items again immediately (optional, but safer)
                                                        onDragStart={(e) => handleDragStart(e, student)}
                                                        className={`flex items-center justify-between text-[13px] py-0.5 px-1 rounded ${style.className} ${mode === 'edit' ? 'cursor-grab active:cursor-grabbing hover:brightness-95' : ''}`}
                                                        title={student.enrollmentDate ? `입학일: ${student.enrollmentDate}` : undefined}
                                                    >
                                                        <span className={`font-medium ${style.textClass}`}>
                                                            {student.name}
                                                            {student.englishName && <span className={`font-normal ${style.englishTextClass || 'text-gray-500'}`}>({student.englishName})</span>}
                                                        </span>
                                                        {(student.school || student.grade) && (
                                                            <span className={`text-[12px] ml-1 ${style.subTextClass || 'text-gray-500'} text-right`}>{student.school}{student.grade}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {sortedActive.length > 12 && (
                                                <div
                                                    className={`text-indigo-500 font-bold mt-0.5 text-xs ${mode === 'edit' ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
                                                    onClick={() => mode === 'edit' && setIsStudentModalOpen(true)}
                                                >
                                                    +{sortedActive.length - 12}명 더보기...
                                                </div>
                                            )}
                                        </div>

                                        {/* Hold Students Section */}
                                        {holdStudents.length > 0 && (
                                            <div className="mt-2 pt-1 border-t border-yellow-200">
                                                <div className="text-[9px] font-bold text-yellow-700 mb-0.5">대기 ({holdStudents.length})</div>
                                                {holdStudents.slice(0, 3).map((student) => (
                                                    <div key={student.id} className="flex items-center text-xs py-0.5 px-1 bg-yellow-50 rounded text-yellow-800">
                                                        <span className="font-medium">{student.name}</span>
                                                    </div>
                                                ))}
                                                {holdStudents.length > 3 && (
                                                    <span className="text-[9px] text-yellow-600">+{holdStudents.length - 3}명</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Withdrawn Students Section */}
                                        {withdrawnStudents.length > 0 && (
                                            <div className="mt-2 pt-1 border-t border-gray-200">
                                                <div className="text-[9px] font-bold text-gray-400 mb-0.5">퇴원 ({withdrawnStudents.length})</div>
                                                {withdrawnStudents.slice(0, 3).map((student) => (
                                                    <div
                                                        key={student.id}
                                                        className="flex items-center text-[13px] py-0.5 px-1 bg-black rounded text-white"
                                                        title={student.withdrawalDate ? `퇴원일: ${student.withdrawalDate}` : undefined}
                                                    >
                                                        <span>{student.name}</span>
                                                        {student.englishName && <span className="ml-1 text-gray-400">({student.englishName})</span>}
                                                    </div>
                                                ))}
                                                {withdrawnStudents.length > 3 && (
                                                    <span className="text-[9px] text-gray-400">+{withdrawnStudents.length - 3}명</span>
                                                )}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                ) : (
                    // When Students are hidden, fill space or show placeholder
                    !displayOptions?.showTeacher && !displayOptions?.showRoom && (
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[100px] text-gray-300 gap-1 bg-white">
                            <EyeOff size={20} />
                            <span className="text-[10px]">정보 숨김</span>
                        </div>
                    )
                )}
            </div>

            {/* Student Modal */}
            <StudentModal
                isOpen={isStudentModalOpen}
                onClose={() => setIsStudentModalOpen(false)}
                className={classInfo.name}
                teacher={classInfo.mainTeacher}
                currentUser={currentUser}
                readOnly={mode === 'view' || (isSimulationMode && currentUser?.role !== 'master')}
                isSimulationMode={isSimulationMode}
            />

            {/* Level Up Confirm Modal */}
            <LevelUpConfirmModal
                isOpen={levelUpModal.isOpen}
                onClose={() => setLevelUpModal({ ...levelUpModal, isOpen: false })}
                onSuccess={() => {
                    console.log('[EnglishClassTab] Level-up succeeded for', classInfo.name, '→', levelUpModal.newName);
                    // onSnapshot subscription will automatically update scheduleData
                    // Optional: Add user notification here if needed
                }}
                oldClassName={classInfo.name}
                newClassName={levelUpModal.newName}
                type={levelUpModal.type}
            />
        </>
    );
};

const MiniGridRow: React.FC<{
    period: typeof EN_PERIODS[number],
    scheduleMap: Record<string, Record<string, ScheduleCell>>,
    weekendShift: number,
    teachersData: Teacher[],
    displayDays: string[],
    hiddenTeachers?: string[]
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays, hiddenTeachers }) => {

    // Parse time for display (e.g. 14:20~15:00 -> 14:20 \n ~15:00)
    const [start, end] = period.time.split('~');

    return (
        <div className="flex border-b border-gray-100 h-[30px]">
            {/* Period Label - Time Only */}
            <div className="w-[48px] border-r border-gray-100 flex flex-col items-center justify-center bg-gray-50 shrink-0 leading-tight py-0.5">
                <span className="text-[9px] font-bold text-gray-700 tracking-tighter">{start}</span>
                <span className="text-[9px] text-gray-500 tracking-tighter">~{end}</span>
            </div>

            {/* Days */}
            {displayDays.map(day => {
                const dayIndex = EN_WEEKDAYS.indexOf(day as any);
                const isWeekend = dayIndex >= 5;

                // Shift Logic for Lookup
                // If this is a weekend column, do we look up "shifted" period?
                // academy-app:
                // if (isWeekend && weekendShift > 0) effectivePeriodId = shifted...
                // This means the ROW represents Period P. 
                // Using Weekend Shift = 4...
                // At Row 5, we look up Period 1 data for the Weekend column.

                let effectivePeriodId = period.id;
                if (isWeekend && weekendShift > 0) {
                    const currentNum = parseInt(period.id, 10);
                    if (!isNaN(currentNum)) {
                        const shiftedNum = currentNum - weekendShift;
                        effectivePeriodId = String(shiftedNum) as any;
                    }
                }

                // Note: scheduleMap structure is Map[periodId][day] -> Cell
                // So we just access correct period key
                const cell = scheduleMap[effectivePeriodId]?.[day];

                // Get style based on teacher
                let teacherStyle = {};
                const isHidden = cell?.teacher && hiddenTeachers?.includes(cell.teacher);

                if (cell?.teacher && !isHidden) {
                    const colors = getTeacherColor(cell.teacher, teachersData);
                    // If underline is enabled, override color with blue
                    if (cell.underline) {
                        teacherStyle = { backgroundColor: colors.bg, color: '#2563eb' };
                    } else {
                        teacherStyle = { backgroundColor: colors.bg, color: colors.text };
                    }
                }

                return (
                    <div
                        key={day}
                        className="flex-1 border-r border-gray-100 last:border-r-0 flex flex-col justify-center items-center text-center px-0.5 overflow-hidden text-[10px]"
                        style={teacherStyle}
                        title={cell?.teacher || ''}
                    >
                        {cell && !isHidden ? (
                            <span className={`leading-tight line-clamp-2 break-all ${cell.underline ? 'underline italic' : ''}`}>
                                {cell.teacher}
                            </span>
                        ) : (
                            <span className="text-gray-200">-</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default EnglishClassTab;
