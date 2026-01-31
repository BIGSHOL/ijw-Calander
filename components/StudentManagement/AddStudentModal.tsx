import React, { useState } from 'react';
import { X, UserPlus, Loader2, User, School, Phone, MapPin, Cake, FileText, ChevronDown, ChevronRight } from 'lucide-react';
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

// 섹션 토글 타입
type SectionKey = 'basic' | 'school' | 'contact' | 'address' | 'extra';

const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onSuccess }) => {
    // 섹션 펼침 상태 (기본정보, 학교정보, 연락처는 기본 펼침)
    const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
        basic: true,
        school: true,
        contact: true,
        address: false,
        extra: false,
    });

    const toggleSection = (key: SectionKey) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

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
        setExpandedSections({
            basic: true,
            school: true,
            contact: true,
            address: false,
            extra: false,
        });
        onClose();
    };

    if (!isOpen) return null;

    // 섹션 헤더 컴포넌트
    const SectionHeader = ({
        icon: Icon,
        title,
        sectionKey,
        required: isRequired = false
    }: {
        icon: any;
        title: string;
        sectionKey: SectionKey;
        required?: boolean;
    }) => (
        <button
            type="button"
            onClick={() => toggleSection(sectionKey)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg border-b border-gray-200"
        >
            {expandedSections[sectionKey] ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <Icon className="w-4 h-4 text-[#081429]" />
            <span className="text-sm font-bold text-[#081429]">{title}</span>
            {isRequired && <span className="text-red-500 text-xs">*</span>}
        </button>
    );

    // 입력 필드 클래스
    const inputClass = (hasError: boolean) =>
        `w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] focus:outline-none ${
            hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-[#081429] text-white rounded-t-xl shrink-0">
                    <div className="flex items-center gap-2">
                        <UserPlus size={18} />
                        <h3 className="font-bold text-sm">새 학생 등록</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="text-white/70 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form - Scrollable */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-4 space-y-3">
                        {/* 기본 정보 섹션 */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <SectionHeader icon={User} title="기본 정보" sectionKey="basic" required />
                            {expandedSections.basic && (
                                <div className="p-3 space-y-2.5">
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* 이름 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                이름 <span className="text-red-500">*</span>
                                            </label>
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
                                                <p className="mt-0.5 text-xs text-red-500">{errors.name}</p>
                                            )}
                                        </div>
                                        {/* 영어 이름 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                영어 이름
                                            </label>
                                            <input
                                                type="text"
                                                value={values.englishName}
                                                onChange={(e) => handleChange('englishName', e.target.value)}
                                                className={inputClass(false)}
                                                placeholder="Hong Gil Dong"
                                            />
                                        </div>
                                    </div>
                                    {/* 성별 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            성별 <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="gender"
                                                    checked={values.gender === 'male'}
                                                    onChange={() => handleChange('gender', 'male')}
                                                    className="w-3.5 h-3.5 text-[#fdb813] focus:ring-[#fdb813]"
                                                />
                                                <span className="text-sm">남</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="gender"
                                                    checked={values.gender === 'female'}
                                                    onChange={() => handleChange('gender', 'female')}
                                                    className="w-3.5 h-3.5 text-[#fdb813] focus:ring-[#fdb813]"
                                                />
                                                <span className="text-sm">여</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 학교 정보 섹션 */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <SectionHeader icon={School} title="학교 정보" sectionKey="school" required />
                            {expandedSections.school && (
                                <div className="p-3">
                                    <div className="grid grid-cols-3 gap-3">
                                        {/* 학교 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                학교 <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={values.school}
                                                onChange={(e) => handleChange('school', e.target.value)}
                                                onBlur={() => handleBlur('school')}
                                                className={inputClass(touched.school && !!errors.school)}
                                                placeholder="칠성초"
                                            />
                                            {touched.school && errors.school && (
                                                <p className="mt-0.5 text-xs text-red-500">{errors.school}</p>
                                            )}
                                        </div>
                                        {/* 학년 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                학년 <span className="text-red-500">*</span>
                                            </label>
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
                                                <p className="mt-0.5 text-xs text-red-500">{errors.grade}</p>
                                            )}
                                        </div>
                                        {/* 졸업연도 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                졸업연도
                                            </label>
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
                            )}
                        </div>

                        {/* 연락처 섹션 */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <SectionHeader icon={Phone} title="연락처" sectionKey="contact" />
                            {expandedSections.contact && (
                                <div className="p-3 space-y-2.5">
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* 원생 휴대폰 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                원생 휴대폰
                                            </label>
                                            <input
                                                type="tel"
                                                value={values.studentPhone}
                                                onChange={(e) => handleChange('studentPhone', e.target.value)}
                                                onBlur={() => handleBlur('studentPhone')}
                                                className={inputClass(touched.studentPhone && !!errors.studentPhone)}
                                                placeholder="010-0000-0000"
                                            />
                                            {touched.studentPhone && errors.studentPhone && (
                                                <p className="mt-0.5 text-xs text-red-500">{errors.studentPhone}</p>
                                            )}
                                        </div>
                                        {/* 집전화 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                집전화
                                            </label>
                                            <input
                                                type="tel"
                                                value={values.homePhone}
                                                onChange={(e) => handleChange('homePhone', e.target.value)}
                                                className={inputClass(false)}
                                                placeholder="053-000-0000"
                                            />
                                        </div>
                                    </div>
                                    {/* 보호자 연락처 */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            보호자 연락처 (SMS 수신)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="tel"
                                                value={values.parentPhone}
                                                onChange={(e) => handleChange('parentPhone', e.target.value)}
                                                onBlur={() => handleBlur('parentPhone')}
                                                className={`flex-1 ${inputClass(touched.parentPhone && !!errors.parentPhone)}`}
                                                placeholder="010-0000-0000"
                                            />
                                            <select
                                                value={values.parentRelation}
                                                onChange={(e) => handleChange('parentRelation', e.target.value)}
                                                className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                                            >
                                                {RELATION_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                value={values.parentName}
                                                onChange={(e) => handleChange('parentName', e.target.value)}
                                                className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                                                placeholder="보호자명"
                                            />
                                        </div>
                                        {touched.parentPhone && errors.parentPhone && (
                                            <p className="mt-0.5 text-xs text-red-500">{errors.parentPhone}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 주소 섹션 */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <SectionHeader icon={MapPin} title="주소" sectionKey="address" />
                            {expandedSections.address && (
                                <div className="p-3 space-y-2.5">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                우편번호
                                            </label>
                                            <input
                                                type="text"
                                                value={values.zipCode}
                                                onChange={(e) => handleChange('zipCode', e.target.value)}
                                                className={inputClass(false)}
                                                placeholder="12345"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                주소
                                            </label>
                                            <input
                                                type="text"
                                                value={values.address}
                                                onChange={(e) => handleChange('address', e.target.value)}
                                                className={inputClass(false)}
                                                placeholder="대구 북구..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            상세주소
                                        </label>
                                        <input
                                            type="text"
                                            value={values.addressDetail}
                                            onChange={(e) => handleChange('addressDetail', e.target.value)}
                                            className={inputClass(false)}
                                            placeholder="상세주소"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 추가 정보 섹션 */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <SectionHeader icon={Cake} title="추가 정보" sectionKey="extra" />
                            {expandedSections.extra && (
                                <div className="p-3 space-y-2.5">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                생년월일
                                            </label>
                                            <input
                                                type="date"
                                                value={values.birthDate}
                                                onChange={(e) => handleChange('birthDate', e.target.value)}
                                                className={inputClass(false)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                닉네임
                                            </label>
                                            <input
                                                type="text"
                                                value={values.nickname}
                                                onChange={(e) => handleChange('nickname', e.target.value)}
                                                className={inputClass(false)}
                                                placeholder="별명"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                등록일
                                            </label>
                                            <input
                                                type="date"
                                                value={values.startDate}
                                                onChange={(e) => handleChange('startDate', e.target.value)}
                                                className={inputClass(false)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            입학동기
                                        </label>
                                        <input
                                            type="text"
                                            value={values.enrollmentReason}
                                            onChange={(e) => handleChange('enrollmentReason', e.target.value)}
                                            className={inputClass(false)}
                                            placeholder="추천, 블로그, 인터넷검색 등"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            메모
                                        </label>
                                        <textarea
                                            value={values.memo}
                                            onChange={(e) => handleChange('memo', e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#fdb813] focus:outline-none resize-none"
                                            rows={2}
                                            placeholder="특이사항이나 메모"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Buttons - Fixed */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 flex gap-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:bg-[#fdb813]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
