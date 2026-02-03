import React, { useState, useMemo } from 'react';
import { Consultation, CATEGORY_CONFIG, UnifiedStudent, StaffMember } from '../../types';
import { getFollowUpUrgency, getFollowUpDaysLeft } from '../../hooks/useStudentConsultations';
import ConsultationDetailModal from './ConsultationDetailModal';

interface ConsultationCardProps {
    index: number;
    consultation: Consultation;
    students: UnifiedStudent[];
    staff: StaffMember[];
}

/**
 * 개별 상담 카드 컴포넌트 (테이블 행 형태)
 * Updated for table layout
 */
const ConsultationCard: React.FC<ConsultationCardProps> = ({
    index,
    consultation,
    students,
    staff
}) => {
    const [showDetail, setShowDetail] = useState(false);

    const categoryConfig = CATEGORY_CONFIG[consultation.category] || CATEGORY_CONFIG['other'];
    const urgency = getFollowUpUrgency(consultation);

    // 학생 정보 매칭
    const matchedStudent = useMemo(() => {
        return students.find(s => s.id === consultation.studentId);
    }, [students, consultation.studentId]);

    // 등록자 정보 파싱
    const registrar = useMemo(() => {
        // 1. 마이그레이션 데이터: 내용에 [등록자: 이름] 포함된 경우
        const match = consultation.content.match(/\[등록자:\s*(.*?)\]/);
        if (match && match[1]) return match[1];

        // 2. 수동 등록 데이터: createdBy로 Staff 검색
        if (consultation.createdBy && staff) {
            const creator = staff.find(s => s.id === consultation.createdBy);
            if (creator) return creator.name;
        }

        return '-';
    }, [consultation.content, consultation.createdBy, staff]);

    return (
        <>
            <div
                onClick={() => setShowDetail(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-gray-100 hover:bg-[#fdb813]/5 transition-colors cursor-pointer text-xs text-[#373d41]"
            >
                {/* No */}
                <span className="w-10 shrink-0 text-center text-gray-500 font-mono text-xxs">
                    {index}
                </span>

                {/* 날짜 */}
                <span className="w-20 shrink-0 text-center text-xxs text-gray-500">
                    {consultation.date}
                </span>

                {/* 상태 */}
                <div className="w-14 shrink-0 text-center flex justify-center">
                    {matchedStudent ? (
                        (() => {
                            switch (matchedStudent.status) {
                                case 'prospect':
                                    return <span className="text-xxs bg-orange-100 text-orange-800 px-1 py-0.5 rounded font-medium border border-orange-200">예비</span>;
                                case 'active':
                                    return <span className="text-xxs bg-green-100 text-green-800 px-1 py-0.5 rounded font-medium">재원</span>;
                                case 'on_hold':
                                    return <span className="text-xxs bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-medium">휴원/대기</span>;
                                case 'withdrawn':
                                    return <span className="text-xxs bg-red-100 text-red-800 px-1 py-0.5 rounded font-medium">퇴원</span>;
                                default:
                                    return <span className="text-xxs text-gray-400">-</span>;
                            }
                        })()
                    ) : (
                        <span className="text-xxs text-gray-400">-</span>
                    )}
                </div>

                {/* 구분 */}
                <div className="w-12 shrink-0 text-center flex justify-center">
                    <span className={`px-1 py-0.5 rounded text-xxs leading-none ${consultation.type === 'parent'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                        }`}>
                        {consultation.type === 'parent' ? '학부모' : '학생'}
                    </span>
                </div>

                {/* 이름 */}
                <span className="w-16 shrink-0 text-center font-medium text-[#081429] text-xs truncate">
                    {consultation.studentName}
                </span>

                {/* 학교 */}
                <span className="w-16 shrink-0 text-center truncate text-xxs text-gray-500">
                    {matchedStudent?.school || '-'}
                </span>

                {/* 학년 */}
                <span className="w-10 shrink-0 text-center truncate text-xxs text-gray-500">
                    {matchedStudent?.grade || '-'}
                </span>

                {/* 보호자 연락처 */}
                <span className="w-24 shrink-0 text-center truncate text-xxs text-gray-500 font-mono">
                    {matchedStudent?.parentPhone || '-'}
                </span>

                {/* 원생 연락처 */}
                <span className="w-24 shrink-0 text-center truncate text-xxs text-gray-500 font-mono">
                    {matchedStudent?.studentPhone || '-'}
                </span>

                {/* 제목 (카테고리 뱃지를 앞으로) */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    {/* 카테고리 뱃지 */}
                    <span
                        className="px-1 py-0.5 rounded text-xxs shrink-0"
                        style={{
                            backgroundColor: `${categoryConfig.color}15`,
                            color: categoryConfig.color
                        }}
                    >
                        {categoryConfig.label}
                    </span>
                    {/* 후속조치 뱃지 */}
                    {urgency && (
                        <span className={`px-1 py-0.5 rounded text-xxs font-medium shrink-0 ${urgency === 'urgent' ? 'bg-red-600 text-white' :
                            urgency === 'pending' ? 'bg-amber-100 text-amber-700' :
                                'bg-green-100 text-green-700'
                            }`}>
                            {urgency === 'urgent' && consultation.followUpDate && `D-${getFollowUpDaysLeft(consultation.followUpDate)}`}
                            {urgency === 'pending' && '대기'}
                            {urgency === 'done' && '✓'}
                        </span>
                    )}
                    <span className="truncate text-[#081429] text-xs">
                        {consultation.title}
                    </span>
                </div>

                {/* 등록자 */}
                <span className="w-20 shrink-0 text-center truncate text-xxs text-gray-500">
                    {registrar}
                </span>

                {/* 담당선생님 */}
                <span className="w-20 shrink-0 text-center truncate font-medium text-[#081429] text-xs">
                    {consultation.consultantName || '-'}
                </span>
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
