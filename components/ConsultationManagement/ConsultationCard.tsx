import React, { useState } from 'react';
import { Consultation, CATEGORY_CONFIG } from '../../types';
import { getFollowUpUrgency, getFollowUpDaysLeft } from '../../hooks/useStudentConsultations';
import ConsultationDetailModal from './ConsultationDetailModal';

interface ConsultationCardProps {
    consultation: Consultation;
}

/**
 * 개별 상담 카드 컴포넌트
 * - 브랜드 컬러 적용
 * - 호버 효과
 * - 후속 조치 배지 표시
 */
const ConsultationCard: React.FC<ConsultationCardProps> = ({ consultation }) => {
    const [showDetail, setShowDetail] = useState(false);

    const categoryConfig = CATEGORY_CONFIG[consultation.category];
    const urgency = getFollowUpUrgency(consultation);

    // 상담 유형 아이콘
    const typeIcon = consultation.type === 'parent' ? '👨‍👩‍👧' : '👤';
    const typeLabel = consultation.type === 'parent' ? '학부모 상담' : '학생 상담';

    // 과목 라벨
    const subjectLabel = consultation.subject === 'math' ? '수학'
        : consultation.subject === 'english' ? '영어'
        : consultation.subject === 'all' ? '전체'
        : null;

    return (
        <>
            <div
                onClick={() => setShowDetail(true)}
                className="bg-white border border-[#081429] rounded-lg p-6 hover:border-[#fdb813] hover:border-2 transition-all cursor-pointer"
            >
                {/* 헤더 */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{typeIcon}</span>
                            <span className="text-sm font-medium text-[#373d41]">{typeLabel}</span>
                            {subjectLabel && (
                                <span className="text-xs bg-[#081429] bg-opacity-10 text-[#081429] px-2 py-1 rounded">
                                    {subjectLabel}
                                </span>
                            )}
                        </div>
                        <h3 className="text-lg font-semibold text-[#081429] mb-1">
                            {consultation.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-[#373d41]">
                            <span>학생: {consultation.studentName}</span>
                            <span>상담자: {consultation.consultantName}</span>
                            <span>{consultation.date}</span>
                            {consultation.time && <span>{consultation.time}</span>}
                        </div>
                    </div>

                    {/* 후속 조치 배지 */}
                    {urgency && (
                        <div>
                            {urgency === 'urgent' && consultation.followUpDate && (
                                <span className="bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold">
                                    긴급 {getFollowUpDaysLeft(consultation.followUpDate)}일
                                </span>
                            )}
                            {urgency === 'pending' && (
                                <span className="bg-[#fdb813] text-[#081429] px-3 py-1 rounded text-xs font-semibold">
                                    대기 중
                                </span>
                            )}
                            {urgency === 'done' && (
                                <span className="bg-green-600 text-white px-3 py-1 rounded text-xs font-semibold">
                                    완료
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* 카테고리 및 내용 미리보기 */}
                <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-lg">{categoryConfig.icon}</span>
                        <span className="text-sm font-medium" style={{ color: categoryConfig.color }}>
                            {categoryConfig.label}
                        </span>
                    </div>
                </div>

                {/* 내용 미리보기 */}
                <p className="mt-3 text-sm text-[#373d41] line-clamp-2">
                    {consultation.content}
                </p>

                {/* 학부모 정보 (학부모 상담일 경우) */}
                {consultation.type === 'parent' && consultation.parentName && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-[#373d41]">
                        <span>학부모: {consultation.parentName}</span>
                        {consultation.parentRelation && (
                            <span className="ml-2">({consultation.parentRelation})</span>
                        )}
                    </div>
                )}

                {/* 학생 상담 컨디션 */}
                {consultation.type === 'student' && consultation.studentMood && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2">
                        <span className="text-sm text-[#373d41]">학생 컨디션:</span>
                        {consultation.studentMood === 'positive' && (
                            <span className="text-sm text-green-600">😊 긍정적</span>
                        )}
                        {consultation.studentMood === 'neutral' && (
                            <span className="text-sm text-gray-600">😐 보통</span>
                        )}
                        {consultation.studentMood === 'negative' && (
                            <span className="text-sm text-red-600">😔 부정적</span>
                        )}
                    </div>
                )}
            </div>

            {/* 상세 모달 */}
            {showDetail && (
                <ConsultationDetailModal
                    consultation={consultation}
                    onClose={() => setShowDetail(false)}
                />
            )}
        </>
    );
};

export default ConsultationCard;
