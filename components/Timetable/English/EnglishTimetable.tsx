import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { Clock, RefreshCw } from 'lucide-react';
import { EN_COLLECTION } from './englishUtils';
import { Teacher } from '../../../types';
import EnglishTeacherTab from './EnglishTeacherTab';
import EnglishClassTab from './EnglishClassTab';
import EnglishRoomTab from './EnglishRoomTab';
import TeacherOrderModal from './TeacherOrderModal';

interface EnglishTimetableProps {
    onClose?: () => void;
    onSwitchToMath?: () => void;
    viewType: 'teacher' | 'class' | 'room';
    teachers?: Teacher[];  // Centralized from App.tsx via TimetableManager
}

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

const EnglishTimetable: React.FC<EnglishTimetableProps> = ({ onClose, onSwitchToMath, viewType, teachers: propsTeachers = [] }) => {
    // Removed local activeTab state, using viewType prop
    const [scheduleData, setScheduleData] = useState<ScheduleData>({});
    const [loading, setLoading] = useState(true);
    const [teachers, setTeachers] = useState<string[]>([]);
    const [teachersData, setTeachersData] = useState<Teacher[]>([]);  // 색상 정보 포함
    const [teacherOrder, setTeacherOrder] = useState<string[]>([]);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

    // Optimized: Use Real-time listener instead of manual fetch
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, EN_COLLECTION), (snapshot) => {
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
    }, []);

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

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
            {/* Header Removed - Controlled by Parent */}

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
                            />
                        )}
                        {viewType === 'room' && (
                            <EnglishRoomTab
                                scheduleData={scheduleData}
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
