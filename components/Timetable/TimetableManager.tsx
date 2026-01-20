import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { TimetableClass, Teacher, ClassKeywordColor, SubjectType } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { format, addDays, startOfWeek, addWeeks, subWeeks, getMonth, getYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import EnglishTimetable from './English/EnglishTimetable';
import TeacherOrderModal from './English/TeacherOrderModal';
import { useMathConfig } from './Math/hooks/useMathConfig';
import { useTimetableClasses } from './Math/hooks/useTimetableClasses';
import { useClassOperations } from './Math/hooks/useClassOperations';
import { useStudentDragDrop } from './Math/hooks/useStudentDragDrop';
import { useMathClassStudents } from './Math/hooks/useMathClassStudents';
import { useStudents } from '../../hooks/useStudents';
import { UnifiedStudent } from '../../types';
import TimetableHeader from './Math/components/TimetableHeader';
import AddClassModal from './Math/components/Modals/AddClassModal';
import TimetableGrid from './Math/components/TimetableGrid';
import ClassDetailModal from '../ClassManagement/ClassDetailModal';
import StudentDetailModal from '../StudentManagement/StudentDetailModal';
import SimpleViewSettingsModal from './Math/components/Modals/SimpleViewSettingsModal';
import { ClassInfo } from '../../hooks/useClasses';
import { ALL_WEEKDAYS, MATH_PERIODS, ENGLISH_PERIODS } from './constants';
import { MathSimulationProvider, useMathSimulation } from './Math/context/SimulationContext';

// Performance Note (bundle-dynamic-imports): Lazy load Generic Timetable
const GenericTimetable = lazy(() => import('./Generic/GenericTimetable'));



// Props interface for external filter control
interface TimetableManagerProps {
    subjectTab?: SubjectType;
    onSubjectChange?: (subject: SubjectType) => void;
    viewType?: 'teacher' | 'room' | 'class';
    onViewTypeChange?: (viewType: 'teacher' | 'room' | 'class') => void;
    showStudents?: boolean;
    onShowStudentsChange?: (show: boolean) => void;
    selectedDays?: string[];
    onSelectedDaysChange?: (days: string[]) => void;
    teachers?: Teacher[];  // Centralized from App.tsx
    classKeywords?: ClassKeywordColor[]; // For keyword color coding
    currentUser: any; // Using any for now to avoid circular dependency or import issues if common
    // 수학 뷰 모드 (날짜별/강사별)
    mathViewMode?: 'day-based' | 'teacher-based';
    onMathViewModeChange?: (mode: 'day-based' | 'teacher-based') => void;
}

const TimetableManager = ({
    subjectTab: externalSubjectTab,
    onSubjectChange,
    viewType: externalViewType,
    onViewTypeChange,
    showStudents: externalShowStudents,
    onShowStudentsChange,
    selectedDays: externalSelectedDays,
    onSelectedDaysChange,
    teachers: propsTeachers = [],
    classKeywords = [],
    currentUser,
    mathViewMode: externalMathViewMode,
    onMathViewModeChange,
}: TimetableManagerProps) => {
    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditMath = isMaster || hasPermission('timetable.math.edit');
    const canEditEnglish = isMaster || hasPermission('timetable.english.edit');
    const canEditScience = isMaster || hasPermission('timetable.science.edit');
    const canEditKorean = isMaster || hasPermission('timetable.korean.edit');
    const canViewMath = isMaster || hasPermission('timetable.math.view') || canEditMath;
    const canViewEnglish = isMaster || hasPermission('timetable.english.view') || canEditEnglish;
    const canViewScience = isMaster || hasPermission('timetable.science.view') || canEditScience;
    const canViewKorean = isMaster || hasPermission('timetable.korean.view') || canEditKorean;

    // Subject Tab (use external if provided)
    const [internalSubjectTab, setInternalSubjectTab] = useState<SubjectType>('math');
    const subjectTab = externalSubjectTab ?? internalSubjectTab;
    const setSubjectTab = onSubjectChange ?? setInternalSubjectTab;

    // Guard: Check if user has permission to view current subject
    if (!currentUser) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                로그인이 필요합니다.
            </div>
        );
    }

    if (subjectTab === 'math' && !canViewMath) {
        return (
            <div className="flex items-center justify-center h-full text-red-500">
                수학 시간표를 볼 수 있는 권한이 없습니다.
            </div>
        );
    }

    if (subjectTab === 'english' && !canViewEnglish) {
        return (
            <div className="flex items-center justify-center h-full text-red-500">
                영어 시간표를 볼 수 있는 권한이 없습니다.
            </div>
        );
    }

    if (subjectTab === 'science' && !canViewScience) {
        return (
            <div className="flex items-center justify-center h-full text-red-500">
                과학 시간표를 볼 수 있는 권한이 없습니다.
            </div>
        );
    }

    if (subjectTab === 'korean' && !canViewKorean) {
        return (
            <div className="flex items-center justify-center h-full text-red-500">
                국어 시간표를 볼 수 있는 권한이 없습니다.
            </div>
        );
    }

    // Hook Integration: Classes Data
    const { classes, loading: classesLoading } = useTimetableClasses();

    // Hook Integration: Unified Students
    const { students: globalStudents } = useStudents();

    // Create Student Lookup Map
    const studentMap = useMemo(() => {
        const map: Record<string, UnifiedStudent> = {};
        globalStudents.forEach(s => {
            map[s.id] = s;
        });
        return map;
    }, [globalStudents]);

    // teachers는 propsTeachers에서 받아서 수학 과목 필터링하여 사용
    const teachers = React.useMemo(() =>
        propsTeachers.filter(t => !t.subjects || t.subjects.includes('math')),
        [propsTeachers]);

    // Hook Integration: Math Config
    const {
        mathConfig,
        isTeacherOrderModalOpen,
        setIsTeacherOrderModalOpen,
        isWeekdayOrderModalOpen,
        setIsWeekdayOrderModalOpen,
        handleSaveTeacherOrder,
        handleSaveWeekdayOrder
    } = useMathConfig();

    // Hook Integration: Class Operations
    const {
        checkConsecutiveSchedule,
        addClass,
        updateClass,
        deleteClass,
        addStudent,
        removeStudent,
        withdrawStudent,
        restoreStudent
    } = useClassOperations();

    // Sorted Teachers based on saved order
    const sortedTeachers = useMemo(() => {
        const visibleTeachers = teachers.filter(t => !t.isHidden).map(t => t.name);
        if (mathConfig.teacherOrder.length === 0) {
            return visibleTeachers.sort((a, b) => a.localeCompare(b, 'ko'));
        }
        return [...visibleTeachers].sort((a, b) => {
            const indexA = mathConfig.teacherOrder.indexOf(a);
            const indexB = mathConfig.teacherOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b, 'ko');
        });
    }, [teachers, mathConfig.teacherOrder]);

    // Sorted Weekdays based on saved order
    const sortedWeekdays = useMemo(() => {
        if (mathConfig.weekdayOrder.length === 0) return ALL_WEEKDAYS;
        // Only return days that are in both order list and ALL_WEEKDAYS
        const orderedDays = mathConfig.weekdayOrder.filter(d => ALL_WEEKDAYS.includes(d));
        // Add any missing weekdays at the end
        const missingDays = ALL_WEEKDAYS.filter(d => !orderedDays.includes(d));
        return [...orderedDays, ...missingDays];
    }, [mathConfig.weekdayOrder]);

    // Save Math Config
    // Loading State
    const loading = classesLoading;

    // 로컬 스토리지 키 및 설정 로드 (다른 state보다 먼저 선언)
    const VIEW_SETTINGS_KEY = 'timetable_view_settings';
    const savedSettings = useMemo(() => {
        try {
            const saved = localStorage.getItem(VIEW_SETTINGS_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load view settings from localStorage:', e);
        }
        return null;
    }, []);

    // Week State (for date display)
    const [currentMonday, setCurrentMonday] = useState(() => {
        const today = new Date();
        return startOfWeek(today, { weekStartsOn: 1 }); // Monday as start
    });

    // View State (use external if provided)
    const [internalSelectedDays, setInternalSelectedDays] = useState<string[]>(
        savedSettings?.selectedDays || ['월', '화', '수', '목', '금']
    );
    const selectedDays = externalSelectedDays ?? internalSelectedDays;
    const setSelectedDays = onSelectedDaysChange ?? setInternalSelectedDays;

    const [internalViewType, setInternalViewType] = useState<'teacher' | 'room' | 'class'>('teacher');
    const viewType = externalViewType ?? internalViewType;
    const setViewType = onViewTypeChange ?? setInternalViewType;

    // 조회/수정 모드 상태
    const [mode, setMode] = useState<'view' | 'edit'>('view');

    const [isAddClassOpen, setIsAddClassOpen] = useState(false);
    const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<TimetableClass | null>(null);
    const [selectedClassInfo, setSelectedClassInfo] = useState<ClassInfo | null>(null);
    const [selectedStudentForModal, setSelectedStudentForModal] = useState<UnifiedStudent | null>(null);

    const [internalShowStudents, setInternalShowStudents] = useState(savedSettings?.showStudents ?? true);
    const showStudents = externalShowStudents ?? internalShowStudents;
    const setShowStudents = onShowStudentsChange ?? setInternalShowStudents;

    // New Class Form
    const [newClassName, setNewClassName] = useState('');
    const [newTeacher, setNewTeacher] = useState('');
    const [newRoom, setNewRoom] = useState('');
    const [newSubject, setNewSubject] = useState('수학');
    const [newSchedule, setNewSchedule] = useState<string[]>([]);

    // Timetable View Mode: 'day-based' (월화수목금토일) vs 'teacher-based' (월목/화금/주말/수요일)
    const [internalTimetableViewMode, setInternalTimetableViewMode] = useState<'day-based' | 'teacher-based'>(
        savedSettings?.timetableViewMode || 'teacher-based'
    );
    const timetableViewMode = externalMathViewMode ?? internalTimetableViewMode;
    const setTimetableViewMode = onMathViewModeChange ?? setInternalTimetableViewMode;
    const [showClassName, setShowClassName] = useState(savedSettings?.showClassName ?? true);
    const [showSchool, setShowSchool] = useState(savedSettings?.showSchool ?? false);
    const [showGrade, setShowGrade] = useState(savedSettings?.showGrade ?? true);
    const [showEmptyRooms, setShowEmptyRooms] = useState(savedSettings?.showEmptyRooms ?? false);
    const [columnWidth, setColumnWidth] = useState<'compact' | 'narrow' | 'normal' | 'wide' | 'x-wide'>(
        savedSettings?.columnWidth || 'normal'
    );
    const [rowHeight, setRowHeight] = useState<'compact' | 'short' | 'normal' | 'tall' | 'very-tall'>(
        savedSettings?.rowHeight || 'normal'
    );
    const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large'>(
        savedSettings?.fontSize || 'normal'
    );
    const [showHoldStudents, setShowHoldStudents] = useState(savedSettings?.showHoldStudents ?? true);
    const [showWithdrawnStudents, setShowWithdrawnStudents] = useState(savedSettings?.showWithdrawnStudents ?? true);

    // 뷰 설정이 변경될 때마다 로컬 스토리지에 저장
    useEffect(() => {
        const settings = {
            timetableViewMode,
            showClassName,
            showSchool,
            showGrade,
            showEmptyRooms,
            columnWidth,
            rowHeight,
            fontSize,
            showStudents: internalShowStudents,
            selectedDays: internalSelectedDays,
            showHoldStudents,
            showWithdrawnStudents
        };
        try {
            localStorage.setItem(VIEW_SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save view settings to localStorage:', e);
        }
    }, [timetableViewMode, showClassName, showSchool, showGrade, showEmptyRooms, columnWidth, rowHeight, fontSize, internalShowStudents, internalSelectedDays, showHoldStudents, showWithdrawnStudents]);

    // Hook Integration: Drag & Drop
    const {
        localClasses,
        pendingMoves,
        isSaving,
        draggingStudent,
        dragOverClassId,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleSavePendingMoves,
        handleCancelPendingMoves
    } = useStudentDragDrop(classes);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Reset viewType when switching to math - math only supports 'teacher' view
    useEffect(() => {
        if (subjectTab === 'math' && (viewType === 'class' || viewType === 'room')) {
            setViewType('teacher');
        }
    }, [subjectTab, viewType, setViewType]);

    // Current periods based on subject tab
    const currentPeriods = subjectTab === 'math' ? MATH_PERIODS : ENGLISH_PERIODS;
    const currentSubjectFilter = subjectTab === 'math' ? '수학' : '영어';

    // Selected days ordered by sortedWeekdays order
    const orderedSelectedDays = useMemo(() => {
        return sortedWeekdays.filter(day => selectedDays.includes(day));
    }, [selectedDays, sortedWeekdays]);

    // Calculate dates for each weekday
    const weekDates = useMemo(() => {
        const dates: Record<string, { date: Date; formatted: string }> = {};
        ALL_WEEKDAYS.forEach((day, idx) => {
            const date = addDays(currentMonday, idx);
            dates[day] = {
                date,
                formatted: format(date, 'M/d', { locale: ko })
            };
        });
        return dates;
    }, [currentMonday]);

    // Week navigation
    const goToPrevWeek = () => setCurrentMonday(prev => subWeeks(prev, 1));
    const goToNextWeek = () => setCurrentMonday(prev => addWeeks(prev, 1));
    const goToThisWeek = () => setCurrentMonday(startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Week label (e.g., "2025년 12월 4주차 (16일~22일)")
    const weekLabel = useMemo(() => {
        const year = getYear(currentMonday);
        const month = getMonth(currentMonday) + 1; // 0-indexed
        const weekOfMonth = Math.ceil((currentMonday.getDate() + new Date(year, getMonth(currentMonday), 1).getDay()) / 7);
        const sunday = addDays(currentMonday, 6);
        const startDay = currentMonday.getDate();
        const endDay = sunday.getDate();
        const endMonth = getMonth(sunday) + 1;

        // 같은 달이면 "16일~22일", 다른 달이면 "29일~1/4일"
        const dateRange = month === endMonth
            ? `${startDay}일~${endDay}일`
            : `${startDay}일~${endMonth}/${endDay}일`;

        return `${year}년 ${month}월 ${weekOfMonth}주차 (${dateRange})`;
    }, [currentMonday]);

    // Subscribe to Classes
    // Classes subscription handled by useTimetableClasses hook

    // NOTE: Teachers list is now passed as props from App.tsx (centralized subscription)

    // Filter classes by current subject (use localClasses for pending moves)
    const mathClasses = useMemo(() => {
        return localClasses.filter(c => c.subject === '수학');
    }, [localClasses]);

    // Get class names for math classes (for useMathClassStudents)
    const mathClassNames = useMemo(() => {
        return mathClasses.map(c => c.className);
    }, [mathClasses]);

    // Fetch student data from enrollments for math classes
    const { classDataMap: mathClassDataMap } = useMathClassStudents(mathClassNames, studentMap);

    // Merge enrollment-based student data into math classes
    const filteredClasses = useMemo(() => {
        if (currentSubjectFilter === '수학') {
            return mathClasses.map(cls => {
                const enrollmentData = mathClassDataMap[cls.className];
                if (enrollmentData) {
                    return {
                        ...cls,
                        studentList: enrollmentData.studentList,
                        studentIds: enrollmentData.studentIds,
                    };
                }
                return cls;
            });
        }
        return localClasses.filter(c => c.subject === currentSubjectFilter);
    }, [localClasses, currentSubjectFilter, mathClasses, mathClassDataMap]);

    // Compute resources (all teachers from state, filtered by hidden)
    const allResources = useMemo(() => {
        if (viewType === 'teacher') {
            // Show all visible teachers in saved order
            return sortedTeachers;
        }
        return [...new Set(filteredClasses.map(c => c.room).filter(Boolean))].sort();
    }, [viewType, filteredClasses, sortedTeachers]);



    // checkConsecutiveSchedule moved to useClassOperations hook

    // Add new class
    const handleAddClass = async () => {
        try {
            await addClass(classes, {
                className: newClassName,
                teacher: newTeacher,
                room: newRoom,
                subject: newSubject,
                schedule: newSchedule
            }, currentPeriods);

            setNewClassName('');
            setNewTeacher('');
            setNewRoom('');
            setNewSubject(currentSubjectFilter);
            setNewSchedule([]);
            setIsAddClassOpen(false);
        } catch (e: any) {
            console.error(e);
            alert(e.message || '수업 추가 실패');
        }
    };

    // Drag handlers moved to useStudentDragDrop hook

    const toggleScheduleSlot = (day: string, period: string) => {
        const slot = `${day} ${period}`;
        setNewSchedule(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
    };

    const openAddModal = () => {
        setNewSubject(currentSubjectFilter);
        setNewSchedule([]);
        setIsAddClassOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#fdb813] border-t-transparent"></div>
            </div>
        );
    }

    if (subjectTab === 'english') {
        return <EnglishTimetable
            onSwitchToMath={() => setSubjectTab('math')}
            viewType={viewType}
            teachers={propsTeachers}
            classKeywords={classKeywords}
            currentUser={currentUser}
            studentMap={studentMap} // Pass global student map
        />;
    }

    // Performance Note (async-suspense-boundaries): Generic Timetable with Suspense
    if (subjectTab === 'science') {
        return (
            <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">과학 시간표 로딩 중...</div>
                </div>
            }>
                <GenericTimetable
                    subject="science"
                    currentUser={currentUser}
                    viewType={viewType}
                    onStudentsUpdated={() => {
                        // Refresh logic if needed
                    }}
                />
            </Suspense>
        );
    }

    if (subjectTab === 'korean') {
        return (
            <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">국어 시간표 로딩 중...</div>
                </div>
            }>
                <GenericTimetable
                    subject="korean"
                    currentUser={currentUser}
                    viewType={viewType}
                    onStudentsUpdated={() => {
                        // Refresh logic if needed
                    }}
                />
            </Suspense>
        );
    }

    // Math Timetable Inner Component (uses simulation context)
    const MathTimetableContent = () => {
        const simulation = useMathSimulation();
        const { isSimulationMode, enterSimulationMode, exitSimulationMode, loadFromLive, publishToLive, setCurrentScenarioName } = simulation;
        const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
        const [loading, setLoading] = useState(false);

        const handleToggleSimulation = async () => {
            if (isSimulationMode) {
                exitSimulationMode();
            } else {
                setLoading(true);
                try {
                    await enterSimulationMode();
                } catch (e) {
                    console.error('시뮬레이션 모드 진입 실패:', e);
                    alert('시뮬레이션 모드 진입에 실패했습니다.');
                } finally {
                    setLoading(false);
                }
            }
        };

        const handleCopyLiveToDraft = async () => {
            if (!confirm('현재 실시간 시간표를 복사해 오시겠습니까?\n기존 시뮬레이션 작업 내용은 모두 사라집니다.')) return;
            setLoading(true);
            try {
                await loadFromLive();
                alert('✅ 현재 시간표를 가져왔습니다.');
            } catch (e) {
                console.error('복사 실패:', e);
                alert('복사 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        const handlePublishDraftToLive = async () => {
            if (!confirm('⚠️ 시뮬레이션 내용을 실제 시간표에 반영하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
            setLoading(true);
            try {
                await publishToLive(currentUser.uid, currentUser.displayName || currentUser.email);
                alert('✅ 실제 시간표에 반영되었습니다.');
            } catch (e) {
                console.error('반영 실패:', e);
                alert('반영 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#fdb813] border-t-transparent"></div>
                </div>
            );
        }

        return (
            <>
                <div className="bg-white shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
                    {/* Header Component */}
                    <TimetableHeader
                        weekLabel={weekLabel}
                        goToPrevWeek={goToPrevWeek}
                        goToNextWeek={goToNextWeek}
                        goToThisWeek={goToThisWeek}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        viewType={viewType}
                        setIsTeacherOrderModalOpen={setIsTeacherOrderModalOpen}
                        setIsViewSettingsOpen={setIsViewSettingsOpen}
                        pendingMovesCount={pendingMoves.length}
                        handleSavePendingMoves={handleSavePendingMoves}
                        handleCancelPendingMoves={handleCancelPendingMoves}
                        isSaving={isSaving}
                        mode={mode}
                        setMode={setMode}
                        canEdit={canEditMath}
                        isSimulationMode={isSimulationMode}
                        onToggleSimulation={handleToggleSimulation}
                        onCopyLiveToDraft={handleCopyLiveToDraft}
                        onPublishDraftToLive={handlePublishDraftToLive}
                        onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
                    />

            {/* Timetable Grid - 외부 스크롤 제거, 내부 그리드 스크롤만 사용 */}
            <div className="flex-1 overflow-hidden border-t border-gray-200 p-4">
                <TimetableGrid
                    filteredClasses={filteredClasses}
                    allResources={allResources}
                    orderedSelectedDays={orderedSelectedDays}
                    weekDates={weekDates}
                    viewType={viewType}
                    currentPeriods={currentPeriods}
                    teachers={teachers}
                    searchQuery={searchQuery}
                    canEdit={canEditMath}
                    mode={mode}
                    columnWidth={columnWidth}
                    rowHeight={rowHeight}
                    fontSize={fontSize}
                    showClassName={showClassName}
                    showSchool={showSchool}
                    showGrade={showGrade}
                    showEmptyRooms={showEmptyRooms}
                    showStudents={showStudents}
                    showHoldStudents={showHoldStudents}
                    showWithdrawnStudents={showWithdrawnStudents}
                    dragOverClassId={dragOverClassId}
                    onClassClick={(cls) => {
                        if (!canEditMath) return;
                        // TimetableClass -> ClassInfo 변환
                        const classInfo: ClassInfo = {
                            className: cls.className,
                            subject: cls.subject === '수학' ? 'math' : 'english',
                            teacher: cls.teacher,
                            room: cls.room,
                            schedule: cls.schedule,
                            studentCount: cls.studentIds?.length || cls.studentList?.length || 0,
                        };
                        setSelectedClassInfo(classInfo);
                    }}
                    onDragStart={(e, sId, cId) => canEditMath && handleDragStart(e, sId, cId)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    currentSubjectFilter={currentSubjectFilter}
                    studentMap={studentMap}
                    timetableViewMode={timetableViewMode}
                    classKeywords={classKeywords}
                    onStudentClick={(studentId) => {
                        const student = studentMap[studentId];
                        if (student) {
                            setSelectedStudentForModal(student);
                        }
                    }}
                />
            </div>

            {/* Add Class Modal */}
            <AddClassModal
                isOpen={isAddClassOpen}
                onClose={() => setIsAddClassOpen(false)}
                newClassName={newClassName}
                setNewClassName={setNewClassName}
                newTeacher={newTeacher}
                setNewTeacher={setNewTeacher}
                newRoom={newRoom}
                setNewRoom={setNewRoom}
                newSubject={newSubject}
                setNewSubject={setNewSubject}
                newSchedule={newSchedule}
                toggleScheduleSlot={toggleScheduleSlot}
                handleAddClass={handleAddClass}
                teacherNames={sortedTeachers}
            />

            {/* Class Detail Modal - 수업 관리와 동일한 상세 모달 사용 */}
            {selectedClassInfo && (
                <ClassDetailModal
                    classInfo={selectedClassInfo}
                    onClose={() => setSelectedClassInfo(null)}
                />
            )}

            {/* Student Detail Modal - 학생 클릭 시 표시 */}
            {selectedStudentForModal && (
                <StudentDetailModal
                    student={selectedStudentForModal}
                    onClose={() => setSelectedStudentForModal(null)}
                    readOnly={subjectTab !== 'math' || mode === 'view'}
                />
            )}

            {/* Teacher Order Modal (Math) */}
            <TeacherOrderModal
                isOpen={isTeacherOrderModalOpen}
                onClose={() => setIsTeacherOrderModalOpen(false)}
                currentOrder={mathConfig.teacherOrder}
                allTeachers={sortedTeachers}
                onSave={handleSaveTeacherOrder}
            />

            {/* View Settings Modal (Math) */}
            <SimpleViewSettingsModal
                isOpen={isViewSettingsOpen}
                onClose={() => setIsViewSettingsOpen(false)}
                columnWidth={columnWidth}
                setColumnWidth={setColumnWidth}
                rowHeight={rowHeight}
                setRowHeight={setRowHeight}
                fontSize={fontSize}
                setFontSize={setFontSize}
                selectedDays={selectedDays}
                setSelectedDays={setSelectedDays}
                showStudents={showStudents}
                setShowStudents={setShowStudents}
                showClassName={showClassName}
                setShowClassName={setShowClassName}
                showSchool={showSchool}
                setShowSchool={setShowSchool}
                showGrade={showGrade}
                setShowGrade={setShowGrade}
            />

            {/* Scenario Management Modal */}
            {/* TODO: Create Math-specific ScenarioManagementModal */}
            {isScenarioModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setIsScenarioModalOpen(false)} />
                    <div className="relative bg-white rounded-lg p-6 max-w-md">
                        <h3 className="text-lg font-bold mb-4">시나리오 관리</h3>
                        <p className="text-gray-600 mb-4">수학 시나리오 관리 기능은 개발 중입니다.</p>
                        <button
                            onClick={() => setIsScenarioModalOpen(false)}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
                </div>
            </>
        );
    };

    return (
        <MathSimulationProvider>
            <MathTimetableContent />
        </MathSimulationProvider>
    );
};

export default TimetableManager;
