import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClassKeywordColor } from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, collection, onSnapshot, getDoc, getDocs, query, where } from 'firebase/firestore';
import { listenerRegistry } from '../../utils/firebaseCleanup';
import { X, Check, Clock, Hash, DoorOpen, ChevronUp, ChevronDown, FlaskConical, Plus, Settings } from 'lucide-react';

interface ClassSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    canEdit?: boolean;
    embedded?: boolean; // 다른 모달 내부에서 사용될 때 true
}

// 스케줄 표기 방식 타입
type ScheduleDisplayMode = 'period' | 'time';

interface ScheduleDisplaySettings {
    math: ScheduleDisplayMode;
    english: ScheduleDisplayMode;
}

const DEFAULT_SCHEDULE_DISPLAY: ScheduleDisplaySettings = {
    math: 'period',
    english: 'period',
};

type TabType = 'general' | 'room';

const ClassSettingsModal: React.FC<ClassSettingsModalProps> = ({
    isOpen,
    onClose,
    canEdit = true,
    embedded = false
}) => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabType>('general');

    // --- General Tab State ---
    const [classKeywords, setClassKeywords] = useState<ClassKeywordColor[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [newKeywordBgColor, setNewKeywordBgColor] = useState('#fee2e2');
    const [newKeywordTextColor, setNewKeywordTextColor] = useState('#dc2626');

    // 스케줄 표기 설정
    const [scheduleDisplay, setScheduleDisplay] = useState<ScheduleDisplaySettings>(DEFAULT_SCHEDULE_DISPLAY);
    const [scheduleDisplayLoading, setScheduleDisplayLoading] = useState(true);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editKeyword, setEditKeyword] = useState('');
    const [editBgColor, setEditBgColor] = useState('');
    const [editTextColor, setEditTextColor] = useState('');

    // --- Room Tab State ---
    const [availableRooms, setAvailableRooms] = useState<string[]>([]);
    const [labRooms, setLabRooms] = useState<string[]>([]);
    const [roomOrder, setRoomOrder] = useState<string[]>([]);
    const [roomsLoading, setRoomsLoading] = useState(true);

    // Subscribe to classKeywords collection
    useEffect(() => {
        if (!isOpen) return;

        const unsubscribe = onSnapshot(collection(db, 'classKeywords'), (snapshot) => {
            const keywords = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as ClassKeywordColor)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
            setClassKeywords(keywords);
        });
        return listenerRegistry.register('ClassSettingsModal', unsubscribe);
    }, [isOpen]);

    // 스케줄 표기 설정 로드
    useEffect(() => {
        if (!isOpen) return;

        const loadScheduleDisplay = async () => {
            try {
                const docRef = doc(db, 'settings', 'scheduleDisplay');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setScheduleDisplay({ ...DEFAULT_SCHEDULE_DISPLAY, ...docSnap.data() } as ScheduleDisplaySettings);
                }
            } catch (e) {
                console.error('Failed to load schedule display settings:', e);
            } finally {
                setScheduleDisplayLoading(false);
            }
        };
        loadScheduleDisplay();
    }, [isOpen]);

    // 강의실 데이터 로드 (classes 컬렉션에서 영어 수업의 강의실 추출 + roomSettings 구독)
    useEffect(() => {
        if (!isOpen) return;

        // 1. classes 컬렉션에서 영어 수업 강의실 추출
        const loadRooms = async () => {
            try {
                const q = query(collection(db, 'classes'), where('subject', '==', 'english'));
                const snapshot = await getDocs(q);
                const roomSet = new Set<string>();
                snapshot.docs.forEach(d => {
                    const cls = d.data();
                    if (cls.isActive === false) return;
                    // 기본 강의실
                    if (cls.room) roomSet.add(cls.room);
                    // 슬롯별 강의실
                    if (cls.slotRooms) {
                        Object.values(cls.slotRooms).forEach((r: any) => {
                            if (r) roomSet.add(r);
                        });
                    }
                    // schedule 배열의 강의실
                    if (cls.schedule && Array.isArray(cls.schedule)) {
                        cls.schedule.forEach((slot: any) => {
                            if (slot.room) roomSet.add(slot.room);
                        });
                    }
                });
                setAvailableRooms(Array.from(roomSet).sort((a, b) => a.localeCompare(b, 'ko')));
            } catch (e) {
                console.error('Failed to load rooms:', e);
            } finally {
                setRoomsLoading(false);
            }
        };
        loadRooms();

        // 2. roomSettings 구독 (labRooms)
        const unsubscribe = onSnapshot(doc(db, 'settings', 'roomSettings'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLabRooms(data.labRooms || []);
            }
        });

        // 3. localStorage에서 순서 로드
        try {
            const saved = localStorage.getItem('english_room_order');
            if (saved) setRoomOrder(JSON.parse(saved));
        } catch { /* ignore */ }

        return listenerRegistry.register('ClassSettingsModal_roomSettings', unsubscribe);
    }, [isOpen]);

    // 강의실 순서: availableRooms와 roomOrder를 병합
    const orderedRooms = useMemo(() => {
        if (roomOrder.length === 0) return availableRooms;

        const ordered: string[] = [];
        // roomOrder에 있는 것 먼저 (availableRooms에도 존재하는 것만)
        roomOrder.forEach(r => {
            if (availableRooms.includes(r)) ordered.push(r);
        });
        // roomOrder에 없는 나머지 추가
        availableRooms.forEach(r => {
            if (!ordered.includes(r)) ordered.push(r);
        });
        return ordered;
    }, [availableRooms, roomOrder]);

    // 스케줄 표기 설정 저장
    const handleScheduleDisplayChange = async (subject: 'math' | 'english', mode: ScheduleDisplayMode) => {
        const newSettings = { ...scheduleDisplay, [subject]: mode };
        setScheduleDisplay(newSettings);

        try {
            await setDoc(doc(db, 'settings', 'scheduleDisplay'), newSettings);
            // React Query 캐시 무효화 - 즉시 반영
            queryClient.invalidateQueries({ queryKey: ['scheduleDisplaySettings'] });
        } catch (e) {
            console.error('Failed to save schedule display settings:', e);
            alert('설정 저장 실패');
        }
    };

    // --- General Tab Handlers ---
    const handleAddKeyword = async () => {
        if (!newKeyword.trim()) return;
        try {
            const id = `keyword_${Date.now()}`;
            await setDoc(doc(db, 'classKeywords', id), {
                keyword: newKeyword.trim(),
                bgColor: newKeywordBgColor,
                textColor: newKeywordTextColor,
                order: classKeywords.length
            });
            // 캐시 무효화 - 시간표 즉시 반영
            queryClient.invalidateQueries({ queryKey: ['classKeywords'] });
            setNewKeyword('');
            setNewKeywordBgColor('#fee2e2');
            setNewKeywordTextColor('#dc2626');
        } catch (e) {
            console.error(e);
            alert('저장 실패');
        }
    };

    const handleStartEdit = (kw: ClassKeywordColor) => {
        setEditingId(kw.id);
        setEditKeyword(kw.keyword);
        setEditBgColor(kw.bgColor);
        setEditTextColor(kw.textColor);
    };

    const handleSaveEdit = async (id: string) => {
        if (!editKeyword.trim()) return;
        try {
            const existing = classKeywords.find(k => k.id === id);
            await setDoc(doc(db, 'classKeywords', id), {
                keyword: editKeyword.trim(),
                bgColor: editBgColor,
                textColor: editTextColor,
                order: existing?.order ?? 999
            }, { merge: true });
            // 캐시 무효화 - 시간표 즉시 반영
            queryClient.invalidateQueries({ queryKey: ['classKeywords'] });
            setEditingId(null);
        } catch (e) {
            console.error(e);
            alert('수정 실패');
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditKeyword('');
        setEditBgColor('');
        setEditTextColor('');
    };

    const handleDeleteKeyword = async (id: string, keyword: string) => {
        if (!confirm(`'${keyword}' 키워드를 삭제하시겠습니까?`)) return;
        try {
            await deleteDoc(doc(db, 'classKeywords', id));
            // 캐시 무효화 - 시간표 즉시 반영
            queryClient.invalidateQueries({ queryKey: ['classKeywords'] });
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
    };

    // --- Room Tab Handlers ---
    const handleToggleLabRoom = async (room: string) => {
        const newLabRooms = labRooms.includes(room)
            ? labRooms.filter(r => r !== room)
            : [...labRooms, room];
        setLabRooms(newLabRooms);
        try {
            await setDoc(doc(db, 'settings', 'roomSettings'), { labRooms: newLabRooms }, { merge: true });
        } catch (e) {
            console.error('Failed to save lab room settings:', e);
            alert('저장 실패');
        }
    };

    const handleMoveRoom = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...orderedRooms];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newOrder.length) return;

        [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
        setRoomOrder(newOrder);
        localStorage.setItem('english_room_order', JSON.stringify(newOrder));
    };

    if (!isOpen) return null;

    // --- Shared Tab Navigation ---
    const renderTabNav = () => (
        <div className="flex border-b border-gray-200 bg-gray-50 px-3 shrink-0">
            <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2 font-bold text-xs transition-all border-b-2 ${
                    activeTab === 'general'
                        ? 'border-accent text-primary'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
            >
                <div className="flex items-center gap-1.5">
                    <Settings size={14} />
                    일반 설정
                </div>
            </button>
            <button
                onClick={() => setActiveTab('room')}
                className={`px-4 py-2 font-bold text-xs transition-all border-b-2 ${
                    activeTab === 'room'
                        ? 'border-accent text-primary'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
            >
                <div className="flex items-center gap-1.5">
                    <DoorOpen size={14} />
                    강의실 설정
                </div>
            </button>
        </div>
    );

    // --- General Tab Content ---
    const renderGeneralTab = () => (
        <div className="space-y-2">
            {/* Section 1: 수업 키워드 관리 */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                    <Hash className="w-3 h-3 text-primary" />
                    <h3 className="text-primary font-bold text-xs">수업 키워드 관리</h3>
                </div>
                <div className="px-1.5 py-1">
                    <p className="text-xs text-gray-500 mb-3">
                        수업명에 특정 단어가 포함되면 색상을 자동으로 적용합니다.
                    </p>

                    {/* 키워드 목록 */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {classKeywords.map(kw => (
                            <div key={kw.id}>
                                {editingId === kw.id ? (
                                    <div className="p-1.5 rounded border-2 border-blue-400 bg-blue-50 space-y-1">
                                        <input
                                            type="text"
                                            value={editKeyword}
                                            onChange={(e) => setEditKeyword(e.target.value)}
                                            className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs font-semibold outline-none focus:border-blue-400"
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="color"
                                                value={editBgColor}
                                                onChange={(e) => setEditBgColor(e.target.value)}
                                                className="w-5 h-5 rounded cursor-pointer"
                                            />
                                            <input
                                                type="color"
                                                value={editTextColor}
                                                onChange={(e) => setEditTextColor(e.target.value)}
                                                className="w-5 h-5 rounded cursor-pointer"
                                            />
                                            <button
                                                onClick={() => handleSaveEdit(kw.id)}
                                                className="flex-1 px-1 py-0.5 bg-blue-600 text-white rounded text-xxs font-bold hover:bg-blue-700"
                                            >
                                                <Check size={10} className="inline" />
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="px-1 py-0.5 bg-gray-400 text-white rounded text-xxs font-bold hover:bg-gray-500"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="relative group p-1.5 rounded border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                        style={{ backgroundColor: kw.bgColor, color: kw.textColor }}
                                        onClick={() => canEdit && handleStartEdit(kw)}
                                    >
                                        <span className="text-xs block truncate">{kw.keyword}</span>
                                        {canEdit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteKeyword(kw.id, kw.keyword); }}
                                                className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded bg-white/90 hover:bg-white shadow-sm transition-all"
                                                title="삭제"
                                            >
                                                <X size={10} className="text-red-600" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {classKeywords.length === 0 && (
                            <div className="col-span-full py-4 text-center text-gray-400 text-xs">
                                등록된 키워드가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Section 2: 키워드 추가 */}
            {canEdit && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                        <Plus className="w-3 h-3 text-primary" />
                        <h3 className="text-primary font-bold text-xs">키워드 추가</h3>
                    </div>
                    <div className="px-1.5 py-1">
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="text-xs font-semibold text-gray-600 block mb-1">키워드</label>
                                <input
                                    type="text"
                                    placeholder="예: Phonics"
                                    value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-accent outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">배경색</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="color"
                                        value={newKeywordBgColor}
                                        onChange={(e) => setNewKeywordBgColor(e.target.value)}
                                        className="w-6 h-6 rounded cursor-pointer"
                                    />
                                    <span className="text-xxs text-gray-500 font-mono">{newKeywordBgColor}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">글자색</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="color"
                                        value={newKeywordTextColor}
                                        onChange={(e) => setNewKeywordTextColor(e.target.value)}
                                        className="w-6 h-6 rounded cursor-pointer"
                                    />
                                    <span className="text-xxs text-gray-500 font-mono">{newKeywordTextColor}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleAddKeyword}
                                className="px-3 py-1 bg-primary text-white rounded text-xs font-bold hover:brightness-110 whitespace-nowrap"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 3: 스케줄 표기 방식 */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                    <Clock className="w-3 h-3 text-primary" />
                    <h3 className="text-primary font-bold text-xs">스케줄 표기 방식</h3>
                </div>
                <div className="px-1.5 py-1">
                    <p className="text-xs text-gray-500 mb-3">
                        수업 카드와 상세 정보에서 시간을 어떻게 표시할지 설정합니다.
                    </p>

                    {scheduleDisplayLoading ? (
                        <div className="text-center py-3 text-gray-400 text-xs">로딩 중...</div>
                    ) : (
                        <div className="space-y-2">
                            {/* 수학 */}
                            <div className="flex items-center justify-between p-2 bg-amber-50 rounded-sm border border-amber-200">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 bg-accent text-primary rounded text-xs font-bold">수학</span>
                                    <span className="text-xs text-gray-600">
                                        {scheduleDisplay.math === 'period' ? '월목 4교시' : '월목 20:10~22:00'}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleScheduleDisplayChange('math', 'period')}
                                        disabled={!canEdit}
                                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                            scheduleDisplay.math === 'period'
                                                ? 'bg-primary text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Hash size={10} className="inline mr-0.5" />
                                        교시
                                    </button>
                                    <button
                                        onClick={() => handleScheduleDisplayChange('math', 'time')}
                                        disabled={!canEdit}
                                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                            scheduleDisplay.math === 'time'
                                                ? 'bg-primary text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Clock size={10} className="inline mr-0.5" />
                                        시간대
                                    </button>
                                </div>
                            </div>

                            {/* 영어 */}
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-sm border border-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 bg-primary text-white rounded text-xs font-bold">영어</span>
                                    <span className="text-xs text-gray-600">
                                        {scheduleDisplay.english === 'period' ? '월목 1~3교시' : '월목 14:20~16:20'}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleScheduleDisplayChange('english', 'period')}
                                        disabled={!canEdit}
                                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                            scheduleDisplay.english === 'period'
                                                ? 'bg-primary text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Hash size={10} className="inline mr-0.5" />
                                        교시
                                    </button>
                                    <button
                                        onClick={() => handleScheduleDisplayChange('english', 'time')}
                                        disabled={!canEdit}
                                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                            scheduleDisplay.english === 'time'
                                                ? 'bg-primary text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Clock size={10} className="inline mr-0.5" />
                                        시간대
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // --- Room Tab Content ---
    const renderRoomTab = () => (
        <div className="space-y-2">
            {/* Section 1: 사용 가능한 강의실 */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                    <DoorOpen className="w-3 h-3 text-primary" />
                    <h3 className="text-primary font-bold text-xs">사용 가능한 강의실</h3>
                </div>
                <div className="px-1.5 py-1">
                    <p className="text-xs text-gray-500 mb-3">
                        시간표에 등록된 강의실 목록입니다.
                    </p>

                    {roomsLoading ? (
                        <div className="text-center py-3 text-gray-400 text-xs">로딩 중...</div>
                    ) : orderedRooms.length === 0 ? (
                        <div className="py-4 text-center text-gray-400 text-xs">
                            시간표에 등록된 강의실이 없습니다.
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {orderedRooms.map(room => (
                                <div
                                    key={room}
                                    className={`px-2 py-1.5 rounded-sm border text-center text-xs font-bold ${
                                        labRooms.includes(room)
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                            : 'bg-gray-50 border-gray-200 text-gray-600'
                                    }`}
                                >
                                    {room}
                                    {labRooms.includes(room) && (
                                        <FlaskConical size={10} className="inline ml-1 text-indigo-400" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Section 2: 실습실 설정 */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                    <FlaskConical className="w-3 h-3 text-primary" />
                    <h3 className="text-primary font-bold text-xs">실습실 설정</h3>
                </div>
                <div className="px-1.5 py-1">
                    <p className="text-xs text-gray-500 mb-3">
                        실습실로 지정된 강의실은 강의실 뷰에서 수업별 학생수가 표시됩니다.
                    </p>

                    {roomsLoading ? (
                        <div className="text-center py-3 text-gray-400 text-xs">로딩 중...</div>
                    ) : orderedRooms.length === 0 ? (
                        <div className="py-4 text-center text-gray-400 text-xs">
                            시간표에 등록된 강의실이 없습니다.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {orderedRooms.map(room => (
                                <label
                                    key={room}
                                    className={`flex items-center gap-2 p-2 rounded-sm border cursor-pointer transition-all ${
                                        labRooms.includes(room)
                                            ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                    } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={labRooms.includes(room)}
                                        onChange={() => canEdit && handleToggleLabRoom(room)}
                                        disabled={!canEdit}
                                        className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                                    />
                                    <span className={`text-xs font-bold ${labRooms.includes(room) ? 'text-indigo-700' : 'text-gray-600'}`}>
                                        {room}
                                    </span>
                                    {labRooms.includes(room) && (
                                        <FlaskConical size={12} className="text-indigo-500 ml-auto" />
                                    )}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Section 3: 강의실 순서 */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                    <Settings className="w-3 h-3 text-primary" />
                    <h3 className="text-primary font-bold text-xs">강의실 순서</h3>
                </div>
                <div className="px-1.5 py-1">
                    <p className="text-xs text-gray-500 mb-3">
                        강의실 뷰에서 표시되는 강의실의 순서를 설정합니다. (이 기기에만 적용)
                    </p>

                    {roomsLoading ? (
                        <div className="text-center py-3 text-gray-400 text-xs">로딩 중...</div>
                    ) : orderedRooms.length === 0 ? (
                        <div className="py-4 text-center text-gray-400 text-xs">
                            시간표에 등록된 강의실이 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {orderedRooms.map((room, index) => (
                                <div
                                    key={room}
                                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-sm border border-gray-200"
                                >
                                    <span className="text-micro text-gray-400 w-4 text-center font-mono">{index + 1}</span>
                                    <span className={`text-xs font-bold flex-1 ${labRooms.includes(room) ? 'text-indigo-700' : 'text-gray-700'}`}>
                                        {room}
                                        {labRooms.includes(room) && (
                                            <FlaskConical size={10} className="inline ml-1 text-indigo-400" />
                                        )}
                                    </span>
                                    <div className="flex gap-0.5">
                                        <button
                                            onClick={() => handleMoveRoom(index, 'up')}
                                            disabled={index === 0}
                                            className={`p-1 rounded transition-colors ${
                                                index === 0
                                                    ? 'text-gray-300 cursor-not-allowed'
                                                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                            }`}
                                        >
                                            <ChevronUp size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleMoveRoom(index, 'down')}
                                            disabled={index === orderedRooms.length - 1}
                                            className={`p-1 rounded transition-colors ${
                                                index === orderedRooms.length - 1
                                                    ? 'text-gray-300 cursor-not-allowed'
                                                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                            }`}
                                        >
                                            <ChevronDown size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // embedded 모드: 다른 모달 내부에서 사용될 때는 wrapper 없이 컨텐츠만 렌더링
    if (embedded) {
        return (
            <div className="flex flex-col h-full">
                {renderTabNav()}
                <div className="flex-1 overflow-y-auto p-3">
                    {activeTab === 'general' && renderGeneralTab()}
                    {activeTab === 'room' && renderRoomTab()}
                </div>
            </div>
        );
    }

    // 독립 모달 모드
    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
                        <Settings size={16} className="text-primary" />
                        수업 설정
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Tab Navigation */}
                {renderTabNav()}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2">
                    {activeTab === 'general' && renderGeneralTab()}
                    {activeTab === 'room' && renderRoomTab()}
                </div>
            </div>
        </div>
    );
};

export default ClassSettingsModal;
