import React from 'react';
import { FileText } from 'lucide-react';
import { Consultation } from '../../types';
import ConsultationCard from './ConsultationCard';

interface ConsultationListProps {
    consultations: Consultation[];
    loading: boolean;
    onRefresh: () => void;
}

/**
 * 상담 기록 목록 컴포넌트
 * - 카드 형태로 표시
 * - 로딩/빈 상태 처리
 * - Skeleton UI
 */
const ConsultationList: React.FC<ConsultationListProps> = ({
    consultations,
    loading,
    onRefresh,
}) => {
    // 로딩 상태 - 행 형태 스켈레톤
    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div
                        key={n}
                        className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 animate-pulse"
                    >
                        <div className="h-3 bg-[#081429]/10 rounded w-20"></div>
                        <div className="h-4 bg-[#081429]/10 rounded w-16"></div>
                        <div className="h-4 bg-[#081429]/10 rounded flex-1"></div>
                        <div className="flex gap-1">
                            <div className="h-5 w-10 bg-[#081429]/10 rounded"></div>
                            <div className="h-5 w-6 bg-[#081429]/10 rounded"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // 빈 상태
    if (consultations.length === 0) {
        return (
            <div className="bg-white border border-[#081429] border-opacity-20 rounded-lg p-12 text-center">
                <div className="mb-4">
                    <FileText className="w-16 h-16 mx-auto text-gray-300" />
                </div>
                <h3 className="text-xl font-semibold text-[#081429] mb-2">
                    상담 기록이 없습니다
                </h3>
                <p className="text-[#373d41] mb-6">
                    새 상담 기록을 추가하거나 필터를 조정해보세요.
                </p>
                <button
                    onClick={onRefresh}
                    className="border border-[#081429] text-[#081429] px-6 py-2 rounded-lg hover:bg-[#081429] hover:text-white transition-colors"
                >
                    새로고침
                </button>
            </div>
        );
    }

    // 상담 목록 표시
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-[#373d41]">
                    총 <span className="font-semibold text-[#081429]">{consultations.length}</span>개의 상담 기록
                </p>
                <button
                    onClick={onRefresh}
                    className="text-sm text-[#081429] hover:text-[#fdb813] transition-colors"
                >
                    새로고침
                </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* 헤더 행 */}
                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-[#373d41]">
                    <span className="w-20 shrink-0">날짜</span>
                    <span className="w-16 shrink-0">학생</span>
                    <span className="flex-1">제목</span>
                    <span className="shrink-0">유형</span>
                </div>
                {consultations.map((consultation) => (
                    <ConsultationCard
                        key={consultation.id}
                        consultation={consultation}
                    />
                ))}
            </div>
        </div>
    );
};

export default ConsultationList;
