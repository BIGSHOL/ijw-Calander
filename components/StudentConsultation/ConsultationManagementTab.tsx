import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { Plus, Search, GraduationCap, Upload, LayoutDashboard, List, ChevronDown, X, Loader2 } from 'lucide-react';
import { usePaginatedConsultations, StudentConsultationFilters, DEFAULT_PAGE_SIZE } from '../../hooks/useStudentConsultations';
import { ConsultationCategory, CATEGORY_CONFIG } from '../../types';
import ConsultationList from './ConsultationList';
// Lazy load modals for better code splitting
const AddConsultationModal = React.lazy(() => import('./AddConsultationModal'));
const ConsultationMigrationModal = React.lazy(() => import('./ConsultationMigrationModal'));
import { useStudents } from '../../hooks/useStudents';
import { useStaff } from '../../hooks/useStaff';
import { ConsultationDashboard } from '../Dashboard';
import { getMonthRangeKST, getTodayKST } from '../../utils/dateUtils';
import { TabSubNavigation } from '../Common/TabSubNavigation';
import { TabButton } from '../Common/TabButton';
import { GridDropdown, GridDropdownOption } from '../Common/GridDropdown';

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

    // 상담자 드롭다운 상태
    const [showConsultantDropdown, setShowConsultantDropdown] = useState(false);
    const consultantDropdownRef = useRef<HTMLDivElement>(null);

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (consultantDropdownRef.current && !consultantDropdownRef.current.contains(e.target as Node)) {
                setShowConsultantDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 상담자(교사)를 과목별로 그룹화
    const consultantsBySubject = useMemo(() => {
        const result: Record<string, Array<{ id: string; name: string }>> = {
            math: [],
            english: [],
            science: [],
            korean: [],
            other: [],
        };

        // 강사 역할을 가진 직원 (systemRole 또는 role='teacher')
        const teachers = staff.filter(s => {
            // systemRole이 강사 관련 역할
            if (s.systemRole && ['math_teacher', 'english_teacher', 'math_lead', 'english_lead'].includes(s.systemRole)) {
                return true;
            }
            // 레거시: role='teacher'
            if (s.role === 'teacher') {
                return true;
            }
            return false;
        });

        teachers.forEach(teacher => {
            if (teacher.subjects && teacher.subjects.length > 0) {
                // 해당 선생님의 과목들에 추가
                teacher.subjects.forEach(subject => {
                    if (result[subject]) {
                        if (!result[subject].find(t => t.id === teacher.id)) {
                            result[subject].push({ id: teacher.id, name: teacher.name });
                        }
                    } else {
                        if (!result.other.find(t => t.id === teacher.id)) {
                            result.other.push({ id: teacher.id, name: teacher.name });
                        }
                    }
                });
            } else {
                // 과목 정보가 없으면 기타로 분류
                if (!result.other.find(t => t.id === teacher.id)) {
                    result.other.push({ id: teacher.id, name: teacher.name });
                }
            }
        });

        // 각 과목별 이름순 정렬
        Object.keys(result).forEach(key => {
            result[key].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        });

        return result;
    }, [staff]);

    // 현재 선택된 상담자 이름 가져오기
    const selectedConsultantName = useMemo(() => {
        if (!filters.consultantId) return null;
        const consultant = staff.find(s => s.id === filters.consultantId);
        return consultant?.name || null;
    }, [filters.consultantId, staff]);

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

    // 로컬 날짜 포맷 헬퍼 (UTC 문제 방지)
    const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 날짜 범위 프리셋
    const applyDatePreset = (preset: 'today' | 'week' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'all') => {
        const today = new Date();
        const todayStr = getTodayKST();

        setActiveDatePreset(preset);
        localStorage.setItem('consultation_datePreset', preset);

        if (preset === 'today') {
            setFilters(prev => ({ ...prev, dateRange: { start: todayStr, end: todayStr } }));
        } else if (preset === 'week') {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            const startStr = formatLocalDate(weekAgo);
            setFilters(prev => ({ ...prev, dateRange: { start: startStr, end: todayStr } }));
        } else if (preset === 'thisMonth') {
            // 이번 달: 1일 ~ 말일 (로컬 시간 기준)
            const range = getMonthRangeKST();
            setFilters(prev => ({
                ...prev,
                dateRange: range
            }));
        } else if (preset === 'lastMonth') {
            // 지난 달: 1일 ~ 말일
            const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 15);
            const range = getMonthRangeKST(lastMonthDate);
            setFilters(prev => ({
                ...prev,
                dateRange: range
            }));
        } else if (preset === 'last3Months') {
            // 최근 3개월: 2달 전 1일 ~ 이번달 말일
            const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 15);
            const startRange = getMonthRangeKST(twoMonthsAgo);
            const endRange = getMonthRangeKST();
            setFilters(prev => ({
                ...prev,
                dateRange: {
                    start: startRange.start,
                    end: endRange.end
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
            <TabSubNavigation
                variant="compact"
                showBorder={false}
                className="min-h-10 h-auto flex-wrap justify-between px-6 py-2 border-b border-white/10 z-30"
            >
                <div className="flex flex-wrap items-center gap-3">
                    {/* 뷰 모드 토글 */}
                    <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10">
                        <TabButton
                            active={viewMode === 'list'}
                            onClick={() => handleViewModeChange('list')}
                            title="목록 보기"
                            className="p-1.5"
                        >
                            <List size={14} />
                        </TabButton>
                        <TabButton
                            active={viewMode === 'dashboard'}
                            onClick={() => handleViewModeChange('dashboard')}
                            title="대시보드 보기"
                            className="p-1.5"
                        >
                            <LayoutDashboard size={14} />
                        </TabButton>
                    </div>

                    {/* 공통 필터들 (목록/대시보드 모두에 표시) */}
                    <>
                        {/* 구분선 */}
                        <div className="w-px h-4 bg-white/20 mx-1"></div>

                        {/* 날짜 범위 버튼 */}
                        <div className="flex gap-1">
                            <TabButton
                                active={activeDatePreset === 'today'}
                                onClick={() => applyDatePreset('today')}
                                className="px-2 py-1"
                            >
                                오늘
                            </TabButton>
                            <TabButton
                                active={activeDatePreset === 'week'}
                                onClick={() => applyDatePreset('week')}
                                className="px-2 py-1"
                            >
                                최근 7일
                            </TabButton>
                            <TabButton
                                active={activeDatePreset === 'thisMonth'}
                                onClick={() => applyDatePreset('thisMonth')}
                                className="px-2 py-1"
                            >
                                이번 달
                            </TabButton>
                            <TabButton
                                active={activeDatePreset === 'lastMonth'}
                                onClick={() => applyDatePreset('lastMonth')}
                                className="px-2 py-1"
                            >
                                지난 달
                            </TabButton>
                            <TabButton
                                active={activeDatePreset === 'last3Months'}
                                onClick={() => applyDatePreset('last3Months')}
                                className="px-2 py-1"
                            >
                                3개월
                            </TabButton>
                            {/* 전체 버튼은 목록뷰에서만 표시 */}
                            {viewMode === 'list' && (
                                <TabButton
                                    active={activeDatePreset === 'all'}
                                    onClick={() => applyDatePreset('all')}
                                    className="px-2 py-1"
                                >
                                    전체
                                </TabButton>
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
                                <TabButton
                                    active={!filters.type}
                                    onClick={() => setFilters(prev => ({ ...prev, type: undefined }))}
                                    className="px-3 py-1"
                                >
                                    💬 전체
                                </TabButton>
                                <TabButton
                                    active={filters.type === 'parent'}
                                    onClick={() => setFilters(prev => ({ ...prev, type: 'parent' }))}
                                    className="px-3 py-1"
                                >
                                    👨‍👩‍👧 학부모
                                </TabButton>
                                <TabButton
                                    active={filters.type === 'student'}
                                    onClick={() => setFilters(prev => ({ ...prev, type: 'student' }))}
                                    className="px-3 py-1"
                                >
                                    <GraduationCap className="inline-block w-4 h-4 mr-1" />
                                    학생
                                </TabButton>
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

                            {/* 상담자(직원) 필터 - 그리드 드롭다운 */}
                            <div className="relative" ref={consultantDropdownRef}>
                                <button
                                    onClick={() => setShowConsultantDropdown(!showConsultantDropdown)}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium transition-colors ${
                                        filters.consultantId
                                            ? 'bg-[#fdb813] border-[#fdb813] text-[#081429]'
                                            : 'bg-[#1e293b] border-gray-700 text-white hover:border-gray-500'
                                    }`}
                                >
                                    <span>{selectedConsultantName || '상담자'}</span>
                                    <ChevronDown size={12} className={`transition-transform ${showConsultantDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showConsultantDropdown && (
                                    <div className="absolute top-full left-0 mt-1 bg-[#1e293b] border border-gray-700 rounded-lg shadow-xl z-50 min-w-[320px] max-h-[500px] overflow-y-auto">
                                        {/* 전체 선택 */}
                                        <div className="p-2 border-b border-white/10">
                                            <button
                                                onClick={() => {
                                                    setFilters(prev => ({ ...prev, consultantId: undefined }));
                                                    setShowConsultantDropdown(false);
                                                }}
                                                className={`w-full px-3 py-1.5 rounded text-xs font-bold text-left ${
                                                    !filters.consultantId
                                                        ? 'bg-[#fdb813] text-[#081429]'
                                                        : 'text-gray-300 hover:bg-white/10'
                                                }`}
                                            >
                                                전체
                                            </button>
                                        </div>

                                        <div className="p-2">
                                            {/* 수학 */}
                                            {consultantsBySubject.math.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="text-[10px] text-blue-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">수학</div>
                                                    <div className="grid grid-cols-3 gap-0.5">
                                                        {consultantsBySubject.math.map(consultant => (
                                                            <button
                                                                key={`math-${consultant.id}`}
                                                                onClick={() => {
                                                                    setFilters(prev => ({ ...prev, consultantId: consultant.id }));
                                                                    setShowConsultantDropdown(false);
                                                                }}
                                                                className={`px-2 py-1 rounded text-xs ${filters.consultantId === consultant.id ? 'bg-blue-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                                            >
                                                                {consultant.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 영어 */}
                                            {consultantsBySubject.english.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="text-[10px] text-purple-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">영어</div>
                                                    <div className="grid grid-cols-3 gap-0.5">
                                                        {consultantsBySubject.english.map(consultant => (
                                                            <button
                                                                key={`english-${consultant.id}`}
                                                                onClick={() => {
                                                                    setFilters(prev => ({ ...prev, consultantId: consultant.id }));
                                                                    setShowConsultantDropdown(false);
                                                                }}
                                                                className={`px-2 py-1 rounded text-xs ${filters.consultantId === consultant.id ? 'bg-purple-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                                            >
                                                                {consultant.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 과학 */}
                                            {consultantsBySubject.science.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="text-[10px] text-green-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">과학</div>
                                                    <div className="grid grid-cols-3 gap-0.5">
                                                        {consultantsBySubject.science.map(consultant => (
                                                            <button
                                                                key={`science-${consultant.id}`}
                                                                onClick={() => {
                                                                    setFilters(prev => ({ ...prev, consultantId: consultant.id }));
                                                                    setShowConsultantDropdown(false);
                                                                }}
                                                                className={`px-2 py-1 rounded text-xs ${filters.consultantId === consultant.id ? 'bg-green-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                                            >
                                                                {consultant.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 국어 */}
                                            {consultantsBySubject.korean.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="text-[10px] text-orange-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">국어</div>
                                                    <div className="grid grid-cols-3 gap-0.5">
                                                        {consultantsBySubject.korean.map(consultant => (
                                                            <button
                                                                key={`korean-${consultant.id}`}
                                                                onClick={() => {
                                                                    setFilters(prev => ({ ...prev, consultantId: consultant.id }));
                                                                    setShowConsultantDropdown(false);
                                                                }}
                                                                className={`px-2 py-1 rounded text-xs ${filters.consultantId === consultant.id ? 'bg-orange-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                                            >
                                                                {consultant.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 기타 */}
                                            {consultantsBySubject.other.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="text-[10px] text-gray-400 font-bold px-2 py-0.5 border-b border-white/10 mb-1">기타</div>
                                                    <div className="grid grid-cols-3 gap-0.5">
                                                        {consultantsBySubject.other.map(consultant => (
                                                            <button
                                                                key={`other-${consultant.id}`}
                                                                onClick={() => {
                                                                    setFilters(prev => ({ ...prev, consultantId: consultant.id }));
                                                                    setShowConsultantDropdown(false);
                                                                }}
                                                                className={`px-2 py-1 rounded text-xs ${filters.consultantId === consultant.id ? 'bg-gray-500 text-white font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                                            >
                                                                {consultant.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 초기화 버튼 */}
                                        {filters.consultantId && (
                                            <div className="p-2 border-t border-white/10">
                                                <button
                                                    onClick={() => {
                                                        setFilters(prev => ({ ...prev, consultantId: undefined }));
                                                        setShowConsultantDropdown(false);
                                                    }}
                                                    className="w-full px-3 py-1.5 rounded text-xs text-red-400 hover:bg-red-400/10 flex items-center justify-center gap-1"
                                                >
                                                    <X size={12} />
                                                    초기화
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

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
            </TabSubNavigation>

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
                    <Suspense fallback={<div className="fixed inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
                        <ConsultationMigrationModal
                            onClose={() => setShowMigrationModal(false)}
                            onSuccess={() => {
                                setShowMigrationModal(false);
                                refetch();
                            }}
                        />
                    </Suspense>
                )
            }
        </div >
    );
};

export default ConsultationManagementTab;
