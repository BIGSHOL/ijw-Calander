import React, { useState, useMemo } from 'react';
import { X, Search, UserPlus, Check, Target, BookOpen } from 'lucide-react';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { formatSchoolGrade } from '../../../utils/studentUtils';
import { useQueryClient } from '@tanstack/react-query';

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
        subject?: 'math' | 'english';
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
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [enrollmentType, setEnrollmentType] = useState<'regular' | 'temporary'>('temporary');

    // 섹션별 학생 분류
    const { currentStudents, teacherStudents, otherStudents } = useMemo(() => {
        const current: StudentInfo[] = [];
        const teacher: StudentInfo[] = [];
        const other: StudentInfo[] = [];

        allStudents.forEach(student => {
            // 1. 현재 출석부에 있는 학생
            if (existingStudentIds.includes(student.id)) {
                current.push(student);
            }
            // 2. 현재 선생님의 수업에 등록된 학생 (출석부에는 없음)
            else if (student.enrollments?.some(e =>
                e.staffId === currentStaffId &&
                e.subject === currentSubject
            )) {
                teacher.push(student);
            }
            // 3. 나머지 학생
            else {
                other.push(student);
            }
        });

        return {
            currentStudents: current,
            teacherStudents: teacher,
            otherStudents: other
        };
    }, [allStudents, existingStudentIds, currentStaffId, currentSubject]);

    // 검색 필터 적용
    const applySearch = (students: StudentInfo[]) => {
        if (!searchQuery.trim()) return students;
        const query = searchQuery.toLowerCase();
        return students.filter(s =>
            (s.name || '').toLowerCase().includes(query) ||
            s.englishName?.toLowerCase().includes(query) ||
            s.school?.toLowerCase().includes(query)
        );
    };

    const filteredCurrent = useMemo(() => applySearch(currentStudents), [currentStudents, searchQuery]);
    const filteredTeacher = useMemo(() => applySearch(teacherStudents), [teacherStudents, searchQuery]);
    const filteredOther = useMemo(() => applySearch(otherStudents), [otherStudents, searchQuery]);

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

            // 캐시 무효화 - 출석부 실시간 반영
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['attendanceStudents'] });
            queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });
            queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });

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
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh]" onClick={onClose}>
            <div
                className="bg-white rounded-sm shadow-xl w-full max-w-lg h-[600px] flex flex-col overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 닫기 버튼 */}
                <div className="absolute top-2 right-2 z-10">
                    <button
                        onClick={onClose}
                        className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-gray-200">
                    <h3 className="text-base font-bold text-primary flex items-center gap-2">
                        <UserPlus size={18} />
                        학생 추가
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 ml-[26px]">
                        {currentTeacherName} 선생님 • {currentSubject === 'math' ? '수학' : '영어'} 출석부
                    </p>
                </div>

                {/* Search & Filters */}
                <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="relative mb-2">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="학생 이름, 학교로 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    {/* Enrollment Type */}
                    <div className="flex gap-2">
                        <button
                            className={`flex-1 py-1 text-xs font-medium rounded-sm border transition-colors ${enrollmentType === 'temporary'
                                ? 'bg-amber-100 border-amber-300 text-amber-800'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            onClick={() => setEnrollmentType('temporary')}
                        >
                            <Target className="inline-block w-3.5 h-3.5 mr-1" />
                            특강/보강
                        </button>
                        <button
                            className={`flex-1 py-1 text-xs font-medium rounded-sm border transition-colors ${enrollmentType === 'regular'
                                ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            onClick={() => setEnrollmentType('regular')}
                        >
                            <BookOpen className="inline-block w-3.5 h-3.5 mr-1" />
                            정규 등록
                        </button>
                    </div>
                </div>

                {/* Student List - 섹션별 */}
                <div className="px-3 py-3 flex-1 overflow-y-auto custom-scrollbar">
                    {filteredCurrent.length === 0 && filteredTeacher.length === 0 && (searchQuery.trim() ? filteredOther.length === 0 : true) ? (
                        <div className="text-center py-12 text-gray-400">
                            {searchQuery.trim() ? (
                                <p className="text-xs">검색 결과가 없습니다.</p>
                            ) : (
                                <div>
                                    <p className="text-xs mb-1">담임 학생이 없습니다.</p>
                                    <p className="text-xxs text-gray-400">다른 학생을 추가하려면 검색을 사용하세요.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* 현재 출석부 학생 */}
                            {filteredCurrent.length > 0 && (
                                <div>
                                    <h4 className="text-[11px] font-bold text-gray-500 mb-1.5 px-1">
                                        현재 출석부 ({filteredCurrent.length}명)
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {filteredCurrent.map(student => (
                                            <StudentItem
                                                key={student.id}
                                                student={student}
                                                isSelected={false}
                                                onToggle={() => { }}
                                                disabled={true}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* 담임 학생 (우선 표시) */}
                            {filteredTeacher.length > 0 && (
                                <div>
                                    <h4 className="text-[11px] font-bold text-indigo-600 mb-1.5 px-1">
                                        담임 학생 ({filteredTeacher.length}명)
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {filteredTeacher.map(student => (
                                            <StudentItem
                                                key={student.id}
                                                student={student}
                                                isSelected={selectedStudentIds.has(student.id)}
                                                onToggle={() => toggleStudent(student.id)}
                                                disabled={false}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* 전체 학생 - 검색어가 있을 때만 표시 */}
                            {searchQuery.trim() && filteredOther.length > 0 && (
                                <div>
                                    <h4 className="text-[11px] font-bold text-gray-500 mb-1.5 px-1">
                                        검색 결과 ({filteredOther.length}명)
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {filteredOther.map(student => (
                                            <StudentItem
                                                key={student.id}
                                                student={student}
                                                isSelected={selectedStudentIds.has(student.id)}
                                                onToggle={() => toggleStudent(student.id)}
                                                disabled={false}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* 검색 안내 메시지 */}
                            {!searchQuery.trim() && filteredTeacher.length === 0 && filteredCurrent.length === 0 && (
                                <div className="text-center py-8">
                                    <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-xs text-gray-500">검색을 통해 다른 학생을 찾아보세요</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-medium">
                        {selectedStudentIds.size}명 선택됨
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={selectedStudentIds.size === 0 || isSubmitting}
                            className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-colors ${selectedStudentIds.size === 0 || isSubmitting
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

// StudentItem 컴포넌트
interface StudentItemProps {
    student: StudentInfo;
    isSelected: boolean;
    onToggle: () => void;
    disabled: boolean;
}

const StudentItem: React.FC<StudentItemProps> = ({ student, isSelected, onToggle, disabled }) => {
    return (
        <li
            onClick={disabled ? undefined : onToggle}
            className={`flex justify-between items-center p-2 rounded-sm border transition-all ${disabled
                ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                : isSelected
                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300 cursor-pointer'
                    : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-pointer'
                }`}
        >
            <div className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${disabled
                    ? 'border-gray-300 bg-gray-100'
                    : isSelected
                        ? 'bg-indigo-500 border-indigo-500'
                        : 'border-gray-300'
                    }`}>
                    {isSelected && <Check size={10} className="text-white" />}
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-800 leading-tight">
                        {student.name}
                        {student.englishName && (
                            <span className="ml-1 text-gray-500 font-normal">({student.englishName})</span>
                        )}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                        {formatSchoolGrade(student.school, student.grade)}
                    </p>
                </div>
            </div>
            {disabled && (
                <span className="text-[10px] text-gray-400 font-medium">이미 추가됨</span>
            )}
        </li>
    );
};

export default AddStudentToAttendanceModal;
