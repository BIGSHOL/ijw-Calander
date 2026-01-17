import React, { useState, useMemo, useEffect } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useStaff } from '../../hooks/useStaff'; // Added
import { useCreateConsultation, useUpdateConsultation } from '../../hooks/useConsultationMutations';
import { Consultation, ConsultationCategory, CATEGORY_CONFIG } from '../../types';
import { auth } from '../../firebaseConfig';
import { X, Search, Loader2, User, Users, Clock, Calendar, MessageSquare, Edit2 } from 'lucide-react';

interface AddConsultationModalProps {
    onClose: () => void;
    onSuccess: () => void;
    preSelectedStudentId?: string;
    editingConsultation?: Consultation;
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
}) => {
    const currentUser = auth.currentUser;
    const { students, loading: studentsLoading } = useStudents(true);
    const { staff } = useStaff();
    const createConsultation = useCreateConsultation();
    const updateConsultation = useUpdateConsultation();
    const isEditing = !!editingConsultation;

    // 학생 검색
    const [studentSearch, setStudentSearch] = useState('');
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);

    // 폼 상태 - 초기값 설정
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

    // 초기 consultantId 설정 (staff 로딩 후 본인 매칭)
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

    // 과목에 따른 담당선생님 자동 선택 (신규 작성 시에만 동작)
    useEffect(() => {
        if (isEditing) return; // 수정 모드에서는 자동 변경 방지
        if (!studentId || !selectedStudent || !subject || subject === 'other') return;

        const enrollment = selectedStudent.enrollments?.find(e => e.subject === subject);
        if (enrollment?.teacherId) {
            const teacher = staff.find(s => s.id === enrollment.teacherId || s.name === enrollment.teacherId);
            if (teacher) {
                setConsultantId(teacher.id);
            }
        }
    }, [studentId, subject, selectedStudent, staff, isEditing]);

    // preSelectedStudentId가 있을 때 학생 검색창에 이름 표시
    useEffect(() => {
        // 수정 모드일 때도 학생 이름 표시
        const targetId = editingConsultation?.studentId || preSelectedStudentId;
        if (targetId && students.length > 0) {
            const student = students.find(s => s.id === targetId);
            if (student) {
                setStudentSearch(student.name);
            }
        }
    }, [preSelectedStudentId, editingConsultation, students]);

    // 학생 선택 시 과목 자동 설정 (신규 작성 시에만)
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
            s.name.toLowerCase().includes(query) ||
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                        {isEditing ? <Edit2 className="w-5 h-5 text-[#fdb813]" /> : <MessageSquare className="w-5 h-5 text-[#fdb813]" />}
                        <h2 className="text-lg font-bold text-[#081429]">{isEditing ? '상담 기록 수정' : '새 상담 기록'}</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* 폼 */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* 학생 선택 (검색) */}
                    <div className="relative">
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            학생 <span className="text-red-500">*</span>
                        </label>
                        {/* 수정 모드 이거나 preSelectedStudentId가 있으면 잠금 처리 느낌, 하지만 수정 모드에서는 변경 가능하게? 아니면 고정? 요구사항 없으므로 변경 가능하게 둠. 단, 초기값은 세팅됨. */}
                        {/* preSelectedStudentId가 있을 때만 잠금 (특정 학생 컨텍스트에서 생성 시) */}
                        {preSelectedStudentId ? (
                            <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 flex justify-between items-center">
                                <span>{selectedStudent?.name} {selectedStudent?.grade ? `(${selectedStudent.grade})` : ''}</span>
                                <span className="text-xs text-gray-400">학생 고정</span>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] focus:outline-none"
                                        disabled={studentsLoading}
                                    />
                                </div>
                                {showStudentDropdown && filteredStudents.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {filteredStudents.map(student => (
                                            <button
                                                key={student.id}
                                                type="button"
                                                onClick={() => handleSelectStudent(student)}
                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${studentId === student.id ? 'bg-[#fdb813]/10' : ''
                                                    }`}
                                            >
                                                <span className="font-medium text-gray-800">{student.name}</span>
                                                <span className="text-xs text-gray-500">
                                                    {student.grade || ''} {student.school || ''}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ... (나머지 폼 필드) ... */}

                    {/* 상담 유형 + 카테고리 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">상담 유형</label>
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => setType('parent')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors ${type === 'parent'
                                        ? 'bg-[#081429] text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <Users size={12} />
                                    학부모
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('student')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors ${type === 'student'
                                        ? 'bg-[#081429] text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <User size={12} />
                                    학생
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">카테고리</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as ConsultationCategory)}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#fdb813] focus:outline-none"
                            >
                                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key}>
                                        {config.icon} {config.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 날짜/시간/소요시간 */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                <Calendar size={12} className="inline mr-1" />날짜
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-[#fdb813] focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                <Clock size={12} className="inline mr-1" />시간
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-[#fdb813] focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">소요(분)</label>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-[#fdb813] focus:outline-none"
                                placeholder="30"
                            />
                        </div>
                    </div>

                    {/* 관련 과목 (학생의 등록 과목만 표시) */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">관련 과목</label>
                        <div className="flex gap-2">
                            {studentSubjects.length === 0 ? (
                                <span className="text-xs text-gray-400 py-2">등록 과목 없음 (기타로 저장)</span>
                            ) : (
                                <>
                                    {studentSubjects.includes('math') && (
                                        <button
                                            type="button"
                                            onClick={() => setSubject('math')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${subject === 'math'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                }`}
                                        >
                                            수학
                                        </button>
                                    )}
                                    {studentSubjects.includes('english') && (
                                        <button
                                            type="button"
                                            onClick={() => setSubject('english')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${subject === 'english'
                                                ? 'bg-purple-500 text-white'
                                                : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                                                }`}
                                        >
                                            영어
                                        </button>
                                    )}
                                    {studentSubjects.length === 2 && (
                                        <button
                                            type="button"
                                            onClick={() => setSubject('other')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${subject === 'other'
                                                ? 'bg-gray-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            전체
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* 상담 담당자 */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">상담 담당자</label>
                        <select
                            value={consultantId}
                            onChange={(e) => setConsultantId(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#fdb813] focus:outline-none"
                        >
                            {/* 본인 옵션: staff에서 uid 또는 email로 매칭 */}
                            {(() => {
                                const currentStaff = staff.find(s =>
                                    s.uid === currentUser?.uid ||
                                    s.email === currentUser?.email
                                );
                                if (currentStaff) {
                                    // 본인이 staff에 등록되어 있으면 해당 정보 표시
                                    // systemRole이 있으면 우선 표시, 없으면 role 표시
                                    const displayRole = currentStaff.systemRole?.toUpperCase() || currentStaff.role;
                                    return (
                                        <option value={currentStaff.id}>
                                            {currentStaff.name} ({displayRole}) - 본인
                                        </option>
                                    );
                                }
                                // staff에 없으면 기본 표시
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

                    {/* 학부모 정보 (학부모 상담 시) */}
                    {type === 'parent' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">학부모 이름</label>
                                <input
                                    type="text"
                                    value={parentName}
                                    onChange={(e) => setParentName(e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#fdb813] focus:outline-none"
                                    placeholder="홍길동"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">관계</label>
                                <select
                                    value={parentRelation}
                                    onChange={(e) => setParentRelation(e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#fdb813] focus:outline-none"
                                >
                                    <option value="">선택</option>
                                    <option value="부">부</option>
                                    <option value="모">모</option>
                                    <option value="조부모">조부모</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* 학생 컨디션 (학생 상담 시) */}
                    {type === 'student' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">학생 컨디션</label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'positive', label: '😊 긍정적', color: 'green' },
                                    { value: 'neutral', label: '😐 보통', color: 'gray' },
                                    { value: 'negative', label: '😔 부정적', color: 'red' },
                                ].map(mood => (
                                    <button
                                        key={mood.value}
                                        type="button"
                                        onClick={() => setStudentMood(mood.value as any)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${studentMood === mood.value
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

                    {/* 제목 */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            제목 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#fdb813] focus:outline-none"
                            placeholder="상담 제목을 입력하세요"
                            required
                        />
                    </div>

                    {/* 내용 */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            내용 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#fdb813] focus:outline-none resize-none"
                            rows={4}
                            placeholder="상담 내용을 입력하세요"
                            required
                        />
                    </div>

                    {/* 후속 조치 */}
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={followUpNeeded}
                                onChange={(e) => setFollowUpNeeded(e.target.checked)}
                                className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813] rounded"
                            />
                            <span className="text-xs font-medium text-gray-600">후속 조치 필요</span>
                        </label>
                        {followUpNeeded && (
                            <input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#fdb813] focus:outline-none"
                                required={followUpNeeded}
                            />
                        )}
                    </div>
                </form>

                {/* 푸터 */}
                <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={(isEditing ? updateConsultation.isPending : createConsultation.isPending) || !studentId || !title || !content}
                        className="px-4 py-2 text-sm bg-[#fdb813] text-[#081429] font-semibold rounded-lg hover:bg-[#e5a711] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {(isEditing ? updateConsultation.isPending : createConsultation.isPending) && <Loader2 size={14} className="animate-spin" />}
                        {isEditing ? '수정 저장' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddConsultationModal;
