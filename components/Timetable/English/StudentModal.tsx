// StudentModal.tsx - 영어 통합 뷰 학생 관리 모달
import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Users, Check, Underline } from 'lucide-react';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { TimetableStudent, EnglishLevel } from '../../../types';
import { DEFAULT_ENGLISH_LEVELS, parseClassName } from './englishUtils';

interface StudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    className: string;  // 수업명 (EnglishClassTab에서 전달)
    teacher?: string;   // 담당강사 (EnglishClassTab에서 전달)
}

const StudentModal: React.FC<StudentModalProps> = ({ isOpen, onClose, className, teacher }) => {
    // State
    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [classDocId, setClassDocId] = useState<string | null>(null);
    const [classTeacher, setClassTeacher] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [englishLevels, setEnglishLevels] = useState<EnglishLevel[]>(DEFAULT_ENGLISH_LEVELS);

    // Get full class name (e.g., PL5 -> Pre Let's 5)
    const fullClassName = useMemo(() => {
        const parsed = parseClassName(className);
        if (!parsed) return className;
        const level = englishLevels.find(l => l.abbreviation.toUpperCase() === parsed.levelAbbr.toUpperCase());
        return level ? `${level.fullName} ${parsed.number}${parsed.suffix}` : className;
    }, [className, englishLevels]);

    // Load english levels from settings
    useEffect(() => {
        const fetchLevels = async () => {
            const docSnap = await getDoc(doc(db, 'settings', 'english_levels'));
            if (docSnap.exists() && docSnap.data().levels) {
                setEnglishLevels(docSnap.data().levels);
            }
        };
        fetchLevels();
    }, []);

    // New student form
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentEnglishName, setNewStudentEnglishName] = useState('');
    const [newStudentGrade, setNewStudentGrade] = useState('');
    const [newStudentSchool, setNewStudentSchool] = useState('');
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', englishName: '', school: '', grade: '' });







    // Find class document by className, auto-create if not found
    useEffect(() => {
        if (!isOpen || !className) return;

        const findOrCreateClass = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, '수업목록'), where('className', '==', className));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    // Class exists
                    const docRef = snapshot.docs[0];
                    setClassDocId(docRef.id);
                    const data = docRef.data();
                    setStudents(data.studentList || []);
                    setClassTeacher(data.teacher || '');
                } else {
                    // Auto-create class
                    const { setDoc: setDocFn } = await import('firebase/firestore');
                    const newDocId = `영어_${className.replace(/\s/g, '_')}_${Date.now()}`;
                    const newClassData = {
                        id: newDocId,
                        className: className,
                        teacher: '',
                        subject: '영어',
                        room: '',
                        schedule: [],
                        studentList: [],
                        order: 999,  // 끝에 배치
                    };

                    await setDocFn(doc(db, '수업목록', newDocId), newClassData);
                    setClassDocId(newDocId);
                    setStudents([]);
                    setClassTeacher('');
                    console.log(`Auto-created class: ${className}`);
                }
            } catch (e) {
                console.error('Error finding/creating class:', e);
            }
            setLoading(false);
        };

        findOrCreateClass();
    }, [isOpen, className]);

    // Real-time sync when classDocId is available
    useEffect(() => {
        if (!classDocId) return;

        const unsub = onSnapshot(doc(db, '수업목록', classDocId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setStudents(data.studentList || []);
                setClassTeacher(data.teacher || '');
            }
        });

        return () => unsub();
    }, [classDocId]);

    // Add student
    // Add student
    // Add student
    const handleAddStudent = async (name: string, engName: string, grade: string, school: string) => {
        if (!classDocId || !name.trim()) return;

        const newStudent: TimetableStudent = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            englishName: engName.trim(),
            grade: grade.trim(),
            school: school.trim(),
        };

        const updatedList = [...students, newStudent];
        await updateDoc(doc(db, '수업목록', classDocId), {
            studentList: updatedList
        });
    };

    // Wrapper for manual input
    const handleAddStudentFromInput = async () => {
        if (!newStudentName.trim()) return;
        await handleAddStudent(newStudentName, newStudentEnglishName, newStudentGrade, newStudentSchool);

        // Reset manual inputs
        setNewStudentName('');
        setNewStudentEnglishName('');
        setNewStudentGrade('');
        setNewStudentSchool('');
    };



    // Remove student
    const handleRemoveStudent = async (studentId: string) => {
        if (!classDocId) return;
        if (!confirm('이 학생을 수업에서 제거하시겠습니까?')) return;

        const updatedList = students.filter(s => s.id !== studentId);
        try {
            await updateDoc(doc(db, '수업목록', classDocId), { studentList: updatedList });
        } catch (e) {
            console.error(e);
            alert('학생 제거 실패');
        }
    };

    // Delete all students
    const handleDeleteAll = async () => {
        if (!classDocId || students.length === 0) return;
        if (!confirm('모든 학생을 삭제하시겠습니까?')) return;

        try {
            await updateDoc(doc(db, '수업목록', classDocId), { studentList: [] });
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
    };

    // Toggle underline for a student
    const handleToggleUnderline = async (studentId: string) => {
        if (!classDocId) return;

        const updatedList = students.map(s => {
            if (s.id === studentId) {
                return { ...s, underline: !s.underline };
            }
            return s;
        });

        try {
            await updateDoc(doc(db, '수업목록', classDocId), { studentList: updatedList });
        } catch (e) {
            console.error(e);
        }
    };

    const startEditing = (student: TimetableStudent) => {
        setEditingStudentId(student.id);
        setEditForm({
            name: student.name,
            englishName: student.englishName || '',
            school: student.school || '',
            grade: student.grade || ''
        });
    };

    const cancelEditing = () => {
        setEditingStudentId(null);
        setEditForm({ name: '', englishName: '', school: '', grade: '' });
    };

    const saveEditing = async () => {
        if (!classDocId || !editingStudentId) return;

        const updatedList = students.map(s => {
            if (s.id === editingStudentId) {
                return {
                    ...s,
                    name: editForm.name,
                    englishName: editForm.englishName,
                    school: editForm.school,
                    grade: editForm.grade
                };
            }
            return s;
        });

        try {
            await updateDoc(doc(db, '수업목록', classDocId), { studentList: updatedList });
            setEditingStudentId(null);
        } catch (e) {
            console.error(e);
            alert('수정 실패');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header - Dark bar */}
                <div className="px-5 py-3 flex items-center justify-between bg-[#081429] text-white">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                        <Users size={18} className="text-[#fdb813]" />
                        {fullClassName} - 학생 관리
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Class Info Row */}
                <div className="px-5 py-2 border-b border-gray-200 flex items-center gap-2 text-sm">
                    <span className="text-gray-500">담당강사</span>
                    <span className="text-[#373d41] font-bold">{teacher || classTeacher || '-'}</span>
                    <span className="text-gray-300">|</span>
                    <span className="bg-[#fdb813] text-[#081429] px-2 py-0.5 rounded font-bold text-xs">
                        {students.length}명
                    </span>
                </div>

                {/* Add Student Section */}
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
                    {/* Manual Input Form */}
                    <div className="flex items-end gap-2">
                        <div className="flex-1 grid grid-cols-4 gap-2">
                            <div className="col-span-1">
                                <label className="text-[10px] text-gray-500 font-bold mb-1 block">이름</label>
                                <input
                                    type="text"
                                    placeholder="이름"
                                    value={newStudentName}
                                    onChange={(e) => setNewStudentName(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddStudentFromInput()}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="text-[10px] text-gray-500 font-bold mb-1 block">E.Name</label>
                                <input
                                    type="text"
                                    placeholder="영어이름"
                                    value={newStudentEnglishName}
                                    onChange={(e) => setNewStudentEnglishName(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddStudentFromInput()}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="text-[10px] text-gray-500 font-bold mb-1 block">학교</label>
                                <input
                                    type="text"
                                    placeholder="학교"
                                    value={newStudentSchool}
                                    onChange={(e) => setNewStudentSchool(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddStudentFromInput()}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="text-[10px] text-gray-500 font-bold mb-1 block">학년</label>
                                <input
                                    type="text"
                                    placeholder="학년"
                                    value={newStudentGrade}
                                    onChange={(e) => setNewStudentGrade(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddStudentFromInput()}
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleAddStudentFromInput}
                            disabled={!newStudentName.trim()}
                            className="px-3 py-1.5 bg-[#fdb813] text-[#081429] rounded font-bold text-xs hover:bg-[#e5a712] disabled:opacity-50 h-[34px] self-end"
                        >
                            추가
                        </button>
                    </div>
                </div>

                {/* Student List */}
                <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[150px] max-h-[300px]">
                    {loading ? (
                        <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
                    ) : !classDocId ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            <p>수업 정보를 찾을 수 없습니다.</p>
                            <p className="text-xs mt-1">'{className}'이(가) 수업목록에 등록되어 있는지 확인해주세요.</p>
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">등록된 학생이 없습니다.</div>
                    ) : (
                        <div className="space-y-1.5">
                            {[...students].sort((a, b) => {
                                // Underlined students first
                                if (a.underline && !b.underline) return -1;
                                if (!a.underline && b.underline) return 1;
                                // Then alphabetical
                                return a.name.localeCompare(b.name, 'ko');
                            }).map((student, idx) => (
                                <div
                                    key={student.id}
                                    className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors group ${editingStudentId === student.id ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 hover:bg-gray-100'}`}
                                >
                                    {editingStudentId === student.id ? (
                                        // Editing Mode
                                        <div className="flex items-center gap-2 w-full">
                                            <div className="flex-1 grid grid-cols-12 gap-2">
                                                <div className="col-span-3">
                                                    <input
                                                        value={editForm.name}
                                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                        className="w-full text-xs p-1 border rounded"
                                                        placeholder="이름"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        value={editForm.englishName}
                                                        onChange={e => setEditForm({ ...editForm, englishName: e.target.value })}
                                                        className="w-full text-xs p-1 border rounded"
                                                        placeholder="E.Name"
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    <input
                                                        value={editForm.school}
                                                        onChange={e => setEditForm({ ...editForm, school: e.target.value })}
                                                        className="w-full text-xs p-1 border rounded"
                                                        placeholder="학교"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        value={editForm.grade}
                                                        onChange={e => setEditForm({ ...editForm, grade: e.target.value })}
                                                        className="w-full text-xs p-1 border rounded text-center"
                                                        placeholder="N"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={saveEditing} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={cancelEditing} className="p-1 text-gray-400 hover:bg-gray-200 rounded">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // View Mode
                                        <>
                                            <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => startEditing(student)}>
                                                <span className="w-5 h-5 rounded-full bg-[#081429] text-[#fdb813] text-[10px] font-bold flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className={`font-bold text-sm ${student.underline ? 'underline text-blue-600' : 'text-[#373d41]'}`}>
                                                    {student.name}
                                                    {student.englishName && <span className={`font-normal ${student.underline ? 'text-blue-400' : 'text-gray-500'}`}>({student.englishName})</span>}
                                                </span>
                                                {(student.school || student.grade) && (
                                                    <span className="text-xs text-gray-400">
                                                        {student.school}{student.grade}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleToggleUnderline(student.id); }}
                                                    className={`p-1 rounded transition-colors ${student.underline ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50'}`}
                                                    title="밑줄 토글"
                                                >
                                                    <Underline size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveStudent(student.id); }}
                                                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <button
                        onClick={handleDeleteAll}
                        disabled={students.length === 0}
                        className="text-red-500 hover:text-red-600 font-bold text-sm flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={14} /> 삭제
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[#081429] text-white rounded-lg font-bold text-sm hover:bg-[#0a1a35] transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentModal;
