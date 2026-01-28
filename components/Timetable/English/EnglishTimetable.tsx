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

interface EnglishTimetableProps {
    onClose?: () => void;
    onSwitchToMath?: () => void;
    viewType: 'teacher' | 'class' | 'room';
    teachers?: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
    studentMap: Record<string, any>;
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
const EnglishTimetableInner: React.FC<EnglishTimetableProps> = ({ onClose, onSwitchToMath, viewType, teachers: propsTeachers = [], classKeywords = [], currentUser, studentMap }) => {
    // Removed local activeTab state, using viewType prop
    const [scheduleData, setScheduleData] = useState<ScheduleData>({});
    const [loading, setLoading] = useState(true);
    const [teachers, setTeachers] = useState<string[]>([]);
    const [teachersData, setTeachersData] = useState<Teacher[]>([]);  // 색상 정보 포함
    // localStorage 캐시에서 초기값 로드 (깜빡임 방지)
    const [teacherOrder, setTeacherOrder] = useState<string[]>(() =>
        storage.getJSON<string[]>(STORAGE_KEYS.ENGLISH_TEACHER_ORDER_CACHE, [])
    );
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);

    // SimulationContext 사용
    const simulation = useSimulation();
    const { isScenarioMode: isSimulationMode, currentScenarioName, enterScenarioMode: enterSimulationMode, exitScenarioMode: exitSimulationMode, loadFromLive, publishToLive, setCurrentScenarioName } = simulation;

    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditEnglish = hasPermission('timetable.english.edit') || isMaster;
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

        Object.entries(simulation.scenarioClasses).forEach(([classId, cls]) => {
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
                        underline: cls.underline || false
                    });
                } else {
                    scheduleData[key] = {
                        className: cls.className,
                        classId,
                        room: slotRoom,
                        teacher: slotTeacher,
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

                snapshot.docs.forEach((docSnap) => {
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
                                underline: cls.underline || false
                            });
                        } else {
                            scheduleData[key] = {
                                className: cls.className,
                                classId: docSnap.id,
                                room: slotRoom,
                                teacher: slotTeacher,
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

    // Subscribe to Order Config only
    useEffect(() => {
        const unsubscribeOrder = onSnapshot(doc(db, 'settings', 'english_config'), (docSnap) => {
            if (docSnap.exists()) {
                const order = docSnap.data().teacherOrder || [];
                setTeacherOrder(order);
                // localStorage 캐시 업데이트 (다음 접속 시 즉시 로드)
                storage.setJSON(STORAGE_KEYS.ENGLISH_TEACHER_ORDER_CACHE, order);
            }
        });
        return listenerRegistry.register('EnglishTimetable(config)', unsubscribeOrder);
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

    const handleSimulationLevelUp = useCallback((oldName: string, newName: string) => {
        simulation.renameScenarioClass(oldName, newName);
    }, [simulation]);

    return (
        <div className="bg-white shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
            {/* Header - Row 1: Title only */}
            <div className={`text-center py-3 border-b shrink-0 transition-colors duration-300 ${isSimulationMode ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center justify-center gap-2">
                    <span>인재원 본원 {new Date().getMonth() + 1}월 통합 영어시간표</span>
                    {isSimulationMode && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">SIMULATION</span>}
                </h1>
            </div>

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
                                    onOpenOrderModal={() => setIsOrderModalOpen(true)}
                                    classKeywords={classKeywords}
                                    currentUser={currentUser}
                                    targetCollection={isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION}
                                    isSimulationMode={isSimulationMode}
                                    canSimulation={canSimulation}
                                    onToggleSimulation={handleToggleSimulationMode}
                                    onCopyLiveToDraft={handleCopyLiveToDraft}
                                    onPublishToLive={handlePublishDraftToLive}
                                    onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
                                    canPublish={isMaster || hasPermission('timetable.english.simulation')}
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
                            />
                        )}
                        {viewType === 'room' && (
                            <EnglishRoomTab
                                teachers={teachers}
                                teachersData={teachersData}
                                scheduleData={scheduleData}
                                classKeywords={classKeywords}
                                currentUser={currentUser}
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
