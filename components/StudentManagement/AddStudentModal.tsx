import React, { useState } from 'react';
import { X, UserPlus, Loader2, User, School, Phone, MapPin, Cake, FileText } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useForm } from '../../hooks/useForm';
import { required, phone as phoneValidator } from '../../utils/formValidation';

interface AddStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface StudentFormData {
    // 기본 정보
    name: string;
    englishName: string;
    gender: 'male' | 'female' | '';
    // 학교 정보
    school: string;
    grade: string;
    graduationYear: string;
    // 연락처
    studentPhone: string;
    homePhone: string;
    parentPhone: string;
    parentName: string;
    parentRelation: string;
    // 주소
    zipCode: string;
    address: string;
    addressDetail: string;
    // 추가 정보
    birthDate: string;
    nickname: string;
    startDate: string;
    enrollmentReason: string;
    memo: string;
}

// 학년 옵션
const GRADE_OPTIONS = [
    '미취학',
    '초1', '초2', '초3', '초4', '초5', '초6',
    '중1', '중2', '중3',
    '고1', '고2', '고3',
    '기타',
];

// 보호자 관계 옵션
const RELATION_OPTIONS = ['모', '부', '조부', '조모', '기타'];

/**
 * 학교명 정규화 (전체 이름 → 축약형)
 * - "대구일중학교" → "대구일중"
 * - "칠성초등학교" → "칠성초"
 * - "대구고등학교" → "대구고"
 */
const normalizeSchoolName = (school: string): string => {
    return school.trim()
        .replace(/초등학교$/g, '초')
        .replace(/중학교$/g, '중')
        .replace(/고등학교$/g, '고');
};

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
            englishName: '',
            gender: '',
            school: '',
            grade: '',
            graduationYear: '',
            studentPhone: '',
            homePhone: '',
            parentPhone: '',
            parentName: '',
            parentRelation: '모',
            zipCode: '',
            address: '',
            addressDetail: '',
            birthDate: '',
            nickname: '',
            startDate: new Date().toISOString().split('T')[0],
            enrollmentReason: '',
            memo: '',
        },
        validationRules: {
            name: [required('이름을 입력해주세요')],
            gender: [required('성별을 선택해주세요')],
            school: [required('학교를 입력해주세요')],
            grade: [required('학년을 선택해주세요')],
            studentPhone: [phoneValidator()],
            parentPhone: [phoneValidator()],
        },
        validateOnBlur: true,
        onSubmit: async (formData) => {
            try {
                // 학교명 정규화 (대구일중학교 → 대구일중)
                const normalizedSchool = normalizeSchoolName(formData.school);

                // studentId 기본 형식: "이름_학교(정규화)_학년"
                const baseId = `${formData.name.trim()}_${normalizedSchool}_${formData.grade.trim()}`;
                let studentId = baseId;
                let counter = 1;

                // 중복 체크 및 순번 추가
                while ((await getDoc(doc(db, 'students', studentId))).exists()) {
                    counter++;
                    studentId = `${baseId}_${counter}`;
                    if (counter > 100) {
                        throw new Error('동일한 학생 정보가 너무 많습니다. 관리자에게 문의하세요.');
                    }
                }

                // 전화번호 서버 측 암호화
                const functionsInstance = getFunctions(undefined, 'asia-northeast3');
                const encryptFn = httpsCallable(functionsInstance, 'encryptPhoneNumbers');
                const encryptResult = await encryptFn({
                    phones: {
                        studentPhone: formData.studentPhone,
                        homePhone: formData.homePhone,
                        parentPhone: formData.parentPhone,
                    }
                });
                const encryptedPhones = (encryptResult.data as any).encrypted;

                // students 컬렉션에 추가 (전화번호는 서버 측 암호화)
                await setDoc(doc(db, 'students', studentId), {
                    // 기본 정보
                    name: formData.name.trim(),
                    englishName: formData.englishName.trim() || null,
                    gender: formData.gender || null,
                    // 학교 정보 (학교명 정규화 적용)
                    school: normalizedSchool,
                    grade: formData.grade.trim(),
                    graduationYear: formData.graduationYear.trim() || null,
                    // 연락처 (서버 측 암호화)
                    studentPhone: encryptedPhones.studentPhone,
                    homePhone: encryptedPhones.homePhone,
                    parentPhone: encryptedPhones.parentPhone,
                    parentName: formData.parentName.trim() || null,
                    parentRelation: formData.parentRelation || '모',
                    // 주소
                    zipCode: formData.zipCode.trim() || null,
                    address: formData.address.trim() || null,
                    addressDetail: formData.addressDetail.trim() || null,
                    // 추가 정보
                    birthDate: formData.birthDate || null,
                    nickname: formData.nickname.trim() || null,
                    startDate: formData.startDate || new Date().toISOString().split('T')[0],
                    enrollmentReason: formData.enrollmentReason.trim() || null,
                    memo: formData.memo.trim() || null,
                    // 시스템 필드
                    status: 'active',
                    enrollmentDate: Timestamp.now(),
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    // 알림 기본값
                    smsNotification: true,
                    pushNotification: false,
                    kakaoNotification: true,
                    billingSmsPrimary: true,
                    billingSmsOther: false,
                    overdueSmsPrimary: true,
                    overdueSmsOther: false,
                });

                if (counter > 1) {
                    console.info(`동명이인으로 인해 순번 ${counter}가 추가되었습니다: ${studentId}`);
                }

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

    // 입력 필드 클래스
    const inputClass = (hasError: boolean) =>
        `flex-1 px-2 py-1 text-xs border focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none ${
            hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={handleClose}>
            <div
                className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
                    <h2 className="text-sm font-bold text-[#081429] flex items-center gap-2">
                        <UserPlus size={16} className="text-[#fdb813]" />
                        새 학생 등록
                    </h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form - Scrollable */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-2">
                    {/* Section 1: 기본 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <User className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">기본 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">이름 <span className="text-red-500">*</span></span>
                                <input
                                    type="text"
                                    value={values.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    onBlur={() => handleBlur('name')}
                                    className={inputClass(touched.name && !!errors.name)}
                                    placeholder="홍길동"
                                    autoFocus
                                />
                                {touched.name && errors.name && (
                                    <span className="text-xxs text-red-500 shrink-0">{errors.name}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">영어이름</span>
                                <input
                                    type="text"
                                    value={values.englishName}
                                    onChange={(e) => handleChange('englishName', e.target.value)}
                                    className={inputClass(false)}
                                    placeholder="Hong Gil Dong"
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">성별 <span className="text-red-500">*</span></span>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="gender"
                                            checked={values.gender === 'male'}
                                            onChange={() => handleChange('gender', 'male')}
                                            className="w-3 h-3 text-[#fdb813] focus:ring-[#fdb813]"
                                        />
                                        <span className="text-xs">남</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="gender"
                                            checked={values.gender === 'female'}
                                            onChange={() => handleChange('gender', 'female')}
                                            className="w-3 h-3 text-[#fdb813] focus:ring-[#fdb813]"
                                        />
                                        <span className="text-xs">여</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: 학교 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <School className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">학교 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">학교 <span className="text-red-500">*</span></span>
                                <input
                                    type="text"
                                    value={values.school}
                                    onChange={(e) => handleChange('school', e.target.value)}
                                    onBlur={() => handleBlur('school')}
                                    className={inputClass(touched.school && !!errors.school)}
                                    placeholder="칠성초"
                                />
                                {touched.school && errors.school && (
                                    <span className="text-xxs text-red-500 shrink-0">{errors.school}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">학년 <span className="text-red-500">*</span></span>
                                <select
                                    value={values.grade}
                                    onChange={(e) => handleChange('grade', e.target.value)}
                                    onBlur={() => handleBlur('grade')}
                                    className={inputClass(touched.grade && !!errors.grade)}
                                >
                                    <option value="">선택</option>
                                    {GRADE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                                {touched.grade && errors.grade && (
                                    <span className="text-xxs text-red-500 shrink-0">{errors.grade}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">졸업연도</span>
                                <input
                                    type="text"
                                    value={values.graduationYear}
                                    onChange={(e) => handleChange('graduationYear', e.target.value)}
                                    className={inputClass(false)}
                                    placeholder="2026"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: 연락처 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Phone className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">연락처</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">원생폰</span>
                                <input
                                    type="tel"
                                    value={values.studentPhone}
                                    onChange={(e) => handleChange('studentPhone', e.target.value)}
                                    onBlur={() => handleBlur('studentPhone')}
                                    className={inputClass(touched.studentPhone && !!errors.studentPhone)}
                                    placeholder="010-0000-0000"
                                />
                                {touched.studentPhone && errors.studentPhone && (
                                    <span className="text-xxs text-red-500 shrink-0">{errors.studentPhone}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">집전화</span>
                                <input
                                    type="tel"
                                    value={values.homePhone}
                                    onChange={(e) => handleChange('homePhone', e.target.value)}
                                    className={inputClass(false)}
                                    placeholder="053-000-0000"
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">보호자</span>
                                <div className="flex gap-1 flex-1">
                                    <input
                                        type="tel"
                                        value={values.parentPhone}
                                        onChange={(e) => handleChange('parentPhone', e.target.value)}
                                        onBlur={() => handleBlur('parentPhone')}
                                        className={`${inputClass(touched.parentPhone && !!errors.parentPhone)} max-w-[140px]`}
                                        placeholder="010-0000-0000"
                                    />
                                    <select
                                        value={values.parentRelation}
                                        onChange={(e) => handleChange('parentRelation', e.target.value)}
                                        className="w-14 px-1 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] outline-none"
                                    >
                                        {RELATION_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={values.parentName}
                                        onChange={(e) => handleChange('parentName', e.target.value)}
                                        className="w-20 px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] outline-none"
                                        placeholder="보호자명"
                                    />
                                </div>
                            </div>
                            {touched.parentPhone && errors.parentPhone && (
                                <div className="px-2 py-1">
                                    <span className="text-xxs text-red-500">{errors.parentPhone}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 4: 주소 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <MapPin className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">주소</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">우편번호</span>
                                <input
                                    type="text"
                                    value={values.zipCode}
                                    onChange={(e) => handleChange('zipCode', e.target.value)}
                                    className={`${inputClass(false)} max-w-[100px]`}
                                    placeholder="12345"
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">주소</span>
                                <input
                                    type="text"
                                    value={values.address}
                                    onChange={(e) => handleChange('address', e.target.value)}
                                    className={inputClass(false)}
                                    placeholder="대구 북구..."
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">상세주소</span>
                                <input
                                    type="text"
                                    value={values.addressDetail}
                                    onChange={(e) => handleChange('addressDetail', e.target.value)}
                                    className={inputClass(false)}
                                    placeholder="상세주소"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 5: 추가 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Cake className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">추가 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">생년월일</span>
                                <input
                                    type="date"
                                    value={values.birthDate}
                                    onChange={(e) => handleChange('birthDate', e.target.value)}
                                    className={`${inputClass(false)} max-w-[150px]`}
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">닉네임</span>
                                <input
                                    type="text"
                                    value={values.nickname}
                                    onChange={(e) => handleChange('nickname', e.target.value)}
                                    className={inputClass(false)}
                                    placeholder="별명"
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">등록일</span>
                                <input
                                    type="date"
                                    value={values.startDate}
                                    onChange={(e) => handleChange('startDate', e.target.value)}
                                    className={`${inputClass(false)} max-w-[150px]`}
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">입학동기</span>
                                <input
                                    type="text"
                                    value={values.enrollmentReason}
                                    onChange={(e) => handleChange('enrollmentReason', e.target.value)}
                                    className={inputClass(false)}
                                    placeholder="추천, 블로그, 인터넷검색 등"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 6: 메모 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <FileText className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">메모</h3>
                        </div>
                        <div className="p-2">
                            <textarea
                                value={values.memo}
                                onChange={(e) => handleChange('memo', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] outline-none resize-none"
                                rows={2}
                                placeholder="특이사항이나 메모"
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="px-3 py-2 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 shrink-0">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 bg-[#fdb813] text-[#081429] text-xs font-semibold hover:bg-[#e5a60f] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                등록 중...
                            </>
                        ) : (
                            '학생 등록'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddStudentModal;
