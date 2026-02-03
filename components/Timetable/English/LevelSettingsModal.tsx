import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical, ChevronUp, ChevronDown, Plus, Trash2, Edit2, RotateCcw, List, GraduationCap, Settings } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { listenerRegistry } from '../../../utils/firebaseCleanup';
import { EnglishLevel, LevelSettings } from '../../../types';
import { DEFAULT_ENGLISH_LEVELS } from './englishUtils';

interface LevelSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SortableItemProps {
    level: EnglishLevel;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onEdit: () => void;
    onDelete: () => void;
    isFirst: boolean;
    isLast: boolean;
    key?: React.Key;
}

const SortableItem = ({ level, onMoveUp, onMoveDown, onEdit, onDelete, isFirst, isLast }: SortableItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: level.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center justify-between p-2 bg-white border rounded-sm mb-2 shadow-sm group hover:border-indigo-300 transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1">
                    <GripVertical size={16} />
                </div>
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-700 w-10 shrink-0">{level.abbreviation}</span>
                        <span className="text-gray-800 text-sm truncate">{level.fullName}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
                <button
                    onClick={onEdit}
                    className="p-1.5 rounded-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                    title="수정"
                >
                    <Edit2 size={14} />
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button
                    onClick={onMoveUp}
                    disabled={isFirst}
                    className={`p-1 rounded-sm ${isFirst ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'}`}
                >
                    <ChevronUp size={16} />
                </button>
                <button
                    onClick={onMoveDown}
                    disabled={isLast}
                    className={`p-1 rounded-sm ${isLast ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'}`}
                >
                    <ChevronDown size={16} />
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button
                    onClick={onDelete}
                    className="p-1.5 rounded-sm text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="삭제"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

const LevelSettingsModal: React.FC<LevelSettingsModalProps> = ({ isOpen, onClose }) => {
    const [levels, setLevels] = useState<EnglishLevel[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [editId, setEditId] = useState<string | null>(null);
    const [inputAbbr, setInputAbbr] = useState('');
    const [inputName, setInputName] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const unsubscribe = onSnapshot(doc(db, 'settings', 'english_levels'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as LevelSettings;
                // Sort by order
                const sorted = (data.levels || []).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
                setLevels(sorted);
            } else {
                setLevels([]);
            }
            setLoading(false);
        });

        return listenerRegistry.register('LevelSettingsModal', unsubscribe);
    }, [isOpen]);

    const saveLevels = async (newLevels: EnglishLevel[]) => {
        try {
            // Re-assign order based on array index
            const orderedLevels = newLevels.map((lvl, idx) => ({ ...lvl, order: idx }));
            await setDoc(doc(db, 'settings', 'english_levels'), { levels: orderedLevels }, { merge: true });
            // Local update strictly not needed due to snapshot, but good for UX responsiveness if snapshot lags
        } catch (error) {
            console.error('Failed to save levels:', error);
            alert('저장에 실패했습니다.');
        }
    };

    const handleLoadDefaults = async () => {
        if (!confirm('기본 레벨 데이터(DP~MEC)로 초기화하시겠습니까? 기존 설정은 덮어씌워집니다.')) return;
        await saveLevels(DEFAULT_ENGLISH_LEVELS);
    };

    const handleAddOrUpdate = async () => {
        if (!inputAbbr.trim() || !inputName.trim()) {
            alert('약어와 전체 이름을 모두 입력해주세요.');
            return;
        }

        let newLevels = [...levels];

        if (editId) {
            // Update
            newLevels = newLevels.map(l => l.id === editId ? { ...l, abbreviation: inputAbbr.trim(), fullName: inputName.trim() } : l);
        } else {
            // Add
            const newId = `level_${Date.now()}`;
            newLevels.push({
                id: newId,
                abbreviation: inputAbbr.trim(),
                fullName: inputName.trim(),
                order: levels.length
            });
        }

        await saveLevels(newLevels);
        resetForm();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const newLevels = levels.filter(l => l.id !== id);
        await saveLevels(newLevels);
    };

    const handleEditStart = (level: EnglishLevel) => {
        setEditId(level.id);
        setInputAbbr(level.abbreviation);
        setInputName(level.fullName);
    };

    const resetForm = () => {
        setEditId(null);
        setInputAbbr('');
        setInputName('');
    };

    // Drag & Drop Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = levels.findIndex(l => l.id === active.id);
            const newIndex = levels.findIndex(l => l.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrdered = arrayMove(levels, oldIndex, newIndex) as EnglishLevel[];
                saveLevels(newOrdered); // Auto-save on drop
            }
        }
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const newLevels = [...levels];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex >= 0 && targetIndex < newLevels.length) {
            [newLevels[index], newLevels[targetIndex]] = [newLevels[targetIndex], newLevels[index]];
            saveLevels(newLevels);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-start justify-center pt-[8vh]" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-2xl w-[480px] max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b bg-gray-50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">영어 레벨 설정</h2>
                        <p className="text-xs text-gray-500 mt-0.5">레벨 약어, 이름 및 순서를 관리합니다.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-sm hover:bg-gray-200">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-100/50 space-y-2">

                    {/* Section 1: 레벨 목록 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <GraduationCap className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">레벨 목록</h3>
                            <span className="text-xxs text-gray-400 ml-1">({levels.length}개)</span>
                        </div>
                        <div className="p-2">
                            {loading ? (
                                <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>
                            ) : levels.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 rounded-sm border border-dashed border-gray-300 text-gray-400 text-sm">
                                    등록된 레벨이 없습니다.
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={levels.map(l => l.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {levels.map((level, index) => (
                                            <SortableItem
                                                key={level.id}
                                                level={level}
                                                onMoveUp={() => handleMove(index, 'up')}
                                                onMoveDown={() => handleMove(index, 'down')}
                                                onEdit={() => handleEditStart(level)}
                                                onDelete={() => handleDelete(level.id)}
                                                isFirst={index === 0}
                                                isLast={index === levels.length - 1}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>
                    </div>

                    {/* Section 2: 레벨 추가/편집 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            {editId ? (
                                <>
                                    <Edit2 className="w-3 h-3 text-[#081429]" />
                                    <h3 className="text-[#081429] font-bold text-xs">레벨 수정</h3>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-3 h-3 text-[#081429]" />
                                    <h3 className="text-[#081429] font-bold text-xs">레벨 추가</h3>
                                </>
                            )}
                        </div>
                        <div className="p-2">
                            <div className="flex gap-2 mb-2">
                                <div className="w-1/3">
                                    <input
                                        type="text"
                                        value={inputAbbr}
                                        onChange={(e) => setInputAbbr(e.target.value)}
                                        placeholder="약어 (예: DP)"
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={inputName}
                                        onChange={(e) => setInputName(e.target.value)}
                                        placeholder="전체 이름 (예: Dr. Phonics)"
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddOrUpdate()}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                {editId && (
                                    <button
                                        onClick={resetForm}
                                        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-sm"
                                    >
                                        취소
                                    </button>
                                )}
                                <button
                                    onClick={handleAddOrUpdate}
                                    className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-sm hover:bg-indigo-700 transition-colors"
                                >
                                    {editId ? <Edit2 size={12} /> : <Plus size={12} />}
                                    {editId ? '수정 완료' : '추가'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: 작업 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Settings className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">작업</h3>
                        </div>
                        <div className="p-2">
                            <button
                                onClick={handleLoadDefaults}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 text-xs font-medium border border-gray-300 rounded-sm hover:bg-gray-100 transition-colors"
                            >
                                <RotateCcw size={14} />
                                기본값으로 초기화 (DP~MEC)
                            </button>
                            <p className="text-xxs text-gray-500 mt-1.5 text-center">
                                기존 설정이 덮어씌워집니다.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default LevelSettingsModal;
