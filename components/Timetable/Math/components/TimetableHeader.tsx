import React, { useMemo, useState, useEffect, useRef } from 'react';
import { addDays } from 'date-fns';
import {
    ChevronLeft, ChevronRight, Search, X, Settings, Eye, Edit, SlidersHorizontal,
    ArrowRightLeft, Copy, Upload, Save, Link2, Users, ChevronUp, ChevronDown, GripVertical, Download
} from 'lucide-react';
import { UnifiedStudent, TimetableClass } from '../../../../types';
import { formatSchoolGrade } from '../../../../utils/studentUtils';
import { formatDateKey } from '../../../../utils/dateUtils';
import { useMathConfig } from '../hooks/useMathConfig';
import WithdrawalStudentDetail from '../../../WithdrawalManagement/WithdrawalStudentDetail';
import { WithdrawalEntry } from '../../../../hooks/useWithdrawalFilters';

interface TimetableHeaderProps {
    weekLabel: string;
    goToPrevWeek: () => void;
    goToNextWeek: () => void;
    goToThisWeek: () => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    viewType: 'teacher' | 'room' | 'class';
    setIsTeacherOrderModalOpen: (isOpen: boolean) => void;
    setIsViewSettingsOpen: (isOpen: boolean) => void;
    pendingMovesCount: number;
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
    canReactivateWithdrawal = false
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

        // 과목별 수강종료 여부 판정
        const getEndedSubjects = (s: UnifiedStudent): { subjects: string[]; enrollments: typeof s.enrollments } => {
            const bySubject = new Map<string, typeof s.enrollments>();
            for (const e of s.enrollments || []) {
                const list = bySubject.get(e.subject) || [];
                list.push(e);
                bySubject.set(e.subject, list);
            }

            const endedSubjects: string[] = [];
            const endedEnrollments: typeof s.enrollments = [];

            for (const [subject, enrollments] of bySubject) {
                const hasActive = enrollments.some(e => !e.withdrawalDate && !e.endDate);
                if (!hasActive && enrollments.length > 0) {
                    endedSubjects.push(subject);
                    endedEnrollments.push(...enrollments);
                }
            }

            return { subjects: endedSubjects, enrollments: endedEnrollments };
        };

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
    const { mathConfig, handleSaveTeacherOrder } = useMathConfig();

    // 강사 순서 이동
    const moveTeacher = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...mathConfig.teacherOrder];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < newOrder.length) {
            [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
            handleSaveTeacherOrder(newOrder);
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
        <div className="flex flex-col flex-shrink-0">
            {/* Main Header Row */}
            <div className={`bg-gray-50 h-10 flex items-center justify-between px-4 border-b border-gray-200 text-xs relative ${isSimulationMode ? 'bg-orange-50 border-orange-200' : ''}`}>
            {/* Left: Week Info */}
            <div className="flex items-center gap-3">
                <span className="text-gray-600 font-medium">{weekLabel}</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={goToPrevWeek}
                        className="p-1 border border-gray-300 rounded-sm hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        onClick={goToThisWeek}
                        className="px-2 py-0.5 text-xxs font-bold border border-gray-300 rounded-sm hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        이번주
                    </button>
                    <button
                        onClick={goToNextWeek}
                        className="p-1 border border-gray-300 rounded-sm hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>

                {/* 학생 통계 배지 (통일: 재원/신입/예정/퇴원) */}
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                    {/* 재원 */}
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-sm">
                        <span className="text-xxs text-green-700 font-medium">재원</span>
                        <span className="text-xs font-bold text-green-800">{studentCounts.activeCount}</span>
                    </div>
                    {/* 신입 (30일 이내) */}
                    {studentCounts.newCount > 0 && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-pink-50 border border-pink-200 rounded-sm">
                            <span className="text-xxs text-pink-700 font-medium">신입</span>
                            <span className="text-xs font-bold text-pink-800">{studentCounts.newCount}</span>
                        </div>
                    )}
                    {/* 예정 (대기 + 퇴원예정) - 클릭 기반 드롭다운 */}
                    {(studentCounts.onHoldCount > 0 || studentCounts.withdrawnFutureCount > 0) && (
                        <div className="relative" ref={pendingDropdownRef}>
                            <div
                                className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-sm cursor-pointer hover:bg-amber-100 transition-colors"
                                onClick={() => setIsPendingDropdownOpen(!isPendingDropdownOpen)}
                            >
                                <span className="text-xxs text-amber-700 font-medium">예정</span>
                                <span className="text-xs font-bold text-amber-800">{studentCounts.onHoldCount + studentCounts.withdrawnFutureCount}</span>
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
                                className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-300 rounded-sm cursor-pointer hover:bg-gray-200 transition-colors"
                                onClick={() => setIsWithdrawnDropdownOpen(!isWithdrawnDropdownOpen)}
                            >
                                <span className="text-xxs text-gray-700 font-medium">퇴원</span>
                                <span className="text-xs font-bold text-gray-800">{studentCounts.withdrawnCount}</span>
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

            {/* Center: 시간표 제목 */}
            <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-black text-gray-800 tracking-tight flex items-center gap-2">
                <span>
                    {isSimulationMode && currentScenarioName
                        ? currentScenarioName
                        : viewType === 'teacher' ? '인재원 수학 강사 시간표'
                        : viewType === 'room' ? '인재원 수학 강의실 시간표'
                        : '인재원 수학 통합 시간표'
                    }
                </span>
                {isSimulationMode && <span className="text-xxs bg-orange-500 text-white px-1.5 py-0.5 rounded-sm font-bold animate-pulse">SIMULATION</span>}
            </h1>

            {/* Right: Search and Actions */}
            <div className="flex items-center gap-2">
                {/* Simulation Mode Toggle */}
                {canEdit && onToggleSimulation && (
                    <>
                        <div
                            onClick={onToggleSimulation}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border cursor-pointer transition-all ${isSimulationMode
                                ? 'bg-orange-50 border-orange-300 hover:bg-orange-100'
                                : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <ArrowRightLeft size={14} className={isSimulationMode ? 'text-orange-600' : 'text-gray-500'} />
                            <span className={`text-xs font-bold ${isSimulationMode ? 'text-orange-700' : 'text-gray-600'}`}>
                                {isSimulationMode ? '시뮬레이션 모드' : '실시간 모드'}
                            </span>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    </>
                )}

                {/* Mode Toggle - 조회/수정 모드 */}
                <div className="flex bg-gray-200 rounded-sm p-0.5">
                    <button
                        onClick={() => setMode('view')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'view' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Eye size={12} />
                        조회
                    </button>
                    {canEdit && (
                        <button
                            onClick={() => setMode('edit')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <Edit size={12} />
                            수정
                        </button>
                    )}
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-gray-300 mx-1"></div>

                {/* Search */}
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={viewType === 'class' ? '수업명 검색...' : '학생 검색...'}
                        className="pl-7 pr-6 py-1 w-32 text-xs border border-gray-300 rounded-sm bg-white text-gray-700 placeholder-gray-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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

                {/* 더보기 드롭다운 (공유 + 저장 통합) */}
                {(onExportImage || (isMaster && onOpenEmbedManager)) && (
                    <div className="relative" ref={moreDropdownRef}>
                        <button
                            onClick={() => setIsMoreDropdownOpen(!isMoreDropdownOpen)}
                            className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
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
                                    className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
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
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                        integrationDisplayOptions.showStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    학생목록
                                                </button>
                                                <button
                                                    onClick={() => onIntegrationDisplayOptionsChange('showRoom', !integrationDisplayOptions.showRoom)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                        integrationDisplayOptions.showRoom ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    강의실
                                                </button>
                                                <button
                                                    onClick={() => onIntegrationDisplayOptionsChange('showTeacher', !integrationDisplayOptions.showTeacher)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                        integrationDisplayOptions.showTeacher ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    담임 정보
                                                </button>
                                                <button
                                                    onClick={() => onIntegrationDisplayOptionsChange('showSchedule', !integrationDisplayOptions.showSchedule)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                        integrationDisplayOptions.showSchedule ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
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
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                        integrationDisplayOptions.showSchool ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    학교
                                                </button>
                                                <button
                                                    onClick={() => onIntegrationDisplayOptionsChange('showGrade', !integrationDisplayOptions.showGrade)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                        integrationDisplayOptions.showGrade ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    학년
                                                </button>
                                                <button
                                                    onClick={() => onIntegrationDisplayOptionsChange('showHoldStudents', !integrationDisplayOptions.showHoldStudents)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                        integrationDisplayOptions.showHoldStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    대기
                                                </button>
                                                <button
                                                    onClick={() => onIntegrationDisplayOptionsChange('showWithdrawnStudents', !integrationDisplayOptions.showWithdrawnStudents)}
                                                    className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                        integrationDisplayOptions.showWithdrawnStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
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
                        className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
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
                                            className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                ['월', '화', '수', '목', '금'].some(d => selectedDays.includes(d))
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
                                            className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                ['토', '일'].some(d => selectedDays.includes(d))
                                                    ? 'bg-accent text-primary border-accent'
                                                    : 'bg-gray-100 text-gray-400 border-gray-200'
                                            }`}
                                        >
                                            주말
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* 표시 옵션 */}
                            <div className="px-3 py-2 border-b border-gray-100">
                                <div className="text-xxs font-bold text-gray-600 mb-2">표시 옵션</div>
                                <div className="grid grid-cols-3 gap-1">
                                    {showStudents !== undefined && setShowStudents && (
                                        <button
                                            onClick={() => setShowStudents(!showStudents)}
                                            className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                showStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                            }`}
                                        >
                                            학생목록
                                        </button>
                                    )}
                                    {showClassName !== undefined && setShowClassName && (
                                        <button
                                            onClick={() => setShowClassName(!showClassName)}
                                            className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                showClassName ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                            }`}
                                        >
                                            수업명
                                        </button>
                                    )}
                                    {showSchool !== undefined && setShowSchool && (
                                        <button
                                            onClick={() => setShowSchool(!showSchool)}
                                            className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                showSchool ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                            }`}
                                        >
                                            학교
                                        </button>
                                    )}
                                    {showGrade !== undefined && setShowGrade && (
                                        <button
                                            onClick={() => setShowGrade(!showGrade)}
                                            className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                showGrade ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                            }`}
                                        >
                                            학년
                                        </button>
                                    )}
                                    {showHoldStudents !== undefined && setShowHoldStudents && (
                                        <button
                                            onClick={() => setShowHoldStudents(!showHoldStudents)}
                                            className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                showHoldStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
                                            }`}
                                        >
                                            대기
                                        </button>
                                    )}
                                    {showWithdrawnStudents !== undefined && setShowWithdrawnStudents && (
                                        <button
                                            onClick={() => setShowWithdrawnStudents(!showWithdrawnStudents)}
                                            className={`py-1.5 px-2 rounded-sm text-xxs font-bold border ${
                                                showWithdrawnStudents ? 'bg-accent text-primary border-accent' : 'bg-gray-100 text-gray-400 border-gray-200'
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
                                                    className={`flex-1 py-1 text-micro rounded-sm border ${
                                                        cellSize === s
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
                                                    className={`flex-1 py-1 text-xxs rounded-sm border ${
                                                        fontSize === f
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
                            {/* 강사 순서 설정 - 강사뷰에서만 표시 */}
                            {viewType === 'teacher' && mathConfig.teacherOrder.length > 0 && (
                                <div className="px-3 py-2 border-t border-gray-100">
                                    <div className="text-xxs font-bold text-gray-600 mb-2 flex items-center gap-1">
                                        <Users size={12} />
                                        강사 순서
                                    </div>
                                    <div className="space-y-0.5 max-h-[150px] overflow-y-auto">
                                        {mathConfig.teacherOrder.map((teacher, index) => (
                                            <div key={teacher} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-sm group">
                                                <div className="flex items-center gap-2">
                                                    <GripVertical size={12} className="text-gray-300" />
                                                    <span className="text-xs text-gray-700">{teacher}</span>
                                                </div>
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => moveTeacher(index, 'up')}
                                                        disabled={index === 0}
                                                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="위로 이동"
                                                    >
                                                        <ChevronUp size={14} className="text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => moveTeacher(index, 'down')}
                                                        disabled={index === mathConfig.teacherOrder.length - 1}
                                                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="아래로 이동"
                                                    >
                                                        <ChevronDown size={14} className="text-gray-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
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
