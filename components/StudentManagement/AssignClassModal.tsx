import React, { useState, useMemo } from 'react';
import { X, BookOpen, Loader2, Plus } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { UnifiedStudent } from '../../types';
import { useClasses } from '../../hooks/useClasses';

interface AssignClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: UnifiedStudent;
    onSuccess: () => void;
}

const AssignClassModal: React.FC<AssignClassModalProps> = ({ isOpen, onClose, student, onSuccess }) => {
    const [selectedSubject, setSelectedSubject] = useState<'math' | 'english'>('math');
    const [selectedClassName, setSelectedClassName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // 과목별 수업 목록 조회
    const { data: mathClasses, isLoading: loadingMath } = useClasses('math');
    const { data: englishClasses, isLoading: loadingEnglish } = useClasses('english');

    // 현재 선택된 과목의 수업 목록
    const currentClasses = selectedSubject === 'math' ? mathClasses : englishClasses;
    const isLoading = selectedSubject === 'math' ? loadingMath : loadingEnglish;

    // 이미 배정된 수업 필터링
    const availableClasses = useMemo(() => {
        if (!currentClasses) return [];

        const enrolledClassNames = student.enrollments
            .filter(e => e.subject === selectedSubject)
            .map(e => e.className);

        return currentClasses.filter(cls => !enrolledClassNames.includes(cls.className));
    }, [currentClasses, student.enrollments, selectedSubject]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!selectedClassName) {
            setError('수업을 선택해주세요');
            return;
        }

        setIsSubmitting(true);

        try {
            // 선택된 수업 정보 가져오기
            const selectedClass = currentClasses?.find(c => c.className === selectedClassName);
            if (!selectedClass) {
                throw new Error('선택한 수업을 찾을 수 없습니다');
            }

            // enrollment ID 생성: timestamp 기반
            const enrollmentId = `enrollment_${Date.now()}`;

            // students/{studentId}/enrollments/{enrollmentId}에 추가
            await setDoc(doc(db, `students/${student.id}/enrollments`, enrollmentId), {
                classId: selectedClass.id, // [FIX] ID 저장 추가
                subject: selectedSubject,
                className: selectedClass.className,
                teacherId: selectedClass.teacher,
                schedule: selectedClass.schedule || [],
                days: [], // 기본값 (나중에 수정 가능)
                period: null,
                room: null,
                startDate: Timestamp.now(),
                endDate: null,
                color: null,
                createdAt: Timestamp.now(),
            });

            // 성공 처리
            onSuccess();
            onClose();

            // 폼 초기화
            setSelectedClassName('');
        } catch (err) {
            console.error('수업 배정 오류:', err);
            setError('수업 배정 중 오류가 발생했습니다');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (isSubmitting) return;
        setError('');
        setSelectedClassName('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[#081429] text-white rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <BookOpen size={20} />
                        <h3 className="font-bold text-base">수업 배정</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="text-white/70 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* 학생 정보 */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">학생</div>
                        <div className="font-bold text-base text-[#081429]">
                            {student.name} ({student.school} {student.grade})
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 과목 선택 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                과목 <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedSubject('math');
                                        setSelectedClassName('');
                                    }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${selectedSubject === 'math'
                                            ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    수학
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedSubject('english');
                                        setSelectedClassName('');
                                    }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${selectedSubject === 'english'
                                            ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    영어
                                </button>
                            </div>
                        </div>

                        {/* 수업 선택 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                수업 선택 <span className="text-red-500">*</span>
                            </label>

                            {isLoading ? (
                                <div className="flex items-center justify-center py-8 text-gray-500">
                                    <Loader2 size={20} className="animate-spin mr-2" />
                                    <span className="text-sm">수업 목록 로딩 중...</span>
                                </div>
                            ) : availableClasses.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
                                    <p>배정 가능한 수업이 없습니다</p>
                                    <p className="text-xs mt-1 text-gray-400">
                                        모든 수업에 이미 배정되었거나, 수업이 존재하지 않습니다
                                    </p>
                                </div>
                            ) : (
                                <div className="max-h-[300px] overflow-y-auto border border-gray-300 rounded-lg">
                                    {availableClasses.map((cls) => (
                                        <label
                                            key={cls.id}
                                            className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer transition-colors ${selectedClassName === cls.className
                                                    ? 'bg-[#fdb813]/10 border-l-4 border-l-[#fdb813]'
                                                    : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="className"
                                                value={cls.className}
                                                checked={selectedClassName === cls.className}
                                                onChange={(e) => setSelectedClassName(e.target.value)}
                                                className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                            />
                                            <div className="flex-1">
                                                <div className="font-bold text-sm text-[#081429]">
                                                    {cls.className}
                                                </div>
                                                <div className="text-xs text-gray-600 mt-0.5">
                                                    {cls.teacher} · 학생 {cls.studentCount}명
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex gap-2 mt-6">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedClassName}
                                className="flex-1 px-4 py-2.5 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:bg-[#fdb813]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>배정 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} />
                                        <span>수업 배정</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AssignClassModal;
