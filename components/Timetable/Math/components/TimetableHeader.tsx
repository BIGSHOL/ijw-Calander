import React, { useMemo, useState, useEffect, useRef } from 'react';
import { addDays } from 'date-fns';
import {
    ChevronLeft, ChevronRight, Search, X, Settings, Eye, EyeOff, Edit, SlidersHorizontal,
    ArrowRightLeft, Copy, Upload, Save, Link2, Users, ChevronUp, ChevronDown, GripVertical, Download, Calendar as CalendarIcon
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UnifiedStudent, TimetableClass } from '../../../../types';
import { formatSchoolGrade } from '../../../../utils/studentUtils';
import { formatDateKey } from '../../../../utils/dateUtils';
import { getEndedSubjects } from '../../../../utils/enrollment';
import { useMathConfig, DEFAULT_WEEKDAY_GROUP_ORDER } from '../hooks/useMathConfig';
import WithdrawalStudentDetail from '../../../WithdrawalManagement/WithdrawalStudentDetail';
import { WithdrawalEntry } from '../../../../hooks/useWithdrawalFilters';
import SubjectControls from '../../shared/SubjectControls';
import type { TimetableSubjectType } from '../../../../types';

// 드래그 가능한 요일 아이템
const SortableWeekdayItem = ({ id, index, total, onMoveUp, onMoveDown }: { id: string; index: number; total: number; onMoveUp: () => void; onMoveDown: () => void }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} className="flex items-center justify-between px-2 py-1 hover:bg-gray-50 rounded-sm group">
            <div className="flex items-center gap-2">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                    <GripVertical size={12} />
                </div>
                <span className="text-xs text-gray-700 font-medium">{id.length === 1 ? `${id}요일` : id}</span>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={onMoveUp} disabled={index === 0} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" title="위로 이동">
                    <ChevronUp size={14} className="text-gray-500" />
                </button>
                <button onClick={onMoveDown} disabled={index === total - 1} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" title="아래로 이동">
                    <ChevronDown size={14} className="text-gray-500" />
                </button>
            </div>
        </div>
    );
};

// 드래그 가능한 강사 아이템
const SortableTeacherItem = ({ id, isHidden, onToggleHidden }: { id: string; isHidden: boolean; onToggleHidden: () => void }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center justify-between px-1.5 py-1 hover:bg-gray-50 rounded-sm">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0">
                    <GripVertical size={12} />
                </div>
                <span className={`text-xs truncate ${isHidden ? 'text-gray-300 line-through' : 'text-gray-700'}`}>{id}</span>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
                className={`p-0.5 rounded shrink-0 ${isHidden ? 'text-gray-300 hover:text-gray-500' : 'text-blue-500 hover:text-blue-700'}`}
                title={isHidden ? '표시' : '숨기기'}
            >
                {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
        </div>
    );
};

interface TimetableHeaderProps {
    weekLabel: string;
    goToPrevWeek: () => void;
    goToNextWeek: () => void;
    goToThisWeek: () => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    viewType: 'teacher' | 'room' | 'class' | 'excel';
    setIsTeacherOrderModalOpen: (isOpen: boolean) => void;
    setIsViewSettingsOpen: (isOpen: boolean) => void;
    pendingMovesCount: number;
    scheduledMovesCount?: number;
    handleSavePendingMoves: () => void;
    handleCancelPendingMoves: () => void;
    isSaving: boolean;
    // 조회/수정 모드
    mode: 'view' | 'edit';
    setMode: (mode: 'view' | 'edit') => void;
    canEdit: boolean;
    // 시뮬레이션 모드
    isSimulationMode?: boolean;
    currentScenarioName?: string | null;
    onToggleSimulation?: () => void;
    onCopyLiveToDraft?: () => void;
    onPublishDraftToLive?: () => void;
    onOpenScenarioModal?: () => void;
    // 공유 링크 (마스터 전용)
    isMaster?: boolean;
    onOpenEmbedManager?: () => void;
    // 학생 데이터 (카운트용)
    studentMap?: Record<string, UnifiedStudent>;
    currentWeekStart?: Date;
    filteredClasses?: TimetableClass[];
    // 보기 설정 (드롭다운에서 직접 조절)
    selectedDays?: string[];
    setSelectedDays?: (days: string[]) => void;
    showStudents?: boolean;
    setShowStudents?: (show: boolean) => void;
    showClassName?: boolean;
    setShowClassName?: (show: boolean) => void;
    showSchool?: boolean;
    setShowSchool?: (show: boolean) => void;
    showGrade?: boolean;
    setShowGrade?: (show: boolean) => void;
    showHoldStudents?: boolean;
    setShowHoldStudents?: (show: boolean) => void;
    showWithdrawnStudents?: boolean;
    setShowWithdrawnStudents?: (show: boolean) => void;
    cellSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    setCellSize?: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => void;
    fontSize?: 'small' | 'normal' | 'large';
    setFontSize?: (size: 'small' | 'normal' | 'large') => void;
    // 통합뷰 전용 props
    onExportImage?: () => void;  // 이미지 저장 버튼 클릭 핸들러
    // 통합뷰 표시 옵션 (class viewType)
    integrationDisplayOptions?: {
        showStudents?: boolean;
        showRoom?: boolean;
        showTeacher?: boolean;
        showSchedule?: boolean;
        showSchool?: boolean;
        showGrade?: boolean;
        showHoldStudents?: boolean;
        showWithdrawnStudents?: boolean;
    };
    onIntegrationDisplayOptionsChange?: (key: string, value: boolean) => void;
    // 퇴원 관리 권한 (퇴원생 클릭 시 상세 모달용)
    canEditWithdrawal?: boolean;
    canReactivateWithdrawal?: boolean;
    // 과목/뷰 전환 (SubjectControls)
    timetableSubject?: TimetableSubjectType;
    setTimetableSubject?: (value: TimetableSubjectType) => void;
    setTimetableViewType?: React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>;
    mathViewMode?: string;
    setMathViewMode?: (value: string) => void;
    hasPermission?: (perm: string) => boolean;
    setIsTimetableSettingsOpen?: (value: boolean) => void;
    userDepartments?: ('math' | 'highmath' | 'english')[];
    // 강의실 필터
    roomFilter?: { main: boolean; barun: boolean; godeung: boolean };
    onRoomFilterChange?: (type: 'main' | 'barun' | 'godeung', value: boolean) => void;
    // 강사 숨김 필터
    hiddenTeachers?: string[];
    onToggleTeacherHidden?: (teacher: string) => void;
}

const TimetableHeader: React.FC<TimetableHeaderProps> = ({
    weekLabel,
    goToPrevWeek,
    goToNextWeek,
    goToThisWeek,
    searchQuery,
    setSearchQuery,
    viewType,
    setIsTeacherOrderModalOpen,
    setIsViewSettingsOpen,
    pendingMovesCount,
    scheduledMovesCount = 0,
    handleSavePendingMoves,
    handleCancelPendingMoves,
    isSaving,
    mode,
    setMode,
    canEdit,
    isSimulationMode = false,
    currentScenarioName = null,
    onToggleSimulation,
    onCopyLiveToDraft,
    onPublishDraftToLive,
    onOpenScenarioModal,
    isMaster = false,
    onOpenEmbedManager,
    studentMap = {},
    currentWeekStart,
    filteredClasses = [],
    // 보기 설정
    selectedDays,
    setSelectedDays,
    showStudents,
    setShowStudents,
    showClassName,
    setShowClassName,
    showSchool,
    setShowSchool,
    showGrade,
    setShowGrade,
    showHoldStudents,
    setShowHoldStudents,
    showWithdrawnStudents,
    setShowWithdrawnStudents,
    cellSize,
    setCellSize,
    fontSize,
    setFontSize,
    // 통합뷰 전용
    onExportImage,
    integrationDisplayOptions,
    onIntegrationDisplayOptionsChange,
    // 퇴원 관리 권한
    canEditWithdrawal = false,
    canReactivateWithdrawal = false,
    // 과목/뷰 전환
    timetableSubject,
    setTimetableSubject,
    setTimetableViewType,
    mathViewMode,
    setMathViewMode,
    hasPermission,
    setIsTimetableSettingsOpen,
    userDepartments,
    roomFilter,
    onRoomFilterChange,
    hiddenTeachers = [],
    onToggleTeacherHidden,
}) => {
    // 드롭다운 상태
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const viewDropdownRef = useRef<HTMLDivElement>(null);
    const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
    const moreDropdownRef = useRef<HTMLDivElement>(null);

    // 퇴원생 드롭다운 상태 (클릭 기반)
    const [isWithdrawnDropdownOpen, setIsWithdrawnDropdownOpen] = useState(false);
    const withdrawnDropdownRef = useRef<HTMLDivElement>(null);
    // 예정 드롭다운 상태 (클릭 기반)
    const [isPendingDropdownOpen, setIsPendingDropdownOpen] = useState(false);
    const pendingDropdownRef = useRef<HTMLDivElement>(null);

    // 퇴원생 상세 모달 상태
    const [selectedWithdrawalEntry, setSelectedWithdrawalEntry] = useState<WithdrawalEntry | null>(null);

    // 퇴원생 클릭 시 WithdrawalEntry 생성
    const handleWithdrawnStudentClick = (studentId: string, isFuture: boolean = false) => {
        console.log('[WithdrawalClick] studentId:', studentId, 'studentMap keys:', Object.keys(studentMap).slice(0, 5));
        const student = studentMap[studentId];
        if (!student) {
            console.warn('[WithdrawalClick] Student not found in studentMap:', studentId);
            return;
        }
        console.log('[WithdrawalClick] Found student:', student.name);

        // 학생 상태에 따라 type 결정
        const isWithdrawn = student.status === 'withdrawn';
        let entry: WithdrawalEntry;

        if (isWithdrawn) {
            entry = {
                student,
                type: 'withdrawn',
                endedSubjects: [...new Set((student.enrollments || []).map(e => e.subject))],
                endedEnrollments: student.enrollments || [],
                effectiveDate: student.withdrawalDate || student.endDate || '',
            };
        } else {
            const { subjects, enrollments } = getEndedSubjects(student);
            const latestDate = enrollments
                .map(e => e.withdrawalDate || e.endDate || '')
                .filter(Boolean)
                .sort()
                .pop() || '';

            entry = {
                student,
                type: 'subject-ended',
                endedSubjects: subjects.length > 0 ? subjects : [...new Set((student.enrollments || []).map(e => e.subject))],
                endedEnrollments: enrollments.length > 0 ? enrollments : student.enrollments || [],
                effectiveDate: latestDate || student.withdrawalDate || student.endDate || '',
            };
        }

        setSelectedWithdrawalEntry(entry);
    };

    // 강사 순서 관리 훅
    const { mathConfig, handleSaveTeacherOrder, handleSaveWeekdayOrder, handleSaveWeekdayGroupOrder } = useMathConfig();

    // 묶음 요일 뷰 여부 (excel-teacher → teacher-based 렌더링)
    const isGroupedView = mathViewMode === 'excel-teacher';

    // 요일 순서 목록 (설정값 or 기본값)
    const weekdayOrderList = useMemo(() => {
        if (mathConfig.weekdayOrder.length > 0) return mathConfig.weekdayOrder;
        return ['월', '화', '수', '목', '금', '토', '일'];
    }, [mathConfig.weekdayOrder]);

    // 요일 그룹 순서 목록 (묶음 뷰용)
    const weekdayGroupOrderList = useMemo(() => {
        if (mathConfig.weekdayGroupOrder.length > 0) return mathConfig.weekdayGroupOrder;
        return DEFAULT_WEEKDAY_GROUP_ORDER;
    }, [mathConfig.weekdayGroupOrder]);

    // 요일 순서 이동
    const moveWeekday = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...weekdayOrderList];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < newOrder.length) {
            [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
            handleSaveWeekdayOrder(newOrder);
        }
    };

    // 요일 그룹 순서 이동
    const moveWeekdayGroup = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...weekdayGroupOrderList];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < newOrder.length) {
            [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
            handleSaveWeekdayGroupOrder(newOrder);
        }
    };

    // 요일 드래그 센서 & 핸들러
    const weekdayDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));
    const handleWeekdayDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = weekdayOrderList.indexOf(active.id as string);
            const newIndex = weekdayOrderList.indexOf(over.id as string);
            handleSaveWeekdayOrder(arrayMove(weekdayOrderList, oldIndex, newIndex));
        }
    };
    const handleWeekdayGroupDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = weekdayGroupOrderList.indexOf(active.id as string);
            const newIndex = weekdayGroupOrderList.indexOf(over.id as string);
            handleSaveWeekdayGroupOrder(arrayMove(weekdayGroupOrderList, oldIndex, newIndex));
        }
    };

    // 강사 순서 이동
    const moveTeacher = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...mathConfig.teacherOrder];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < newOrder.length) {
            [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
            handleSaveTeacherOrder(newOrder);
        }
    };

    // 강사 드래그 앤 드롭
    const teacherDndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );
    const handleTeacherDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = mathConfig.teacherOrder.indexOf(active.id as string);
            const newIndex = mathConfig.teacherOrder.indexOf(over.id as string);
            if (oldIndex !== -1 && newIndex !== -1) {
                handleSaveTeacherOrder(arrayMove(mathConfig.teacherOrder, oldIndex, newIndex));
            }
        }
    };

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        if (!isViewDropdownOpen && !isMoreDropdownOpen && !isWithdrawnDropdownOpen && !isPendingDropdownOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
                setIsViewDropdownOpen(false);
            }
            if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
                setIsMoreDropdownOpen(false);
            }
            if (withdrawnDropdownRef.current && !withdrawnDropdownRef.current.contains(event.target as Node)) {
                setIsWithdrawnDropdownOpen(false);
            }
            if (pendingDropdownRef.current && !pendingDropdownRef.current.contains(event.target as Node)) {
                setIsPendingDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isViewDropdownOpen, isMoreDropdownOpen, isWithdrawnDropdownOpen, isPendingDropdownOpen]);

    // 학생 수 카운트 계산 (현재 시간표에 등록된 학생만, 중복 제거)
    const studentCounts = useMemo(() => {
        // 시간표에 등록된 학생 ID 수집 (중복 제거를 위해 Set 사용)
        const activeStudentIds = new Set<string>();
        const newStudentIds = new Set<string>();  // 신입 (30일 이내)
        const onHoldStudentIds = new Set<string>();
        const withdrawnStudentIds = new Set<string>();

        const now = new Date();
        const today = formatDateKey(now);
        const weekEnd = currentWeekStart
            ? formatDateKey(addDays(currentWeekStart, 6))
            : today;

        // 각 수업의 학생 목록에서 학생 ID 수집 (ClassCard 로직과 완전히 동일)
        filteredClasses.forEach(cls => {
            cls.studentList?.forEach(student => {
                // 재원생: 퇴원일/종료일 없고 대기 아님
                if (!student.withdrawalDate && !student.endDate && !student.onHold) {
                    activeStudentIds.add(student.id);

                    // 신입 체크 (30일 이내 등록)
                    const enrollDate = student.enrollmentDate || student.startDate;
                    if (enrollDate) {
                        const enrollDateObj = new Date(enrollDate);
                        const daysSinceEnroll = Math.floor((now.getTime() - enrollDateObj.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysSinceEnroll >= 0 && daysSinceEnroll <= 30) {
                            newStudentIds.add(student.id);
                        }
                    }
                }
                // 대기생: 대기 상태이고 퇴원일/종료일 없음
                else if (student.onHold && !student.withdrawalDate && !student.endDate) {
                    onHoldStudentIds.add(student.id);
                }
                // 퇴원생: 퇴원일 또는 종료일 있음
                else if (student.withdrawalDate || student.endDate) {
                    withdrawnStudentIds.add(student.id);
                }
            });
        });

        // 대기 학생 목록 (상세 정보 포함)
        const onHoldStudents: Array<{ id: string; name: string; school: string; grade: string; enrollmentDate?: string }> = [];
        onHoldStudentIds.forEach(studentId => {
            const student = studentMap[studentId];
            if (student) {
                onHoldStudents.push({
                    id: student.id,
                    name: student.name,
                    school: student.school || '',
                    grade: student.grade || '',
                    enrollmentDate: student.enrollmentDate
                });
            }
        });

        // 퇴원 학생 목록 (퇴원일/종료일이 오늘이거나 과거)
        const withdrawnStudents: Array<{ id: string; name: string; school: string; grade: string; withdrawalDate?: string }> = [];
        // 퇴원 예정 학생 목록 (퇴원일/종료일이 미래)
        const withdrawnFutureStudents: Array<{ id: string; name: string; school: string; grade: string; withdrawalDate?: string }> = [];

        withdrawnStudentIds.forEach(studentId => {
            const student = studentMap[studentId];
            const effectiveDate = student?.withdrawalDate || student?.endDate;
            if (student && effectiveDate) {
                const studentInfo = {
                    id: student.id,
                    name: student.name,
                    school: student.school || '',
                    grade: student.grade || '',
                    withdrawalDate: effectiveDate
                };

                if (effectiveDate <= today) {
                    // 오늘이거나 과거 퇴원/종료
                    withdrawnStudents.push(studentInfo);
                } else {
                    // 미래 퇴원/종료 예정
                    withdrawnFutureStudents.push(studentInfo);
                }
            }
        });

        return {
            activeCount: activeStudentIds.size,          // 재원생 (중복 제거됨)
            newCount: newStudentIds.size,                // 신입 (30일 이내)
            onHoldCount: onHoldStudentIds.size,          // 대기 (중복 제거됨)
            withdrawnCount: withdrawnStudents.length,    // 퇴원 (과거/오늘)
            withdrawnFutureCount: withdrawnFutureStudents.length,  // 퇴원 예정 (미래)
            onHoldStudents,                              // 대기 학생 상세 목록
            withdrawnStudents,                           // 퇴원 학생 상세 목록
            withdrawnFutureStudents                      // 퇴원 예정 학생 상세 목록
        };
    }, [filteredClasses, studentMap, currentWeekStart]);

    return (
        <div className="flex flex-col flex-shrink-0 min-w-0">
            {/* Main Header Row */}
            <div className={`bg-primary min-h-[2.5rem] flex items-center gap-3 pl-4 border-b border-gray-700 text-xs min-w-0 flex-wrap py-1 overflow-visible ${isSimulationMode ? 'bg-orange-900 border-orange-700' : ''}`}>
                {/* Subject & View Controls */}
                {timetableSubject && setTimetableSubject && hasPermission && (
                    <SubjectControls
                        timetableSubject={timetableSubject}
                        setTimetableSubject={setTimetableSubject}
                        viewType={viewType}
                        setTimetableViewType={setTimetableViewType}
                        mathViewMode={mathViewMode}
                        setMathViewMode={setMathViewMode}
                        hasPermission={hasPermission}
                        setIsTimetableSettingsOpen={setIsTimetableSettingsOpen}
                        userDepartments={userDepartments}
                    />
                )}

                {/* Left: Week Info */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-gray-300 font-medium w-[14em] flex-shrink-0">{weekLabel}</span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={goToPrevWeek}
                            className="p-1 border border-white/20 rounded-sm hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <button
                            onClick={goToThisWeek}
                            className="px-2 py-0.5 text-xxs font-bold border border-white/20 rounded-sm hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            이번주
                        </button>
                        <button
                            onClick={goToNextWeek}
                            className="p-1 border border-white/20 rounded-sm hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    {/* 학생 통계 배지 (통일: 재원/신입/예정/퇴원) */}
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
                        {/* 재원 */}
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-green-900/50 border border-green-700/50 rounded-sm">
                            <span className="text-xxs text-green-400 font-medium">재원</span>
                            <span className="text-xs font-bold text-green-300">{studentCounts.activeCount}</span>
                        </div>
                        {/* 신입 (30일 이내) */}
                        {studentCounts.newCount > 0 && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-pink-900/50 border border-pink-700/50 rounded-sm">
                                <span className="text-xxs text-pink-400 font-medium">신입</span>
                                <span className="text-xs font-bold text-pink-300">{studentCounts.newCount}</span>
                            </div>
                        )}
                        {/* 예정 (대기 + 퇴원예정) - 클릭 기반 드롭다운 */}
                        {(studentCounts.onHoldCount > 0 || studentCounts.withdrawnFutureCount > 0) && (
                            <div className="relative" ref={pendingDropdownRef}>
                                <div
                                    className="flex items-center gap-1 px-2 py-0.5 bg-amber-900/50 border border-amber-700/50 rounded-sm cursor-pointer hover:bg-amber-800/50 transition-colors"
                                    onClick={() => setIsPendingDropdownOpen(!isPendingDropdownOpen)}
                                >
                                    <span className="text-xxs text-amber-400 font-medium">예정</span>
                                    <span className="text-xs font-bold text-amber-300">{studentCounts.onHoldCount + studentCounts.withdrawnFutureCount}</span>
                                </div>
                                {isPendingDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg space-y-2 z-50 min-w-max">
                                        {studentCounts.onHoldStudents.length > 0 && (
                                            <div>
                                                <div className="font-bold text-amber-300 mb-1">대기 ({studentCounts.onHoldCount}명)</div>
                                                {studentCounts.onHoldStudents.map(s => {
                                                    const schoolGrade = formatSchoolGrade(s.school, s.grade);
                                                    return (
                                                        <div key={s.id} className="whitespace-nowrap py-0.5">
                                                            {s.name}/{schoolGrade !== '-' ? schoolGrade : '미입력'}
                                                            {s.enrollmentDate && ` (예정: ${s.enrollmentDate})`}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {studentCounts.withdrawnFutureStudents.length > 0 && (
                                            <div>
                                                <div className="font-bold text-red-300 mb-1">퇴원예정 ({studentCounts.withdrawnFutureCount}명)</div>
                                                {studentCounts.withdrawnFutureStudents.map(s => {
                                                    const schoolGrade = formatSchoolGrade(s.school, s.grade);
                                                    return (
                                                        <div
                                                            key={s.id}
                                                            className="whitespace-nowrap hover:bg-gray-700 px-1 -mx-1 rounded cursor-pointer transition-colors py-0.5"
                                                            onClick={() => {
                                                                setIsPendingDropdownOpen(false);
                                                                handleWithdrawnStudentClick(s.id, true);
                                                            }}
                                                        >
                                                            {s.name}/{schoolGrade !== '-' ? schoolGrade : '미입력'}
                                                            {s.withdrawalDate && ` (퇴원: ${s.withdrawalDate})`}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {/* 퇴원 - 클릭 기반 드롭다운 */}
                        {studentCounts.withdrawnCount > 0 && (
                            <div className="relative" ref={withdrawnDropdownRef}>
                                <div
                                    className="flex items-center gap-1 px-2 py-0.5 bg-white/10 border border-white/20 rounded-sm cursor-pointer hover:bg-white/15 transition-colors"
                                    onClick={() => setIsWithdrawnDropdownOpen(!isWithdrawnDropdownOpen)}
                                >
                                    <span className="text-xxs text-gray-400 font-medium">퇴원</span>
                                    <span className="text-xs font-bold text-gray-300">{studentCounts.withdrawnCount}</span>
                                </div>
                                {isWithdrawnDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg space-y-1 z-50 min-w-max">
                                        {studentCounts.withdrawnStudents.map(s => {
                                            const schoolGrade = formatSchoolGrade(s.school, s.grade);
                                            return (
                                                <div
                                                    key={s.id}
                                                    className="whitespace-nowrap hover:bg-gray-700 px-1 -mx-1 rounded cursor-pointer transition-colors py-0.5"
                                                    onClick={() => {
                                                        setIsWithdrawnDropdownOpen(false);
                                                        handleWithdrawnStudentClick(s.id);
                                                    }}
                                                >
                                                    {s.name}/{schoolGrade !== '-' ? schoolGrade : '미입력'}
                                                    {s.withdrawalDate && ` (퇴원: ${s.withdrawalDate})`}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Simulation Mode 표시 */}
                {isSimulationMode && currentScenarioName && (
                    <span className="flex-shrink-0 text-sm font-black text-white">{currentScenarioName}</span>
                )}
                {isSimulationMode && <span className="text-xxs bg-orange-500 text-white px-1.5 py-0.5 rounded-sm font-bold animate-pulse">SIMULATION</span>}

                {/* Right: Search and Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Simulation Mode Toggle */}
                    {canEdit && onToggleSimulation && (
                        <>
                            <div
                                onClick={onToggleSimulation}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border cursor-pointer transition-all ${isSimulationMode
                                    ? 'bg-orange-900/50 border-orange-600 hover:bg-orange-800/50'
                                    : 'bg-white/10 border-white/20 hover:bg-white/15'
                                    }`}
                            >
                                <ArrowRightLeft size={14} className={isSimulationMode ? 'text-orange-400' : 'text-gray-400'} />
                                <span className={`text-xs font-bold ${isSimulationMode ? 'text-orange-300' : 'text-gray-300'}`}>
                                    {isSimulationMode ? '시뮬레이션 모드' : '실시간 모드'}
                                </span>
                            </div>

                            {/* Separator */}
                            <div className="w-px h-4 bg-white/20 mx-1"></div>
                        </>
                    )}

                    {/* Mode Toggle - 조회/수정 모드 */}
                    <div className="flex bg-white/10 rounded-sm p-0.5">
                        <button
                            onClick={() => setMode('view')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'view' ? 'bg-accent text-primary shadow-sm' : 'text-gray-400 hover:bg-white/10'}`}
                        >
                            <Eye size={12} />
                            조회
                        </button>
                        {canEdit && (
                            <button
                                onClick={() => setMode('edit')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'edit' ? 'bg-accent text-primary shadow-sm' : 'text-gray-400 hover:bg-white/10'}`}
                            >
                                <Edit size={12} />
                                수정
                            </button>
                        )}
                    </div>

                    {/* Separator */}
                    <div className="w-px h-4 bg-white/20 mx-1"></div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={viewType === 'class' ? '수업명 검색...' : '학생 검색...'}
                            className="pl-7 pr-6 py-1 w-32 text-xs border border-white/20 rounded-sm bg-white/10 text-white placeholder-gray-500 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Separator */}
                    <div className="w-px h-4 bg-white/20 mx-1"></div>

                    {/* 더보기 드롭다운 (공유 + 저장 통합) */}
                    {(onExportImage || (isMaster && onOpenEmbedManager)) && (
                        <div className="relative" ref={moreDropdownRef}>
                            <button
                                onClick={() => setIsMoreDropdownOpen(!isMoreDropdownOpen)}
                                className="px-2 py-1 border border-white/20 rounded-sm text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-1"
                                title="더보기"
                            >
                                <Download size={12} />
                                내보내기
                            </button>
                            {isMoreDropdownOpen && (
                                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-sm shadow-lg z-50 min-w-[140px]">
                                    {onExportImage && (
                                        <button
                                            onClick={() => {
                                                onExportImage();
                                                setIsMoreDropdownOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            <Download size={12} />
                                            이미지 저장
                                        </button>
                                    )}
                                    {isMaster && onOpenEmbedManager && (
                                        <button
                                            onClick={() => {
                                                onOpenEmbedManager();
                                                setIsMoreDropdownOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-50 transition-colors"
                                        >
                                            <Link2 size={12} />
                                            공유 링크 관리
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 통합뷰 전용 버튼들 (보기) */}
                    {viewType === 'class' && (
                        <>
                            {/* 통합뷰 보기 설정 드롭다운 */}
                            {integrationDisplayOptions && onIntegrationDisplayOptionsChange && (
                                <div className="relative" ref={viewDropdownRef}>
                                    <button
                                        onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                                        className="px-2 py-1 border border-white/20 rounded-sm text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-1"
                                        title="보기 설정"
                                    >
                                        <SlidersHorizontal size={12} />
                                        보기
                                    </button>
                                    {isViewDropdownOpen && (
                                        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-sm shadow-lg z-50 w-[280px] max-h-[350px] overflow-y-auto">
                                            {/* 표시 옵션 */}
                                            <div className="px-3 py-2 border-b border-gray-100">
                                                <div className="text-xxs font-bold text-gray-600 mb-2">표시 옵션</div>
                                                <div className="grid grid-cols-2 gap-1">
                                                    <button
                                                        onClick={() => onIntegrationDisplayOptionsChange('showStudents', !integrationDisplayOptions.showStudents)}
                                                        className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${integrationDisplayOptions.showStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                            }`}
                                                    >
                                                        학생목록
                                                    </button>
                                                    <button
                                                        onClick={() => onIntegrationDisplayOptionsChange('showRoom', !integrationDisplayOptions.showRoom)}
                                                        className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${integrationDisplayOptions.showRoom ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                            }`}
                                                    >
                                                        강의실
                                                    </button>
                                                    <button
                                                        onClick={() => onIntegrationDisplayOptionsChange('showTeacher', !integrationDisplayOptions.showTeacher)}
                                                        className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${integrationDisplayOptions.showTeacher ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                            }`}
                                                    >
                                                        담임 정보
                                                    </button>
                                                    <button
                                                        onClick={() => onIntegrationDisplayOptionsChange('showSchedule', !integrationDisplayOptions.showSchedule)}
                                                        className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${integrationDisplayOptions.showSchedule ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                            }`}
                                                    >
                                                        스케줄
                                                    </button>
                                                </div>
                                            </div>
                                            {/* 학생 정보 표시 옵션 */}
                                            <div className="px-3 py-2">
                                                <div className="text-xxs font-bold text-gray-600 mb-2">학생 정보</div>
                                                <div className="grid grid-cols-2 gap-1">
                                                    <button
                                                        onClick={() => onIntegrationDisplayOptionsChange('showSchool', !integrationDisplayOptions.showSchool)}
                                                        className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${integrationDisplayOptions.showSchool ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                            }`}
                                                    >
                                                        학교
                                                    </button>
                                                    <button
                                                        onClick={() => onIntegrationDisplayOptionsChange('showGrade', !integrationDisplayOptions.showGrade)}
                                                        className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${integrationDisplayOptions.showGrade ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                            }`}
                                                    >
                                                        학년
                                                    </button>
                                                    <button
                                                        onClick={() => onIntegrationDisplayOptionsChange('showHoldStudents', !integrationDisplayOptions.showHoldStudents)}
                                                        className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${integrationDisplayOptions.showHoldStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                            }`}
                                                    >
                                                        대기
                                                    </button>
                                                    <button
                                                        onClick={() => onIntegrationDisplayOptionsChange('showWithdrawnStudents', !integrationDisplayOptions.showWithdrawnStudents)}
                                                        className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${integrationDisplayOptions.showWithdrawnStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                            }`}
                                                    >
                                                        퇴원
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* View Settings - 인라인 드롭다운 (강사뷰/날짜뷰만) */}
                    {viewType !== 'class' && (
                        <div className="relative" ref={viewDropdownRef}>
                            <button
                                onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                                className="px-2 py-1 border border-white/20 rounded-sm text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-1"
                                title="보기 설정"
                            >
                                <SlidersHorizontal size={12} />
                                보기
                            </button>
                            {isViewDropdownOpen && (
                                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-sm shadow-lg z-50 w-[320px] max-h-[400px] overflow-y-auto">
                                    {/* 요일 표시 */}
                                    {selectedDays && setSelectedDays && (
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <div className="text-xxs font-bold text-gray-600 mb-2">요일 표시</div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => {
                                                        const weekdays = ['월', '화', '수', '목', '금'];
                                                        const hasWeekdays = weekdays.some(d => selectedDays.includes(d));
                                                        if (hasWeekdays) {
                                                            setSelectedDays(selectedDays.filter(d => !weekdays.includes(d)));
                                                        } else {
                                                            setSelectedDays([...new Set([...selectedDays, ...weekdays])]);
                                                        }
                                                    }}
                                                    className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold border ${['월', '화', '수', '목', '금'].some(d => selectedDays.includes(d))
                                                            ? 'bg-accent text-primary border-accent'
                                                            : 'bg-gray-100 text-gray-400 border-gray-200'
                                                        }`}
                                                >
                                                    평일
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const weekends = ['토', '일'];
                                                        const hasWeekends = weekends.some(d => selectedDays.includes(d));
                                                        if (hasWeekends) {
                                                            setSelectedDays(selectedDays.filter(d => !weekends.includes(d)));
                                                        } else {
                                                            setSelectedDays([...new Set([...selectedDays, ...weekends])]);
                                                        }
                                                    }}
                                                    className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold border ${['토', '일'].some(d => selectedDays.includes(d))
                                                            ? 'bg-accent text-primary border-accent'
                                                            : 'bg-gray-100 text-gray-400 border-gray-200'
                                                        }`}
                                                >
                                                    주말
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {/* 강의실 필터 */}
                                    {roomFilter && onRoomFilterChange && (
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <div className="text-xxs font-bold text-gray-600 mb-2">강의실</div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => onRoomFilterChange('main', !roomFilter.main)}
                                                    className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold border ${roomFilter.main ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                                                >
                                                    본원
                                                </button>
                                                <button
                                                    onClick={() => onRoomFilterChange('barun', !roomFilter.barun)}
                                                    className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold border ${roomFilter.barun ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                                                >
                                                    바른
                                                </button>
                                                <button
                                                    onClick={() => onRoomFilterChange('godeung', !roomFilter.godeung)}
                                                    className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold border ${roomFilter.godeung ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                                                >
                                                    고등
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* 요일 순서 (개별 요일 or 그룹) */}
                                    <div className="px-3 py-2 border-b border-gray-100">
                                        <div className="text-xxs font-bold text-gray-600 mb-2 flex items-center gap-1">
                                            <CalendarIcon size={12} />
                                            {isGroupedView ? '그룹 순서' : '요일 순서'}
                                        </div>
                                        {isGroupedView ? (
                                            <DndContext sensors={weekdayDndSensors} collisionDetection={closestCenter} onDragEnd={handleWeekdayGroupDragEnd}>
                                                <SortableContext items={weekdayGroupOrderList} strategy={verticalListSortingStrategy}>
                                                    <div className="space-y-0.5">
                                                        {weekdayGroupOrderList.map((group, index) => (
                                                            <SortableWeekdayItem
                                                                key={group}
                                                                id={group}
                                                                index={index}
                                                                total={weekdayGroupOrderList.length}
                                                                onMoveUp={() => moveWeekdayGroup(index, 'up')}
                                                                onMoveDown={() => moveWeekdayGroup(index, 'down')}
                                                            />
                                                        ))}
                                                    </div>
                                                </SortableContext>
                                            </DndContext>
                                        ) : (
                                            <DndContext sensors={weekdayDndSensors} collisionDetection={closestCenter} onDragEnd={handleWeekdayDragEnd}>
                                                <SortableContext items={weekdayOrderList} strategy={verticalListSortingStrategy}>
                                                    <div className="space-y-0.5">
                                                        {weekdayOrderList.map((day, index) => (
                                                            <SortableWeekdayItem
                                                                key={day}
                                                                id={day}
                                                                index={index}
                                                                total={weekdayOrderList.length}
                                                                onMoveUp={() => moveWeekday(index, 'up')}
                                                                onMoveDown={() => moveWeekday(index, 'down')}
                                                            />
                                                        ))}
                                                    </div>
                                                </SortableContext>
                                            </DndContext>
                                        )}
                                    </div>

                                    {/* 표시 옵션 */}
                                    <div className="px-3 py-2 border-b border-gray-100">
                                        <div className="text-xxs font-bold text-gray-600 mb-2">표시 옵션</div>
                                        <div className="grid grid-cols-3 gap-1">
                                            {showStudents !== undefined && setShowStudents && (
                                                <button
                                                    onClick={() => setShowStudents(!showStudents)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${showStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                        }`}
                                                >
                                                    학생목록
                                                </button>
                                            )}
                                            {showClassName !== undefined && setShowClassName && (
                                                <button
                                                    onClick={() => setShowClassName(!showClassName)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${showClassName ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                        }`}
                                                >
                                                    수업명
                                                </button>
                                            )}
                                            {showSchool !== undefined && setShowSchool && (
                                                <button
                                                    onClick={() => setShowSchool(!showSchool)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${showSchool ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                        }`}
                                                >
                                                    학교
                                                </button>
                                            )}
                                            {showGrade !== undefined && setShowGrade && (
                                                <button
                                                    onClick={() => setShowGrade(!showGrade)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${showGrade ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                        }`}
                                                >
                                                    학년
                                                </button>
                                            )}
                                            {showHoldStudents !== undefined && setShowHoldStudents && (
                                                <button
                                                    onClick={() => setShowHoldStudents(!showHoldStudents)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${showHoldStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                        }`}
                                                >
                                                    대기
                                                </button>
                                            )}
                                            {showWithdrawnStudents !== undefined && setShowWithdrawnStudents && (
                                                <button
                                                    onClick={() => setShowWithdrawnStudents(!showWithdrawnStudents)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${showWithdrawnStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                        }`}
                                                >
                                                    퇴원
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* 크기 설정 */}
                                    {cellSize && setCellSize && fontSize && setFontSize && (
                                        <div className="px-3 py-2">
                                            <div className="text-xxs font-bold text-gray-600 mb-2">크기 설정</div>
                                            {/* 사이즈 */}
                                            <div className="mb-2">
                                                <div className="text-xxs text-gray-500 mb-1">사이즈</div>
                                                <div className="flex gap-0.5">
                                                    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => setCellSize(s)}
                                                            className={`flex-1 py-1 text-micro rounded-sm border ${cellSize === s
                                                                    ? 'bg-accent text-primary border-accent font-bold'
                                                                    : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {s === 'xs' ? '가장작음' : s === 'sm' ? '작음' : s === 'md' ? '보통' : s === 'lg' ? '큼' : '매우큼'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* 글자 크기 */}
                                            <div>
                                                <div className="text-xxs text-gray-500 mb-1">글자 크기</div>
                                                <div className="flex gap-1">
                                                    {(['small', 'normal', 'large'] as const).map(f => (
                                                        <button
                                                            key={f}
                                                            onClick={() => setFontSize(f)}
                                                            className={`flex-1 py-1 text-xxs rounded-sm border ${fontSize === f
                                                                    ? 'bg-accent text-primary border-accent font-bold'
                                                                    : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {f === 'small' ? '작게' : f === 'normal' ? '보통' : '크게'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* 강사 순서 설정 - 강사뷰/엑셀뷰에서 표시 */}
                                    {(viewType === 'teacher' || viewType === 'excel') && mathConfig.teacherOrder.length > 0 && (
                                        <div className="px-3 py-2 border-t border-gray-100">
                                            <div className="text-xxs font-bold text-gray-600 mb-2 flex items-center gap-1">
                                                <Users size={12} />
                                                강사 순서
                                            </div>
                                            <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                                                <DndContext
                                                    sensors={teacherDndSensors}
                                                    collisionDetection={closestCenter}
                                                    onDragEnd={handleTeacherDragEnd}
                                                >
                                                    <SortableContext
                                                        items={mathConfig.teacherOrder}
                                                        strategy={verticalListSortingStrategy}
                                                    >
                                                        {mathConfig.teacherOrder.map((teacher) => (
                                                            <SortableTeacherItem
                                                                key={teacher}
                                                                id={teacher}
                                                                isHidden={hiddenTeachers.includes(teacher)}
                                                                onToggleHidden={() => onToggleTeacherHidden?.(teacher)}
                                                            />
                                                        ))}
                                                    </SortableContext>
                                                </DndContext>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pending Moves */}
                    {pendingMovesCount > 0 && (
                        <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-sm px-2 py-1">
                            <span className="text-xs font-bold text-orange-600">
                                {pendingMovesCount}건 변경
                                {scheduledMovesCount > 0 && (
                                    <span className="text-blue-600 ml-1">(예정 {scheduledMovesCount}건)</span>
                                )}
                            </span>
                            <button
                                onClick={handleSavePendingMoves}
                                disabled={isSaving}
                                className="px-2 py-0.5 bg-green-500 text-white rounded-sm text-xs font-bold hover:bg-green-600 disabled:opacity-50"
                            >
                                {isSaving ? '저장중...' : '💾 저장'}
                            </button>
                            <button
                                onClick={handleCancelPendingMoves}
                                disabled={isSaving}
                                className="px-2 py-0.5 bg-gray-500 text-white rounded-sm text-xs font-bold hover:bg-gray-600 disabled:opacity-50"
                            >
                                ↩ 취소
                            </button>
                        </div>
                    )}
                </div>
                <div className="w-4 flex-shrink-0"></div>
            </div>

            {/* Simulation Action Bar - 두 번째 줄 */}
            {isSimulationMode && canEdit && (
                <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-orange-50 border-b border-orange-200">
                    <button
                        onClick={onCopyLiveToDraft}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-sm text-xs font-bold hover:bg-orange-50 shadow-sm transition-colors"
                        title="현재 실시간 시간표를 복사해옵니다 (기존 시뮬레이션 데이터 덮어쓰기)"
                    >
                        <Copy size={12} />
                        현재 상태 가져오기
                    </button>
                    <button
                        onClick={onPublishDraftToLive}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-sm text-xs font-bold hover:bg-orange-700 shadow-sm transition-colors"
                        title="시뮬레이션 내용을 실제 시간표에 적용합니다 (주의)"
                    >
                        <Upload size={12} />
                        실제 반영
                    </button>
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

            {/* 퇴원생 상세 모달 */}
            {selectedWithdrawalEntry && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center"
                    style={{ zIndex: 10000 }}
                    onClick={() => setSelectedWithdrawalEntry(null)}
                >
                    <div
                        className="bg-white w-[400px] max-w-[90vw] max-h-[80vh] rounded-sm shadow-xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 모달 헤더 */}
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-primary">퇴원 정보</h3>
                            <button
                                onClick={() => setSelectedWithdrawalEntry(null)}
                                className="p-1 hover:bg-gray-200 rounded-sm transition-colors"
                            >
                                <X size={16} className="text-gray-500" />
                            </button>
                        </div>
                        {/* 모달 콘텐츠 */}
                        <div className="flex-1 overflow-y-auto">
                            <WithdrawalStudentDetail
                                entry={selectedWithdrawalEntry}
                                canEdit={canEditWithdrawal}
                                canReactivate={canReactivateWithdrawal}
                                onReactivated={() => setSelectedWithdrawalEntry(null)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableHeader;
