import React from 'react';
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
    // 로딩 상태
    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((n) => (
                    <div
                        key={n}
                        className="bg-white border border-[#081429] border-opacity-10 rounded-lg p-6 animate-pulse"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                                <div className="h-6 bg-[#081429] bg-opacity-10 rounded w-2/3 mb-2"></div>
                                <div className="h-4 bg-[#081429] bg-opacity-10 rounded w-1/3"></div>
                            </div>
                            <div className="h-8 w-20 bg-[#081429] bg-opacity-10 rounded"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 bg-[#081429] bg-opacity-10 rounded w-full"></div>
                            <div className="h-4 bg-[#081429] bg-opacity-10 rounded w-5/6"></div>
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
                <div className="text-6xl mb-4">📝</div>
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

            <div className="space-y-4">
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
