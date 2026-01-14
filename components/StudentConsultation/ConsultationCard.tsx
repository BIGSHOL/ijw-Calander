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

    return (
        <>
            <div
                onClick={() => setShowDetail(true)}
                className="flex items-center gap-3 px-3 py-2 bg-white border-b border-gray-100 hover:bg-[#fdb813]/5 transition-colors cursor-pointer"
            >
                {/* 날짜 */}
                <span className="text-xs text-[#373d41] w-20 shrink-0">
                    {consultation.date}
                </span>

                {/* 학생명 */}
                <span className="text-sm font-medium text-[#081429] w-16 shrink-0 truncate">
                    {consultation.studentName}
                </span>

                {/* 제목 */}
                <span className="text-sm text-[#081429] flex-1 truncate">
                    {consultation.title}
                </span>

                {/* 뱃지들 */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* 상담 유형 */}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                        consultation.type === 'parent'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                    }`}>
                        {consultation.type === 'parent' ? '학부모' : '학생'}
                    </span>

                    {/* 카테고리 */}
                    <span
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{
                            backgroundColor: `${categoryConfig.color}15`,
                            color: categoryConfig.color
                        }}
                    >
                        {categoryConfig.icon}
                    </span>

                    {/* 후속 조치 */}
                    {urgency && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            urgency === 'urgent' ? 'bg-red-600 text-white' :
                            urgency === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                        }`}>
                            {urgency === 'urgent' && consultation.followUpDate && `D-${getFollowUpDaysLeft(consultation.followUpDate)}`}
                            {urgency === 'pending' && '대기'}
                            {urgency === 'done' && '✓'}
                        </span>
                    )}
                </div>
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
