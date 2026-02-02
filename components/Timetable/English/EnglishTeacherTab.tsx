
// English Teacher Schedule Tab
// 영어 강사별 시간표 탭

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Edit3, Move, Eye, Settings, ArrowRightLeft, Copy, Upload, Save, Image } from 'lucide-react';
import { EN_PERIODS, EN_WEEKDAYS, getCellKey, getTeacherColor, getContrastColor, formatClassNameWithBreaks, isExcludedStudent } from './englishUtils';
import { usePermissions } from '../../../hooks/usePermissions';
import { Teacher, ClassKeywordColor } from '../../../types';
import BatchInputBar, { InputData, MergedClass, ClassSuggestion } from './BatchInputBar';
import MoveConfirmBar from './MoveConfirmBar';
import MoveSelectionModal from './MoveSelectionModal';
import PortalTooltip from '../../Common/PortalTooltip';
import EnglishExportModal from './EnglishExportModal';
import { useEnglishClassUpdater } from '../../../hooks/useEnglishClassUpdater';
import { useClasses } from '../../../hooks/useClasses';
import { useClassStudents } from './hooks/useClassStudents';
import { useQueryClient } from '@tanstack/react-query';

export interface ScheduleCell {
    className?: string;
    classId?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: MergedClass[];
    underline?: boolean;
    lastMovedAt?: string; // ISO Date String
}

type ScheduleData = Record<string, ScheduleCell>;

interface EnglishTeacherTabProps {
    teachers: string[];
    teachersData: Teacher[];  // 강사 데이터 (색상 포함)
    scheduleData: ScheduleData;
    onRefresh?: () => void;
    onUpdateLocal?: (newData: ScheduleData) => void;
    onOpenOrderModal?: () => void;
    classKeywords?: ClassKeywordColor[];  // For keyword color coding
    currentUser: any;
    targetCollection?: string;
    isSimulationMode?: boolean;  // 시뮬레이션 모드 여부
    // Simulation controls
    canSimulation?: boolean;
    onToggleSimulation?: () => void;
    onCopyLiveToDraft?: () => void;
    onPublishToLive?: () => void;
    onOpenScenarioModal?: () => void;
    canPublish?: boolean;
    labRooms?: string[];
    studentMap?: Record<string, any>;
}

type ViewSize = 'small' | 'medium' | 'large';

const EnglishTeacherTab: React.FC<EnglishTeacherTabProps> = ({ teachers, teachersData, scheduleData, onUpdateLocal, onOpenOrderModal, classKeywords = [], currentUser, isSimulationMode = false, canSimulation = false, onToggleSimulation, onCopyLiveToDraft, onPublishToLive, onOpenScenarioModal, canPublish = false, labRooms = [], studentMap = {} }) => {
    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditEnglish = hasPermission('timetable.english.edit') || isMaster;
    // 조회 권한이 있으면 이미지 저장 가능 (편집 권한 포함)
    const canViewEnglish = hasPermission('timetable.english.view') || canEditEnglish;
    const queryClient = useQueryClient();

    // classes 컬렉션 사용 (마이그레이션 완료)

    // classes 컬렉션 업데이터 훅 (시뮬레이션 모드는 Context에서 자동 감지)
    const {
        assignCellToClass,
        removeAllClassesFromCell,
        moveSelectedClasses
    } = useEnglishClassUpdater();

    // 영어 수업 목록 (자동완성용)
    const { data: englishClasses = [] } = useClasses('english');
    const classSuggestions: ClassSuggestion[] = useMemo(() => {
        return englishClasses.map(c => ({
            className: c.className,
            room: c.room,
        }));
    }, [englishClasses]);

    // LAB실 수업명 수집 → 학생수 조회
    const labClassNames = useMemo(() => {
        if (labRooms.length === 0) return [];
        const classNameSet = new Set<string>();
        Object.values(scheduleData).forEach(cell => {
            if (cell.room && labRooms.includes(cell.room)) {
                if (cell.className) classNameSet.add(cell.className);
                cell.merged?.forEach(m => {
                    if (m.className) classNameSet.add(m.className);
                });
            }
        });
        return Array.from(classNameSet);
    }, [scheduleData, labRooms]);

    const { classDataMap } = useClassStudents(labClassNames, false, studentMap);

    const getActiveStudentCount = (className: string, slotUnderline?: boolean): number => {
        const data = classDataMap[className];
        if (!data) return 0;
        const active = data.studentList.filter((s: any) => !s.withdrawalDate && !s.onHold);
        if (slotUnderline !== undefined) {
            const hasAnyUnderline = active.some((s: any) => s.underline);
            if (hasAnyUnderline) {
                return active.filter((s: any) => !!s.underline === slotUnderline).length;
            }
        }
        return active.length;
    };

    // 시뮬레이션 모드에서는 항상 수정모드
    const [mode, setMode] = useState<'view' | 'edit' | 'move'>(isSimulationMode ? 'edit' : 'view');
    useEffect(() => {
        if (isSimulationMode) setMode('edit');
    }, [isSimulationMode]);
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [filterTeacher, setFilterTeacher] = useState<string>('all');
    const [viewSize, setViewSize] = useState<ViewSize>('medium');
    const [visibleWeekdays, setVisibleWeekdays] = useState<Set<string>>(new Set(EN_WEEKDAYS));

    // Drag Selection State
    const [isSelectionDragging, setIsSelectionDragging] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ tIdx: number, pIdx: number, dIdx: number } | null>(null);
    const [currentHover, setCurrentHover] = useState<{ tIdx: number, pIdx: number, dIdx: number } | null>(null);
    const [dragType, setDragType] = useState<'new' | 'add'>('new');

    // Batch Input State
    const [inputData, setInputData] = useState<InputData>({ className: '', room: '', merged: [], underline: false });
    const [isWarningOff, setIsWarningOff] = useState(false);

    // Move Mode State
    const [originalData, setOriginalData] = useState<ScheduleData>({});
    const [hasChanges, setHasChanges] = useState(false);
    const [pendingMove, setPendingMove] = useState<{ source: any, target: any, sourceData: ScheduleCell } | null>(null);
    const dragSource = useRef<{ tIdx: number, pIdx: number, dIdx: number } | null>(null);

    // 이미지 내보내기 상태
    const [isExportModalOpen, setExportModalOpen] = useState(false);

    // Initialize/Sync Local State
    useEffect(() => {
        // When switching to move mode or initial load, save original state if not dirty
        if (!hasChanges) {
            setOriginalData(JSON.parse(JSON.stringify(scheduleData)));
        }
    }, [scheduleData, hasChanges]);

    // Filter teachers
    const filteredTeachers = useMemo(() => {
        if (filterTeacher === 'all') return teachers;
        return teachers.filter(t => t === filterTeacher);
    }, [teachers, filterTeacher]);

    // Filter weekdays
    const filteredWeekdays = useMemo(() => {
        return EN_WEEKDAYS.filter(day => visibleWeekdays.has(day));
    }, [visibleWeekdays]);

    // 셀 키워드 매칭 Map (성능 최적화: O(n*m) → O(n) + O(1))
    const cellKeywordMap = useMemo(() => {
        const map = new Map<string, ClassKeywordColor | null>();
        Object.entries(scheduleData).forEach(([key, cell]) => {
            if (!cell.className) {
                map.set(key, null);
                return;
            }
            const matched = classKeywords.find(kw => cell.className!.includes(kw.keyword));
            map.set(key, matched || null);
        });
        return map;
    }, [scheduleData, classKeywords]);

    // Toggle weekday visibility
    const toggleWeekday = (day: string) => {
        setVisibleWeekdays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(day)) {
                newSet.delete(day);
            } else {
                newSet.add(day);
            }
            return newSet;
        });
    };

    // --- Drag Selection Logic ---

    const getCoords = (tIdx: number, pIdx: number, dIdx: number) => ({ tIdx, pIdx, dIdx });

    const getCellKeyFromCoords = (tIdx: number, pIdx: number, dIdx: number) => {
        const teacher = filteredTeachers[tIdx];
        const period = EN_PERIODS[pIdx];
        const day = filteredWeekdays[dIdx];
        if (!teacher || !period || !day) return null;
        return `${teacher}-${period.id}-${day}`; // No spaces, matching academy-app format
    };

    const handleMouseDown = (e: React.MouseEvent, tIdx: number, pIdx: number, dIdx: number) => {
        if (mode !== 'edit') return;
        const isAddMode = e.ctrlKey || e.metaKey;
        setDragType(isAddMode ? 'add' : 'new');

        const coords = getCoords(tIdx, pIdx, dIdx);
        const key = getCellKeyFromCoords(tIdx, pIdx, dIdx);

        // Initialize Input Data from first clicked cell if exists
        const existing = key ? scheduleData[key] : undefined;

        // Get teacher's default room
        const teacher = filteredTeachers[tIdx];
        const teacherData = teachersData.find(t => t.name === teacher);
        const defaultRoom = teacherData?.defaultRoom || '';

        if (existing) {
            setInputData({
                className: existing.className || '',
                room: existing.room || defaultRoom,
                merged: existing.merged || [],
                underline: existing.underline || false
            });
        } else if (!isAddMode) {
            // New selection, use teacher's default room
            setInputData({ className: '', room: defaultRoom, merged: [], underline: false });
        }

        setSelectionStart(coords);
        setCurrentHover(coords);
        setIsSelectionDragging(true);

        if (key) {
            if (isAddMode) {
                setSelectedCells(prev => new Set(prev).add(key));
            } else {
                setSelectedCells(new Set([key]));
            }
        }
    };

    const handleMouseEnter = (tIdx: number, pIdx: number, dIdx: number) => {
        if (mode === 'edit' && isSelectionDragging) {
            setCurrentHover(getCoords(tIdx, pIdx, dIdx));
        }
    };

    const handleMouseUp = () => {
        if (mode === 'edit' && isSelectionDragging && selectionStart && currentHover) {
            const minT = Math.min(selectionStart.tIdx, currentHover.tIdx);
            const maxT = Math.max(selectionStart.tIdx, currentHover.tIdx);
            const minP = Math.min(selectionStart.pIdx, currentHover.pIdx);
            const maxP = Math.max(selectionStart.pIdx, currentHover.pIdx);
            const minD = Math.min(selectionStart.dIdx, currentHover.dIdx);
            const maxD = Math.max(selectionStart.dIdx, currentHover.dIdx);

            const newSet = dragType === 'add' ? new Set<string>(selectedCells) : new Set<string>();

            for (let t = minT; t <= maxT; t++) {
                for (let p = minP; p <= maxP; p++) {
                    for (let d = minD; d <= maxD; d++) {
                        const key = getCellKeyFromCoords(t, p, d);
                        if (key) newSet.add(key);
                    }
                }
            }
            setSelectedCells(newSet);
        }
        setIsSelectionDragging(false);
        setCurrentHover(null);
    };

    // Sync InputData with Selection
    useEffect(() => {
        if (selectedCells.size === 1) {
            const key = Array.from(selectedCells)[0] as string;
            const cellData = scheduleData[key];

            // Extract teacher from cell key (format: "teacherName-period-day")
            const teacherName = key.split('-')[0];
            const teacherData = teachersData.find(t => t.name === teacherName);
            const defaultRoom = teacherData?.defaultRoom || '';

            if (cellData) {
                setInputData({
                    className: cellData.className || '',
                    room: cellData.room || defaultRoom,
                    merged: cellData.merged || [],
                    underline: cellData.underline || false
                });
            } else {
                setInputData({ className: '', room: defaultRoom, merged: [], underline: false });
            }
        } else if (selectedCells.size > 1) {
            // Optional: Clear or show 'Mixed'
            // For safety, let's keep previous input or clear?
            // Usually keeping existing input allows batch edit.
            // But if we want to "Edit newly selected", we might rely on the first click.
            // But the user issue was "Nothing shown".
            // Let's NOT clear if > 1, so batch edit works (user types one value for all).
        }
    }, [selectedCells, scheduleData, teachersData]);

    const isCellInDragArea = (tIdx: number, pIdx: number, dIdx: number) => {
        if (mode !== 'edit' || !isSelectionDragging || !selectionStart || !currentHover) return false;

        const minT = Math.min(selectionStart.tIdx, currentHover.tIdx);
        const maxT = Math.max(selectionStart.tIdx, currentHover.tIdx);
        const minP = Math.min(selectionStart.pIdx, currentHover.pIdx);
        const maxP = Math.max(selectionStart.pIdx, currentHover.pIdx);
        const minD = Math.min(selectionStart.dIdx, currentHover.dIdx);
        const maxD = Math.max(selectionStart.dIdx, currentHover.dIdx);

        return tIdx >= minT && tIdx <= maxT &&
            pIdx >= minP && pIdx <= maxP &&
            dIdx >= minD && dIdx <= maxD;
    };

    // --- Move Logic ---

    const handleDragStart = (e: React.DragEvent, tIdx: number, pIdx: number, dIdx: number) => {
        if (mode !== 'move') return;
        dragSource.current = { tIdx, pIdx, dIdx };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ tIdx, pIdx, dIdx })); // Fallback

        // Optional: Custom Drag Image
        const el = e.target as HTMLElement;
        el.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent) => {
        if (mode !== 'move') return;
        const el = e.target as HTMLElement;
        el.style.opacity = '1';
        dragSource.current = null;
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (mode !== 'move') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, tIdx: number, pIdx: number, dIdx: number) => {
        if (mode !== 'move' || !dragSource.current) return;
        e.preventDefault();

        const source = dragSource.current;
        const target = { tIdx, pIdx, dIdx };

        // Self drop check
        if (source.tIdx === target.tIdx && source.pIdx === target.pIdx && source.dIdx === target.dIdx) return;

        const sKey = getCellKeyFromCoords(source.tIdx, source.pIdx, source.dIdx);

        if (!sKey) return;

        const sourceData = scheduleData[sKey];

        // If merged classes exist, ask user what to move
        if (sourceData && sourceData.merged && sourceData.merged.length > 0) {
            setPendingMove({ source, target, sourceData });
            return;
        }

        performMove(source, target);
    };

    const performMove = async (source: any, target: any, moveIndices: number[] | null = null) => {
        const sKey = getCellKeyFromCoords(source.tIdx, source.pIdx, source.dIdx);
        const tKey = getCellKeyFromCoords(target.tIdx, target.pIdx, target.dIdx);

        // If keys are invalid, return
        if (!sKey || !tKey) return;

        const sData = scheduleData[sKey];
        const sTeacher = filteredTeachers[source.tIdx];

        if (!sData) return;

        try {
            // 이동할 수업 목록과 남길 수업 목록 계산
            const sMain = sData.className ? { className: sData.className, room: sData.room, underline: sData.underline } : null;
            const sMerged = sData.merged || [];

            const classesToMove: { className: string; room?: string; underline?: boolean }[] = [];
            const classesToKeep: { className: string; room?: string; underline?: boolean }[] = [];

            if (moveIndices) {
                // 선택적 이동
                const indicesToMove = new Set(moveIndices);

                if (sMain) {
                    if (indicesToMove.has(-1) && !isExcludedStudent(sMain.className)) {
                        classesToMove.push(sMain);
                    } else {
                        classesToKeep.push(sMain);
                    }
                }

                sMerged.forEach((m, idx) => {
                    if (indicesToMove.has(idx) && !isExcludedStudent(m.className)) {
                        classesToMove.push({ className: m.className, room: m.room, underline: m.underline });
                    } else {
                        classesToKeep.push({ className: m.className, room: m.room, underline: m.underline });
                    }
                });
            } else {
                // 전체 이동 (제외 대상 제외)
                if (sMain) {
                    if (isExcludedStudent(sMain.className)) {
                        classesToKeep.push(sMain);
                    } else {
                        classesToMove.push(sMain);
                    }
                }

                sMerged.forEach(m => {
                    if (isExcludedStudent(m.className)) {
                        classesToKeep.push({ className: m.className, room: m.room, underline: m.underline });
                    } else {
                        classesToMove.push({ className: m.className, room: m.room, underline: m.underline });
                    }
                });
            }

            if (classesToMove.length === 0) {
                alert("이동할 학생이 없습니다 (모두 제외 대상)");
                setPendingMove(null);
                return;
            }

            // classes 컬렉션에 직접 저장
            await moveSelectedClasses(sKey, tKey, classesToMove, classesToKeep);

            // UI 업데이트 (로컬 상태도 업데이트하여 즉시 반영)
            const newData = { ...scheduleData };

            // 소스 업데이트
            if (classesToKeep.length > 0) {
                const mainKeep = classesToKeep[0];
                newData[sKey] = {
                    className: mainKeep.className,
                    room: mainKeep.room,
                    underline: mainKeep.underline,
                    merged: classesToKeep.slice(1).map(c => ({ className: c.className, room: c.room, underline: c.underline })),
                    teacher: sTeacher
                };
            } else {
                delete newData[sKey];
            }

            // 타겟 업데이트
            const tData = scheduleData[tKey];
            const tTeacher = filteredTeachers[target.tIdx];
            const existingAtTarget = tData ? [
                ...(tData.className ? [{ className: tData.className, room: tData.room, underline: tData.underline }] : []),
                ...(tData.merged || [])
            ] : [];

            const allAtTarget = [...classesToMove, ...existingAtTarget];
            if (allAtTarget.length > 0) {
                const mainTarget = allAtTarget[0];
                newData[tKey] = {
                    className: mainTarget.className,
                    room: mainTarget.room,
                    underline: mainTarget.underline,
                    merged: allAtTarget.slice(1).map(c => ({ className: c.className, room: c.room, underline: c.underline })),
                    teacher: tTeacher
                };
            }

            onUpdateLocal(newData);
            setHasChanges(true);
            setPendingMove(null);
        } catch (error) {
            console.error('이동 실패:', error);
            alert('이동 중 오류가 발생했습니다');
            setPendingMove(null);
        }
    };

    const saveMoveChanges = async () => {
        // performMove에서 즉시 저장되므로 여기서는 상태만 리셋 (확인 버튼)
        setHasChanges(false);
        setOriginalData(JSON.parse(JSON.stringify(scheduleData)));
    };

    const cancelMoveChanges = () => {
        if (window.confirm("이동을 되돌리시겠습니까? (DB에서 다시 불러옵니다)")) {
            // onSnapshot이 DB 변경을 감지하여 자동으로 UI 갱신함
            // 여기서는 로컬 상태만 리셋하고, 실제 되돌리기는 DB 기준으로 처리
            setHasChanges(false);
            // 페이지 새로고침으로 DB 상태 복원 (onSnapshot이 다시 로드)
            window.location.reload();
        }
    };

    // --- Batch Operations ---

    const handleBatchSave = async () => {
        console.log('handleBatchSave called!', { size: selectedCells.size, inputData });
        if (selectedCells.size === 0) return;

        // Save current scroll position before clearing selection
        const scrollContainer = document.querySelector('.overflow-auto');
        const scrollTop = scrollContainer?.scrollTop || 0;
        const scrollLeft = scrollContainer?.scrollLeft || 0;

        let overwrite = false;
        if (!isWarningOff) {
            for (const key of Array.from(selectedCells)) {
                if (scheduleData[key as string]?.className) {
                    overwrite = true;
                    break;
                }
            }
        }

        if (overwrite && !window.confirm("덮어쓰시겠습니까?")) return;

        try {
            const isDelete = !inputData.className && (!inputData.merged || inputData.merged.length === 0);

            for (const key of Array.from(selectedCells)) {
                if (isDelete) {
                    // 셀의 모든 수업 제거
                    await removeAllClassesFromCell(key);
                } else {
                    // 셀에 수업 배치 (합반 포함)
                    await assignCellToClass(key, {
                        className: inputData.className,
                        room: inputData.room,
                        merged: inputData.merged || [],
                        underline: inputData.underline || false
                    });
                }
            }

            // UI는 React Query 캐시 무효화로 자동 업데이트됨
            setSelectedCells(new Set());

            // Restore scroll position
            requestAnimationFrame(() => {
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollTop;
                    scrollContainer.scrollLeft = scrollLeft;
                }
            });
        } catch (e) {
            console.error('저장 실패:', e);
            alert('저장 실패');
        }
    };

    const handleBatchDelete = async () => {
        if (!confirm('선택한 셀을 삭제하시겠습니까?')) return;

        // Save current scroll position before clearing selection
        const scrollContainer = document.querySelector('.overflow-auto');
        const scrollTop = scrollContainer?.scrollTop || 0;
        const scrollLeft = scrollContainer?.scrollLeft || 0;

        try {
            for (const key of Array.from(selectedCells)) {
                await removeAllClassesFromCell(key);
            }

            // UI는 React Query 캐시 무효화로 자동 업데이트됨
            setSelectedCells(new Set<string>());

            // Restore scroll position
            requestAnimationFrame(() => {
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollTop;
                    scrollContainer.scrollLeft = scrollLeft;
                }
            });
        } catch (e) {
            console.error('삭제 실패:', e);
            alert('삭제 실패');
        }
    };

    // Helper for merged classes
    const addMerged = () => {
        // Get teacher's default room
        let defaultRoom = '';
        if (selectionStart) {
            const teacher = filteredTeachers[selectionStart.tIdx];
            const teacherData = teachersData.find(t => t.name === teacher);
            defaultRoom = teacherData?.defaultRoom || '';
        }

        setInputData(prev => ({
            ...prev,
            merged: [...prev.merged, { className: '', room: defaultRoom, underline: false }]
        }));
    };

    const updateMerged = (index: number, field: keyof MergedClass, value: string | boolean) => {
        const newMerged = [...inputData.merged];
        newMerged[index] = { ...newMerged[index], [field]: value };
        setInputData(prev => ({ ...prev, merged: newMerged }));
    };

    const removeMerged = (index: number) => {
        setInputData(prev => ({
            ...prev,
            merged: prev.merged.filter((_, i) => i !== index)
        }));
    };

    const changeMode = (newMode: 'view' | 'edit' | 'move') => {
        if (hasChanges && mode === 'move' && newMode !== 'move') {
            if (!confirm('저장하지 않은 이동 내용이 있습니다. 무시하고 변경하시겠습니까?')) return;
            // Rollback
            onUpdateLocal(JSON.parse(JSON.stringify(originalData)));
            setHasChanges(false);
        }
        setMode(newMode);
        setSelectedCells(new Set<string>());
    };

    return (
        <div
            className="flex flex-col h-full relative"
            onMouseUp={handleMouseUp}
        >
            {/* Toolbar */}
            <div className={`flex items - center justify - between px - 4 py - 2 bg - gray - 50 border - b flex - shrink - 0 relative z - 20`}>
                <div className="flex items-center gap-2">
                    {/* View Size Controls */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mr-2 flex-shrink-0">
                        <button
                            onClick={() => setViewSize('small')}
                            className={`px-2 py-0.5 text-xs font-bold rounded transition-all whitespace-nowrap ${viewSize === 'small' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'} `}
                        >
                            작게
                        </button>
                        <button
                            onClick={() => setViewSize('medium')}
                            className={`px-2 py-0.5 text-xs font-bold rounded transition-all whitespace-nowrap ${viewSize === 'medium' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'} `}
                        >
                            보통
                        </button>
                        <button
                            onClick={() => setViewSize('large')}
                            className={`px-2 py-0.5 text-xs font-bold rounded transition-all whitespace-nowrap ${viewSize === 'large' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'} `}
                        >
                            크게
                        </button>
                    </div>

                    {/* Teacher Order Button - Gated by edit permission */}
                    {canEditEnglish && (
                        <button
                            onClick={onOpenOrderModal}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-bold shadow-sm"
                        >
                            <Settings size={14} />
                            강사 순서
                        </button>
                    )}

                    {!isSimulationMode && (
                        <>
                            <div className="h-6 w-px bg-gray-300 mx-2" />

                            {/* Mode Toggle */}
                            <div className="flex bg-gray-200 rounded-lg p-0.5 gap-0.5">
                                <button
                                    onClick={() => changeMode('view')}
                                    className={`px-2 py-0.5 text-xs font-bold rounded transition-all flex items-center ${mode === 'view' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'} `}
                                >
                                    <Eye size={10} className="mr-1" />조회
                                </button>
                                {canEditEnglish && (
                                    <button
                                        onClick={() => changeMode('edit')}
                                        className={`px-2 py-0.5 text-xs font-bold rounded transition-all flex items-center ${mode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'} `}
                                    >
                                        <Edit3 size={10} className="mr-1" />편집
                                    </button>
                                )}
                                {canEditEnglish && (
                                    <button
                                        onClick={() => changeMode('move')}
                                        className={`px-2 py-0.5 text-xs font-bold rounded transition-all flex items-center ${mode === 'move' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500'} `}
                                    >
                                        <Move size={10} className="mr-1" />이동
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* Teacher Filter */}
                    <select
                        value={filterTeacher}
                        onChange={(e) => setFilterTeacher(e.target.value)}
                        className="px-2 py-1 text-xs border rounded"
                    >
                        <option value="all">전체 강사</option>
                        {teachers.map(t => {
                            const teacherData = teachersData.find(td => td.name === t);
                            const displayName = teacherData?.englishName || t;
                            return (
                                <option key={t} value={t}>{displayName}</option>
                            );
                        })}
                    </select>

                    <div className="h-6 w-px bg-gray-300 mx-2" />

                    {/* Weekday Visibility Toggles */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                        <span className="text-xxs text-gray-500 mr-1">요일:</span>
                        {EN_WEEKDAYS.map(day => (
                            <label key={day} className="flex items-center gap-0.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={visibleWeekdays.has(day)}
                                    onChange={() => toggleWeekday(day)}
                                    className="w-3 h-3 cursor-pointer"
                                />
                                <span className="text-xxs text-gray-700">{day}</span>
                            </label>
                        ))}
                    </div>

                    {/* Simulation Mode Toggle */}
                    {canSimulation && (
                        <>
                            <div className="h-6 w-px bg-gray-300 mx-2" />
                            <div
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${isSimulationMode ? 'bg-orange-100 border-orange-300' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                                onClick={onToggleSimulation}
                            >
                                <ArrowRightLeft size={14} className={isSimulationMode ? 'text-orange-600' : 'text-gray-500'} />
                                <span className={`text-xs font-bold ${isSimulationMode ? 'text-orange-700' : 'text-gray-600'}`}>
                                    {isSimulationMode ? '시뮬레이션' : '실시간'}
                                </span>
                            </div>
                        </>
                    )}

                    {/* 이미지 내보내기 버튼 (조회 권한 있으면 표시) */}
                    {canViewEnglish && (
                        <button
                            onClick={() => setExportModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition-colors shadow-sm"
                            title="시간표 이미지로 내보내기"
                        >
                            <Image size={14} />
                            이미지 저장
                        </button>
                    )}
                </div>
            </div>

            {/* Row 3: Simulation Action Bar */}
            {isSimulationMode && canEditEnglish && (
                <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-orange-50 border-b border-orange-200 flex-shrink-0">
                    <button
                        onClick={onCopyLiveToDraft}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-50 shadow-sm transition-colors"
                        title="현재 실시간 시간표를 복사해옵니다 (기존 시뮬레이션 데이터 덮어쓰기)"
                    >
                        <Copy size={12} />
                        현재 상태 가져오기
                    </button>
                    {canPublish && (
                        <button
                            onClick={onPublishToLive}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 shadow-sm transition-colors"
                            title="시뮬레이션 내용을 실제 시간표에 적용합니다 (주의)"
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

            {/* Move Confirm Bar */}
            <MoveConfirmBar
                hasChanges={hasChanges && mode === 'move'}
                cancelMoveChanges={cancelMoveChanges}
                saveMoveChanges={saveMoveChanges}
            />

            {/* Schedule Grid */}
            <div className="flex-1 overflow-auto bg-gray-100 select-none">
                <div className="p-2">
                    <table className="border-collapse bg-white shadow w-max table-fixed">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className="p-2 border bg-gray-100 text-xs font-bold text-gray-600" rowSpan={2}>교시</th>
                                {filteredTeachers.map((teacher, tIdx) => {
                                    const colors = getTeacherColor(teacher, teachersData);
                                    const teacherData = teachersData.find(t => t.name === teacher);
                                    const displayName = teacherData?.englishName || teacher;
                                    return (
                                        <th
                                            key={teacher}
                                            colSpan={filteredWeekdays.length}
                                            className={`p-2 text-xs font-bold
                                            ${tIdx === 0 ? 'border-l-2 border-l-gray-400' : 'border-l'}
                                            border-r border-t border-b
                                        `}
                                            style={{ backgroundColor: colors.bg, color: colors.text }}
                                        >
                                            {displayName}
                                        </th>
                                    );
                                })}
                            </tr>
                            <tr>
                                {filteredTeachers.map((teacher) => (
                                    filteredWeekdays.map((day, dIdx) => (
                                        <th
                                            key={`${teacher}-${day}`}
                                            className={`p-1 bg-gray-50 text-xxs text-gray-500
                                            ${viewSize === 'large' ? 'w-[100px]' : ''}
                                            ${viewSize === 'medium' ? 'w-[70px]' : ''}
                                            ${viewSize === 'small' ? 'w-[40px]' : ''}
                                            ${dIdx === 0 ? 'border-l-2 border-l-gray-400' : 'border-l'}
                                            border-r border-t border-b
                                        `}
                                        >
                                            {day}
                                        </th>
                                    ))
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {EN_PERIODS.map((period, pIdx) => (
                                <tr key={period.id}>
                                    <td className="p-2 border bg-gray-50 text-xs font-bold text-gray-600 text-center whitespace-nowrap">
                                        <div>{period.label}</div>
                                        <div className="text-micro text-gray-400">{period.time}</div>
                                        {period.weekendTime && (
                                            <div className="text-micro text-blue-400">토일 {period.weekendTime}</div>
                                        )}
                                    </td>
                                    {filteredTeachers.map((teacher, tIdx) => (
                                        filteredWeekdays.map((day, dIdx) => {
                                            const cellKey = getCellKey(teacher, period.id, day);
                                            const cellData = scheduleData[cellKey];

                                            const isSelected = selectedCells.has(cellKey);
                                            const isInDrag = isCellInDragArea(tIdx, pIdx, dIdx);
                                            const isHighlighted = isSelected || isInDrag;

                                            // Move Mode Visuals
                                            const isMoveMode = mode === 'move';
                                            const hasContent = !!cellData?.className;

                                            // 키워드 색상 매칭 (Map에서 O(1) 조회)
                                            const matchedKw = cellKeywordMap.get(cellKey);

                                            // 셀 배경 스타일 결정
                                            const cellBgStyle = matchedKw
                                                ? { backgroundColor: matchedKw.bgColor }
                                                : {};

                                            // LAB실 학생수 계산 (배지 + 툴팁 공용)
                                            const isLabRoom = !!(cellData?.room && labRooms.includes(cellData.room));
                                            let mainCount = 0;
                                            let totalCount = 0;
                                            if (isLabRoom && cellData?.className) {
                                                mainCount = getActiveStudentCount(cellData.className, cellData.underline);
                                                totalCount = mainCount;
                                                if (cellData.merged && cellData.merged.length > 0) {
                                                    cellData.merged.forEach(m => {
                                                        totalCount += getActiveStudentCount(m.className, m.underline);
                                                    });
                                                }
                                            }

                                            return (
                                                <td
                                                    key={cellKey}
                                                    // Drag Events for Move Mode
                                                    draggable={isMoveMode && hasContent}
                                                    onDragStart={(e) => handleDragStart(e, tIdx, pIdx, dIdx)}
                                                    onDragEnd={handleDragEnd}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, tIdx, pIdx, dIdx)}

                                                    // Mouse Events for Edit Selection Mode
                                                    onMouseDown={(e) => handleMouseDown(e, tIdx, pIdx, dIdx)}
                                                    onMouseEnter={() => handleMouseEnter(tIdx, pIdx, dIdx)}

                                                    className={`p-0 text-center transition-all relative
                                                    ${isMoveMode && hasContent ? 'cursor-grab active:cursor-grabbing hover:bg-orange-50' : ''}
                                                    ${isMoveMode && !hasContent ? 'hover:bg-orange-50/30' : ''}
                                                    ${!isMoveMode ? 'cursor-pointer' : ''}
                                                    ${isHighlighted ? 'bg-blue-100 ring-2 ring-blue-400 z-10' : (!matchedKw && cellData?.className ? 'bg-green-50' : 'hover:bg-gray-50')}
                                                    ${dIdx === 0 ? 'border-l-2 border-l-gray-400' : 'border-l'}
                                                    border-r border-t border-b
                                                    hover:z-50
                                                `}
                                                    style={!isHighlighted ? cellBgStyle : {}}
                                                >
                                                    <div className={`w-full flex flex-col justify-center items-center p-0.5 relative group overflow-hidden
                                                    ${viewSize === 'large' ? 'h-[100px] min-h-[100px]' : ''}
                                                    ${viewSize === 'medium' ? 'h-[70px] min-h-[70px]' : ''}
                                                    ${viewSize === 'small' ? 'h-[40px] min-h-[40px]' : ''}
                                                `}>
                                                        {cellData?.className && (
                                                            (() => {
                                                                const classNameParts = formatClassNameWithBreaks(cellData.className);

                                                                // Check for recent move (within 14 days)
                                                                const isMoved = cellData.lastMovedAt && (() => {
                                                                    const diff = new Date().getTime() - new Date(cellData.lastMovedAt).getTime();
                                                                    return diff / (1000 * 60 * 60 * 24) <= 14;
                                                                })();

                                                                return (
                                                                    <div
                                                                        className={`leading-tight px-0.5 text-center break-words w-full
                                                                            ${viewSize === 'large'
                                                                                ? (cellData.className.length > 12 ? 'text-[13px]' : (cellData.className.length > 8 ? 'text-[14px]' : 'text-[16px]'))
                                                                                : viewSize === 'medium'
                                                                                    ? 'text-xxs'
                                                                                    : 'text-nano leading-[1.1]'
                                                                            }
                                                                        `}
                                                                        style={
                                                                            matchedKw
                                                                                ? { backgroundColor: matchedKw.bgColor, color: matchedKw.textColor, borderRadius: '4px', padding: '2px 4px' }
                                                                                : (isMoved ? { backgroundColor: '#dcfce7', borderRadius: '4px', padding: '2px 4px' } : {}) // bg-green-100 hex
                                                                        }
                                                                    >
                                                                        {classNameParts.map((part, idx) => (
                                                                            <React.Fragment key={idx}>
                                                                                {part}
                                                                                {idx < classNameParts.length - 1 && <br />}
                                                                            </React.Fragment>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()
                                                        )}

                                                        {/* Separator Line (Only for Large/Medium) */}
                                                        {cellData?.className && cellData?.room && viewSize !== 'small' && (
                                                            <div className="w-[80%] border-t border-gray-300 my-1"></div>
                                                        )}

                                                        {cellData?.room && (
                                                            <div
                                                                className={`${viewSize === 'large' ? 'text-sm' : (viewSize === 'medium' ? 'text-micro' : 'text-nano')} font-medium`}
                                                                style={{ color: matchedKw ? getContrastColor(matchedKw.bgColor) : '#6B7280' }}
                                                            >
                                                                {cellData.room}
                                                            </div>
                                                        )}

                                                        {/* LAB실 학생수 표시 (강의실뷰와 동일 디자인) */}
                                                        {isLabRoom && totalCount > 0 && (
                                                            <div className="absolute bottom-0.5 left-0.5 bg-indigo-600 text-white text-micro font-bold px-1 rounded-sm shadow-sm z-10 leading-tight">
                                                                {totalCount}명
                                                            </div>
                                                        )}

                                                        {/* Render Merged Badge & Tooltip */}
                                                        {cellData?.merged && cellData.merged.length > 0 && (
                                                            <PortalTooltip
                                                                position="top"
                                                                triggerClassName="absolute top-0.5 right-0.5 bg-red-500 text-white text-micro font-bold px-1 rounded-sm shadow-sm z-20 cursor-help pointer-events-auto hover:scale-110 transition-transform"
                                                                content={
                                                                    <div className="w-48 bg-slate-800 text-white p-2 rounded shadow-xl z-50 text-left pointer-events-none">
                                                                        <div className="flex justify-between items-center bg-slate-700/50 px-2 py-1 -mx-2 -mt-2 mb-2 rounded-t border-b border-slate-700">
                                                                            <span className="text-xxs font-bold text-slate-300">합반 수업 목록</span>
                                                                            <span className="text-micro bg-slate-700 px-1 rounded ml-1 text-slate-400">총 {cellData.merged.length + 1}개</span>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5">
                                                                            {/* 메인 수업 */}
                                                                            <div className="flex justify-between items-center">
                                                                                <div className="text-xxs font-bold text-slate-200">{cellData.className}</div>
                                                                                <div className="flex items-center gap-1">
                                                                                    {isLabRoom && <span className="text-micro text-indigo-300">{mainCount}명</span>}
                                                                                    {cellData.room && <span className="text-micro bg-slate-700 px-1.5 py-0.5 rounded text-blue-300 font-mono">{cellData.room}</span>}
                                                                                </div>
                                                                            </div>
                                                                            {/* 합반 수업들 */}
                                                                            {cellData.merged.map((m, idx) => {
                                                                                const isMoved = m.lastMovedAt && (() => {
                                                                                    const diff = new Date().getTime() - new Date(m.lastMovedAt).getTime();
                                                                                    return diff / (1000 * 60 * 60 * 24) <= 14;
                                                                                })();
                                                                                const mCount = isLabRoom ? getActiveStudentCount(m.className, m.underline) : 0;
                                                                                return (
                                                                                    <div key={idx} className="flex justify-between items-center" style={isMoved ? { backgroundColor: '#dcfce7', padding: '2px', borderRadius: '4px' } : {}}>
                                                                                        <div className={`text-xxs font-bold ${isMoved ? 'text-green-800' : 'text-slate-200'}`}>{m.className}</div>
                                                                                        <div className="flex items-center gap-1">
                                                                                            {isLabRoom && mCount > 0 && <span className="text-micro text-indigo-300">{mCount}명</span>}
                                                                                            {m.room && <span className="text-micro bg-slate-700 px-1.5 py-0.5 rounded text-blue-300 font-mono">{m.room}</span>}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        {/* 합산 */}
                                                                        {isLabRoom && totalCount > 0 && (
                                                                            <div className="mt-1.5 pt-1.5 border-t border-slate-700 flex justify-between items-center">
                                                                                <span className="text-micro text-slate-400">합계</span>
                                                                                <span className="text-xxs font-bold text-indigo-300">{totalCount}명</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 transform"></div>
                                                                    </div>
                                                                }
                                                            >
                                                                +{cellData.merged.length}
                                                            </PortalTooltip>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Bottom Spacer for comfortable scrolling */}
                    {mode === 'edit' && selectedCells.size > 0 && <div className="h-[50px]" />}
                </div>
            </div>

            {/* Batch Input Bar - flex-shrink-0으로 스크롤 영역 위에 고정 */}
            {mode === 'edit' && selectedCells.size > 0 && (
                <div className="flex-shrink-0 border-t border-gray-200 bg-white shadow-lg">
                    <BatchInputBar
                        selectedCells={selectedCells}
                        inputData={inputData}
                        setInputData={setInputData}
                        isWarningOff={isWarningOff}
                        setIsWarningOff={setIsWarningOff}
                        addMerged={addMerged}
                        updateMerged={updateMerged}
                        removeMerged={removeMerged}
                        handleBatchSave={handleBatchSave}
                        handleBatchDelete={handleBatchDelete}
                        classSuggestions={classSuggestions}
                    />
                </div>
            )}

            {/* Move Selection Modal */}
            <MoveSelectionModal
                pendingMove={pendingMove}
                setPendingMove={setPendingMove}
                performMove={performMove}
            />

            {/* 이미지 내보내기 모달 */}
            <EnglishExportModal
                isOpen={isExportModalOpen}
                onClose={() => setExportModalOpen(false)}
                teachers={teachers}
                teachersData={teachersData}
                scheduleData={scheduleData}
                visibleWeekdays={visibleWeekdays}
            />
        </div>
    );
};

export default EnglishTeacherTab;
