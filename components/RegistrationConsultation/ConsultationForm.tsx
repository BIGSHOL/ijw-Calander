import React, { useState, useEffect } from 'react';
import { ConsultationRecord, ConsultationStatus, SchoolGrade, ConsultationSubject } from '../../types';
import { X } from 'lucide-react';

interface ConsultationFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<ConsultationRecord, 'id'>) => void; // createdAt 포함
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

const getLocalDateTime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

export const ConsultationForm: React.FC<ConsultationFormProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
    // formData에 createdAt 포함
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
        createdAt: getLocalDate() // 접수일 (날짜만)
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
            // Reset
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
            createdAt: new Date(formData.createdAt).toISOString() // 접수일 저장
        });
        onClose();
    };

    const LabelRequired = ({ label }: { label: string }) => (
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} <span className="text-red-500">*</span>
        </label>
    );

    const Label = ({ label }: { label: string }) => (
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label}
        </label>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold" style={{ color: CUSTOM_COLORS.NAVY }}>
                        {initialData ? '상담 기록 수정' : '새 상담 기록 등록'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* 1. 접수 정보 (수신자 최상단) */}
                        <div className="space-y-4 md:col-span-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">기본 접수 정보</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <LabelRequired label="수신자" />
                                    <input
                                        required
                                        type="text"
                                        value={formData.receiver}
                                        onChange={e => setFormData({ ...formData, receiver: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                        placeholder="전화 받은 사람"
                                    />
                                </div>
                                <div>
                                    <Label label="접수일" />
                                    <input
                                        type="date"
                                        value={formData.createdAt}
                                        onChange={e => setFormData({ ...formData, createdAt: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <Label label="상담자" />
                                    <input
                                        type="text"
                                        value={formData.counselor}
                                        onChange={e => setFormData({ ...formData, counselor: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                        placeholder="상담 선생님"
                                    />
                                </div>
                                <div>
                                    <Label label="상담 경로" />
                                    <input
                                        type="text"
                                        value={formData.consultationPath}
                                        onChange={e => setFormData({ ...formData, consultationPath: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                        placeholder="예: 지인소개"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. 학생 정보 */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">학생 정보</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <LabelRequired label="학생 이름" />
                                    <input
                                        required
                                        type="text"
                                        value={formData.studentName}
                                        onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <Label label="학부모 연락처" />
                                    <input
                                        type="text"
                                        value={formData.parentPhone}
                                        onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <LabelRequired label="학교" />
                                    <input
                                        required
                                        type="text"
                                        value={formData.schoolName}
                                        onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <LabelRequired label="학년" />
                                    <select
                                        required
                                        value={formData.grade}
                                        onChange={e => setFormData({ ...formData, grade: e.target.value as SchoolGrade })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    >
                                        {GRADE_OPTIONS.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="mt-3">
                                <Label label="주소" />
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    placeholder="상세 주소를 입력하세요"
                                />
                            </div>
                        </div>

                        {/* 3. 상담 상세 */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">상담 정보</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label label="상담 일시" />
                                    <input
                                        type="date"
                                        value={formData.consultationDate}
                                        onChange={e => setFormData({ ...formData, consultationDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <LabelRequired label="상담 과목" />
                                    <select
                                        required
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value as ConsultationSubject })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    >
                                        {SUBJECT_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <LabelRequired label="간단 상담 내용" />
                                <textarea
                                    required
                                    rows={4}
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 resize-none"
                                />
                            </div>
                        </div>

                        {/* 4. 등록 및 결제 */}
                        <div className="space-y-4 md:col-span-2">
                            <div className="border-t pt-4 mt-2">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">후속 조치 및 결제</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div>
                                            <Label label="후속 조치일" />
                                            <input
                                                type="date"
                                                value={formData.followUpDate}
                                                onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <Label label="후속 조치 내용" />
                                            <input
                                                type="text"
                                                value={formData.followUpContent}
                                                onChange={e => setFormData({ ...formData, followUpContent: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <Label label="미등록 사유" />
                                            <input
                                                type="text"
                                                value={formData.nonRegistrationReason}
                                                onChange={e => setFormData({ ...formData, nonRegistrationReason: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                                placeholder="등록하지 않은 경우 작성"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div>
                                            <Label label="등록 여부 (상태)" />
                                            <select
                                                value={formData.status}
                                                onChange={e => setFormData({ ...formData, status: e.target.value as ConsultationStatus })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                            >
                                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label label="결제 금액" />
                                                <input
                                                    type="text"
                                                    value={formData.paymentAmount}
                                                    onChange={e => setFormData({ ...formData, paymentAmount: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                                    placeholder="150,000"
                                                />
                                            </div>
                                            <div>
                                                <Label label="결제일" />
                                                <input
                                                    type="date"
                                                    value={formData.paymentDate}
                                                    onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label label="등록자" />
                                            <input
                                                type="text"
                                                value={formData.registrar}
                                                onChange={e => setFormData({ ...formData, registrar: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                                placeholder="등록 접수자"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3 border-t pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            style={{ backgroundColor: CUSTOM_COLORS.NAVY }}
                            className="px-5 py-2.5 rounded-lg text-white font-medium hover:opacity-90 shadow-sm transition-all transform hover:-translate-y-0.5"
                        >
                            {initialData ? '수정 완료' : '상담 등록'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
