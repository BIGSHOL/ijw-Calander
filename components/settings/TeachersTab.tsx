import React, { useState } from 'react';
import { Teacher } from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import {
    Search, Plus, Check, X, Eye, EyeOff, Edit, Trash2
} from 'lucide-react';

interface TeachersTabProps {
    teachers: Teacher[];
    isMaster: boolean;
}

const TeachersTab: React.FC<TeachersTabProps> = ({ teachers, isMaster }) => {
    // React Query client for cache invalidation
    const queryClient = useQueryClient();

    // --- Local State ---
    const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
    const [teacherSubjectFilter, setTeacherSubjectFilter] = useState<'all' | 'math' | 'english'>('all');

    // New Teacher Form
    const [newTeacherName, setNewTeacherName] = useState('');
    const [newTeacherSubjects, setNewTeacherSubjects] = useState<string[]>([]);

    // Edit Teacher State
    const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
    const [editTeacherName, setEditTeacherName] = useState('');
    const [editTeacherSubjects, setEditTeacherSubjects] = useState<string[]>([]);
    const [editTeacherBgColor, setEditTeacherBgColor] = useState('#3b82f6');
    const [editTeacherTextColor, setEditTeacherTextColor] = useState('#ffffff');
    const [editTeacherDefaultRoom, setEditTeacherDefaultRoom] = useState('');
    const [editTeacherIsNative, setEditTeacherIsNative] = useState(false);

    // Drag and Drop
    const [draggedTeacherId, setDraggedTeacherId] = useState<string | null>(null);

    // --- Handlers ---
    const handleAddTeacher = async () => {
        if (!newTeacherName.trim()) return alert("강사 이름을 입력해주세요.");
        const name = newTeacherName.trim();
        try {
            const docRef = doc(db, '강사목록', name);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return alert("이미 존재하는 강사 이름입니다.");
            }
            await setDoc(docRef, {
                name: name,
                subjects: newTeacherSubjects.length > 0 ? newTeacherSubjects : ['math', 'english'],
                isHidden: false
            });
            setNewTeacherName('');
            setNewTeacherSubjects([]);
            queryClient.invalidateQueries({ queryKey: ['teachers'] });
        } catch (e) {
            console.error(e);
            alert("강사 추가 실패");
        }
    };

    const handleUpdateTeacher = async (id: string) => {
        if (!editTeacherName.trim()) return alert("강사 이름을 입력해주세요.");
        try {
            await setDoc(doc(db, '강사목록', id), {
                name: editTeacherName.trim(),
                subjects: editTeacherSubjects,
                bgColor: editTeacherBgColor,
                textColor: editTeacherTextColor,
                defaultRoom: editTeacherDefaultRoom || null,
                isNative: editTeacherIsNative,
            }, { merge: true });
            setEditingTeacherId(null);
            queryClient.invalidateQueries({ queryKey: ['teachers'] });
        } catch (e) {
            console.error(e);
            alert("수정 실패");
        }
    };

    const handleToggleVisibility = async (id: string, currentHidden: boolean) => {
        try {
            await setDoc(doc(db, '강사목록', id), { isHidden: !currentHidden }, { merge: true });
            queryClient.invalidateQueries({ queryKey: ['teachers'] });
        } catch (e) {
            console.error(e);
            alert("변경 실패");
        }
    };

    const handleDeleteTeacher = async (id: string, name: string) => {
        if (!confirm(`'${name}' 강사를 삭제하시겠습니까?`)) return;
        try {
            await deleteDoc(doc(db, '강사목록', id));
            queryClient.invalidateQueries({ queryKey: ['teachers'] });
        } catch (e) {
            console.error(e);
            alert("삭제 실패");
        }
    };

    // Drag and Drop Handlers
    const handleTeacherDragStart = (e: React.DragEvent, teacherId: string) => {
        setDraggedTeacherId(teacherId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', teacherId);
    };

    const handleTeacherDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleTeacherDrop = async (e: React.DragEvent, targetTeacherId: string) => {
        e.preventDefault();
        const sourceId = draggedTeacherId;
        if (!sourceId || sourceId === targetTeacherId) {
            setDraggedTeacherId(null);
            return;
        }

        const sortedTeachers = [...teachers].sort((a, b) => (a.order || 0) - (b.order || 0));
        const sourceIndex = sortedTeachers.findIndex(t => t.id === sourceId);
        const targetIndex = sortedTeachers.findIndex(t => t.id === targetTeacherId);

        if (sourceIndex === -1 || targetIndex === -1) {
            setDraggedTeacherId(null);
            return;
        }

        const reordered = [...sortedTeachers];
        const [removed] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, removed);

        try {
            const batch = writeBatch(db);
            reordered.forEach((teacher, index) => {
                batch.update(doc(db, '강사목록', teacher.id), { order: index });
            });
            await batch.commit();
            queryClient.invalidateQueries({ queryKey: ['teachers'] });
        } catch (e) {
            console.error(e);
            alert('순서 변경 실패');
        }
        setDraggedTeacherId(null);
    };

    if (!isMaster) return null;

    return (
        <div className="max-w-3xl mx-auto h-full flex flex-col pb-20">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="강사 검색..."
                        value={teacherSearchTerm}
                        onChange={(e) => setTeacherSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#fdb813] outline-none"
                    />
                </div>
                <div className="flex flex-col gap-2 items-end">
                    <div className="flex items-center gap-3 bg-gray-50 px-3 py-1 rounded-md border border-gray-200">
                        <span className="text-xs font-bold text-gray-500">표시할 시간표:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={newTeacherSubjects.includes('math')}
                                onChange={(e) => {
                                    if (e.target.checked) setNewTeacherSubjects([...newTeacherSubjects, 'math']);
                                    else setNewTeacherSubjects(newTeacherSubjects.filter(s => s !== 'math'));
                                }}
                                className="w-3.5 h-3.5 accent-[#081429]"
                            />
                            <span className="text-xs text-gray-700">수학</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={newTeacherSubjects.includes('english')}
                                onChange={(e) => {
                                    if (e.target.checked) setNewTeacherSubjects([...newTeacherSubjects, 'english']);
                                    else setNewTeacherSubjects(newTeacherSubjects.filter(s => s !== 'english'));
                                }}
                                className="w-3.5 h-3.5 accent-[#081429]"
                            />
                            <span className="text-xs text-gray-700">영어</span>
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={newTeacherName}
                            onChange={(e) => setNewTeacherName(e.target.value)}
                            placeholder="새 강사 이름"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#fdb813] outline-none w-48"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTeacher()}
                        />
                        <button
                            onClick={handleAddTeacher}
                            className="bg-[#081429] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#1e293b] flex items-center gap-1"
                        >
                            <Plus size={16} /> 추가
                        </button>
                    </div>
                </div>
            </div>

            {/* Subject Filter Tabs */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-gray-500">과목별 보기:</span>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button
                        onClick={() => setTeacherSubjectFilter('all')}
                        className={`px-3 py-1 text-xs font-bold rounded transition-all ${teacherSubjectFilter === 'all' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}
                    >
                        전체
                    </button>
                    <button
                        onClick={() => setTeacherSubjectFilter('math')}
                        className={`px-3 py-1 text-xs font-bold rounded transition-all ${teacherSubjectFilter === 'math' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                        수학
                    </button>
                    <button
                        onClick={() => setTeacherSubjectFilter('english')}
                        className={`px-3 py-1 text-xs font-bold rounded transition-all ${teacherSubjectFilter === 'english' ? 'bg-[#fdb813] text-[#081429] shadow-sm' : 'text-gray-500'}`}
                    >
                        영어
                    </button>
                </div>
            </div>

            {/* Teacher List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {teachers
                        .filter(t => t.name.toLowerCase().includes(teacherSearchTerm.toLowerCase()))
                        .filter(t => {
                            if (teacherSubjectFilter === 'all') return true;
                            return t.subjects?.includes(teacherSubjectFilter) || (!t.subjects && teacherSubjectFilter === 'math');
                        })
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map(teacher => (
                            <div
                                key={teacher.id}
                                className={`p-3 border border-gray-100 rounded-lg flex justify-between items-start hover:bg-gray-50 group transition-all cursor-move ${draggedTeacherId === teacher.id ? 'opacity-50 bg-blue-50 border-blue-300' : ''
                                    }`}
                                draggable
                                onDragStart={(e) => handleTeacherDragStart(e, teacher.id)}
                                onDragOver={handleTeacherDragOver}
                                onDrop={(e) => handleTeacherDrop(e, teacher.id)}
                                onDragEnd={() => setDraggedTeacherId(null)}
                            >
                                {editingTeacherId === teacher.id ? (
                                    <div className="flex flex-col gap-2 w-full">
                                        <div className="flex items-center gap-2 w-full">
                                            <input
                                                value={editTeacherName}
                                                onChange={(e) => setEditTeacherName(e.target.value)}
                                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:border-[#fdb813] outline-none"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleUpdateTeacher(teacher.id);
                                                    if (e.key === 'Escape') setEditingTeacherId(null);
                                                }}
                                            />
                                            <button onClick={() => handleUpdateTeacher(teacher.id)} className="text-green-600 p-1.5 hover:bg-green-50 rounded bg-white border border-gray-200"><Check size={14} /></button>
                                            <button onClick={() => setEditingTeacherId(null)} className="text-red-500 p-1.5 hover:bg-red-50 rounded bg-white border border-gray-200"><X size={14} /></button>
                                        </div>
                                        <div className="flex items-center gap-3 px-1">
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editTeacherSubjects.includes('math')}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setEditTeacherSubjects([...editTeacherSubjects, 'math']);
                                                        else setEditTeacherSubjects(editTeacherSubjects.filter(s => s !== 'math'));
                                                    }}
                                                    className="w-3 h-3 accent-[#081429]"
                                                />
                                                <span className="text-[10px] text-gray-600">수학</span>
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editTeacherSubjects.includes('english')}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setEditTeacherSubjects([...editTeacherSubjects, 'english']);
                                                        else setEditTeacherSubjects(editTeacherSubjects.filter(s => s !== 'english'));
                                                    }}
                                                    className="w-3 h-3 accent-[#081429]"
                                                />
                                                <span className="text-[10px] text-gray-600">영어</span>
                                            </label>
                                        </div>
                                        <div className="flex items-center gap-2 px-1 pt-1">
                                            <span className="text-[10px] text-gray-500 font-medium">퍼스널 컬러:</span>
                                            <label className="flex items-center gap-1">
                                                <span className="text-[10px] text-gray-500">배경</span>
                                                <input
                                                    type="color"
                                                    value={editTeacherBgColor}
                                                    onChange={(e) => setEditTeacherBgColor(e.target.value)}
                                                    className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
                                                />
                                            </label>
                                            <label className="flex items-center gap-1">
                                                <span className="text-[10px] text-gray-500">글자</span>
                                                <input
                                                    type="color"
                                                    value={editTeacherTextColor}
                                                    onChange={(e) => setEditTeacherTextColor(e.target.value)}
                                                    className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
                                                />
                                            </label>
                                            <div
                                                className="px-2 py-0.5 rounded text-[10px] font-bold border"
                                                style={{ backgroundColor: editTeacherBgColor, color: editTeacherTextColor, borderColor: editTeacherBgColor }}
                                            >
                                                미리보기
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 px-1 pt-1">
                                            <span className="text-[10px] text-gray-500 font-medium">🏫 고정 강의실:</span>
                                            <input
                                                type="text"
                                                value={editTeacherDefaultRoom}
                                                onChange={(e) => setEditTeacherDefaultRoom(e.target.value)}
                                                placeholder="예: 601"
                                                className="flex-1 max-w-[100px] px-2 py-1 border border-gray-200 rounded text-[10px] focus:border-[#fdb813] outline-none"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 px-1 pt-1">
                                            <span className="text-[10px] text-gray-500 font-medium">🌐 원어민 강사:</span>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editTeacherIsNative}
                                                    onChange={(e) => setEditTeacherIsNative(e.target.checked)}
                                                    className="w-3.5 h-3.5 accent-green-600"
                                                />
                                                <span className="text-[10px] text-gray-600">{editTeacherIsNative ? '예' : '아니오'}</span>
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-gray-700">{teacher.name}</span>
                                            <div className="flex gap-1 items-center">
                                                {(!teacher.subjects || teacher.subjects.includes('math')) && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-medium">수학</span>}
                                                {(!teacher.subjects || teacher.subjects.includes('english')) && <span className="text-[10px] bg-[#fff8e1] text-[#b45309] px-1.5 py-0.5 rounded border border-[#fef3c7] font-medium">영어</span>}
                                                {(teacher.bgColor || teacher.textColor) && (
                                                    <span
                                                        className="text-[9px] px-1.5 py-0.5 rounded font-bold ml-1"
                                                        style={{ backgroundColor: teacher.bgColor || '#3b82f6', color: teacher.textColor || '#ffffff' }}
                                                    >
                                                        컬러
                                                    </span>
                                                )}
                                                {teacher.defaultRoom && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 font-medium ml-1">
                                                        🏫 {teacher.defaultRoom}
                                                    </span>
                                                )}
                                                {teacher.isNative && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-medium ml-1">
                                                        🌐 원어민
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleToggleVisibility(teacher.id, !!teacher.isHidden)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                title={teacher.isHidden ? "시간표에 표시하기" : "시간표에서 숨기기"}
                                            >
                                                {teacher.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingTeacherId(teacher.id);
                                                    setEditTeacherName(teacher.name);
                                                    setEditTeacherSubjects(teacher.subjects || ['math', 'english']);
                                                    setEditTeacherBgColor(teacher.bgColor || '#3b82f6');
                                                    setEditTeacherTextColor(teacher.textColor || '#ffffff');
                                                    setEditTeacherDefaultRoom(teacher.defaultRoom || '');
                                                    setEditTeacherIsNative(teacher.isNative || false);
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    {teachers.length === 0 && (
                        <div className="col-span-full py-10 text-center text-gray-400 text-sm">등록된 강사가 없습니다.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeachersTab;
