import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
    Search, Plus, Check, X, Edit, Trash2, List, GripVertical
} from 'lucide-react';

// Category type matching the new dynamic structure
export interface GanttCategory {
    id: string;
    label: string;
    backgroundColor: string; // CSS hex mainly
    textColor: string;      // CSS hex
    order: number;
}

// Initial defaults to seed if collection is empty
const DEFAULT_CATEGORIES: GanttCategory[] = [
    { id: 'planning', label: '기획', backgroundColor: '#dbeafe', textColor: '#1d4ed8', order: 0 },
    { id: 'development', label: '개발', backgroundColor: '#f3e8ff', textColor: '#7e22ce', order: 1 },
    { id: 'testing', label: '테스트', backgroundColor: '#d1fae5', textColor: '#047857', order: 2 },
    { id: 'other', label: '기타', backgroundColor: '#f3f4f6', textColor: '#374151', order: 3 }
];

interface GanttCategoriesTabProps {
    isMaster: boolean;
}

const GanttCategoriesTab = ({ isMaster }: GanttCategoriesTabProps) => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState('');
    const [editingBgColor, setEditingBgColor] = useState('#ffffff');
    const [editingTextColor, setEditingTextColor] = useState('#000000');

    // New Creation State
    const [newLabel, setNewLabel] = useState('');
    const [newBgColor, setNewBgColor] = useState('#dbeafe'); // Default pastel blue
    const [newTextColor, setNewTextColor] = useState('#1e40af'); // Default dark blue

    const [draggedId, setDraggedId] = useState<string | null>(null);

    // Fetch categories (Important Issue #4: 서버 측 orderBy 사용)
    const { data: categories = [], isLoading } = useQuery({
        queryKey: ['gantt_categories'],
        queryFn: async () => {
            const q = query(collection(db, 'gantt_categories'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                // Seed defaults
                const batch = writeBatch(db);
                DEFAULT_CATEGORIES.forEach(cat => {
                    batch.set(doc(db, 'gantt_categories', cat.id), cat);
                });
                await batch.commit();
                return DEFAULT_CATEGORIES;
            }
            return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as GanttCategory));
        }
    });

    const filteredCategories = categories.filter(c =>
        c.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handlers
    // Color validation helper (Important Issue #5)
    const isValidHexColor = (color: string): boolean => {
        return /^#[0-9A-Fa-f]{6}$/.test(color);
    };

    const handleAdd = async () => {
        const trimmedLabel = newLabel.trim();
        if (!trimmedLabel) return;

        // Important Issue #6: 중복 이름 방지
        if (categories.some(c => c.label.toLowerCase() === trimmedLabel.toLowerCase())) {
            alert(`"${trimmedLabel}" 카테고리가 이미 존재합니다.`);
            return;
        }

        // Important Issue #5: 색상 검증
        if (!isValidHexColor(newBgColor) || !isValidHexColor(newTextColor)) {
            alert('올바른 색상 코드를 입력해주세요. (예: #dbeafe)');
            return;
        }

        const newId = `cat_${Date.now()}`;
        const newCat: GanttCategory = {
            id: newId,
            label: trimmedLabel,
            backgroundColor: newBgColor,
            textColor: newTextColor,
            order: categories.length
        };

        try {
            await setDoc(doc(db, 'gantt_categories', newId), newCat);
            queryClient.invalidateQueries({ queryKey: ['gantt_categories'] });
            setNewLabel('');
            setNewBgColor('#dbeafe');
            setNewTextColor('#1e40af');
        } catch (e) {
            console.error(e);
            alert('카테고리 추가 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'));
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editingLabel.trim()) return;
        try {
            await setDoc(doc(db, 'gantt_categories', id), {
                label: editingLabel.trim(),
                backgroundColor: editingBgColor,
                textColor: editingTextColor
            }, { merge: true });
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['gantt_categories'] });
        } catch (e) {
            console.error(e);
            alert('수정 실패');
        }
    };

    const handleDelete = async (id: string, label: string) => {
        // Critical Issue #2: 사용 중인 카테고리 삭제 방지
        try {
            // Check if category is in use by any project
            const templatesSnapshot = await getDocs(collection(db, 'gantt_templates'));
            const usageCount = templatesSnapshot.docs.filter(doc => {
                const data = doc.data();
                return data.tasks?.some((task: any) => task.category === id);
            }).length;

            if (usageCount > 0) {
                const proceed = confirm(
                    `"${label}" 카테고리가 ${usageCount}개 프로젝트에서 사용 중입니다.\n삭제하면 해당 프로젝트의 카테고리 정보가 손실됩니다.\n\n정말 삭제하시겠습니까?`
                );
                if (!proceed) return;
            } else {
                if (!confirm(`"${label}" 카테고리를 삭제하시겠습니까?`)) return;
            }

            await deleteDoc(doc(db, 'gantt_categories', id));
            queryClient.invalidateQueries({ queryKey: ['gantt_categories'] });
        } catch (e) {
            console.error('카테고리 삭제 오류:', e);
            alert('삭제 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'));
        }
    };

    const startEdit = (cat: GanttCategory) => {
        setEditingId(cat.id);
        setEditingLabel(cat.label);
        setEditingBgColor(cat.backgroundColor);
        setEditingTextColor(cat.textColor);
    };

    // Drag and Drop
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;

        const draggedIndex = categories.findIndex(c => c.id === draggedId);
        const targetIndex = categories.findIndex(c => c.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const newCats = [...categories];
        const [removed] = newCats.splice(draggedIndex, 1);
        newCats.splice(targetIndex, 0, removed);

        // Critical Issue #3: 에러 핸들링 및 롤백 추가
        try {
            const batch = writeBatch(db);
            newCats.forEach((c, idx) => {
                batch.update(doc(db, 'gantt_categories', c.id), { order: idx });
            });
            await batch.commit();
            queryClient.invalidateQueries({ queryKey: ['gantt_categories'] });
        } catch (error) {
            console.error('순서 변경 실패:', error);
            alert('순서 변경에 실패했습니다. 페이지를 새로고침해 주세요.');
            // Rollback: refetch to restore original order
            queryClient.invalidateQueries({ queryKey: ['gantt_categories'] });
        } finally {
            setDraggedId(null);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-blue-100 flex items-center justify-center">
                        <List size={20} className="text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">카테고리 관리</h3>
                        <p className="text-xs text-gray-500">간트 차트의 작업 항목 카테고리를 관리합니다. (예: 기획, 개발, 테스트)</p>
                    </div>
                </div>
                <span className="text-sm text-gray-400 font-medium">{categories.length}개</span>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                    type="text"
                    placeholder="카테고리 검색..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-sm text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Add New */}
            {isMaster && (
                <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">새 카테고리 추가</h4>
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">카테고리명</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-sm text-sm outline-none focus:border-blue-500"
                                placeholder="예: 디자인"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">배경 색상</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={newBgColor} onChange={e => setNewBgColor(e.target.value)} className="w-9 h-10 rounded cursor-pointer border border-gray-200" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">글자 색상</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={newTextColor} onChange={e => setNewTextColor(e.target.value)} className="w-9 h-10 rounded cursor-pointer border border-gray-200" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">미리보기</label>
                            <div
                                className="px-4 py-2.5 rounded font-bold text-xs shadow-sm min-w-[80px] text-center"
                                style={{ backgroundColor: newBgColor, color: newTextColor }}
                            >
                                {newLabel || '미리보기'}
                            </div>
                        </div>
                        <button
                            onClick={handleAdd}
                            disabled={!newLabel.trim()}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sm text-sm font-medium transition shadow-sm h-[42px]"
                        >
                            <Plus size={16} />
                            추가
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">등록된 카테고리</span>
                    <span className="text-xs text-gray-400">드래그하여 순서 변경</span>
                </div>

                <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-400">로딩 중...</div>
                    ) : filteredCategories.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">등록된 카테고리가 없습니다.</div>
                    ) : (
                        filteredCategories.map(cat => (
                            <div
                                key={cat.id}
                                draggable={isMaster}
                                onDragStart={(e) => handleDragStart(e, cat.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, cat.id)}
                                className={`flex items-center gap-4 px-4 py-3 transition-all ${draggedId === cat.id ? 'opacity-50 bg-blue-50' : 'bg-white hover:bg-gray-50'
                                    }`}
                            >
                                {isMaster && <GripVertical size={16} className="text-gray-300 cursor-grab flex-shrink-0" />}

                                {editingId === cat.id ? (
                                    <div className="flex-1 flex items-center gap-3">
                                        <input
                                            value={editingLabel}
                                            onChange={e => setEditingLabel(e.target.value)}
                                            className="flex-1 px-3 py-1.5 border border-blue-400 rounded text-sm outline-none"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <input type="color" value={editingBgColor} onChange={e => setEditingBgColor(e.target.value)} className="w-8 h-8 rounded border" title="배경색" />
                                            <input type="color" value={editingTextColor} onChange={e => setEditingTextColor(e.target.value)} className="w-8 h-8 rounded border" title="글자색" />
                                        </div>
                                        <button onClick={() => handleUpdate(cat.id)} className="p-2 text-green-600 bg-green-50 rounded hover:bg-green-100"><Check size={16} /></button>
                                        <button onClick={() => setEditingId(null)} className="p-2 text-gray-400 bg-gray-50 rounded hover:bg-gray-100"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className="w-6 h-6 rounded border border-black/10 shadow-sm"
                                            style={{ backgroundColor: cat.backgroundColor }}
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-gray-800">{cat.label}</span>
                                                <span
                                                    className="text-xxs px-1.5 py-0.5 rounded font-medium"
                                                    style={{ backgroundColor: cat.backgroundColor, color: cat.textColor }}
                                                >
                                                    미리보기
                                                </span>
                                            </div>
                                        </div>
                                        {isMaster && (
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => startEdit(cat)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Edit size={14} /></button>
                                                <button onClick={() => handleDelete(cat.id, cat.label)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"><Trash2 size={14} /></button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-sm p-3">
                <span className="text-blue-500 font-bold">💡</span>
                <span>배경색은 밝은 파스텔 톤, 글자색은 진한 색상을 선택하면 가독성이 좋습니다.</span>
            </div>
        </div>
    );
};

export default GanttCategoriesTab;
