import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { TimetableClass, Teacher, TimetableStudent } from '../../types';
import { Plus, Trash2, Users, Clock, BookOpen, X, UserPlus, GripVertical, ChevronLeft, ChevronRight, Search, Settings } from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, getWeek, getMonth, getYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import EnglishTimetable from './English/EnglishTimetable';

// Constants
const ALL_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const MATH_PERIODS = ['1교시', '2교시', '3교시', '4교시'];
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
}

const TimetableManager: React.FC<TimetableManagerProps> = ({
    subjectTab: externalSubjectTab,
    onSubjectChange,
    viewType: externalViewType,
    onViewTypeChange,
    showStudents: externalShowStudents,
    onShowStudentsChange,
    selectedDays: externalSelectedDays,
    onSelectedDaysChange,
}) => {
    // Subject Tab (use external if provided)
    const [internalSubjectTab, setInternalSubjectTab] = useState<'math' | 'english'>('math');
    const subjectTab = externalSubjectTab ?? internalSubjectTab;
    const setSubjectTab = onSubjectChange ?? setInternalSubjectTab;

    // Data State
    const [classes, setClasses] = useState<TimetableClass[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);

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

    const [internalShowStudents, setInternalShowStudents] = useState(true);
    const showStudents = externalShowStudents ?? internalShowStudents;
    const setShowStudents = onShowStudentsChange ?? setInternalShowStudents;

    // New Class Form
    const [newClassName, setNewClassName] = useState('');
    const [newTeacher, setNewTeacher] = useState('');
    const [newRoom, setNewRoom] = useState('');
    const [newSubject, setNewSubject] = useState('수학');
    const [newSchedule, setNewSchedule] = useState<string[]>([]);

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

    // Drag State
    const [draggingStudent, setDraggingStudent] = useState<{ studentId: string; fromClassId: string } | null>(null);
    const [dragOverClassId, setDragOverClassId] = useState<string | null>(null);

    // Pending Moves State (for batch save)
    const [pendingMoves, setPendingMoves] = useState<{ studentId: string; fromClassId: string; toClassId: string; student: TimetableStudent }[]>([]);
    const [localClasses, setLocalClasses] = useState<TimetableClass[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Sync local classes with Firebase classes
    useEffect(() => {
        if (pendingMoves.length === 0) {
            setLocalClasses(classes);
        }
    }, [classes, pendingMoves.length]);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Current periods based on subject tab
    const currentPeriods = subjectTab === 'math' ? MATH_PERIODS : ENGLISH_PERIODS;
    const currentSubjectFilter = subjectTab === 'math' ? '수학' : '영어';

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
    useEffect(() => {
        const q = query(collection(db, '수업목록'), orderBy('className'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedClasses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TimetableClass));
            setClasses(loadedClasses);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to Teachers
    useEffect(() => {
        const q = query(collection(db, '강사목록'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedTeachers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Teacher));

            // Filter: Show only if 'math' is in subjects OR subjects field is missing (legacy support)
            const filtered = loadedTeachers.filter(t => !t.subjects || t.subjects.includes('math'));
            setTeachers(filtered);
        });
        return () => unsubscribe();
    }, []);

    // Filter classes by current subject (use localClasses for pending moves)
    const filteredClasses = useMemo(() => {
        return localClasses.filter(c => c.subject === currentSubjectFilter);
    }, [localClasses, currentSubjectFilter]);

    // Compute resources (all teachers from state, filtered by hidden)
    const allResources = useMemo(() => {
        if (viewType === 'teacher') {
            // Show all visible teachers regardless of whether they have classes
            return teachers.filter(t => !t.isHidden).map(t => t.name).sort();
        }
        return [...new Set(filteredClasses.map(c => c.room).filter(Boolean))].sort();
    }, [viewType, filteredClasses, teachers]);

    // Get classes for cell
    const getClassesForCell = (day: string, period: string, resource: string) => {
        return filteredClasses.filter(cls => {
            const resourceMatch = viewType === 'teacher' ? cls.teacher === resource : cls.room === resource;
            const scheduleMatch = cls.schedule?.some(s => s.includes(day) && s.includes(period));
            return resourceMatch && scheduleMatch;
        });
    };

    // Add new class
    const handleAddClass = async () => {
        if (!newClassName.trim() || !newTeacher.trim()) {
            alert('수업명과 담당 강사를 입력해주세요.');
            return;
        }

        // Document ID: 과목_강사_수업명 (읽기 쉬운 형태)
        const classId = `${newSubject}_${newTeacher.trim().replace(/\s/g, '')}_${newClassName.trim().replace(/\s/g, '_')}`;
        const newClass: TimetableClass = {
            id: classId,
            className: newClassName.trim(),
            teacher: newTeacher.trim(),
            room: newRoom.trim(),
            subject: newSubject,
            schedule: newSchedule,
            studentList: [],
            order: classes.length + 1
        };

        try {
            await setDoc(doc(db, '수업목록', classId), newClass);
            setNewClassName('');
            setNewTeacher('');
            setNewRoom('');
            setNewSubject(currentSubjectFilter);
            setNewSchedule([]);
            setIsAddClassOpen(false);
        } catch (e) {
            console.error(e);
            alert('수업 추가 실패');
        }
    };

    // Delete class
    const handleDeleteClass = async (classId: string) => {
        if (!confirm('이 수업을 삭제하시겠습니까?')) return;
        try {
            await deleteDoc(doc(db, '수업목록', classId));
            setSelectedClass(null);
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
    };

    // Add student to class
    const handleAddStudent = async () => {
        if (!selectedClass || !newStudentName.trim()) {
            alert('학생 이름을 입력해주세요.');
            return;
        }

        const studentId = `student_${Date.now()}`;
        const newStudent: TimetableStudent = {
            id: studentId,
            name: newStudentName.trim(),
            grade: newStudentGrade.trim(),
            school: newStudentSchool.trim(),
        };

        const updatedList = [...(selectedClass.studentList || []), newStudent];

        try {
            await updateDoc(doc(db, '수업목록', selectedClass.id), { studentList: updatedList });
            setNewStudentName('');
            setNewStudentGrade('');
            setNewStudentSchool('');
            setSelectedClass({ ...selectedClass, studentList: updatedList });
        } catch (e) {
            console.error(e);
            alert('학생 추가 실패');
        }
    };

    // Remove student
    const handleRemoveStudent = async (studentId: string) => {
        if (!selectedClass) return;
        if (!confirm('이 학생을 수업에서 제거하시겠습니까?')) return;

        const updatedList = selectedClass.studentList.filter(s => s.id !== studentId);
        try {
            await updateDoc(doc(db, '수업목록', selectedClass.id), { studentList: updatedList });
            setSelectedClass({ ...selectedClass, studentList: updatedList });
        } catch (e) {
            console.error(e);
            alert('학생 제거 실패');
        }
    };

    // Drag handlers
    const handleDragStart = (e: React.DragEvent, studentId: string, fromClassId: string) => {
        setDraggingStudent({ studentId, fromClassId });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, classId: string) => {
        e.preventDefault();
        setDragOverClassId(classId);
    };

    const handleDragLeave = () => setDragOverClassId(null);

    const handleDrop = async (e: React.DragEvent, toClassId: string) => {
        e.preventDefault();
        setDragOverClassId(null);
        if (!draggingStudent) return;

        const { studentId, fromClassId } = draggingStudent;
        if (fromClassId === toClassId) { setDraggingStudent(null); return; }

        const fromClass = localClasses.find(c => c.id === fromClassId);
        const toClass = localClasses.find(c => c.id === toClassId);
        if (!fromClass || !toClass) return;

        const student = fromClass.studentList?.find(s => s.id === studentId);
        if (!student) return;

        // Update local state only (no Firebase write yet)
        setLocalClasses(prev => prev.map(cls => {
            if (cls.id === fromClassId) {
                return { ...cls, studentList: cls.studentList.filter(s => s.id !== studentId) };
            }
            if (cls.id === toClassId) {
                return { ...cls, studentList: [...(cls.studentList || []), student] };
            }
            return cls;
        }));

        // Add to pending moves
        setPendingMoves(prev => [...prev, { studentId, fromClassId, toClassId, student }]);
        setDraggingStudent(null);
    };

    // Save all pending moves to Firebase
    const handleSavePendingMoves = async () => {
        if (pendingMoves.length === 0) return;
        setIsSaving(true);

        try {
            const batch = writeBatch(db);

            // Build final state for each affected class
            const affectedClassIds = new Set<string>();
            pendingMoves.forEach(m => {
                affectedClassIds.add(m.fromClassId);
                affectedClassIds.add(m.toClassId);
            });

            affectedClassIds.forEach(classId => {
                const cls = localClasses.find(c => c.id === classId);
                if (cls) {
                    batch.update(doc(db, '수업목록', classId), { studentList: cls.studentList || [] });
                }
            });

            await batch.commit();
            setPendingMoves([]);
        } catch (e) {
            console.error(e);
            alert('저장 실패');
        } finally {
            setIsSaving(false);
        }
    };

    // Cancel pending moves
    const handleCancelPendingMoves = () => {
        setPendingMoves([]);
        setLocalClasses(classes); // Reset to Firebase state
    };

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

                    {/* Add Class Button */}
                    <button
                        onClick={openAddModal}
                        className="px-3 py-1.5 bg-[#fdb813] text-[#081429] rounded-md text-xs font-bold flex items-center gap-1 hover:brightness-110 transition-all active:scale-95 shadow-sm"
                    >
                        <Plus size={14} /> 수업추가
                    </button>
                </div>
            </div>

            {/* Timetable Grid */}
            <div className="flex-1 overflow-auto border-t border-gray-200 p-4">
                {filteredClasses.length === 0 && allResources.length === 0 ? (
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
                                {selectedDays.map(day => {
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
                                {selectedDays.map(day => {
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
                                    <td className="p-1.5 text-[10px] font-bold text-gray-500 border-b border-r border-gray-200 text-center bg-gray-50 sticky left-0 z-10" style={{ width: '60px', minWidth: '60px' }}>
                                        {period}
                                    </td>
                                    {selectedDays.map(day => {
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
                                            return (
                                                <td
                                                    key={`${day}-${period}-${resource}`}
                                                    className="p-1 border-b border-r border-gray-200 align-top bg-white"
                                                    style={{ width: '130px', minWidth: '130px' }}
                                                >
                                                    {cellClasses.map(cls => {
                                                        const theme = getSubjectTheme(cls.subject);
                                                        const hasSearchMatch = searchQuery && cls.studentList?.some(s => s.name.includes(searchQuery));
                                                        const sortedStudents = [...(cls.studentList || [])].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

                                                        return (
                                                            <div
                                                                key={cls.id}
                                                                onClick={() => setSelectedClass(cls)}
                                                                onDragOver={(e) => handleDragOver(e, cls.id)}
                                                                onDragLeave={handleDragLeave}
                                                                onDrop={(e) => handleDrop(e, cls.id)}
                                                                className={`flex flex-col rounded-lg border ${theme.border} ${theme.bg} overflow-hidden shadow-sm transition-all mb-1 ${dragOverClassId === cls.id ? 'ring-2 ring-indigo-400 scale-[1.02]' : 'hover:shadow-md'} ${hasSearchMatch ? 'ring-2 ring-yellow-400' : ''}`}
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
                                                                                        draggable
                                                                                        onDragStart={(e) => handleDragStart(e, s.id, cls.id)}
                                                                                        className={`py-0.5 px-1 rounded text-center cursor-grab text-[10px] transition-colors truncate flex items-center justify-between group
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
                )}
            </div>

            {/* Class List Summary */}
            <div className="mt-3 pt-3 border-t border-gray-200 flex-shrink-0">
                <div className="flex flex-wrap gap-1.5">
                    {filteredClasses.slice(0, 10).map(cls => {
                        const theme = getSubjectTheme(cls.subject);
                        return (
                            <div
                                key={cls.id}
                                onClick={() => setSelectedClass(cls)}
                                className={`flex items-center gap-1 px-2 py-1 ${theme.bg} ${theme.border} border rounded text-[10px] font-bold cursor-pointer hover:brightness-95`}
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
            </div>

            {/* Add Class Modal */}
            {
                isAddClassOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-bold flex items-center gap-2">
                                    <Plus size={18} className="text-[#fdb813]" />
                                    새 {newSubject} 수업
                                </h3>
                                <button onClick={() => setIsAddClassOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">수업명 *</label>
                                    <input
                                        type="text"
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
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
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">시간표</label>
                                    <div className="grid grid-cols-7 gap-0.5">
                                        {ALL_WEEKDAYS.map(day => (
                                            <div key={day} className="text-center">
                                                <div className={`text-[9px] font-bold mb-0.5 ${(day === '토' || day === '일') ? 'text-orange-500' : 'text-gray-400'}`}>{day}</div>
                                                {(newSubject === '수학' ? MATH_PERIODS : ENGLISH_PERIODS).map(period => {
                                                    const slot = `${day} ${period}`;
                                                    const isSelected = newSchedule.includes(slot);
                                                    return (
                                                        <button
                                                            key={slot}
                                                            onClick={() => toggleScheduleSlot(day, period)}
                                                            className={`w-full p-0.5 text-[9px] rounded mb-0.5 transition-all ${isSelected
                                                                ? 'bg-[#fdb813] text-[#081429] font-bold'
                                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                                }`}
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
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-2xl w-[400px] max-h-[80vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="flex justify-between items-center p-4 border-b">
                                <h3 className="text-base font-bold flex items-center gap-2 text-[#081429]">
                                    <Users size={18} className="text-[#fdb813]" />
                                    {selectedClass.className}
                                </h3>
                                <button onClick={() => setSelectedClass(null)} className="text-gray-400 hover:text-gray-600">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Sub Header */}
                            <div className="px-4 py-2 bg-gray-50 border-b text-xs font-bold text-[#373d41]">
                                {selectedClass.teacher}
                                {selectedClass.room && <span className="text-gray-400 ml-2">| {selectedClass.room}</span>}
                            </div>

                            {/* Add Student Form */}
                            <div className="p-4 border-b">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newStudentName}
                                        onChange={(e) => setNewStudentName(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
                                        placeholder="학생 이름"
                                    />
                                    <input
                                        type="text"
                                        value={newStudentSchool}
                                        onChange={(e) => setNewStudentSchool(e.target.value)}
                                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
                                        placeholder="학교"
                                    />
                                    <input
                                        type="text"
                                        value={newStudentGrade}
                                        onChange={(e) => setNewStudentGrade(e.target.value)}
                                        className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
                                        placeholder="학년"
                                    />
                                    <button onClick={handleAddStudent} className="px-4 py-2 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:bg-yellow-400 whitespace-nowrap">
                                        추가
                                    </button>
                                </div>
                            </div>

                            {/* Student List */}
                            <div className="flex-1 overflow-y-auto max-h-[250px]">
                                {selectedClass.studentList && selectedClass.studentList.length > 0 ? (
                                    <div className="divide-y divide-gray-100">
                                        {selectedClass.studentList.map(student => (
                                            <div
                                                key={student.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, student.id, selectedClass.id)}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-grab group"
                                            >
                                                <span className="text-gray-300 text-sm">⋮⋮</span>
                                                <span className="font-medium text-sm text-[#081429] flex-1">
                                                    {student.name}
                                                    {student.school && <span className="text-gray-400 ml-1 text-xs">{student.school}</span>}
                                                    {student.grade && <span className="text-gray-400 text-xs">{student.grade}</span>}
                                                </span>
                                                <button
                                                    onClick={() => handleRemoveStudent(student.id)}
                                                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400 py-8 text-sm">등록된 학생이 없습니다.</div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                                <button
                                    onClick={() => handleDeleteClass(selectedClass.id)}
                                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-1"
                                >
                                    <Trash2 size={14} /> 삭제
                                </button>
                                <button onClick={() => setSelectedClass(null)} className="px-5 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:bg-[#1e293b]">
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* View Settings Modal */}
            {isViewSettingsOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-[300px] max-h-[80vh] overflow-y-auto">
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
            )}
        </div >
    );
};

export default TimetableManager;
