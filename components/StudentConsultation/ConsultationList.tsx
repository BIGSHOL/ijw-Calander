import React, { useState, useEffect } from 'react';
import { FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Consultation, UnifiedStudent, StaffMember } from '../../types';
import ConsultationCard from './ConsultationCard';

interface ConsultationListProps {
    consultations: Consultation[];
    loading: boolean;
    onRefresh: () => void;
    students: UnifiedStudent[];
    staff: StaffMember[];
}

/**
 * 상담 기록 목록 컴포넌트
 * - 카드 형태로 표시
 * - 로딩/빈 상태 처리
 * - Skeleton UI
 * - 페이지네이션 (10/20/50/100개씩 보기) + 로컬 스토리지 저장
 */
const ConsultationList: React.FC<ConsultationListProps> = ({
    consultations,
    loading,
    onRefresh,
    students,
    staff,
}) => {
    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // 초기 로드 시 로컬 스토리지에서 페이지 사이즈 불러오기
    useEffect(() => {
        const savedSize = localStorage.getItem('consultation_pageSize');
        if (savedSize) {
            setItemsPerPage(Number(savedSize));
        }
    }, []);

    // 데이터 변경 시 첫 페이지로 리셋
    useEffect(() => {
        setCurrentPage(1);
    }, [consultations.length]); // 데이터 개수가 바뀌면 리셋 (필터링 등)

    // 페이지 사이즈 변경 시 저장
    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = Number(e.target.value);
        setItemsPerPage(newSize);
        setCurrentPage(1);
        localStorage.setItem('consultation_pageSize', String(newSize));
    };

    // 현재 페이지 데이터 계산
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = consultations.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(consultations.length / itemsPerPage);

    // 페이지 이동 핸들러
    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
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
        <div className="overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <p className="text-sm text-[#373d41]">
                        총 <span className="font-semibold text-[#081429]">{consultations.length}</span>개의 상담 기록
                    </p>
                    <span className="text-gray-300">|</span>
                    <select
                        value={itemsPerPage}
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
                            disabled={currentPage === 1}
                            className="p-1 text-gray-500 hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="첫 페이지"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-1 text-gray-500 hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed border-l border-gray-100"
                            title="이전 페이지"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 text-xs font-medium text-[#373d41]">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="p-1 text-gray-500 hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed border-l border-gray-100"
                            title="다음 페이지"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => goToPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1 text-gray-500 hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed border-l border-gray-100"
                            title="마지막 페이지"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>

                    <button
                        onClick={onRefresh}
                        className="text-sm text-[#081429] hover:text-[#fdb813] transition-colors ml-2"
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
                {currentItems.map((consultation, index) => (
                    <ConsultationCard
                        key={consultation.id}
                        index={consultations.length - ((currentPage - 1) * itemsPerPage + index)}
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
