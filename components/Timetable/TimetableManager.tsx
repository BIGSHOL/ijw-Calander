import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, updateDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { TimetableClass, Teacher, TimetableStudent, ClassKeywordColor } from '../../types';
import { Plus, Trash2, Users, Clock, BookOpen, X, UserPlus, GripVertical, ChevronLeft, ChevronRight, Search, Settings, Filter, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { format, addDays, startOfWeek, addWeeks, subWeeks, getWeek, getMonth, getYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import EnglishTimetable from './English/EnglishTimetable';
import TeacherOrderModal from './English/TeacherOrderModal';
import MathStudentModal from './Math/MathStudentModal';
import { useMathConfig } from './Math/hooks/useMathConfig';
import { useTimetableClasses } from './Math/hooks/useTimetableClasses';
import { useClassOperations } from './Math/hooks/useClassOperations';
import { useStudentDragDrop } from './Math/hooks/useStudentDragDrop';
import { useStudents } from '../../hooks/useStudents'; // Unified Student Hook
import { UnifiedStudent } from '../../types';
import TimetableHeader from './Math/components/TimetableHeader';
import AddClassModal from './Math/components/Modals/AddClassModal';
import ClassDetailModal from './Math/components/Modals/ClassDetailModal';
import ViewSettingsModal from './Math/components/Modals/ViewSettingsModal';
import TimetableGrid from './Math/components/TimetableGrid';
import { ALL_WEEKDAYS, MATH_PERIODS, MATH_PERIOD_TIMES, ENGLISH_PERIODS } from './constants';



// Props interface for external filter control
interface TimetableManagerProps {
    subjectTab?: 'math' | 'english';
    onSubjectChange?: (subject: 'math' | 'english') => void;
    viewType?: 'teacher' | 'room' | 'class';
    onViewTypeChange?: (viewType: 'teacher' | 'room' | 'class') => void;
    showStudents?: boolean;
    onShowStudentsChange?: (show: boolean) => void;
    selectedDays?: string[];
    onSelectedDaysChange?: (days: string[]) => void;
    teachers?: Teacher[];  // Centralized from App.tsx
    classKeywords?: ClassKeywordColor[]; // For keyword color coding
    currentUser: any; // Using any for now to avoid circular dependency or import issues if common
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
}: TimetableManagerProps) => {
    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditMath = isMaster || hasPermission('timetable.math.edit');
    const canEditEnglish = isMaster || hasPermission('timetable.english.edit');
    // Subject Tab (use external if provided)
    const [internalSubjectTab, setInternalSubjectTab] = useState<'math' | 'english'>('math');
    const subjectTab = externalSubjectTab ?? internalSubjectTab;
    const setSubjectTab = onSubjectChange ?? setInternalSubjectTab;

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

    const [isAddClassOpen, setIsAddClassOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<TimetableClass | null>(null);

    const [internalShowStudents, setInternalShowStudents] = useState(savedSettings?.showStudents ?? true);
    const showStudents = externalShowStudents ?? internalShowStudents;
    const setShowStudents = onShowStudentsChange ?? setInternalShowStudents;

    // New Class Form
    const [newClassName, setNewClassName] = useState('');
    const [newTeacher, setNewTeacher] = useState('');
    const [newRoom, setNewRoom] = useState('');
    const [newSubject, setNewSubject] = useState('수학');
    const [newSchedule, setNewSchedule] = useState<string[]>([]);

    // Edit Class States
    const [isEditingClass, setIsEditingClass] = useState(false);
    const [editRoom, setEditRoom] = useState('');
    const [editSchedule, setEditSchedule] = useState<string[]>([]);

    // Reset edit state when selected class changes
    useEffect(() => {
        if (selectedClass) {
            setEditRoom(selectedClass.room);
            setEditSchedule(selectedClass.schedule || []);
            setIsEditingClass(false);
        }
    }, [selectedClass]);

    const toggleEditScheduleSlot = (day: string, period: string) => {
        const slot = `${day} ${period}`;
        setEditSchedule(prev =>
            prev.includes(slot)
                ? prev.filter(s => s !== slot)
                : [...prev, slot]
        );
    };

    const handleUpdateClass = async () => {
        if (!selectedClass) return;

        try {
            await updateClass(selectedClass.id, {
                room: editRoom,
                schedule: editSchedule
            }, currentPeriods);

            // Update local state immediately for better UX
            setSelectedClass({
                ...selectedClass,
                room: editRoom,
                schedule: editSchedule
            });
            setIsEditingClass(false);
        } catch (error: any) {
            console.error('Error updating class:', error);
            alert(error.message || '수업 수정 중 오류가 발생했습니다.');
        }
    };

    // New Student Form
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentGrade, setNewStudentGrade] = useState('');
    const [newStudentSchool, setNewStudentSchool] = useState('');

    // View Settings State
    const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);

    // Timetable View Mode: 'day-based' (월화수목금토일) vs 'teacher-based' (월목/화금/주말/수요일)
    const [timetableViewMode, setTimetableViewMode] = useState<'day-based' | 'teacher-based'>(
        savedSettings?.timetableViewMode || 'teacher-based'
    );
    const [showClassName, setShowClassName] = useState(savedSettings?.showClassName ?? true);
    const [showSchool, setShowSchool] = useState(savedSettings?.showSchool ?? false);
    const [showGrade, setShowGrade] = useState(savedSettings?.showGrade ?? true);
    const [showEmptyRooms, setShowEmptyRooms] = useState(savedSettings?.showEmptyRooms ?? false);
    const [columnWidth, setColumnWidth] = useState<'narrow' | 'normal' | 'wide'>(
        savedSettings?.columnWidth || 'normal'
    );
    const [rowHeight, setRowHeight] = useState<'short' | 'normal' | 'tall' | 'very-tall'>(
        savedSettings?.rowHeight || 'normal'
    );
    const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large' | 'very-large'>(
        savedSettings?.fontSize || 'normal'
    );

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
            selectedDays: internalSelectedDays
        };
        try {
            localStorage.setItem(VIEW_SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save view settings to localStorage:', e);
        }
    }, [timetableViewMode, showClassName, showSchool, showGrade, showEmptyRooms, columnWidth, rowHeight, fontSize, internalShowStudents, internalSelectedDays]);

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

    // Reset viewType when switching to math if it's 'class' (통합 뷰는 영어만 지원)
    useEffect(() => {
        if (subjectTab === 'math' && viewType === 'class') {
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
    const filteredClasses = useMemo(() => {
        return localClasses.filter(c => c.subject === currentSubjectFilter);
    }, [localClasses, currentSubjectFilter]);

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

    // Delete class
    const handleDeleteClass = async (classId: string) => {
        if (!confirm('이 수업을 삭제하시겠습니까?')) return;
        try {
            await deleteClass(classId);
            setSelectedClass(null);
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
    };

    // Add student to class
    const handleAddStudent = async () => {
        if (!selectedClass) return;
        try {
            // Note: addStudent returns updated IDs
            const updatedIds = await addStudent(selectedClass.id, selectedClass.studentIds || [], {
                name: newStudentName,
                grade: newStudentGrade,
                school: newStudentSchool
            });
            setNewStudentName('');
            setNewStudentGrade('');
            setNewStudentSchool('');
            setSelectedClass({ ...selectedClass, studentIds: updatedIds });
        } catch (e: any) {
            console.error(e);
            alert(e.message || '학생 추가 실패');
        }
    };

    // 학생 퇴원
    const handleWithdrawal = async (studentId: string) => {
        if (!selectedClass || !window.confirm("퇴원 처리 하시겠습니까?")) return;
        try {
            // Returns current IDs (no change in list, but student status updated)
            await withdrawStudent(selectedClass.id, selectedClass.studentIds, studentId);
            // Trigger UI update if needed (listener might handle this, but force update logic ok)
            // Ideally useTimetableClasses updates classes, and globalStudents updates status
        } catch (e) {
            console.error(e);
            alert('퇴원 처리 실패');
        }
    };

    // 학생 퇴원 취소 (복구)
    const handleRestoreStudent = async (studentId: string) => {
        if (!selectedClass) return;
        try {
            await restoreStudent(selectedClass.id, selectedClass.studentIds, studentId);
        } catch (e) {
            console.error(e);
            alert('복구 실패');
        }
    };

    // 학생 삭제 (완전 삭제)
    const handleRemoveStudent = async (studentId: string) => {
        if (!selectedClass) return;
        if (!confirm('이 학생을 수업에서 제거하시겠습니까?')) return;
        try {
            const updatedIds = await removeStudent(selectedClass.id, selectedClass.studentIds, studentId);
            setSelectedClass({ ...selectedClass, studentIds: updatedIds as string[] });
        } catch (e) {
            console.error(e);
            alert('학생 제거 실패');
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

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
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
            />

            {/* Timetable Grid */}
            <div className="flex-1 overflow-auto border-t border-gray-200 p-4">
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
                    columnWidth={columnWidth}
                    rowHeight={rowHeight}
                    fontSize={fontSize}
                    showClassName={showClassName}
                    showSchool={showSchool}
                    showGrade={showGrade}
                    showEmptyRooms={showEmptyRooms}
                    showStudents={showStudents}
                    dragOverClassId={dragOverClassId}
                    onClassClick={(cls) => canEditMath && setSelectedClass(cls)}
                    onDragStart={(e, sId, cId) => canEditMath && handleDragStart(e, sId, cId)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    currentSubjectFilter={currentSubjectFilter}
                    studentMap={studentMap}
                    timetableViewMode={timetableViewMode}
                    classKeywords={classKeywords}
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

            {/* Class Detail Modal */}
            <ClassDetailModal
                selectedClass={selectedClass}
                onClose={() => setSelectedClass(null)}
                isEditingClass={isEditingClass}
                setIsEditingClass={setIsEditingClass}
                editRoom={editRoom}
                setEditRoom={setEditRoom}
                editSchedule={editSchedule}
                toggleEditScheduleSlot={toggleEditScheduleSlot}
                handleUpdateClass={handleUpdateClass}
                handleDeleteClass={handleDeleteClass}
                newStudentName={newStudentName}
                setNewStudentName={setNewStudentName}
                newStudentSchool={newStudentSchool}
                setNewStudentSchool={setNewStudentSchool}
                newStudentGrade={newStudentGrade}
                setNewStudentGrade={setNewStudentGrade}
                handleAddStudent={handleAddStudent}
                handleRemoveStudent={handleRemoveStudent}
                handleWithdrawal={handleWithdrawal}
                handleRestoreStudent={handleRestoreStudent}
                handleDragStart={handleDragStart}
                studentMap={studentMap}
            />

            {/* View Settings Modal (통합 설정) */}
            <ViewSettingsModal
                isOpen={isViewSettingsOpen}
                onClose={() => setIsViewSettingsOpen(false)}
                columnWidth={columnWidth}
                setColumnWidth={setColumnWidth}
                rowHeight={rowHeight}
                setRowHeight={setRowHeight}
                fontSize={fontSize}
                setFontSize={setFontSize}
                showClassName={showClassName}
                setShowClassName={setShowClassName}
                showSchool={showSchool}
                setShowSchool={setShowSchool}
                showGrade={showGrade}
                setShowGrade={setShowGrade}
                showEmptyRooms={showEmptyRooms}
                setShowEmptyRooms={setShowEmptyRooms}
                showStudents={showStudents}
                setShowStudents={setShowStudents}
                selectedDays={selectedDays}
                setSelectedDays={setSelectedDays}
                timetableViewMode={timetableViewMode}
                setTimetableViewMode={setTimetableViewMode}
                viewType={viewType}
            />

            {/* Teacher Order Modal (Math) */}
            <TeacherOrderModal
                isOpen={isTeacherOrderModalOpen}
                onClose={() => setIsTeacherOrderModalOpen(false)}
                currentOrder={mathConfig.teacherOrder}
                allTeachers={sortedTeachers}
                onSave={handleSaveTeacherOrder}
            />
        </div >
    );
};

export default TimetableManager;
