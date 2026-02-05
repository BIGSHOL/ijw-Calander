import React, { useState, useMemo } from 'react';
import { X, BookOpen, Loader2, Plus, Search, AlertCircle, Clock, CheckCircle, Settings } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { UnifiedStudent, SubjectType } from '../../types';
import { useClasses } from '../../hooks/useClasses';
import { SUBJECT_LABELS, SUBJECT_COLORS } from '../../utils/styleUtils';
import { useQueryClient } from '@tanstack/react-query';
import { formatScheduleCompact, SubjectForSchedule } from '../Timetable/constants';

interface AssignClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: UnifiedStudent;
    onSuccess: () => void;
}

const AVAILABLE_SUBJECTS: SubjectType[] = ['math', 'english', 'science', 'korean'];

const AssignClassModal: React.FC<AssignClassModalProps> = ({ isOpen, onClose, student, onSuccess }) => {
    const queryClient = useQueryClient();
    const [selectedSubject, setSelectedSubject] = useState<SubjectType>('math');
    const [selectedClassName, setSelectedClassName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState(() => {
        // 기본값: 오늘 날짜
        return new Date().toISOString().split('T')[0];
    });
    const [isSlotTeacher, setIsSlotTeacher] = useState(false); // 부담임 여부 (주로 수학 과목)
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // 과목별 수업 목록 조회 (모든 과목)
    const { data: mathClasses, isLoading: loadingMath } = useClasses('math');
    const { data: englishClasses, isLoading: loadingEnglish } = useClasses('english');
    const { data: scienceClasses, isLoading: loadingScience } = useClasses('science');
    const { data: koreanClasses, isLoading: loadingKorean } = useClasses('korean');

    // 현재 선택된 과목의 수업 목록
    const currentClasses = selectedSubject === 'math' ? mathClasses
        : selectedSubject === 'english' ? englishClasses
        : selectedSubject === 'science' ? scienceClasses
        : koreanClasses;

    const isLoading = selectedSubject === 'math' ? loadingMath
        : selectedSubject === 'english' ? loadingEnglish
        : selectedSubject === 'science' ? loadingScience
        : loadingKorean;

    // 현재 과목의 활성 enrollment (배정 중 + 배정 예정)
    const activeEnrollments = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return student.enrollments
            .filter(e => e.subject === selectedSubject && !e.endDate)
            .map(e => ({
                ...e,
                isScheduled: e.startDate && e.startDate > today  // 배정 예정 여부
            }));
    }, [student.enrollments, selectedSubject]);

    // 이미 배정된 수업 필터링 + 검색어 필터링
    const availableClasses = useMemo(() => {
        if (!currentClasses) return [];

        // 활성 enrollment만 필터링 (endDate가 없는 것 = 현재 배정 중 또는 배정 예정)
        const activeEnrolledClassNames = activeEnrollments.map(e => e.className);

        let filtered = currentClasses.filter(cls => !activeEnrolledClassNames.includes(cls.className));

        // 검색어 필터링
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(cls =>
                cls.className.toLowerCase().includes(query) ||
                cls.teacher.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [currentClasses, activeEnrollments, searchQuery]);

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
                classId: selectedClass.id,
                subject: selectedSubject,
                className: selectedClass.className,
                staffId: selectedClass.teacher, // Staff document ID
                teacher: selectedClass.teacher, // 호환성
                schedule: selectedClass.schedule || [],
                days: [], // 기본값 (나중에 수정 가능)
                period: null,
                room: null,
                startDate: startDate, // YYYY-MM-DD 문자열
                endDate: null, // 배정 취소 시 업데이트
                color: null,
                isSlotTeacher: isSlotTeacher, // 부담임 여부 (수학 과목용)
                createdAt: Timestamp.now(),
            });

            // 캐시 무효화
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });  // 시간표 대기 섹션 실시간 반영
            queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });     // 수학 시간표 실시간 반영
            queryClient.invalidateQueries({ queryKey: ['attendanceStudents'] });    // 출석부 실시간 반영

            // 성공 처리
            onSuccess();
            onClose();

            // 폼 초기화
            setSelectedClassName('');
            setIsSlotTeacher(false);
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
        setSearchQuery('');
        setStartDate(new Date().toISOString().split('T')[0]); // 날짜 초기화
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={handleClose}>
            <div
                className="bg-white rounded-sm shadow-2xl w-[420px] max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Compact */}
                <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-[#081429] text-white rounded-t-sm shrink-0">
                    <div className="flex items-center gap-1.5">
                        <BookOpen size={16} />
                        <h3 className="font-bold text-sm">수업 배정</h3>
                        <span className="text-xs text-white/60">· {student.name}</span>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="text-white/70 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content - Compact */}
                <div className="p-3 flex-1 overflow-y-auto">
                    {error && (
                        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-sm text-xs text-red-800">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3">
                        {/* Section 1: 수업 선택 */}
                        <div className="space-y-2.5">
                            {/* Section Header */}
                            <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-200">
                                <BookOpen size={14} className="text-[#fdb813]" />
                                <h4 className="text-xs font-bold text-gray-900">수업 선택</h4>
                            </div>

                            {/* 과목 선택 - Compact */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    과목 <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {AVAILABLE_SUBJECTS.map(subject => {
                                        const colors = SUBJECT_COLORS[subject];
                                        return (
                                            <button
                                                key={subject}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedSubject(subject);
                                                    setSelectedClassName('');
                                                    setSearchQuery('');
                                                }}
                                                className={`py-1.5 rounded-sm text-xs font-bold transition-colors ${selectedSubject === subject
                                                    ? `shadow-sm text-white`
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                                style={selectedSubject === subject ? {
                                                    backgroundColor: colors.bg,
                                                    color: colors.text
                                                } : undefined}
                                            >
                                                {SUBJECT_LABELS[subject]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 수업 검색 */}
                            <div>
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="수업명 또는 강사명 검색..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813]"
                                    />
                                </div>
                            </div>

                            {/* 수업 선택 목록 - Compact */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    수업 목록 <span className="text-red-500">*</span>
                                </label>

                                {isLoading ? (
                                    <div className="flex items-center justify-center py-6 text-gray-500">
                                        <Loader2 size={16} className="animate-spin mr-1.5" />
                                        <span className="text-xs">로딩 중...</span>
                                    </div>
                                ) : availableClasses.length === 0 ? (
                                    <div className="p-3 text-center text-gray-500 text-xs bg-gray-50 rounded-sm border border-gray-200">
                                        {searchQuery ? '검색 결과가 없습니다' : '배정 가능한 수업이 없습니다'}
                                    </div>
                                ) : (
                                    <div className="max-h-[220px] overflow-y-auto border border-gray-300 rounded-sm">
                                        {availableClasses.map((cls) => {
                                            const subjectForSchedule: SubjectForSchedule = selectedSubject === 'english' ? 'english' : 'math';
                                            const scheduleText = formatScheduleCompact(cls.schedule || [], subjectForSchedule, false);

                                            return (
                                                <label
                                                    key={cls.id}
                                                    className={`flex items-center gap-2 p-2 border-b last:border-b-0 cursor-pointer transition-colors ${selectedClassName === cls.className
                                                            ? 'bg-[#fdb813]/10 border-l-2 border-l-[#fdb813]'
                                                            : 'hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="className"
                                                        value={cls.className}
                                                        checked={selectedClassName === cls.className}
                                                        onChange={(e) => setSelectedClassName(e.target.value)}
                                                        className="w-3.5 h-3.5 text-[#fdb813] focus:ring-[#fdb813]"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-xs text-[#081429] truncate">
                                                            {cls.className}
                                                        </div>
                                                        <div className="text-xxs text-gray-600 mt-0.5">
                                                            {cls.teacher} · {cls.studentCount || 0}명
                                                        </div>
                                                        {cls.schedule && cls.schedule.length > 0 && (
                                                            <div className="text-xxs text-gray-500 mt-0.5 truncate">
                                                                📅 {scheduleText}
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 2: 배정 설정 */}
                        <div className="space-y-2.5">
                            {/* Section Header */}
                            <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-200">
                                <Settings size={14} className="text-[#fdb813]" />
                                <h4 className="text-xs font-bold text-gray-900">배정 설정</h4>
                            </div>

                            {/* 수업 시작일 선택 */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    수업 시작일 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813]"
                                />
                                <p className="mt-1 text-xxs text-gray-500">
                                    미래 날짜를 선택하면 해당 날짜부터 수업이 시작됩니다
                                </p>
                            </div>

                            {/* 부담임 여부 (수학 과목 전용) */}
                            {selectedSubject === 'math' && (
                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        id="isSlotTeacher"
                                        checked={isSlotTeacher}
                                        onChange={(e) => setIsSlotTeacher(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 text-[#fdb813] bg-gray-100 border-gray-300 rounded-sm focus:ring-[#fdb813] focus:ring-2"
                                    />
                                    <label htmlFor="isSlotTeacher" className="flex-1 cursor-pointer">
                                        <div className="text-xs font-bold text-gray-700">부담임으로 배정</div>
                                        <p className="text-xxs text-gray-500 mt-0.5">
                                            별도 수업으로 생성된 부담임 수업인 경우 체크
                                        </p>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Section 3: 현재 배정 */}
                        {activeEnrollments.length > 0 && (
                            <div className="space-y-2.5">
                                {/* Section Header */}
                                <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-200">
                                    <CheckCircle size={14} className="text-[#fdb813]" />
                                    <h4 className="text-xs font-bold text-gray-900">현재 배정</h4>
                                </div>

                                {/* 이미 배정된 수업 안내 */}
                                <div className="p-2 bg-amber-50 border border-amber-200 rounded-sm">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <AlertCircle size={12} className="text-amber-600" />
                                        <span className="text-xs font-bold text-amber-800">활성 수업</span>
                                    </div>
                                    <div className="space-y-1">
                                        {activeEnrollments.map((e, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 text-xxs text-amber-700">
                                                {e.isScheduled ? (
                                                    <Clock size={10} className="text-blue-500" />
                                                ) : (
                                                    <CheckCircle size={10} className="text-green-500" />
                                                )}
                                                <span className="font-medium">{e.className}</span>
                                                {e.isScheduled && (
                                                    <span className="text-blue-600">({e.startDate} 배정 예정)</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer Buttons - Compact */}
                        <div className="flex gap-1.5 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-sm text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedClassName}
                                className="flex-1 px-3 py-2 bg-[#fdb813] text-[#081429] rounded-sm text-xs font-bold hover:bg-[#fdb813]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>배정 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus size={14} />
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
