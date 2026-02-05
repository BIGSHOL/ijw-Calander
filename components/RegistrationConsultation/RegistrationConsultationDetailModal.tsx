import React from 'react';
import { X, User, Phone, School, Calendar, MapPin, BookOpen, MessageSquare, Banknote, FileText } from 'lucide-react';
import { ConsultationRecord, CONSULTATION_STATUS_COLORS } from '../../types';

interface RegistrationConsultationDetailModalProps {
    record: ConsultationRecord;
    onClose: () => void;
}

const RegistrationConsultationDetailModal: React.FC<RegistrationConsultationDetailModalProps> = ({
    record,
    onClose
}) => {
    const statusColorClass = CONSULTATION_STATUS_COLORS[record.status] || 'bg-gray-100 text-gray-800';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        <h2 className="text-sm font-bold text-primary">등록 상담 상세</h2>
                        <span className={`px-2 py-0.5 rounded-sm text-xs font-medium ${statusColorClass}`}>
                            {record.status}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded-sm transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* 기본 정보 */}
                    <section className="space-y-2">
                        <h3 className="text-xs font-bold text-primary flex items-center gap-1">
                            <User className="w-4 h-4" />
                            학생 정보
                        </h3>
                        <div className="bg-gray-50 rounded-sm p-3 grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-gray-500">이름:</span>
                                <span className="ml-2 font-medium text-primary">{record.studentName}</span>
                            </div>
                            {record.englishName && (
                                <div>
                                    <span className="text-gray-500">영어이름:</span>
                                    <span className="ml-2 font-medium text-primary">{record.englishName}</span>
                                </div>
                            )}
                            <div>
                                <span className="text-gray-500">학교:</span>
                                <span className="ml-2 font-medium text-primary">{record.schoolName}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">학년:</span>
                                <span className="ml-2 font-medium text-primary">{record.grade}</span>
                            </div>
                            {record.gender && (
                                <div>
                                    <span className="text-gray-500">성별:</span>
                                    <span className="ml-2 font-medium text-primary">
                                        {record.gender === 'male' ? '남' : '여'}
                                    </span>
                                </div>
                            )}
                            {record.birthDate && (
                                <div>
                                    <span className="text-gray-500">생년월일:</span>
                                    <span className="ml-2 font-medium text-primary">{record.birthDate}</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 연락처 정보 */}
                    <section className="space-y-2">
                        <h3 className="text-xs font-bold text-primary flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            연락처
                        </h3>
                        <div className="bg-gray-50 rounded-sm p-3 grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-gray-500">학부모 연락처:</span>
                                <span className="ml-2 font-medium text-primary">{record.parentPhone || '-'}</span>
                            </div>
                            {record.parentName && (
                                <div>
                                    <span className="text-gray-500">보호자명:</span>
                                    <span className="ml-2 font-medium text-primary">
                                        {record.parentName}
                                        {record.parentRelation && ` (${record.parentRelation})`}
                                    </span>
                                </div>
                            )}
                            {record.studentPhone && (
                                <div>
                                    <span className="text-gray-500">학생 연락처:</span>
                                    <span className="ml-2 font-medium text-primary">{record.studentPhone}</span>
                                </div>
                            )}
                            {record.homePhone && (
                                <div>
                                    <span className="text-gray-500">집 전화:</span>
                                    <span className="ml-2 font-medium text-primary">{record.homePhone}</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 상담 정보 */}
                    <section className="space-y-2">
                        <h3 className="text-xs font-bold text-primary flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            상담 정보
                        </h3>
                        <div className="bg-gray-50 rounded-sm p-3 grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-gray-500">상담일:</span>
                                <span className="ml-2 font-medium text-primary">
                                    {record.consultationDate?.slice(0, 10) || '-'}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500">상담자:</span>
                                <span className="ml-2 font-medium text-primary">{record.counselor || '-'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">과목:</span>
                                <span className="ml-2 font-medium text-primary">{record.subject}</span>
                            </div>
                            {record.consultationPath && (
                                <div>
                                    <span className="text-gray-500">상담 경로:</span>
                                    <span className="ml-2 font-medium text-primary">{record.consultationPath}</span>
                                </div>
                            )}
                            {record.receiver && (
                                <div>
                                    <span className="text-gray-500">수신자:</span>
                                    <span className="ml-2 font-medium text-primary">{record.receiver}</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 상담 내용 */}
                    {record.notes && (
                        <section className="space-y-2">
                            <h3 className="text-xs font-bold text-primary flex items-center gap-1">
                                <FileText className="w-4 h-4" />
                                상담 내용
                            </h3>
                            <div className="bg-gray-50 rounded-sm p-3 text-xs text-primary whitespace-pre-wrap">
                                {record.notes}
                            </div>
                        </section>
                    )}

                    {/* 과목별 상담 정보 */}
                    {(record.mathConsultation || record.englishConsultation || record.koreanConsultation || record.etcConsultation) && (
                        <section className="space-y-2">
                            <h3 className="text-xs font-bold text-primary flex items-center gap-1">
                                <BookOpen className="w-4 h-4" />
                                과목별 상담 정보
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {record.mathConsultation && (
                                    <div className="bg-teal-50 rounded-sm p-3 text-xs">
                                        <div className="font-bold text-teal-900 mb-2">수학</div>
                                        {record.mathConsultation.recommendedClass && (
                                            <div className="text-teal-700">
                                                <span className="text-teal-500">추천반:</span> {record.mathConsultation.recommendedClass}
                                            </div>
                                        )}
                                        {record.mathConsultation.levelTestScore && (
                                            <div className="text-teal-700">
                                                <span className="text-teal-500">레벨:</span> {record.mathConsultation.levelTestScore}
                                            </div>
                                        )}
                                        {record.mathConsultation.notes && (
                                            <div className="text-teal-700 mt-1">
                                                <span className="text-teal-500">메모:</span> {record.mathConsultation.notes}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {record.englishConsultation && (
                                    <div className="bg-cyan-50 rounded-sm p-3 text-xs">
                                        <div className="font-bold text-cyan-900 mb-2">영어</div>
                                        {record.englishConsultation.recommendedClass && (
                                            <div className="text-cyan-700">
                                                <span className="text-cyan-500">추천반:</span> {record.englishConsultation.recommendedClass}
                                            </div>
                                        )}
                                        {record.englishConsultation.levelTestScore && (
                                            <div className="text-cyan-700">
                                                <span className="text-cyan-500">레벨:</span> {record.englishConsultation.levelTestScore}
                                            </div>
                                        )}
                                        {record.englishConsultation.notes && (
                                            <div className="text-cyan-700 mt-1">
                                                <span className="text-cyan-500">메모:</span> {record.englishConsultation.notes}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {record.koreanConsultation && (
                                    <div className="bg-purple-50 rounded-sm p-3 text-xs">
                                        <div className="font-bold text-purple-900 mb-2">국어</div>
                                        {record.koreanConsultation.recommendedClass && (
                                            <div className="text-purple-700">
                                                <span className="text-purple-500">추천반:</span> {record.koreanConsultation.recommendedClass}
                                            </div>
                                        )}
                                        {record.koreanConsultation.notes && (
                                            <div className="text-purple-700 mt-1">
                                                <span className="text-purple-500">메모:</span> {record.koreanConsultation.notes}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {record.etcConsultation && (
                                    <div className="bg-gray-100 rounded-sm p-3 text-xs">
                                        <div className="font-bold text-gray-900 mb-2">기타</div>
                                        {record.etcConsultation.notes && (
                                            <div className="text-gray-700">{record.etcConsultation.notes}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* 납부 정보 */}
                    {record.paymentAmount && record.paymentAmount !== '0' && (
                        <section className="space-y-2">
                            <h3 className="text-xs font-bold text-primary flex items-center gap-1">
                                <Banknote className="w-4 h-4" />
                                납부 정보
                            </h3>
                            <div className="bg-gray-50 rounded-sm p-3 text-xs">
                                <span className="text-gray-500">납부금액:</span>
                                <span className="ml-2 font-medium text-primary">
                                    {Number(record.paymentAmount).toLocaleString()}원
                                </span>
                            </div>
                        </section>
                    )}

                    {/* 주소 정보 */}
                    {record.address && (
                        <section className="space-y-2">
                            <h3 className="text-xs font-bold text-primary flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                주소
                            </h3>
                            <div className="bg-gray-50 rounded-sm p-3 text-xs text-primary">
                                {record.zipCode && <span className="text-gray-500">[{record.zipCode}] </span>}
                                {record.address}
                                {record.addressDetail && ` ${record.addressDetail}`}
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-sm text-xs font-bold hover:bg-gray-300 transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegistrationConsultationDetailModal;
