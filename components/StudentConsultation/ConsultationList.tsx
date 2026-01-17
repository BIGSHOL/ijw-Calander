import React from 'react';
import { FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { Consultation, UnifiedStudent, StaffMember } from '../../types';
import ConsultationCard from './ConsultationCard';

interface ConsultationListProps {
    consultations: Consultation[];
    loading: boolean;
    onRefresh: () => void;
    students: UnifiedStudent[];
    staff: StaffMember[];
    // 서버 측 페이지네이션 props
    totalCount: number;
    currentPage: number;
    totalPages: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

/**
 * 상담 기록 목록 컴포넌트
 * - 카드 형태로 표시
 * - 로딩/빈 상태 처리
 * - Skeleton UI
 * - 서버 측 페이지네이션 (10/20/50/100개씩 보기)
 */
const ConsultationList: React.FC<ConsultationListProps> = ({
    consultations,
    loading,
    onRefresh,
    students,
    staff,
    totalCount,
    currentPage,
    totalPages,
    pageSize,
    hasNextPage,
    hasPrevPage,
    onPageChange,
    onPageSizeChange,
}) => {
    // 페이지 사이즈 변경 핸들러
    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onPageSizeChange(Number(e.target.value));
    };

    // 페이지 이동 핸들러
    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
        }
    };

    // 로딩 상태 - 행 형태 스켈레톤
    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div
                        key={n}
                        className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 animate-pulse"
                    >
                        <div className="h-3 bg-[#081429]/10 rounded w-10"></div>
                        <div className="h-3 bg-[#081429]/10 rounded w-12"></div>
                        <div className="h-4 bg-[#081429]/10 rounded w-16"></div>
                        <div className="h-4 bg-[#081429]/10 rounded flex-1"></div>
                    </div>
                ))}
            </div>
        );
    }

    // 빈 상태 (전체 데이터가 없을 때)
    if (totalCount === 0 && !loading) {
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

    // 현재 페이지의 시작 인덱스 계산 (전체 기준)
    const startIndex = (currentPage - 1) * pageSize;

    // 상담 목록 표시
    return (
        <div className="overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <p className="text-sm text-[#373d41]">
                        총 <span className="font-semibold text-[#081429]">{totalCount}</span>개의 상담 기록
                        {loading && <Loader2 className="inline-block w-3 h-3 ml-1 animate-spin text-[#fdb813]" />}
                    </p>
                    <span className="text-gray-300">|</span>
                    <select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        className="bg-white border border-gray-300 text-gray-700 text-xs rounded px-2 py-1 focus:outline-none focus:border-[#fdb813]"
                    >
                        <option value={10}>10개씩 보기</option>
                        <option value={20}>20개씩 보기</option>
                        <option value={50}>50개씩 보기</option>
                        <option value={100}>100개씩 보기</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    {/* 페이지네이션 버튼 */}
                    <div className="flex items-center bg-white rounded-md border border-gray-200">
                        <button
                            onClick={() => goToPage(1)}
                            disabled={!hasPrevPage || loading}
                            className="p-1 text-gray-500 hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="첫 페이지"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={!hasPrevPage || loading}
                            className="p-1 text-gray-500 hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed border-l border-gray-100"
                            title="이전 페이지"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 text-xs font-medium text-[#373d41]">
                            {currentPage} / {totalPages || 1}
                        </span>
                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={!hasNextPage || loading}
                            className="p-1 text-gray-500 hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed border-l border-gray-100"
                            title="다음 페이지"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => goToPage(totalPages)}
                            disabled={!hasNextPage || loading}
                            className="p-1 text-gray-500 hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed border-l border-gray-100"
                            title="마지막 페이지"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>

                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="text-sm text-[#081429] hover:text-[#fdb813] transition-colors ml-2 disabled:opacity-50"
                    >
                        새로고침
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 min-w-[1200px]">
                {/* 헤더 행 */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-[#373d41]">
                    <span className="w-10 shrink-0 text-center">No</span>
                    <span className="w-20 shrink-0 text-center">날짜</span>
                    <span className="w-14 shrink-0 text-center">상태</span>
                    <span className="w-12 shrink-0 text-center">구분</span>
                    <span className="w-16 shrink-0 text-center">이름</span>
                    <span className="w-16 shrink-0 text-center">학교</span>
                    <span className="w-10 shrink-0 text-center">학년</span>
                    <span className="w-24 shrink-0 text-center">보호자연락처</span>
                    <span className="w-24 shrink-0 text-center">원생연락처</span>
                    <span className="flex-1 text-center">제목</span>
                    <span className="w-20 shrink-0 text-center">상담자</span>
                    <span className="w-20 shrink-0 text-center">담임선생님</span>
                </div>
                {consultations.map((consultation, index) => (
                    <ConsultationCard
                        key={consultation.id}
                        index={totalCount - (startIndex + index)}
                        consultation={consultation}
                        students={students}
                        staff={staff}
                    />
                ))}
            </div>
        </div>
    );
};

export default ConsultationList;
