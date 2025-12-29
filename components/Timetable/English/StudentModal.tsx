// StudentModal.tsx - 영어 통합 뷰 학생 관리 모달
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Users } from 'lucide-react';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { TimetableStudent } from '../../../types';

interface StudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    className: string;  // 수업명 (EnglishClassTab에서 전달)
}

const StudentModal: React.FC<StudentModalProps> = ({ isOpen, onClose, className }) => {
    // State
    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [classDocId, setClassDocId] = useState<string | null>(null);
    const [classTeacher, setClassTeacher] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // New student form
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentGrade, setNewStudentGrade] = useState('');
    const [newStudentSchool, setNewStudentSchool] = useState('');

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
    const handleAddStudent = async () => {
        if (!classDocId || !newStudentName.trim()) {
            alert('학생 이름을 입력해주세요.');
            return;
        }

        const studentId = `student_${Date.now()}`;
        const newStudent: TimetableStudent = {
            id: studentId,
            name: newStudentName.trim(),
            grade: newStudentGrade.trim(),
            school: newStudentSchool.trim(),
        };

        const updatedList = [...students, newStudent];

        try {
            await updateDoc(doc(db, '수업목록', classDocId), { studentList: updatedList });
            setNewStudentName('');
            setNewStudentGrade('');
            setNewStudentSchool('');
        } catch (e) {
            console.error(e);
            alert('학생 추가 실패');
        }
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

                {/* Header - Dark bar */}
                <div className="px-5 py-3 flex items-center justify-between bg-[#081429] text-white">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                        <Users size={18} className="text-[#fdb813]" />
                        {className} - 학생 관리
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
                    <span className="text-[#373d41] font-bold">{classTeacher || '담당강사'}</span>
                    <span className="text-gray-300">|</span>
                    <span className="bg-[#fdb813] text-[#081429] px-2 py-0.5 rounded font-bold text-xs">
                        {students.length}
                    </span>
                </div>

                {/* Add Student Form - Single Row Style */}
                <div className="px-5 py-3 bg-white border-b border-gray-100">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            placeholder="학생 이름"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                        />
                        <input
                            type="text"
                            value={newStudentSchool}
                            onChange={(e) => setNewStudentSchool(e.target.value)}
                            placeholder="학교"
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                        />
                        <input
                            type="text"
                            value={newStudentGrade}
                            onChange={(e) => setNewStudentGrade(e.target.value)}
                            placeholder="학년"
                            className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                        />
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
                            {students.map((student, idx) => (
                                <div
                                    key={student.id}
                                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-5 h-5 rounded-full bg-[#081429] text-[#fdb813] text-[10px] font-bold flex items-center justify-center">
                                            {idx + 1}
                                        </span>
                                        <span className="font-bold text-sm text-[#373d41]">{student.name}</span>
                                        {(student.school || student.grade) && (
                                            <span className="text-xs text-gray-400">
                                                {student.school}{student.school && student.grade && ' · '}{student.grade}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRemoveStudent(student.id)}
                                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X size={14} />
                                    </button>
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
