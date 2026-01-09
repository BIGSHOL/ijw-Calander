import React, { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

interface AddStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [school, setSchool] = useState('');
    const [grade, setGrade] = useState('');
    const [englishName, setEnglishName] = useState('');
    const [phone, setPhone] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('이름을 입력해주세요');
            return;
        }

        if (!school.trim() || !grade.trim()) {
            setError('학교와 학년을 입력해주세요');
            return;
        }

        setIsSubmitting(true);

        try {
            // studentId 형식: "이름_학교_학년"
            const studentId = `${name.trim()}_${school.trim()}_${grade.trim()}`;

            // students 컬렉션에 추가
            await setDoc(doc(db, 'students', studentId), {
                name: name.trim(),
                school: school.trim(),
                grade: grade.trim(),
                englishName: englishName.trim() || null,
                phone: phone.trim() || null,
                parentPhone: parentPhone.trim() || null,
                status: 'active',
                enrollmentDate: Timestamp.now(),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            // 성공 처리
            onSuccess();
            onClose();

            // 폼 초기화
            setName('');
            setSchool('');
            setGrade('');
            setEnglishName('');
            setPhone('');
            setParentPhone('');
        } catch (err) {
            console.error('학생 추가 오류:', err);
            setError('학생 추가 중 오류가 발생했습니다');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (isSubmitting) return;
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[#081429] text-white rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <UserPlus size={20} />
                        <h3 className="font-bold text-base">새 학생 등록</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="text-white/70 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* 이름 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                이름 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm"
                                placeholder="홍길동"
                                required
                                autoFocus
                            />
                        </div>

                        {/* 학교 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                학교 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={school}
                                onChange={(e) => setSchool(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm"
                                placeholder="칠성초"
                                required
                            />
                        </div>

                        {/* 학년 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                학년 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm"
                                required
                            >
                                <option value="">선택하세요</option>
                                <option value="초1">초1</option>
                                <option value="초2">초2</option>
                                <option value="초3">초3</option>
                                <option value="초4">초4</option>
                                <option value="초5">초5</option>
                                <option value="초6">초6</option>
                                <option value="중1">중1</option>
                                <option value="중2">중2</option>
                                <option value="중3">중3</option>
                                <option value="고1">고1</option>
                                <option value="고2">고2</option>
                                <option value="고3">고3</option>
                            </select>
                        </div>

                        {/* 영어 이름 (선택) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                영어 이름 (선택)
                            </label>
                            <input
                                type="text"
                                value={englishName}
                                onChange={(e) => setEnglishName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm"
                                placeholder="Hong Gil Dong"
                            />
                        </div>

                        {/* 학생 연락처 (선택) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                학생 연락처 (선택)
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm"
                                placeholder="010-1234-5678"
                            />
                        </div>

                        {/* 학부모 연락처 (선택) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                학부모 연락처 (선택)
                            </label>
                            <input
                                type="tel"
                                value={parentPhone}
                                onChange={(e) => setParentPhone(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm"
                                placeholder="010-9876-5432"
                            />
                        </div>
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
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:bg-[#fdb813]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>등록 중...</span>
                                </>
                            ) : (
                                <span>학생 등록</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddStudentModal;
