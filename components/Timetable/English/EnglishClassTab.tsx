// English Class Integration Tab
// 영어 통합 시간표 탭 - 수업별 컬럼 뷰 (Refactored to match academy-app style with Logic Port)

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Eye, EyeOff, Settings, UserPlus } from 'lucide-react';
import { EN_PERIODS, EN_WEEKDAYS, getTeacherColor } from './englishUtils';
import { Teacher, TimetableStudent, ClassKeywordColor } from '../../../types';
import IntegrationViewSettings, { IntegrationSettings } from './IntegrationViewSettings';
import StudentModal from './StudentModal';
import { doc, onSnapshot, setDoc, collection, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: { className: string; room?: string, teacher?: string }[];
}

type ScheduleData = Record<string, ScheduleCell>;

interface EnglishClassTabProps {
    teachers: string[];
    scheduleData: ScheduleData;
    teachersData?: Teacher[];
    classKeywords?: ClassKeywordColor[];  // For keyword color coding
}

interface ClassInfo {
    name: string;
    mainTeacher: string;
    mainRoom: string;
    startPeriod: number;
    // Map: PeriodID -> Day -> CellData
    scheduleMap: Record<string, Record<string, ScheduleCell>>;

    // Logic Port Fields
    weekendShift: number;
    visiblePeriods: (typeof EN_PERIODS)[number][];
    finalDays: string[];
}

const KOR_DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

const EnglishClassTab: React.FC<EnglishClassTabProps> = ({
    teachers,
    scheduleData,
    teachersData = [],
    classKeywords = []
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [mode, setMode] = useState<'view' | 'hide'>('view');
    const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<IntegrationSettings>({
        viewMode: 'START_PERIOD',
        customGroups: [],
        showOthersGroup: true,
        othersGroupTitle: '기타 수업'
    });

    // Load Settings
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'english_class_integration'), (doc) => {
            if (doc.exists()) {
                setSettings(doc.data() as IntegrationSettings);
            }
        });
        return () => unsub();
    }, []);

    const updateSettings = async (newSettings: IntegrationSettings) => {
        setSettings(newSettings);
        await setDoc(doc(db, 'settings', 'english_class_integration'), newSettings);
    };

    // 1. Transform ScheduleData into Class-centric structure with Logic
    const classes = useMemo(() => {
        const classMap = new Map<string, {
            name: string;
            mainTeacher: string;
            mainRoom: string;
            // Internal use for logic
            minPeriod: number;
            // Map
            scheduleMap: Record<string, Record<string, ScheduleCell>>;
            // For logic calculation
            weekdayMin: number;
            weekendMin: number;
        }>();

        // Pass 1: Gather Raw Data
        Object.entries(scheduleData).forEach(([key, cell]: [string, ScheduleCell]) => {
            const clsName = cell.className;
            if (!clsName) return;

            const parts = key.split('-');
            if (parts.length !== 3) return;
            const [_, periodId, day] = parts;
            const pNum = parseInt(periodId);
            if (isNaN(pNum)) return;

            // Helper to process a class entry
            const processClassEntry = (cName: string, cRoom: string, cTeacher: string) => {
                if (!classMap.has(cName)) {
                    classMap.set(cName, {
                        name: cName,
                        mainTeacher: cTeacher || '',
                        mainRoom: cRoom || '',
                        minPeriod: 99,
                        scheduleMap: {},
                        weekdayMin: 99,
                        weekendMin: 99,
                    });
                }
                const info = classMap.get(cName)!;

                // Populate Map
                if (!info.scheduleMap[periodId]) {
                    info.scheduleMap[periodId] = {};
                }

                // For merged classes, we create a cell-like object effectively
                // But wait, the cell in 'scheduleMap' is just one object. 
                // If multiple classes (Main + Merged) map to the SAME Class View, 
                // in the Class View for "MEC2", we show MEC2 data.
                // In the Class View for "KW6", we show KW6 data.
                // The cell data needs to be specific to the class being viewed?
                // Or does it just reference the teacher?
                // The Integration View displays "Teacher" in the cell.
                // So for KW6, it should show the same teacher "Sarah".

                info.scheduleMap[periodId][day] = {
                    ...cell,
                    className: cName,
                    room: cRoom,
                    teacher: cTeacher
                };

                // Simple heuristic for main teacher/room
                if (cTeacher) info.mainTeacher = cTeacher;
                if (cRoom) info.mainRoom = cRoom;

                // Min/Max Calc
                const dayIdx = EN_WEEKDAYS.indexOf(day as any);
                if (dayIdx !== -1) {
                    if (dayIdx <= 4) { // Weekday (Mon-Fri)
                        info.weekdayMin = Math.min(info.weekdayMin, pNum);
                    } else { // Weekend (Sat-Sun)
                        info.weekendMin = Math.min(info.weekendMin, pNum);
                    }
                }
                info.minPeriod = Math.min(info.minPeriod, pNum);
            };

            // Process Main Class
            processClassEntry(clsName, cell.room || '', cell.teacher || '');

            // Process Merged Classes
            if (cell.merged && cell.merged.length > 0) {
                cell.merged.forEach(m => {
                    if (m.className) {
                        processClassEntry(m.className, m.room || '', cell.teacher || '');
                    }
                });
            }
        });

        // Pass 2: Calculate Logic (Weekend Shift & Visible Periods)
        return Array.from(classMap.values())
            .map(c => {
                // 1. Weekend Shift Logic
                let weekendShift = 0;
                if (c.weekdayMin !== 99 && c.weekendMin !== 99 && c.weekdayMin > c.weekendMin) {
                    weekendShift = c.weekdayMin - c.weekendMin;
                }

                // 2. Start Period Determination (for grouping)
                // "Effective" start period considers the shift
                // Logic: Find the earliest "effective" period
                let effectiveMin = 99;
                let effectiveMax = -99;

                // Re-scan to find effective range
                Object.keys(c.scheduleMap).forEach(pId => {
                    const pNum = parseInt(pId);
                    const days = Object.keys(c.scheduleMap[pId]);
                    days.forEach(day => {
                        const dIdx = EN_WEEKDAYS.indexOf(day as any);
                        let eff = pNum;
                        if (dIdx >= 5 && weekendShift) {
                            eff = pNum + weekendShift;
                        }
                        effectiveMin = Math.min(effectiveMin, eff);
                        effectiveMax = Math.max(effectiveMax, eff);
                    });
                });
                if (effectiveMin === 99) effectiveMin = 1;
                if (effectiveMax === -99) effectiveMax = 1;


                // 3. Visible Periods (5-Period Window)
                // Logic from academy-app: Try to center but keep size 4 (actually 5 items: start to start+4)
                // Fixed logic: always show 5 periods if possible
                let start = effectiveMin;
                let end = effectiveMax;

                // Ensure minimal window of 5
                if (end - start < 4) {
                    end = start + 4;
                }

                // Clamp
                start = Math.max(1, Math.min(start, 10));
                end = Math.max(1, Math.min(end, 10));

                // Adjust if still < 5 (e.g. at edges)
                if (end - start < 4) {
                    // Try to expand down or up
                    if (start > 1) start = Math.max(1, end - 4);
                    if (end < 10) end = Math.min(10, start + 4);
                }

                const visiblePeriods = EN_PERIODS.filter(p => {
                    const pid = parseInt(p.id);
                    return pid >= start && pid <= end;
                });

                // 4. Final Days Logic (Weekend Replacement)
                const finalDays = [...EN_WEEKDAYS.slice(0, 5)]; // Default Mon-Fri
                const activeDays = new Set<string>();

                // Scan all class entries to find active days
                Object.values(c.scheduleMap).forEach(dayMap => {
                    Object.keys(dayMap).forEach(day => activeDays.add(day));
                });

                const weekendDays = Array.from(activeDays).filter(d => d === '토' || d === '일');

                // Replace empty weekdays with weekend days
                weekendDays.forEach(weekend => {
                    if (!finalDays.includes(weekend)) {
                        // Find a weekday slot that has NO classes at all for this class
                        // Logic check: Is it "No classes at all" or "No classes in this slot"? 
                        // academy-app logic was: !daysWithClass.includes(d) where daysWithClass = ANY class in this group
                        const emptyDayIndex = finalDays.findIndex(d => !activeDays.has(d));

                        if (emptyDayIndex !== -1) {
                            finalDays[emptyDayIndex] = weekend;
                        } else {
                            // If full, replace Friday? (academy-app fallback: finalDays[4] = weekend)
                            finalDays[4] = weekend;
                        }
                    }
                });

                // Sort columns by EN_WEEKDAYS index to keep order sane (Mon..Sat..Sun) 
                // BUT academy-app replaced in place... which might break order (e.g., Fri becomes Sun, so Mon Tue Wed Thu Sun). 
                // That might be intentional to keep 5 columns. 
                // Let's re-sort if we want "Mon Tue Wed Thu Sun" order or just left-to-right replacement.
                // academy-app did: finalDays.sort(...) at the end.
                finalDays.sort((a, b) => EN_WEEKDAYS.indexOf(a as any) - EN_WEEKDAYS.indexOf(b as any));


                return {
                    ...c,
                    startPeriod: effectiveMin, // Use effective min for grouping
                    weekendShift,
                    visiblePeriods,
                    finalDays
                } as ClassInfo;
            })
            .filter(c => !searchTerm || c.name.includes(searchTerm))
            .sort((a, b) => a.startPeriod - b.startPeriod || a.name.localeCompare(b.name, 'ko'));
    }, [scheduleData, searchTerm]);

    // 2. Group classes by start period OR Custom Groups
    const groupedClasses = useMemo(() => {
        const groups: { periodIndex: number; label: string; classes: ClassInfo[] }[] = [];

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

                if (groupClasses.length > 0 || mode === 'hide') { // Show empty groups? Probably not unless editing. 
                    // Academy app shows them. Let's show if it has classes.
                    if (groupClasses.length > 0) {
                        groups.push({
                            periodIndex: idx, // Use index for sorting
                            label: g.title,
                            classes: groupClasses.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
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

    return (
        <div className="flex flex-col h-full bg-white select-none">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                    {/* Mode Toggle */}
                    <div className="flex bg-gray-200 rounded-lg p-0.5">
                        <button
                            onClick={() => setMode('view')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'view' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}
                        >
                            👁️ 조회
                        </button>
                        <button
                            onClick={() => setMode('hide')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'hide' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            🙈 숨김
                        </button>
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
                </div>

                {hiddenClasses.size > 0 && (
                    <span className="text-xs text-gray-400 font-medium mr-4">
                        {hiddenClasses.size}개 숨김
                    </span>
                )}

                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold shadow-sm"
                >
                    <Settings size={14} />
                    뷰 설정
                </button>
            </div>

            {/* Teacher Legend */}
            <div className="px-4 py-2 bg-white border-b flex flex-wrap gap-2 items-center flex-shrink-0">
                <span className="text-[11px] font-bold text-gray-400 mr-1">강사 목록:</span>
                {teachers.map(teacher => {
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
            />
        </div>
    );
};

// --- Sub Components ---

const ClassCard: React.FC<{
    classInfo: ClassInfo,
    mode: 'view' | 'hide',
    isHidden: boolean,
    onToggleHidden: () => void,
    teachersData: Teacher[],
    classKeywords: ClassKeywordColor[]
}> = ({ classInfo, mode, isHidden, onToggleHidden, teachersData, classKeywords }) => {
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentCount, setStudentCount] = useState<number>(0);

    // Realtime student count subscription
    useEffect(() => {
        const q = query(collection(db, '수업목록'), where('className', '==', classInfo.name));
        const unsub = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                setStudentCount(snapshot.docs[0].data().studentList?.length || 0);
            } else {
                setStudentCount(0);
            }
        });
        return () => unsub();
    }, [classInfo.name]);

    return (
        <>
            <div className={`w-[250px] flex flex-col border-r border-gray-300 shrink-0 bg-white transition-opacity ${isHidden && mode === 'hide' ? 'opacity-50' : ''}`}>
                {/* Header - 키워드 색상 적용 */}
                {(() => {
                    const matchedKw = classKeywords.find(kw => classInfo.name?.includes(kw.keyword));
                    return (
                        <div
                            className="p-2 text-center font-bold text-sm border-b border-gray-300 flex items-center justify-center h-[50px] break-keep leading-tight relative group"
                            style={matchedKw ? { backgroundColor: matchedKw.bgColor, color: matchedKw.textColor } : { backgroundColor: '#EFF6FF', color: '#1F2937' }}
                        >
                            {classInfo.name}
                            {mode === 'hide' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
                                    className="absolute top-1 right-1 p-1 rounded hover:bg-black/10 text-gray-500"
                                >
                                    {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                            )}
                        </div>
                    );
                })()}

                {/* Info Summary */}
                <div className="bg-orange-50 border-b border-gray-300 text-xs flex flex-col">
                    <div className="flex border-b border-orange-200">
                        <div className="w-[70px] bg-orange-100 p-1 text-center font-bold border-r border-orange-200 flex items-center justify-center text-orange-800">
                            담임
                        </div>
                        <div className="flex-1 p-1 text-center font-bold text-gray-900 flex items-center justify-center">
                            {classInfo.mainTeacher}
                        </div>
                    </div>
                    <div className="flex">
                        <div className="w-[70px] bg-orange-100 p-1 text-center font-bold border-r border-orange-200 flex items-center justify-center text-orange-800">
                            강의실
                        </div>
                        <div className="flex-1 p-1 text-center font-bold text-navy flex items-center justify-center break-words px-1 leading-tight py-1.5 min-h-[40px]">
                            {classInfo.mainRoom}
                        </div>
                    </div>
                </div>

                <div className="border-b border-gray-300 flex-none">
                    {/* Grid Header */}
                    <div className="flex bg-gray-200 text-[10px] font-bold border-b border-gray-400 h-[24px]">
                        <div className="w-[48px] flex items-center justify-center border-r border-gray-400 text-gray-600">교시</div>
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
                                className={classInfo.name}
                                classKeywords={classKeywords}
                            />
                        ))}
                    </div>
                </div>

                {/* Student Section */}
                <div className="flex-1 flex flex-col bg-white min-h-[100px]">
                    <div
                        className="p-1.5 text-center text-[10px] font-bold border-b border-gray-300 shadow-sm bg-gray-100 text-gray-600 flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => setIsStudentModalOpen(true)}
                    >
                        <span>학생 명단</span>
                        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[9px]">
                            {studentCount}명
                        </span>
                        <UserPlus size={12} className="text-gray-400" />
                    </div>
                    <div
                        className="flex-1 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setIsStudentModalOpen(true)}
                    >
                        <button className="text-xs text-indigo-500 font-bold flex items-center gap-1 hover:underline">
                            <UserPlus size={14} /> 학생 관리
                        </button>
                    </div>
                </div>
            </div>

            {/* Student Modal */}
            <StudentModal
                isOpen={isStudentModalOpen}
                onClose={() => setIsStudentModalOpen(false)}
                className={classInfo.name}
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
    className: string,
    classKeywords: ClassKeywordColor[]
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays, className, classKeywords }) => {

    // Parse time for display (e.g. 14:20~15:00 -> 14:20 \n ~15:00)
    const [start, end] = period.time.split('~');

    return (
        <div className="flex border-b border-gray-100 h-[36px]">
            {/* Period Label */}
            <div className="w-[48px] border-r border-gray-100 flex flex-col items-center justify-center bg-gray-50 shrink-0 leading-tight py-0.5">
                <div className="flex items-center gap-0.5">
                    <span className="text-[9px] font-extrabold text-indigo-900">[{period.id}]</span>
                    <span className="text-[9px] text-gray-600 font-medium tracking-tighter">{start}</span>
                </div>
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
                        effectivePeriodId = String(shiftedNum);
                    }
                }

                // Note: scheduleMap structure is Map[periodId][day] -> Cell
                // So we just access correct period key
                const cell = scheduleMap[effectivePeriodId]?.[day];

                // 키워드 매칭 (className 기준)
                const matchedKw = classKeywords.find(kw => className?.includes(kw.keyword));

                // Get style based on teacher
                let teacherStyle = {};
                if (cell?.teacher) {
                    const colors = getTeacherColor(cell.teacher, teachersData);
                    teacherStyle = { backgroundColor: colors.bg, color: colors.text, fontWeight: 800 };
                }

                // 최종 스타일: 키워드 우선, 없으면 teacher 스타일
                const finalStyle = matchedKw ? {
                    backgroundColor: matchedKw.bgColor,
                    color: matchedKw.textColor,
                    fontWeight: 800
                } : teacherStyle;

                return (
                    <div
                        key={day}
                        className="flex-1 border-r border-gray-100 last:border-r-0 flex flex-col justify-center items-center text-center px-0.5 overflow-hidden text-[10px]"
                        style={teacherStyle}
                        title={cell?.teacher || ''}
                    >
                        {cell ? (
                            <span className="leading-tight line-clamp-2 break-all">
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
