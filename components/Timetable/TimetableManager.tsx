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
import WeekdayOrderModal from './WeekdayOrderModal';
import MathStudentModal from './Math/MathStudentModal';
import { useMathConfig } from './Math/hooks/useMathConfig';
import { useTimetableClasses } from './Math/hooks/useTimetableClasses';
import { useClassOperations } from './Math/hooks/useClassOperations';
import { useStudentDragDrop } from './Math/hooks/useStudentDragDrop';

// Constants
const ALL_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const MATH_PERIODS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];
const MATH_PERIOD_TIMES: Record<string, string> = {
    '1-1': '14:30~15:25',
    '1-2': '15:25~16:20',
    '2-1': '16:20~17:15',
    '2-2': '17:15~18:10',
    '3-1': '18:20~19:15',
    '3-2': '19:15~20:10',
    '4-1': '20:10~21:05',
    '4-2': '21:05~22:00',
};
const ENGLISH_PERIODS = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시', '8교시'];

// Subject Theme Colors
const getSubjectTheme = (subject: string) => {
    switch (subject) {
        case '수학':
            return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', header: 'bg-blue-600 text-white' };
        case '영어':
            return { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', header: 'bg-rose-600 text-white' };
        case '국어':
            return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', header: 'bg-green-600 text-white' };
        case '과학':
            return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', header: 'bg-purple-600 text-white' };
        default:
            return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', header: 'bg-gray-600 text-white' };
    }
};

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
    // Subject Tab (use external if provided)
    const [internalSubjectTab, setInternalSubjectTab] = useState<'math' | 'english'>('math');
    const subjectTab = externalSubjectTab ?? internalSubjectTab;
    const setSubjectTab = onSubjectChange ?? setInternalSubjectTab;

    // Hook Integration: Classes Data
    const { classes, loading: classesLoading } = useTimetableClasses();

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

    // Week State (for date display)
    const [currentMonday, setCurrentMonday] = useState(() => {
        const today = new Date();
        return startOfWeek(today, { weekStartsOn: 1 }); // Monday as start
    });

    // View State (use external if provided)
    const [internalSelectedDays, setInternalSelectedDays] = useState<string[]>(['월', '화', '수', '목', '금']);
    const selectedDays = externalSelectedDays ?? internalSelectedDays;
    const setSelectedDays = onSelectedDaysChange ?? setInternalSelectedDays;

    const [internalViewType, setInternalViewType] = useState<'teacher' | 'room' | 'class'>('teacher');
    const viewType = externalViewType ?? internalViewType;
    const setViewType = onViewTypeChange ?? setInternalViewType;

    const [isAddClassOpen, setIsAddClassOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<TimetableClass | null>(null);

    const [isOptionOpen, setIsOptionOpen] = useState(false); // Local option popover state

    const [internalShowStudents, setInternalShowStudents] = useState(true);
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
    const [showClassName, setShowClassName] = useState(true);
    const [showSchool, setShowSchool] = useState(false);
    const [showGrade, setShowGrade] = useState(true);
    const [showEmptyRooms, setShowEmptyRooms] = useState(false);
    const [columnWidth, setColumnWidth] = useState<'narrow' | 'normal' | 'wide'>('normal');
    const [rowHeight, setRowHeight] = useState<'short' | 'normal' | 'tall' | 'very-tall'>('normal');
    const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large' | 'very-large'>('normal');

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

    // Week label (e.g., "2025년 12월 4주차")
    const weekLabel = useMemo(() => {
        const year = getYear(currentMonday);
        const month = getMonth(currentMonday) + 1; // 0-indexed
        const weekOfMonth = Math.ceil((currentMonday.getDate() + new Date(year, getMonth(currentMonday), 1).getDay()) / 7);
        return `${year}년 ${month}월 ${weekOfMonth}주차`;
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

    // Get classes for cell
    const getClassesForCell = (day: string, period: string, resource: string) => {
        return filteredClasses.filter(cls => {
            const resourceMatch = viewType === 'teacher' ? cls.teacher === resource : cls.room === resource;
            // Use exact match: "월 2-1" format
            const targetSlot = `${day} ${period}`;
            const scheduleMatch = cls.schedule?.some(s => s === targetSlot);
            return resourceMatch && scheduleMatch;
        });
    };

    // Calculate how many consecutive periods a class spans starting from given period
    const getConsecutiveSpan = (cls: TimetableClass, day: string, startPeriodIndex: number): number => {
        const periods = currentPeriods;
        let span = 1;
        for (let i = startPeriodIndex + 1; i < periods.length; i++) {
            const nextPeriod = periods[i];
            const targetSlot = `${day} ${nextPeriod}`;
            const hasNextSlot = cls.schedule?.some(s => s === targetSlot);

            // Check if next slot is "pure" (only contains this class)
            // If next slot has other classes, we must break the span to allow displaying them
            const resource = viewType === 'teacher' ? cls.teacher : cls.room;
            const classesInNextSlot = getClassesForCell(day, nextPeriod, resource);
            const isNextSlotDirty = classesInNextSlot.some(c => c.id !== cls.id);

            if (hasNextSlot && !isNextSlotDirty) {
                span++;
            } else {
                break;
            }
        }
        return span;
    };

    // Check if this cell should be skipped (already covered by a rowspan from above)
    const shouldSkipCell = (cls: TimetableClass, day: string, periodIndex: number, currentCellClasses: TimetableClass[]): boolean => {
        // If current cell has multiple classes (conflict), NEVER skip. Show all.
        if (currentCellClasses.length > 1) return false;

        const periods = currentPeriods;
        // Look backwards to see if any previous consecutive period started a rowspan that covers this cell
        for (let i = periodIndex - 1; i >= 0; i--) {
            const prevPeriod = periods[i];
            const targetSlot = `${day} ${prevPeriod}`;
            const hasPrevSlot = cls.schedule?.some(s => s === targetSlot);

            if (hasPrevSlot) {
                // Check if the PREVIOUS cell was "dirty". If it was dirty, it couldn't have spanned to here.
                const resource = viewType === 'teacher' ? cls.teacher : cls.room;
                const classesInPrevSlot = getClassesForCell(day, prevPeriod, resource);
                const isPrevSlotDirty = classesInPrevSlot.some(c => c.id !== cls.id);

                if (isPrevSlotDirty) {
                    // Previous slot had conflict, so it didn't span. We are the start of new segment.
                    return false;
                }

                // Previous period has this class and was pure, so this cell is covered
                return true;
            } else {
                // Break in the chain, so this is a new start
                break;
            }
        }
        return false;
    };

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
            const updatedList = await addStudent(selectedClass.id, selectedClass.studentList || [], {
                name: newStudentName,
                grade: newStudentGrade,
                school: newStudentSchool
            });
            setNewStudentName('');
            setNewStudentGrade('');
            setNewStudentSchool('');
            setSelectedClass({ ...selectedClass, studentList: updatedList });
        } catch (e: any) {
            console.error(e);
            alert(e.message || '학생 추가 실패');
        }
    };

    // 학생 퇴원
    const handleWithdrawal = async (studentId: string) => {
        if (!selectedClass || !window.confirm("퇴원 처리 하시겠습니까?")) return;
        try {
            const updatedList = await withdrawStudent(selectedClass.id, selectedClass.studentList, studentId);
            setSelectedClass({ ...selectedClass, studentList: updatedList });
        } catch (e) {
            console.error(e);
            alert('퇴원 처리 실패');
        }
    };

    // 학생 퇴원 취소 (복구)
    const handleRestoreStudent = async (studentId: string) => {
        if (!selectedClass) return;
        try {
            const updatedList = await restoreStudent(selectedClass.id, selectedClass.studentList, studentId);
            setSelectedClass({ ...selectedClass, studentList: updatedList });
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
            const updatedList = await removeStudent(selectedClass.id, selectedClass.studentList, studentId);
            setSelectedClass({ ...selectedClass, studentList: updatedList });
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

    // 영어 탭이면 EnglishTimetable 컴포넌트 렌더링
    if (subjectTab === 'english') {
        return <EnglishTimetable
            onSwitchToMath={() => setSubjectTab('math')}
            viewType={viewType}
            teachers={propsTeachers}
            classKeywords={classKeywords}
            currentUser={currentUser}
        />;
    }

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
            {/* Simple Toolbar - Search and Actions only */}
            <div className="bg-gray-50 h-10 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0 text-xs">
                {/* Left: Week Info */}
                <div className="flex items-center gap-3">
                    <span className="text-gray-600 font-medium">{weekLabel}</span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={goToPrevWeek}
                            className="p-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <button
                            onClick={goToThisWeek}
                            className="px-2 py-0.5 text-[10px] font-bold border border-gray-300 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            이번주
                        </button>
                        <button
                            onClick={goToNextWeek}
                            className="p-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>

                {/* Right: Search and Actions */}
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="학생 검색..."
                            className="pl-7 pr-6 py-1 w-32 text-xs border border-gray-300 rounded-md bg-white text-gray-700 placeholder-gray-400 outline-none focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813]"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Separator */}
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>

                    {/* Option Settings Button */}
                    <div className="relative">
                        <button
                            onClick={() => setIsOptionOpen(!isOptionOpen)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${isOptionOpen
                                ? 'bg-[#fdb813] border-[#fdb813] text-[#081429]'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <Filter size={14} />
                            <span>보기 옵션</span>
                            {isOptionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {/* Options Dropdown */}
                        {isOptionOpen && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                                {/* Header */}
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                        <Filter size={16} className="text-[#fdb813]" />
                                        보기 옵션 설정
                                    </h3>
                                    <button
                                        onClick={() => setIsOptionOpen(false)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Student List Toggle */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 block">학생 목록 표시</label>
                                        <button
                                            onClick={() => setShowStudents(!showStudents)}
                                            className={`w-full px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between border ${showStudents
                                                ? 'bg-[#fdb813]/10 text-[#081429] border-[#fdb813] hover:bg-[#fdb813]/20'
                                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {showStudents ? <Eye size={14} /> : <EyeOff size={14} />}
                                                <span>{showStudents ? '학생 목록 보이기' : '학생 목록 숨기기'}</span>
                                            </div>
                                            <div className={`w-8 h-4 rounded-full relative transition-colors ${showStudents ? 'bg-[#fdb813]' : 'bg-gray-300'}`}>
                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showStudents ? 'left-4.5' : 'left-0.5'}`} style={{ left: showStudents ? '18px' : '2px' }}></div>
                                            </div>
                                        </button>
                                    </div>

                                    <div className="w-full h-px bg-gray-100"></div>

                                    {/* Days Selection */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <label className="text-xs font-bold text-gray-500 block">요일 선택</label>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setSelectedDays(['월', '화', '수', '목', '금'])}
                                                    className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                                                >
                                                    평일
                                                </button>
                                                <button
                                                    onClick={() => setSelectedDays(ALL_WEEKDAYS)}
                                                    className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                                                >
                                                    전체
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 flex-wrap">
                                            {ALL_WEEKDAYS.map(day => {
                                                const isSelected = selectedDays.includes(day);
                                                return (
                                                    <button
                                                        key={day}
                                                        onClick={() => {
                                                            const newDays = selectedDays.includes(day)
                                                                ? selectedDays.filter(d => d !== day)
                                                                : [...selectedDays, day];
                                                            setSelectedDays(newDays);
                                                        }}
                                                        className={`flex-1 min-w-[30px] py-2 rounded-md text-xs font-bold transition-all border ${isSelected
                                                            ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                                            }`}
                                                    >
                                                        {day}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Order Settings (Math Tab Only) */}
                    {viewType === 'teacher' && (hasPermission('timetable.math.edit') || isMaster) && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsTeacherOrderModalOpen(true)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                title="강사 순서 설정"
                            >
                                ↕️ 강사 순서
                            </button>
                            <button
                                onClick={() => setIsWeekdayOrderModalOpen(true)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                title="요일 순서 설정"
                            >
                                📅 요일 순서
                            </button>
                        </div>
                    )}

                    {/* View Settings */}
                    <button
                        onClick={() => setIsViewSettingsOpen(true)}
                        className="p-1.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        title="보기 설정"
                    >
                        <Settings size={14} />
                    </button>

                    {/* Pending Moves */}
                    {pendingMoves.length > 0 && (
                        <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-md px-2 py-1">
                            <span className="text-xs font-bold text-orange-600">
                                {pendingMoves.length}건 변경
                            </span>
                            <button
                                onClick={handleSavePendingMoves}
                                disabled={isSaving}
                                className="px-2 py-0.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 disabled:opacity-50"
                            >
                                {isSaving ? '저장중...' : '💾 저장'}
                            </button>
                            <button
                                onClick={handleCancelPendingMoves}
                                disabled={isSaving}
                                className="px-2 py-0.5 bg-gray-500 text-white rounded text-xs font-bold hover:bg-gray-600 disabled:opacity-50"
                            >
                                ↩ 취소
                            </button>
                        </div>
                    )}

                    {/* Add Class Button - Gated by subject-specific edit permission */}
                    {(((subjectTab as string) === 'math' && (hasPermission('timetable.math.edit') || isMaster)) ||
                        ((subjectTab as string) === 'english' && (hasPermission('timetable.english.edit') || isMaster))) && (
                            <button
                                onClick={openAddModal}
                                className="px-3 py-1.5 bg-[#fdb813] text-[#081429] rounded-md text-xs font-bold flex items-center gap-1 hover:brightness-110 transition-all active:scale-95 shadow-sm"
                            >
                                <Plus size={14} /> 수업추가
                            </button>
                        )}
                </div>
            </div >

            {/* Timetable Grid */}
            < div className="flex-1 overflow-auto border-t border-gray-200 p-4" >
                {
                    filteredClasses.length === 0 && allResources.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                            <BookOpen size={48} className="mb-4" />
                            <p className="text-lg font-bold">등록된 {currentSubjectFilter} 수업이 없습니다</p>
                            <p className="text-sm mt-1">위의 "수업추가" 버튼으로 시작하세요.</p>
                        </div>
                    ) : (
                        <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
                            <thead className="sticky top-0 z-10 bg-gray-50">
                                {/* Date + Day Row */}
                                <tr>
                                    <th className="p-1.5 text-[10px] font-bold text-gray-500 border-b border-r border-gray-200 bg-gray-100 sticky left-0 z-20" rowSpan={2} style={{ width: '60px', minWidth: '60px' }}>
                                        교시
                                    </th>
                                    {orderedSelectedDays.map(day => {
                                        const dateInfo = weekDates[day];
                                        const teachersForDay = allResources.filter(r =>
                                            filteredClasses.some(c =>
                                                (viewType === 'teacher' ? c.teacher === r : c.room === r) &&
                                                c.schedule?.some(s => s.includes(day))
                                            )
                                        );
                                        const colspan = teachersForDay.length || 1;
                                        const isWeekend = day === '토' || day === '일';

                                        return (
                                            <th
                                                key={day}
                                                colSpan={colspan}
                                                className={`p-1.5 text-xs font-bold border-b border-r border-gray-200 text-center ${isWeekend ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-700'}`}
                                                style={{ width: `${colspan * 120}px`, minWidth: `${colspan * 120}px` }}
                                            >
                                                {dateInfo.formatted}({day})
                                            </th>
                                        );
                                    })}
                                </tr>
                                {/* Teacher/Room Row */}
                                <tr>
                                    {orderedSelectedDays.map(day => {
                                        const teachersForDay = allResources.filter(r =>
                                            filteredClasses.some(c =>
                                                (viewType === 'teacher' ? c.teacher === r : c.room === r) &&
                                                c.schedule?.some(s => s.includes(day))
                                            )
                                        );

                                        if (teachersForDay.length === 0) {
                                            return (
                                                <th key={`${day}-empty`} className="p-1.5 text-[10px] text-blue-200 border-b border-r border-blue-400 bg-blue-500" style={{ width: '130px', minWidth: '130px' }}>
                                                    -
                                                </th>
                                            );
                                        }

                                        return teachersForDay.map(resource => {
                                            const teacherData = teachers.find(t => t.name === resource);
                                            const bgColor = teacherData?.bgColor || '#3b82f6';
                                            const textColor = teacherData?.textColor || '#ffffff';
                                            return (
                                                <th
                                                    key={`${day}-${resource}`}
                                                    className="p-1.5 text-[10px] font-bold border-b border-r truncate"
                                                    style={{
                                                        width: '130px',
                                                        minWidth: '130px',
                                                        backgroundColor: bgColor,
                                                        color: textColor,
                                                        borderColor: bgColor
                                                    }}
                                                    title={resource}
                                                >
                                                    {resource}
                                                </th>
                                            );
                                        });
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {currentPeriods.map(period => (
                                    <tr key={period} className="hover:bg-gray-50/50">
                                        <td className="p-1.5 text-[10px] font-bold text-gray-600 border-b border-r border-gray-200 text-center bg-gray-50 sticky left-0 z-10" style={{ width: '90px', minWidth: '90px' }}>
                                            {MATH_PERIOD_TIMES[period] || period}
                                        </td>
                                        {orderedSelectedDays.map(day => {
                                            const teachersForDay = allResources.filter(r =>
                                                filteredClasses.some(c =>
                                                    (viewType === 'teacher' ? c.teacher === r : c.room === r) &&
                                                    c.schedule?.some(s => s.includes(day))
                                                )
                                            );

                                            if (teachersForDay.length === 0) {
                                                return (
                                                    <td key={`${day}-${period}-empty`} className="p-0.5 border-b border-r border-gray-100" style={{ width: '120px', minWidth: '120px', height: '50px' }} />
                                                );
                                            }

                                            return teachersForDay.map(resource => {
                                                const cellClasses = getClassesForCell(day, period, resource);
                                                const periodIndex = currentPeriods.indexOf(period);

                                                // Check if ANY class in this cell is part of a merged span from above
                                                const shouldSkipThisCell = cellClasses.some((cls: TimetableClass) => shouldSkipCell(cls, day, periodIndex, cellClasses));

                                                if (shouldSkipThisCell) {
                                                    // 이 셀은 위 교시에서 병합된 영역이므로 <td> 자체를 렌더링하지 않음
                                                    return null;
                                                }

                                                // Calculate rowspan for this cell (if any class spans multiple periods)
                                                const maxSpan = Math.max(...cellClasses.map((cls: TimetableClass) => getConsecutiveSpan(cls, day, periodIndex)));

                                                return (
                                                    <td
                                                        key={`${day}-${period}-${resource}`}
                                                        className="p-1 border-b border-r border-gray-200 align-top bg-white"
                                                        style={{ width: '130px', minWidth: '130px' }}
                                                        rowSpan={maxSpan > 1 ? maxSpan : undefined}
                                                    >
                                                        {cellClasses.map((cls: TimetableClass) => {
                                                            // 연속 교시 수 계산 (병합할 셀 개수)
                                                            const span = getConsecutiveSpan(cls, day, periodIndex);

                                                            const theme = getSubjectTheme(cls.subject);
                                                            const hasSearchMatch = searchQuery && cls.studentList?.some(s => s.name.includes(searchQuery));
                                                            const sortedStudents = [...(cls.studentList || [])].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

                                                            return (
                                                                <div
                                                                    key={cls.id}
                                                                    onClick={() => canEditMath && setSelectedClass(cls)}
                                                                    onDragOver={(e) => handleDragOver(e, cls.id)}
                                                                    onDragLeave={handleDragLeave}
                                                                    onDrop={(e) => handleDrop(e, cls.id)}
                                                                    className={`flex flex-col rounded-lg border ${theme.border} ${theme.bg} overflow-hidden shadow-sm transition-all mb-1 ${dragOverClassId === cls.id ? 'ring-2 ring-indigo-400 scale-[1.02]' : (canEditMath ? 'hover:shadow-md cursor-pointer' : '')} ${hasSearchMatch ? 'ring-2 ring-yellow-400' : ''}`}
                                                                    style={{
                                                                        minHeight: span > 1 ? `${span * 80}px` : undefined
                                                                    }}
                                                                >
                                                                    {/* 수업명 헤더 */}
                                                                    <div className={`text-center font-bold py-1 px-1 text-[10px] border-b ${theme.border} bg-white/50 text-gray-800`}>
                                                                        ({cls.className})
                                                                    </div>

                                                                    {/* 학생 리스트 */}
                                                                    {showStudents && (
                                                                        <div className="flex-1 p-1 max-h-[150px] overflow-y-auto">
                                                                            <ul className="flex flex-col gap-0.5">
                                                                                {sortedStudents.map(s => {
                                                                                    const isHighlighted = searchQuery && s.name.includes(searchQuery);
                                                                                    // Format: 이름/학교학년
                                                                                    let displayText = s.name;
                                                                                    if (showSchool && s.school) {
                                                                                        displayText += `/${s.school}`;
                                                                                    }
                                                                                    if (showGrade && s.grade) {
                                                                                        displayText += showSchool ? s.grade : `/${s.grade}`;
                                                                                    }
                                                                                    return (
                                                                                        <li
                                                                                            key={s.id}
                                                                                            draggable={canEditMath}
                                                                                            onDragStart={(e) => canEditMath && handleDragStart(e, s.id, cls.id)}
                                                                                            className={`py-0.5 px-1 rounded text-center text-[10px] transition-colors truncate flex items-center justify-between group
                                                                                            ${canEditMath ? 'cursor-grab' : ''}
                                                                                            ${isHighlighted ? 'bg-yellow-300 font-bold text-black' : `hover:bg-white/80 ${theme.text}`}`}
                                                                                        >
                                                                                            <span className="truncate flex-1">{displayText}</span>
                                                                                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 ml-1">⋮</span>
                                                                                        </li>
                                                                                    );
                                                                                })}
                                                                            </ul>
                                                                        </div>
                                                                    )}

                                                                    {/* 하단 인원수 */}
                                                                    <div className={`text-center py-1 font-bold border-t ${theme.border} ${theme.bg} text-[9px] ${theme.text}`}>
                                                                        총 {cls.studentList?.length || 0}명
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </td>
                                                );
                                            });
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                }
            </div >

            {/* Class List Summary */}
            < div className="mt-3 pt-3 border-t border-gray-200 flex-shrink-0" >
                <div className="flex flex-wrap gap-1.5">
                    {filteredClasses.slice(0, 10).map(cls => {
                        const theme = getSubjectTheme(cls.subject);
                        return (
                            <div
                                key={cls.id}
                                onClick={() => canEditMath && setSelectedClass(cls)}
                                className={`flex items-center gap-1 px-2 py-1 ${theme.bg} ${theme.border} border rounded text-[10px] font-bold ${canEditMath ? 'cursor-pointer hover:brightness-95' : ''}`}
                            >
                                <span className={theme.text}>{cls.className}</span>
                                <span className="text-gray-400">({cls.studentList?.length || 0})</span>
                            </div>
                        );
                    })}
                    {filteredClasses.length > 10 && (
                        <span className="text-[10px] text-gray-400 self-center">+{filteredClasses.length - 10}개</span>
                    )}
                </div>
            </div >

            {/* Add Class Modal */}
            {
                isAddClassOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsAddClassOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Plus size={22} className="text-[#fdb813]" />
                                    새 {newSubject} 수업
                                </h3>
                                <button onClick={() => setIsAddClassOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">수업명 *</label>
                                    <input
                                        type="text"
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
                                        placeholder="예: 수학 기초반"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1">담당 강사 *</label>
                                        <select
                                            value={newTeacher}
                                            onChange={(e) => setNewTeacher(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none bg-white"
                                        >
                                            <option value="">강사 선택</option>
                                            {teachers
                                                .filter(t => !t.isHidden)
                                                .map(t => (
                                                    <option key={t.id} value={t.name}>{t.name}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1">교실</label>
                                        <input
                                            type="text"
                                            value={newRoom}
                                            onChange={(e) => setNewRoom(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
                                            placeholder="301호"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">시간표</label>
                                    <div className="flex">
                                        {/* Time labels column */}
                                        <div className="flex flex-col mr-2">
                                            <div className="text-xs font-bold text-gray-400 mb-1 h-[24px]"></div>
                                            {(newSubject === '수학' ? MATH_PERIODS : ENGLISH_PERIODS).map(period => (
                                                <div key={period} className="text-[10px] text-gray-600 font-bold h-[32px] flex items-center justify-end pr-2 whitespace-nowrap">
                                                    {MATH_PERIOD_TIMES[period] || period}
                                                </div>
                                            ))}
                                        </div>
                                        {/* Days grid */}
                                        <div className="grid grid-cols-7 gap-1 flex-1">
                                            {ALL_WEEKDAYS.map(day => (
                                                <div key={day} className="text-center">
                                                    <div className={`text-xs font-bold mb-1 ${(day === '토' || day === '일') ? 'text-orange-500' : 'text-gray-500'}`}>{day}</div>
                                                    {(newSubject === '수학' ? MATH_PERIODS : ENGLISH_PERIODS).map(period => {
                                                        const slot = `${day} ${period}`;
                                                        const isSelected = newSchedule.includes(slot);
                                                        return (
                                                            <button
                                                                key={slot}
                                                                onClick={() => toggleScheduleSlot(day, period)}
                                                                className={`w-full p-1.5 text-xs rounded mb-1 transition-all ${isSelected
                                                                    ? 'bg-[#fdb813] text-[#081429] font-bold shadow-sm'
                                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                                    }`}
                                                                title={MATH_PERIOD_TIMES[period] || ''}
                                                            >
                                                                {period.replace('교시', '')}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setIsAddClassOpen(false)} className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-bold">
                                    취소
                                </button>
                                <button onClick={handleAddClass} className="px-4 py-1.5 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:brightness-110">
                                    추가
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Class Detail Modal */}
            {
                selectedClass && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedClass(null)}>
                        <div className={`bg-white rounded-xl shadow-2xl ${isEditingClass ? 'w-full max-w-2xl' : 'w-[400px]'} max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300`} onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className="flex justify-between items-center p-4 border-b">
                                <h3 className="text-base font-bold flex items-center gap-2 text-[#081429]">
                                    <Users size={18} className="text-[#fdb813]" />
                                    {selectedClass.className}
                                    {isEditingClass && <span className="text-xs text-gray-400 font-normal">(수정 중)</span>}
                                </h3>
                                {!isEditingClass && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsEditingClass(true)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="수업 수정"
                                        >
                                            <Settings size={18} />
                                        </button>
                                        <button onClick={() => setSelectedClass(null)} className="text-gray-400 hover:text-gray-600">
                                            <X size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isEditingClass ? (
                                // Edit View
                                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                    {/* Room Edit */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">교실</label>
                                        <input
                                            type="text"
                                            value={editRoom}
                                            onChange={(e) => setEditRoom(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
                                            placeholder="교실 입력 (예: 301호)"
                                        />
                                    </div>

                                    {/* Schedule Edit */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">시간표</label>
                                        <div className="flex">
                                            {/* Time labels column */}
                                            <div className="flex flex-col mr-2">
                                                <div className="text-xs font-bold text-gray-400 mb-1 h-[24px]"></div>
                                                {(selectedClass.subject === '수학' ? MATH_PERIODS : ENGLISH_PERIODS).map(period => (
                                                    <div key={period} className="text-[10px] text-gray-600 font-bold h-[32px] flex items-center justify-end pr-2 whitespace-nowrap">
                                                        {MATH_PERIOD_TIMES[period] || period}
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Days grid */}
                                            <div className="grid grid-cols-7 gap-1 flex-1">
                                                {ALL_WEEKDAYS.map(day => (
                                                    <div key={day} className="text-center">
                                                        <div className={`text-xs font-bold mb-1 ${(day === '토' || day === '일') ? 'text-orange-500' : 'text-gray-500'}`}>{day}</div>
                                                        {(selectedClass.subject === '수학' ? MATH_PERIODS : ENGLISH_PERIODS).map(period => {
                                                            const slot = `${day} ${period}`;
                                                            const isSelected = editSchedule.includes(slot);
                                                            return (
                                                                <button
                                                                    key={slot}
                                                                    onClick={() => toggleEditScheduleSlot(day, period)}
                                                                    className={`w-full p-1.5 text-xs rounded mb-1 transition-all ${isSelected
                                                                        ? 'bg-[#fdb813] text-[#081429] font-bold shadow-sm'
                                                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                                        }`}
                                                                    title={MATH_PERIOD_TIMES[period] || ''}
                                                                >
                                                                    {period.replace('교시', '')}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Normal View (Students) - 영어 스타일 UI 적용
                                <>
                                    {/* Sub Header with Student Count */}
                                    <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2 text-sm">
                                        <span className="text-gray-500">담당강사</span>
                                        <span className="text-[#373d41] font-bold">{selectedClass.teacher || '-'}</span>
                                        {selectedClass.room && <span className="text-gray-400">| {selectedClass.room}</span>}
                                        <span className="text-gray-300">|</span>
                                        <span className="bg-[#fdb813] text-[#081429] px-2 py-0.5 rounded font-bold text-xs">
                                            {selectedClass.studentList?.length || 0}명
                                        </span>
                                    </div>

                                    {/* Add Student Form - 영어 스타일 그리드 레이아웃 */}
                                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1 grid grid-cols-3 gap-2">
                                                <div className="col-span-1">
                                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">이름</label>
                                                    <input
                                                        type="text"
                                                        value={newStudentName}
                                                        onChange={(e) => setNewStudentName(e.target.value)}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                                        placeholder="이름"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">학교</label>
                                                    <input
                                                        type="text"
                                                        value={newStudentSchool}
                                                        onChange={(e) => setNewStudentSchool(e.target.value)}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                                        placeholder="학교"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">학년</label>
                                                    <input
                                                        type="text"
                                                        value={newStudentGrade}
                                                        onChange={(e) => setNewStudentGrade(e.target.value)}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                                        placeholder="학년"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleAddStudent}
                                                disabled={!newStudentName.trim()}
                                                className="px-4 py-1.5 bg-[#fdb813] text-[#081429] rounded font-bold text-sm hover:bg-[#e5a712] disabled:opacity-50 h-[34px]"
                                            >
                                                추가
                                            </button>
                                        </div>
                                    </div>

                                    {/* Student List - 영어 스타일 번호와 배경 */}
                                    <div className="flex-1 overflow-y-auto max-h-[300px] px-4 py-3">
                                        {selectedClass.studentList && selectedClass.studentList.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {(() => {
                                                    const activeList = selectedClass.studentList.filter(s => !s.withdrawalDate);
                                                    const withdrawnList = selectedClass.studentList.filter(s => {
                                                        if (!s.withdrawalDate) return false;
                                                        const withdrawnDate = new Date(s.withdrawalDate);
                                                        const now = new Date();
                                                        const daysSinceWithdrawal = Math.floor((now.getTime() - withdrawnDate.getTime()) / (1000 * 60 * 60 * 24));
                                                        return daysSinceWithdrawal <= 30;
                                                    });

                                                    return (
                                                        <>
                                                            {/* 재원생 목록 */}
                                                            {activeList.map((student, idx) => (
                                                                <div
                                                                    key={student.id}
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, student.id, selectedClass.id)}
                                                                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-grab group transition-colors"
                                                                >
                                                                    <div className="flex items-center gap-3 flex-1">
                                                                        <span className="w-5 h-5 rounded-full bg-[#081429] text-[#fdb813] text-[10px] font-bold flex items-center justify-center shrink-0">
                                                                            {idx + 1}
                                                                        </span>
                                                                        <span className="font-bold text-sm text-[#373d41]">
                                                                            {student.name}
                                                                        </span>
                                                                        {(student.school || student.grade) && (
                                                                            <span className="text-xs text-gray-400">
                                                                                {student.school}{student.grade}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => handleWithdrawal(student.id)}
                                                                            className="px-2 py-0.5 text-[10px] rounded border border-gray-200 text-gray-400 hover:bg-gray-800 hover:text-white hover:border-gray-800 transition-colors"
                                                                        >
                                                                            퇴원
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRemoveStudent(student.id)}
                                                                            className="px-2 py-0.5 text-[10px] rounded border bg-white text-red-400 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
                                                                        >
                                                                            삭제
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* 퇴원생 목록 (30일 이내) */}
                                                            {withdrawnList.length > 0 && (
                                                                <div className="mt-6 border-t border-gray-100 pt-4">
                                                                    <div className="flex items-center gap-2 mb-3 px-1">
                                                                        <div className="h-px bg-gray-200 flex-1"></div>
                                                                        <span className="text-xs font-bold text-gray-400">퇴원한 학생 ({withdrawnList.length})</span>
                                                                        <div className="h-px bg-gray-200 flex-1"></div>
                                                                    </div>
                                                                    <div className="opacity-70 grayscale space-y-1">
                                                                        {withdrawnList.map((student) => (
                                                                            <div
                                                                                key={student.id}
                                                                                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
                                                                            >
                                                                                <div className="flex items-center gap-3 flex-1">
                                                                                    <span className="font-bold text-sm text-gray-400 line-through">
                                                                                        {student.name}
                                                                                    </span>
                                                                                    {(student.school || student.grade) && (
                                                                                        <span className="text-xs text-gray-400">
                                                                                            {student.school}{student.grade}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex gap-1">
                                                                                    <button
                                                                                        onClick={() => handleRestoreStudent(student.id)}
                                                                                        className="px-2 py-0.5 text-[10px] rounded border transition-colors bg-black text-white border-black hover:bg-gray-800"
                                                                                    >
                                                                                        복구
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleRemoveStudent(student.id)}
                                                                                        className="px-2 py-0.5 text-[10px] rounded border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                                                                    >
                                                                                        삭제
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-400 py-8 text-sm">등록된 학생이 없습니다.</div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Footer */}
                            <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                                {isEditingClass ? (
                                    <>
                                        <button
                                            onClick={() => setIsEditingClass(false)}
                                            className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-bold"
                                        >
                                            취소
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleUpdateClass}
                                                className="px-5 py-2 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:brightness-110"
                                            >
                                                저장
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleDeleteClass(selectedClass.id)}
                                            className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-1"
                                        >
                                            <Trash2 size={14} /> 삭제
                                        </button>
                                        <button onClick={() => setSelectedClass(null)} className="px-5 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:bg-[#1e293b]">
                                            닫기
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* View Settings Modal */}
            {
                isViewSettingsOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsViewSettingsOpen(false)}>
                        <div className="bg-white rounded-xl shadow-2xl w-[300px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="p-4 border-b flex items-center justify-between">
                                <h3 className="font-bold text-sm text-[#081429]">보기 설정</h3>
                                <button onClick={() => setIsViewSettingsOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Column Width */}
                                <div>
                                    <div className="text-xs font-bold text-gray-600 mb-2">가로 폭</div>
                                    <div className="flex gap-1">
                                        {(['narrow', 'normal', 'wide'] as const).map(w => (
                                            <button
                                                key={w}
                                                onClick={() => setColumnWidth(w)}
                                                className={`flex-1 py-1.5 text-xs rounded border ${columnWidth === w ? 'bg-[#fdb813] text-[#081429] border-[#fdb813] font-bold' : 'border-gray-300 text-gray-500'}`}
                                            >
                                                {w === 'narrow' ? '좁게' : w === 'normal' ? '보통' : '넓게'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Row Height */}
                                <div>
                                    <div className="text-xs font-bold text-gray-600 mb-2">세로 높이</div>
                                    <div className="flex gap-1">
                                        {(['short', 'normal', 'tall', 'very-tall'] as const).map(h => (
                                            <button
                                                key={h}
                                                onClick={() => setRowHeight(h)}
                                                className={`flex-1 py-1.5 text-[10px] rounded border ${rowHeight === h ? 'bg-[#fdb813] text-[#081429] border-[#fdb813] font-bold' : 'border-gray-300 text-gray-500'}`}
                                            >
                                                {h === 'short' ? '좁게' : h === 'normal' ? '보통' : h === 'tall' ? '넓게' : '아주넓게'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Font Size */}
                                <div>
                                    <div className="text-xs font-bold text-gray-600 mb-2">글자 크기</div>
                                    <div className="flex gap-1">
                                        {(['small', 'normal', 'large', 'very-large'] as const).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setFontSize(f)}
                                                className={`flex-1 py-1.5 text-[10px] rounded border ${fontSize === f ? 'bg-[#fdb813] text-[#081429] border-[#fdb813] font-bold' : 'border-gray-300 text-gray-500'}`}
                                            >
                                                {f === 'small' ? '작게' : f === 'normal' ? '보통' : f === 'large' ? '크게' : '매우크게'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Checkboxes */}
                                <div className="space-y-2 pt-2 border-t">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={showClassName} onChange={(e) => setShowClassName(e.target.checked)} className="w-4 h-4 accent-[#fdb813]" />
                                        <span className="text-xs font-bold text-gray-700">수업명 보기</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={showSchool} onChange={(e) => setShowSchool(e.target.checked)} className="w-4 h-4 accent-[#fdb813]" />
                                        <span className="text-xs font-bold text-gray-700">학교 보기</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={showGrade} onChange={(e) => setShowGrade(e.target.checked)} className="w-4 h-4 accent-[#fdb813]" />
                                        <span className="text-xs font-bold text-gray-700">학년 보기</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={showEmptyRooms} onChange={(e) => setShowEmptyRooms(e.target.checked)} className="w-4 h-4 accent-[#fdb813]" />
                                        <span className="text-xs font-bold text-gray-700">빈 강의실 표시</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Teacher Order Modal (Math) */}
            <TeacherOrderModal
                isOpen={isTeacherOrderModalOpen}
                onClose={() => setIsTeacherOrderModalOpen(false)}
                currentOrder={mathConfig.teacherOrder}
                allTeachers={sortedTeachers}
                onSave={handleSaveTeacherOrder}
            />

            {/* Weekday Order Modal */}
            <WeekdayOrderModal
                isOpen={isWeekdayOrderModalOpen}
                onClose={() => setIsWeekdayOrderModalOpen(false)}
                currentOrder={mathConfig.weekdayOrder}
                allWeekdays={ALL_WEEKDAYS}
                onSave={handleSaveWeekdayOrder}
            />
        </div >
    );
};

export default TimetableManager;
