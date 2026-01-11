// MathStudentModal.tsx - 수학 시간표 학생 관리 모달 (영어 스타일 적용)
import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Check, Underline, Settings, UserPlus } from 'lucide-react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { TimetableStudent, TimetableClass } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';

interface MathStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    mathClass: TimetableClass | null;
    currentUser: any;
    onStudentsUpdated?: () => void;
}

const MathStudentModal: React.FC<MathStudentModalProps> = ({
    isOpen,
    onClose,
    mathClass,
    currentUser,
    onStudentsUpdated
}) => {
    // Permissions
    const { hasPermission } = usePermissions(currentUser);
    const canEdit = hasPermission('timetable.math.edit');

    // Local State
    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentSchool, setNewStudentSchool] = useState('');
    const [newStudentGrade, setNewStudentGrade] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [loading, setLoading] = useState(false);

    // Editing state
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', school: '', grade: '' });

    // Batch Management
    const [showBatchMenu, setShowBatchMenu] = useState(false);

    // Load students from mathClass
    useEffect(() => {
        if (mathClass?.studentList) {
            setStudents([...mathClass.studentList]);
            setHasChanges(false);
        } else {
            setStudents([]);
        }
    }, [mathClass]);

    // Real-time listener for the class document
    useEffect(() => {
        if (!mathClass?.id) return;

        const unsubscribe = onSnapshot(
            doc(db, '수업목록', mathClass.id),
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data.studentList) {
                        setStudents(data.studentList);
                    }
                }
            }
        );

        return () => unsubscribe();
    }, [mathClass?.id]);

    // Save changes to Firestore
    const handleSaveChanges = async () => {
        if (!mathClass?.id || !hasChanges) return;

        try {
            setLoading(true);
            await setDoc(doc(db, '수업목록', mathClass.id), {
                ...mathClass,
                studentList: students
            }, { merge: true });

            setHasChanges(false);
            onStudentsUpdated?.();
        } catch (error) {
            console.error('Failed to save students:', error);
            alert('학생 저장 실패');
        } finally {
            setLoading(false);
        }
    };

    // Add student
    const handleAddStudent = () => {
        if (!newStudentName.trim()) {
            alert('학생 이름을 입력해주세요.');
            return;
        }

        const newStudent: TimetableStudent = {
            id: `student_${Date.now()}`,
            name: newStudentName.trim(),
            school: newStudentSchool.trim() || undefined,
            grade: newStudentGrade.trim() || undefined
        };

        setStudents([...students, newStudent]);
        setNewStudentName('');
        setNewStudentSchool('');
        setNewStudentGrade('');
        setHasChanges(true);
    };

    // Remove student
    const handleRemoveStudent = (id: string) => {
        setStudents(students.filter(s => s.id !== id));
        setHasChanges(true);
    };

    // Update student
    const handleUpdateStudent = (id: string, updates: Partial<TimetableStudent>) => {
        setStudents(students.map(s => s.id === id ? { ...s, ...updates } : s));
        setHasChanges(true);
    };

    // Toggle underline
    const handleToggleUnderline = (id: string) => {
        const student = students.find(s => s.id === id);
        if (student) {
            handleUpdateStudent(id, { underline: !student.underline });
        }
    };

    // Inline editing
    const startEditing = (student: TimetableStudent) => {
        if (!canEdit) return;
        setEditingStudentId(student.id);
        setEditForm({
            name: student.name,
            school: student.school || '',
            grade: student.grade || ''
        });
    };

    const saveEditing = () => {
        if (!editingStudentId) return;
        handleUpdateStudent(editingStudentId, {
            name: editForm.name.trim(),
            school: editForm.school.trim() || undefined,
            grade: editForm.grade.trim() || undefined
        });
        setEditingStudentId(null);
    };

    const cancelEditing = () => {
        setEditingStudentId(null);
    };

    // Batch operations
    const handleDeleteAll = () => {
        if (!confirm('모든 학생을 삭제하시겠습니까?')) return;
        setStudents([]);
        setHasChanges(true);
        setShowBatchMenu(false);
    };

    const handleBatchGradePromotion = () => {
        if (!confirm('모든 학생의 학년을 1씩 올리시겠습니까?')) return;

        const updated = students.map(s => {
            if (!s.grade) return s;
            const match = s.grade.match(/(\d+)/);
            if (!match) return s;
            const num = parseInt(match[1], 10);
            const promoted = s.grade.replace(/\d+/, String(num + 1));
            return { ...s, grade: promoted };
        });

        setStudents(updated);
        setHasChanges(true);
        setShowBatchMenu(false);
    };

    // Sorted students (active first, then withdrawn)
    const sortedStudents = useMemo(() => {
        const active = students.filter(s => !s.withdrawalDate);
        const withdrawn = students.filter(s => s.withdrawalDate);
        return [...active, ...withdrawn];
    }, [students]);

    // Close handler
    const handleClose = () => {
        if (hasChanges) {
            if (!confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?')) return;
        }
        setHasChanges(false);
        setEditingStudentId(null);
        onClose();
    };

    if (!isOpen || !mathClass) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={handleClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-[#fdb813]/20 to-[#fdb813]/5">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">👨‍🎓</span>
                        <h2 className="text-lg font-extrabold text-[#081429]">{mathClass.className} - 학생 관리</h2>
                    </div>
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {canEdit && (
                            <button
                                onClick={() => setShowBatchMenu(!showBatchMenu)}
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                                title="일괄 관리"
                            >
                                <Settings size={18} />
                            </button>
                        )}
                        <button onClick={handleClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Batch Menu Dropdown */}
                    {showBatchMenu && canEdit && (
                        <div className="absolute top-14 right-4 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                            <button
                                onClick={handleBatchGradePromotion}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                            >
                                🎓 학년 진급
                            </button>
                            <button
                                onClick={handleDeleteAll}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                                🗑️ 전체 삭제
                            </button>
                        </div>
                    )}
                </div>

                {/* Sub Header */}
                <div className="px-5 py-2 border-b border-gray-200 flex items-center gap-2 text-sm">
                    <span className="text-gray-500">담당강사</span>
                    <span className="text-[#373d41] font-bold">{mathClass.teacher || '-'}</span>
                    <span className="text-gray-300">|</span>
                    <span className="bg-[#fdb813] text-[#081429] px-2 py-0.5 rounded font-bold text-xs">
                        {students.length}명
                    </span>
                    {hasChanges && (
                        <span className="ml-auto text-xs text-orange-500 font-bold">변경사항 있음</span>
                    )}
                </div>

                {/* Add Student Form - Only show if can edit */}
                {canEdit && (
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
                        <div className="flex items-end gap-2">
                            <div className="flex-1 grid grid-cols-3 gap-2">
                                <div className="col-span-1">
                                    <label className="text-xxs text-gray-500 font-bold mb-1 block">이름</label>
                                    <input
                                        type="text"
                                        placeholder="이름"
                                        value={newStudentName}
                                        onChange={(e) => setNewStudentName(e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-xxs text-gray-500 font-bold mb-1 block">학교</label>
                                    <input
                                        type="text"
                                        placeholder="학교"
                                        value={newStudentSchool}
                                        onChange={(e) => setNewStudentSchool(e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-xxs text-gray-500 font-bold mb-1 block">학년</label>
                                    <input
                                        type="text"
                                        placeholder="학년"
                                        value={newStudentGrade}
                                        onChange={(e) => setNewStudentGrade(e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleAddStudent}
                                disabled={!newStudentName.trim()}
                                className="px-4 py-1.5 bg-[#fdb813] text-[#081429] rounded font-bold text-sm hover:bg-[#e5a712] disabled:opacity-50 h-[34px] self-end"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                )}

                {/* Student List */}
                <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[150px] max-h-[350px]">
                    {loading ? (
                        <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">등록된 학생이 없습니다.</div>
                    ) : (
                        <div className="space-y-1.5">
                            {sortedStudents.map((student, idx) => (
                                <div
                                    key={student.id}
                                    className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors group ${editingStudentId === student.id
                                        ? 'bg-yellow-50 border border-yellow-200'
                                        : student.withdrawalDate
                                            ? 'bg-gray-100 opacity-50'
                                            : 'bg-gray-50 hover:bg-gray-100'
                                        }`}
                                >
                                    {editingStudentId === student.id ? (
                                        // Editing Mode
                                        <div className="flex items-center gap-2 w-full">
                                            <div className="flex-1 grid grid-cols-12 gap-2">
                                                <div className="col-span-4">
                                                    <input
                                                        value={editForm.name}
                                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                        className="w-full text-sm p-1.5 border rounded"
                                                        placeholder="이름"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="col-span-5">
                                                    <input
                                                        value={editForm.school}
                                                        onChange={e => setEditForm({ ...editForm, school: e.target.value })}
                                                        className="w-full text-sm p-1.5 border rounded"
                                                        placeholder="학교"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        value={editForm.grade}
                                                        onChange={e => setEditForm({ ...editForm, grade: e.target.value })}
                                                        className="w-full text-sm p-1.5 border rounded text-center"
                                                        placeholder="학년"
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
                                            <div
                                                className={`flex items-center gap-3 flex-1 ${canEdit ? 'cursor-pointer' : ''}`}
                                                onClick={() => startEditing(student)}
                                            >
                                                <span className="w-5 h-5 rounded-full bg-[#081429] text-[#fdb813] text-xxs font-bold flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className={`font-bold text-sm ${student.underline ? 'underline text-blue-600' : 'text-[#373d41]'}`}>
                                                    {student.name}
                                                </span>
                                                {(student.school || student.grade) && (
                                                    <span className="text-xs text-gray-400">
                                                        {student.school}{student.grade}
                                                    </span>
                                                )}
                                            </div>
                                            {canEdit && (
                                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleUnderline(student.id);
                                                        }}
                                                        className={`px-2 py-0.5 text-xxs rounded border transition-colors ${student.underline
                                                            ? 'bg-blue-500 text-white border-blue-500'
                                                            : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                                                            }`}
                                                        title="밑줄 토글"
                                                    >
                                                        <Underline size={12} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveStudent(student.id);
                                                        }}
                                                        className="px-2 py-0.5 text-xxs rounded border bg-white text-red-400 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                                                        title="삭제"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                    {canEdit ? (
                        <>
                            <button
                                onClick={handleDeleteAll}
                                className="flex items-center gap-1 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm"
                                disabled={students.length === 0}
                            >
                                <Trash2 size={14} /> 삭제
                            </button>
                            <div className="flex gap-2">
                                {hasChanges && (
                                    <button
                                        onClick={handleSaveChanges}
                                        disabled={loading}
                                        className="px-5 py-2 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:brightness-110 disabled:opacity-50"
                                    >
                                        {loading ? '저장 중...' : '저장'}
                                    </button>
                                )}
                                <button
                                    onClick={handleClose}
                                    className="px-5 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:brightness-110"
                                >
                                    닫기
                                </button>
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={handleClose}
                            className="ml-auto px-5 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:brightness-110"
                        >
                            닫기
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MathStudentModal;
