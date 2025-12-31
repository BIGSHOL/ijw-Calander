import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { Clock, RefreshCw, AlertTriangle, Copy, Upload, ArrowRightLeft } from 'lucide-react';
import { EN_COLLECTION, EN_DRAFT_COLLECTION } from './englishUtils';
import { Teacher, ClassKeywordColor } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';
import EnglishTeacherTab from './EnglishTeacherTab';
import EnglishClassTab from './EnglishClassTab';
import EnglishRoomTab from './EnglishRoomTab';
import TeacherOrderModal from './TeacherOrderModal';

interface EnglishTimetableProps {
    onClose?: () => void;
    onSwitchToMath?: () => void;
    viewType: 'teacher' | 'class' | 'room';
    teachers?: Teacher[];  // Centralized from App.tsx via TimetableManager
    classKeywords?: ClassKeywordColor[];  // For keyword color coding
    currentUser: any; // Using any to avoid circular dependency
}

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

const EnglishTimetable: React.FC<EnglishTimetableProps> = ({ onClose, onSwitchToMath, viewType, teachers: propsTeachers = [], classKeywords = [], currentUser }) => {
    // Removed local activeTab state, using viewType prop
    const [scheduleData, setScheduleData] = useState<ScheduleData>({});
    const [loading, setLoading] = useState(true);
    const [teachers, setTeachers] = useState<string[]>([]);
    const [teachersData, setTeachersData] = useState<Teacher[]>([]);  // 색상 정보 포함
    const [teacherOrder, setTeacherOrder] = useState<string[]>([]);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isSimulationMode, setIsSimulationMode] = useState(false);

    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditEnglish = hasPermission('timetable.english.edit') || isMaster;

    // Optimized: Use Real-time listener instead of manual fetch
    useEffect(() => {
        const targetCollection = isSimulationMode ? EN_DRAFT_COLLECTION : EN_COLLECTION;
        const unsubscribe = onSnapshot(collection(db, targetCollection), (snapshot) => {
            const mergedData: ScheduleData = {};
            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                // Handle both FLAT (ijw-calander new) and NESTED (academy-app legacy) formats
                Object.entries(data).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null) {
                        // Check if this is a nested structure (academy-app format: {teacher-period: {day: cell}})
                        // Keys like "Sarah-5" with values like {월: {...}, 화: {...}}
                        const isNested = Object.keys(value).some(k => ['월', '화', '수', '목', '금', '토', '일'].includes(k));
                        if (isNested) {
                            // Flatten nested structure
                            Object.entries(value as Record<string, ScheduleCell>).forEach(([day, cell]) => {
                                const flatKey = `${key}-${day}`;
                                mergedData[flatKey] = cell;
                            });
                        } else {
                            // Already flat format
                            mergedData[key] = value as ScheduleCell;
                        }
                    }
                });
            });
            setScheduleData(mergedData);
            setLoading(false);
        }, (error) => {
            console.error('데이터 로딩 실패:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isSimulationMode]);

    // Manual refresh is no longer strictly needed for data, but can trigger re-sync if needed.
    // We'll keep it as a simple re-fetch of teachers or just no-op for schedule.
    const handleRefresh = useCallback(() => {
        // Optional: Force re-fetch logic if needed, but snapshot handles it.
        // We can just log or show a toast.
    }, []);

    // Filter teachers for English from props and set local state
    useEffect(() => {
        const filtered = propsTeachers.filter(t =>
            (!t.subjects || t.subjects.includes('english')) && !t.isHidden
        );
        setTeachersData(filtered);
        setTeachers(filtered.map(t => t.name).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')));
    }, [propsTeachers]);

    // Subscribe to Order Config only
    useEffect(() => {
        const unsubscribeOrder = onSnapshot(doc(db, 'settings', 'english_config'), (doc) => {
            if (doc.exists()) {
                setTeacherOrder(doc.data().teacherOrder || []);
            }
        });
        return () => unsubscribeOrder();
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

    // --- Simulation Actions ---

    const handleCopyLiveToDraft = async () => {
        if (!confirm('현재 실시간 시간표를 복사해 오시겠습니까?\n기존 시뮬레이션 작업 내용은 모두 사라집니다.')) return;
        setLoading(true);
        try {
            const liveSnapshot = await getDocs(collection(db, EN_COLLECTION));
            const batch = writeBatch(db);

            // Note: Ideally we should delete all draft docs first, but simple overwrite is safer for now.
            // A more robust way would be to delete relevant docs if we want a clean slate.

            liveSnapshot.docs.forEach(docSnap => {
                batch.set(doc(db, EN_DRAFT_COLLECTION, docSnap.id), docSnap.data());
            });

            await batch.commit();
            alert('현재 시간표를 성공적으로 가져왔습니다.');
        } catch (e) {
            console.error(e);
            alert('복사 중 오류가 발생했습니다.');
        }
        setLoading(false);
    };

    const handlePublishDraftToLive = async () => {
        if (!confirm('⚠️ 정말로 실제 시간표에 반영하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 사용자에게 즉시 반영됩니다.')) return;
        setLoading(true);
        try {
            const draftSnapshot = await getDocs(collection(db, EN_DRAFT_COLLECTION));
            const batch = writeBatch(db);

            draftSnapshot.docs.forEach(docSnap => {
                batch.set(doc(db, EN_COLLECTION, docSnap.id), docSnap.data());
            });

            await batch.commit();
            alert('성공적으로 반영되었습니다.');
            setIsSimulationMode(false); // Switch back to live
        } catch (e) {
            console.error(e);
            alert('반영 중 오류가 발생했습니다.');
        }
        setLoading(false);
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className={`text-center py-3 border-b shrink-0 relative transition-colors duration-300 ${isSimulationMode ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center justify-center gap-2">
                    <span>인재원 본원 {new Date().getMonth() + 1}월 통합 영어시간표</span>
                    {isSimulationMode && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">SIMULATION</span>}
                </h1>

                {/* Simulation Control Panel */}
                <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-2">
                    {/* Toggle Switch */}
                    <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${isSimulationMode ? 'bg-orange-100 border-orange-300' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                        onClick={() => setIsSimulationMode(!isSimulationMode)}
                    >
                        <ArrowRightLeft size={14} className={isSimulationMode ? 'text-orange-600' : 'text-gray-500'} />
                        <span className={`text-xs font-bold ${isSimulationMode ? 'text-orange-700' : 'text-gray-600'}`}>
                            {isSimulationMode ? '시뮬레이션 모드' : '실시간 모드'}
                        </span>
                    </div>

                    {isSimulationMode && canEditEnglish && (
                        <>
                            <div className="h-6 w-px bg-orange-300 mx-1"></div>
                            <button
                                onClick={handleCopyLiveToDraft}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-50 shadow-sm transition-colors"
                                title="현재 실시간 시간표를 복사해옵니다 (기존 시뮬레이션 데이터 덮어쓰기)"
                            >
                                <Copy size={12} />
                                현재 상태 가져오기
                            </button>
                            {isMaster && (
                                <button
                                    onClick={handlePublishDraftToLive}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 shadow-sm transition-colors"
                                    title="시뮬레이션 내용을 실제 시간표에 적용합니다 (주의)"
                                >
                                    <Upload size={12} />
                                    실제 반영
                                </button>
                            )}
                        </>
                    )}
                </div>
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
                                    targetCollection={isSimulationMode ? EN_DRAFT_COLLECTION : EN_COLLECTION}
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

export default EnglishTimetable;
