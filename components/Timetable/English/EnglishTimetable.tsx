import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { Clock, RefreshCw } from 'lucide-react';
import { EN_COLLECTION } from './englishUtils';
import { Teacher } from '../../../types';
import EnglishTeacherTab from './EnglishTeacherTab';
import EnglishClassTab from './EnglishClassTab';
import EnglishRoomTab from './EnglishRoomTab';

interface EnglishTimetableProps {
    onClose?: () => void;
    onSwitchToMath?: () => void;
}

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

const EnglishTimetable: React.FC<EnglishTimetableProps> = ({ onClose, onSwitchToMath }) => {
    const [activeTab, setActiveTab] = useState<'teacher' | 'class' | 'room'>('teacher');
    const [scheduleData, setScheduleData] = useState<ScheduleData>({});
    const [loading, setLoading] = useState(true);
    const [teachers, setTeachers] = useState<string[]>([]);
    const [teachersData, setTeachersData] = useState<Teacher[]>([]);  // 색상 정보 포함

    const fetchScheduleData = useCallback(async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, EN_COLLECTION));
            const mergedData: ScheduleData = {};
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                Object.assign(mergedData, data);
            });
            setScheduleData(mergedData);
        } catch (error) {
            console.error('데이터 로딩 실패:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Subscribe to teachers list
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, '강사목록'), (snapshot) => {
            const teacherList = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            }) as Teacher);
            const filtered = teacherList
                .filter(t => (!t.subjects || t.subjects.includes('english')) && !t.isHidden);
            setTeachersData(filtered);  // 색상 정보 포함 저장
            setTeachers(filtered.map(t => t.name).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        fetchScheduleData();
    }, [fetchScheduleData]);

    const handleLocalUpdate = (newData: ScheduleData) => {
        setScheduleData(newData);
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-3">
                    {/* Title */}
                    <div className="flex items-center gap-2">
                        <Clock size={18} className="text-[#fdb813]" />
                        <span className="font-bold text-[#081429] text-sm">시간표</span>
                    </div>

                    {/* Subject Tabs - 수학 시간표와 동일한 스타일 */}
                    <div className="flex rounded overflow-hidden border border-gray-300">
                        <button
                            onClick={onSwitchToMath}
                            className="px-3 py-1.5 text-xs font-bold transition-all bg-white text-[#373d41] hover:bg-gray-100"
                        >
                            📐 수학
                        </button>
                        <button
                            className="px-3 py-1.5 text-xs font-bold transition-all border-l border-gray-300 bg-[#fdb813] text-[#081429]"
                        >
                            📕 영어
                        </button>
                    </div>

                    {/* View Type - 수학 시간표와 동일한 스타일 */}
                    <select
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value as 'teacher' | 'class' | 'room')}
                        className="px-2 py-1.5 text-xs font-bold border border-gray-300 rounded bg-white text-[#373d41] cursor-pointer outline-none"
                    >
                        <option value="teacher">👨‍🏫 강사별</option>
                        <option value="class">📋 통합</option>
                        <option value="room">🏫 강의실</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchScheduleData}
                        className="p-1.5 text-gray-400 hover:text-[#fdb813] hover:bg-yellow-50 rounded"
                        title="새로고침"
                    >
                        <RefreshCw size={16} />
                    </button>
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
                        {activeTab === 'teacher' && (
                            <EnglishTeacherTab
                                teachers={teachers}
                                teachersData={teachersData}
                                scheduleData={scheduleData}
                                onRefresh={fetchScheduleData}
                                onUpdateLocal={handleLocalUpdate}
                            />
                        )}
                        {activeTab === 'class' && (
                            <EnglishClassTab
                                teachers={teachers}
                                scheduleData={scheduleData}
                            />
                        )}
                        {activeTab === 'room' && (
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
