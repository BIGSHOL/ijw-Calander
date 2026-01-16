import React, { useState, useEffect } from 'react';
import { ConsultationRecord, ConsultationStatus, SchoolGrade, ConsultationSubject } from '../../types';
import { X } from 'lucide-react';

interface ConsultationFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<ConsultationRecord, 'id'>) => void;
    initialData?: ConsultationRecord | null;
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

// Helpers
const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export const ConsultationForm: React.FC<ConsultationFormProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState<Omit<ConsultationRecord, 'id'>>({
        studentName: '',
        parentPhone: '',
        schoolName: '',
        grade: SchoolGrade.Middle1,
        address: '',
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
                address: initialData.address || ''
            });
        } else {
            setFormData({
                studentName: '',
                parentPhone: '',
                schoolName: '',
                grade: SchoolGrade.Middle1,
                address: '',
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
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            consultationDate: new Date(formData.consultationDate).toISOString(),
            paymentDate: formData.paymentDate ? new Date(formData.paymentDate).toISOString() : '',
            followUpDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : '',
            createdAt: new Date(formData.createdAt).toISOString()
        });
        onClose();
    };

    const inputClass = "w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
    const labelClass = "block text-xs font-medium text-slate-600 mb-0.5";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* 헤더 */}
                <div className="px-5 py-3 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold" style={{ color: CUSTOM_COLORS.NAVY }}>
                        {initialData ? '상담 기록 수정' : '새 상담 등록'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
                    {/* 1. 접수 정보 */}
                    <div className="mb-4">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-2 pb-1 border-b">접수 정보</div>
                        <div className="grid grid-cols-4 gap-2">
                            <div>
                                <label className={labelClass}>수신자 <span className="text-red-500">*</span></label>
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
                                <label className={labelClass}>접수일</label>
                                <input
                                    type="date"
                                    value={formData.createdAt}
                                    onChange={e => setFormData({ ...formData, createdAt: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>상담자</label>
                                <input
                                    type="text"
                                    value={formData.counselor}
                                    onChange={e => setFormData({ ...formData, counselor: e.target.value })}
                                    className={inputClass}
                                    placeholder="상담 선생님"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>상담 경로</label>
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

                    {/* 2. 학생 + 상담 정보 (2열) */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* 학생 정보 */}
                        <div>
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2 pb-1 border-b">학생 정보</div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={labelClass}>이름 <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.studentName}
                                        onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>연락처</label>
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
                                    <label className={labelClass}>학교 <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.schoolName}
                                        onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>학년 <span className="text-red-500">*</span></label>
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
                                <label className={labelClass}>주소</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className={inputClass}
                                    placeholder="상세 주소"
                                />
                            </div>
                        </div>

                        {/* 상담 정보 */}
                        <div>
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2 pb-1 border-b">상담 내용</div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={labelClass}>상담일</label>
                                    <input
                                        type="date"
                                        value={formData.consultationDate}
                                        onChange={e => setFormData({ ...formData, consultationDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>과목 <span className="text-red-500">*</span></label>
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
                                <label className={labelClass}>상담 내용 <span className="text-red-500">*</span></label>
                                <textarea
                                    required
                                    rows={3}
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className={`${inputClass} resize-none`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. 후속 조치 + 등록/결제 (2열) */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* 후속 조치 */}
                        <div>
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2 pb-1 border-b">후속 조치</div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className={labelClass}>후속 조치일</label>
                                    <input
                                        type="date"
                                        value={formData.followUpDate}
                                        onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>조치 내용</label>
                                    <input
                                        type="text"
                                        value={formData.followUpContent}
                                        onChange={e => setFormData({ ...formData, followUpContent: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>미등록 사유</label>
                                <input
                                    type="text"
                                    value={formData.nonRegistrationReason}
                                    onChange={e => setFormData({ ...formData, nonRegistrationReason: e.target.value })}
                                    className={inputClass}
                                    placeholder="등록 안한 이유"
                                />
                            </div>
                        </div>

                        {/* 등록/결제 */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2 pb-1 border-b border-slate-200">등록 / 결제</div>
                            <div className="mb-2">
                                <label className={labelClass}>등록 상태</label>
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
                                    <label className={labelClass}>결제 금액</label>
                                    <input
                                        type="text"
                                        value={formData.paymentAmount}
                                        onChange={e => setFormData({ ...formData, paymentAmount: e.target.value })}
                                        className={inputClass}
                                        placeholder="150,000"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>결제일</label>
                                    <input
                                        type="date"
                                        value={formData.paymentDate}
                                        onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>등록자</label>
                                <input
                                    type="text"
                                    value={formData.registrar}
                                    onChange={e => setFormData({ ...formData, registrar: e.target.value })}
                                    className={inputClass}
                                    placeholder="등록 처리자"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 버튼 */}
                    <div className="mt-4 flex justify-end gap-2 pt-3 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            style={{ backgroundColor: CUSTOM_COLORS.NAVY }}
                            className="px-4 py-2 text-sm rounded-md text-white font-medium hover:opacity-90 shadow-sm transition-all"
                        >
                            {initialData ? '수정 완료' : '등록'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
