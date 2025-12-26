// English Teacher Schedule Tab
// 영어 강사별 시간표 탭

import React, { useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { Plus, Edit3, Move, Eye, X } from 'lucide-react';
import { EN_PERIODS, EN_WEEKDAYS, EN_COLLECTION, getCellKey, getTeacherColor } from './englishUtils';
import { Teacher } from '../../../types';

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

interface EnglishTeacherTabProps {
    teachers: string[];
    teachersData: Teacher[];  // 강사 데이터 (색상 포함)
    scheduleData: ScheduleData;
    onRefresh: () => void;
    onUpdateLocal: (data: ScheduleData) => void;
}

const EnglishTeacherTab: React.FC<EnglishTeacherTabProps> = ({
    teachers,
    teachersData,
    scheduleData,
    onRefresh,
    onUpdateLocal,
}) => {
    const [mode, setMode] = useState<'view' | 'edit' | 'move'>('view');
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [filterTeacher, setFilterTeacher] = useState<string>('all');
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editData, setEditData] = useState({ className: '', room: '', note: '' });

    // Filter teachers
    const filteredTeachers = useMemo(() => {
        if (filterTeacher === 'all') return teachers;
        return teachers.filter(t => t === filterTeacher);
    }, [teachers, filterTeacher]);

    // Handle cell click
    const handleCellClick = (cellKey: string) => {
        if (mode === 'view') return;

        setSelectedCells(prev => {
            const newSet = new Set(prev);
            if (newSet.has(cellKey)) {
                newSet.delete(cellKey);
            } else {
                newSet.add(cellKey);
            }
            return newSet;
        });
    };

    // Open edit modal for selected cells
    const openEditModal = () => {
        if (selectedCells.size === 0) return;
        const firstKey = Array.from(selectedCells)[0];
        const existing = scheduleData[firstKey];
        setEditData({
            className: existing?.className || '',
            room: existing?.room || '',
            note: existing?.note || '',
        });
        setEditModalOpen(true);
    };

    // Save cell data
    const handleSave = async () => {
        const updates: ScheduleData = { ...scheduleData };

        selectedCells.forEach(key => {
            updates[key] = {
                ...updates[key],
                className: editData.className,
                room: editData.room,
                note: editData.note,
            };
        });

        try {
            await setDoc(doc(db, EN_COLLECTION, 'schedule'), updates, { merge: true });
            onUpdateLocal(updates);
            setSelectedCells(new Set());
            setEditModalOpen(false);
        } catch (e) {
            console.error('저장 실패:', e);
            alert('저장 실패');
        }
    };

    // Delete selected cells
    const handleDelete = async () => {
        if (!confirm('선택한 셀을 삭제하시겠습니까?')) return;

        const updates: ScheduleData = { ...scheduleData };
        selectedCells.forEach(key => {
            delete updates[key];
        });

        try {
            await setDoc(doc(db, EN_COLLECTION, 'schedule'), updates);
            onUpdateLocal(updates);
            setSelectedCells(new Set());
        } catch (e) {
            console.error('삭제 실패:', e);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                    {/* Mode Toggle */}
                    <div className="flex bg-gray-200 rounded-lg p-0.5">
                        <button
                            onClick={() => { setMode('view'); setSelectedCells(new Set()); }}
                            className={`px-2 py-1 text-xs font-bold rounded transition-all ${mode === 'view' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
                        >
                            <Eye size={12} className="inline mr-1" />조회
                        </button>
                        <button
                            onClick={() => setMode('edit')}
                            className={`px-2 py-1 text-xs font-bold rounded transition-all ${mode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
                        >
                            <Edit3 size={12} className="inline mr-1" />편집
                        </button>
                        <button
                            onClick={() => setMode('move')}
                            className={`px-2 py-1 text-xs font-bold rounded transition-all ${mode === 'move' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500'}`}
                        >
                            <Move size={12} className="inline mr-1" />이동
                        </button>
                    </div>

                    {/* Teacher Filter */}
                    <select
                        value={filterTeacher}
                        onChange={(e) => setFilterTeacher(e.target.value)}
                        className="px-2 py-1 text-xs border rounded"
                    >
                        <option value="all">전체 강사</option>
                        {teachers.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {/* Actions */}
                {mode === 'edit' && selectedCells.size > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{selectedCells.size}개 선택</span>
                        <button
                            onClick={openEditModal}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-bold"
                        >
                            수정
                        </button>
                        <button
                            onClick={handleDelete}
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold"
                        >
                            삭제
                        </button>
                    </div>
                )}
            </div>

            {/* Schedule Grid */}
            <div className="flex-1 overflow-auto p-2 bg-gray-100">
                <table className="border-collapse bg-white rounded shadow">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            <th className="p-2 border bg-gray-100 text-xs font-bold text-gray-600" rowSpan={2}>교시</th>
                            {filteredTeachers.map(teacher => {
                                const colors = getTeacherColor(teacher, teachersData);
                                return (
                                    <th
                                        key={teacher}
                                        colSpan={EN_WEEKDAYS.length}
                                        className="p-2 border text-xs font-bold"
                                        style={{ backgroundColor: colors.bg, color: colors.text }}
                                    >
                                        {teacher}
                                    </th>
                                );
                            })}
                        </tr>
                        <tr>
                            {filteredTeachers.map(teacher => (
                                EN_WEEKDAYS.map(day => (
                                    <th
                                        key={`${teacher}-${day}`}
                                        className="p-1 border bg-gray-50 text-[10px] font-bold text-gray-500 min-w-[60px]"
                                    >
                                        {day}
                                    </th>
                                ))
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {EN_PERIODS.map(period => (
                            <tr key={period.id}>
                                <td className="p-2 border bg-gray-50 text-xs font-bold text-gray-600 text-center whitespace-nowrap">
                                    <div>{period.label}</div>
                                    <div className="text-[9px] text-gray-400">{period.time}</div>
                                </td>
                                {filteredTeachers.map(teacher => (
                                    EN_WEEKDAYS.map(day => {
                                        const cellKey = getCellKey(teacher, period.id, day);
                                        const cellData = scheduleData[cellKey];
                                        const isSelected = selectedCells.has(cellKey);

                                        return (
                                            <td
                                                key={cellKey}
                                                onClick={() => handleCellClick(cellKey)}
                                                className={`p-1 border text-center cursor-pointer transition-all min-h-[40px] ${isSelected
                                                    ? 'bg-blue-100 ring-2 ring-blue-400'
                                                    : cellData?.className
                                                        ? 'bg-green-50 hover:bg-green-100'
                                                        : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                {cellData?.className && (
                                                    <div className="text-[10px] font-bold text-gray-700">
                                                        {cellData.className}
                                                    </div>
                                                )}
                                                {cellData?.room && (
                                                    <div className="text-[9px] text-gray-400">
                                                        {cellData.room}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-4 w-[300px]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-sm">셀 편집 ({selectedCells.size}개)</h3>
                            <button onClick={() => setEditModalOpen(false)}>
                                <X size={16} className="text-gray-400" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600">수업명</label>
                                <input
                                    type="text"
                                    value={editData.className}
                                    onChange={e => setEditData({ ...editData, className: e.target.value })}
                                    className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
                                    placeholder="수업명 입력"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">강의실</label>
                                <input
                                    type="text"
                                    value={editData.room}
                                    onChange={e => setEditData({ ...editData, room: e.target.value })}
                                    className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
                                    placeholder="강의실"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">비고</label>
                                <input
                                    type="text"
                                    value={editData.note}
                                    onChange={e => setEditData({ ...editData, note: e.target.value })}
                                    className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
                                    placeholder="비고"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setEditModalOpen(false)}
                                className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded font-bold"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnglishTeacherTab;
