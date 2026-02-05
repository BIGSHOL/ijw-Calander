import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, getDocs, doc, setDoc, writeBatch, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { listenerRegistry } from '../../../utils/firebaseCleanup';
import { CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';
import { Teacher, ClassKeywordColor } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';
import { useClasses } from '../../../hooks/useClasses';
import { storage, STORAGE_KEYS } from '../../../utils/localStorage';
import EnglishTeacherTab from './EnglishTeacherTab';
import EnglishClassTab from './EnglishClassTab';
import EnglishRoomTab from './EnglishRoomTab';
import TeacherOrderModal from './TeacherOrderModal';
import BackupHistoryModal from './BackupHistoryModal';
import ScenarioManagementModal from './ScenarioManagementModal';
import { SimulationProvider, useSimulation } from './context/SimulationContext';
import { History, Undo2, Redo2, ChevronDown, ChevronUp, Focus, ChevronLeft, ChevronRight, Search, Eye, Edit, Settings, ArrowRightLeft, Copy, Upload, Save, SlidersHorizontal, Download, X, Users, Home, User, CalendarDays } from 'lucide-react';
import { useEnglishStats } from './hooks/useEnglishStats';
import { useEnglishSettings } from './hooks/useEnglishSettings';
import PortalTooltip from '../../Common/PortalTooltip';
import { formatSchoolGrade } from '../../../utils/studentUtils';

interface EnglishTimetableProps {
    onClose?: () => void;
    onSwitchToMath?: () => void;
    viewType: 'teacher' | 'class' | 'room';
    teachers?: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
    studentMap: Record<string, any>;
    // 주차 이동 시 배정 예정/퇴원 예정 미리보기용
    currentWeekStart?: Date;
    // 주차 네비게이션 (공통)
    weekLabel?: string;
    goToPrevWeek?: () => void;
    goToNextWeek?: () => void;
    goToThisWeek?: () => void;
}

interface ScheduleCell {
    className?: string;
    classId?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: { className: string; classId?: string; room: string; underline?: boolean; lastMovedAt?: string }[];
    underline?: boolean;
    lastMovedAt?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

// Inner component that uses SimulationContext
const EnglishTimetableInner: React.FC<EnglishTimetableProps> = ({ onClose, onSwitchToMath, viewType, teachers: propsTeachers = [], classKeywords = [], currentUser, studentMap, currentWeekStart, weekLabel, goToPrevWeek, goToNextWeek, goToThisWeek }) => {
    // Removed local activeTab state, using viewType prop
    const [scheduleData, setScheduleData] = useState<ScheduleData>({});
    const [loading, setLoading] = useState(true);
    const [teachers, setTeachers] = useState<string[]>([]);
    const [teachersData, setTeachersData] = useState<Teacher[]>([]);  // 색상 정보 포함
    // localStorage 캐시에서 초기값 로드 (깜빡임 방지)
    const [teacherOrder, setTeacherOrder] = useState<string[]>(() =>
        storage.getJSON<string[]>(STORAGE_KEYS.ENGLISH_TEACHER_ORDER_CACHE, [])
    );
    const [publishedScenarioName, setPublishedScenarioName] = useState<string | null>(null);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [labRooms, setLabRooms] = useState<string[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isLevelSettingsOpen, setIsLevelSettingsOpen] = useState(false);
    const [isDisplayOptionsOpen, setIsDisplayOptionsOpen] = useState(false);

    // Header controls (mode, search) - managed at parent level for class view
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [searchQuery, setSearchQuery] = useState('');

    // 공통 뷰 설정 타입
    type ViewSize = 'small' | 'medium' | 'large';
    const EN_WEEKDAYS_LOCAL = ['월', '화', '수', '목', '금', '토', '일'];

    // 강사뷰용 뷰 설정 상태
    const [teacherViewSize, setTeacherViewSize] = useState<ViewSize>('medium');
    const [teacherVisibleWeekdays, setTeacherVisibleWeekdays] = useState<Set<string>>(new Set(EN_WEEKDAYS_LOCAL));
    const [isTeacherViewSettingsOpen, setIsTeacherViewSettingsOpen] = useState(false);
    const [isTeacherExportModalOpen, setIsTeacherExportModalOpen] = useState(false);

    // 강의실뷰용 뷰 설정 상태
    const [roomViewSize, setRoomViewSize] = useState<ViewSize>('medium');
    const [roomVisibleWeekdays, setRoomVisibleWeekdays] = useState<Set<string>>(new Set(EN_WEEKDAYS_LOCAL));
    const [isRoomViewSettingsOpen, setIsRoomViewSettingsOpen] = useState(false);
    const [roomFilter, setRoomFilter] = useState<string>('all');  // 강의실 필터

    // 강의실 목록 추출 (scheduleData에서)
    const roomList = useMemo(() => {
        const roomSet = new Set<string>();
        Object.values(scheduleData).forEach(cell => {
            if (cell.room) roomSet.add(cell.room);
        });
        return Array.from(roomSet).sort((a, b) => a.localeCompare(b, 'ko'));
    }, [scheduleData]);

    // 통합뷰용 이미지 저장 모달 상태
    const [isClassExportModalOpen, setIsClassExportModalOpen] = useState(false);

    // SimulationContext 사용
    const simulation = useSimulation();
    const { isScenarioMode: isSimulationMode, currentScenarioName, enterScenarioMode: enterSimulationMode, exitScenarioMode: exitSimulationMode, loadFromLive, publishToLive, setCurrentScenarioName, canUndo, canRedo, undo, redo, history, historyIndex, getHistoryDescription } = simulation;

    // 학생 통계
    const studentStats = useEnglishStats(scheduleData, isSimulationMode, studentMap);

    // 영어 시간표 설정 (표시 옵션 포함)
    const { settings, updateSettings } = useEnglishSettings();

    // Ctrl+Z / Ctrl+Y 키보드 단축키 (시뮬레이션 모드에서만)
    useEffect(() => {
        if (!isSimulationMode) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // input, textarea, select 등 입력 필드에서는 동작 안함
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo) {
                    undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                if (canRedo) {
                    redo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSimulationMode, canUndo, canRedo, undo, redo]);

    // 보기 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        if (!isDisplayOptionsOpen) return;
        const handleClickOutside = () => setIsDisplayOptionsOpen(false);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isDisplayOptionsOpen]);

    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditEnglish = hasPermission('timetable.english.edit') || isMaster;
    const canViewEnglish = hasPermission('timetable.english.view') || canEditEnglish;
    const canSimulation = hasPermission('timetable.english.simulation') || isMaster;
    const canViewBackup = hasPermission('timetable.english.backup.view') || isMaster;

    // Fetch classes data for mainTeacher (담임) information
    const { data: classesData } = useClasses('english');

    // Performance: js-index-maps - O(1) 교사 조회를 위한 Map 생성
    const teacherMap = useMemo(() => {
        const map = new Map<string, Teacher>();
        propsTeachers.forEach(t => {
            if (t.name) map.set(t.name, t);
            if (t.englishName) map.set(t.englishName, t);
        });
        return map;
    }, [propsTeachers]);

    // 강사 이름을 영어 이름으로 변환하는 헬퍼 (한글 이름 → 영어 이름)
    // scheduleData 키 생성 시 teachers 배열과 일치시키기 위해 사용
    const normalizeTeacherName = useCallback((teacherName: string): string => {
        if (!teacherName) return teacherName;
        // Performance: O(n) find → O(1) Map.get
        const matched = teacherMap.get(teacherName);
        // 매칭된 강사의 englishName이 있으면 사용, 없으면 원본 유지
        if (matched?.englishName) {
            return matched.englishName;
        }
        return teacherName;
    }, [teacherMap]);

    // 시뮬레이션 모드: draftClasses에서 시간표 데이터 생성
    useEffect(() => {
        if (!isSimulationMode) return;

        // scenarioClasses를 scheduleData 형식으로 변환
        const scheduleData: ScheduleData = {};

        // 합반 순서 일관성을 위해 className 순으로 정렬
        Object.entries(simulation.scenarioClasses)
            .sort(([, a], [, b]) => (a.className || '').localeCompare(b.className || '', 'ko'))
            .forEach(([classId, cls]) => {
            if (!cls.schedule || !Array.isArray(cls.schedule)) return;

            cls.schedule.forEach((slot: { day: string; periodId: string; room?: string }) => {
                const slotKey = `${slot.day}-${slot.periodId}`;
                // 부담임이 있으면 그대로 사용, 없으면 담임 → 영어 이름으로 정규화
                const rawTeacher = cls.slotTeachers?.[slotKey] || cls.teacher;
                const slotTeacher = normalizeTeacherName(rawTeacher);
                const slotRoom = cls.slotRooms?.[slotKey] || cls.room || slot.room || '';

                const key = `${slotTeacher}-${slot.periodId}-${slot.day}`;

                // 같은 키에 이미 수업이 있으면 merged로 추가 (합반 처리)
                if (scheduleData[key]) {
                    const existing = scheduleData[key];
                    // 같은 수업명이면 중복이므로 스킵 (데이터 중복 방지)
                    if (existing.className === cls.className) {
                        return;
                    }
                    // merged에 이미 같은 수업명이 있으면 스킵
                    if (existing.merged?.some(m => m.className === cls.className)) {
                        return;
                    }
                    if (!existing.merged) {
                        existing.merged = [];
                    }
                    existing.merged.push({
                        className: cls.className,
                        classId,
                        room: slotRoom,
                        underline: cls.slotUnderlines?.[slotKey] ?? cls.underline ?? false
                    });
                } else {
                    scheduleData[key] = {
                        className: cls.className,
                        classId,
                        room: slotRoom,
                        teacher: slotTeacher,
                        underline: cls.slotUnderlines?.[slotKey] ?? cls.underline ?? false,
                        merged: []
                    };
                }
            });
        });

        setScheduleData(scheduleData);
        setLoading(false);
    }, [isSimulationMode, simulation.scenarioClasses, normalizeTeacherName]);

    // Data loading (일반 모드) - classes 컬렉션에서 영어 수업 로드
    useEffect(() => {
        // 시뮬레이션 모드에서는 위의 useEffect에서 처리
        if (isSimulationMode) return;

        const unsubscribe = onSnapshot(
            collection(db, 'classes'),
            (snapshot) => {
                const scheduleData: ScheduleData = {};

                // 합반 순서 일관성을 위해 className 순으로 정렬
                const sortedDocs = [...snapshot.docs].sort((a, b) => {
                    const aData = a.data();
                    const bData = b.data();
                    return (aData.className || '').localeCompare(bData.className || '', 'ko');
                });

                sortedDocs.forEach((docSnap) => {
                    const cls = docSnap.data();

                    // 영어 수업만 처리, 비활성 수업 제외
                    if (cls.subject !== 'english' || cls.isActive === false) return;

                    // schedule 배열을 순회하여 scheduleData 생성
                    if (!cls.schedule || !Array.isArray(cls.schedule)) return;

                    cls.schedule.forEach((slot: any) => {
                        const slotKey = `${slot.day}-${slot.periodId}`;
                        // 부담임이 있으면 그대로 사용 (LAB 포함), 없으면 담임
                        const rawTeacher = cls.slotTeachers?.[slotKey] || cls.teacher;
                        // 영어 이름으로 정규화 (강사뷰 teachers 배열과 일치시키기 위해)
                        const slotTeacher = normalizeTeacherName(rawTeacher);
                        const slotRoom = cls.slotRooms?.[slotKey] || cls.room || slot.room || '';

                        const key = `${slotTeacher}-${slot.periodId}-${slot.day}`;

                        // 같은 키에 이미 수업이 있으면 merged로 추가 (합반 처리)
                        if (scheduleData[key]) {
                            const existing = scheduleData[key];
                            // 같은 수업명이면 중복이므로 스킵 (데이터 중복 방지)
                            if (existing.className === cls.className) {
                                return;
                            }
                            // merged에 이미 같은 수업명이 있으면 스킵
                            if (existing.merged?.some(m => m.className === cls.className)) {
                                return;
                            }
                            if (!existing.merged) {
                                existing.merged = [];
                            }
                            existing.merged.push({
                                className: cls.className,
                                classId: docSnap.id,
                                room: slotRoom,
                                underline: cls.slotUnderlines?.[slotKey] ?? cls.underline ?? false
                            });
                        } else {
                            scheduleData[key] = {
                                className: cls.className,
                                classId: docSnap.id,
                                room: slotRoom,
                                teacher: slotTeacher,
                                underline: cls.slotUnderlines?.[slotKey] ?? cls.underline ?? false,
                                merged: []
                            };
                        }
                    });
                });

                setScheduleData(scheduleData);
                setLoading(false);
            },
            (error) => {
                console.error('classes 컬렉션 로딩 실패:', error);
                setLoading(false);
            }
        );
        return listenerRegistry.register('EnglishTimetable', unsubscribe);
    }, [isSimulationMode, normalizeTeacherName]);

    // Manual refresh is no longer strictly needed for data, but can trigger re-sync if needed.
    // We'll keep it as a simple re-fetch of teachers or just no-op for schedule.
    const handleRefresh = useCallback(() => {
        // Optional: Force re-fetch logic if needed, but snapshot handles it.
        // We can just log or show a toast.
    }, []);

    // Filter teachers for English from props and set local state
    useEffect(() => {
        const filtered = propsTeachers.filter(t =>
            (!t.subjects || t.subjects.includes('english'))
        );

        // 통합뷰(class, room)에서는 isHidden 강사를 제외
        // 강사뷰(teacher)에서는 모든 강사 포함 (LAB 등도 표시)
        const visibleForView = viewType === 'teacher'
            ? filtered
            : filtered.filter(t => !t.isHidden);

        // teachersData는 항상 모든 강사 포함 (useEnglishClasses에서 isHidden 체크용)
        setTeachersData(filtered);

        // teachers는 현재 뷰에 맞게 필터링
        // 영어 이름이 있으면 영어 이름 사용, 없으면 한국 이름 사용
        setTeachers(visibleForView.map(t => {
            if (t.englishName) {
                return t.englishName;
            }
            return t.name;
        }).filter(Boolean));
    }, [propsTeachers, viewType]);

    // Subscribe to Order Config and Published Scenario Name
    useEffect(() => {
        const unsubscribeOrder = onSnapshot(doc(db, 'settings', 'english_config'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const order = data.teacherOrder || [];
                setTeacherOrder(order);
                // localStorage 캐시 업데이트 (다음 접속 시 즉시 로드)
                storage.setJSON(STORAGE_KEYS.ENGLISH_TEACHER_ORDER_CACHE, order);
                // 발행된 시나리오 이름 저장
                setPublishedScenarioName(data.publishedScenarioName || null);
            }
        });
        return listenerRegistry.register('EnglishTimetable(config)', unsubscribeOrder);
    }, []);

    // Subscribe to Room Settings (labRooms)
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'settings', 'roomSettings'), (docSnap) => {
            if (docSnap.exists()) {
                setLabRooms(docSnap.data().labRooms || []);
            }
        });
        return listenerRegistry.register('EnglishTimetable(roomSettings)', unsubscribe);
    }, []);

    // Derived sorted teachers
    const sortedTeachers = React.useMemo(() => {
        if (!teachers) return [];
        if (teacherOrder.length === 0) return teachers;

        const sorted = [...teachers].sort((a, b) => {
            const indexA = teacherOrder.indexOf(a);
            const indexB = teacherOrder.indexOf(b);

            // If both are in the order list, sort by index
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // If only A is in list, A comes first
            if (indexA !== -1) return -1;
            // If only B is in list, B comes first
            if (indexB !== -1) return 1;
            // If neither, alphabetical
            return a.localeCompare(b, 'ko');
        });
        return sorted;
    }, [teachers, teacherOrder]);

    const handleSaveOrder = async (newOrder: string[]) => {
        try {
            await setDoc(doc(db, 'settings', 'english_config'), { teacherOrder: newOrder }, { merge: true });
        } catch (error) {
            console.error('순서 저장 실패:', error);
            alert('순서 저장에 실패했습니다.');
        }
    };



    const handleLocalUpdate = (newData: ScheduleData) => {
        setScheduleData(newData);
    };

    // --- Simulation Actions (새 구조: Context 기반) ---

    const handleToggleSimulationMode = useCallback(async () => {
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
    }, [isSimulationMode, enterSimulationMode, exitSimulationMode]);

    const handleCopyLiveToDraft = useCallback(async () => {
        if (!confirm('현재 실시간 시간표를 복사해 오시겠습니까?\n기존 시뮬레이션 작업 내용은 모두 사라집니다.')) return;
        setLoading(true);

        try {
            await loadFromLive();
            alert('현재 시간표를 성공적으로 가져왔습니다.');
        } catch (e) {
            console.error('Copy failed:', e);
            const errorMsg = e instanceof Error ? e.message : '알 수 없는 오류';
            alert(`복사 중 오류가 발생했습니다.\n\n${errorMsg}`);
        } finally {
            setLoading(false);
        }
    }, [loadFromLive]);

    const handlePublishDraftToLive = useCallback(async () => {
        setLoading(true);
        try {
            await publishToLive(
                currentUser?.uid || '',
                currentUser?.displayName || currentUser?.email || 'Unknown'
            );
        } catch (e) {
            console.error('Publish failed:', e);
            const errorMessage = e instanceof Error ? e.message : '반영 중 오류가 발생했습니다.';
            alert(`⚠️ 오류 발생\n\n${errorMessage}\n\n데이터가 변경되지 않았습니다.`);
        } finally {
            setLoading(false);
        }
    }, [publishToLive, currentUser]);

    const handleSimulationLevelUp = useCallback((oldName: string, newName: string): boolean => {
        return simulation.renameScenarioClass(oldName, newName);
    }, [simulation]);

    return (
        <div className="bg-white shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
            {/* 통합뷰: 수학 시간표와 동일한 1행 헤더 */}
            {viewType === 'class' && (
                <div className={`bg-gray-50 h-10 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0 text-xs relative transition-colors duration-300 ${isSimulationMode ? 'bg-orange-50 border-orange-200' : ''}`}>
                    {/* Left: 주차 네비게이션 + 학생 통계 */}
                    <div className="flex items-center gap-3">
                        {weekLabel && goToPrevWeek && goToNextWeek && goToThisWeek && (
                            <>
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
                            </>
                        )}
                        {/* 학생 통계 배지 (통일: 재원/신입/예정/퇴원) */}
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                            {/* 재원 */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-sm">
                                <span className="text-xxs text-green-700 font-medium">재원</span>
                                <span className="text-xs font-bold text-green-800">{studentStats.active}</span>
                            </div>
                            {/* 신입 (30일 이내) */}
                            {studentStats.new1 > 0 && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-pink-50 border border-pink-200 rounded-sm">
                                    <span className="text-xxs text-pink-700 font-medium">신입</span>
                                    <span className="text-xs font-bold text-pink-800">{studentStats.new1}</span>
                                </div>
                            )}
                            {/* 예정 (대기 + 퇴원예정) */}
                            {(studentStats.waiting > 0 || studentStats.withdrawnFuture > 0) && (
                                <PortalTooltip
                                    content={
                                        <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg space-y-2">
                                            {studentStats.waitingStudents.length > 0 && (
                                                <div>
                                                    <div className="font-bold text-amber-300 mb-1">대기 ({studentStats.waiting}명)</div>
                                                    {studentStats.waitingStudents.map(s => (
                                                        <div key={s.id} className="whitespace-nowrap">
                                                            {s.name}/{formatSchoolGrade(s.school, s.grade) || '미입력'}
                                                            {s.enrollmentDate && ` (예정: ${s.enrollmentDate})`}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {studentStats.withdrawnFutureStudents.length > 0 && (
                                                <div>
                                                    <div className="font-bold text-red-300 mb-1">퇴원예정 ({studentStats.withdrawnFuture}명)</div>
                                                    {studentStats.withdrawnFutureStudents.map(s => (
                                                        <div key={s.id} className="whitespace-nowrap">
                                                            {s.name}/{formatSchoolGrade(s.school, s.grade) || '미입력'}
                                                            {s.withdrawalDate && ` (퇴원: ${s.withdrawalDate})`}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    }
                                >
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-sm cursor-pointer">
                                        <span className="text-xxs text-amber-700 font-medium">예정</span>
                                        <span className="text-xs font-bold text-amber-800">{studentStats.waiting + studentStats.withdrawnFuture}</span>
                                    </div>
                                </PortalTooltip>
                            )}
                            {/* 퇴원 */}
                            {studentStats.withdrawn > 0 && (
                                <PortalTooltip
                                    content={
                                        <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg space-y-1">
                                            {studentStats.withdrawnStudents.map(s => (
                                                <div key={s.id} className="whitespace-nowrap">
                                                    {s.name}/{formatSchoolGrade(s.school, s.grade) || '미입력'}
                                                    {s.withdrawalDate && ` (퇴원: ${s.withdrawalDate})`}
                                                </div>
                                            ))}
                                        </div>
                                    }
                                >
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-300 rounded-sm cursor-pointer">
                                        <span className="text-xxs text-gray-700 font-medium">퇴원</span>
                                        <span className="text-xs font-bold text-gray-800">{studentStats.withdrawn}</span>
                                    </div>
                                </PortalTooltip>
                            )}
                        </div>
                    </div>

                    {/* Center: 시간표 제목 */}
                    <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <span>
                            {isSimulationMode && currentScenarioName
                                ? currentScenarioName
                                : (publishedScenarioName || '인재원 영어 통합 시간표')
                            }
                        </span>
                        {isSimulationMode && <span className="text-xxs bg-orange-500 text-white px-1.5 py-0.5 rounded-sm font-bold animate-pulse">SIMULATION</span>}
                    </h1>

                    {/* Right: 모드 토글, 검색, 설정 */}
                    <div className="flex items-center gap-2">
                        {/* 시뮬레이션 모드 토글 */}
                        {canSimulation && (
                            <>
                                <div
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border cursor-pointer transition-all ${isSimulationMode ? 'bg-orange-50 border-orange-300 hover:bg-orange-100' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                                    onClick={handleToggleSimulationMode}
                                >
                                    <ArrowRightLeft size={14} className={isSimulationMode ? 'text-orange-600' : 'text-gray-500'} />
                                    <span className={`text-xs font-bold ${isSimulationMode ? 'text-orange-700' : 'text-gray-600'}`}>
                                        {isSimulationMode ? '시뮬레이션 모드' : '실시간 모드'}
                                    </span>
                                </div>
                                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            </>
                        )}

                        {/* 모드 토글 - 조회/수정 */}
                        <div className="flex bg-gray-200 rounded-sm p-0.5">
                            <button
                                onClick={() => setMode('view')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'view' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                <Eye size={12} />
                                조회
                            </button>
                            {canEditEnglish && (
                                <button
                                    onClick={() => setMode('edit')}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    <Edit size={12} />
                                    수정
                                </button>
                            )}
                        </div>

                        <div className="w-px h-4 bg-gray-300 mx-1"></div>

                        {/* 검색 */}
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="수업명 검색..."
                                className="pl-7 pr-6 py-1 w-32 text-xs border border-gray-300 rounded-sm bg-white text-gray-700 placeholder-gray-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                            />
                        </div>

                        <div className="w-px h-4 bg-gray-300 mx-1"></div>

                        {/* 이미지 저장 (수학 통합뷰와 동일 위치) */}
                        <button
                            onClick={() => setIsClassExportModalOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-50 text-xs font-bold"
                            title="시간표 이미지 저장"
                        >
                            <Download size={12} />
                            저장
                        </button>

                        {/* 보기 드롭다운 (표시 옵션) */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsDisplayOptionsOpen(!isDisplayOptionsOpen); }}
                                className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
                                title="표시 옵션"
                            >
                                <SlidersHorizontal size={12} />
                                보기
                            </button>

                            {isDisplayOptionsOpen && (
                                <div
                                    className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-sm border border-gray-200 z-20 py-2 min-w-[140px]"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.displayOptions?.showStudents ?? true}
                                            onChange={(e) => updateSettings({
                                                ...settings,
                                                displayOptions: {
                                                    ...settings.displayOptions!,
                                                    showStudents: e.target.checked
                                                }
                                            })}
                                            className="rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                                                displayOptions: {
                                                    ...settings.displayOptions!,
                                                    showRoom: e.target.checked
                                                }
                                            })}
                                            className="rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                                                displayOptions: {
                                                    ...settings.displayOptions!,
                                                    showTeacher: e.target.checked
                                                }
                                            })}
                                            className="rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                                                displayOptions: {
                                                    ...settings.displayOptions!,
                                                    showSchedule: e.target.checked
                                                }
                                            })}
                                            className="rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <CalendarDays size={14} className="text-gray-500" />
                                        <span className="text-xs text-gray-700">스케줄</span>
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 강사뷰: 통합뷰와 동일한 1행 헤더 */}
            {viewType === 'teacher' && (
                <div className={`bg-gray-50 h-10 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0 text-xs relative transition-colors duration-300 ${isSimulationMode ? 'bg-orange-50 border-orange-200' : ''}`}>
                    {/* Left: 주차 네비게이션 + 학생 통계 */}
                    <div className="flex items-center gap-3">
                        {weekLabel && goToPrevWeek && goToNextWeek && goToThisWeek && (
                            <>
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
                            </>
                        )}
                        {/* 학생 통계 배지 (통일: 재원/신입/예정/퇴원) */}
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                            {/* 재원 */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-sm">
                                <span className="text-xxs text-green-700 font-medium">재원</span>
                                <span className="text-xs font-bold text-green-800">{studentStats.active}</span>
                            </div>
                            {/* 신입 (30일 이내) */}
                            {studentStats.new1 > 0 && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-pink-50 border border-pink-200 rounded-sm">
                                    <span className="text-xxs text-pink-700 font-medium">신입</span>
                                    <span className="text-xs font-bold text-pink-800">{studentStats.new1}</span>
                                </div>
                            )}
                            {/* 예정 (대기 + 퇴원예정) */}
                            {(studentStats.waiting > 0 || studentStats.withdrawnFuture > 0) && (
                                <PortalTooltip
                                    content={
                                        <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg space-y-2">
                                            {studentStats.waitingStudents.length > 0 && (
                                                <div>
                                                    <div className="font-bold text-amber-300 mb-1">대기 ({studentStats.waiting}명)</div>
                                                    {studentStats.waitingStudents.map(s => (
                                                        <div key={s.id} className="whitespace-nowrap">
                                                            {s.name}/{formatSchoolGrade(s.school, s.grade) || '미입력'}
                                                            {s.enrollmentDate && ` (예정: ${s.enrollmentDate})`}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {studentStats.withdrawnFutureStudents.length > 0 && (
                                                <div>
                                                    <div className="font-bold text-red-300 mb-1">퇴원예정 ({studentStats.withdrawnFuture}명)</div>
                                                    {studentStats.withdrawnFutureStudents.map(s => (
                                                        <div key={s.id} className="whitespace-nowrap">
                                                            {s.name}/{formatSchoolGrade(s.school, s.grade) || '미입력'}
                                                            {s.withdrawalDate && ` (퇴원: ${s.withdrawalDate})`}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    }
                                >
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-sm cursor-pointer">
                                        <span className="text-xxs text-amber-700 font-medium">예정</span>
                                        <span className="text-xs font-bold text-amber-800">{studentStats.waiting + studentStats.withdrawnFuture}</span>
                                    </div>
                                </PortalTooltip>
                            )}
                            {/* 퇴원 */}
                            {studentStats.withdrawn > 0 && (
                                <PortalTooltip
                                    content={
                                        <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg space-y-1">
                                            {studentStats.withdrawnStudents.map(s => (
                                                <div key={s.id} className="whitespace-nowrap">
                                                    {s.name}/{formatSchoolGrade(s.school, s.grade) || '미입력'}
                                                    {s.withdrawalDate && ` (퇴원: ${s.withdrawalDate})`}
                                                </div>
                                            ))}
                                        </div>
                                    }
                                >
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-300 rounded-sm cursor-pointer">
                                        <span className="text-xxs text-gray-700 font-medium">퇴원</span>
                                        <span className="text-xs font-bold text-gray-800">{studentStats.withdrawn}</span>
                                    </div>
                                </PortalTooltip>
                            )}
                        </div>
                    </div>

                    {/* Center: 시간표 제목 */}
                    <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <span>
                            {isSimulationMode && currentScenarioName
                                ? currentScenarioName
                                : (publishedScenarioName || '인재원 영어 강사 시간표')
                            }
                        </span>
                        {isSimulationMode && <span className="text-xxs bg-orange-500 text-white px-1.5 py-0.5 rounded-sm font-bold animate-pulse">SIMULATION</span>}
                    </h1>

                    {/* Right: 시뮬레이션, 모드, 검색 */}
                    <div className="flex items-center gap-2">
                        {/* 시뮬레이션 모드 토글 */}
                        {canSimulation && (
                            <>
                                <div
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border cursor-pointer transition-all ${isSimulationMode ? 'bg-orange-50 border-orange-300 hover:bg-orange-100' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                                    onClick={handleToggleSimulationMode}
                                >
                                    <ArrowRightLeft size={14} className={isSimulationMode ? 'text-orange-600' : 'text-gray-500'} />
                                    <span className={`text-xs font-bold ${isSimulationMode ? 'text-orange-700' : 'text-gray-600'}`}>
                                        {isSimulationMode ? '시뮬레이션 모드' : '실시간 모드'}
                                    </span>
                                </div>
                                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            </>
                        )}

                        {/* 모드 토글 - 조회/수정 */}
                        <div className="flex bg-gray-200 rounded-sm p-0.5">
                            <button
                                onClick={() => setMode('view')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'view' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                <Eye size={12} />
                                조회
                            </button>
                            {canEditEnglish && (
                                <button
                                    onClick={() => setMode('edit')}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    <Edit size={12} />
                                    수정
                                </button>
                            )}
                        </div>

                        <div className="w-px h-4 bg-gray-300 mx-1"></div>

                        {/* 이미지 저장 */}
                        {canViewEnglish && (
                            <button
                                onClick={() => setIsTeacherExportModalOpen(true)}
                                className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-50 text-xs font-bold"
                                title="시간표 이미지 저장"
                            >
                                <Download size={12} />
                                저장
                            </button>
                        )}

                        {/* 보기 설정 */}
                        <button
                            onClick={() => setIsTeacherViewSettingsOpen(true)}
                            className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
                            title="보기 설정"
                        >
                            <SlidersHorizontal size={12} />
                            보기
                        </button>
                    </div>
                </div>
            )}

            {/* 강사뷰 시뮬레이션 액션 바 - 별도 행 */}
            {viewType === 'teacher' && isSimulationMode && canSimulation && (
                <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-orange-50 border-b border-orange-200 flex-shrink-0">
                    <button
                        onClick={handleCopyLiveToDraft}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-sm text-xs font-bold hover:bg-orange-50 shadow-sm transition-colors"
                        title="현재 실시간 시간표를 복사해옵니다"
                    >
                        <Copy size={12} />
                        현재 상태 가져오기
                    </button>
                    {canEditEnglish && (
                        <button
                            onClick={handlePublishDraftToLive}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-sm text-xs font-bold hover:bg-orange-700 shadow-sm transition-colors"
                            title="시뮬레이션 내용을 실제 시간표에 적용합니다"
                        >
                            <Upload size={12} />
                            실제 반영
                        </button>
                    )}
                    <button
                        onClick={() => setIsScenarioModalOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 border border-purple-300 text-purple-700 rounded-sm text-xs font-bold hover:bg-purple-200 shadow-sm transition-colors"
                        title="시나리오 저장/불러오기"
                    >
                        <Save size={12} />
                        시나리오 관리
                    </button>
                </div>
            )}

            {/* 강의실뷰: 통합뷰/강사뷰와 동일한 1행 헤더 */}
            {viewType === 'room' && (
                <div className={`bg-gray-50 h-10 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0 text-xs relative transition-colors duration-300 ${isSimulationMode ? 'bg-orange-50 border-orange-200' : ''}`}>
                    {/* Left: 주차 네비게이션 + 학생 통계 */}
                    <div className="flex items-center gap-3">
                        {weekLabel && goToPrevWeek && goToNextWeek && goToThisWeek && (
                            <>
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
                            </>
                        )}
                        {/* 학생 통계 배지 (통일: 재원/신입/예정/퇴원) */}
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                            {/* 재원 */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-sm">
                                <span className="text-xxs text-green-700 font-medium">재원</span>
                                <span className="text-xs font-bold text-green-800">{studentStats.active}</span>
                            </div>
                            {/* 신입 (30일 이내) */}
                            {studentStats.new1 > 0 && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-pink-50 border border-pink-200 rounded-sm">
                                    <span className="text-xxs text-pink-700 font-medium">신입</span>
                                    <span className="text-xs font-bold text-pink-800">{studentStats.new1}</span>
                                </div>
                            )}
                            {/* 예정 (대기 + 퇴원예정) */}
                            {(studentStats.waiting > 0 || studentStats.withdrawnFuture > 0) && (
                                <PortalTooltip
                                    content={
                                        <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg space-y-2">
                                            {studentStats.waitingStudents.length > 0 && (
                                                <div>
                                                    <div className="font-bold text-amber-300 mb-1">대기 ({studentStats.waiting}명)</div>
                                                    {studentStats.waitingStudents.map(s => (
                                                        <div key={s.id} className="whitespace-nowrap">
                                                            {s.name}/{formatSchoolGrade(s.school, s.grade) || '미입력'}
                                                            {s.enrollmentDate && ` (예정: ${s.enrollmentDate})`}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {studentStats.withdrawnFutureStudents.length > 0 && (
                                                <div>
                                                    <div className="font-bold text-red-300 mb-1">퇴원예정 ({studentStats.withdrawnFuture}명)</div>
                                                    {studentStats.withdrawnFutureStudents.map(s => (
                                                        <div key={s.id} className="whitespace-nowrap">
                                                            {s.name}/{formatSchoolGrade(s.school, s.grade) || '미입력'}
                                                            {s.withdrawalDate && ` (퇴원: ${s.withdrawalDate})`}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    }
                                >
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-sm cursor-pointer">
                                        <span className="text-xxs text-amber-700 font-medium">예정</span>
                                        <span className="text-xs font-bold text-amber-800">{studentStats.waiting + studentStats.withdrawnFuture}</span>
                                    </div>
                                </PortalTooltip>
                            )}
                            {/* 퇴원 */}
                            {studentStats.withdrawn > 0 && (
                                <PortalTooltip
                                    content={
                                        <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg space-y-1">
                                            {studentStats.withdrawnStudents.map(s => (
                                                <div key={s.id} className="whitespace-nowrap">
                                                    {s.name}/{formatSchoolGrade(s.school, s.grade) || '미입력'}
                                                    {s.withdrawalDate && ` (퇴원: ${s.withdrawalDate})`}
                                                </div>
                                            ))}
                                        </div>
                                    }
                                >
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-300 rounded-sm cursor-pointer">
                                        <span className="text-xxs text-gray-700 font-medium">퇴원</span>
                                        <span className="text-xs font-bold text-gray-800">{studentStats.withdrawn}</span>
                                    </div>
                                </PortalTooltip>
                            )}
                        </div>
                    </div>

                    {/* Center: 시간표 제목 */}
                    <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <span>
                            {isSimulationMode && currentScenarioName
                                ? currentScenarioName
                                : (publishedScenarioName || '인재원 영어 강의실 시간표')
                            }
                        </span>
                        {isSimulationMode && <span className="text-xxs bg-orange-500 text-white px-1.5 py-0.5 rounded-sm font-bold animate-pulse">SIMULATION</span>}
                    </h1>

                    {/* Right: 시뮬레이션, 보기 설정 */}
                    <div className="flex items-center gap-2">
                        {/* 시뮬레이션 모드 토글 */}
                        {canSimulation && (
                            <>
                                <div
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border cursor-pointer transition-all ${isSimulationMode ? 'bg-orange-50 border-orange-300 hover:bg-orange-100' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                                    onClick={handleToggleSimulationMode}
                                >
                                    <ArrowRightLeft size={14} className={isSimulationMode ? 'text-orange-600' : 'text-gray-500'} />
                                    <span className={`text-xs font-bold ${isSimulationMode ? 'text-orange-700' : 'text-gray-600'}`}>
                                        {isSimulationMode ? '시뮬레이션 모드' : '실시간 모드'}
                                    </span>
                                </div>
                                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            </>
                        )}
                        {/* 보기 설정 */}
                        <button
                            onClick={() => setIsRoomViewSettingsOpen(true)}
                            className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
                            title="보기 설정"
                        >
                            <SlidersHorizontal size={12} />
                            보기
                        </button>
                        {!isSimulationMode && (
                            <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-100 border border-gray-200 rounded-sm">읽기 전용</span>
                        )}
                    </div>
                </div>
            )}

            {/* 강의실뷰 시뮬레이션 액션 바 - 별도 행 */}
            {viewType === 'room' && isSimulationMode && canSimulation && (
                <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-orange-50 border-b border-orange-200 flex-shrink-0">
                    <button
                        onClick={handleCopyLiveToDraft}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-sm text-xs font-bold hover:bg-orange-50 shadow-sm transition-colors"
                        title="현재 실시간 시간표를 복사해옵니다"
                    >
                        <Copy size={12} />
                        현재 상태 가져오기
                    </button>
                    {canEditEnglish && (
                        <button
                            onClick={handlePublishDraftToLive}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-sm text-xs font-bold hover:bg-orange-700 shadow-sm transition-colors"
                            title="시뮬레이션 내용을 실제 시간표에 적용합니다"
                        >
                            <Upload size={12} />
                            실제 반영
                        </button>
                    )}
                    <button
                        onClick={() => setIsScenarioModalOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 border border-purple-300 text-purple-700 rounded-sm text-xs font-bold hover:bg-purple-200 shadow-sm transition-colors"
                        title="시나리오 저장/불러오기"
                    >
                        <Save size={12} />
                        시나리오 관리
                    </button>
                </div>
            )}

            {/* 히스토리 패널 */}
            {isSimulationMode && isHistoryOpen && history.length > 0 && (
                <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3 max-h-[200px] overflow-y-auto shrink-0">
                    <div className="text-xs font-bold text-indigo-700 mb-2">
                        변경 히스토리 (최근 {history.length}개)
                    </div>
                    <div className="space-y-1">
                        {[...history].reverse().map((entry, idx) => {
                            const originalIndex = history.length - 1 - idx;
                            const isCurrent = originalIndex === historyIndex;
                            const isPast = originalIndex <= historyIndex;
                            const time = new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                            // 바로가기 함수: 대상 수업으로 스크롤
                            const handleJumpTo = () => {
                                if (!entry.targetClass) return;
                                // 수업 카드 또는 테이블 셀을 찾아 스크롤
                                const targetElement = document.querySelector(`[data-class-name="${entry.targetClass}"]`);
                                if (targetElement) {
                                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    // 하이라이트 효과
                                    targetElement.classList.add('ring-4', 'ring-orange-400', 'ring-offset-2');
                                    setTimeout(() => {
                                        targetElement.classList.remove('ring-4', 'ring-orange-400', 'ring-offset-2');
                                    }, 2000);
                                } else {
                                    alert(`'${entry.targetClass}' 수업을 찾을 수 없습니다.\n(다른 그룹에 있거나 숨겨진 수업일 수 있습니다)`);
                                }
                            };

                            return (
                                <div
                                    key={entry.id}
                                    className={`flex items-center gap-2 px-2 py-1 rounded-sm text-xs ${
                                        isCurrent
                                            ? 'bg-indigo-200 text-indigo-900 font-bold'
                                            : isPast
                                                ? 'bg-white text-gray-700'
                                                : 'bg-gray-100 text-gray-400'
                                    }`}
                                >
                                    <span className="text-gray-500 w-16 shrink-0">{time}</span>
                                    <span className={`flex-1 ${isCurrent ? 'text-indigo-800' : ''}`}>{entry.action}</span>
                                    {entry.targetClass && (
                                        <button
                                            onClick={handleJumpTo}
                                            className="p-1 text-indigo-500 hover:bg-indigo-100 rounded-sm transition-colors"
                                            title={`'${entry.targetClass}' 수업으로 이동`}
                                        >
                                            <Focus size={14} />
                                        </button>
                                    )}
                                    {isCurrent && <span className="text-indigo-600">← 현재</span>}
                                </div>
                            );
                        })}
                    </div>
                    {history.length === 0 && (
                        <div className="text-gray-400 text-xs text-center py-2">
                            아직 변경 사항이 없습니다
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {loading && Object.keys(scheduleData).length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        데이터 로딩 중...
                    </div>
                ) : (
                    <>
                        {viewType === 'teacher' && (
                            <>
                                <EnglishTeacherTab
                                    teachers={sortedTeachers}
                                    teachersData={teachersData}
                                    scheduleData={scheduleData}
                                    onRefresh={handleRefresh}
                                    onUpdateLocal={handleLocalUpdate}
                                    classKeywords={classKeywords}
                                    currentUser={currentUser}
                                    targetCollection={isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION}
                                    isSimulationMode={isSimulationMode}
                                    labRooms={labRooms}
                                    studentMap={studentMap}
                                    currentWeekStart={currentWeekStart}
                                    headerMode={mode}
                                    viewSize={teacherViewSize}
                                    setViewSize={setTeacherViewSize}
                                    visibleWeekdays={teacherVisibleWeekdays}
                                    setVisibleWeekdays={setTeacherVisibleWeekdays}
                                    isExportModalOpen={isTeacherExportModalOpen}
                                    setExportModalOpen={setIsTeacherExportModalOpen}
                                />

                                <TeacherOrderModal
                                    isOpen={isOrderModalOpen}
                                    onClose={() => setIsOrderModalOpen(false)}
                                    currentOrder={teacherOrder}
                                    allTeachers={teachers}
                                    onSave={handleSaveOrder}
                                />
                            </>
                        )}
                        {viewType === 'class' && (
                            <EnglishClassTab
                                teachers={teachers}
                                teachersData={teachersData}
                                scheduleData={scheduleData}
                                classKeywords={classKeywords}
                                currentUser={currentUser}
                                isSimulationMode={isSimulationMode}
                                studentMap={studentMap}
                                classesData={classesData}
                                canSimulation={canSimulation}
                                onToggleSimulation={handleToggleSimulationMode}
                                onCopyLiveToDraft={handleCopyLiveToDraft}
                                onPublishToLive={handlePublishDraftToLive}
                                onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
                                canPublish={isMaster || hasPermission('timetable.english.simulation')}
                                onSimulationLevelUp={isSimulationMode ? handleSimulationLevelUp : undefined}
                                currentWeekStart={currentWeekStart}
                                mode={mode}
                                setMode={setMode}
                                searchTerm={searchQuery}
                                setSearchTerm={setSearchQuery}
                                isSettingsOpen={isSettingsOpen}
                                setIsSettingsOpen={setIsSettingsOpen}
                                isLevelSettingsOpen={isLevelSettingsOpen}
                                setIsLevelSettingsOpen={setIsLevelSettingsOpen}
                                isExportModalOpen={isClassExportModalOpen}
                                setIsExportModalOpen={setIsClassExportModalOpen}
                            />
                        )}
                        {viewType === 'room' && (
                            <EnglishRoomTab
                                teachers={teachers}
                                teachersData={teachersData}
                                scheduleData={scheduleData}
                                classKeywords={classKeywords}
                                currentUser={currentUser}
                                labRooms={labRooms}
                                studentMap={studentMap}
                                currentWeekStart={currentWeekStart}
                                viewSize={roomViewSize}
                                visibleWeekdays={roomVisibleWeekdays}
                                filterRoom={roomFilter}
                            />
                        )}
                    </>
                )}
            </div>



            {/* Scenario Management Modal */}
            <ScenarioManagementModal
                isOpen={isScenarioModalOpen}
                onClose={() => setIsScenarioModalOpen(false)}
                currentUser={currentUser}
                isSimulationMode={isSimulationMode}
                onLoadScenario={(name) => setCurrentScenarioName(name)}
            />

            {/* 강사뷰 보기 설정 모달 */}
            {isTeacherViewSettingsOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh]"
                    onClick={() => setIsTeacherViewSettingsOpen(false)}
                >
                    <div
                        className="bg-white rounded-sm shadow-xl w-[360px] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal size={18} className="text-emerald-600" />
                                <h3 className="text-sm font-bold text-gray-800">강사뷰 보기 설정</h3>
                            </div>
                            <button onClick={() => setIsTeacherViewSettingsOpen(false)} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* 셀 크기 설정 */}
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-emerald-700">셀 크기</div>
                                <div className="flex gap-2">
                                    {(['small', 'medium', 'large'] as const).map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setTeacherViewSize(size)}
                                            className={`flex-1 py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                                teacherViewSize === size
                                                    ? 'bg-emerald-500 text-white border-emerald-500'
                                                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                            }`}
                                        >
                                            {size === 'small' ? '작게' : size === 'medium' ? '보통' : '크게'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 요일 표시 설정 */}
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-emerald-700">요일 표시</div>
                                <div className="flex flex-wrap gap-2">
                                    {EN_WEEKDAYS_LOCAL.map(day => (
                                        <label key={day} className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={teacherVisibleWeekdays.has(day)}
                                                onChange={() => {
                                                    const newSet = new Set(teacherVisibleWeekdays);
                                                    if (newSet.has(day)) {
                                                        newSet.delete(day);
                                                    } else {
                                                        newSet.add(day);
                                                    }
                                                    setTeacherVisibleWeekdays(newSet);
                                                }}
                                                className="w-4 h-4 rounded-sm border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                            <span className="text-xs text-gray-700 font-medium">{day}</span>
                                        </label>
                                    ))}
                                </div>
                                {/* 빠른 선택 버튼 */}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => {
                                            const weekdays = ['월', '화', '수', '목', '금'];
                                            const allWeekdaysSelected = weekdays.every(d => teacherVisibleWeekdays.has(d));
                                            const newSet = new Set(teacherVisibleWeekdays);
                                            if (allWeekdaysSelected) {
                                                weekdays.forEach(d => newSet.delete(d));
                                            } else {
                                                weekdays.forEach(d => newSet.add(d));
                                            }
                                            setTeacherVisibleWeekdays(newSet);
                                        }}
                                        className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold transition-all border ${
                                            ['월', '화', '수', '목', '금'].every(d => teacherVisibleWeekdays.has(d))
                                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                        }`}
                                    >
                                        평일 (월~금)
                                    </button>
                                    <button
                                        onClick={() => {
                                            const weekends = ['토', '일'];
                                            const allWeekendsSelected = weekends.every(d => teacherVisibleWeekdays.has(d));
                                            const newSet = new Set(teacherVisibleWeekdays);
                                            if (allWeekendsSelected) {
                                                weekends.forEach(d => newSet.delete(d));
                                            } else {
                                                weekends.forEach(d => newSet.add(d));
                                            }
                                            setTeacherVisibleWeekdays(newSet);
                                        }}
                                        className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold transition-all border ${
                                            ['토', '일'].every(d => teacherVisibleWeekdays.has(d))
                                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                        }`}
                                    >
                                        주말 (토~일)
                                    </button>
                                </div>
                            </div>

                            {/* 강사 순서 설정 - 편집 권한 있을 때만 */}
                            {canEditEnglish && (
                                <div className="space-y-2">
                                    <div className="text-xs font-bold text-emerald-700">강사 관리</div>
                                    <button
                                        onClick={() => {
                                            setIsTeacherViewSettingsOpen(false);
                                            setIsOrderModalOpen(true);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gray-800 text-white rounded-sm hover:bg-gray-700 transition-colors text-xs font-bold"
                                    >
                                        <Settings size={14} />
                                        강사 순서 설정
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setIsTeacherViewSettingsOpen(false)}
                                className="px-3 py-1.5 text-xs rounded-sm border border-gray-300 text-gray-700 bg-white hover:bg-gray-100"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 강의실뷰 보기 설정 모달 */}
            {isRoomViewSettingsOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh]"
                    onClick={() => setIsRoomViewSettingsOpen(false)}
                >
                    <div
                        className="bg-white rounded-sm shadow-xl w-[360px] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal size={18} className="text-emerald-600" />
                                <h3 className="text-sm font-bold text-gray-800">강의실뷰 보기 설정</h3>
                            </div>
                            <button onClick={() => setIsRoomViewSettingsOpen(false)} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* 강의실 필터 */}
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-emerald-700">강의실</div>
                                <select
                                    value={roomFilter}
                                    onChange={(e) => setRoomFilter(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm bg-white text-gray-700 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                >
                                    <option value="all">전체</option>
                                    {roomList.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 셀 크기 설정 */}
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-emerald-700">셀 크기</div>
                                <div className="flex gap-2">
                                    {(['small', 'medium', 'large'] as const).map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setRoomViewSize(size)}
                                            className={`flex-1 py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                                roomViewSize === size
                                                    ? 'bg-emerald-500 text-white border-emerald-500'
                                                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                            }`}
                                        >
                                            {size === 'small' ? '작게' : size === 'medium' ? '보통' : '크게'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 요일 표시 설정 */}
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-emerald-700">요일 표시</div>
                                <div className="flex flex-wrap gap-2">
                                    {EN_WEEKDAYS_LOCAL.map(day => (
                                        <label key={day} className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={roomVisibleWeekdays.has(day)}
                                                onChange={() => {
                                                    const newSet = new Set(roomVisibleWeekdays);
                                                    if (newSet.has(day)) {
                                                        newSet.delete(day);
                                                    } else {
                                                        newSet.add(day);
                                                    }
                                                    setRoomVisibleWeekdays(newSet);
                                                }}
                                                className="w-4 h-4 rounded-sm border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                            <span className="text-xs text-gray-700 font-medium">{day}</span>
                                        </label>
                                    ))}
                                </div>
                                {/* 빠른 선택 버튼 */}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => {
                                            const weekdays = ['월', '화', '수', '목', '금'];
                                            const allWeekdaysSelected = weekdays.every(d => roomVisibleWeekdays.has(d));
                                            const newSet = new Set(roomVisibleWeekdays);
                                            if (allWeekdaysSelected) {
                                                weekdays.forEach(d => newSet.delete(d));
                                            } else {
                                                weekdays.forEach(d => newSet.add(d));
                                            }
                                            setRoomVisibleWeekdays(newSet);
                                        }}
                                        className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold transition-all border ${
                                            ['월', '화', '수', '목', '금'].every(d => roomVisibleWeekdays.has(d))
                                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                        }`}
                                    >
                                        평일 (월~금)
                                    </button>
                                    <button
                                        onClick={() => {
                                            const weekends = ['토', '일'];
                                            const allWeekendsSelected = weekends.every(d => roomVisibleWeekdays.has(d));
                                            const newSet = new Set(roomVisibleWeekdays);
                                            if (allWeekendsSelected) {
                                                weekends.forEach(d => newSet.delete(d));
                                            } else {
                                                weekends.forEach(d => newSet.add(d));
                                            }
                                            setRoomVisibleWeekdays(newSet);
                                        }}
                                        className={`flex-1 py-1.5 px-2 rounded-sm text-xxs font-bold transition-all border ${
                                            ['토', '일'].every(d => roomVisibleWeekdays.has(d))
                                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                        }`}
                                    >
                                        주말 (토~일)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setIsRoomViewSettingsOpen(false)}
                                className="px-3 py-1.5 text-xs rounded-sm border border-gray-300 text-gray-700 bg-white hover:bg-gray-100"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Tab Button Component
interface TabButtonProps {
    id: string;
    label: string;
    active: string;
    onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ id, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-t border-l border-r transition-all relative top-[1px] ${active === id
            ? 'bg-white text-green-700 border-green-300 shadow-sm'
            : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
            }`}
    >
        {label}
    </button>
);

// Wrapper component with SimulationProvider
const EnglishTimetable: React.FC<EnglishTimetableProps> = (props) => {
    return (
        <SimulationProvider>
            <EnglishTimetableInner {...props} />
        </SimulationProvider>
    );
};

export default EnglishTimetable;
