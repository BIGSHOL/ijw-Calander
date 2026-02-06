import React, { useState, useEffect, useCallback } from 'react';
import { ConsultationRecord, ConsultationStatus, SchoolGrade, ConsultationSubject, SubjectConsultationDetail } from '../../types';
import {
    X, ChevronDown, ChevronRight, User, Phone, Calendar, MapPin, School, BookOpen,
    FileText, Globe, Users, Cake, Home, Smile, AlertTriangle, Target, Tag, Bus,
    XCircle, CheckCircle, Banknote, Shield, UserCheck, GraduationCap, MessageSquare, ClipboardList, Droplet, Inbox,
    Pencil, Eye, FlaskConical, Star
} from 'lucide-react';

interface ConsultationFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<ConsultationRecord, 'id'>) => void;
    initialData?: ConsultationRecord | null;
    onDelete?: (id: string) => void;
    onConvertToStudent?: (record: ConsultationRecord) => void;
    canDelete?: boolean;
    canConvert?: boolean;
    draftId?: string | null;
}

// Grade options - exclude legacy
const GRADE_OPTIONS = Object.values(SchoolGrade).filter(grade =>
    grade !== SchoolGrade.ElementaryLow && grade !== SchoolGrade.ElementaryHigh
);

const STATUS_OPTIONS = Object.values(ConsultationStatus);
const SUBJECT_OPTIONS = Object.values(ConsultationSubject);

// Custom Colors
const CUSTOM_COLORS = {
    NAVY: '#081429',
    YELLOW: '#fdb813',
    GRAY: '#373d41'
};

// 보호자 관계 옵션 (AddStudentModal과 동일)
const RELATION_OPTIONS = ['모', '부', '조부', '조모', '기타'];

// Helpers
const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export const ConsultationForm: React.FC<ConsultationFormProps> = ({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    onDelete,
    onConvertToStudent,
    canDelete = false,
    canConvert = false,
    draftId
}) => {
    // 탭 상태 관리
    type TabType = 'basic' | 'math' | 'english' | 'korean' | 'science' | 'etc';
    const [activeTab, setActiveTab] = useState<TabType>('basic');

    // 조회/편집 모드 (initialData가 있으면 기본 조회모드)
    const [isViewMode, setIsViewMode] = useState(false);

    // 확장 섹션 펼침 상태
    const [showExtendedInfo, setShowExtendedInfo] = useState(false);
    const [showAcademyInfo, setShowAcademyInfo] = useState(false);
    const [showFollowUp, setShowFollowUp] = useState(false);

    // 메인 상담 과목
    const [mainSubject, setMainSubject] = useState<'math' | 'english' | 'korean' | 'science' | 'etc' | undefined>(undefined);

    // 과목별 상담 정보 상태
    const [mathConsult, setMathConsult] = useState<SubjectConsultationDetail>({});
    const [englishConsult, setEnglishConsult] = useState<SubjectConsultationDetail>({});
    const [koreanConsult, setKoreanConsult] = useState<SubjectConsultationDetail>({});
    const [scienceConsult, setScienceConsult] = useState<SubjectConsultationDetail>({});
    const [etcConsult, setEtcConsult] = useState<SubjectConsultationDetail>({});

    const [formData, setFormData] = useState<Omit<ConsultationRecord, 'id'>>({
        // 학생 기본 정보
        studentName: '',
        englishName: '',
        gender: undefined,
        bloodType: '',
        schoolName: '',
        grade: SchoolGrade.Middle1,
        graduationYear: '',
        // 연락처
        studentPhone: '',
        homePhone: '',
        parentPhone: '',
        parentName: '',
        parentRelation: '모',
        // 주소
        zipCode: '',
        address: '',
        addressDetail: '',
        // 추가 정보
        birthDate: '',
        nickname: '',
        enrollmentReason: '',
        // 학원 전용 추가 정보
        safetyNotes: '',
        careerGoal: '',
        siblings: '',
        siblingsDetails: '',
        shuttleBusRequest: false,
        studentType: '',
        installmentAgreement: false,
        privacyAgreement: false,
        // 상담 정보
        consultationDate: getLocalDate(),
        subject: ConsultationSubject.English,
        status: ConsultationStatus.PendingThisMonth,
        counselor: '',
        receiver: '',
        registrar: '',
        paymentAmount: '',
        paymentDate: getLocalDate(),
        notes: '',
        nonRegistrationReason: '',
        followUpDate: getLocalDate(),
        followUpContent: '',
        consultationPath: '',
        createdAt: getLocalDate()
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                consultationDate: initialData.consultationDate.slice(0, 10),
                paymentDate: initialData.paymentDate ? initialData.paymentDate.slice(0, 10) : '',
                followUpDate: initialData.followUpDate ? initialData.followUpDate.slice(0, 10) : '',
                createdAt: initialData.createdAt ? initialData.createdAt.slice(0, 10) : getLocalDate(),
                // 새 필드 기본값 처리
                englishName: initialData.englishName || '',
                gender: initialData.gender,
                bloodType: initialData.bloodType || '',
                graduationYear: initialData.graduationYear || '',
                studentPhone: initialData.studentPhone || '',
                homePhone: initialData.homePhone || '',
                parentName: initialData.parentName || '',
                parentRelation: initialData.parentRelation || '모',
                zipCode: initialData.zipCode || '',
                address: initialData.address || '',
                addressDetail: initialData.addressDetail || '',
                birthDate: initialData.birthDate || '',
                nickname: initialData.nickname || '',
                enrollmentReason: initialData.enrollmentReason || '',
                // 학원 전용 추가 정보
                safetyNotes: initialData.safetyNotes || '',
                careerGoal: initialData.careerGoal || '',
                siblings: initialData.siblings || '',
                siblingsDetails: initialData.siblingsDetails || '',
                shuttleBusRequest: initialData.shuttleBusRequest || false,
                studentType: initialData.studentType || '',
                installmentAgreement: initialData.installmentAgreement || false,
                privacyAgreement: initialData.privacyAgreement || false,
            });
            // 모든 섹션 기본 접힘
            setShowExtendedInfo(false);
            setShowAcademyInfo(false);
            setShowFollowUp(false);
            // 과목별 상담 정보 로드
            setMainSubject(initialData.mainSubject);
            setMathConsult(initialData.mathConsultation || {});
            setEnglishConsult(initialData.englishConsultation || {});
            setKoreanConsult(initialData.koreanConsultation || {});
            setScienceConsult(initialData.scienceConsultation || {});
            setEtcConsult(initialData.etcConsultation || {});
            // 기존 레코드 열 때 조회 모드, draft에서 열 때 편집 모드
            setIsViewMode(!!initialData.id && !draftId);
        } else {
            setFormData({
                // 학생 기본 정보
                studentName: '',
                englishName: '',
                gender: undefined,
                bloodType: '',
                schoolName: '',
                grade: SchoolGrade.Middle1,
                graduationYear: '',
                // 연락처
                studentPhone: '',
                homePhone: '',
                parentPhone: '',
                parentName: '',
                parentRelation: '모',
                // 주소
                zipCode: '',
                address: '',
                addressDetail: '',
                // 추가 정보
                birthDate: '',
                nickname: '',
                enrollmentReason: '',
                // 학원 전용 추가 정보
                safetyNotes: '',
                careerGoal: '',
                siblings: '',
                siblingsDetails: '',
                shuttleBusRequest: false,
                studentType: '',
                installmentAgreement: false,
                privacyAgreement: false,
                // 상담 정보
                consultationDate: getLocalDate(),
                subject: ConsultationSubject.English,
                status: ConsultationStatus.PendingThisMonth,
                counselor: '',
                receiver: '',
                registrar: '',
                paymentAmount: '',
                paymentDate: getLocalDate(),
                notes: '',
                nonRegistrationReason: '',
                followUpDate: getLocalDate(),
                followUpContent: '',
                consultationPath: '',
                createdAt: getLocalDate()
            });
            setShowExtendedInfo(false);
            setShowAcademyInfo(false);
            setShowFollowUp(false);
            // 과목별 상담 정보 초기화
            setMainSubject(undefined);
            setMathConsult({});
            setEnglishConsult({});
            setKoreanConsult({});
            setScienceConsult({});
            setEtcConsult({});
            setIsViewMode(false);
        }
    }, [initialData, isOpen, draftId]);

    // Performance: rerender-functional-setstate - 안정적인 핸들러
    const handleChange = useCallback((field: keyof typeof formData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // 날짜 유효성 검사 및 변환 헬퍼 함수
    const validateAndConvertDate = (dateStr: string | undefined, fieldName: string, isRequired: boolean = false): string => {
        // 빈 값 처리
        if (!dateStr || dateStr.trim() === '') {
            if (isRequired) {
                throw new Error(`${fieldName}은(는) 필수 입력 항목입니다.`);
            }
            return '';
        }

        // 잘못된 형식 검사 (예: "T00:00:00." 같은 경우)
        if (dateStr.startsWith('T') || dateStr.length < 10) {
            console.warn(`⚠️ 잘못된 날짜 형식 감지: ${fieldName} = "${dateStr}"`);
            if (isRequired) {
                // 필수 필드면 오늘 날짜로 대체
                return new Date().toISOString();
            }
            return '';
        }

        // Date 객체 생성 및 유효성 검사
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            console.warn(`⚠️ 유효하지 않은 날짜: ${fieldName} = "${dateStr}"`);
            if (isRequired) {
                return new Date().toISOString();
            }
            return '';
        }

        return date.toISOString();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // 각 날짜 필드를 검증하고 변환
            const consultationDateISO = validateAndConvertDate(formData.consultationDate, '상담일', true);
            const paymentDateISO = validateAndConvertDate(formData.paymentDate, '결제일', false);
            const followUpDateISO = validateAndConvertDate(formData.followUpDate, '후속조치일', false);
            const createdAtISO = validateAndConvertDate(formData.createdAt, '접수일', true);

            const submitData = {
                ...formData,
                consultationDate: consultationDateISO,
                paymentDate: paymentDateISO,
                followUpDate: followUpDateISO,
                createdAt: createdAtISO,
                mainSubject: mainSubject,
                mathConsultation: mathConsult,
                englishConsultation: englishConsult,
                koreanConsultation: koreanConsult,
                scienceConsultation: scienceConsult,
                etcConsultation: etcConsult
            };

            // Firestore는 undefined 값을 지원하지 않으므로 제거
            const cleanedData = Object.fromEntries(
                Object.entries(submitData).filter(([_, value]) => value !== undefined)
            ) as Omit<ConsultationRecord, 'id'>;

            onSubmit(cleanedData);
            // onClose()를 여기서 호출하지 않음 - 부모가 모달 상태를 관리
        } catch (error) {
            console.error('❌ Form submit error:', error);
            alert(`폼 제출 중 오류가 발생했습니다:\n\n${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    };

    // 메인상담 변경 핸들러
    const handleMainSubjectChange = (subject: 'math' | 'english' | 'korean' | 'science' | 'etc') => {
        if (mainSubject === subject) {
            setMainSubject(undefined); // 토글 해제
        } else if (mainSubject) {
            const subjectNames: Record<string, string> = { math: '수학', english: '영어', korean: '국어', science: '과학', etc: '기타' };
            if (confirm(`현재 메인상담이 "${subjectNames[mainSubject]}"로 설정되어 있습니다.\n"${subjectNames[subject]}"로 변경하시겠습니까?`)) {
                setMainSubject(subject);
            }
        } else {
            setMainSubject(subject);
        }
    };

    const inputClass = `w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${isViewMode ? 'bg-gray-50 text-gray-700 cursor-default' : ''}`;
    const labelClass = "block text-xs font-medium text-slate-600 mb-0.5";
    const viewProps = isViewMode ? { readOnly: true, tabIndex: -1 } : {};

    if (!isOpen) return null;

    // 탭 설정
    const tabs: { id: TabType; label: string; color: string; subjectKey?: 'math' | 'english' | 'korean' | 'science' | 'etc' }[] = [
        { id: 'basic', label: '기본 정보', color: CUSTOM_COLORS.NAVY },
        { id: 'math', label: '수학 상담', color: '#10b981', subjectKey: 'math' },
        { id: 'english', label: '영어 상담', color: '#3b82f6', subjectKey: 'english' },
        { id: 'korean', label: '국어 상담', color: '#f59e0b', subjectKey: 'korean' },
        { id: 'science', label: '과학 상담', color: '#ec4899', subjectKey: 'science' },
        { id: 'etc', label: '기타 상담', color: '#8b5cf6', subjectKey: 'etc' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[84vh]">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-primary">
                            {draftId ? 'QR 접수 → 상담 등록' : initialData?.id ? (isViewMode ? '상담 기록 조회' : '상담 기록 수정') : '새 상담 등록'}
                        </h2>
                        {initialData?.id && (
                            <button
                                type="button"
                                onClick={() => setIsViewMode(!isViewMode)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                    isViewMode
                                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                }`}
                            >
                                {isViewMode ? <><Pencil size={11} /> 수정</> : <><Eye size={11} /> 조회</>}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* QR 접수 안내 배너 */}
                {draftId && (
                    <div className="mx-3 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-sm flex items-center gap-2 shrink-0">
                        <Inbox size={14} className="text-amber-600 shrink-0" />
                        <span className="text-xs text-amber-800">
                            학부모 QR 폼에서 접수된 데이터입니다. 내용을 확인/수정 후 등록하세요.
                        </span>
                    </div>
                )}

                {/* 탭 네비게이션 */}
                <div className="flex border-b border-gray-200 px-3 shrink-0 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3 py-2 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center gap-1 ${
                                activeTab === tab.id
                                    ? 'text-primary'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            style={activeTab === tab.id ? {
                                borderBottom: `2px solid ${tab.color}`,
                                color: tab.color
                            } : {}}
                        >
                            {tab.subjectKey && mainSubject === tab.subjectKey && (
                                <Star size={10} className="fill-current text-amber-500" />
                            )}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-2">
                    {/* 기본 정보 탭 */}
                    {activeTab === 'basic' && (
                    <>
                    {/* 1. 접수 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-primary font-bold text-xs">접수 정보</h3>
                        </div>
                        <div className="p-2">
                        <div className="grid grid-cols-4 gap-2">
                            <div>
                                <label className={labelClass}><UserCheck size={12} className="inline mr-1" />수신자 <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="text"
                                    value={formData.receiver}
                                    onChange={e => setFormData({ ...formData, receiver: e.target.value })}
                                    className={inputClass}
                                    placeholder="받은 사람"
                                />
                            </div>
                            <div>
                                <label className={labelClass}><Calendar size={12} className="inline mr-1" />접수일</label>
                                <input
                                    type="date"
                                    value={formData.createdAt}
                                    onChange={e => setFormData({ ...formData, createdAt: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}><User size={12} className="inline mr-1" />상담자</label>
                                <input
                                    type="text"
                                    value={formData.counselor}
                                    onChange={e => setFormData({ ...formData, counselor: e.target.value })}
                                    className={inputClass}
                                    placeholder="상담 선생님"
                                />
                            </div>
                            <div>
                                <label className={labelClass}><Globe size={12} className="inline mr-1" />상담 경로</label>
                                <input
                                    type="text"
                                    value={formData.consultationPath}
                                    onChange={e => setFormData({ ...formData, consultationPath: e.target.value })}
                                    className={inputClass}
                                    placeholder="지인소개"
                                />
                            </div>
                        </div>
                        </div>
                    </div>

                    {/* 2. 학생 + 상담 정보 (2열) */}
                    <div className="grid grid-cols-2 gap-2">
                        {/* 학생 정보 */}
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <h3 className="text-primary font-bold text-xs">학생 정보</h3>
                            </div>
                            <div className="p-2">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={labelClass}><User size={12} className="inline mr-1" />이름 <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.studentName}
                                        onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><Phone size={12} className="inline mr-1" />연락처</label>
                                    <input
                                        type="text"
                                        value={formData.parentPhone}
                                        onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={labelClass}><School size={12} className="inline mr-1" />학교 <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.schoolName}
                                        onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><GraduationCap size={12} className="inline mr-1" />학년 <span className="text-red-500">*</span></label>
                                    <select
                                        required
                                        value={formData.grade}
                                        onChange={e => setFormData({ ...formData, grade: e.target.value as SchoolGrade })}
                                        className={inputClass}
                                    >
                                        {GRADE_OPTIONS.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}><MapPin size={12} className="inline mr-1" />주소</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className={inputClass}
                                    placeholder="상세 주소"
                                />
                            </div>
                            </div>
                        </div>

                        {/* 상담 정보 */}
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <h3 className="text-primary font-bold text-xs">상담 내용</h3>
                            </div>
                            <div className="p-2">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={labelClass}><Calendar size={12} className="inline mr-1" />상담일</label>
                                    <input
                                        type="date"
                                        value={formData.consultationDate}
                                        onChange={e => setFormData({ ...formData, consultationDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><BookOpen size={12} className="inline mr-1" />과목 <span className="text-red-500">*</span></label>
                                    <select
                                        required
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value as ConsultationSubject })}
                                        className={inputClass}
                                    >
                                        {SUBJECT_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}><MessageSquare size={12} className="inline mr-1" />상담 내용 <span className="text-red-500">*</span></label>
                                <textarea
                                    required
                                    rows={5}
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className={`${inputClass} resize-none`}
                                />
                            </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. 학생 상세 정보 (접을 수 있는 확장 섹션) */}
                    <div className="mb-2 border border-blue-200 rounded-sm bg-blue-50/30">
                        <button
                            type="button"
                            onClick={() => setShowExtendedInfo(!showExtendedInfo)}
                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-blue-50 transition-colors rounded-sm"
                        >
                            <div className="flex items-center gap-2">
                                {showExtendedInfo ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span className="text-sm font-bold text-blue-900">📝 학생 상세 정보 (선택)</span>
                                <span className="text-xs text-blue-600">원생 전환 시 자동 입력됩니다</span>
                            </div>
                        </button>

                        {showExtendedInfo && (
                            <div className="px-4 pb-4 pt-2">
                                {/* 추가 기본 정보 */}
                                <div className="mb-3">
                                    <div className="text-xs font-semibold text-slate-600 mb-2">추가 기본 정보</div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div>
                                            <label className={labelClass}><Globe size={12} className="inline mr-1" />영어 이름</label>
                                            <input
                                                type="text"
                                                value={formData.englishName || ''}
                                                onChange={e => setFormData({ ...formData, englishName: e.target.value })}
                                                className={inputClass}
                                                placeholder="James"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}><User size={12} className="inline mr-1" />성별</label>
                                            <select
                                                value={formData.gender || ''}
                                                onChange={e => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | undefined })}
                                                className={inputClass}
                                            >
                                                <option value="">선택 안함</option>
                                                <option value="male">남</option>
                                                <option value="female">여</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}><Droplet size={12} className="inline mr-1" />혈액형</label>
                                            <select
                                                value={formData.bloodType || ''}
                                                onChange={e => setFormData({ ...formData, bloodType: e.target.value })}
                                                className={inputClass}
                                            >
                                                <option value="">선택 안함</option>
                                                <option value="A">A형</option>
                                                <option value="B">B형</option>
                                                <option value="O">O형</option>
                                                <option value="AB">AB형</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}><GraduationCap size={12} className="inline mr-1" />졸업 연도</label>
                                            <input
                                                type="text"
                                                value={formData.graduationYear || ''}
                                                onChange={e => setFormData({ ...formData, graduationYear: e.target.value })}
                                                className={inputClass}
                                                placeholder="2025"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 연락처 상세 */}
                                <div className="mb-3">
                                    <div className="text-xs font-semibold text-slate-600 mb-2">연락처 상세</div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div>
                                            <label className={labelClass}><Phone size={12} className="inline mr-1" />학생 전화</label>
                                            <input
                                                type="text"
                                                value={formData.studentPhone || ''}
                                                onChange={e => setFormData({ ...formData, studentPhone: e.target.value })}
                                                className={inputClass}
                                                placeholder="010-0000-0000"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}><Home size={12} className="inline mr-1" />집 전화</label>
                                            <input
                                                type="text"
                                                value={formData.homePhone || ''}
                                                onChange={e => setFormData({ ...formData, homePhone: e.target.value })}
                                                className={inputClass}
                                                placeholder="02-000-0000"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}><User size={12} className="inline mr-1" />보호자명</label>
                                            <input
                                                type="text"
                                                value={formData.parentName || ''}
                                                onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                                                className={inputClass}
                                                placeholder="김영희"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}><Users size={12} className="inline mr-1" />보호자 관계</label>
                                            <select
                                                value={formData.parentRelation || '모'}
                                                onChange={e => setFormData({ ...formData, parentRelation: e.target.value })}
                                                className={inputClass}
                                            >
                                                {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* 주소 상세 */}
                                <div className="mb-3">
                                    <div className="text-xs font-semibold text-slate-600 mb-2">주소 상세</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className={labelClass}><MapPin size={12} className="inline mr-1" />우편번호</label>
                                            <input
                                                type="text"
                                                value={formData.zipCode || ''}
                                                onChange={e => setFormData({ ...formData, zipCode: e.target.value })}
                                                className={inputClass}
                                                placeholder="06234"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className={labelClass}><Home size={12} className="inline mr-1" />상세주소</label>
                                            <input
                                                type="text"
                                                value={formData.addressDetail || ''}
                                                onChange={e => setFormData({ ...formData, addressDetail: e.target.value })}
                                                className={inputClass}
                                                placeholder="101동 202호"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 기타 정보 */}
                                <div>
                                    <div className="text-xs font-semibold text-slate-600 mb-2">기타 정보</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className={labelClass}><Cake size={12} className="inline mr-1" />생년월일</label>
                                            <input
                                                type="date"
                                                value={formData.birthDate || ''}
                                                onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}><Smile size={12} className="inline mr-1" />닉네임</label>
                                            <input
                                                type="text"
                                                value={formData.nickname || ''}
                                                onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                                                className={inputClass}
                                                placeholder="별명"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}><FileText size={12} className="inline mr-1" />입학 동기</label>
                                            <input
                                                type="text"
                                                value={formData.enrollmentReason || ''}
                                                onChange={e => setFormData({ ...formData, enrollmentReason: e.target.value })}
                                                className={inputClass}
                                                placeholder="지인 소개"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3-2. 학원 관리 정보 (접을 수 있는 확장 섹션) */}
                    <div className="mb-2 border border-orange-200 rounded-sm bg-orange-50/30">
                        <button
                            type="button"
                            onClick={() => setShowAcademyInfo(!showAcademyInfo)}
                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-orange-50 transition-colors rounded-sm"
                        >
                            <div className="flex items-center gap-2">
                                {showAcademyInfo ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span className="text-sm font-bold text-orange-900">📋 학원 관리 정보 (선택)</span>
                                <span className="text-xs text-orange-600">안전사항, 희망진로, 남매 관계 등</span>
                            </div>
                        </button>

                        {showAcademyInfo && (
                            <div className="px-4 pb-4 pt-2 space-y-3">
                                <div>
                                    <label className={labelClass}><AlertTriangle size={12} className="inline mr-1" />안전사항</label>
                                    <textarea
                                        rows={2}
                                        value={formData.safetyNotes || ''}
                                        onChange={e => setFormData({ ...formData, safetyNotes: e.target.value })}
                                        className={`${inputClass} resize-none`}
                                        placeholder="알레르기, 주의사항 등"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelClass}><Target size={12} className="inline mr-1" />희망진로</label>
                                        <input
                                            type="text"
                                            value={formData.careerGoal || ''}
                                            onChange={e => setFormData({ ...formData, careerGoal: e.target.value })}
                                            className={inputClass}
                                            placeholder="의사, 교사 등"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}><Tag size={12} className="inline mr-1" />학생 구분</label>
                                        <input
                                            type="text"
                                            value={formData.studentType || ''}
                                            onChange={e => setFormData({ ...formData, studentType: e.target.value })}
                                            className={inputClass}
                                            placeholder="예비/재원"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelClass}><Users size={12} className="inline mr-1" />남매 관계</label>
                                        <input
                                            type="text"
                                            value={formData.siblings || ''}
                                            onChange={e => setFormData({ ...formData, siblings: e.target.value })}
                                            className={inputClass}
                                            placeholder="외동, 형제 2명 등"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}><Users size={12} className="inline mr-1" />남매 관계 기록</label>
                                        <input
                                            type="text"
                                            value={formData.siblingsDetails || ''}
                                            onChange={e => setFormData({ ...formData, siblingsDetails: e.target.value })}
                                            className={inputClass}
                                            placeholder="재원생 여부 등"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={formData.shuttleBusRequest || false}
                                            onChange={e => setFormData({ ...formData, shuttleBusRequest: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-slate-600"><Bus size={12} className="inline mr-1" />셔틀버스 신청</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. 후속 조치 (접을 수 있는 확장 섹션) */}
                    <div className="mb-2 border border-purple-200 rounded-sm bg-purple-50/30">
                        <button
                            type="button"
                            onClick={() => setShowFollowUp(!showFollowUp)}
                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-purple-50 transition-colors rounded-sm"
                        >
                            <div className="flex items-center gap-2">
                                {showFollowUp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span className="text-sm font-bold text-purple-900">📅 후속 조치 (선택)</span>
                                <span className="text-xs text-purple-600">후속 조치일, 미등록 사유 등</span>
                            </div>
                        </button>

                        {showFollowUp && (
                            <div className="px-4 pb-4 pt-2">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                        <label className={labelClass}><Calendar size={12} className="inline mr-1" />후속 조치일</label>
                                        <input
                                            type="date"
                                            value={formData.followUpDate}
                                            onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}><MessageSquare size={12} className="inline mr-1" />조치 내용</label>
                                        <input
                                            type="text"
                                            value={formData.followUpContent}
                                            onChange={e => setFormData({ ...formData, followUpContent: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}><XCircle size={12} className="inline mr-1" />미등록 사유</label>
                                    <input
                                        type="text"
                                        value={formData.nonRegistrationReason}
                                        onChange={e => setFormData({ ...formData, nonRegistrationReason: e.target.value })}
                                        className={inputClass}
                                        placeholder="등록 안한 이유"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. 등록/결제 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-primary font-bold text-xs">등록 / 결제</h3>
                        </div>
                        <div className="p-2">
                            <div className="mb-2">
                                <label className={labelClass}><CheckCircle size={12} className="inline mr-1" />등록 상태</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as ConsultationStatus })}
                                    className={`${inputClass} bg-white`}
                                >
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={labelClass}><Banknote size={12} className="inline mr-1" />결제 금액</label>
                                    <input
                                        type="text"
                                        value={formData.paymentAmount}
                                        onChange={e => setFormData({ ...formData, paymentAmount: e.target.value })}
                                        className={inputClass}
                                        placeholder="150,000"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}><Calendar size={12} className="inline mr-1" />결제일</label>
                                    <input
                                        type="date"
                                        value={formData.paymentDate}
                                        onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}><UserCheck size={12} className="inline mr-1" />등록자</label>
                                <input
                                    type="text"
                                    value={formData.registrar}
                                    onChange={e => setFormData({ ...formData, registrar: e.target.value })}
                                    className={inputClass}
                                    placeholder="등록 처리자"
                                />
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                                <label className="flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        checked={formData.installmentAgreement || false}
                                        onChange={e => setFormData({ ...formData, installmentAgreement: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-slate-600"><Shield size={12} className="inline mr-1" />할부 규정 안내 동의서</span>
                                </label>
                                <label className="flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        checked={formData.privacyAgreement || false}
                                        onChange={e => setFormData({ ...formData, privacyAgreement: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-slate-600"><Shield size={12} className="inline mr-1" />개인정보 활용 동의서</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    </>
                    )}

                    {/* 과목별 상담 탭 공통 렌더러 */}
                    {(['math', 'english', 'korean', 'science', 'etc'] as const).map(subjectKey => {
                        if (activeTab !== subjectKey) return null;
                        const config: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; title: string; label: string }> = {
                            math: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', icon: <BookOpen size={14} />, title: 'MATH', label: '수학' },
                            english: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: <Globe size={14} />, title: 'ENGLISH', label: '영어' },
                            korean: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', icon: <FileText size={14} />, title: 'KOREAN', label: '국어' },
                            science: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900', icon: <FlaskConical size={14} />, title: 'SCIENCE', label: '과학' },
                            etc: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', icon: <MessageSquare size={14} />, title: 'ETC', label: '기타' },
                        };
                        const c = config[subjectKey];
                        const consultMap: Record<string, [SubjectConsultationDetail, (v: SubjectConsultationDetail) => void]> = {
                            math: [mathConsult, setMathConsult],
                            english: [englishConsult, setEnglishConsult],
                            korean: [koreanConsult, setKoreanConsult],
                            science: [scienceConsult, setScienceConsult],
                            etc: [etcConsult, setEtcConsult],
                        };
                        const [consult, setConsult] = consultMap[subjectKey];
                        return (
                            <div key={subjectKey} className="bg-white border border-gray-200 overflow-hidden">
                                <div className={`px-2 py-1.5 ${c.bg} ${c.border} border-b flex items-center justify-between`}>
                                    <h3 className={`${c.text} font-bold text-xs flex items-center gap-1`}>
                                        {c.icon}
                                        {c.title}
                                    </h3>
                                    {/* 메인상담 체크박스 */}
                                    <label className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-0.5 rounded transition-colors ${
                                        mainSubject === subjectKey
                                            ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={mainSubject === subjectKey}
                                            onChange={() => !isViewMode && handleMainSubjectChange(subjectKey)}
                                            disabled={isViewMode}
                                            className="rounded text-amber-500"
                                        />
                                        <Star size={10} className={mainSubject === subjectKey ? 'fill-amber-500 text-amber-500' : ''} />
                                        메인상담
                                    </label>
                                </div>
                                <div className="p-3 space-y-3">
                                    <div>
                                        <label className={labelClass}><ClipboardList size={12} className="inline mr-1" />레벨테스트 점수 ({c.label})</label>
                                        <input type="text" value={consult.levelTestScore || ''} onChange={e => setConsult({ ...consult, levelTestScore: e.target.value })} className={inputClass} placeholder={`${c.label} 레벨 미실시`} {...viewProps} />
                                    </div>
                                    <div>
                                        <label className={labelClass}><FileText size={12} className="inline mr-1" />학원 히스토리 ({c.label})</label>
                                        <textarea rows={2} value={consult.academyHistory || ''} onChange={e => setConsult({ ...consult, academyHistory: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                    <div>
                                        <label className={labelClass}><BookOpen size={12} className="inline mr-1" />학습 진도 ({c.label})</label>
                                        <textarea rows={2} value={consult.learningProgress || ''} onChange={e => setConsult({ ...consult, learningProgress: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                    <div>
                                        <label className={labelClass}><CheckCircle size={12} className="inline mr-1" />학생 시험 성적 ({c.label})</label>
                                        <textarea rows={2} value={consult.examResults || ''} onChange={e => setConsult({ ...consult, examResults: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                    <div>
                                        <label className={labelClass}><MessageSquare size={12} className="inline mr-1" />학생 상담 내역 ({c.label})</label>
                                        <textarea rows={2} value={consult.consultationHistory || ''} onChange={e => setConsult({ ...consult, consultationHistory: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelClass}><Tag size={12} className="inline mr-1" />추천반 ({c.label})</label>
                                            <input type="text" value={consult.recommendedClass || ''} onChange={e => setConsult({ ...consult, recommendedClass: e.target.value })} className={inputClass} placeholder="비어 있음" {...viewProps} />
                                        </div>
                                        <div>
                                            <label className={labelClass}><User size={12} className="inline mr-1" />담임 ({c.label})</label>
                                            <input type="text" value={consult.homeRoomTeacher || ''} onChange={e => setConsult({ ...consult, homeRoomTeacher: e.target.value })} className={inputClass} placeholder="비어 있음" {...viewProps} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}><Calendar size={12} className="inline mr-1" />첫 수업일 ({c.label})</label>
                                        <input type="date" value={consult.firstClassDate || ''} onChange={e => setConsult({ ...consult, firstClassDate: e.target.value })} className={inputClass} {...viewProps} />
                                    </div>
                                    <div>
                                        <label className={labelClass}><FileText size={12} className="inline mr-1" />기타</label>
                                        <textarea rows={2} value={consult.notes || ''} onChange={e => setConsult({ ...consult, notes: e.target.value })} className={`${inputClass} resize-none`} placeholder="비어 있음" {...viewProps} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* 버튼 */}
                    <div className="mt-4 flex justify-between items-center pt-3 border-t">
                        <div className="flex gap-2">
                            {/* 조회 모드: 원생 전환, 삭제 등 액션 */}
                            {isViewMode ? (
                                <>
                                    {initialData && canConvert && onConvertToStudent && !initialData.registeredStudentId && (
                                        <button
                                            type="button"
                                            onClick={() => onConvertToStudent(initialData)}
                                            className="px-4 py-2 text-sm rounded-sm border border-green-300 text-green-600 font-medium hover:bg-green-50 transition-colors flex items-center gap-1"
                                        >
                                            <User size={14} />
                                            원생 전환
                                        </button>
                                    )}
                                    {initialData && initialData.registeredStudentId && (
                                        <span className="px-4 py-2 text-xs bg-green-100 text-green-800 rounded-sm font-medium">
                                            ✓ 원생 전환 완료
                                        </span>
                                    )}
                                    {initialData && canDelete && onDelete && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm('정말로 삭제하시겠습니까?')) {
                                                    onDelete(initialData.id);
                                                    onClose();
                                                }
                                            }}
                                            className="px-4 py-2 text-sm rounded-sm border border-red-300 text-red-600 font-medium hover:bg-red-50 transition-colors"
                                        >
                                            삭제
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* 편집 모드: 삭제 + 원생 전환 */}
                                    {initialData && canDelete && onDelete && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm('정말로 삭제하시겠습니까?')) {
                                                    onDelete(initialData.id);
                                                    onClose();
                                                }
                                            }}
                                            className="px-4 py-2 text-sm rounded-sm border border-red-300 text-red-600 font-medium hover:bg-red-50 transition-colors"
                                        >
                                            삭제
                                        </button>
                                    )}
                                    {initialData && canConvert && onConvertToStudent && !initialData.registeredStudentId && (
                                        <button
                                            type="button"
                                            onClick={() => onConvertToStudent(initialData)}
                                            className="px-4 py-2 text-sm rounded-sm border border-green-300 text-green-600 font-medium hover:bg-green-50 transition-colors flex items-center gap-1"
                                        >
                                            <User size={14} />
                                            원생 전환
                                        </button>
                                    )}
                                    {initialData && initialData.registeredStudentId && (
                                        <span className="px-4 py-2 text-xs bg-green-100 text-green-800 rounded-sm font-medium">
                                            ✓ 원생 전환 완료
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm rounded-sm border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                            >
                                {isViewMode ? '닫기' : '취소'}
                            </button>
                            {!isViewMode && (
                                <button
                                    type="submit"
                                    style={{ backgroundColor: CUSTOM_COLORS.NAVY }}
                                    className="px-4 py-2 text-sm rounded-sm text-white font-medium hover:opacity-90 shadow-sm transition-all"
                                >
                                    {initialData?.id ? '수정 완료' : '등록'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
