import React from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { useForm } from '../../hooks/useForm';
import { required, phone as phoneValidator } from '../../utils/formValidation';
import { encryptPhone } from '../../utils/encryption';

interface AddStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface StudentFormData {
    name: string;
    school: string;
    grade: string;
    englishName: string;
    phone: string;
    parentPhone: string;
}

const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const {
        values,
        errors,
        touched,
        isSubmitting,
        handleChange,
        handleBlur,
        handleSubmit,
        resetForm,
        setErrors,
    } = useForm<StudentFormData>({
        initialValues: {
            name: '',
            school: '',
            grade: '',
            englishName: '',
            phone: '',
            parentPhone: '',
        },
        validationRules: {
            name: [required('이름을 입력해주세요')],
            school: [required('학교를 입력해주세요')],
            grade: [required('학년을 선택해주세요')],
            phone: [phoneValidator()],
            parentPhone: [phoneValidator()],
        },
        validateOnBlur: true,
        onSubmit: async (formData) => {
            try {
                // studentId 기본 형식: "이름_학교_학년"
                const baseId = `${formData.name.trim()}_${formData.school.trim()}_${formData.grade.trim()}`;
                let studentId = baseId;
                let counter = 1;

                // 중복 체크 및 순번 추가
                while ((await getDoc(doc(db, 'students', studentId))).exists()) {
                    counter++;
                    studentId = `${baseId}_${counter}`;

                    // 무한 루프 방지 (최대 100명까지 동일 이름/학교/학년)
                    if (counter > 100) {
                        throw new Error('동일한 학생 정보가 너무 많습니다. 관리자에게 문의하세요.');
                    }
                }

                // students 컬렉션에 추가 (전화번호는 암호화)
                await setDoc(doc(db, 'students', studentId), {
                    name: formData.name.trim(),
                    school: formData.school.trim(),
                    grade: formData.grade.trim(),
                    englishName: formData.englishName.trim() || null,
                    phone: encryptPhone(formData.phone),  // 암호화
                    parentPhone: encryptPhone(formData.parentPhone),  // 암호화
                    status: 'active',
                    enrollmentDate: Timestamp.now(),
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });

                // 중복으로 순번이 추가된 경우 사용자에게 알림
                if (counter > 1) {
                    console.info(`동명이인으로 인해 순번 ${counter}가 추가되었습니다: ${studentId}`);
                }

                // 성공 처리
                onSuccess();
                handleClose();
            } catch (err) {
                console.error('학생 추가 오류:', err);
                const errorMessage = err instanceof Error ? err.message : '학생 추가 중 오류가 발생했습니다';
                setErrors({ name: errorMessage });
            }
        },
    });

    const handleClose = () => {
        if (isSubmitting) return;
        resetForm();
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
                    <div className="space-y-4">
                        {/* 이름 */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-1.5">
                                이름 <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={values.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                onBlur={() => handleBlur('name')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm ${
                                    touched.name && errors.name ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="홍길동"
                                autoFocus
                            />
                            {touched.name && errors.name && (
                                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                            )}
                        </div>

                        {/* 학교 */}
                        <div>
                            <label htmlFor="school" className="block text-sm font-bold text-gray-700 mb-1.5">
                                학교 <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="school"
                                type="text"
                                value={values.school}
                                onChange={(e) => handleChange('school', e.target.value)}
                                onBlur={() => handleBlur('school')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm ${
                                    touched.school && errors.school ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="칠성초"
                            />
                            {touched.school && errors.school && (
                                <p className="mt-1 text-xs text-red-600">{errors.school}</p>
                            )}
                        </div>

                        {/* 학년 */}
                        <div>
                            <label htmlFor="grade" className="block text-sm font-bold text-gray-700 mb-1.5">
                                학년 <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="grade"
                                value={values.grade}
                                onChange={(e) => handleChange('grade', e.target.value)}
                                onBlur={() => handleBlur('grade')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm ${
                                    touched.grade && errors.grade ? 'border-red-500' : 'border-gray-300'
                                }`}
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
                            {touched.grade && errors.grade && (
                                <p className="mt-1 text-xs text-red-600">{errors.grade}</p>
                            )}
                        </div>

                        {/* 영어 이름 (선택) */}
                        <div>
                            <label htmlFor="englishName" className="block text-sm font-bold text-gray-700 mb-1.5">
                                영어 이름 (선택)
                            </label>
                            <input
                                id="englishName"
                                type="text"
                                value={values.englishName}
                                onChange={(e) => handleChange('englishName', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm"
                                placeholder="Hong Gil Dong"
                            />
                        </div>

                        {/* 학생 연락처 (선택) */}
                        <div>
                            <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-1.5">
                                학생 연락처 (선택)
                            </label>
                            <input
                                id="phone"
                                type="tel"
                                value={values.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                onBlur={() => handleBlur('phone')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm ${
                                    touched.phone && errors.phone ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="010-1234-5678"
                            />
                            {touched.phone && errors.phone && (
                                <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                            )}
                        </div>

                        {/* 학부모 연락처 (선택) */}
                        <div>
                            <label htmlFor="parentPhone" className="block text-sm font-bold text-gray-700 mb-1.5">
                                학부모 연락처 (선택)
                            </label>
                            <input
                                id="parentPhone"
                                type="tel"
                                value={values.parentPhone}
                                onChange={(e) => handleChange('parentPhone', e.target.value)}
                                onBlur={() => handleBlur('parentPhone')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent text-sm ${
                                    touched.parentPhone && errors.parentPhone ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="010-9876-5432"
                            />
                            {touched.parentPhone && errors.parentPhone && (
                                <p className="mt-1 text-xs text-red-600">{errors.parentPhone}</p>
                            )}
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
