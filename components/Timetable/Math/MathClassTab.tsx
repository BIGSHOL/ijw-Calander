// Math Class Integration Tab
// 수학 통합 시간표 탭 - 수업별 컬럼 뷰 (영어 통합뷰와 동일한 디자인)

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Settings, Eye, Edit, ArrowRightLeft, Copy, Upload, Save, ChevronDown, Users, Home, User, CalendarDays } from 'lucide-react';
import { Teacher, TimetableStudent, ClassKeywordColor, TimetableClass } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';

// Hooks
import { useMathSettings, MathIntegrationSettings } from './hooks/useMathSettings';
import { useMathIntegrationClasses, MathClassInfo } from './hooks/useMathIntegrationClasses';
import { useMathClassStudents } from './hooks/useMathClassStudents';

// Components
import MathIntegrationClassCard from './MathIntegrationClassCard';
import MathIntegrationViewSettings, { MathClassEntry } from './MathIntegrationViewSettings';
import ClassDetailModal from '../../ClassManagement/ClassDetailModal';
import StudentDetailModal from '../../StudentManagement/StudentDetailModal';
import { ClassInfo as ClassInfoFromHook } from '../../../hooks/useClasses';
import { UnifiedStudent } from '../../../types';

interface MathClassTabProps {
    classes: TimetableClass[];
    teachers: string[];
    teachersData?: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
    studentMap: Record<string, any>;
    classesData?: ClassInfoFromHook[];
    isSimulationMode?: boolean;
    canSimulation?: boolean;
    onToggleSimulation?: () => void;
    onCopyLiveToDraft?: () => void;
    onPublishToLive?: () => void;
    onOpenScenarioModal?: () => void;
    canPublish?: boolean;
}

interface GroupedClass {
    periodIndex: number;
    label: string;
    classes: MathClassInfo[];
}

// 강사 색상 가져오기
const getTeacherColor = (teacherName: string, teachersData: Teacher[]): { bg: string; text: string } => {
    const teacher = teachersData.find(t => t.name === teacherName);
    if (teacher?.color) {
        return { bg: teacher.color, text: '#fff' };
    }
    return { bg: '#e5e7eb', text: '#374151' };
};

const MathClassTab: React.FC<MathClassTabProps> = ({
    classes,
    teachers,
    teachersData = [],
    classKeywords = [],
    currentUser,
    studentMap,
    classesData = [],
    isSimulationMode = false,
    canSimulation = false,
    onToggleSimulation,
    onCopyLiveToDraft,
    onPublishToLive,
    onOpenScenarioModal,
    canPublish = false,
}) => {
    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditMath = hasPermission('timetable.math.edit') || isMaster;

    const [searchTerm, setSearchTerm] = useState('');
    const [mode, setMode] = useState<'view' | 'edit'>(isSimulationMode ? 'edit' : 'view');
    const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());

    // UI States
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDisplayOptionsOpen, setIsDisplayOptionsOpen] = useState(false);
    const [selectedClassDetail, setSelectedClassDetail] = useState<ClassInfoFromHook | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<UnifiedStudent | null>(null);

    // 시뮬레이션 모드에서는 항상 수정모드
    useEffect(() => {
        if (isSimulationMode) setMode('edit');
    }, [isSimulationMode]);

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

    // --- Hook Integration ---
    const { settings, settingsLoading, updateSettings } = useMathSettings();
    const mathClasses = useMathIntegrationClasses(classes, settings, teachersData);
    const classNames = useMemo(() => mathClasses.map(c => c.name), [mathClasses]);
    const { classDataMap, isLoading: studentsLoading } = useMathClassStudents(classNames, studentMap);

    // Student Stats 계산
    const studentStats = useMemo(() => {
        let active = 0;
        let withdrawn = 0;

        Object.values(classDataMap).forEach(data => {
            if (data?.studentList) {
                data.studentList.forEach((s: TimetableStudent) => {
                    if (s.withdrawalDate) {
                        withdrawn++;
                    } else if (!s.onHold) {
                        active++;
                    }
                });
            }
        });

        return { active, withdrawn };
    }, [classDataMap]);

    // Filter by search term
    const filteredClasses = useMemo(() => {
        return mathClasses
            .filter(c => !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.startPeriod - b.startPeriod || a.name.localeCompare(b.name, 'ko'));
    }, [mathClasses, searchTerm]);

    // Group classes by start period OR Custom Groups
    const groupedClasses = useMemo(() => {
        const groups: GroupedClass[] = [];

        if (settings.viewMode === 'CUSTOM_GROUP') {
            const assignedClasses = new Set<string>();

            settings.customGroups.forEach((g, idx) => {
                const groupClasses: MathClassInfo[] = [];
                g.classes.forEach(classRef => {
                    const cls = filteredClasses.find(c => c.classId === classRef) ||
                        filteredClasses.find(c => c.name === classRef);
                    if (cls) {
                        if (hiddenClasses.has(cls.name) && mode === 'view') return;
                        groupClasses.push(cls);
                        assignedClasses.add(cls.name);
                    }
                });

                if (groupClasses.length > 0 || mode === 'edit') {
                    groups.push({
                        periodIndex: idx,
                        label: g.title,
                        classes: groupClasses,
                    });
                }
            });

            if (settings.showOthersGroup) {
                const otherClasses = filteredClasses.filter(c => !assignedClasses.has(c.name));
                const visibleOthers = otherClasses.filter(c => !(hiddenClasses.has(c.name) && mode === 'view'));

                if (visibleOthers.length > 0) {
                    groups.push({
                        periodIndex: 999,
                        label: settings.othersGroupTitle || '기타 수업',
                        classes: visibleOthers,
                    });
                }
            }
        } else {
            const periodMap = new Map<number, MathClassInfo[]>();

            filteredClasses.forEach(cls => {
                if (hiddenClasses.has(cls.name) && mode === 'view') return;
                const period = cls.startPeriod;
                if (!periodMap.has(period)) {
                    periodMap.set(period, []);
                }
                periodMap.get(period)!.push(cls);
            });

            Array.from(periodMap.entries())
                .sort((a, b) => a[0] - b[0])
                .forEach(([period, classes]) => {
                    groups.push({
                        periodIndex: period,
                        label: `${period}교시 시작`,
                        classes,
                    });
                });
        }

        return groups;
    }, [filteredClasses, settings, hiddenClasses, mode]);

    const allClassesForSettings: MathClassEntry[] = useMemo(() => {
        return mathClasses.map(c => ({
            classId: c.classId,
            className: c.name,
        }));
    }, [mathClasses]);

    const toggleHidden = (className: string) => {
        setHiddenClasses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(className)) newSet.delete(className);
            else newSet.add(className);
            return newSet;
        });
    };

    const handleClassClick = (classInfo: MathClassInfo) => {
        const classDetail = classesData.find(c => c.className === classInfo.name);
        if (classDetail) {
            setSelectedClassDetail(classDetail);
        }
    };

    const handleStudentClick = (studentId: string) => {
        const student = studentMap[studentId];
        if (student) {
            setSelectedStudent(student);
        }
    };

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
                    {!isSimulationMode && (
                        <div className="flex bg-gray-200 rounded-lg p-0.5">
                            <button
                                onClick={() => setMode('view')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'view' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                            >
                                👁️ 조회
                            </button>
                            {canEditMath && (
                                <button
                                    onClick={() => setMode('edit')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                                >
                                    <Edit className="inline-block w-3 h-3 mr-1" />
                                    수정
                                </button>
                            )}
                        </div>
                    )}

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
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xxs font-bold">
                            재원 {studentStats.active}
                        </span>
                        {studentStats.withdrawn > 0 && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xxs font-bold">
                                퇴원 {studentStats.withdrawn}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-2">
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
                                            displayOptions: { ...settings.displayOptions!, showStudents: e.target.checked }
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
                                            displayOptions: { ...settings.displayOptions!, showRoom: e.target.checked }
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
                                            displayOptions: { ...settings.displayOptions!, showTeacher: e.target.checked }
                                        })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <User size={14} className="text-gray-500" />
                                    <span className="text-xs text-gray-700">담임 정보</span>
                                </label>

                                <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.displayOptions?.showSchedule ?? true}
                                        onChange={(e) => updateSettings({
                                            ...settings,
                                            displayOptions: { ...settings.displayOptions!, showSchedule: e.target.checked }
                                        })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <CalendarDays size={14} className="text-gray-500" />
                                    <span className="text-xs text-gray-700">스케줄</span>
                                </label>
                            </div>
                        )}
                    </div>

                    {mode === 'edit' && canEditMath && (
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold shadow-sm"
                        >
                            <Settings size={14} />
                            뷰 설정
                        </button>
                    )}

                    {/* Simulation Mode Toggle */}
                    {canSimulation && (
                        <div
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${isSimulationMode ? 'bg-orange-100 border-orange-300' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                            onClick={onToggleSimulation}
                        >
                            <ArrowRightLeft size={14} className={isSimulationMode ? 'text-orange-600' : 'text-gray-500'} />
                            <span className={`text-xs font-bold ${isSimulationMode ? 'text-orange-700' : 'text-gray-600'}`}>
                                {isSimulationMode ? '시뮬레이션' : '실시간'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Simulation Action Bar */}
            {isSimulationMode && canEditMath && (
                <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-orange-50 border-b border-orange-200 flex-shrink-0">
                    <button
                        onClick={onCopyLiveToDraft}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-50 shadow-sm transition-colors"
                        title="현재 실시간 시간표를 복사해옵니다"
                    >
                        <Copy size={12} />
                        현재 상태 가져오기
                    </button>
                    {canPublish && (
                        <button
                            onClick={onPublishToLive}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 shadow-sm transition-colors"
                            title="시뮬레이션 내용을 실제 시간표에 적용합니다"
                        >
                            <Upload size={12} />
                            실제 반영
                        </button>
                    )}
                    <button
                        onClick={onOpenScenarioModal}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 border border-purple-300 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200 shadow-sm transition-colors"
                        title="시나리오 저장/불러오기"
                    >
                        <Save size={12} />
                        시나리오 관리
                    </button>
                </div>
            )}

            {/* Teacher Legend */}
            <div className="px-4 py-2 bg-white border-b flex flex-wrap gap-2 items-center flex-shrink-0">
                <span className="text-xs font-bold text-gray-400 mr-1">강사 목록:</span>
                {teachers.filter(t => {
                    const td = teachersData.find(td => td.name === t);
                    if (td?.isHidden) return false;
                    return true;
                }).map(teacher => {
                    const colors = getTeacherColor(teacher, teachersData);
                    return (
                        <div
                            key={teacher}
                            className="px-2 py-0.5 rounded text-xs font-bold shadow-sm border border-black/5"
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
                            <div key={group.periodIndex} className="bg-white shadow border border-gray-300 overflow-hidden w-max max-w-full">
                                {/* Group Header */}
                                <div className="bg-gray-800 text-white px-4 py-2 font-bold text-sm flex items-center gap-2">
                                    <span>🕒 {group.label}</span>
                                    <span className="text-xs bg-gray-600 px-2 py-0.5 rounded text-gray-200 font-normal">
                                        {group.classes.length}개 수업
                                    </span>
                                </div>

                                {/* Classes Row (Horizontal Scroll) */}
                                <div className="overflow-x-auto custom-scrollbar">
                                    <div className="flex items-stretch w-max border-b border-gray-200">
                                        {/* Sticky Time Column */}
                                        {group.classes.length > 0 && (
                                            <div className="sticky left-0 z-20 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.1)] self-stretch">
                                                <MathIntegrationClassCard
                                                    classInfo={group.classes[0]}
                                                    mode={'view'}
                                                    displayOptions={settings.displayOptions}
                                                    teachersData={teachersData}
                                                    classKeywords={[]}
                                                    currentUser={currentUser}
                                                    isSimulationMode={isSimulationMode}
                                                    classStudentData={classDataMap[group.classes[0].name]}
                                                    isTimeColumnOnly={true}
                                                />
                                            </div>
                                        )}

                                        {group.classes.map(cls => (
                                            <MathIntegrationClassCard
                                                key={cls.name}
                                                classInfo={cls}
                                                mode={mode}
                                                isHidden={hiddenClasses.has(cls.name)}
                                                onToggleHidden={() => toggleHidden(cls.name)}
                                                displayOptions={settings.displayOptions}
                                                teachersData={teachersData}
                                                classKeywords={classKeywords}
                                                currentUser={currentUser}
                                                isSimulationMode={isSimulationMode}
                                                classStudentData={classDataMap[cls.name]}
                                                hideTime={true}
                                                onClassClick={mode === 'edit' && !isSimulationMode ? () => handleClassClick(cls) : undefined}
                                                onStudentClick={handleStudentClick}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            <MathIntegrationViewSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onChange={updateSettings}
                allClasses={allClassesForSettings}
                teachers={teachers}
                teachersData={teachersData}
            />

            {/* Class Detail Modal */}
            {selectedClassDetail && (
                <ClassDetailModal
                    classInfo={selectedClassDetail}
                    onClose={() => setSelectedClassDetail(null)}
                    currentUser={currentUser}
                />
            )}

            {/* Student Detail Modal */}
            {selectedStudent && (
                <StudentDetailModal
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    readOnly={mode === 'view'}
                />
            )}
        </div>
    );
};

export default MathClassTab;
