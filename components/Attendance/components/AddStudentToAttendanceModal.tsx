import React, { useState, useMemo } from 'react';
import { X, Search, UserPlus, Check, Target, BookOpen } from 'lucide-react';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { formatSchoolGrade } from '../../../utils/studentUtils';

interface StudentInfo {
    id: string;
    name: string;
    englishName?: string;
    school?: string;
    grade?: string;
    enrollments?: Array<{
        staffId: string;
        classId: string;
        className: string;
    }>;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    allStudents: StudentInfo[];
    currentStaffId: string;
    currentTeacherName: string;
    currentSubject: 'math' | 'english'; // 현재 출석부 과목
    existingStudentIds: string[]; // Already in this teacher's attendance
    onStudentAdded: () => void; // Callback to refresh data
}

const AddStudentToAttendanceModal: React.FC<Props> = ({
    isOpen,
    onClose,
    allStudents,
    currentStaffId,
    currentTeacherName,
    currentSubject,
    existingStudentIds,
    onStudentAdded,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [enrollmentType, setEnrollmentType] = useState<'regular' | 'temporary'>('temporary');

    // Filter students: not already in teacher's attendance
    const availableStudents = useMemo(() => {
        return allStudents.filter(s => !existingStudentIds.includes(s.id));
    }, [allStudents, existingStudentIds]);

    // Apply search
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return availableStudents;
        const query = searchQuery.toLowerCase();
        return availableStudents.filter(s =>
            (s.name || '').toLowerCase().includes(query) ||
            s.englishName?.toLowerCase().includes(query) ||
            s.school?.toLowerCase().includes(query)
        );
    }, [availableStudents, searchQuery]);

    // Early return AFTER all hooks (React hooks rule)
    if (!isOpen) return null;

    const toggleStudent = (studentId: string) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) {
                next.delete(studentId);
            } else {
                next.add(studentId);
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        if (selectedStudentIds.size === 0) return;

        setIsSubmitting(true);
        const today = new Date().toISOString().split('T')[0];

        try {
            // Add enrollment to each selected student
            for (const studentId of selectedStudentIds) {
                const studentRef = doc(db, 'students', studentId);
                const newEnrollment = {
                    subject: currentSubject,
                    classId: `manual-${today}`,
                    className: enrollmentType === 'temporary' ? '특강/보강' : '직접등록',
                    staffId: currentStaffId,
                    teacher: currentStaffId,  // 호환성
                    days: [],
                    startDate: today,
                    endDate: enrollmentType === 'temporary' ? today : null,
                    type: enrollmentType,
                };

                await updateDoc(studentRef, {
                    enrollments: arrayUnion(newEnrollment),
                    updatedAt: new Date().toISOString(),
                });
            }

            onStudentAdded();
            onClose();
        } catch (error) {
            console.error('Error adding students:', error);
            alert('학생 추가 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-indigo-50 border-indigo-100">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-200 text-indigo-800">
                            <UserPlus size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-indigo-900">학생 추가</h3>
                            <p className="text-xs text-indigo-600">{currentTeacherName} 선생님 {currentSubject === 'math' ? '수학' : '영어'} 출석부</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/50 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="p-4 border-b bg-gray-50">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="학생 이름, 학교로 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    {/* Enrollment Type */}
                    <div className="flex gap-2 mt-3">
                        <button
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${enrollmentType === 'temporary'
                                ? 'bg-amber-100 border-amber-300 text-amber-800'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            onClick={() => setEnrollmentType('temporary')}
                        >
                            <Target className="inline-block w-4 h-4 mr-1" />
                            특강/보강 (1회)
                        </button>
                        <button
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${enrollmentType === 'regular'
                                ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            onClick={() => setEnrollmentType('regular')}
                        >
                            <BookOpen className="inline-block w-4 h-4 mr-1" />
                            정규 등록
                        </button>
                    </div>
                </div>

                {/* Student List */}
                <div className="p-4 max-h-[40vh] overflow-y-auto custom-scrollbar">
                    {filteredStudents.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <p className="text-sm">추가할 수 있는 학생이 없습니다.</p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {filteredStudents.map(student => {
                                const isSelected = selectedStudentIds.has(student.id);
                                return (
                                    <li
                                        key={student.id}
                                        onClick={() => toggleStudent(student.id)}
                                        className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                            ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300'
                                            : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'
                                                }`}>
                                                {isSelected && <Check size={12} className="text-white" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">
                                                    {student.name}
                                                    {student.englishName && (
                                                        <span className="ml-1 text-gray-500 font-normal">({student.englishName})</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {formatSchoolGrade(student.school, student.grade)}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        {selectedStudentIds.size}명 선택됨
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={selectedStudentIds.size === 0 || isSubmitting}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${selectedStudentIds.size === 0 || isSubmitting
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                        >
                            {isSubmitting ? '추가 중...' : `${selectedStudentIds.size}명 추가`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddStudentToAttendanceModal;
