import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ConsultationDraftSubmission } from '../../types/consultationDraft';

// Brand Colors (Pencil design variables)
const COLORS = {
    NAVY: '#081429',
    NAVY_LIGHT: '#f0f1f3',
    YELLOW: '#fdb813',
    ORANGE: '#ff6b35',
    RED: '#dc2626',
    RED_LIGHT: '#fef2f2',
    GRAY: '#373d41',
    GRAY_LIGHT: '#f8f9fa',
    GRAY_BORDER: '#e5e7eb',
    TEXT_PRIMARY: '#1f2937',
    TEXT_SECONDARY: '#6b7280',
};

// School type → grade options mapping
const GRADE_OPTIONS: Record<string, string[]> = {
    '초등학교': ['초1', '초2', '초3', '초4', '초5', '초6'],
    '중학교': ['중1', '중2', '중3'],
    '고등학교': ['고1', '고2', '고3'],
};

const RELATION_OPTIONS = ['모', '부', '조부', '조모', '기타'];
const CONSULTATION_PATH_OPTIONS = ['인터넷 검색', '지인 소개', '전단지/현수막', '블로그/카페', 'SNS', '기타'];
const SUBJECT_OPTIONS = ['수학', '영어', '국어', '과학'];

type FormState = 'loading' | 'form' | 'submitting' | 'success' | 'error';

interface ConsultationFormEmbedProps {
    tokenValue: string;
}

const ConsultationFormEmbed: React.FC<ConsultationFormEmbedProps> = ({ tokenValue }) => {
    const [formState, setFormState] = useState<FormState>('loading');
    const [errorMessage, setErrorMessage] = useState('');

    // Form fields
    const [studentName, setStudentName] = useState('');
    const [gender, setGender] = useState('');
    const [bloodType, setBloodType] = useState('');
    const [studentPhone, setStudentPhone] = useState('');
    const [careerGoal, setCareerGoal] = useState('');
    const [schoolType, setSchoolType] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [grade, setGrade] = useState('');
    const [subjects, setSubjects] = useState<string[]>([]);
    const [siblings, setSiblings] = useState('');

    const [parentName, setParentName] = useState('');
    const [parentRelation, setParentRelation] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [consultationPath, setConsultationPath] = useState('');
    const [address, setAddress] = useState('');

    const [shuttleBusRequest, setShuttleBusRequest] = useState(false);
    const [privacyAgreement, setPrivacyAgreement] = useState(false);
    const [installmentAgreement, setInstallmentAgreement] = useState(false);

    // 임베드 모드: 글로벌 overflow:hidden 및 min-width 해제 (index.css의 !important 오버라이드)
    useEffect(() => {
        const el = document.documentElement;
        const body = document.body;
        const root = document.getElementById('root');

        el.style.setProperty('overflow', 'auto', 'important');
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('min-width', '0', 'important');
        body.style.setProperty('overflow', 'auto', 'important');
        body.style.setProperty('height', 'auto', 'important');
        body.style.setProperty('min-width', '0', 'important');
        if (root) {
            root.style.setProperty('overflow', 'auto', 'important');
            root.style.setProperty('height', 'auto', 'important');
        }
    }, []);

    // Validate token on mount
    useEffect(() => {
        const validate = async () => {
            try {
                const functions = getFunctions(undefined, 'asia-northeast3');
                const validateToken = httpsCallable(functions, 'validateConsultationToken');
                const result = await validateToken({ token: tokenValue });
                const data = result.data as { valid: boolean; error?: string };

                if (data.valid) {
                    setFormState('form');
                } else {
                    setFormState('error');
                    setErrorMessage(
                        data.error === 'EXPIRED' ? '만료된 링크입니다.' :
                        data.error === 'INACTIVE' ? '비활성화된 링크입니다.' :
                        '유효하지 않은 링크입니다.'
                    );
                }
            } catch {
                setFormState('error');
                setErrorMessage('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
            }
        };
        validate();
    }, [tokenValue]);

    const toggleSubject = (s: string) => {
        setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    // 전화번호 자동 포맷: 01012345678 → 010-1234-5678
    const formatPhone = (raw: string): string => {
        const digits = raw.replace(/[^0-9]/g, '');
        if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
        if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
        return raw; // 포맷 불가능하면 원본 반환
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!studentName.trim()) return alert('학생 이름을 입력해주세요.');
        if (!schoolName.trim()) return alert('학교 이름을 입력해주세요.');
        if (!grade) return alert('학년을 선택해주세요.');
        if (!parentName.trim()) return alert('부모님 성함을 입력해주세요.');
        if (!parentPhone.trim()) return alert('부모님 연락처를 입력해주세요.');
        if (!privacyAgreement) return alert('개인정보 활용 동의에 체크해주세요.');

        setFormState('submitting');

        try {
            const functions = getFunctions(undefined, 'asia-northeast3');
            const submitDraft = httpsCallable(functions, 'submitConsultationDraft');

            const formData: ConsultationDraftSubmission = {
                studentName: studentName.trim(),
                gender: gender as 'male' | 'female' | undefined || undefined,
                bloodType: bloodType || undefined,
                studentPhone: studentPhone ? formatPhone(studentPhone) : undefined,
                careerGoal: careerGoal || undefined,
                schoolName: schoolName.trim(),
                grade,
                subjects,
                siblings: siblings || undefined,
                parentName: parentName.trim(),
                parentRelation: parentRelation || '',
                parentPhone: formatPhone(parentPhone.trim()),
                consultationPath: consultationPath || undefined,
                address: address || undefined,
                shuttleBusRequest,
                privacyAgreement,
                installmentAgreement,
            };

            await submitDraft({ token: tokenValue, formData });
            alert('제출 완료! 감사합니다.');
            setFormState('success');
        } catch (err: any) {
            setFormState('form');
            const message = err?.message || '제출에 실패했습니다.';
            alert(message);
        }
    };

    // Loading state
    if (formState === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.GRAY_LIGHT }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-yellow-200 rounded-full animate-spin" style={{ borderTopColor: COLORS.YELLOW }} />
                    <span className="text-gray-500 font-medium">확인 중...</span>
                </div>
            </div>
        );
    }

    // Error state
    if (formState === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: COLORS.GRAY_LIGHT }}>
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 mb-2">접근 불가</h2>
                    <p className="text-gray-500 text-sm">{errorMessage}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 w-full py-2.5 rounded-lg text-white font-medium text-sm"
                        style={{ backgroundColor: COLORS.NAVY }}
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    // Success state
    if (formState === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: COLORS.GRAY_LIGHT }}>
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#ecfdf5' }}>
                        <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 mb-2">제출 완료</h2>
                    <p className="text-gray-500 text-sm">입학상담카드가 성공적으로 제출되었습니다.<br />상담 시 활용됩니다. 감사합니다.</p>
                </div>
            </div>
        );
    }

    // Shared styles
    const inputStyle = "w-full h-11 px-3 border text-sm outline-none transition-colors focus:ring-2 focus:ring-yellow-300 focus:border-yellow-400";
    const labelStyle = "block text-sm font-bold mb-1.5";
    const sectionBodyStyle = "bg-white mx-3 px-5 py-5 space-y-4 shadow-sm";

    return (
        <div className="min-h-screen" style={{ backgroundColor: COLORS.GRAY_LIGHT }}>
            <form onSubmit={handleSubmit} className="max-w-[430px] mx-auto pb-10">
                {/* Header - Pencil design: navy bg, logo + title + subtitle */}
                <div className="text-center px-6" style={{ backgroundColor: COLORS.NAVY, padding: '32px 24px 24px' }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: COLORS.YELLOW }}>IJW 인재원</p>
                    <h1 className="text-[28px] font-extrabold text-white">입학상담카드</h1>
                    <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>상담 전 아래 정보를 입력해 주세요</p>
                </div>

                {/* ========== Section 1: 학생 정보 ========== */}
                <SectionHeader title="학생 정보" color={COLORS.YELLOW} />
                <div className={sectionBodyStyle} style={{ borderTop: `3px solid ${COLORS.YELLOW}` }}>
                    {/* 학생이름 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>학생이름 <span className="text-red-500">*</span></label>
                        <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)}
                            className={inputStyle} placeholder="이름 입력" style={{ borderColor: COLORS.GRAY_BORDER }} />
                    </div>

                    {/* 성별 / 혈액형 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>성별 <span className="text-red-500">*</span></label>
                            <select value={gender} onChange={e => setGender(e.target.value)}
                                className={inputStyle} style={{ borderColor: COLORS.GRAY_BORDER }}>
                                <option value="">성별 선택</option>
                                <option value="male">남</option>
                                <option value="female">여</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>혈액형 <span className="text-red-500">*</span></label>
                            <select value={bloodType} onChange={e => setBloodType(e.target.value)}
                                className={inputStyle} style={{ borderColor: COLORS.GRAY_BORDER }}>
                                <option value="">선택</option>
                                <option value="A">A형</option>
                                <option value="B">B형</option>
                                <option value="O">O형</option>
                                <option value="AB">AB형</option>
                            </select>
                        </div>
                    </div>

                    {/* 학생 연락처 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>학생 연락처</label>
                        <input type="tel" value={studentPhone} onChange={e => setStudentPhone(e.target.value)}
                            className={inputStyle} placeholder="- 없이 숫자만 입력" style={{ borderColor: COLORS.GRAY_BORDER }} />
                        <p className="text-xs mt-1" style={{ color: COLORS.TEXT_SECONDARY }}>예: 01012345678 (저장 시 자동으로 010-1234-5678 형식으로 변환됩니다)</p>
                    </div>

                    {/* 희망진로 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>희망진로</label>
                        <input type="text" value={careerGoal} onChange={e => setCareerGoal(e.target.value)}
                            className={inputStyle} placeholder="의사, 교사 등" style={{ borderColor: COLORS.GRAY_BORDER }} />
                    </div>

                    {/* 학교 구분 / 학년 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>학교 구분 <span className="text-red-500">*</span></label>
                            <select value={schoolType} onChange={e => { setSchoolType(e.target.value); setGrade(''); }}
                                className={inputStyle} style={{ borderColor: COLORS.GRAY_BORDER }}>
                                <option value="">선택</option>
                                <option value="초등학교">초등학교</option>
                                <option value="중학교">중학교</option>
                                <option value="고등학교">고등학교</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>학년 <span className="text-red-500">*</span></label>
                            <select value={grade} onChange={e => setGrade(e.target.value)}
                                className={inputStyle} style={{ borderColor: COLORS.GRAY_BORDER }}
                                disabled={!schoolType}>
                                <option value="">선택</option>
                                {schoolType && GRADE_OPTIONS[schoolType]?.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 학교 이름 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>학교 이름 (ex. 경명여고, 칠성고) <span className="text-red-500">*</span></label>
                        <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                            className={inputStyle} placeholder="학교 이름 입력" style={{ borderColor: COLORS.GRAY_BORDER }} />
                    </div>

                    {/* 상담 희망 과목 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>상담 희망 과목 <span className="text-red-500">*</span></label>
                        <div className="flex gap-2 mt-1">
                            {SUBJECT_OPTIONS.map(s => (
                                <button key={s} type="button" onClick={() => toggleSubject(s)}
                                    className="flex-1 h-11 text-sm font-medium border transition-colors"
                                    style={{
                                        backgroundColor: subjects.includes(s) ? COLORS.YELLOW : 'white',
                                        borderColor: subjects.includes(s) ? COLORS.YELLOW : COLORS.GRAY_BORDER,
                                        color: subjects.includes(s) ? COLORS.NAVY : COLORS.GRAY,
                                    }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 형제자매 - Pencil design: 있음 / 없음(외동) 체크 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>형제자매 <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                            {[{ value: '있음', label: '있음' }, { value: '없음(외동)', label: '없음(외동)' }].map(opt => (
                                <button key={opt.value} type="button" onClick={() => setSiblings(opt.value)}
                                    className="flex-1 h-11 text-sm font-medium border flex items-center justify-center gap-2 transition-colors"
                                    style={{
                                        backgroundColor: siblings === opt.value ? COLORS.NAVY : 'white',
                                        borderColor: siblings === opt.value ? COLORS.NAVY : COLORS.GRAY_BORDER,
                                        color: siblings === opt.value ? 'white' : COLORS.TEXT_PRIMARY,
                                    }}>
                                    <span className="w-5 h-5 rounded border-2 flex items-center justify-center text-xs"
                                        style={{
                                            borderColor: siblings === opt.value ? 'white' : COLORS.GRAY_BORDER,
                                            backgroundColor: siblings === opt.value ? 'white' : 'transparent',
                                            color: siblings === opt.value ? COLORS.NAVY : 'transparent',
                                        }}>
                                        {siblings === opt.value && '✓'}
                                    </span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ========== Section 2: 학부모님 정보 ========== */}
                <SectionHeader title="학부모님 정보" color={COLORS.ORANGE} />
                <div className={sectionBodyStyle} style={{ borderTop: `3px solid ${COLORS.ORANGE}` }}>
                    {/* 부모님 성함 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>부모님 성함 <span className="text-red-500">*</span></label>
                        <input type="text" value={parentName} onChange={e => setParentName(e.target.value)}
                            className={inputStyle} placeholder="이름 입력" style={{ borderColor: COLORS.GRAY_BORDER }} />
                    </div>

                    {/* 학생과의 관계 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>학생과의 관계 <span className="text-red-500">*</span></label>
                        <select value={parentRelation} onChange={e => setParentRelation(e.target.value)}
                            className={inputStyle} style={{ borderColor: COLORS.GRAY_BORDER }}>
                            <option value="">관계 선택</option>
                            {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    {/* 부모님 연락처 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>부모님 연락처 <span className="text-red-500">*</span></label>
                        <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                            className={inputStyle} placeholder="- 없이 숫자만 입력" style={{ borderColor: COLORS.GRAY_BORDER }} />
                        <p className="text-xs mt-1" style={{ color: COLORS.TEXT_SECONDARY }}>예: 01012345678</p>
                    </div>

                    {/* 상담경로 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>상담경로 <span className="text-red-500">*</span></label>
                        <select value={consultationPath} onChange={e => setConsultationPath(e.target.value)}
                            className={inputStyle} style={{ borderColor: COLORS.GRAY_BORDER }}>
                            <option value="">상담경로 선택</option>
                            {CONSULTATION_PATH_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* 집주소 */}
                    <div>
                        <label className={labelStyle} style={{ color: COLORS.TEXT_PRIMARY }}>집주소 (동 또는 아파트 이름) <span className="text-red-500">*</span></label>
                        <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                            className={inputStyle} placeholder="ex. 침산동, 센트럴자이" style={{ borderColor: COLORS.GRAY_BORDER }} />
                    </div>
                </div>

                {/* ========== Section 3: 셔틀버스 신청 ========== */}
                <SectionHeader title="셔틀버스 신청" color={COLORS.RED} textColor="white" />
                <div className={sectionBodyStyle} style={{ borderTop: `3px solid ${COLORS.RED}` }}>
                    <p className="text-sm font-semibold" style={{ color: COLORS.TEXT_PRIMARY }}>
                        셔틀버스를 신청하시겠습니까? (월 20,000원) <span className="text-red-500">*</span>
                    </p>

                    {/* 신청 / 미신청 버튼 */}
                    <div className="flex gap-2">
                        {[{ value: true, label: '신청' }, { value: false, label: '미신청' }].map(opt => (
                            <button key={String(opt.value)} type="button"
                                onClick={() => setShuttleBusRequest(opt.value)}
                                className="flex-1 h-11 text-sm font-medium border transition-colors"
                                style={{
                                    backgroundColor: shuttleBusRequest === opt.value ? COLORS.RED : 'white',
                                    borderColor: shuttleBusRequest === opt.value ? COLORS.RED : COLORS.GRAY_BORDER,
                                    color: shuttleBusRequest === opt.value ? 'white' : COLORS.GRAY,
                                }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* 노선 안내 */}
                    <div className="space-y-2.5">
                        <RouteInfo title="1호차 주요 노선" stops={[
                            '서대구 센트럴자이',
                            '고성동 오페라 아파트 라인',
                            '대구역 앞 북편네거리',
                            '옥산초, 경명여중 입구 빽다방 앞',
                        ]} />
                        <RouteInfo title="2호차 주요 노선" stops={[
                            '침산 푸르지오 1차',
                            '달성초 앞 (유진식당 앞 정차)',
                            '달성파크 푸르지오 힐스테이트',
                            '대구역 센트럴자이 및 힐스테이트',
                            '서희스타힐스 앞',
                        ]} />
                    </div>
                </div>

                {/* ========== Section 4: 동의서 & 학칙 안내 (navy) ========== */}
                <SectionHeader title="동의서 & 학칙 안내" color={COLORS.NAVY} textColor="white" />
                <div className={sectionBodyStyle} style={{ borderTop: `3px solid ${COLORS.NAVY}` }}>
                    {/* 개인정보 활용 동의서 */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold" style={{ color: COLORS.TEXT_PRIMARY }}>개인정보 활용 동의서 <span className="text-red-500">*</span></h4>
                        <div className="p-4 text-[13px] leading-relaxed" style={{ backgroundColor: COLORS.NAVY_LIGHT }}>
                            <p className="font-bold mb-2" style={{ color: COLORS.NAVY }}>개인정보 수집 및 이용 동의서</p>
                            <p className="whitespace-pre-line" style={{ color: COLORS.TEXT_SECONDARY }}>
{`1. 수집하는 개인정보의 항목 : 성명, 학년, 학교, 학생 연락처, 학부모 연락처, 제출한 과제의 동영상 및 음원

2. 인재원 원생들의 동기부여를 위해 원내 게시물, 가정통신문, 블로그 등 SNS에 학습성과를 홍보할 때 이용합니다.

3. 단, 온라인이나 배포용 홍보물에는 전체 이름을 노출하지 않고 '*'기호 등을 사용해서 개인정보 유출을 막습니다.

4. 동의를 거부할 권리 : 귀하는 위와 같이 개인정보를 수집·이용하는 데 대한 동의를 거부할 권리가 있습니다. 다만, 동의하지 않으실 경우 상담 제공 및 셔틀버스 운영 등 일부 서비스에 제한이 있을 수 있습니다.`}
                            </p>
                        </div>
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input type="checkbox" checked={privacyAgreement} onChange={e => setPrivacyAgreement(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 accent-red-600 flex-shrink-0" />
                            <span className="text-sm" style={{ color: COLORS.TEXT_PRIMARY }}>위 내용을 확인하였으며, 이에 동의합니다.</span>
                        </label>
                    </div>

                    {/* 환불 규정 안내 동의서 */}
                    <div className="space-y-3 pt-2">
                        <h4 className="text-sm font-bold" style={{ color: COLORS.TEXT_PRIMARY }}>환불 규정 안내 동의서 <span className="text-red-500">*</span></h4>
                        <div className="p-4 text-[13px] leading-relaxed space-y-3" style={{ backgroundColor: COLORS.NAVY_LIGHT }}>
                            <div>
                                <p className="font-bold mb-1" style={{ color: COLORS.NAVY }}>수강 등록 및 환불 안내</p>
                                <p className="whitespace-pre-line" style={{ color: COLORS.TEXT_SECONDARY }}>
{`1. 매월 25일~28일까지 수강료납부기간이며, 25일에 등록안내 및 학사일정이 모바일로 발송됩니다.

2. 수강료는 선불이며, 매월 1일부터 말일까지 수업횟수 기준으로 산정됩니다.

3. 원활한 학습관리를 위해 월 12회, 월 8회 수업이 최소 단위입니다. (단, 특강반 단과반 제외)

4. 등록기간 내에 미등록시, 대기생으로 자동 편성 되어 기존 수강반 등록이 어려울 수 있습니다.`}
                                </p>
                            </div>
                            <div>
                                <p className="font-bold mb-1" style={{ color: COLORS.NAVY }}>수강료 납부 방법</p>
                                <p className="whitespace-pre-line" style={{ color: COLORS.TEXT_SECONDARY }}>
{`1. 카드결제
데스크 또는 키오스크 결제
방문이 어려운 경우 전화 결제 가능

2. 계좌이체
수강료 안내 문자 확인 후 입금
학원 지정 계좌로 입금

3. 모바일결제
카카오톡으로 결제 링크 안내
수강 세부사항 확인 후 결제`}
                                </p>
                            </div>
                            <div>
                                <p className="font-bold mb-1" style={{ color: COLORS.NAVY }}>환불 규정 (공정거래위원회 표준약관 제00032호 기준)</p>
                                <p className="whitespace-pre-line" style={{ color: COLORS.TEXT_SECONDARY }}>
{`교습 시작 전 → 전액 환불
총 수업의 1/3 경과 전 → 2/3 환불
총 수업의 1/2 경과 전 → 1/2 환불
총 수업의 1/2 경과 후 → 환불 불가`}
                                </p>
                            </div>
                            <div>
                                <p className="font-bold mb-1" style={{ color: COLORS.NAVY }}>보강 및 퇴원 규정</p>
                                <p className="whitespace-pre-line" style={{ color: COLORS.TEXT_SECONDARY }}>
{`1. 규칙적인 학습을 위해 지각 결석을 허용하지 않으며, 별도의 보강이 없습니다.
(단, 건강상의 문제나 증명 가능한 공식사유는 예외로 인정하며 1회 이내 허용)

2. 선생님 지시 혹은 규정에 따르지 않는 경우, 선생님께 예의를 지키지 않았을 경우, 수업 분위기를 해칠 경우 경고를 받으며, 2회 경고 시 퇴원 조치 됩니다.

3. 인재원은 학생들의 책임 학습을 위해 수업 최소단위를 적용하며, 이를 위해 시험기간 중에는 학원 일정에 따라 선 수업으로 진행될 수도 있습니다.`}
                                </p>
                            </div>
                        </div>
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input type="checkbox" checked={installmentAgreement} onChange={e => setInstallmentAgreement(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 accent-red-600 flex-shrink-0" />
                            <span className="text-sm" style={{ color: COLORS.TEXT_PRIMARY }}>위 내용을 확인하였으며, 이에 동의합니다.</span>
                        </label>
                    </div>
                </div>

                {/* ========== Submit Button ========== */}
                <div className="mx-3 mt-6 px-5 pb-6">
                    <button
                        type="submit"
                        disabled={formState === 'submitting'}
                        className="w-full h-[52px] text-white font-bold text-base flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: COLORS.RED }}
                    >
                        {formState === 'submitting' ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                제출 중...
                            </span>
                        ) : (
                            <>상담 신청하기 <span className="text-lg">→</span></>
                        )}
                    </button>
                    <p className="text-center text-xs mt-3" style={{ color: COLORS.TEXT_SECONDARY }}>
                        제출하신 정보는 상담 목적으로만 사용됩니다.
                    </p>
                </div>
            </form>
        </div>
    );
};

// Section Header component (Pencil design)
const SectionHeader: React.FC<{ title: string; color: string; textColor?: string }> = ({ title, color, textColor }) => (
    <div className="flex items-center gap-2 mx-3 mt-5 px-5 py-3" style={{ backgroundColor: color }}>
        <span className="text-sm font-bold" style={{ color: textColor ? textColor : (color === '#fdb813' ? COLORS.NAVY : 'white') }}>
            {title}
        </span>
    </div>
);

// Route info component
const RouteInfo: React.FC<{ title: string; stops: string[] }> = ({ title, stops }) => (
    <div className="p-3" style={{ backgroundColor: COLORS.RED_LIGHT }}>
        <p className="text-[13px] font-bold mb-1" style={{ color: COLORS.RED }}>{title}</p>
        <div className="text-xs leading-relaxed" style={{ color: COLORS.TEXT_SECONDARY }}>
            {stops.map((stop, i) => (
                <p key={i}>{i + 1}. {stop}</p>
            ))}
        </div>
    </div>
);

export default ConsultationFormEmbed;
