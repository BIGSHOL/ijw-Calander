import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { Plus, Search, GraduationCap, Upload, LayoutDashboard, List, ChevronDown, X, Loader2, Filter, SlidersHorizontal, Mic, History } from 'lucide-react';
import { usePaginatedConsultations, StudentConsultationFilters } from '../../hooks/useStudentConsultations';
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
import { storage, STORAGE_KEYS } from '../../utils/localStorage';
import { UserProfile } from '../../types';
import { useConsultationReportStatus } from '../../hooks/useConsultationRecording';
import { usePermissions } from '../../hooks/usePermissions';

// Lazy load 녹음분석 컴포넌트
const RecordingUploader = React.lazy(() => import('../ConsultationRecording/RecordingUploader').then(m => ({ default: m.RecordingUploader })));
const RecordingStatusTracker = React.lazy(() => import('../ConsultationRecording/RecordingStatusTracker').then(m => ({ default: m.RecordingStatusTracker })));
const ReportViewer = React.lazy(() => import('../ConsultationRecording/ReportViewer').then(m => ({ default: m.ReportViewer })));
const ReportHistoryList = React.lazy(() => import('../ConsultationRecording/ReportHistoryList').then(m => ({ default: m.ReportHistoryList })));

// 녹음분석 로딩 fallback
const RecordingLoadingFallback = () => (
    <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
);

/**
 * 상담 관리 메인 탭
 * - 재원생 대상 학부모/학생 상담 기록 관리
 * - 필터링 및 검색 기능
 * - 브랜드 컬러: 곤색(#081429), 노란색(#fdb813)
 */
type ViewMode = 'list' | 'dashboard' | 'recording' | 'report-history';

interface ConsultationManagementTabProps {
  currentUser?: UserProfile | null;
}

const ConsultationManagementTab: React.FC<ConsultationManagementTabProps> = ({ currentUser }) => {
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const saved = storage.getString(STORAGE_KEYS.CONSULTATION_VIEW_MODE);
        if (saved && ['list', 'dashboard', 'recording', 'report-history'].includes(saved)) return saved as ViewMode;
        // Migration from old key
        const old = localStorage.getItem('consultation_viewMode');
        if (old && ['list', 'dashboard'].includes(old)) {
            storage.setString(STORAGE_KEYS.CONSULTATION_VIEW_MODE, old);
            localStorage.removeItem('consultation_viewMode');
            return old as ViewMode;
        }
        return 'dashboard'; // 기본값: 통계(dashboard)
    });
    const [filters, setFilters] = useState<StudentConsultationFilters>({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [showMigrationModal, setShowMigrationModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // 권한 체크
    const { hasPermission } = usePermissions(currentUser);
    const canEditReport = hasPermission('recording.edit');

    // 녹음분석 상태
    const [activeReportId, setActiveReportId] = useState<string | null>(null);
    const { report } = useConsultationReportStatus(activeReportId);
    const isInProgress = report && report.status !== 'completed' && report.status !== 'error' && report.status !== 'failed';

    const handleSelectFromHistory = (reportId: string) => {
        setActiveReportId(reportId);
        handleViewModeChange('recording');
    };

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => {
        const saved = storage.getString(STORAGE_KEYS.CONSULTATION_PAGE_SIZE);
        if (saved) return Number(saved);
        // Migration from old key
        const old = localStorage.getItem('consultation_pageSize');
        if (old) {
            storage.setString(STORAGE_KEYS.CONSULTATION_PAGE_SIZE, old);
            localStorage.removeItem('consultation_pageSize');
            return Number(old);
        }
        return 10;
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

    // 통합 필터 드롭다운 상태
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const filterDropdownRef = useRef<HTMLDivElement>(null);

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
                setShowFilterDropdown(false);
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
            result[key].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
        });

        return result;
    }, [staff]);

    // 현재 선택된 상담자 이름 가져오기
    const selectedConsultantName = useMemo(() => {
        if (!filters.consultantId) return null;
        const consultant = staff.find(s => s.id === filters.consultantId);
        return consultant?.name || null;
    }, [filters.consultantId, staff]);

    // 활성 필터 개수 계산
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.type) count++;
        if (filters.category) count++;
        if (filters.followUpStatus && filters.followUpStatus !== 'all') count++;
        if (filters.consultantId) count++;
        return count;
    }, [filters.type, filters.category, filters.followUpStatus, filters.consultantId]);

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
        storage.setString(STORAGE_KEYS.CONSULTATION_PAGE_SIZE, String(newSize));
    };

    // 뷰 모드 변경 핸들러
    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        storage.setString(STORAGE_KEYS.CONSULTATION_VIEW_MODE, mode);
    };

    // 현재 활성화된 날짜 프리셋 (localStorage에서 복원)
    const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'week' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'all'>(() => {
        const saved = storage.getString(STORAGE_KEYS.CONSULTATION_DATE_PRESET);
        if (saved && ['today', 'week', 'thisMonth', 'lastMonth', 'last3Months', 'all'].includes(saved)) {
            return saved as 'today' | 'week' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'all';
        }
        // Migration from old key
        const old = localStorage.getItem('consultation_datePreset');
        if (old && ['today', 'week', 'thisMonth', 'lastMonth', 'last3Months', 'all'].includes(old)) {
            storage.setString(STORAGE_KEYS.CONSULTATION_DATE_PRESET, old);
            localStorage.removeItem('consultation_datePreset');
            return old as 'today' | 'week' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'all';
        }
        return 'week';
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
        storage.setString(STORAGE_KEYS.CONSULTATION_DATE_PRESET, preset);

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
            {/* 상단 네비게이션 바 - Light Theme (수학 시간표 스타일) */}
            <TabSubNavigation
                variant="compact"
                theme="light"
                showBorder={true}
                className="justify-between px-3 md:px-4 relative z-30"
            >
                {/* Left: View Toggle + Date Presets + Filter Dropdown */}
                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    {/* 뷰 모드 토글 */}
                    <div className="flex bg-gray-200 rounded-sm p-0.5">
                        <TabButton
                            active={viewMode === 'dashboard'}
                            onClick={() => handleViewModeChange('dashboard')}
                            icon={<LayoutDashboard size={12} />}
                            theme="light"
                        >
                            통계
                        </TabButton>
                        <TabButton
                            active={viewMode === 'list'}
                            onClick={() => handleViewModeChange('list')}
                            icon={<List size={12} />}
                            theme="light"
                        >
                            목록
                        </TabButton>
                        <TabButton
                            active={viewMode === 'recording'}
                            onClick={() => handleViewModeChange('recording')}
                            icon={<Mic size={12} />}
                            theme="light"
                        >
                            녹음분석
                        </TabButton>
                        <TabButton
                            active={viewMode === 'report-history'}
                            onClick={() => handleViewModeChange('report-history')}
                            icon={<History size={12} />}
                            theme="light"
                        >
                            분석내역
                        </TabButton>
                    </div>

                    {/* 날짜 범위 버튼 - 통계/목록 모드만 */}
                    {(viewMode === 'dashboard' || viewMode === 'list') && (
                    <>
                    <div className="w-px h-4 bg-gray-300"></div>

                    {/* 날짜 범위 버튼 */}
                    <div className="flex gap-0.5">
                        <TabButton active={activeDatePreset === 'today'} onClick={() => applyDatePreset('today')} theme="light" className="px-2 py-1">오늘</TabButton>
                        <TabButton active={activeDatePreset === 'week'} onClick={() => applyDatePreset('week')} theme="light" className="px-2 py-1">최근 7일</TabButton>
                        <TabButton active={activeDatePreset === 'thisMonth'} onClick={() => applyDatePreset('thisMonth')} theme="light" className="px-2 py-1">이번 달</TabButton>
                        <TabButton active={activeDatePreset === 'lastMonth'} onClick={() => applyDatePreset('lastMonth')} theme="light" className="px-2 py-1">지난 달</TabButton>
                        <TabButton active={activeDatePreset === 'last3Months'} onClick={() => applyDatePreset('last3Months')} theme="light" className="px-2 py-1">3개월</TabButton>
                        {viewMode === 'list' && (
                            <TabButton active={activeDatePreset === 'all'} onClick={() => applyDatePreset('all')} theme="light" className="px-2 py-1">전체</TabButton>
                        )}
                    </div>

                    {/* 목록 모드: 통합 필터 드롭다운 */}
                    {viewMode === 'list' && (
                        <>
                            <div className="w-px h-4 bg-gray-300"></div>
                            <div className="relative" ref={filterDropdownRef}>
                                <button
                                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-xs font-medium transition-colors ${
                                        activeFilterCount > 0
                                            ? 'bg-accent border-accent text-primary'
                                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <SlidersHorizontal size={12} />
                                    <span>필터</span>
                                    {activeFilterCount > 0 && (
                                        <span className="bg-primary text-white text-micro w-4 h-4 rounded-full flex items-center justify-center">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>

                                {showFilterDropdown && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-sm shadow-lg z-50 min-w-[320px] max-h-[500px] overflow-y-auto">
                                        {/* 상담 유형 */}
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <div className="text-xxs font-bold text-gray-600 mb-2">상담 유형</div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setFilters(prev => ({ ...prev, type: undefined }))}
                                                    className={`flex-1 px-2 py-1.5 rounded-sm text-xs font-medium border ${!filters.type ? 'bg-accent border-accent text-primary' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                                >
                                                    전체
                                                </button>
                                                <button
                                                    onClick={() => setFilters(prev => ({ ...prev, type: 'parent' }))}
                                                    className={`flex-1 px-2 py-1.5 rounded-sm text-xs font-medium border ${filters.type === 'parent' ? 'bg-accent border-accent text-primary' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                                >
                                                    학부모
                                                </button>
                                                <button
                                                    onClick={() => setFilters(prev => ({ ...prev, type: 'student' }))}
                                                    className={`flex-1 px-2 py-1.5 rounded-sm text-xs font-medium border ${filters.type === 'student' ? 'bg-accent border-accent text-primary' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                                >
                                                    학생
                                                </button>
                                            </div>
                                        </div>

                                        {/* 카테고리 */}
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <div className="text-xxs font-bold text-gray-600 mb-2">카테고리</div>
                                            <select
                                                value={filters.category || ''}
                                                onChange={(e) => setFilters(prev => ({
                                                    ...prev,
                                                    category: e.target.value as ConsultationCategory | undefined || undefined
                                                }))}
                                                className="w-full bg-white border border-gray-300 rounded-sm px-2 py-1.5 text-xs text-gray-700 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                                            >
                                                <option value="">전체 카테고리</option>
                                                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                                    <option key={key} value={key}>{config.icon} {config.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 후속조치 */}
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <div className="text-xxs font-bold text-gray-600 mb-2">후속조치</div>
                                            <select
                                                value={filters.followUpStatus || 'all'}
                                                onChange={(e) => setFilters(prev => ({ ...prev, followUpStatus: e.target.value as any }))}
                                                className="w-full bg-white border border-gray-300 rounded-sm px-2 py-1.5 text-xs text-gray-700 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                                            >
                                                <option value="all">전체</option>
                                                <option value="needed">후속조치 필요</option>
                                                <option value="done">후속조치 완료</option>
                                                <option value="pending">미완료</option>
                                            </select>
                                        </div>

                                        {/* 상담자 */}
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <div className="text-xxs font-bold text-gray-600 mb-2">상담자</div>
                                            <div className="space-y-1.5">
                                                <button
                                                    onClick={() => setFilters(prev => ({ ...prev, consultantId: undefined }))}
                                                    className={`w-full px-2 py-1 rounded-sm text-xs font-medium text-left ${!filters.consultantId ? 'bg-accent text-primary' : 'text-gray-600 hover:bg-gray-100'}`}
                                                >
                                                    전체
                                                </button>
                                                {/* 수학 */}
                                                {consultantsBySubject.math.length > 0 && (
                                                    <div>
                                                        <div className="text-micro text-blue-600 font-bold px-1 mb-0.5">수학</div>
                                                        <div className="grid grid-cols-3 gap-0.5">
                                                            {consultantsBySubject.math.map(c => (
                                                                <button key={`m-${c.id}`} onClick={() => setFilters(prev => ({ ...prev, consultantId: c.id }))}
                                                                    className={`px-1.5 py-1 rounded-sm text-xs ${filters.consultantId === c.id ? 'bg-blue-500 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
                                                                    {c.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* 영어 */}
                                                {consultantsBySubject.english.length > 0 && (
                                                    <div>
                                                        <div className="text-micro text-purple-600 font-bold px-1 mb-0.5">영어</div>
                                                        <div className="grid grid-cols-3 gap-0.5">
                                                            {consultantsBySubject.english.map(c => (
                                                                <button key={`e-${c.id}`} onClick={() => setFilters(prev => ({ ...prev, consultantId: c.id }))}
                                                                    className={`px-1.5 py-1 rounded-sm text-xs ${filters.consultantId === c.id ? 'bg-purple-500 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
                                                                    {c.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* 과학 */}
                                                {consultantsBySubject.science.length > 0 && (
                                                    <div>
                                                        <div className="text-micro text-green-600 font-bold px-1 mb-0.5">과학</div>
                                                        <div className="grid grid-cols-3 gap-0.5">
                                                            {consultantsBySubject.science.map(c => (
                                                                <button key={`s-${c.id}`} onClick={() => setFilters(prev => ({ ...prev, consultantId: c.id }))}
                                                                    className={`px-1.5 py-1 rounded-sm text-xs ${filters.consultantId === c.id ? 'bg-green-500 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
                                                                    {c.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* 국어 */}
                                                {consultantsBySubject.korean.length > 0 && (
                                                    <div>
                                                        <div className="text-micro text-orange-600 font-bold px-1 mb-0.5">국어</div>
                                                        <div className="grid grid-cols-3 gap-0.5">
                                                            {consultantsBySubject.korean.map(c => (
                                                                <button key={`k-${c.id}`} onClick={() => setFilters(prev => ({ ...prev, consultantId: c.id }))}
                                                                    className={`px-1.5 py-1 rounded-sm text-xs ${filters.consultantId === c.id ? 'bg-orange-500 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
                                                                    {c.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* 기타 */}
                                                {consultantsBySubject.other.length > 0 && (
                                                    <div>
                                                        <div className="text-micro text-gray-500 font-bold px-1 mb-0.5">기타</div>
                                                        <div className="grid grid-cols-3 gap-0.5">
                                                            {consultantsBySubject.other.map(c => (
                                                                <button key={`o-${c.id}`} onClick={() => setFilters(prev => ({ ...prev, consultantId: c.id }))}
                                                                    className={`px-1.5 py-1 rounded-sm text-xs ${filters.consultantId === c.id ? 'bg-gray-500 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
                                                                    {c.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 초기화 버튼 */}
                                        {activeFilterCount > 0 && (
                                            <div className="px-3 py-2">
                                                <button
                                                    onClick={() => {
                                                        setFilters(prev => ({ ...prev, type: undefined, category: undefined, followUpStatus: undefined, consultantId: undefined }));
                                                    }}
                                                    className="w-full px-3 py-1.5 rounded-sm text-xs text-red-500 hover:bg-red-50 flex items-center justify-center gap-1 border border-red-200"
                                                >
                                                    <X size={12} />
                                                    필터 초기화
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    </>
                    )}
                </div>

                {/* Center: Title */}
                <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-black text-gray-800 tracking-tight">
                    학생 상담
                </h1>

                {/* Right: Count + Search + Actions (통계/목록 모드만) */}
                {(viewMode === 'dashboard' || viewMode === 'list') && (
                <div className="flex items-center gap-2 shrink-0">
                    {/* 결과 카운트 */}
                    {viewMode === 'list' && (
                        <span className="text-gray-500 text-xs">
                            총 <span className="text-primary font-bold">{totalCount}</span>개
                        </span>
                    )}

                    {/* 검색 - 목록 모드만 */}
                    {viewMode === 'list' && (
                        <>
                            <div className="w-px h-4 bg-gray-300"></div>
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="학생명, 제목 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-36 pl-7 pr-2 py-1 bg-white border border-gray-300 rounded-sm text-xs text-gray-700 placeholder-gray-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                                />
                            </div>
                            <div className="w-px h-4 bg-gray-300"></div>
                        </>
                    )}

                    {/* DB이전 버튼 - 목록 모드만 */}
                    {viewMode === 'list' && (
                        <button
                            onClick={() => setShowMigrationModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-success hover:bg-[#059669] text-white text-xs font-bold transition-colors"
                            title="MakeEdu 데이터 가져오기"
                        >
                            <Upload size={14} />
                            <span>DB 이전</span>
                        </button>
                    )}

                    {/* 상담 등록 버튼 */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-info hover:bg-[#2563eb] text-white text-xs font-bold transition-colors"
                    >
                        <Plus size={14} />
                        <span>상담 등록</span>
                    </button>
                </div>
                )}
            </TabSubNavigation>

            {/* 메인 콘텐츠 영역 */}
            <div className="flex-1 overflow-auto bg-gray-50">
                {viewMode === 'dashboard' ? (
                    /* 대시보드 뷰 - 공통 날짜 필터 전달 */
                    <div className="p-6">
                    <ConsultationDashboard
                        dateRange={filters.dateRange}
                        onDateRangeChange={(range) => {
                            setFilters(prev => ({ ...prev, dateRange: range }));
                            if (!range) {
                                setActiveDatePreset('all');
                            }
                        }}
                        currentUser={currentUser}
                    />
                    </div>
                ) : viewMode === 'list' ? (
                    /* 목록 뷰 */
                    <div className="p-6">
                        {/* 에러 상태 */}
                        {error && (
                            <div className="bg-red-50 border border-red-300 rounded-sm p-4 mb-6">
                                <p className="text-red-800">데이터를 불러오는 중 오류가 발생했습니다.</p>
                                <button
                                    onClick={() => refetch()}
                                    className="mt-2 bg-accent hover:bg-[#e5a60f] text-primary px-4 py-2 rounded font-semibold text-sm"
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
                            totalCount={totalCount}
                            currentPage={currentPage}
                            totalPages={totalPages}
                            pageSize={pageSize}
                            hasNextPage={hasNextPage}
                            hasPrevPage={hasPrevPage}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    </div>
                ) : viewMode === 'recording' ? (
                    /* 녹음분석 뷰 */
                    <Suspense fallback={<RecordingLoadingFallback />}>
                        <div className="p-4">
                            <div className={`mx-auto ${report?.status === 'completed' ? 'max-w-7xl grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5' : 'max-w-3xl space-y-4'}`}>
                                {/* 왼쪽: 업로드 / 상태 */}
                                <div className="space-y-4">
                                    {!isInProgress && (
                                        <RecordingUploader
                                            onUploadStart={(reportId) => setActiveReportId(reportId)}
                                        />
                                    )}
                                    {isInProgress && report && (
                                        <RecordingStatusTracker report={report} />
                                    )}
                                    {report?.status === 'failed' && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-sm p-5 text-center">
                                            <p className="text-amber-800 font-medium">분석할 수 없는 녹음입니다</p>
                                            <p className="text-amber-600 text-sm mt-1">{report.statusMessage}</p>
                                            <button
                                                onClick={() => setActiveReportId(null)}
                                                className="mt-4 px-4 py-2 bg-amber-100 text-amber-800 rounded-sm text-sm hover:bg-amber-200"
                                            >
                                                다른 파일로 다시 시도
                                            </button>
                                        </div>
                                    )}
                                    {report?.status === 'error' && (
                                        <div className="bg-red-50 border border-red-200 rounded-sm p-5 text-center">
                                            <p className="text-red-800 font-medium">분석 중 오류가 발생했습니다</p>
                                            <p className="text-red-600 text-sm mt-1">{report.errorMessage}</p>
                                            <button
                                                onClick={() => setActiveReportId(null)}
                                                className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-sm text-sm hover:bg-red-200"
                                            >
                                                다시 시도
                                            </button>
                                        </div>
                                    )}
                                    {report?.status === 'completed' && (
                                        <div className="text-center">
                                            <button
                                                onClick={() => setActiveReportId(null)}
                                                className="px-4 py-2 text-sm text-gray-600 bg-white border rounded-sm hover:bg-gray-50"
                                            >
                                                새 분석 시작
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {report?.status === 'completed' && (
                                    <div className="overflow-auto">
                                        <ReportViewer report={report} canEdit={canEditReport} currentUser={currentUser} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </Suspense>
                ) : viewMode === 'report-history' ? (
                    /* 분석내역 뷰 */
                    <Suspense fallback={<RecordingLoadingFallback />}>
                        <div className="p-4 max-w-3xl mx-auto">
                            <ReportHistoryList onSelectReport={handleSelectFromHistory} userProfile={currentUser || null} />
                        </div>
                    </Suspense>
                ) : null}
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
                        userProfile={currentUser}
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
