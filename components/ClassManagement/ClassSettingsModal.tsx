import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClassKeywordColor } from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { listenerRegistry } from '../../utils/firebaseCleanup';
import { X, Edit2, Check, Clock, Hash } from 'lucide-react';

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

const ClassSettingsModal: React.FC<ClassSettingsModalProps> = ({
    isOpen,
    onClose,
    canEdit = true,
    embedded = false
}) => {
    const queryClient = useQueryClient();

    // --- Local State ---
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

    // --- Handlers ---
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
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
    };

    if (!isOpen) return null;

    // embedded 모드: 다른 모달 내부에서 사용될 때는 wrapper 없이 컨텐츠만 렌더링
    if (embedded) {
        return (
            <div className="space-y-4">
                {/* 스케줄 표기 방식 설정 */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h3 className="font-bold mb-1 flex items-center gap-2 text-blue-700 text-sm">
                        <Clock size={16} />
                        스케줄 표기 방식
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                        수업 카드와 상세 정보에서 시간을 어떻게 표시할지 설정합니다.
                    </p>

                    {scheduleDisplayLoading ? (
                        <div className="text-center py-3 text-gray-400 text-xs">로딩 중...</div>
                    ) : (
                        <div className="space-y-2">
                            {/* 수학 */}
                            <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-200">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 bg-[#fdb813] text-[#081429] rounded text-xs font-bold">수학</span>
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
                                                ? 'bg-[#081429] text-white'
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
                                                ? 'bg-[#081429] text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Clock size={10} className="inline mr-0.5" />
                                        시간대
                                    </button>
                                </div>
                            </div>

                            {/* 영어 */}
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 bg-[#081429] text-white rounded text-xs font-bold">영어</span>
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
                                                ? 'bg-[#081429] text-white'
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
                                                ? 'bg-[#081429] text-white'
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

                {/* 수업 키워드 색상 관리 */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h3 className="font-bold mb-1 flex items-center gap-2 text-purple-700 text-sm">
                        🎨 수업 키워드 색상 관리
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                        수업명에 특정 단어가 포함되면 색상을 자동으로 적용합니다.
                    </p>

                    {/* 입력 폼 */}
                    {canEdit && (
                        <div className="flex items-end gap-2 mb-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex-1">
                                <label className="text-xs font-semibold text-gray-600 block mb-1">키워드</label>
                                <input
                                    type="text"
                                    placeholder="예: Phonics"
                                    value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-[#fdb813] outline-none"
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
                                    <span className="text-[10px] text-gray-500 font-mono">{newKeywordBgColor}</span>
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
                                    <span className="text-[10px] text-gray-500 font-mono">{newKeywordTextColor}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleAddKeyword}
                                className="px-3 py-1 bg-[#081429] text-white rounded text-xs font-bold hover:brightness-110 whitespace-nowrap"
                            >
                                추가
                            </button>
                        </div>
                    )}

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
                                                className="flex-1 px-1 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700"
                                            >
                                                <Check size={10} className="inline" />
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="px-1 py-0.5 bg-gray-400 text-white rounded text-[10px] font-bold hover:bg-gray-500"
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
        );
    }

    // 독립 모달 모드
    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200]"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-[#081429] px-4 py-2.5 flex justify-between items-center text-white shrink-0">
                    <h2 className="text-sm font-bold flex items-center gap-1.5">
                        ⚙️ 수업 설정
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3">
                    <div className="space-y-4">
                        {/* 스케줄 표기 방식 설정 */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h3 className="font-bold mb-1 flex items-center gap-2 text-blue-700 text-sm">
                                <Clock size={16} />
                                스케줄 표기 방식
                            </h3>
                            <p className="text-xs text-gray-500 mb-3">
                                수업 카드와 상세 정보에서 시간을 어떻게 표시할지 설정합니다.
                            </p>

                            {scheduleDisplayLoading ? (
                                <div className="text-center py-3 text-gray-400 text-xs">로딩 중...</div>
                            ) : (
                                <div className="space-y-2">
                                    {/* 수학 */}
                                    <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-200">
                                        <div className="flex items-center gap-2">
                                            <span className="px-1.5 py-0.5 bg-[#fdb813] text-[#081429] rounded text-xs font-bold">수학</span>
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
                                                        ? 'bg-[#081429] text-white'
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
                                                        ? 'bg-[#081429] text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <Clock size={10} className="inline mr-0.5" />
                                                시간대
                                            </button>
                                        </div>
                                    </div>

                                    {/* 영어 */}
                                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <span className="px-1.5 py-0.5 bg-[#081429] text-white rounded text-xs font-bold">영어</span>
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
                                                        ? 'bg-[#081429] text-white'
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
                                                        ? 'bg-[#081429] text-white'
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

                        {/* 수업 키워드 색상 관리 */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h3 className="font-bold mb-1 flex items-center gap-2 text-purple-700 text-sm">
                                🎨 수업 키워드 색상 관리
                            </h3>
                            <p className="text-xs text-gray-500 mb-3">
                                수업명에 특정 단어가 포함되면 색상을 자동으로 적용합니다.
                            </p>

                            {/* 입력 폼 */}
                            {canEdit && (
                                <div className="flex items-end gap-2 mb-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-gray-600 block mb-1">키워드</label>
                                        <input
                                            type="text"
                                            placeholder="예: Phonics"
                                            value={newKeyword}
                                            onChange={(e) => setNewKeyword(e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-[#fdb813] outline-none"
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
                                            <span className="text-[10px] text-gray-500 font-mono">{newKeywordBgColor}</span>
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
                                            <span className="text-[10px] text-gray-500 font-mono">{newKeywordTextColor}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddKeyword}
                                        className="px-3 py-1 bg-[#081429] text-white rounded text-xs font-bold hover:brightness-110 whitespace-nowrap"
                                    >
                                        추가
                                    </button>
                                </div>
                            )}

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
                                                        className="flex-1 px-1 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700"
                                                    >
                                                        <Check size={10} className="inline" />
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="px-1 py-0.5 bg-gray-400 text-white rounded text-[10px] font-bold hover:bg-gray-500"
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
                </div>
            </div>
        </div>
    );
};

export default ClassSettingsModal;
