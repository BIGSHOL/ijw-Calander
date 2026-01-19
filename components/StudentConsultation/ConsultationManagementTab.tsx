import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, GraduationCap, Upload, LayoutDashboard, List } from 'lucide-react';
import { usePaginatedConsultations, StudentConsultationFilters, DEFAULT_PAGE_SIZE } from '../../hooks/useStudentConsultations';
import { ConsultationCategory, CATEGORY_CONFIG } from '../../types';
import ConsultationList from './ConsultationList';
// Lazy load modals for better code splitting
const AddConsultationModal = React.lazy(() => import('./AddConsultationModal'));
const ConsultationMigrationModal = React.lazy(() => import('./ConsultationMigrationModal'));
import { useStudents } from '../../hooks/useStudents';
import { useStaff } from '../../hooks/useStaff';
import { ConsultationDashboard } from '../Dashboard';

/**
 * 상담 관리 메인 탭
 * - 재원생 대상 학부모/학생 상담 기록 관리
 * - 필터링 및 검색 기능
 * - 브랜드 컬러: 곤색(#081429), 노란색(#fdb813)
 */
type ViewMode = 'list' | 'dashboard';

const ConsultationManagementTab: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const saved = localStorage.getItem('consultation_viewMode');
        return (saved as ViewMode) || 'list';
    });
    const [filters, setFilters] = useState<StudentConsultationFilters>({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [showMigrationModal, setShowMigrationModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => {
        const saved = localStorage.getItem('consultation_pageSize');
        return saved ? Number(saved) : DEFAULT_PAGE_SIZE;
    });

    // 페이지네이션 적용된 상담 조회
    const {
        consultations,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
        loading,
        error,
        refetch
    } = usePaginatedConsultations({ ...filters, searchQuery }, { page: currentPage, pageSize });

    const { students } = useStudents();
    const { staff } = useStaff();

    // 필터 변경 시 첫 페이지로 리셋
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    // 검색 쿼리 적용 (클라이언트 측 추가 필터링) - 이제 훅 내부에서 처리되므로 제거
    // const filteredConsultations = useMemo(() => { ... }, [consultations, searchQuery]);

    // 페이지 사이즈 변경 핸들러
    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
        localStorage.setItem('consultation_pageSize', String(newSize));
    };

    // 뷰 모드 변경 핸들러
    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem('consultation_viewMode', mode);
    };

    // 현재 활성화된 날짜 프리셋 (localStorage에서 복원)
    const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'week' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'all'>(() => {
        const saved = localStorage.getItem('consultation_datePreset');
        if (saved && ['today', 'week', 'thisMonth', 'lastMonth', 'last3Months', 'all'].includes(saved)) {
            return saved as 'today' | 'week' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'all';
        }
        return 'thisMonth';
    });

    // 날짜 범위 프리셋
    const applyDatePreset = (preset: 'today' | 'week' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'all') => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        setActiveDatePreset(preset);
        localStorage.setItem('consultation_datePreset', preset);

        if (preset === 'today') {
            setFilters(prev => ({ ...prev, dateRange: { start: todayStr, end: todayStr } }));
        } else if (preset === 'week') {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            const startStr = weekAgo.toISOString().split('T')[0];
            setFilters(prev => ({ ...prev, dateRange: { start: startStr, end: todayStr } }));
        } else if (preset === 'thisMonth') {
            // 이번 달: 1일 ~ 말일
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            setFilters(prev => ({
                ...prev,
                dateRange: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0]
                }
            }));
        } else if (preset === 'lastMonth') {
            // 지난 달: 1일 ~ 말일
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            setFilters(prev => ({
                ...prev,
                dateRange: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0]
                }
            }));
        } else if (preset === 'last3Months') {
            // 최근 3개월: 2달 전 1일 ~ 이번달 말일
            const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            setFilters(prev => ({
                ...prev,
                dateRange: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0]
                }
            }));
        } else {
            setFilters(prev => ({ ...prev, dateRange: undefined }));
        }
    };

    // 초기 로드 시 저장된 프리셋 또는 기본값(이번 달) 적용
    useEffect(() => {
        applyDatePreset(activeDatePreset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* 상단 네비게이션 바 (다른 탭과 동일한 스타일) - 모바일 대응을 위해 h-auto 및 flex-wrap 적용 */}
            <div className="bg-[#081429] min-h-10 h-auto flex flex-wrap items-center justify-between px-6 py-2 border-b border-white/10 text-xs z-30 gap-2">
                <div className="flex flex-wrap items-center gap-3">
                    {/* 뷰 모드 토글 */}
                    <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10">
                        <button
                            onClick={() => handleViewModeChange('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list'
                                ? 'bg-[#fdb813] text-[#081429]'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            title="목록 보기"
                        >
                            <List size={14} />
                        </button>
                        <button
                            onClick={() => handleViewModeChange('dashboard')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'dashboard'
                                ? 'bg-[#fdb813] text-[#081429]'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            title="대시보드 보기"
                        >
                            <LayoutDashboard size={14} />
                        </button>
                    </div>

                    {/* 공통 필터들 (목록/대시보드 모두에 표시) */}
                    <>
                        {/* 구분선 */}
                        <div className="w-px h-4 bg-white/20 mx-1"></div>

                        {/* 날짜 범위 버튼 */}
                        <div className="flex gap-1">
                            <button
                                onClick={() => applyDatePreset('today')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeDatePreset === 'today'
                                    ? 'bg-[#fdb813] text-[#081429]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                오늘
                            </button>
                            <button
                                onClick={() => applyDatePreset('week')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeDatePreset === 'week'
                                    ? 'bg-[#fdb813] text-[#081429]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                최근 7일
                            </button>
                            <button
                                onClick={() => applyDatePreset('thisMonth')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeDatePreset === 'thisMonth'
                                    ? 'bg-[#fdb813] text-[#081429]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                이번 달
                            </button>
                            <button
                                onClick={() => applyDatePreset('lastMonth')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeDatePreset === 'lastMonth'
                                    ? 'bg-[#fdb813] text-[#081429]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                지난 달
                            </button>
                            <button
                                onClick={() => applyDatePreset('last3Months')}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeDatePreset === 'last3Months'
                                    ? 'bg-[#fdb813] text-[#081429]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                3개월
                            </button>
                            {/* 전체 버튼은 목록뷰에서만 표시 */}
                            {viewMode === 'list' && (
                                <button
                                    onClick={() => applyDatePreset('all')}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeDatePreset === 'all'
                                        ? 'bg-[#fdb813] text-[#081429]'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    전체
                                </button>
                            )}
                        </div>
                    </>

                    {/* 목록 모드 전용 필터들 */}
                    {viewMode === 'list' && (
                        <>
                            {/* 구분선 */}
                            <div className="w-px h-4 bg-white/20 mx-1"></div>

                            {/* 상담 유형 토글 */}
                            <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, type: undefined }))}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!filters.type
                                        ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    💬 전체
                                </button>
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, type: 'parent' }))}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filters.type === 'parent'
                                        ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    👨‍👩‍👧 학부모
                                </button>
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, type: 'student' }))}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${filters.type === 'student'
                                        ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <GraduationCap className="inline-block w-4 h-4 mr-1" />
                                    학생
                                </button>
                            </div>

                            {/* 구분선 */}
                            <div className="w-px h-4 bg-white/20 mx-1"></div>

                            {/* 카테고리 필터 */}
                            <select
                                value={filters.category || ''}
                                onChange={(e) => setFilters(prev => ({
                                    ...prev,
                                    category: e.target.value as ConsultationCategory | undefined || undefined
                                }))}
                                className="appearance-none bg-[#1e293b] border border-gray-700 rounded-md px-3 py-1 pr-7 text-xs font-medium text-white cursor-pointer hover:border-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                            >
                                <option value="">전체 카테고리</option>
                                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key}>
                                        {config.icon} {config.label}
                                    </option>
                                ))}
                            </select>

                            {/* 구분선 */}
                            <div className="w-px h-4 bg-white/20 mx-1"></div>

                            {/* 후속조치 필터 */}
                            <select
                                value={filters.followUpStatus || 'all'}
                                onChange={(e) => setFilters(prev => ({
                                    ...prev,
                                    followUpStatus: e.target.value as any
                                }))}
                                className="appearance-none bg-[#1e293b] border border-gray-700 rounded-md px-3 py-1 pr-7 text-xs font-medium text-white cursor-pointer hover:border-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                            >
                                <option value="all">전체</option>
                                <option value="needed">후속조치 필요</option>
                                <option value="done">후속조치 완료</option>
                                <option value="pending">미완료</option>
                            </select>

                            {/* 구분선 */}
                            <div className="w-px h-4 bg-white/20 mx-1"></div>

                            {/* 상담자(직원) 필터 */}
                            <select
                                value={filters.consultantId || ''}
                                onChange={(e) => setFilters(prev => ({
                                    ...prev,
                                    consultantId: e.target.value || undefined
                                }))}
                                className="appearance-none bg-[#1e293b] border border-gray-700 rounded-md px-3 py-1 pr-7 text-xs font-medium text-white cursor-pointer hover:border-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                            >
                                <option value="">전체 상담자</option>
                                {staff
                                    .filter(s => s.role === 'teacher')
                                    .map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))
                                }
                            </select>

                            {/* 구분선 */}
                            <div className="w-px h-4 bg-white/20 mx-1"></div>

                            {/* 검색 */}
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="학생명, 제목, 내용 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-[#1e293b] border border-gray-700 rounded-md pl-8 pr-3 py-1 text-xs text-white placeholder-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none w-52"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* 결과 카운트 - 목록 모드에서만 */}
                    {viewMode === 'list' && (
                        <span className="text-gray-400 text-xs">
                            총 <span className="text-[#fdb813] font-bold">{totalCount}</span>개의 상담 기록
                        </span>
                    )}

                    {/* 데이터 가져오기 버튼 (마이그레이션) - 목록 모드에서만 */}
                    {viewMode === 'list' && (
                        <button
                            onClick={() => setShowMigrationModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors shadow-sm font-bold border border-white/20"
                            title="MakeEdu 데이터 가져오기"
                        >
                            <Upload size={14} />
                            <span>DB이전(J)</span>
                        </button>
                    )}

                    {/* 새 상담 기록 버튼 */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#fdb813] text-[#081429] hover:bg-[#e5a60f] transition-colors shadow-sm font-bold"
                    >
                        <Plus size={14} />
                        <span>새 상담</span>
                    </button>
                </div>
            </div>

            {/* 메인 콘텐츠 영역 */}
            <div className="flex-1 overflow-auto bg-gray-50 p-6">
                {viewMode === 'dashboard' ? (
                    /* 대시보드 뷰 - 공통 날짜 필터 전달 */
                    <ConsultationDashboard
                        dateRange={filters.dateRange}
                        onDateRangeChange={(range) => {
                            setFilters(prev => ({ ...prev, dateRange: range }));
                            // dateRange가 없으면 'all', 있으면 적절한 프리셋 설정
                            if (!range) {
                                setActiveDatePreset('all');
                            }
                        }}
                    />
                ) : (
                    /* 목록 뷰 */
                    <>
                        {/* 에러 상태 */}
                        {error && (
                            <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
                                <p className="text-red-800">데이터를 불러오는 중 오류가 발생했습니다.</p>
                                <button
                                    onClick={() => refetch()}
                                    className="mt-2 bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-4 py-2 rounded font-semibold text-sm"
                                >
                                    다시 시도
                                </button>
                            </div>
                        )}

                        {/* 상담 목록 */}
                        <ConsultationList
                            consultations={consultations}
                            loading={loading}
                            onRefresh={refetch}
                            students={students}
                            staff={staff}
                            // 서버 측 페이지네이션 props
                            totalCount={totalCount}
                            currentPage={currentPage}
                            totalPages={totalPages}
                            pageSize={pageSize}
                            hasNextPage={hasNextPage}
                            hasPrevPage={hasPrevPage}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    </>
                )}
            </div>

            {/* 새 상담 추가 모달 */}
            {
                showAddModal && (
                    <AddConsultationModal
                        onClose={() => setShowAddModal(false)}
                        onSuccess={() => {
                            setShowAddModal(false);
                            // mutation의 onSuccess에서 캐시 무효화 완료됨 (staleTime: 0)
                        }}
                    />
                )
            }

            {/* 마이그레이션 모달 */}
            {
                showMigrationModal && (
                    <ConsultationMigrationModal
                        onClose={() => setShowMigrationModal(false)}
                        onSuccess={() => {
                            setShowMigrationModal(false);
                            refetch();
                        }}
                    />
                )
            }
        </div >
    );
};

export default ConsultationManagementTab;
