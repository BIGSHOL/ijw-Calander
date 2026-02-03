import React, { useState, useMemo, useEffect } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useStaff } from '../../hooks/useStaff';
import { useCreateConsultation, useUpdateConsultation } from '../../hooks/useConsultationMutations';
import { Consultation, ConsultationCategory, CATEGORY_CONFIG, UserProfile } from '../../types';
import { X, Search, Loader2, User, Users, Clock, Calendar, MessageSquare, Edit2, FileText, BookOpen, AlertCircle } from 'lucide-react';
import { SUBJECT_COLORS } from '../../utils/styleUtils';

interface AddConsultationModalProps {
    onClose: () => void;
    onSuccess: () => void;
    preSelectedStudentId?: string;
    editingConsultation?: Consultation;
    userProfile?: UserProfile | null;
}

// 현재 시간을 HH:MM 형식으로 반환
const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const AddConsultationModal: React.FC<AddConsultationModalProps> = ({
    onClose,
    onSuccess,
    preSelectedStudentId,
    editingConsultation,
    userProfile,
}) => {
    const currentUser = userProfile ? {
        uid: userProfile.uid,
        displayName: userProfile.displayName,
        email: userProfile.email,
    } : null;
    const { students, loading: studentsLoading } = useStudents(true);
    const { staff } = useStaff();
    const createConsultation = useCreateConsultation();
    const updateConsultation = useUpdateConsultation();
    const isEditing = !!editingConsultation;

    // 학생 검색
    const [studentSearch, setStudentSearch] = useState('');
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);

    // 폼 상태
    const [studentId, setStudentId] = useState(editingConsultation?.studentId || preSelectedStudentId || '');
    const [consultantId, setConsultantId] = useState(editingConsultation?.consultantId || currentUser?.uid || '');
    const [type, setType] = useState<'parent' | 'student'>(editingConsultation?.type || 'parent');
    const [category, setCategory] = useState<ConsultationCategory>(editingConsultation?.category || 'general');
    const [subject, setSubject] = useState<'math' | 'english' | 'other'>(
        (editingConsultation?.subject === 'math' || editingConsultation?.subject === 'english')
            ? editingConsultation.subject
            : 'other'
    );
    const [date, setDate] = useState(editingConsultation?.date || new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(editingConsultation?.time || getCurrentTime());
    const [duration, setDuration] = useState(editingConsultation?.duration?.toString() || '30');
    const [title, setTitle] = useState(editingConsultation?.title || '');
    const [content, setContent] = useState(editingConsultation?.content || '');

    // 학부모 상담 전용
    const [parentName, setParentName] = useState(editingConsultation?.parentName || '');
    const [parentRelation, setParentRelation] = useState(editingConsultation?.parentRelation || '');

    // 학생 상담 전용
    const [studentMood, setStudentMood] = useState<'positive' | 'neutral' | 'negative'>(editingConsultation?.studentMood || 'neutral');

    // 후속 조치
    const [followUpNeeded, setFollowUpNeeded] = useState(editingConsultation?.followUpNeeded || false);
    const [followUpDate, setFollowUpDate] = useState(editingConsultation?.followUpDate || '');

    const selectedStudent = students.find(s => s.id === studentId);

    // 학생의 등록 과목 추출
    const studentSubjects = useMemo(() => {
        if (!selectedStudent?.enrollments) return [];
        return Array.from(new Set(selectedStudent.enrollments.map(e => e.subject)));
    }, [selectedStudent]);

    // 초기 consultantId 설정
    useEffect(() => {
        if (isEditing || !staff.length) return;
        const currentStaff = staff.find(s =>
            s.uid === currentUser?.uid ||
            s.email === currentUser?.email
        );
        if (currentStaff) {
            setConsultantId(currentStaff.id);
        }
    }, [staff, currentUser, isEditing]);

    // 과목에 따른 담당선생님 자동 선택
    useEffect(() => {
        if (isEditing) return;
        if (!studentId || !selectedStudent || !subject || subject === 'other') return;

        const enrollment = selectedStudent.enrollments?.find(e => e.subject === subject);
        if (enrollment?.staffId) {
            const teacher = staff.find(s => s.id === enrollment.staffId);
            if (teacher) {
                setConsultantId(teacher.id);
            }
        }
    }, [studentId, subject, selectedStudent, staff, isEditing]);

    // preSelectedStudentId가 있을 때 학생 검색창에 이름 표시
    useEffect(() => {
        const targetId = editingConsultation?.studentId || preSelectedStudentId;
        if (targetId && students.length > 0) {
            const student = students.find(s => s.id === targetId);
            if (student) {
                setStudentSearch(student.name);
            }
        }
    }, [preSelectedStudentId, editingConsultation, students]);

    // 학생 선택 시 과목 자동 설정
    useEffect(() => {
        if (isEditing) return;
        if (studentSubjects.length === 1) {
            setSubject(studentSubjects[0] as 'math' | 'english');
        } else if (studentSubjects.length === 0) {
            setSubject('other');
        }
    }, [studentSubjects, isEditing]);

    // 검색된 학생 목록
    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students.slice(0, 10);
        const query = studentSearch.toLowerCase();
        return students.filter(s =>
            (s.name || '').toLowerCase().includes(query) ||
            s.englishName?.toLowerCase().includes(query) ||
            s.school?.toLowerCase().includes(query)
        ).slice(0, 10);
    }, [students, studentSearch]);

    const handleSelectStudent = (student: typeof students[0]) => {
        setStudentId(student.id);
        setStudentSearch(student.name);
        setShowStudentDropdown(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!studentId) {
            alert('학생을 선택해주세요.');
            return;
        }

        if (!title.trim()) {
            alert('상담 제목을 입력해주세요.');
            return;
        }

        if (!content.trim()) {
            alert('상담 내용을 입력해주세요.');
            return;
        }

        try {
            const consultationData: Record<string, any> = {
                studentId,
                studentName: selectedStudent?.name || editingConsultation?.studentName || '',
                type,
                consultantId: consultantId,
                consultantName: staff.find(s => s.id === consultantId)?.name || currentUser?.displayName || currentUser?.email || '담당자',
                date,
                category,
                title,
                content,
                followUpNeeded,
                followUpDone: isEditing ? editingConsultation?.followUpDone : false,
                createdBy: isEditing ? editingConsultation?.createdBy : (currentUser?.uid || ''),
            };

            if (time?.trim()) consultationData.time = time.trim();
            if (duration) consultationData.duration = parseInt(duration);
            if (subject !== 'other') consultationData.subject = subject;

            if (type === 'parent') {
                if (parentName?.trim()) consultationData.parentName = parentName.trim();
                if (parentRelation) consultationData.parentRelation = parentRelation;
            }

            if (type === 'student') {
                consultationData.studentMood = studentMood;
            }

            if (followUpNeeded && followUpDate) {
                consultationData.followUpDate = followUpDate;
            }

            if (isEditing && editingConsultation) {
                await updateConsultation.mutateAsync({
                    id: editingConsultation.id,
                    updates: consultationData,
                });
            } else {
                await createConsultation.mutateAsync(consultationData as any);
            }
            onSuccess();
        } catch (error) {
            console.error('상담 기록 저장 실패:', error);
            alert('상담 기록 저장에 실패했습니다.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
            <div
                className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
                    <h2 className="text-sm font-bold text-[#081429] flex items-center gap-2">
                        {isEditing ? <Edit2 className="w-4 h-4 text-[#fdb813]" /> : <MessageSquare className="w-4 h-4 text-[#fdb813]" />}
                        {isEditing ? '상담 기록 수정' : '새 상담 기록'}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* 폼 */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-2">
                    {/* Section 1: 학생 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <User className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">학생 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">학생 <span className="text-red-500">*</span></span>
                                {preSelectedStudentId ? (
                                    <div className="flex-1 bg-gray-50 border border-gray-200 px-2 py-1 text-xs text-gray-700 flex justify-between items-center">
                                        <span>{selectedStudent?.name} {selectedStudent?.grade ? `(${selectedStudent.grade})` : ''}</span>
                                        <span className="text-xxs text-gray-400">고정</span>
                                    </div>
                                ) : (
                                    <div className="flex-1 relative">
                                        <div className="relative">
                                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                value={studentSearch}
                                                onChange={(e) => {
                                                    setStudentSearch(e.target.value);
                                                    setShowStudentDropdown(true);
                                                    if (!e.target.value) setStudentId('');
                                                }}
                                                onFocus={() => setShowStudentDropdown(true)}
                                                placeholder="학생 이름 검색..."
                                                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                                disabled={studentsLoading}
                                            />
                                        </div>
                                        {showStudentDropdown && filteredStudents.length > 0 && (
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 shadow-lg max-h-36 overflow-y-auto">
                                                {filteredStudents.map(student => (
                                                    <button
                                                        key={student.id}
                                                        type="button"
                                                        onClick={() => handleSelectStudent(student)}
                                                        className={`w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${studentId === student.id ? 'bg-[#fdb813]/10' : ''}`}
                                                    >
                                                        <span className="font-medium text-gray-800">{student.name}</span>
                                                        <span className="text-xxs text-gray-500">
                                                            {student.grade || ''} {student.school || ''}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">유형</span>
                                <div className="flex gap-1 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => setType('parent')}
                                        className={`flex-1 py-1 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${type === 'parent'
                                            ? 'bg-[#081429] text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        <Users size={10} />
                                        학부모
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('student')}
                                        className={`flex-1 py-1 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${type === 'student'
                                            ? 'bg-[#081429] text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        <User size={10} />
                                        학생
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">카테고리</span>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as ConsultationCategory)}
                                    className="flex-1 text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none"
                                >
                                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>
                                            {config.icon} {config.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">과목</span>
                                <div className="flex gap-1 flex-1">
                                    {studentSubjects.length === 0 ? (
                                        <span className="text-xxs text-gray-400 py-0.5">등록 과목 없음</span>
                                    ) : (
                                        <>
                                            {studentSubjects.includes('math') && (
                                                <button type="button" onClick={() => setSubject('math')} className={`px-2 py-0.5 text-xxs font-medium rounded-sm transition-colors ${subject === 'math' ? SUBJECT_COLORS.math.badge : 'bg-[#fef9e7] text-[#081429] hover:bg-[#fdb813]/30'}`}>수학</button>
                                            )}
                                            {studentSubjects.includes('english') && (
                                                <button type="button" onClick={() => setSubject('english')} className={`px-2 py-0.5 text-xxs font-medium rounded-sm transition-colors ${subject === 'english' ? SUBJECT_COLORS.english.badge : 'bg-[#f0f4f8] text-[#081429] hover:bg-[#081429]/10'}`}>영어</button>
                                            )}
                                            {studentSubjects.length === 2 && (
                                                <button type="button" onClick={() => setSubject('other')} className={`px-2 py-0.5 text-xxs font-medium transition-colors ${subject === 'other' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>전체</button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">담당자</span>
                                <select
                                    value={consultantId}
                                    onChange={(e) => setConsultantId(e.target.value)}
                                    className="flex-1 text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none"
                                >
                                    {(() => {
                                        const currentStaff = staff.find(s =>
                                            s.uid === currentUser?.uid ||
                                            s.email === currentUser?.email
                                        );
                                        if (currentStaff) {
                                            const displayRole = currentStaff.systemRole?.toUpperCase() || currentStaff.role;
                                            return (
                                                <option value={currentStaff.id}>
                                                    {currentStaff.name} ({displayRole}) - 본인
                                                </option>
                                            );
                                        }
                                        return (
                                            <option value={currentUser?.uid || ''}>
                                                {currentUser?.displayName || '본인'} (Desk)
                                            </option>
                                        );
                                    })()}
                                    {staff
                                        .filter(s => s.uid !== currentUser?.uid && s.email !== currentUser?.email)
                                        .map(s => {
                                            const displayRole = s.systemRole?.toUpperCase() || s.role;
                                            return (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} {displayRole ? `(${displayRole})` : ''}
                                                </option>
                                            );
                                        })}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: 일시 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Clock className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">일시</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">날짜</span>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="flex-1 text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none max-w-[150px]"
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">시간</span>
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="flex-1 text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none max-w-[120px]"
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">소요(분)</span>
                                <input
                                    type="number"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="flex-1 text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none max-w-[80px]"
                                    placeholder="30"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: 학부모 정보 (학부모 상담 시) */}
                    {type === 'parent' && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <Users className="w-3 h-3 text-[#081429]" />
                                <h3 className="text-[#081429] font-bold text-xs">학부모 정보</h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">이름</span>
                                    <input
                                        type="text"
                                        value={parentName}
                                        onChange={(e) => setParentName(e.target.value)}
                                        className="flex-1 text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none"
                                        placeholder="홍길동"
                                    />
                                </div>
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">관계</span>
                                    <select
                                        value={parentRelation}
                                        onChange={(e) => setParentRelation(e.target.value)}
                                        className="flex-1 text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none max-w-[100px]"
                                    >
                                        <option value="">선택</option>
                                        <option value="부">부</option>
                                        <option value="모">모</option>
                                        <option value="조부모">조부모</option>
                                        <option value="기타">기타</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 3: 학생 컨디션 (학생 상담 시) */}
                    {type === 'student' && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <User className="w-3 h-3 text-[#081429]" />
                                <h3 className="text-[#081429] font-bold text-xs">학생 컨디션</h3>
                            </div>
                            <div className="flex gap-1 p-2">
                                {[
                                    { value: 'positive', label: '긍정적', color: 'green' },
                                    { value: 'neutral', label: '보통', color: 'gray' },
                                    { value: 'negative', label: '부정적', color: 'red' },
                                ].map(mood => (
                                    <button
                                        key={mood.value}
                                        type="button"
                                        onClick={() => setStudentMood(mood.value as any)}
                                        className={`flex-1 py-1 text-xs font-medium transition-colors ${studentMood === mood.value
                                            ? mood.color === 'green' ? 'bg-green-500 text-white'
                                                : mood.color === 'red' ? 'bg-red-500 text-white'
                                                    : 'bg-gray-500 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {mood.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Section 4: 상담 내용 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <FileText className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">상담 내용</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">제목 <span className="text-red-500">*</span></span>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="flex-1 text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none"
                                    placeholder="상담 제목을 입력하세요"
                                    required
                                />
                            </div>
                            <div className="px-2 py-1.5">
                                <span className="text-xs font-medium text-[#373d41] block mb-1">내용 <span className="text-red-500">*</span></span>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="w-full text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none resize-none"
                                    rows={4}
                                    placeholder="상담 내용을 입력하세요"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 5: 후속 조치 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <AlertCircle className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">후속 조치</h3>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={followUpNeeded}
                                    onChange={(e) => setFollowUpNeeded(e.target.checked)}
                                    className="w-3 h-3 text-[#fdb813] focus:ring-[#fdb813]"
                                />
                                <span className="text-xs font-medium text-[#373d41]">후속 조치 필요</span>
                            </label>
                            {followUpNeeded && (
                                <input
                                    type="date"
                                    value={followUpDate}
                                    onChange={(e) => setFollowUpDate(e.target.value)}
                                    className="flex-1 text-xs border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-[#fdb813] outline-none max-w-[150px]"
                                    required={followUpNeeded}
                                />
                            )}
                        </div>
                    </div>
                </form>

                {/* 푸터 */}
                <div className="px-3 py-2 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={(isEditing ? updateConsultation.isPending : createConsultation.isPending) || !studentId || !title || !content}
                        className="px-3 py-1.5 text-xs bg-[#fdb813] text-[#081429] font-semibold hover:bg-[#e5a60f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        {(isEditing ? updateConsultation.isPending : createConsultation.isPending) && <Loader2 size={12} className="animate-spin" />}
                        {isEditing ? '수정 저장' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddConsultationModal;
