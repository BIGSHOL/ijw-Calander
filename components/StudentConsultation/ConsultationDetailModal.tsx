import React, { useState } from 'react';
import { ClipboardList, FileText, Bell } from 'lucide-react';
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="bg-[#081429] text-white px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold">상담 상세</h2>
                        <p className="text-sm text-gray-300 mt-1">{typeLabel}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="bg-[#fdb813] hover:bg-[#e5a711] text-[#081429] px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                            수정
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                            삭제
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                            닫기
                        </button>
                    </div>
                </div>

                {/* 내용 */}
                <div className="p-6 space-y-6">
                    {/* 기본 정보 */}
                    <section>
                        <h3 className="text-lg font-bold text-[#081429] mb-3 flex items-center gap-2">
                            <ClipboardList className="inline-block w-5 h-5 mr-1" />
                            기본 정보
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{typeIcon}</span>
                                <span className="font-semibold text-[#081429]">{consultation.studentName}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-[#373d41]">상담자:</span>
                                    <span className="ml-2 text-[#081429] font-medium">
                                        {registrar}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[#373d41]">담임선생님:</span>
                                    <span className="ml-2 text-[#081429] font-medium">
                                        {consultation.consultantName}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[#373d41]">날짜:</span>
                                    <span className="ml-2 text-[#081429] font-medium">
                                        {consultation.date}
                                        {consultation.time && ` ${consultation.time}`}
                                    </span>
                                </div>
                                {consultation.duration && (
                                    <div>
                                        <span className="text-[#373d41]">소요 시간:</span>
                                        <span className="ml-2 text-[#081429] font-medium">
                                            {consultation.duration}분
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-[#373d41]">카테고리:</span>
                                    <span className="ml-2 text-[#081429] font-medium">
                                        {categoryConfig.icon} {categoryConfig.label}
                                    </span>
                                </div>
                            </div>

                            {/* 학부모 상담 정보 */}
                            {consultation.type === 'parent' && consultation.parentName && (
                                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                                    <div>
                                        <span className="text-[#373d41]">학부모:</span>
                                        <span className="ml-2 text-[#081429] font-medium">
                                            {consultation.parentName}
                                        </span>
                                        {consultation.parentRelation && (
                                            <span className="ml-1 text-[#373d41]">
                                                ({consultation.parentRelation})
                                            </span>
                                        )}
                                    </div>
                                    {consultation.parentContact && (
                                        <div>
                                            <span className="text-[#373d41]">연락처:</span>
                                            <span className="ml-2 text-[#081429] font-medium">
                                                {consultation.parentContact}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 학생 상담 컨디션 */}
                            {consultation.type === 'student' && consultation.studentMood && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <span className="text-[#373d41]">학생 컨디션:</span>
                                    {consultation.studentMood === 'positive' && (
                                        <span className="ml-2 text-green-600 font-medium">😊 긍정적</span>
                                    )}
                                    {consultation.studentMood === 'neutral' && (
                                        <span className="ml-2 text-gray-600 font-medium">😐 보통</span>
                                    )}
                                    {consultation.studentMood === 'negative' && (
                                        <span className="ml-2 text-red-600 font-medium">😔 부정적</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 상담 내용 */}
                    <section>
                        <h3 className="text-lg font-bold text-[#081429] mb-3 flex items-center gap-2">
                            <FileText className="inline-block w-5 h-5 mr-1" />
                            상담 내용
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-semibold text-[#081429] mb-2">
                                {consultation.title}
                            </h4>
                            <div className="text-[#373d41] whitespace-pre-wrap">
                                {consultation.content}
                            </div>
                        </div>
                    </section>

                    {/* 후속 조치 */}
                    {consultation.followUpNeeded && (
                        <section>
                            <h3 className="text-lg font-bold text-[#081429] mb-3 flex items-center gap-2">
                                <Bell className="inline-block w-5 h-5 mr-1" />
                                후속 조치
                            </h3>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-[#373d41]">상태:</span>
                                    {urgency === 'urgent' && consultation.followUpDate && (
                                        <span className="bg-red-600 text-white px-3 py-1 rounded text-sm font-semibold">
                                            긴급 {getFollowUpDaysLeft(consultation.followUpDate)}일 남음
                                        </span>
                                    )}
                                    {urgency === 'pending' && (
                                        <span className="bg-[#fdb813] text-[#081429] px-3 py-1 rounded text-sm font-semibold">
                                            대기 중
                                        </span>
                                    )}
                                    {urgency === 'done' && (
                                        <span className="bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold">
                                            완료
                                        </span>
                                    )}
                                </div>

                                {consultation.followUpDate && (
                                    <div>
                                        <span className="text-sm text-[#373d41]">예정일:</span>
                                        <span className="ml-2 text-[#081429] font-medium">
                                            {consultation.followUpDate}
                                        </span>
                                    </div>
                                )}

                                {consultation.followUpDone && consultation.followUpNotes && (
                                    <div>
                                        <span className="text-sm text-[#373d41]">완료 메모:</span>
                                        <p className="mt-1 text-sm text-[#081429]">
                                            {consultation.followUpNotes}
                                        </p>
                                    </div>
                                )}

                                {!consultation.followUpDone && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <label className="block text-sm font-medium text-[#373d41] mb-2">
                                            완료 메모 (선택)
                                        </label>
                                        <textarea
                                            value={followUpNotes}
                                            onChange={(e) => setFollowUpNotes(e.target.value)}
                                            className="w-full border border-[#081429] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                            rows={3}
                                            placeholder="후속 조치 결과를 입력하세요..."
                                        />
                                        <button
                                            onClick={handleCompleteFollowUp}
                                            disabled={completeFollowUp.isPending}
                                            className="mt-3 bg-[#fdb813] text-[#081429] px-6 py-2 rounded-lg font-semibold hover:bg-[#e5a711] transition-colors disabled:opacity-50"
                                        >
                                            {completeFollowUp.isPending ? '처리 중...' : '후속 조치 완료'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {/* 삭제 확인 모달 */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-[#081429] mb-4">
                            정말 삭제하시겠습니까?
                        </h3>
                        <p className="text-[#373d41] mb-6">
                            이 작업은 되돌릴 수 없습니다.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="border border-[#081429] text-[#081429] px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleteConsultation.isPending}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {deleteConsultation.isPending ? '삭제 중...' : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 수정 모달 (AddConsultationModal 재사용) */}
            {showEditModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white w-full max-w-2xl h-[90vh] rounded-lg shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
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
