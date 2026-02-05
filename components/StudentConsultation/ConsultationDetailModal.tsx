import React, { useState } from 'react';
import { ClipboardList, FileText, Users, Bell, Settings, X } from 'lucide-react';
import { Consultation, CATEGORY_CONFIG } from '../../types';
import { useDeleteConsultation, useCompleteFollowUp } from '../../hooks/useConsultationMutations';
import { getFollowUpUrgency, getFollowUpDaysLeft } from '../../hooks/useStudentConsultations';

// Lazy load AddConsultationModal to avoid circular dependencies if any
const AddConsultationModal = React.lazy(() => import('./AddConsultationModal'));

interface ConsultationDetailModalProps {
    consultation: Consultation;
    onClose: () => void;
}

/**
 * 상담 상세 모달
 * - 전체 상담 내용 표시
 * - 편집/삭제 기능
 * - 후속 조치 완료 처리
 */
const ConsultationDetailModal: React.FC<ConsultationDetailModalProps> = ({
    consultation,
    onClose,
}) => {
    const [followUpNotes, setFollowUpNotes] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    const deleteConsultation = useDeleteConsultation();
    const completeFollowUp = useCompleteFollowUp();

    const categoryConfig = CATEGORY_CONFIG[consultation.category] || CATEGORY_CONFIG['other'];
    const urgency = getFollowUpUrgency(consultation);

    const typeIcon = consultation.type === 'parent' ? '👨‍👩‍👧' : '👤';
    const typeLabel = consultation.type === 'parent' ? '학부모 상담' : '학생 상담';

    // 등록자 정보 파싱 (from ConsultationCard.tsx)
    const registrar = React.useMemo(() => {
        // 1. 마이그레이션 데이터: 내용에 [등록자: 이름] 포함된 경우
        const match = consultation.content.match(/\[등록자:\s*(.*?)\]/);
        if (match && match[1]) return match[1];

        // 2. 수동 등록 데이터: createdBy는 id이므로 여기서 이름을 알기는 어려움.
        // 현재는 마이그레이션된 '등록자' 표시가 주 목적이므로 이 로직으로 충분할 수 있음.
        return '-';
    }, [consultation.content]);

    const handleDelete = async () => {
        try {
            await deleteConsultation.mutateAsync(consultation.id);
            onClose();
        } catch (error) {
            console.error('삭제 실패:', error);
            alert('상담 기록 삭제에 실패했습니다.');
        }
    };

    const handleCompleteFollowUp = async () => {
        try {
            await completeFollowUp.mutateAsync({
                id: consultation.id,
                notes: followUpNotes,
            });
            alert('후속 조치가 완료되었습니다.');
            onClose();
        } catch (error) {
            console.error('후속 조치 완료 실패:', error);
            alert('후속 조치 완료 처리에 실패했습니다.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100] p-4" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <h2 className="text-sm font-bold text-primary">상담 상세 - {typeLabel}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 내용 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-2">
                    {/* Section 1: 상담 기본 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <ClipboardList className="w-3 h-3 text-primary" />
                            <h3 className="text-primary font-bold text-xs">상담 기본 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {/* Type & Category Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">유형</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{typeIcon}</span>
                                    <span className="text-xs font-medium text-primary">{typeLabel}</span>
                                </div>
                            </div>

                            {/* Category Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">카테고리</span>
                                <span className="text-xs text-primary">
                                    {categoryConfig.icon} {categoryConfig.label}
                                </span>
                            </div>

                            {/* Date Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">날짜</span>
                                <span className="text-xs text-primary font-medium">
                                    {consultation.date}
                                    {consultation.time && ` ${consultation.time}`}
                                </span>
                            </div>

                            {/* Duration Row */}
                            {consultation.duration && (
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <span className="w-16 shrink-0 text-xs font-medium text-primary-700">소요 시간</span>
                                    <span className="text-xs text-primary font-medium">
                                        {consultation.duration}분
                                    </span>
                                </div>
                            )}

                            {/* Registrar Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">상담자</span>
                                <span className="text-xs text-primary font-medium">{registrar}</span>
                            </div>

                            {/* Consultant Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">담임선생님</span>
                                <span className="text-xs text-primary font-medium">
                                    {consultation.consultantName}
                                </span>
                            </div>

                            {/* 학부모 상담 정보 */}
                            {consultation.type === 'parent' && consultation.parentName && (
                                <>
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <span className="w-16 shrink-0 text-xs font-medium text-primary-700">학부모</span>
                                        <span className="text-xs text-primary font-medium">
                                            {consultation.parentName}
                                            {consultation.parentRelation && (
                                                <span className="ml-1 text-primary-700">
                                                    ({consultation.parentRelation})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {consultation.parentContact && (
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                            <span className="w-16 shrink-0 text-xs font-medium text-primary-700">연락처</span>
                                            <span className="text-xs text-primary font-medium">
                                                {consultation.parentContact}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* 학생 상담 컨디션 */}
                            {consultation.type === 'student' && consultation.studentMood && (
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <span className="w-16 shrink-0 text-xs font-medium text-primary-700">학생 컨디션</span>
                                    <span className="text-xs">
                                        {consultation.studentMood === 'positive' && (
                                            <span className="text-green-600 font-medium">😊 긍정적</span>
                                        )}
                                        {consultation.studentMood === 'neutral' && (
                                            <span className="text-gray-600 font-medium">😐 보통</span>
                                        )}
                                        {consultation.studentMood === 'negative' && (
                                            <span className="text-red-600 font-medium">😔 부정적</span>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 2: 상담 내용 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <FileText className="w-3 h-3 text-primary" />
                            <h3 className="text-primary font-bold text-xs">상담 내용</h3>
                        </div>
                        <div className="p-2">
                            <div className="px-2 py-1.5">
                                <h4 className="text-xs font-semibold text-primary mb-2">
                                    {consultation.title}
                                </h4>
                                <div className="text-xs text-primary-700 whitespace-pre-wrap">
                                    {consultation.content}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: 학생 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Users className="w-3 h-3 text-primary" />
                            <h3 className="text-primary font-bold text-xs">학생 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {/* Student Name Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">이름</span>
                                <span className="text-xs font-semibold text-primary">{consultation.studentName}</span>
                            </div>

                            {/* School Row */}
                            {consultation.school && (
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <span className="w-16 shrink-0 text-xs font-medium text-primary-700">학교</span>
                                    <span className="text-xs text-primary">{consultation.school}</span>
                                </div>
                            )}

                            {/* Grade Row */}
                            {consultation.grade && (
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <span className="w-16 shrink-0 text-xs font-medium text-primary-700">학년</span>
                                    <span className="text-xs text-primary">{consultation.grade}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 4: 후속 조치 */}
                    {consultation.followUpNeeded && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <Bell className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">후속 조치</h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {/* Status Row */}
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <span className="w-16 shrink-0 text-xs font-medium text-primary-700">상태</span>
                                    <div>
                                        {urgency === 'urgent' && consultation.followUpDate && (
                                            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-semibold">
                                                긴급 {getFollowUpDaysLeft(consultation.followUpDate)}일 남음
                                            </span>
                                        )}
                                        {urgency === 'pending' && (
                                            <span className="bg-accent text-primary px-2 py-0.5 rounded text-xs font-semibold">
                                                대기 중
                                            </span>
                                        )}
                                        {urgency === 'done' && (
                                            <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-semibold">
                                                완료
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Follow-up Date Row */}
                                {consultation.followUpDate && (
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <span className="w-16 shrink-0 text-xs font-medium text-primary-700">예정일</span>
                                        <span className="text-xs text-primary font-medium">
                                            {consultation.followUpDate}
                                        </span>
                                    </div>
                                )}

                                {/* Completion Notes Row */}
                                {consultation.followUpDone && consultation.followUpNotes && (
                                    <div className="px-2 py-1.5">
                                        <span className="text-xs font-medium text-primary-700 block mb-1">완료 메모</span>
                                        <p className="text-xs text-primary whitespace-pre-wrap">
                                            {consultation.followUpNotes}
                                        </p>
                                    </div>
                                )}

                                {/* Complete Follow-up Form */}
                                {!consultation.followUpDone && (
                                    <div className="px-2 py-2">
                                        <label className="block text-xs font-medium text-primary-700 mb-1.5">
                                            완료 메모 (선택)
                                        </label>
                                        <textarea
                                            value={followUpNotes}
                                            onChange={(e) => setFollowUpNotes(e.target.value)}
                                            className="w-full border border-gray-300 rounded-sm px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                                            rows={3}
                                            placeholder="후속 조치 결과를 입력하세요..."
                                        />
                                        <button
                                            onClick={handleCompleteFollowUp}
                                            disabled={completeFollowUp.isPending}
                                            className="mt-2 bg-accent text-primary px-4 py-1.5 rounded-sm text-xs font-semibold hover:bg-[#e5a711] transition-colors disabled:opacity-50"
                                        >
                                            {completeFollowUp.isPending ? '처리 중...' : '후속 조치 완료'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Section 5: 작업 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Settings className="w-3 h-3 text-primary" />
                            <h3 className="text-primary font-bold text-xs">작업</h3>
                        </div>
                        <div className="p-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowEditModal(true)}
                                    className="bg-accent hover:bg-[#e5a711] text-primary px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors"
                                >
                                    수정
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors"
                                >
                                    삭제
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 삭제 확인 모달 */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 bg-black bg-opacity-70 flex items-start justify-center pt-[8vh]" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white rounded-sm p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-primary mb-4">
                            정말 삭제하시겠습니까?
                        </h3>
                        <p className="text-primary-700 mb-6">
                            이 작업은 되돌릴 수 없습니다.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="border border-primary text-primary px-4 py-2 rounded-sm hover:bg-gray-50 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleteConsultation.isPending}
                                className="bg-red-600 text-white px-4 py-2 rounded-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {deleteConsultation.isPending ? '삭제 중...' : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 수정 모달 (AddConsultationModal 재사용) */}
            {showEditModal && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[8vh] bg-black bg-opacity-50" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white w-full max-w-2xl h-[90vh] rounded-sm shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <AddConsultationModal
                            onClose={() => setShowEditModal(false)}
                            onSuccess={() => {
                                setShowEditModal(false);
                                onClose(); // 수정 완료 시 상세 모달도 닫기
                            }}
                            editingConsultation={consultation}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsultationDetailModal;
