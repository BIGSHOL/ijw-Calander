import React, { useState, useEffect } from 'react';
import { ConsultationRecord, ConsultationStatus, SchoolGrade, ConsultationSubject } from '../../types';
import { X } from 'lucide-react';

interface ConsultationFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<ConsultationRecord, 'id' | 'createdAt'>) => void;
    initialData?: ConsultationRecord | null;
}

// Grade, Status, Subject options
const GRADE_OPTIONS = Object.values(SchoolGrade);
const STATUS_OPTIONS = Object.values(ConsultationStatus);
const SUBJECT_OPTIONS = Object.values(ConsultationSubject);

// Helpers to get local date strings to prevent UTC shifts
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
    const [formData, setFormData] = useState<Omit<ConsultationRecord, 'id' | 'createdAt'>>({
        studentName: '',
        parentPhone: '',
        schoolName: '',
        grade: SchoolGrade.Middle1,
        consultationDate: getLocalDateTime(),

        subject: ConsultationSubject.English,
        status: ConsultationStatus.PendingThisMonth,

        counselor: '',
        registrar: '',

        paymentAmount: '',
        paymentDate: getLocalDate(),

        notes: '',
        nonRegistrationReason: '',

        followUpDate: getLocalDate(),
        followUpContent: '',

        consultationPath: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                studentName: initialData.studentName,
                parentPhone: initialData.parentPhone,
                schoolName: initialData.schoolName,
                grade: initialData.grade,
                consultationDate: initialData.consultationDate.slice(0, 16),

                subject: initialData.subject,
                status: initialData.status,

                counselor: initialData.counselor,
                registrar: initialData.registrar,

                paymentAmount: initialData.paymentAmount || '',
                paymentDate: initialData.paymentDate ? initialData.paymentDate.slice(0, 10) : '',

                notes: initialData.notes,
                nonRegistrationReason: initialData.nonRegistrationReason || '',

                followUpDate: initialData.followUpDate ? initialData.followUpDate.slice(0, 10) : '',
                followUpContent: initialData.followUpContent || '',

                consultationPath: initialData.consultationPath || ''
            });
        } else {
            // Reset for new entry with defaults
            setFormData({
                studentName: '',
                parentPhone: '',
                schoolName: '',
                grade: SchoolGrade.Middle1,
                consultationDate: getLocalDateTime(),
                subject: ConsultationSubject.English,
                status: ConsultationStatus.PendingThisMonth,
                counselor: '',
                registrar: '',
                paymentAmount: '',
                paymentDate: getLocalDate(),
                notes: '',
                nonRegistrationReason: '',
                followUpDate: getLocalDate(),
                followUpContent: '',
                consultationPath: ''
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
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800">
                        {initialData ? '상담 기록 수정' : '새 상담 기록 등록'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* 1. Student Info */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">학생 정보</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">학생 이름</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.studentName}
                                        onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">학부모 연락처</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.parentPhone}
                                        onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">학교</label>
                                    <input
                                        type="text"
                                        value={formData.schoolName}
                                        onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">학년</label>
                                    <select
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
                        </div>

                        {/* 2. Consultation Detail */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">상담 정보</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">상담 일시</label>
                                    <input
                                        required
                                        type="datetime-local"
                                        value={formData.consultationDate}
                                        onChange={e => setFormData({ ...formData, consultationDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">상담 과목</label>
                                    <select
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
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">상담자</label>
                                    <input
                                        type="text"
                                        value={formData.counselor}
                                        onChange={e => setFormData({ ...formData, counselor: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                        placeholder="상담 선생님"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">상담 경로</label>
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

                        {/* 3. Registration & Payment */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">등록 및 결제</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">등록 여부 (상태)</label>
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">등록자</label>
                                    <input
                                        type="text"
                                        value={formData.registrar}
                                        onChange={e => setFormData({ ...formData, registrar: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                        placeholder="등록 접수자"
                                    />
                                </div>
                                <div>
                                    {/* Placeholder to align */}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">결제 금액</label>
                                    <input
                                        type="text"
                                        value={formData.paymentAmount}
                                        onChange={e => setFormData({ ...formData, paymentAmount: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                        placeholder="150,000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">결제일</label>
                                    <input
                                        type="date"
                                        value={formData.paymentDate}
                                        onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 4. Notes & Follow up */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">추가 내용 및 후속 조치</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">간단 상담 내용</label>
                                <textarea
                                    rows={2}
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">미등록 사유</label>
                                <input
                                    type="text"
                                    value={formData.nonRegistrationReason}
                                    onChange={e => setFormData({ ...formData, nonRegistrationReason: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    placeholder="등록하지 않은 경우 작성"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">후속 조치일</label>
                                    <input
                                        type="date"
                                        value={formData.followUpDate}
                                        onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">후속 조치 내용</label>
                                    <input
                                        type="text"
                                        value={formData.followUpContent}
                                        onChange={e => setFormData({ ...formData, followUpContent: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
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
                            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all transform hover:-translate-y-0.5"
                        >
                            {initialData ? '수정 완료' : '상담 등록'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
