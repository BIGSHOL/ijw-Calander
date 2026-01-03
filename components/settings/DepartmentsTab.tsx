import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
    Search, Plus, Check, X, Edit, Trash2, Building2, GripVertical, Eye
} from 'lucide-react';

// Department type for Gantt/Project visibility
export interface GanttDepartment {
    id: string;
    label: string;
    color: string;  // Hex color for background
    order: number;
    createdAt?: number;
}

interface DepartmentsTabProps {
    isMaster: boolean;
}

/**
 * DepartmentsTab - Manage custom departments for Gantt project visibility
 * Used in System Settings modal - Light theme matching other tabs
 */
const DepartmentsTab = ({ isMaster }: DepartmentsTabProps) => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState('');
    const [editingColor, setEditingColor] = useState('#3b82f6');
    const [newLabel, setNewLabel] = useState('');
    const [newColor, setNewColor] = useState('#3b82f6');
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [previewColor, setPreviewColor] = useState<string | null>(null);

    // Fetch departments from Firestore
    const { data: departments = [], isLoading } = useQuery({
        queryKey: ['gantt_departments'],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, 'gantt_departments'));
            const deps: GanttDepartment[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as GanttDepartment));
            return deps.sort((a, b) => (a.order || 0) - (b.order || 0));
        }
    });

    // Filtered departments
    const filteredDepartments = departments.filter(d =>
        d.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- Handlers ---
    const handleAddDepartment = async () => {
        if (!newLabel.trim()) return;

        const newId = `dept_${Date.now()}`;
        const newDept: GanttDepartment = {
            id: newId,
            label: newLabel.trim(),
            color: newColor,
            order: departments.length,
            createdAt: Date.now()
        };

        try {
            await setDoc(doc(db, 'gantt_departments', newId), newDept);
            queryClient.invalidateQueries({ queryKey: ['gantt_departments'] });
            setNewLabel('');
            setNewColor('#3b82f6');
        } catch (error) {
            console.error('Failed to add department:', error);
            alert('부서 추가 실패');
        }
    };

    const handleUpdateDepartment = async (id: string) => {
        if (!editingLabel.trim()) return;

        try {
            await setDoc(doc(db, 'gantt_departments', id), {
                label: editingLabel.trim(),
                color: editingColor
            }, { merge: true });
            queryClient.invalidateQueries({ queryKey: ['gantt_departments'] });
            setEditingId(null);
        } catch (error) {
            console.error('Failed to update department:', error);
            alert('부서 수정 실패');
        }
    };

    const handleDeleteDepartment = async (id: string, label: string) => {
        if (!confirm(`"${label}" 부서를 삭제하시겠습니까?\n해당 부서를 사용하는 프로젝트에서 접근이 제한될 수 있습니다.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'gantt_departments', id));
            queryClient.invalidateQueries({ queryKey: ['gantt_departments'] });
        } catch (error) {
            console.error('Failed to delete department:', error);
            alert('부서 삭제 실패');
        }
    };

    // Drag and Drop Handlers
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
        if (!draggedId || draggedId === targetId) {
            setDraggedId(null);
            return;
        }

        const draggedIndex = departments.findIndex(d => d.id === draggedId);
        const targetIndex = departments.findIndex(d => d.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const newDepartments = [...departments];
        const [removed] = newDepartments.splice(draggedIndex, 1);
        newDepartments.splice(targetIndex, 0, removed);

        // Update order in Firestore
        try {
            const batch = writeBatch(db);
            newDepartments.forEach((dept, index) => {
                batch.update(doc(db, 'gantt_departments', dept.id), { order: index });
            });
            await batch.commit();
            queryClient.invalidateQueries({ queryKey: ['gantt_departments'] });
        } catch (error) {
            console.error('Failed to reorder departments:', error);
        }

        setDraggedId(null);
    };

    const startEdit = (dept: GanttDepartment) => {
        setEditingId(dept.id);
        setEditingLabel(dept.label);
        setEditingColor(dept.color);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <Building2 size={20} className="text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">부서 관리</h3>
                        <p className="text-xs text-gray-500">간트 차트의 "부서 공개" 기능에서 사용할 부서를 관리합니다.</p>
                    </div>
                </div>
                <span className="text-sm text-gray-400 font-medium">{departments.length}개</span>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                    type="text"
                    placeholder="부서 검색..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Add New Department */}
            {isMaster && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">새 부서 추가</h4>
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-[11px] font-medium text-gray-500 mb-1 block">부서명</label>
                            <input
                                type="text"
                                placeholder="예: 마케팅팀"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-purple-400 transition"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddDepartment()}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-gray-500 mb-1 block">배경 색상</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={newColor}
                                    onChange={(e) => setNewColor(e.target.value)}
                                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer"
                                    title="색상 선택"
                                />
                                <input
                                    type="text"
                                    value={newColor}
                                    onChange={(e) => setNewColor(e.target.value)}
                                    className="w-20 px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 font-mono outline-none focus:border-purple-400"
                                    placeholder="#3b82f6"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-gray-500 mb-1 block">미리보기</label>
                            <div
                                className="w-24 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                style={{ backgroundColor: newColor }}
                            >
                                {newLabel || '미리보기'}
                            </div>
                        </div>
                        <button
                            onClick={handleAddDepartment}
                            disabled={!newLabel.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition shadow-sm"
                        >
                            <Plus size={16} />
                            추가
                        </button>
                    </div>
                </div>
            )}

            {/* Departments List */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">등록된 부서</span>
                    <span className="text-xs text-gray-400">드래그하여 순서 변경</span>
                </div>

                <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
                    {isLoading ? (
                        <div className="text-center text-gray-400 py-12">로딩 중...</div>
                    ) : filteredDepartments.length === 0 ? (
                        <div className="text-center text-gray-400 py-12">
                            {searchQuery ? '검색 결과가 없습니다.' : '등록된 부서가 없습니다.'}
                        </div>
                    ) : (
                        filteredDepartments.map((dept) => (
                            <div
                                key={dept.id}
                                draggable={isMaster}
                                onDragStart={(e) => handleDragStart(e, dept.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, dept.id)}
                                className={`flex items-center gap-4 px-4 py-3 transition-all ${draggedId === dept.id
                                        ? 'opacity-50 bg-purple-50'
                                        : 'bg-white hover:bg-gray-50'
                                    }`}
                            >
                                {/* Drag Handle */}
                                {isMaster && (
                                    <GripVertical size={16} className="text-gray-300 cursor-grab flex-shrink-0" />
                                )}

                                {/* Color Badge */}
                                <div
                                    className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm"
                                    style={{ backgroundColor: dept.color }}
                                />

                                {/* Label */}
                                {editingId === dept.id ? (
                                    <div className="flex-1 flex items-center gap-3">
                                        <input
                                            type="text"
                                            value={editingLabel}
                                            onChange={(e) => setEditingLabel(e.target.value)}
                                            className="flex-1 px-3 py-1.5 bg-white border border-purple-400 rounded-lg text-sm text-gray-800 outline-none"
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={editingColor}
                                                onChange={(e) => setEditingColor(e.target.value)}
                                                className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={editingColor}
                                                onChange={(e) => setEditingColor(e.target.value)}
                                                className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 font-mono outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleUpdateDepartment(dept.id)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                        >
                                            <Check size={16} />
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1">
                                            <span className="text-sm font-medium text-gray-800">{dept.label}</span>
                                            <span className="ml-2 text-xs text-gray-400 font-mono">{dept.color}</span>
                                        </div>
                                        {isMaster && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => startEdit(dept)}
                                                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                                                    title="수정"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDepartment(dept.id, dept.label)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                    title="삭제"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Footer Info */}
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl p-3">
                <span className="text-blue-500 font-bold">💡</span>
                <span>사용자 설정에서 각 사용자의 소속 부서를 지정하면, 해당 부서에 공개된 간트 프로젝트를 볼 수 있습니다.</span>
            </div>
        </div>
    );
};

export default DepartmentsTab;
