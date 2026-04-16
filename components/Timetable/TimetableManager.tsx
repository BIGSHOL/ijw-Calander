import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { TimetableClass, Teacher, ClassKeywordColor, TimetableSubjectType } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { VideoLoading } from '../Common/VideoLoading';
import { getTodayKST, getWeekReferenceDate } from '../../utils/dateUtils';
import { format, addDays, startOfWeek, addWeeks, subWeeks, getMonth, getYear } from 'date-fns';
import { ko } from 'date-fns/locale';
// Performance: bundle-dynamic-imports - EnglishTimetable lazy load (초기 번들 ~150KB 절감)
const EnglishTimetable = lazy(() => import('./English/EnglishTimetable'));
import TeacherOrderModal from './English/TeacherOrderModal';
import { useMathConfig } from './Math/hooks/useMathConfig';
import { useTimetableClasses } from './Math/hooks/useTimetableClasses';
import { useClassOperations } from './Math/hooks/useClassOperations';
import { useStudentDragDrop } from './Math/hooks/useStudentDragDrop';
import { useMathClassStudents } from './Math/hooks/useMathClassStudents';
import { useStudents } from '../../hooks/useStudents';
import { useShuttleNames } from '../../hooks/useShuttleNames';
import { useWeeklyAbsentStudents } from '../../hooks/useWeeklyAbsentStudents';
import { UnifiedStudent } from '../../types';
import TimetableHeader from './Math/components/TimetableHeader';
import TimetableGrid from './Math/components/TimetableGrid';
import MathClassTab from './Math/MathClassTab';

// Performance: bundle-dynamic-imports - Modal components lazy load (~150-200KB bundle reduction)
const AddClassModal = lazy(() => import('../ClassManagement/AddClassModal'));
const ClassDetailModal = lazy(() => import('../ClassManagement/ClassDetailModal'));
const StudentDetailModal = lazy(() => import('../StudentManagement/StudentDetailModal'));
const SimpleViewSettingsModal = lazy(() => import('./Math/components/Modals/SimpleViewSettingsModal'));
const ScenarioManagementModal = lazy(() => import('./Math/ScenarioManagementModal'));
import { ClassInfo, useClasses } from '../../hooks/useClasses';
import { ALL_WEEKDAYS, MATH_PERIODS, ENGLISH_PERIODS } from './constants';
import { MathSimulationProvider, useMathSimulation } from './Math/context/SimulationContext';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';
import EmbedTokenManager from '../Embed/EmbedTokenManager';
import { useMathSettings, type MathIntegrationSettings } from './Math/hooks/useMathSettings';
import ExportImageModal, { ExportGroup } from '../Common/ExportImageModal';
import type { ExportGroupInfo } from './Math/MathClassTab';
import WithdrawalStudentDetail from '../WithdrawalManagement/WithdrawalStudentDetail';
import { WithdrawalEntry } from '../../hooks/useWithdrawalFilters';
import ScheduledDateModal from './Math/components/ScheduledDateModal';
import { doc, collection, collectionGroup, query, where, getDocs, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';

// Performance Note (bundle-dynamic-imports): Lazy load Generic Timetable
const GenericTimetable = lazy(() => import('./Generic/GenericTimetable'));
const ShuttleTimetable = lazy(() => import('./Shuttle/ShuttleTimetable'));
const AllSubjectsTimetable = lazy(() => import('./AllSubjectsTimetable'));

// MathTimetableContent를 외부로 분리하여 Hook 순서 에러 방지
interface MathTimetableContentProps {
    weekLabel: string;
    goToPrevWeek: () => void;
    goToNextWeek: () => void;
    goToThisWeek: () => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    viewType: 'teacher' | 'room' | 'class' | 'excel';
    setIsTeacherOrderModalOpen: (open: boolean) => void;
    setIsViewSettingsOpen: (open: boolean) => void;
    pendingMovesCount: number;
    scheduledMovesCount: number;
    scheduledStudentDates?: Map<string, string>;  // studentId → scheduledDate (시뮬레이션 드래그 차단용)
    pendingMovedStudentIds?: Set<string>;
    pendingMoveFromMap?: Map<string, Set<string>>;  // classId → 출발지 학생 IDs
    pendingMoveSchedules?: Map<string, string | undefined>;  // studentId → scheduledDate (툴팁용)
    handleSavePendingMoves: () => void;
    handleCancelPendingMoves: () => void;
    isSaving: boolean;
    mode: 'view' | 'edit';
    setMode: (mode: 'view' | 'edit') => void;
    canEditMath: boolean;
    filteredClasses: TimetableClass[];
    allResources: string[];
    orderedSelectedDays: string[];
    weekDates: Record<string, { date: Date; formatted: string }>;
    currentPeriods: string[];
    teachers: Teacher[];
    cellSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    setCellSize: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => void;
    columnWidth: 'compact' | 'narrow' | 'normal' | 'wide' | 'x-wide';
    rowHeight: 'compact' | 'short' | 'normal' | 'tall' | 'very-tall';
    fontSize: 'small' | 'normal' | 'large';
    setFontSize: (size: 'small' | 'normal' | 'large') => void;
    showClassName: boolean;
    setShowClassName: (show: boolean) => void;
    showSchool: boolean;
    setShowSchool: (show: boolean) => void;
    showGrade: boolean;
    setShowGrade: (show: boolean) => void;
    showEmptyRooms: boolean;
    showStudents: boolean;
    setShowStudents: (show: boolean) => void;
    showHoldStudents: boolean;
    setShowHoldStudents: (show: boolean) => void;
    showWithdrawnStudents: boolean;
    setShowWithdrawnStudents: (show: boolean) => void;
    dragOverClassId: string | null;
    handleDragStart: (e: React.DragEvent, studentId: string, classId: string, zone?: string) => void;
    handleDragOver: (e: React.DragEvent, classId: string) => void;
    handleDragLeave: () => void;
    handleDrop: (e: React.DragEvent, classId: string, zone?: string) => void;
    handleMultiDrop: (studentIds: string[], fromClassId: string, toClassId: string, toZone?: string) => void;
    currentSubjectFilter: string;
    studentMap: Record<string, UnifiedStudent>;
    timetableViewMode: string;
    classKeywords: ClassKeywordColor[];
    setSelectedClassInfo: (info: ClassInfo | null) => void;
    setSelectedStudentForModal: (student: UnifiedStudent | null) => void;
    isAddClassOpen: boolean;
    setIsAddClassOpen: (open: boolean) => void;
    sortedTeachers: string[];
    selectedClassInfo: ClassInfo | null;
    selectedStudentForModal: UnifiedStudent | null;
    canManageStudents: boolean;
    mathConfig: { teacherOrder: string[]; weekdayOrder: string[]; weekdayGroupOrder: string[] };
    handleSaveTeacherOrder: (order: string[]) => void;
    isTeacherOrderModalOpen: boolean;
    isViewSettingsOpen: boolean;
    selectedDays: string[];
    setSelectedDays: (days: string[]) => void;
    currentMonday: Date;
    currentUser: any;
    // 공유 링크
    isEmbedManagerOpen: boolean;
    setIsEmbedManagerOpen: (open: boolean) => void;
    // 클래스 상세 정보
    classesData: ClassInfo[];
    // 퇴원 관리 권한
    canEditWithdrawal: boolean;
    canReactivateWithdrawal: boolean;
    // 퇴원생 모달
    selectedWithdrawalEntry: WithdrawalEntry | null;
    setSelectedWithdrawalEntry: (entry: WithdrawalEntry | null) => void;
    // 배정 예정 취소
    onCancelScheduledEnrollment?: (studentId: string, className: string) => void;
    // 퇴원 드롭존
    onWithdrawalDrop?: (studentId: string, classId: string, className: string) => void;
    // 과목/뷰 전환 (TimetableNavBar 통합)
    timetableSubject?: TimetableSubjectType;
    setTimetableSubject?: (value: TimetableSubjectType) => void;
    setTimetableViewType?: React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>;
    mathViewMode?: string;
    setMathViewMode?: (value: string) => void;
    hasPermissionFn?: (perm: string) => boolean;
    setIsTimetableSettingsOpen?: (value: boolean) => void;
    undoLastMove?: () => any;
    // 강의실 필터
    roomFilter?: { main: boolean; barun: boolean; godeung: boolean };
    onRoomFilterChange?: (type: 'main' | 'barun' | 'godeung', value: boolean) => void;
    // 학생 필터
    studentFilter?: { schools: string[]; grades: string[]; shuttle: 'all' | 'yes' | 'no'; attendance?: 'all' | 'late' | 'absent' | 'late_absent' };
    onStudentFilterChange?: (filter: { schools: string[]; grades: string[]; shuttle: 'all' | 'yes' | 'no'; attendance?: 'all' | 'late' | 'absent' | 'late_absent' }) => void;
    shuttleStudentNames?: Set<string>;
    weeklyAbsent?: { late: Set<string>; absent: Set<string> };
    // 통합뷰 설정 (외부에서 전달)
    mathIntegrationSettings: MathIntegrationSettings;
    updateMathIntegrationSettings: (settings: MathIntegrationSettings) => void;
    userDepartments?: ('math' | 'highmath' | 'english')[];
}

const MathTimetableContent: React.FC<MathTimetableContentProps> = ({
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
    scheduledMovesCount,
    scheduledStudentDates,
    pendingMovedStudentIds,
    pendingMoveFromMap,
    pendingMoveSchedules,
    handleSavePendingMoves,
    handleCancelPendingMoves,
    isSaving,
    mode,
    setMode,
    canEditMath,
    filteredClasses,
    allResources,
    orderedSelectedDays,
    weekDates,
    currentPeriods,
    teachers,
    cellSize,
    setCellSize,
    columnWidth,
    rowHeight,
    fontSize,
    setFontSize,
    showClassName,
    setShowClassName,
    showSchool,
    setShowSchool,
    showGrade,
    setShowGrade,
    showEmptyRooms,
    showStudents,
    setShowStudents,
    showHoldStudents,
    setShowHoldStudents,
    showWithdrawnStudents,
    setShowWithdrawnStudents,
    dragOverClassId,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleMultiDrop,
    currentSubjectFilter,
    studentMap,
    timetableViewMode,
    classKeywords,
    setSelectedClassInfo,
    setSelectedStudentForModal,
    isAddClassOpen,
    setIsAddClassOpen,
    sortedTeachers,
    selectedClassInfo,
    selectedStudentForModal,
    canManageStudents,
    mathConfig,
    handleSaveTeacherOrder,
    isTeacherOrderModalOpen,
    isViewSettingsOpen,
    selectedDays,
    setSelectedDays,
    currentMonday,
    currentUser,
    isEmbedManagerOpen,
    setIsEmbedManagerOpen,
    classesData,
    canEditWithdrawal,
    canReactivateWithdrawal,
    selectedWithdrawalEntry,
    setSelectedWithdrawalEntry,
    onCancelScheduledEnrollment,
    onWithdrawalDrop,
    // 과목/뷰 전환 (TimetableNavBar 통합)
    timetableSubject,
    setTimetableSubject,
    setTimetableViewType,
    mathViewMode,
    setMathViewMode,
    hasPermissionFn,
    setIsTimetableSettingsOpen,
    undoLastMove,
    roomFilter,
    onRoomFilterChange,
    studentFilter,
    onStudentFilterChange,
    shuttleStudentNames,
    weeklyAbsent,
    mathIntegrationSettings,
    updateMathIntegrationSettings,
    userDepartments,
}) => {
    const simulation = useMathSimulation();
    const { isScenarioMode, currentScenarioName, enterScenarioMode, exitScenarioMode, loadFromLive, publishToLive } = simulation;
    const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const gridRef = React.useRef<HTMLDivElement>(null);
    // 엑셀뷰 토스트 알림 (Ctrl+Z, Del, Ctrl+C 등 피드백)
    const [excelToast, setExcelToast] = useState<string | null>(null);
    const excelToastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const showExcelToast = useCallback((msg: string) => {
        setExcelToast(msg);
        if (excelToastTimerRef.current) clearTimeout(excelToastTimerRef.current);
        excelToastTimerRef.current = setTimeout(() => setExcelToast(null), 1800);
    }, []);

    // 엑셀뷰용 셀 선택 + 학생 등록 + 복사/붙여넣기
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [selectedStudentClassName, setSelectedStudentClassName] = useState<string | null>(null);
    const [copiedStudent, setCopiedStudent] = useState<{ studentIds: string[]; className: string } | null>(null);
    const [cutStudent, setCutStudent] = useState<{ studentIds: string[]; className: string } | null>(null);
    const { enrollExistingStudent, smartRemoveStudent, deleteEnrollmentRecord } = useClassOperations();
    // 엑셀뷰 보류 작업 (저장 전까지 DB 미반영)
    const [pendingExcelDeletes, setPendingExcelDeletes] = useState<Array<{ studentId: string; className: string; type: 'active' | 'withdrawn' }>>([]);
    const [pendingExcelEnrollments, setPendingExcelEnrollments] = useState<Array<{ studentId: string; className: string; enrollmentDate?: string }>>([]);
    // 메모이제이션: 복합키 Set (studentId_className)
    const pendingExcelDeleteIds = useMemo(() =>
        pendingExcelDeletes.length > 0 ? new Set(pendingExcelDeletes.map(d => `${d.studentId}_${d.className}`)) : undefined,
        [pendingExcelDeletes]
    );
    // 붙여넣기 등록일 선택 모달 상태
    const [pasteModalInfo, setPasteModalInfo] = useState<{
        studentIds: string[];
        targetClassName: string;
        targetClassSchedule?: string[];
    } | null>(null);

    // 엑셀 자동완성 하이라이트: 포커싱 중인 학생 ID (다른 반에서 빨갛게 표시)
    const [acHighlightStudentId, setAcHighlightStudentId] = useState<string | null>(null);

    // 엑셀 모드 학생 등록 (바로 DB 반영하지 않고 pending에 추가)
    const handleEnrollStudentPending = useCallback((studentId: string, className: string) => {
        if (pendingExcelEnrollments.some(e => e.studentId === studentId && e.className === className)) return;
        setPendingExcelEnrollments(prev => [...prev, { studentId, className }]);
        const name = studentMap[studentId]?.name || studentId;
        showExcelToast(`등록 대기: ${name}`);
    }, [pendingExcelEnrollments, studentMap, showExcelToast]);

    // 엑셀 모드 보류 등록 취소
    const handleCancelPendingEnroll = useCallback((studentId: string, className: string) => {
        setPendingExcelEnrollments(prev => prev.filter(e => !(e.studentId === studentId && e.className === className)));
        const name = studentMap[studentId]?.name || studentId;
        showExcelToast(`취소: ${name} 등록`);
    }, [studentMap, showExcelToast]);

    // 엑셀 모드 학생 선택 핸들러 (단일)
    const handleExcelStudentSelect = useCallback((studentId: string, className: string) => {
        setSelectedStudentIds(new Set([studentId]));
        setSelectedStudentClassName(className);
    }, []);

    // 엑셀 모드 멀티선택 핸들러
    const handleExcelStudentMultiSelect = useCallback((studentIds: Set<string>, className: string) => {
        setSelectedStudentIds(studentIds);
        setSelectedStudentClassName(className);
    }, []);

    // 엑셀 모드 키보드 이벤트 (Ctrl+C/V, Del)
    useEffect(() => {
        if (viewType !== 'excel') return;

        const handleKeyDown = async (e: KeyboardEvent) => {
            // input, textarea 등에서는 기본 동작 유지
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' || target.isContentEditable) {
                return;
            }

            // Del 키: 선택된 학생을 보류 삭제 목록에 추가 (저장 시 실행) - edit 모드에서만
            if (e.key === 'Delete') {
                if (mode !== 'edit') {
                    console.log('[Delete Key] 조회 모드에서는 삭제가 불가능합니다.');
                    return; // 조회 모드에서는 삭제 불가
                }
                if (selectedStudentIds.size === 0 || !selectedStudentClassName) {
                    console.log('[Delete Key] 선택된 학생이 없습니다.');
                    return;
                }
                e.preventDefault();
                console.log(`[Delete Key] ${selectedStudentIds.size}명의 학생을 삭제 대기 목록에 추가합니다.`);

                const className = selectedStudentClassName;
                const targetClass = filteredClasses.find(c => c.className === className);
                if (!targetClass) return;

                const allStudents: any[] = targetClass.studentList || [];
                const today = getTodayKST();
                const selectedList = allStudents.filter((s: any) => selectedStudentIds.has(s.id));

                // 이미 보류 삭제 대상인 학생 제외
                const existingDeleteIds = new Set(pendingExcelDeletes.map(d => d.studentId));
                const newDeletes = selectedList.filter((s: any) => !existingDeleteIds.has(s.id));
                if (newDeletes.length === 0) return;

                const newPendingDeletes = newDeletes.map((s: any) => ({
                    studentId: s.id,
                    className,
                    type: (s.withdrawalDate && s.withdrawalDate <= today ? 'withdrawn' : 'active') as 'active' | 'withdrawn',
                }));

                setPendingExcelDeletes(prev => [...prev, ...newPendingDeletes]);
                const names = newDeletes.map((s: any) => s.name || s.id).join(', ');
                showExcelToast(`삭제 대기: ${names}`);
                setSelectedStudentIds(new Set());
                setSelectedStudentClassName(null);
                return;
            }

            // Ctrl+Z: 마지막 보류 작업 취소 (한국어 IME에서 e.key가 'ㅋ'일 수 있으므로 e.code도 체크)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
                e.preventDefault();
                console.log('[Ctrl+Z] 실행 취소');
                // 보류 등록이 있으면 마지막 등록 취소, 없으면 마지막 삭제 취소
                if (pendingExcelEnrollments.length > 0) {
                    const last = pendingExcelEnrollments[pendingExcelEnrollments.length - 1];
                    const name = studentMap[last.studentId]?.name || last.studentId;
                    setPendingExcelEnrollments(prev => prev.slice(0, -1));
                    showExcelToast(`취소: ${name} 등록`);
                } else if (pendingExcelDeletes.length > 0) {
                    const last = pendingExcelDeletes[pendingExcelDeletes.length - 1];
                    const name = studentMap[last.studentId]?.name || last.studentId;
                    setPendingExcelDeletes(prev => prev.slice(0, -1));
                    showExcelToast(`취소: ${name} 삭제`);
                } else {
                    const undone = undoLastMove?.();
                    if (undone) {
                        const name = studentMap[undone.studentId]?.name || undone.studentId;
                        showExcelToast(`취소: ${name} 이동`);
                    } else {
                        showExcelToast('취소할 작업 없음');
                    }
                }
                return;
            }

            if (!e.ctrlKey && !e.metaKey) return;

            // Ctrl+X: 잘라내기 (이동 의도) - edit 모드에서만
            if (e.key === 'x' || e.key === 'X' || e.code === 'KeyX') {
                if (mode !== 'edit') return;
                if (selectedStudentIds.size > 0 && selectedStudentClassName) {
                    setCutStudent({ studentIds: [...selectedStudentIds], className: selectedStudentClassName });
                    setCopiedStudent(null);
                    const names = [...selectedStudentIds].map(id => studentMap[id]?.name || id).join(', ');
                    showExcelToast(`잘라내기: ${names}`);
                }
                return;
            }

            if (e.key === 'c' || e.key === 'C' || e.code === 'KeyC') {
                // Ctrl+C: 선택된 학생 복사
                if (selectedStudentIds.size > 0 && selectedStudentClassName) {
                    setCopiedStudent({ studentIds: [...selectedStudentIds], className: selectedStudentClassName });
                    setCutStudent(null);
                    const names = [...selectedStudentIds].map(id => studentMap[id]?.name || id).join(', ');
                    console.log(`[Ctrl+C] ${selectedStudentIds.size}명 복사: ${names}`);
                    showExcelToast(`복사: ${names}`);
                } else {
                    console.log('[Ctrl+C] 복사할 학생이 선택되지 않았습니다.');
                }
                return;
            }

            if (e.key === 'v' || e.key === 'V' || e.code === 'KeyV') {
                // Ctrl+V: 잘라내기 상태면 이동 - edit 모드에서만
                if (mode !== 'edit') return;
                if (cutStudent && selectedClassId) {
                    const targetClass = filteredClasses.find(c => c.id === selectedClassId);
                    if (!targetClass || targetClass.className === cutStudent.className) return;
                    e.preventDefault();
                    const fromClass = filteredClasses.find(c => c.className === cutStudent.className);
                    if (fromClass) {
                        handleMultiDrop(cutStudent.studentIds, fromClass.id, selectedClassId);
                        const names = cutStudent.studentIds.map(id => studentMap[id]?.name || id);
                        const nameStr = names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}명`;
                        showExcelToast(`이동: ${nameStr} → ${targetClass.className}`);
                    }
                    setCutStudent(null);
                    return;
                }
                // Ctrl+V: 복사 상태면 등록
                if (!copiedStudent || !selectedClassId) return;
                e.preventDefault();

                const targetClass = filteredClasses.find(c => c.id === selectedClassId);
                if (!targetClass) return;

                // 퇴원생은 재등록 가능하므로 활성 학생만 중복 체크
                const existingIds = new Set(
                  (targetClass.studentList || [])
                    .filter((s: any) => !s.withdrawalDate)
                    .map((s: any) => s.id)
                );
                const newStudentIds = copiedStudent.studentIds.filter(sid => !existingIds.has(sid));
                const skipped = copiedStudent.studentIds.length - newStudentIds.length;

                if (newStudentIds.length === 0) {
                    if (skipped > 0) alert(`${skipped}명은 이미 소속된 학생입니다.`);
                    return;
                }

                setPasteModalInfo({
                    studentIds: newStudentIds,
                    targetClassName: targetClass.className,
                    targetClassSchedule: targetClass.schedule,
                });
                if (skipped > 0) alert(`${skipped}명은 이미 소속되어 제외됩니다.`);
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewType, mode, selectedStudentIds, selectedStudentClassName, copiedStudent, cutStudent, selectedClassId, filteredClasses, pendingExcelDeletes, pendingExcelEnrollments, showExcelToast, studentMap, undoLastMove, handleMultiDrop]);

    // 이미지 내보내기용 그룹 상태
    const [exportGroups, setExportGroups] = useState<ExportGroup[]>([]);
    const [exportVisibleGroups, setExportVisibleGroups] = useState<number[] | undefined>(undefined);

    // 통합뷰 표시 옵션 변경 핸들러
    const handleIntegrationDisplayOptionChange = (key: string, value: boolean) => {
        updateMathIntegrationSettings({
            ...mathIntegrationSettings,
            displayOptions: {
                ...mathIntegrationSettings.displayOptions,
                [key]: value
            }
        });
    };

    // 이미지 내보내기: MathClassTab에서 그룹 정보 수신
    const handleGroupsReady = useCallback((groups: ExportGroupInfo[]) => {
        setExportGroups(groups.map(g => ({ id: g.id, label: g.label })));
    }, []);

    // 이미지 내보내기: 선택된 그룹 변경 시 처리
    const handleExportGroupsChanged = useCallback((selectedIds: (string | number)[]) => {
        setExportVisibleGroups(selectedIds.map(id => Number(id)));
    }, []);

    // 모달 닫힐 때 그룹 필터 초기화
    const handleExportModalClose = useCallback(() => {
        setIsExportModalOpen(false);
        setExportVisibleGroups(undefined); // 모든 그룹 표시로 복원
    }, []);

    const handleToggleSimulation = async () => {
        if (isScenarioMode) {
            exitScenarioMode();
        } else {
            setLoading(true);
            try {
                await enterScenarioMode();
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
        // 권한 체크
        if (!canEditMath) {
            alert('❌ 수학 시간표 편집 권한이 없습니다.');
            return;
        }

        if (!confirm('⚠️ 시뮬레이션 내용을 실제 시간표에 반영하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        setLoading(true);
        try {
            await publishToLive(currentUser.uid, currentUser.displayName || currentUser.email);
            alert('✅ 실제 시간표에 반영되었습니다.');
        } catch (e: any) {
            console.error('반영 실패:', e);
            if (e.code === 'permission-denied') {
                alert('❌ 권한이 없습니다. 관리자에게 문의하세요.');
            } else {
                alert('반영 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    // 메모이즈된 콜백: TimetableGrid에 전달되는 인라인 함수를 안정화하여 불필요한 리렌더링 방지
    const handleClassClick = useCallback((cls: TimetableClass) => {
        if (!canEditMath) return;
        const classInfo: ClassInfo = {
            className: cls.className,
            subject: cls.subject === '수학' ? 'math' : cls.subject === '고등수학' ? 'highmath' : 'english',
            teacher: cls.teacher,
            room: cls.room,
            schedule: cls.schedule,
            studentCount: cls.studentIds?.length || cls.studentList?.length || 0,
            id: cls.id,
        };
        setSelectedClassInfo(classInfo);
    }, [canEditMath, setSelectedClassInfo]);

    const handleStudentClick = useCallback((studentId: string) => {
        const student = studentMap[studentId];
        if (!student) return;

        // 퇴원생인 경우 퇴원 모달 열기 (status가 withdrawn이거나 withdrawalDate가 있는 경우)
        if (student.status === 'withdrawn' || student.withdrawalDate) {
            const entry: WithdrawalEntry = {
                student,
                type: 'withdrawn',
                endedSubjects: [...new Set((student.enrollments || []).map(e => e.subject))],
                endedEnrollments: student.enrollments || [],
                effectiveDate: student.withdrawalDate || student.endDate || '',
            };
            setSelectedWithdrawalEntry(entry);
        } else {
            // 일반 학생 모달 열기
            setSelectedStudentForModal(student);
        }
    }, [studentMap, setSelectedStudentForModal, setSelectedWithdrawalEntry]);

    // 배정 예정 취소 - onCancelScheduledEnrollment prop을 사용
    // (handleCancelScheduledEnrollment는 TimetableManager에서 정의하여 prop으로 전달)

    const handleGridDragStart = useCallback((e: React.DragEvent, sId: string, cId: string, zone?: string) => {
        if (isScenarioMode) {
            // 예정일 이동이 걸린 학생은 시뮬레이션에서 드래그 차단
            const scheduledDate = scheduledStudentDates?.get(sId);
            if (scheduledDate) {
                e.preventDefault();
                alert(`이 학생은 반이동 예정(${scheduledDate})이 있습니다.\n실시간 모드에서 예정을 취소한 후 시뮬레이션에서 이동해주세요.`);
                return;
            }
            e.dataTransfer.setData('studentId', sId);
            e.dataTransfer.setData('fromClassId', cId);
            if (zone) e.dataTransfer.setData('fromZone', zone);
            e.dataTransfer.effectAllowed = 'move';
        } else if (canEditMath) {
            handleDragStart(e, sId, cId, zone);
        }
    }, [isScenarioMode, canEditMath, handleDragStart, scheduledStudentDates]);

    const handleGridDragOver = useCallback((e: React.DragEvent, classId: string) => {
        if (isScenarioMode) {
            e.preventDefault();
        } else {
            handleDragOver(e, classId);
        }
    }, [isScenarioMode, handleDragOver]);

    const handleGridDragLeave = useCallback((e: React.DragEvent) => {
        if (!isScenarioMode) {
            handleDragLeave();
        }
    }, [isScenarioMode, handleDragLeave]);

    const handleGridDrop = useCallback((e: React.DragEvent, toClassId: string, toZone?: string) => {
        if (isScenarioMode) {
            e.preventDefault();
            const studentId = e.dataTransfer.getData('studentId');
            const fromClassId = e.dataTransfer.getData('fromClassId');

            if (!studentId || !fromClassId) return;
            if (fromClassId === toClassId) return;

            const fromClass = simulation.getScenarioClass(fromClassId);
            const toClass = simulation.getScenarioClass(toClassId);

            if (fromClass && toClass) {
                simulation.moveStudent(fromClass.className, toClass.className, studentId);
            }
        } else {
            // handleDrop이 멀티/단일 학생 드롭 + 같은 반 zone 이동을 모두 처리
            handleDrop(e, toClassId, toZone);
        }
    }, [isScenarioMode, simulation, handleDrop, handleMultiDrop]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-sm h-12 w-12 border-4 border-accent border-t-transparent"></div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white shadow-xl border border-gray-200 h-full flex flex-col overflow-visible relative">
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
                    pendingMovesCount={pendingMovesCount + pendingExcelDeletes.length + pendingExcelEnrollments.length}
                    scheduledMovesCount={scheduledMovesCount}
                    handleSavePendingMoves={async () => {
                        // 1. 기존 드래그 이동 저장
                        if (pendingMovesCount > 0) await handleSavePendingMoves();

                        // 2. 보류 삭제 실행
                        console.log('[Excel Save] 보류 삭제 시작:', pendingExcelDeletes);
                        try {
                            for (const del of pendingExcelDeletes) {
                                console.log(`[Excel Delete] ${del.studentId}를 ${del.className}에서 삭제 중... (type: ${del.type})`);
                                if (del.type === 'withdrawn') {
                                    await deleteEnrollmentRecord(del.className, del.studentId);
                                    console.log(`[Excel Delete] ${del.studentId} 퇴원생 기록 삭제 완료`);
                                } else {
                                    const result = await smartRemoveStudent(del.className, del.studentId);
                                    console.log(`[Excel Delete] ${del.studentId} 삭제 완료 (결과: ${result})`);
                                }
                            }

                            // 3. 보류 등록 실행
                            console.log('[Excel Save] 보류 등록 시작:', pendingExcelEnrollments);
                            for (const enr of pendingExcelEnrollments) {
                                console.log(`[Excel Enroll] ${enr.studentId}를 ${enr.className}에 등록 중...`);
                                await enrollExistingStudent(enr.studentId, enr.className, enr.enrollmentDate);
                                console.log(`[Excel Enroll] ${enr.studentId} 등록 완료`);
                            }

                            // 4. 캐시 무효화 및 화면 새로고침 (강제 refetch)
                            console.log('[Excel Save] 캐시 무효화 및 강제 새로고침...');
                            await queryClient.invalidateQueries({ queryKey: ['students'] });
                            await queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });
                            await queryClient.invalidateQueries({ queryKey: ['mathClasses'] });

                            // 강제로 다시 fetch
                            await queryClient.refetchQueries({ queryKey: ['timetableClasses'] });
                            await queryClient.refetchQueries({ queryKey: ['mathClasses'] });
                            console.log('[Excel Save] 저장 완료!');
                        } catch (error) {
                            console.error('엑셀 보류 작업 저장 오류:', error);
                            alert('일부 작업 저장에 실패했습니다.');
                        }
                        setPendingExcelDeletes([]);
                        setPendingExcelEnrollments([]);
                    }}
                    handleCancelPendingMoves={() => {
                        handleCancelPendingMoves();
                        setPendingExcelDeletes([]);
                        setPendingExcelEnrollments([]);
                    }}
                    isSaving={isSaving}
                    mode={mode}
                    setMode={setMode}
                    canEdit={canEditMath}
                    isSimulationMode={isScenarioMode}
                    currentScenarioName={currentScenarioName}
                    onToggleSimulation={handleToggleSimulation}
                    onCopyLiveToDraft={handleCopyLiveToDraft}
                    onPublishDraftToLive={handlePublishDraftToLive}
                    onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
                    onOpenEmbedManager={() => setIsEmbedManagerOpen(true)}
                    isMaster={currentUser?.role === 'master'}
                    studentMap={studentMap}
                    currentWeekStart={currentMonday}
                    filteredClasses={filteredClasses}
                    // 보기 설정 (드롭다운에서 직접 조절)
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
                    showHoldStudents={showHoldStudents}
                    setShowHoldStudents={setShowHoldStudents}
                    showWithdrawnStudents={showWithdrawnStudents}
                    setShowWithdrawnStudents={setShowWithdrawnStudents}
                    cellSize={cellSize}
                    setCellSize={setCellSize}
                    fontSize={fontSize}
                    setFontSize={setFontSize}
                    // 이미지 저장 (모든 viewType에서 사용 가능)
                    onExportImage={() => setIsExportModalOpen(true)}
                    // 통합뷰 전용 props
                    integrationDisplayOptions={viewType === 'class' ? mathIntegrationSettings.displayOptions : undefined}
                    onIntegrationDisplayOptionsChange={viewType === 'class' ? handleIntegrationDisplayOptionChange : undefined}
                    // 퇴원 관리 권한
                    canEditWithdrawal={canEditWithdrawal}
                    canReactivateWithdrawal={canReactivateWithdrawal}
                    // 과목/뷰 전환 (TimetableNavBar 통합)
                    timetableSubject={timetableSubject}
                    setTimetableSubject={setTimetableSubject}
                    setTimetableViewType={setTimetableViewType}
                    mathViewMode={mathViewMode}
                    setMathViewMode={setMathViewMode}
                    hasPermission={hasPermissionFn}
                    setIsTimetableSettingsOpen={setIsTimetableSettingsOpen}
                    userDepartments={userDepartments}
                    roomFilter={roomFilter}
                    onRoomFilterChange={onRoomFilterChange}
                    studentFilter={studentFilter}
                    onStudentFilterChange={onStudentFilterChange}
                    shuttleStudentNames={shuttleStudentNames}
                    weeklyAbsent={weeklyAbsent}
                    hiddenTeachers={mathIntegrationSettings.hiddenTeachers || []}
                    onToggleTeacherHidden={(teacher: string) => {
                        const current = mathIntegrationSettings.hiddenTeachers || [];
                        const newHidden = current.includes(teacher)
                            ? current.filter(t => t !== teacher)
                            : [...current, teacher];
                        updateMathIntegrationSettings({ ...mathIntegrationSettings, hiddenTeachers: newHidden });
                    }}
                />

                {/* Timetable Content - viewType에 따라 분기 */}
                {viewType === 'teacher' && (
                <div ref={gridRef} className="flex-1 overflow-hidden border-t border-gray-200 p-4">
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
                        mode={isScenarioMode ? 'edit' : mode}
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
                        onClassClick={handleClassClick}
                        onDragStart={handleGridDragStart}
                        onDragOver={handleGridDragOver}
                        onDragLeave={handleGridDragLeave}
                        onDrop={handleGridDrop}
                        currentSubjectFilter={currentSubjectFilter}
                        studentMap={studentMap}
                        timetableViewMode={timetableViewMode === 'day-based' ? 'day-based' : 'teacher-based'}
                        weekdayGroupOrder={mathConfig.weekdayGroupOrder}
                        classKeywords={classKeywords}
                        onStudentClick={handleStudentClick}
                        pendingMovedStudentIds={pendingMovedStudentIds} pendingMoveFromMap={pendingMoveFromMap}
                        pendingMoveSchedules={pendingMoveSchedules}
                        onCancelScheduledEnrollment={!isScenarioMode ? onCancelScheduledEnrollment : undefined}
                        onWithdrawalDrop={!isScenarioMode ? onWithdrawalDrop : undefined}
                        studentFilter={studentFilter}
                        shuttleStudentNames={shuttleStudentNames}
                        weeklyAbsent={weeklyAbsent}
                    />
                </div>
                )}

                {/* Room View - 강의실별 뷰 */}
                {viewType === 'room' && (
                <div ref={gridRef} className="flex-1 overflow-hidden border-t border-gray-200 p-4">
                    <TimetableGrid
                        filteredClasses={filteredClasses}
                        allResources={allResources}
                        orderedSelectedDays={orderedSelectedDays}
                        weekDates={weekDates}
                        viewType="room"
                        currentPeriods={currentPeriods}
                        teachers={teachers}
                        searchQuery={searchQuery}
                        canEdit={canEditMath}
                        mode={isScenarioMode ? 'edit' : mode}
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
                        onClassClick={handleClassClick}
                        onDragStart={handleGridDragStart}
                        onDragOver={handleGridDragOver}
                        onDragLeave={handleGridDragLeave}
                        onDrop={handleGridDrop}
                        currentSubjectFilter={currentSubjectFilter}
                        studentMap={studentMap}
                        timetableViewMode={timetableViewMode === 'day-based' ? 'day-based' : 'teacher-based'}
                        weekdayGroupOrder={mathConfig.weekdayGroupOrder}
                        classKeywords={classKeywords}
                        onStudentClick={handleStudentClick}
                        pendingMovedStudentIds={pendingMovedStudentIds} pendingMoveFromMap={pendingMoveFromMap}
                        pendingMoveSchedules={pendingMoveSchedules}
                        onCancelScheduledEnrollment={!isScenarioMode ? onCancelScheduledEnrollment : undefined}
                        onWithdrawalDrop={!isScenarioMode ? onWithdrawalDrop : undefined}
                        studentFilter={studentFilter}
                        shuttleStudentNames={shuttleStudentNames}
                        weeklyAbsent={weeklyAbsent}
                    />
                </div>
                )}

                {/* Excel Mode - 강사뷰 변형 (셀 선택, 텍스트 복사, 자동완성) */}
                {viewType === 'excel' && (
                <div ref={gridRef} className="flex-1 overflow-hidden border-t border-gray-200 p-4 relative">
                    {/* 엑셀 토스트 알림 */}
                    {excelToast && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-xs px-3 py-1.5 rounded shadow-lg animate-fade-in whitespace-nowrap pointer-events-none">
                            {excelToast}
                        </div>
                    )}
                    <TimetableGrid
                        filteredClasses={filteredClasses}
                        allResources={allResources}
                        orderedSelectedDays={orderedSelectedDays}
                        weekDates={weekDates}
                        viewType="teacher"
                        currentPeriods={currentPeriods}
                        teachers={teachers}
                        searchQuery={searchQuery}
                        canEdit={canEditMath}
                        mode={isScenarioMode ? 'edit' : mode}
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
                        onClassClick={handleClassClick}
                        onDragStart={handleGridDragStart}
                        onDragOver={handleGridDragOver}
                        onDragLeave={handleGridDragLeave}
                        onDrop={handleGridDrop}
                        currentSubjectFilter={currentSubjectFilter}
                        studentMap={studentMap}
                        timetableViewMode={timetableViewMode === 'excel-day' ? 'day-based' : 'teacher-based'}
                        weekdayGroupOrder={mathConfig.weekdayGroupOrder}
                        isUnifiedTable={true}
                        classKeywords={classKeywords}
                        onStudentClick={handleStudentClick}
                        pendingMovedStudentIds={pendingMovedStudentIds} pendingMoveFromMap={pendingMoveFromMap}
                        pendingMoveSchedules={pendingMoveSchedules}
                        isExcelMode={true}
                        isTestView={timetableViewMode === 'excel-teacher-test'}
                        selectedClassId={selectedClassId}
                        onCellSelect={setSelectedClassId}
                        onEnrollStudent={handleEnrollStudentPending}
                        onCancelPendingEnroll={handleCancelPendingEnroll}
                        selectedStudentIds={selectedStudentIds}
                        selectedStudentClassName={selectedStudentClassName}
                        copiedStudentIds={copiedStudent?.studentIds || null}
                        copiedStudentClassName={copiedStudent?.className || null}
                        cutStudentIds={cutStudent?.studentIds || null}
                        cutStudentClassName={cutStudent?.className || null}
                        acHighlightStudentId={acHighlightStudentId}
                        onAcHighlightChange={setAcHighlightStudentId}
                        onStudentSelect={handleExcelStudentSelect}
                        onStudentMultiSelect={handleExcelStudentMultiSelect}
                        onWithdrawalDrop={!isScenarioMode ? onWithdrawalDrop : undefined}
                        pendingExcelDeleteIds={pendingExcelDeleteIds}
                        pendingExcelEnrollments={pendingExcelEnrollments.length > 0 ? pendingExcelEnrollments : undefined}
                        studentFilter={studentFilter}
                        shuttleStudentNames={shuttleStudentNames}
                        weeklyAbsent={weeklyAbsent}
                    />
                </div>
                )}

                {/* Math Class Tab - 통합뷰 */}
                {viewType === 'class' && (
                    <div ref={gridRef} className="flex-1 overflow-hidden border-t border-gray-200">
                        <MathClassTab
                            classes={filteredClasses}
                            teachers={sortedTeachers}
                            teachersData={teachers}
                            classKeywords={classKeywords}
                            currentUser={currentUser}
                            studentMap={studentMap}
                            classesData={classesData}
                            isSimulationMode={isScenarioMode}
                            currentWeekStart={currentMonday}
                            isViewSettingsOpen={isViewSettingsOpen}
                            setIsViewSettingsOpen={setIsViewSettingsOpen}
                            searchQuery={searchQuery}
                            mode={mode}
                            setMode={setMode}
                            onGroupsReady={handleGroupsReady}
                            exportVisibleGroups={exportVisibleGroups}
                        />
                    </div>
                )}

                {/* Add Class Modal */}
                {isAddClassOpen && (
                    <AddClassModal
                        onClose={() => setIsAddClassOpen(false)}
                        defaultSubject="math"
                    />
                )}

                {/* Class Detail Modal - 수업 관리와 동일한 상세 모달 사용 */}
                {selectedClassInfo && (
                    <ClassDetailModal
                        classInfo={selectedClassInfo}
                        onClose={() => setSelectedClassInfo(null)}
                    />
                )}

                {/* Student Detail Modal - 학생관리 권한에 따라 조회/수정 모드 결정 */}
                {selectedStudentForModal && (
                    <StudentDetailModal
                        student={selectedStudentForModal}
                        onClose={() => setSelectedStudentForModal(null)}
                        readOnly={!canManageStudents}
                        currentUser={currentUser}
                    />
                )}

                {/* Withdrawal Student Detail Modal - 퇴원생 클릭 시 */}
                {selectedWithdrawalEntry && (
                    <div
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
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
                                    className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-500"
                                >
                                    ✕
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

                {/* Teacher Order Modal (Math) */}
                <TeacherOrderModal
                    isOpen={isTeacherOrderModalOpen}
                    onClose={() => setIsTeacherOrderModalOpen(false)}
                    currentOrder={mathConfig.teacherOrder}
                    allTeachers={sortedTeachers}
                    onSave={handleSaveTeacherOrder}
                />

                {/* View Settings Modal (Math) - 날짜/강사뷰만 */}
                {viewType !== 'class' && (
                    <SimpleViewSettingsModal
                        isOpen={isViewSettingsOpen}
                        onClose={() => setIsViewSettingsOpen(false)}
                        viewType="date-teacher"
                        cellSize={cellSize}
                    setCellSize={setCellSize}
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
                        showHoldStudents={showHoldStudents}
                        setShowHoldStudents={setShowHoldStudents}
                        showWithdrawnStudents={showWithdrawnStudents}
                        setShowWithdrawnStudents={setShowWithdrawnStudents}
                    />
                )}

                {/* Embed Token Manager Modal - 마스터 전용 */}
                <EmbedTokenManager
                    isOpen={isEmbedManagerOpen}
                    onClose={() => setIsEmbedManagerOpen(false)}
                    staffId={currentUser?.staffId || currentUser?.uid || ''}
                    filterType={['math-timetable', 'english-timetable']}
                />

                {/* 이미지 저장 모달 */}
                <ExportImageModal
                    isOpen={isExportModalOpen}
                    onClose={handleExportModalClose}
                    targetRef={gridRef}
                    title={viewType === 'class' ? "수학 통합 시간표 저장" : "수학 강사별 시간표 저장"}
                    subtitle={viewType === 'class' ? "저장할 행을 선택하세요" : undefined}
                    fileName={viewType === 'class'
                        ? `수학_통합시간표_${getTodayKST()}`
                        : `수학_강사별시간표_${getTodayKST()}`}
                    groups={viewType === 'class' ? exportGroups : undefined}
                    onGroupsChanged={viewType === 'class' ? handleExportGroupsChanged : undefined}
                />

                {/* 붙여넣기 등록일 선택 모달 */}
                {pasteModalInfo && (
                    <ScheduledDateModal
                        studentName={(() => {
                            const names = pasteModalInfo.studentIds.map(id => studentMap[id]?.name || id);
                            return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}명`;
                        })()}
                        fromClassName={copiedStudent?.className || ''}
                        toClassName={pasteModalInfo.targetClassName}
                        title="등록일 설정"
                        actionVerb="삽입"
                        weekStart={currentMonday}
                        targetClassSchedule={pasteModalInfo.targetClassSchedule}
                        onConfirm={(enrollmentDate?: string) => {
                            const { studentIds, targetClassName } = pasteModalInfo;
                            setPasteModalInfo(null);
                            // 보류 등록 목록에 추가 (저장 시 실행)
                            const existingEnrollIds = new Set(pendingExcelEnrollments.map(e => `${e.studentId}-${e.className}`));
                            const newEnrollments = studentIds
                                .filter(sid => !existingEnrollIds.has(`${sid}-${targetClassName}`))
                                .map(sid => ({ studentId: sid, className: targetClassName, enrollmentDate }));
                            setPendingExcelEnrollments(prev => [...prev, ...newEnrollments]);
                        }}
                        onClose={() => setPasteModalInfo(null)}
                    />
                )}

                {/* Scenario Management Modal */}
                {isScenarioModalOpen && (
                    <Suspense fallback={<div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50"><VideoLoading className="h-screen" /></div>}>
                        <ScenarioManagementModal
                            isOpen={isScenarioModalOpen}
                            onClose={() => setIsScenarioModalOpen(false)}
                            currentUser={currentUser}
                            isSimulationMode={isScenarioMode}
                            onLoadScenario={() => {}}
                        />
                    </Suspense>
                )}
            </div>
        </>
    );
};

// Props interface for external filter control
interface TimetableManagerProps {
    subjectTab?: TimetableSubjectType;
    onSubjectChange?: (subject: TimetableSubjectType) => void;
    viewType?: 'teacher' | 'room' | 'class' | 'excel';
    onViewTypeChange?: (viewType: 'teacher' | 'room' | 'class' | 'excel') => void;
    showStudents?: boolean;
    onShowStudentsChange?: (show: boolean) => void;
    selectedDays?: string[];
    onSelectedDaysChange?: (days: string[]) => void;
    teachers?: Teacher[];  // Centralized from App.tsx
    classKeywords?: ClassKeywordColor[]; // For keyword color coding
    currentUser: any; // Using any for now to avoid circular dependency or import issues if common
    // 수학 뷰 모드 (날짜별/강사별/엑셀모드)
    mathViewMode?: string;
    onMathViewModeChange?: (mode: string) => void;
    // TimetableNavBar 통합용
    hasPermissionFn?: (perm: string) => boolean;
    setIsTimetableSettingsOpen?: (value: boolean) => void;
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
    hasPermissionFn: externalHasPermission,
    setIsTimetableSettingsOpen: externalSetIsTimetableSettingsOpen,
}: TimetableManagerProps) => {
    const queryClient = useQueryClient();
    // master는 항상 전체 보기 (자동전체보기), 그 외는 소속 기반 필터링
    const userDepartments: ('math' | 'highmath' | 'english' | 'science' | 'korean')[] = currentUser?.role === 'master'
        ? ['math', 'highmath', 'english', 'science', 'korean']
        : (currentUser?.departments && currentUser.departments.length > 0
            ? currentUser.departments
            : ['math', 'highmath', 'english', 'science', 'korean']);
    const { hasPermission } = usePermissions(currentUser);
    const canEditMath = hasPermission('timetable.math.edit');
    const canEditEnglish = hasPermission('timetable.english.edit');
    const canEditScience = hasPermission('timetable.science.edit');
    const canEditKorean = hasPermission('timetable.korean.edit');
    const canViewMath = hasPermission('timetable.math.view') || canEditMath;
    const canViewEnglish = hasPermission('timetable.english.view') || canEditEnglish;
    const canViewScience = hasPermission('timetable.science.view') || canEditScience;
    const canViewKorean = hasPermission('timetable.korean.view') || canEditKorean;
    const canViewShuttle = (externalHasPermission || hasPermission)('shuttle.view');
    const canManageStudents = hasPermission('students.edit');
    // 퇴원 관리 권한 (퇴원생 클릭 시 상세 모달용)
    const canEditWithdrawal = hasPermission('withdrawal.edit');
    const canReactivateWithdrawal = hasPermission('withdrawal.reactivate');

    // Subject Tab (use external if provided)
    const [internalSubjectTab, setInternalSubjectTab] = useState<TimetableSubjectType>('math');
    const subjectTab = externalSubjectTab ?? internalSubjectTab;
    const setSubjectTab = onSubjectChange ?? setInternalSubjectTab;

    // Hook Integration: Classes Data (MUST be called before any conditional returns)
    const { classes, loading: classesLoading } = useTimetableClasses();

    // Hook Integration: Class Info (담임 정보 등)
    const { data: classesData } = useClasses('math');

    // Hook Integration: Unified Students
    const { students: globalStudents } = useStudents(true);  // 퇴원생 포함 (시간표에서 필요)

    // Create Student Lookup Map
    const studentMap = useMemo(() => {
        const map: Record<string, UnifiedStudent> = {};
        globalStudents.forEach(s => {
            map[s.id] = s;
        });
        return map;
    }, [globalStudents]);

    // 모든 학생을 과목/캠퍼스 구분 없이 표시 (캠퍼스 필터링 제거됨)

    // teachers는 propsTeachers에서 받아서 현재 과목 필터링하여 사용
    const mathSubjectKey = subjectTab === 'highmath' ? 'highmath' : 'math';
    const teachers = React.useMemo(() =>
        propsTeachers.filter(t => !t.subjects || t.subjects.includes(mathSubjectKey)),
        [propsTeachers, mathSubjectKey]);

    // Hook Integration: Math Config
    const {
        mathConfig,
        isTeacherOrderModalOpen,
        setIsTeacherOrderModalOpen,
        handleSaveTeacherOrder,
    } = useMathConfig();

    // Hidden teachers settings (강사 숨김 필터)
    const { settings: outerMathSettings, updateSettings: updateOuterMathSettings } = useMathSettings();

    // Hook Integration: Class Operations
    const {
        updateClass,
        deleteClass,
        addStudent,
        enrollExistingStudent,
        removeStudent,
        withdrawStudent,
        restoreStudent
    } = useClassOperations();

    // Sorted Teachers based on saved order
    const sortedTeachers = useMemo(() => {
        // Performance: js-combine-iterations - filter + map을 단일 루프로 결합
        const visibleTeachers = teachers.reduce<string[]>((acc, t) => {
            if (!t.isHidden) acc.push(t.name);
            return acc;
        }, []);
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

    // Performance: rerender-lazy-state-init + js-cache-storage
    // localStorage를 한 번만 읽고 파싱하여 모든 설정값 초기화 (9회 읽기 → 1회 읽기)
    const [viewSettings] = useState(() => {
        try {
            const saved = storage.getString(STORAGE_KEYS.TIMETABLE_VIEW_SETTINGS);
            if (saved) return JSON.parse(saved);
            // Migration from old key
            const old = localStorage.getItem('timetable_view_settings');
            if (old) {
                storage.setString(STORAGE_KEYS.TIMETABLE_VIEW_SETTINGS, old);
                localStorage.removeItem('timetable_view_settings');
                return JSON.parse(old);
            }
            return {};
        } catch (e) {
            console.warn('Failed to load view settings from localStorage:', e);
            return {};
        }
    });

    // View State (use external if provided)
    const [internalSelectedDays, setInternalSelectedDays] = useState<string[]>(
        viewSettings.selectedDays || ['월', '화', '수', '목', '금', '토', '일']
    );
    const selectedDays = externalSelectedDays ?? internalSelectedDays;
    const setSelectedDays = onSelectedDaysChange ?? setInternalSelectedDays;

    const [internalViewType, setInternalViewType] = useState<'teacher' | 'room' | 'class' | 'excel'>(subjectTab === 'highmath' ? 'excel' : 'teacher');
    const viewType = externalViewType ?? internalViewType;
    const setViewType = onViewTypeChange ?? setInternalViewType;

    // 조회/수정 모드 상태
    const [mode, setMode] = useState<'view' | 'edit'>('view');

    const [isAddClassOpen, setIsAddClassOpen] = useState(false);
    const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
    const [isEmbedManagerOpen, setIsEmbedManagerOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<TimetableClass | null>(null);
    const [selectedClassInfo, setSelectedClassInfo] = useState<ClassInfo | null>(null);
    const [selectedStudentForModal, setSelectedStudentForModal] = useState<UnifiedStudent | null>(null);
    const [selectedWithdrawalEntry, setSelectedWithdrawalEntry] = useState<WithdrawalEntry | null>(null);

    // 드래그 예정일 모달 상태
    const [dateModalInfo, setDateModalInfo] = useState<{
        studentId: string;
        studentName: string;
        fromClassName: string;
        toClassName: string;
        targetClassSchedule?: string[];
        isZoneChange?: boolean; // 같은 반 내 zone 이동 여부
        isWithdrawn?: boolean; // 퇴원생 이동 여부
        multiStudentIds?: string[]; // 멀티 이동 시 전체 학생 ID 목록
    } | null>(null);
    const prevPendingMovesLengthRef = React.useRef(0);

    const [internalShowStudents, setInternalShowStudents] = useState(
        viewSettings.showStudents ?? true
    );
    const showStudents = externalShowStudents ?? internalShowStudents;
    const setShowStudents = onShowStudentsChange ?? setInternalShowStudents;

    // Timetable View Mode: 'day-based' (월화수목금토일) vs 'teacher-based' (월목/화금/주말/수요일)
    // 강사별뷰(teacher-based) 숨김 → 기본값을 day-based로 설정
    const [internalTimetableViewMode, setInternalTimetableViewMode] = useState<string>(
        viewSettings.timetableViewMode === 'teacher-based' ? 'day-based' : (viewSettings.timetableViewMode || 'day-based')
    );
    const timetableViewMode = externalMathViewMode ?? internalTimetableViewMode;
    const setTimetableViewMode = onMathViewModeChange ?? setInternalTimetableViewMode;

    // 강사별뷰(teacher-based) 숨김: teacher view + teacher-based인 경우 day-based로 리다이렉트
    useEffect(() => {
        if (viewType === 'teacher' && timetableViewMode === 'teacher-based') {
            setTimetableViewMode('day-based');
        }
    }, [viewType, timetableViewMode, setTimetableViewMode]);


    // 나머지 뷰 설정 (캐시된 viewSettings에서 초기화)
    const [showClassName, setShowClassName] = useState(viewSettings.showClassName ?? true);
    const [showSchool, setShowSchool] = useState(viewSettings.showSchool ?? true);
    const [showGrade, setShowGrade] = useState(viewSettings.showGrade ?? true);
    const [showEmptyRooms, setShowEmptyRooms] = useState(viewSettings.showEmptyRooms ?? false);
    const cellSize = 'md' as const;
    const setCellSize = undefined;
    // cellSize 항상 'md' 고정
    const columnWidth = 'normal' as const;
    const rowHeight = 'normal' as const;
    const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large'>(
        viewSettings.fontSize || 'normal'
    );
    const [showHoldStudents, setShowHoldStudents] = useState(viewSettings.showHoldStudents ?? true);
    const [showWithdrawnStudents, setShowWithdrawnStudents] = useState(viewSettings.showWithdrawnStudents ?? true);

    // 강의실 필터 (멀티 선택: 본원/바른/고등)
    const [roomFilter, setRoomFilter] = useState<{ main: boolean; barun: boolean; godeung: boolean }>(() => {
        try {
            const saved = storage.getString(STORAGE_KEYS.MATH_ROOM_FILTER);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (typeof parsed === 'object' && parsed !== null && 'main' in parsed) {
                    return { main: true, barun: true, godeung: true, ...parsed };
                }
            }
        } catch { /* ignore */ }
        return { main: true, barun: true, godeung: true };
    });
    const handleRoomFilterChange = useCallback((type: 'main' | 'barun' | 'godeung', value: boolean) => {
        setRoomFilter(prev => {
            const next = { ...prev, [type]: value };
            storage.setString(STORAGE_KEYS.MATH_ROOM_FILTER, JSON.stringify(next));
            return next;
        });
    }, []);

    // 학생 필터 (학교/학년/셔틀/출석)
    const { data: shuttleStudentNames } = useShuttleNames();
    const { data: weeklyAbsent } = useWeeklyAbsentStudents(currentMonday);
    const [studentFilter, setStudentFilter] = useState<{ schools: string[]; grades: string[]; shuttle: 'all' | 'yes' | 'no'; attendance?: 'all' | 'late' | 'absent' | 'late_absent' }>({ schools: [], grades: [], shuttle: 'all' });

    // 과목 변경 시 보기설정(필터) 초기화
    const prevSubjectRef = React.useRef(subjectTab);
    useEffect(() => {
        if (prevSubjectRef.current !== subjectTab) {
            prevSubjectRef.current = subjectTab;
            // 요일 필터 초기화 (평일+주말)
            setInternalSelectedDays(['월', '화', '수', '목', '금', '토', '일']);
            // 고등수학 탭 진입 시 엑셀(요일) 뷰로 전환
            if (subjectTab === 'highmath') {
                setInternalViewType('excel');
                setTimetableViewMode('excel-day');
            } else {
                // 다른 과목 진입 시 기본 뷰로 리셋
                setInternalViewType('teacher');
                setTimetableViewMode('day-based');
            }
            // 강의실 필터 초기화 (전체 선택)
            setRoomFilter({ main: true, barun: true, godeung: true });
            storage.setString(STORAGE_KEYS.MATH_ROOM_FILTER, JSON.stringify({ main: true, barun: true, godeung: true }));
        }
    }, [subjectTab]);

    // 뷰 설정이 변경될 때마다 로컬 스토리지에 저장
    useEffect(() => {
        const settings = {
            timetableViewMode,
            showClassName,
            showSchool,
            showGrade,
            showEmptyRooms,
            cellSize,
            fontSize,
            showStudents: internalShowStudents,
            selectedDays: internalSelectedDays,
            showHoldStudents,
            showWithdrawnStudents
        };
        try {
            storage.setString(STORAGE_KEYS.TIMETABLE_VIEW_SETTINGS, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save view settings to localStorage:', e);
        }
    }, [timetableViewMode, showClassName, showSchool, showGrade, showEmptyRooms, cellSize, fontSize, internalShowStudents, internalSelectedDays, showHoldStudents, showWithdrawnStudents]);

    // Step 1: 수학/고등수학 수업의 enrollment 데이터를 classes에 병합 (드래그 전에 필요)
    const mathClassNamesFromRaw = useMemo(() => {
        return classes.filter(c => c.subject === '수학' || c.subject === '고등수학').map(c => c.className);
    }, [classes]);

    // 주차 기준일: 미래 주 → weekStart, 이번 주 → today, 과거 주 → weekEnd(일요일)
    const mathReferenceDate = useMemo(() => {
        if (!currentMonday) return undefined;
        return getWeekReferenceDate(currentMonday);
    }, [currentMonday]);

    const { classDataMap: mathClassDataMap, refetch: refetchMathClassStudents } = useMathClassStudents(mathClassNamesFromRaw, studentMap, mathReferenceDate, ['math', 'highmath']);

    const classesWithEnrollments = useMemo(() => {
        return classes.map(cls => {
            if (cls.subject === '수학' || cls.subject === '고등수학') {
                const enrollmentData = mathClassDataMap[cls.className];
                if (enrollmentData) {
                    return {
                        ...cls,
                        studentList: enrollmentData.studentList,
                        studentIds: enrollmentData.studentIds,
                    };
                }
            }
            return cls;
        });
    }, [classes, mathClassDataMap]);

    // Step 2: Drag & Drop (enrollment 데이터가 병합된 classes 사용)
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
        handleMultiDrop,
        handleSavePendingMoves,
        handleCancelPendingMoves,
        updatePendingMoveDate,
        undoLastMove
    } = useStudentDragDrop(classesWithEnrollments);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Room view is now supported for math timetable

    // 배정 예정 취소
    const handleCancelScheduledEnrollment = useCallback(async (studentId: string, className: string) => {
        try {
            const enrollmentsQuery = query(
                collection(db, 'students', studentId, 'enrollments'),
                where('subject', '==', 'math'),
                where('className', '==', className)
            );
            const snapshot = await getDocs(enrollmentsQuery);

            if (snapshot.empty) {
                alert('해당 수강 정보를 찾을 수 없습니다.');
                return;
            }

            for (const docSnap of snapshot.docs) {
                await deleteDoc(docSnap.ref);
            }

            await queryClient.invalidateQueries({ queryKey: ['students'] });
            await queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });
            alert('배정 예정이 취소되었습니다.');
        } catch (error) {
            console.error('배정 예정 취소 오류:', error);
            alert('배정 예정 취소에 실패했습니다.');
        }
    }, [queryClient]);

    // 퇴원 드롭존 모달 상태
    const [withdrawalModalInfo, setWithdrawalModalInfo] = useState<{
        studentId: string; studentName: string; classId: string; className: string;
    } | null>(null);

    const handleWithdrawalDrop = useCallback((studentId: string, classId: string, className: string) => {
        const student = studentMap[studentId];
        // 이미 퇴원 처리된 학생은 퇴원 드롭 무시
        if (student?.status === 'withdrawn') return;
        setWithdrawalModalInfo({
            studentId,
            studentName: student?.name || studentId,
            classId,
            className,
        });
    }, [studentMap]);

    const handleWithdrawalConfirm = useCallback(async (scheduledDate?: string) => {
        if (!withdrawalModalInfo) return;
        const { studentId, classId, className } = withdrawalModalInfo;
        try {
            const effectiveDate = scheduledDate || getTodayKST();
            // classId로 enrollment 찾기, 없으면 className으로 쿼리
            const enrollmentsRef = collection(db, 'students', studentId, 'enrollments');
            const enrollmentDoc = doc(enrollmentsRef, classId);
            const { getDoc } = await import('firebase/firestore');
            const snap = await getDoc(enrollmentDoc);
            if (snap.exists()) {
                await updateDoc(enrollmentDoc, { withdrawalDate: effectiveDate, endDate: effectiveDate });
            } else {
                // classId로 못 찾으면 className + subject로 쿼리
                const q = query(enrollmentsRef, where('className', '==', className));
                const qSnap = await getDocs(q);
                const activeDoc = qSnap.docs.find(d => !d.data().endDate && !d.data().withdrawalDate);
                if (activeDoc) {
                    await updateDoc(activeDoc.ref, { withdrawalDate: effectiveDate, endDate: effectiveDate });
                } else {
                    throw new Error('enrollment 문서를 찾을 수 없습니다.');
                }
            }
            queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });
        } catch (error) {
            console.error('퇴원 처리 오류:', error);
            alert('퇴원 처리에 실패했습니다.');
        }
        setWithdrawalModalInfo(null);
    }, [withdrawalModalInfo, queryClient]);

    // Current periods based on subject tab
    const currentPeriods = (subjectTab === 'math' || subjectTab === 'highmath') ? MATH_PERIODS : ENGLISH_PERIODS;
    const currentSubjectFilter = subjectTab === 'highmath' ? '고등수학' : subjectTab === 'math' ? '수학' : '영어';

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

    // 범용(Generic) 시간표용 주차 기준일
    const genericReferenceDate = useMemo(() => {
        if (!currentMonday) return undefined;
        return getWeekReferenceDate(currentMonday);
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

    // Filter classes by current subject (localClasses already has enrollment data merged)
    // + 스케줄 변경 예정 고스트 블록 추가
    const filteredClasses = useMemo(() => {
        let base = localClasses.filter(c => c.subject === currentSubjectFilter);


        // 강의실 필터 (본원/바른/고등 멀티 선택)
        if (!roomFilter.main || !roomFilter.barun || !roomFilter.godeung) {
            base = base.filter(c => {
                const room = c.room || '';
                const isBarun = room.startsWith('바른') || room.startsWith('프리미엄');
                const isGodeung = room.includes('고등');
                if (isGodeung) return roomFilter.godeung;
                if (isBarun) return roomFilter.barun;
                return roomFilter.main;
            });
        }

        const ghosts: TimetableClass[] = [];
        base.forEach(cls => {
            if (cls.pendingSchedule && cls.pendingScheduleDate) {
                // 현재 schedule에 없는 새 슬롯만 고스트로 추가
                const currentSet = new Set(cls.schedule || []);
                const newSlots = cls.pendingSchedule.filter(s => !currentSet.has(s));
                if (newSlots.length > 0) {
                    ghosts.push({
                        ...cls,
                        id: `${cls.id}_pending`,
                        schedule: newSlots,
                        isPendingSchedule: true,
                        studentList: [],
                        studentIds: [],
                    });
                }
            }
        });
        return [...base, ...ghosts];
    }, [localClasses, currentSubjectFilter, roomFilter, subjectTab]);

    // 스케줄 변경 예정 자동 적용 (마운트 시 1회)
    useEffect(() => {
        const todayStr = getTodayKST();
        const pendingClasses = classesWithEnrollments.filter(
            cls => cls.pendingSchedule && cls.pendingScheduleDate && cls.pendingScheduleDate <= todayStr
        );
        if (pendingClasses.length === 0) return;

        const applyPendingSchedules = async () => {
            for (const cls of pendingClasses) {
                try {
                    // 1. class doc 업데이트: schedule → pendingSchedule, pending 필드 삭제
                    const classesQuery = query(
                        collection(db, 'classes'),
                        where('subject', '==', cls.subject),
                        where('className', '==', cls.className)
                    );
                    const classSnapshot = await getDocs(classesQuery);

                    // pending 스케줄을 ScheduleSlot[] 형식으로 변환
                    const pendingSlots = (cls.pendingSchedule || []).map((s: string) => {
                        const parts = s.split(' ');
                        return { day: parts[0], periodId: parts[1] || '' };
                    });

                    for (const docSnap of classSnapshot.docs) {
                        await updateDoc(docSnap.ref, {
                            schedule: pendingSlots,
                            legacySchedule: cls.pendingSchedule,
                            pendingSchedule: deleteField(),
                            pendingLegacySchedule: deleteField(),
                            pendingScheduleDate: deleteField(),
                            updatedAt: new Date().toISOString(),
                        });
                    }

                    // 2. enrollments 업데이트: schedule → pendingLegacySchedule
                    const enrollmentsQuery = query(
                        collectionGroup(db, 'enrollments'),
                        where('subject', '==', cls.subject),
                        where('className', '==', cls.className)
                    );
                    const enrollSnapshot = await getDocs(enrollmentsQuery);
                    for (const docSnap of enrollSnapshot.docs) {
                        await updateDoc(docSnap.ref, {
                            schedule: cls.pendingSchedule,
                            updatedAt: new Date().toISOString(),
                        });
                    }

                    console.log(`[자동적용] ${cls.className} 스케줄 변경 적용 완료`);
                } catch (error) {
                    console.error(`[자동적용] ${cls.className} 스케줄 변경 실패:`, error);
                }
            }

            // 캐시 무효화
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });
            queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });
        };

        applyPendingSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 마운트 시 1회만 실행

    // Compute resources (all teachers from state, filtered by hidden)
    const allResources = useMemo(() => {
        if (viewType === 'teacher' || viewType === 'excel') {
            // Show all visible teachers in saved order, excluding hiddenTeachers
            const hidden = outerMathSettings.hiddenTeachers || [];
            return hidden.length > 0
                ? sortedTeachers.filter(t => !hidden.includes(t))
                : sortedTeachers;
        }
        return [...new Set(filteredClasses.map(c => c.room).filter(Boolean))].sort();
    }, [viewType, filteredClasses, sortedTeachers, outerMathSettings.hiddenTeachers]);

    // 메모이즈: 매 렌더마다 new Set() 생성 방지
    const pendingMovedStudentIds = useMemo(() =>
        pendingMoves.length > 0 ? new Set(pendingMoves.map(m => m.studentId)) : undefined,
        [pendingMoves]
    );

    // 이동 출발지 classId → studentId Set (취소선 표시용)
    const pendingMoveFromMap = useMemo(() => {
        if (pendingMoves.length === 0) return undefined;
        const map = new Map<string, Set<string>>();
        pendingMoves.forEach(m => {
            if (m.fromClassId !== m.toClassId) { // 다른 반으로 이동한 경우만
                if (!map.has(m.fromClassId)) map.set(m.fromClassId, new Set());
                map.get(m.fromClassId)!.add(m.studentId);
            }
        });
        return map;
    }, [pendingMoves]);

    // 예정일 스케줄 Map (studentId → scheduledDate, 툴팁 표시용)
    const pendingMoveSchedules = useMemo(() => {
        if (pendingMoves.length === 0) return undefined;
        const map = new Map<string, string | undefined>();
        pendingMoves.forEach(m => map.set(m.studentId, m.scheduledDate));
        return map;
    }, [pendingMoves]);

    // 예정일 이동 건수
    const scheduledMovesCount = useMemo(() =>
        pendingMoves.filter(m => m.scheduledDate).length,
        [pendingMoves]
    );

    // 예정일 학생 Map (시뮬레이션 드래그 차단용)
    const scheduledStudentDates = useMemo(() => {
        const map = new Map<string, string>();
        pendingMoves.forEach(m => {
            if (m.scheduledDate) map.set(m.studentId, m.scheduledDate);
        });
        return map.size > 0 ? map : undefined;
    }, [pendingMoves]);

    // 새 이동 감지 → 예정일 모달 표시 (cross-class + 같은반 zone 이동 모두)
    useEffect(() => {
        if (pendingMoves.length > prevPendingMovesLengthRef.current) {
            const newMoves = pendingMoves.slice(prevPendingMovesLengthRef.current);
            const lastMove = newMoves[newMoves.length - 1];
            if (lastMove) {
                const isSameClass = lastMove.fromClassId === lastMove.toClassId;
                if (isSameClass) {
                    // 같은 반 내 zone 이동 → 날짜 설정 모달 표시
                    const cls = classesWithEnrollments.find(c => c.id === lastMove.fromClassId);
                    const student = studentMap[lastMove.studentId];
                    const fromZoneLabel = lastMove.fromZone === 'common' ? '모든 요일' : `${lastMove.fromZone}만`;
                    const toZoneLabel = lastMove.toZone === 'common' ? '모든 요일' : `${lastMove.toZone}만`;
                    // 멀티 이동인 경우 모든 학생 ID 수집
                    const multiIds = newMoves.length > 1
                        ? newMoves.filter(m => m.fromClassId === m.toClassId).map(m => m.studentId)
                        : undefined;
                    const displayName = multiIds && multiIds.length > 1
                        ? (() => {
                            const names = multiIds.map(id => studentMap[id]?.name || id);
                            return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}명`;
                        })()
                        : (student?.name || lastMove.studentId);
                    setDateModalInfo({
                        studentId: lastMove.studentId,
                        studentName: displayName,
                        fromClassName: `${cls?.className || ''} (${fromZoneLabel})`,
                        toClassName: `${cls?.className || ''} (${toZoneLabel})`,
                        targetClassSchedule: cls?.schedule,
                        isZoneChange: true,
                        multiStudentIds: multiIds,
                    });
                } else {
                    // 다른 반 이동
                    const fromClass = classesWithEnrollments.find(c => c.id === lastMove.fromClassId);
                    const toClass = classesWithEnrollments.find(c => c.id === lastMove.toClassId);
                    const student = studentMap[lastMove.studentId];
                    setDateModalInfo({
                        studentId: lastMove.studentId,
                        studentName: student?.name || lastMove.studentId,
                        fromClassName: fromClass?.className || '',
                        toClassName: toClass?.className || '',
                        targetClassSchedule: toClass?.schedule,
                        isWithdrawn: student?.status === 'withdrawn' || !!student?.withdrawalDate,
                    });
                }
            }
        }
        prevPendingMovesLengthRef.current = pendingMoves.length;
    }, [pendingMoves, classesWithEnrollments, studentMap]);

    const handleDateModalConfirm = useCallback((scheduledDate?: string) => {
        if (dateModalInfo && scheduledDate) {
            // 멀티 학생 zone 이동인 경우 모든 학생에 적용
            if (dateModalInfo.multiStudentIds && dateModalInfo.multiStudentIds.length > 1) {
                dateModalInfo.multiStudentIds.forEach(sid => {
                    updatePendingMoveDate(sid, scheduledDate);
                });
            } else {
                updatePendingMoveDate(dateModalInfo.studentId, scheduledDate);
            }
        }
        setDateModalInfo(null);
    }, [dateModalInfo, updatePendingMoveDate]);

    const handleDateModalClose = useCallback(() => {
        setDateModalInfo(null);
    }, []);

    const openAddModal = () => {
        setIsAddClassOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-sm h-12 w-12 border-4 border-accent border-t-transparent"></div>
            </div>
        );
    }

    // Guard: Check permissions
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

    if (subjectTab === 'shuttle' && !canViewShuttle) {
        return (
            <div className="flex items-center justify-center h-full text-red-500">
                셔틀 시간표를 볼 수 있는 권한이 없습니다.
            </div>
        );
    }

    if (subjectTab === 'english') {
        return (
            <Suspense fallback={<VideoLoading className="flex-1 h-full" />}>
                <EnglishTimetable
                    onSwitchToMath={() => setSubjectTab('math')}
                    viewType={viewType}
                    teachers={propsTeachers}
                    classKeywords={classKeywords}
                    currentUser={currentUser}
                    studentMap={studentMap} // Pass global student map
                    currentWeekStart={currentMonday}
                    weekLabel={weekLabel}
                    goToPrevWeek={goToPrevWeek}
                    goToNextWeek={goToNextWeek}
                    goToThisWeek={goToThisWeek}
                    // 과목/뷰 전환 (TimetableNavBar 통합)
                    timetableSubject={subjectTab}
                    setTimetableSubject={setSubjectTab}
                    setTimetableViewType={setViewType as React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>}
                    mathViewMode={timetableViewMode}
                    setMathViewMode={setTimetableViewMode as (value: string) => void}
                    hasPermissionFn={externalHasPermission || hasPermission}
                    setIsTimetableSettingsOpen={externalSetIsTimetableSettingsOpen}
                    userDepartments={userDepartments}
                    shuttleStudentNames={shuttleStudentNames}
                />
            </Suspense>
        );
    }

    // Performance Note (async-suspense-boundaries): Generic Timetable with Suspense
    if (subjectTab === 'science') {
        return (
            <Suspense fallback={<VideoLoading className="flex-1 h-full" />}>
                <GenericTimetable
                    subject="science"
                    currentUser={currentUser}
                    viewType={viewType === 'excel' ? 'class' : viewType}
                    onStudentsUpdated={() => {
                        // Refresh logic if needed
                    }}
                    studentMap={studentMap}
                    referenceDate={genericReferenceDate}
                    // 과목/뷰 전환 (TimetableNavBar 통합)
                    timetableSubject={subjectTab}
                    setTimetableSubject={setSubjectTab}
                    setTimetableViewType={setViewType as React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>}
                    mathViewMode={timetableViewMode}
                    setMathViewMode={setTimetableViewMode as (value: string) => void}
                    hasPermissionFn={externalHasPermission || hasPermission}
                    setIsTimetableSettingsOpen={externalSetIsTimetableSettingsOpen}
                    userDepartments={userDepartments}
                />
            </Suspense>
        );
    }

    if (subjectTab === 'korean') {
        return (
            <Suspense fallback={<VideoLoading className="flex-1 h-full" />}>
                <GenericTimetable
                    subject="korean"
                    currentUser={currentUser}
                    viewType={viewType === 'excel' ? 'class' : viewType}
                    onStudentsUpdated={() => {
                        // Refresh logic if needed
                    }}
                    studentMap={studentMap}
                    referenceDate={genericReferenceDate}
                    // 과목/뷰 전환 (TimetableNavBar 통합)
                    timetableSubject={subjectTab}
                    setTimetableSubject={setSubjectTab}
                    setTimetableViewType={setViewType as React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>}
                    mathViewMode={timetableViewMode}
                    setMathViewMode={setTimetableViewMode as (value: string) => void}
                    hasPermissionFn={externalHasPermission || hasPermission}
                    setIsTimetableSettingsOpen={externalSetIsTimetableSettingsOpen}
                    userDepartments={userDepartments}
                />
            </Suspense>
        );
    }

    if (subjectTab === 'all') {
        return (
            <Suspense fallback={<VideoLoading className="flex-1 h-full" />}>
                <AllSubjectsTimetable
                    timetableSubject={subjectTab}
                    setTimetableSubject={setSubjectTab}
                    setTimetableViewType={setViewType as React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>}
                    mathViewMode={timetableViewMode}
                    setMathViewMode={setTimetableViewMode as (value: string) => void}
                    hasPermissionFn={externalHasPermission || hasPermission}
                    setIsTimetableSettingsOpen={externalSetIsTimetableSettingsOpen}
                    userDepartments={userDepartments}
                />
            </Suspense>
        );
    }

    if (subjectTab === 'shuttle') {
        return (
            <Suspense fallback={<VideoLoading className="flex-1 h-full" />}>
                <ShuttleTimetable
                    currentUser={currentUser}
                    timetableSubject={subjectTab}
                    setTimetableSubject={setSubjectTab}
                    setTimetableViewType={setViewType as React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>}
                    hasPermissionFn={externalHasPermission || hasPermission}
                    setIsTimetableSettingsOpen={externalSetIsTimetableSettingsOpen}
                    userDepartments={userDepartments}
                />
            </Suspense>
        );
    }

    return (
        <MathSimulationProvider>
            <MathTimetableContent
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
                scheduledMovesCount={scheduledMovesCount}
                scheduledStudentDates={scheduledStudentDates}
                pendingMovedStudentIds={pendingMovedStudentIds} pendingMoveFromMap={pendingMoveFromMap}
                pendingMoveSchedules={pendingMoveSchedules}
                handleSavePendingMoves={handleSavePendingMoves}
                handleCancelPendingMoves={handleCancelPendingMoves}
                isSaving={isSaving}
                mode={mode}
                setMode={setMode}
                canEditMath={canEditMath}
                filteredClasses={filteredClasses}
                allResources={allResources}
                orderedSelectedDays={orderedSelectedDays}
                weekDates={weekDates}
                currentPeriods={currentPeriods}
                teachers={teachers}
                columnWidth={columnWidth}
                cellSize={cellSize}
                setCellSize={setCellSize}
                rowHeight={rowHeight}
                fontSize={fontSize}
                setFontSize={setFontSize}
                showClassName={showClassName}
                setShowClassName={setShowClassName}
                showSchool={showSchool}
                setShowSchool={setShowSchool}
                showGrade={showGrade}
                setShowGrade={setShowGrade}
                showEmptyRooms={showEmptyRooms}
                showStudents={showStudents}
                setShowStudents={setShowStudents}
                showHoldStudents={showHoldStudents}
                setShowHoldStudents={setShowHoldStudents}
                showWithdrawnStudents={showWithdrawnStudents}
                setShowWithdrawnStudents={setShowWithdrawnStudents}
                dragOverClassId={dragOverClassId}
                handleDragStart={handleDragStart}
                handleDragOver={handleDragOver}
                handleDragLeave={handleDragLeave}
                handleDrop={handleDrop}
                handleMultiDrop={handleMultiDrop}
                currentSubjectFilter={currentSubjectFilter}
                studentMap={studentMap}
                timetableViewMode={timetableViewMode}
                classKeywords={classKeywords}
                setSelectedClassInfo={setSelectedClassInfo}
                setSelectedStudentForModal={setSelectedStudentForModal}
                isAddClassOpen={isAddClassOpen}
                setIsAddClassOpen={setIsAddClassOpen}
                sortedTeachers={sortedTeachers}
                selectedClassInfo={selectedClassInfo}
                selectedStudentForModal={selectedStudentForModal}
                canManageStudents={canManageStudents}
                mathConfig={mathConfig}
                handleSaveTeacherOrder={handleSaveTeacherOrder}
                isTeacherOrderModalOpen={isTeacherOrderModalOpen}
                isViewSettingsOpen={isViewSettingsOpen}
                selectedDays={selectedDays}
                setSelectedDays={setSelectedDays}
                currentMonday={currentMonday}
                currentUser={currentUser}
                isEmbedManagerOpen={isEmbedManagerOpen}
                setIsEmbedManagerOpen={setIsEmbedManagerOpen}
                classesData={classesData}
                canEditWithdrawal={canEditWithdrawal}
                canReactivateWithdrawal={canReactivateWithdrawal}
                selectedWithdrawalEntry={selectedWithdrawalEntry}
                setSelectedWithdrawalEntry={setSelectedWithdrawalEntry}
                onCancelScheduledEnrollment={handleCancelScheduledEnrollment}
                onWithdrawalDrop={handleWithdrawalDrop}
                // 과목/뷰 전환 (TimetableNavBar 통합)
                timetableSubject={subjectTab}
                setTimetableSubject={setSubjectTab}
                setTimetableViewType={setViewType as React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>}
                mathViewMode={timetableViewMode}
                setMathViewMode={setTimetableViewMode as (value: string) => void}
                hasPermissionFn={externalHasPermission || hasPermission}
                setIsTimetableSettingsOpen={externalSetIsTimetableSettingsOpen}
                undoLastMove={undoLastMove}
                roomFilter={roomFilter}
                onRoomFilterChange={handleRoomFilterChange}
                studentFilter={studentFilter}
                onStudentFilterChange={setStudentFilter}
                shuttleStudentNames={shuttleStudentNames}
                weeklyAbsent={weeklyAbsent}
                mathIntegrationSettings={outerMathSettings}
                updateMathIntegrationSettings={updateOuterMathSettings}
                userDepartments={userDepartments}
            />
            {/* 드래그 반이동 날짜 선택 모달 */}
            {dateModalInfo && (
                <ScheduledDateModal
                    studentName={dateModalInfo.studentName}
                    fromClassName={dateModalInfo.fromClassName}
                    toClassName={dateModalInfo.toClassName}
                    title={dateModalInfo.isZoneChange ? '등원일 변경 날짜 설정' : '반 이동 날짜 설정'}
                    customImmediateLabel={dateModalInfo.isZoneChange ? undefined : '즉시 이동 (오늘)'}
                    actionVerb={dateModalInfo.isZoneChange ? '변경' : undefined}
                    scheduledLabel={dateModalInfo.isZoneChange ? undefined : (dateModalInfo.isWithdrawn ? '마지막 수업일 지정' : '예정 수업일 지정')}
                    allowPastDate={!dateModalInfo.isZoneChange}
                    onConfirm={handleDateModalConfirm}
                    onClose={handleDateModalClose}
                    weekStart={currentMonday}
                    targetClassSchedule={dateModalInfo.targetClassSchedule}
                />
            )}
            {/* 퇴원 날짜 선택 모달 */}
            {withdrawalModalInfo && (
                <ScheduledDateModal
                    title="퇴원 날짜 설정"
                    description={
                        <p className="text-xs text-gray-600 text-center">
                            <span className="font-bold text-gray-800">{withdrawalModalInfo.studentName}</span>
                            <br />
                            <span className="text-gray-400">{withdrawalModalInfo.className}</span>
                        </p>
                    }
                    customImmediateLabel="즉시 퇴원 (오늘)"
                    studentName={withdrawalModalInfo.studentName}
                    fromClassName={withdrawalModalInfo.className}
                    toClassName=""
                    onConfirm={handleWithdrawalConfirm}
                    onClose={() => setWithdrawalModalInfo(null)}
                />
            )}
        </MathSimulationProvider>
    );
};

export default TimetableManager;
