import React, { useState } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useCreateConsultation } from '../../hooks/useConsultationMutations';
import { ConsultationCategory, CATEGORY_CONFIG } from '../../types';
import { auth } from '../../firebaseConfig';

interface AddConsultationModalProps {
    onClose: () => void;
    onSuccess: () => void;
    preSelectedStudentId?: string;  // 학생 관리 탭에서 호출 시 자동 선택
}

/**
 * 새 상담 기록 추가 모달
 * - 학생 선택 (useStudents Hook 활용)
 * - 학부모/학생 상담 구분
 * - 후속 조치 설정
 */
const AddConsultationModal: React.FC<AddConsultationModalProps> = ({
    onClose,
    onSuccess,
    preSelectedStudentId,
}) => {
    const currentUser = auth.currentUser;
    const { students, loading: studentsLoading } = useStudents();
    const createConsultation = useCreateConsultation();

    // 폼 상태
    const [studentId, setStudentId] = useState(preSelectedStudentId || '');
    const [type, setType] = useState<'parent' | 'student'>('parent');
    const [category, setCategory] = useState<ConsultationCategory>('general');
    const [subject, setSubject] = useState<'math' | 'english' | 'all'>('all');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    // 학부모 상담 전용
    const [parentName, setParentName] = useState('');
    const [parentRelation, setParentRelation] = useState('');
    const [parentContact, setParentContact] = useState('');

    // 학생 상담 전용
    const [studentMood, setStudentMood] = useState<'positive' | 'neutral' | 'negative'>('neutral');

    // 후속 조치
    const [followUpNeeded, setFollowUpNeeded] = useState(false);
    const [followUpDate, setFollowUpDate] = useState('');

    const selectedStudent = students.find(s => s.id === studentId);

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

        if (followUpNeeded && !followUpDate) {
            alert('후속 조치 예정일을 입력해주세요.');
            return;
        }

        try {
            await createConsultation.mutateAsync({
                studentId,
                studentName: selectedStudent?.name || '',
                type,
                consultantId: currentUser?.uid || '',
                consultantName: currentUser?.displayName || currentUser?.email || '담당자',
                date,
                time: time || undefined,
                duration: duration ? parseInt(duration) : undefined,
                category,
                subject: subject || undefined,
                title,
                content,
                parentName: type === 'parent' ? parentName : undefined,
                parentRelation: type === 'parent' ? parentRelation : undefined,
                parentContact: type === 'parent' ? parentContact : undefined,
                studentMood: type === 'student' ? studentMood : undefined,
                followUpNeeded,
                followUpDate: followUpNeeded ? followUpDate : undefined,
                followUpDone: false,
                createdBy: user?.uid || '',
            });

            alert('상담 기록이 저장되었습니다.');
            onSuccess();
        } catch (error) {
            console.error('상담 기록 생성 실패:', error);
            alert('상담 기록 저장에 실패했습니다.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* 헤더 */}
                <div className="bg-[#081429] text-white px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                    <h2 className="text-xl font-bold">새 상담 기록</h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:text-gray-300"
                    >
                        ✕
                    </button>
                </div>

                {/* 폼 */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* 1. 기본 정보 */}
                    <section>
                        <h3 className="text-lg font-bold text-[#081429] mb-4">1. 기본 정보</h3>
                        <div className="space-y-4">
                            {/* 학생 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-[#373d41] mb-2">
                                    학생 선택 <span className="text-red-500">*</span>
                                </label>
                                {preSelectedStudentId ? (
                                    <div className="w-full border border-[#081429] bg-gray-50 rounded-lg px-3 py-2 text-[#373d41]">
                                        {selectedStudent?.name} ({selectedStudent?.grade || '학년 미정'})
                                    </div>
                                ) : (
                                    <select
                                        value={studentId}
                                        onChange={(e) => setStudentId(e.target.value)}
                                        className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                        required
                                        disabled={studentsLoading}
                                    >
                                        <option value="">학생을 선택하세요</option>
                                        {students.map(student => (
                                            <option key={student.id} value={student.id}>
                                                {student.name} ({student.grade || '학년 미정'})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* 상담 유형 */}
                            <div>
                                <label className="block text-sm font-medium text-[#373d41] mb-2">
                                    상담 유형 <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="parent"
                                            checked={type === 'parent'}
                                            onChange={(e) => setType(e.target.value as 'parent' | 'student')}
                                            className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                        />
                                        <span>👨‍👩‍👧 학부모 상담</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="student"
                                            checked={type === 'student'}
                                            onChange={(e) => setType(e.target.value as 'parent' | 'student')}
                                            className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                        />
                                        <span>👤 학생 상담</span>
                                    </label>
                                </div>
                            </div>

                            {/* 날짜/시간 */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-[#373d41] mb-2">
                                        날짜 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-[#373d41] mb-2">
                                        시간
                                    </label>
                                    <input
                                        type="time"
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                        className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-[#373d41] mb-2">
                                        소요 시간 (분)
                                    </label>
                                    <input
                                        type="number"
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                        placeholder="30"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. 상담 분류 */}
                    <section>
                        <h3 className="text-lg font-bold text-[#081429] mb-4">2. 상담 분류</h3>
                        <div className="space-y-4">
                            {/* 카테고리 */}
                            <div>
                                <label className="block text-sm font-medium text-[#373d41] mb-2">
                                    카테고리 <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as ConsultationCategory)}
                                    className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                    required
                                >
                                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>
                                            {config.icon} {config.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 관련 과목 */}
                            <div>
                                <label className="block text-sm font-medium text-[#373d41] mb-2">
                                    관련 과목
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="all"
                                            checked={subject === 'all'}
                                            onChange={(e) => setSubject(e.target.value as any)}
                                            className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                        />
                                        <span>전체</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="math"
                                            checked={subject === 'math'}
                                            onChange={(e) => setSubject(e.target.value as any)}
                                            className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                        />
                                        <span>수학</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="english"
                                            checked={subject === 'english'}
                                            onChange={(e) => setSubject(e.target.value as any)}
                                            className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                        />
                                        <span>영어</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 3. 학부모 정보 (학부모 상담 시) */}
                    {type === 'parent' && (
                        <section>
                            <h3 className="text-lg font-bold text-[#081429] mb-4">3. 학부모 정보</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[#373d41] mb-2">
                                            학부모 이름
                                        </label>
                                        <input
                                            type="text"
                                            value={parentName}
                                            onChange={(e) => setParentName(e.target.value)}
                                            className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                            placeholder="홍길동"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#373d41] mb-2">
                                            관계
                                        </label>
                                        <select
                                            value={parentRelation}
                                            onChange={(e) => setParentRelation(e.target.value)}
                                            className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                        >
                                            <option value="">선택</option>
                                            <option value="부">부</option>
                                            <option value="모">모</option>
                                            <option value="조부">조부</option>
                                            <option value="조모">조모</option>
                                            <option value="기타">기타</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[#373d41] mb-2">
                                        연락처
                                    </label>
                                    <input
                                        type="tel"
                                        value={parentContact}
                                        onChange={(e) => setParentContact(e.target.value)}
                                        className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                        placeholder="010-1234-5678"
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* 3. 학생 컨디션 (학생 상담 시) */}
                    {type === 'student' && (
                        <section>
                            <h3 className="text-lg font-bold text-[#081429] mb-4">3. 학생 컨디션</h3>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="positive"
                                        checked={studentMood === 'positive'}
                                        onChange={(e) => setStudentMood(e.target.value as any)}
                                        className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                    />
                                    <span>😊 긍정적</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="neutral"
                                        checked={studentMood === 'neutral'}
                                        onChange={(e) => setStudentMood(e.target.value as any)}
                                        className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                    />
                                    <span>😐 보통</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="negative"
                                        checked={studentMood === 'negative'}
                                        onChange={(e) => setStudentMood(e.target.value as any)}
                                        className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                                    />
                                    <span>😔 부정적</span>
                                </label>
                            </div>
                        </section>
                    )}

                    {/* 4. 상담 내용 */}
                    <section>
                        <h3 className="text-lg font-bold text-[#081429] mb-4">4. 상담 내용</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[#373d41] mb-2">
                                    제목 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                    placeholder="상담 제목을 입력하세요"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#373d41] mb-2">
                                    내용 <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                    rows={8}
                                    placeholder="상담 내용을 자세히 입력하세요"
                                    required
                                />
                            </div>
                        </div>
                    </section>

                    {/* 5. 후속 조치 */}
                    <section>
                        <h3 className="text-lg font-bold text-[#081429] mb-4">5. 후속 조치</h3>
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={followUpNeeded}
                                    onChange={(e) => setFollowUpNeeded(e.target.checked)}
                                    className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813] rounded"
                                />
                                <span className="text-sm font-medium text-[#373d41]">
                                    후속 조치 필요
                                </span>
                            </label>

                            {followUpNeeded && (
                                <div>
                                    <label className="block text-sm font-medium text-[#373d41] mb-2">
                                        예정일 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={followUpDate}
                                        onChange={(e) => setFollowUpDate(e.target.value)}
                                        className="w-full border border-[#081429] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                        required={followUpNeeded}
                                    />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 버튼 */}
                    <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="border border-[#081429] text-[#081429] px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={createConsultation.isPending}
                            className="bg-[#fdb813] text-[#081429] px-6 py-2 rounded-lg font-semibold hover:bg-[#e5a711] transition-colors disabled:opacity-50"
                        >
                            {createConsultation.isPending ? '저장 중...' : '저장하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddConsultationModal;
