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
            <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div
                        key={n}
                        className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 animate-pulse"
                    >
                        <div className="h-3 bg-primary/10 rounded w-10"></div>
                        <div className="h-3 bg-primary/10 rounded w-12"></div>
                        <div className="h-4 bg-primary/10 rounded w-16"></div>
                        <div className="h-4 bg-primary/10 rounded flex-1"></div>
                    </div>
                ))}
            </div>
        );
    }

    // 빈 상태 (전체 데이터가 없을 때)
    if (totalCount === 0 && !loading) {
        return (
            <div className="bg-white border border-primary border-opacity-20 rounded-sm p-12 text-center">
                <div className="mb-4">
                    <FileText className="w-16 h-16 mx-auto text-gray-300" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-2">
                    상담 기록이 없습니다
                </h3>
                <p className="text-primary-700 mb-6">
                    새 상담 기록을 추가하거나 필터를 조정해보세요.
                </p>
                <button
                    onClick={onRefresh}
                    className="border border-primary text-primary px-6 py-2 rounded-sm hover:bg-primary hover:text-white transition-colors"
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
                    <p className="text-sm" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                        총 <span className="font-semibold" style={{ color: 'rgb(8, 20, 41)' /* primary */ }}>{totalCount}</span>개의 상담 기록
                        {loading && <Loader2 className="inline-block w-3 h-3 ml-1 animate-spin" style={{ color: 'rgb(253, 184, 19)' /* accent */ }} />}
                    </p>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>페이지당</span>
                    <select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        className="px-2 py-1 text-xs rounded-sm border transition-all"
                        style={{ borderColor: 'rgba(8, 20, 41, 0.2)', color: 'rgb(8, 20, 41)', backgroundColor: 'white' }}
                    >
                        <option value={10}>10개</option>
                        <option value={20}>20개</option>
                        <option value={50}>50개</option>
                        <option value={100}>100개</option>
                    </select>
                    <span className="text-xs hidden sm:inline" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                        {startIndex + 1}-{Math.min(startIndex + pageSize, totalCount)} / 총 {totalCount}개
                    </span>
                </div>

                <nav className="flex items-center gap-1" aria-label="Pagination">
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={!hasPrevPage || loading}
                        className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                        style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
                    >
                        이전
                    </button>
                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (currentPage <= 3) {
                                pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = currentPage - 2 + i;
                            }

                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => goToPage(pageNum)}
                                    disabled={loading}
                                    className={`w-6 h-6 rounded-full text-xs font-bold transition-colors text-primary ${
                                        currentPage === pageNum
                                            ? ''
                                            : 'hover:bg-gray-100'
                                    }`}
                                    style={{ backgroundColor: currentPage === pageNum ? '#fdb813' : 'transparent' }}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={!hasNextPage || loading}
                        className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                        style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
                    >
                        다음
                    </button>
                </nav>
            </div>

            <div className="bg-white rounded-sm border border-gray-200 min-w-[1200px]">
                {/* 헤더 행 */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-primary-700">
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
