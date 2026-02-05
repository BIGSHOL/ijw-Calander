import React, { useState, useMemo } from 'react';
import { Calendar, RefreshCw, FileText, Users, UserCheck, AlertTriangle, X, ChevronRight, AlertCircle, Search } from 'lucide-react';
import { useConsultationStats, getDateRangeFromPreset, DatePreset, StaffSubjectStat, StudentNeedingConsultation } from '../../hooks/useConsultationStats';
import { useStaff } from '../../hooks/useStaff';
import { usePermissions } from '../../hooks/usePermissions';
import { UserProfile } from '../../types';
import CounselingOverview from './CounselingOverview';
import CategoryStats from './CategoryStats';
import StaffSubjectStats from './StaffSubjectStats';
import { SUBJECT_COLORS } from '../../utils/styleUtils';

/** 날짜로부터 경과일 계산 */
const getDaysSince = (dateStr: string): number => {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * 학원 브랜드 색상
 * - 곤색: #081429
 * - 노란색: #fdb813
 * - 회색: #373d41
 */

interface ConsultationDashboardProps {
  /** 외부에서 전달받은 날짜 범위 (공통 필터) */
  dateRange?: { start: string; end: string };
  /** 날짜 범위 변경 핸들러 */
  onDateRangeChange?: (range: { start: string; end: string } | undefined) => void;
  /** 현재 로그인 사용자 (권한 체크용) */
  currentUser?: UserProfile | null;
}

const ConsultationDashboard: React.FC<ConsultationDashboardProps> = ({
  dateRange: externalDateRange,
  onDateRangeChange,
  currentUser,
}) => {
  const [internalDatePreset, setInternalDatePreset] = useState<DatePreset>('thisMonth');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showNeedingConsultationModal, setShowNeedingConsultationModal] = useState(false);

  // 권한 체크
  const { hasPermission } = usePermissions(currentUser || null);
  const isMasterOrAdmin = currentUser?.role === 'master' || currentUser?.role === 'admin';
  const canManageAll = isMasterOrAdmin || hasPermission('consultation.manage');
  const currentStaffId = currentUser?.staffId;

  // 외부 dateRange가 있으면 사용, 없으면 내부 preset 사용
  const dateRange = externalDateRange || getDateRangeFromPreset(internalDatePreset);
  const { staff } = useStaff();
  const { stats: rawStats, loading, refetch } = useConsultationStats(
    { dateRange },
    staff
  );

  // 권한에 따른 통계 필터링
  const stats = useMemo(() => {
    // 관리 권한이 있으면 전체 통계 표시
    if (canManageAll || !currentStaffId) {
      return rawStats;
    }

    // 관리 권한이 없으면 본인 담당 학생만 표시
    // 본인 담당 통계만 필터링
    const filteredStaffSubjectStats = rawStats.staffSubjectStats.filter(
      s => s.id === currentStaffId
    );

    // 본인 담당 학생의 상담 필요 수 계산
    // staffSubjectStats에서 본인의 수학/영어 담당 학생 수를 기준으로 계산
    const myStats = filteredStaffSubjectStats[0];
    const myTotalNeeded = myStats?.totalNeeded || 0;
    const myTotalCount = myStats?.totalCount || 0;
    const myNeedingCount = Math.max(0, myTotalNeeded - myTotalCount);

    // 상담 필요 학생 목록은 비워둠 (정확한 필터링이 불가능)
    // 대신 상담 필요 카드에서 숫자만 표시
    const filteredStudentsNeedingConsultation: typeof rawStats.studentsNeedingConsultation = [];

    // 본인의 상담 필요 건수만큼 placeholder 생성 (카드에 숫자 표시용)
    for (let i = 0; i < myNeedingCount; i++) {
      filteredStudentsNeedingConsultation.push({
        studentId: `placeholder-${i}`,
        studentName: '담당 학생',
        subject: 'math',
        lastConsultationDate: undefined,
      });
    }

    return {
      ...rawStats,
      // 본인 담당만 표시
      staffSubjectStats: filteredStaffSubjectStats,
      studentsNeedingConsultation: filteredStudentsNeedingConsultation,
      // 전체 통계는 본인 것만
      totalSubjectEnrollments: myTotalNeeded,
      totalConsultations: myTotalCount,
      parentConsultations: Math.round(myTotalCount * (rawStats.parentConsultations / Math.max(rawStats.totalConsultations, 1))),
      studentConsultations: Math.round(myTotalCount * (rawStats.studentConsultations / Math.max(rawStats.totalConsultations, 1))),
    };
  }, [rawStats, canManageAll, currentStaffId]);

  // 상담 완료율용: 항상 이번 달 기준 (필터와 무관)
  const thisMonthRange = useMemo(() => getDateRangeFromPreset('thisMonth'), []);
  const { stats: thisMonthStats } = useConsultationStats(
    { dateRange: thisMonthRange },
    staff
  );

  // 대시보드 자체 preset 변경 시 부모에게도 알림
  const handlePresetChange = (preset: DatePreset) => {
    setInternalDatePreset(preset);
    if (onDateRangeChange) {
      const newRange = getDateRangeFromPreset(preset);
      onDateRangeChange(newRange);
    }
  };

  // 상담 완료율: 항상 이번 달 기준 (필터와 무관)
  // 관리 권한에 따라 전체 또는 본인 담당만 표시
  const { totalSubjectEnrollments, consultedSubjectCount, percentage } = useMemo(() => {
    if (canManageAll || !currentStaffId) {
      // 관리 권한이 있으면 전체 통계
      const total = thisMonthStats?.totalSubjectEnrollments || 0;
      const needing = thisMonthStats?.studentsNeedingConsultation?.length || 0;
      const consulted = Math.max(0, total - needing);
      return {
        totalSubjectEnrollments: total,
        consultedSubjectCount: consulted,
        percentage: total > 0 ? Math.round((consulted / total) * 100) : 0,
      };
    }

    // 관리 권한이 없으면 본인 담당만
    const myStats = thisMonthStats?.staffSubjectStats?.find(s => s.id === currentStaffId);
    const total = myStats?.totalNeeded || 0;
    const consulted = myStats?.totalCount || 0;
    return {
      totalSubjectEnrollments: total,
      consultedSubjectCount: consulted,
      percentage: total > 0 ? Math.round((consulted / total) * 100) : 0,
    };
  }, [thisMonthStats, canManageAll, currentStaffId]);

  // 상담 완료율 제목: yy.mm월 상담 완료율
  const now = new Date();
  const completionRateTitle = `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth() + 1).padStart(2, '0')}월 상담 완료율`;

  return (
    <div className="space-y-3 w-full">
      {/* 헤더 - 한 줄에 모든 요소 배치 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-primary">상담 대시보드</h1>
          <div className="flex items-center gap-1.5 text-xs text-primary-700">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateRange.start} ~ {dateRange.end}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-1.5 bg-white border border-primary/20 rounded-sm hover:bg-primary/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 상단: 요약 카드 가로 배치 */}
      <div className="grid grid-cols-6 gap-3">
        <MiniCard icon={<FileText className="w-4 h-4" />} label="총 상담" value={stats.totalConsultations} loading={loading} color="primary" />
        <MiniCard icon={<Users className="w-4 h-4" />} label="학부모" value={stats.parentConsultations} loading={loading} color="accent" />
        <MiniCard icon={<UserCheck className="w-4 h-4" />} label="학생" value={stats.studentConsultations} loading={loading} color="secondary" />
        <MiniCard icon={<AlertTriangle className="w-4 h-4" />} label="후속필요" value={stats.followUpNeeded} loading={loading} color={stats.followUpNeeded > 0 ? 'warning' : 'muted'} />

        {/* 상담 필요 카드 */}
        <div
          onClick={() => setShowNeedingConsultationModal(true)}
          className={`bg-white rounded-sm border p-3 cursor-pointer transition-all hover:shadow-md ${
            stats.studentsNeedingConsultation.length > 0 ? 'border-accent bg-accent/5' : 'border-primary/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
              stats.studentsNeedingConsultation.length > 0 ? 'bg-accent/20' : 'bg-primary-700/10'
            }`}>
              <AlertCircle className={`w-4 h-4 ${stats.studentsNeedingConsultation.length > 0 ? 'text-accent' : 'text-primary-700/50'}`} />
            </div>
            <div>
              <div className={`text-lg font-bold ${stats.studentsNeedingConsultation.length > 0 ? 'text-accent' : 'text-primary'}`}>
                {stats.studentsNeedingConsultation.length}명
              </div>
              <div className="text-xxs text-primary-700">상담 필요</div>
            </div>
          </div>
        </div>

        {/* 상담 완료율 - 항상 이번 달 기준 */}
        <div className="bg-white rounded-sm border border-primary/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-primary-700">{completionRateTitle}</span>
            <span className="text-sm font-bold text-primary">{percentage}%</span>
          </div>
          <div className="h-2 bg-primary/10 rounded-sm overflow-hidden">
            <div
              className={`h-full rounded-sm transition-all duration-500 ${percentage >= 100 ? 'bg-accent' : 'bg-primary'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xxs text-primary-700">
            <span>{consultedSubjectCount}건 완료</span>
            <span>총 {totalSubjectEnrollments}건</span>
          </div>
        </div>
      </div>

      {/* 하단: 차트 + 카테고리 + 선생님별 */}
      <div className="grid grid-cols-12 gap-3">
        {/* 일별 차트 - 더 넓게 */}
        <div className="col-span-6 bg-white rounded-sm border border-primary/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary">일별 상담 현황</h3>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-primary rounded-sm" />
                <span className="text-primary-700">학부모</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-accent rounded-sm" />
                <span className="text-primary-700">학생</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-warning rounded-sm border border-warning" />
                <span className="text-primary-700">총합</span>
              </div>
            </div>
          </div>
          <div className="h-[260px]">
            <CounselingOverview data={stats.dailyStats} loading={loading} minimal />
          </div>
        </div>

        {/* 카테고리별 분포 */}
        <div className="col-span-3 bg-white rounded-sm border border-primary/10 p-4">
          <h3 className="text-sm font-semibold text-primary mb-3">카테고리별 분포</h3>
          <CategoryStats
            stats={stats.categoryStats}
            totalCount={stats.totalConsultations}
            loading={loading}
            minimal
          />
        </div>

        {/* 선생님별 상담 */}
        <div
          className="col-span-3 bg-white rounded-sm border border-primary/10 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowStaffModal(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary">선생님별 상담</h3>
            <ChevronRight className="w-4 h-4 text-primary-700" />
          </div>
          <StaffSubjectStats
            stats={stats.staffSubjectStats.filter(s => s.totalCount > 0)}
            loading={loading}
            minimal
          />
        </div>
      </div>

      {/* 모달들 */}
      {showStaffModal && (
        <StaffStatsModal
          stats={stats.staffSubjectStats.filter(s => s.totalCount > 0)}
          onClose={() => setShowStaffModal(false)}
        />
      )}
      {showNeedingConsultationModal && (
        <NeedingConsultationModal
          students={stats.studentsNeedingConsultation}
          onClose={() => setShowNeedingConsultationModal(false)}
          canManageAll={canManageAll}
        />
      )}
    </div>
  );
};

// 미니 카드 컴포넌트
interface MiniCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading?: boolean;
  color: 'primary' | 'accent' | 'secondary' | 'warning' | 'muted';
}

const MiniCard: React.FC<MiniCardProps> = ({ icon, label, value, loading, color }) => {
  const colorMap = {
    primary: { bg: 'bg-primary/10', icon: 'text-primary' },
    accent: { bg: 'bg-accent/20', icon: 'text-accent' },
    secondary: { bg: 'bg-primary-700/10', icon: 'text-primary-700' },
    warning: { bg: 'bg-accent/20', icon: 'text-accent' },
    muted: { bg: 'bg-primary-700/10', icon: 'text-primary-700/50' },
  };
  const colors = colorMap[color];

  if (loading) {
    return (
      <div className="bg-white rounded-sm border border-primary/10 p-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary/5 rounded-sm animate-pulse" />
          <div className="flex-1">
            <div className="h-5 bg-primary/5 rounded w-10 animate-pulse" />
            <div className="h-3 bg-primary/5 rounded w-8 mt-1 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-sm border border-primary/10 p-2.5 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 ${colors.bg} rounded-sm flex items-center justify-center`}>
          <div className={colors.icon}>{icon}</div>
        </div>
        <div>
          <div className="text-base font-bold text-primary">{value}</div>
          <div className="text-xxs text-primary-700">{label}</div>
        </div>
      </div>
    </div>
  );
};

// 전체 선생님 통계 모달
interface StaffStatsModalProps {
  stats: StaffSubjectStat[];
  onClose: () => void;
}

const StaffStatsModal: React.FC<StaffStatsModalProps> = ({ stats, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-sm shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10 bg-primary">
          <h2 className="text-lg font-bold text-white">선생님별 상담 통계</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-sm transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {stats.length === 0 ? (
            <div className="text-center text-primary-700 py-8 text-sm">기록 없음</div>
          ) : (
            <div className="space-y-3">
              {stats.map((staff, idx) => {
                const hasMath = staff.mathTotal > 0;
                const hasEnglish = staff.englishTotal > 0;
                const mathPercentage = hasMath ? Math.round((staff.mathCount / staff.mathTotal) * 100) : 0;
                const englishPercentage = hasEnglish ? Math.round((staff.englishCount / staff.englishTotal) * 100) : 0;
                const totalPercentage = staff.totalNeeded > 0
                  ? Math.round((staff.totalCount / staff.totalNeeded) * 100)
                  : 0;

                return (
                  <div
                    key={staff.id}
                    className={`flex items-center gap-4 p-3 rounded-sm transition-colors ${
                      idx === 0 ? 'bg-amber-50 border border-amber-200' :
                      idx === 1 ? 'bg-gray-50 border border-gray-200' :
                      idx === 2 ? 'bg-orange-50 border border-orange-200' :
                      'bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {/* 순위 뱃지 */}
                    <div className={`w-10 h-10 rounded-sm flex items-center justify-center text-sm font-bold ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' :
                      idx === 1 ? 'bg-gray-200 text-gray-600' :
                      idx === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* 선생님 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-gray-900 mb-1">
                        {staff.name}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {hasMath && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600">수학</span>
                            <span className="px-2 py-0.5 font-medium rounded-sm" style={{ backgroundColor: SUBJECT_COLORS.math.light, color: SUBJECT_COLORS.math.bg }}>
                              {staff.mathCount}/{staff.mathTotal}
                            </span>
                            <span className="font-medium" style={{ color: SUBJECT_COLORS.math.bg }}>
                              ({mathPercentage}%)
                            </span>
                          </div>
                        )}
                        {hasMath && hasEnglish && (
                          <span className="text-gray-300">|</span>
                        )}
                        {hasEnglish && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600">영어</span>
                            <span className="px-2 py-0.5 font-medium rounded-sm" style={{ backgroundColor: SUBJECT_COLORS.english.light, color: SUBJECT_COLORS.english.bg }}>
                              {staff.englishCount}/{staff.englishTotal}
                            </span>
                            <span className="font-medium" style={{ color: SUBJECT_COLORS.english.bg }}>
                              ({englishPercentage}%)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 합계 */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {staff.totalCount}
                      </div>
                      <div className="text-xs text-gray-500">
                        /{staff.totalNeeded} ({totalPercentage}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 상담 필요 학생 모달
interface NeedingConsultationModalProps {
  students: StudentNeedingConsultation[];
  onClose: () => void;
  canManageAll?: boolean;
}

const NeedingConsultationModal: React.FC<NeedingConsultationModalProps> = ({ students, onClose, canManageAll = true }) => {
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 관리 권한이 없으면 placeholder 데이터인지 확인
  const hasPlaceholderData = students.length > 0 && students[0]?.studentId?.startsWith('placeholder-');

  // 필터링된 학생 목록 (과목별로 분리된 항목)
  const filteredStudents = useMemo(() => {
    let result = students;

    // 과목 필터
    if (subjectFilter !== 'all') {
      result = result.filter(s => s.subject === subjectFilter);
    }

    // 이름 검색
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => s.studentName.toLowerCase().includes(query));
    }

    return result;
  }, [students, subjectFilter, searchQuery]);

  // 페이지네이션 계산
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, safePage, pageSize]);

  // 필터 변경 시 페이지 초기화
  React.useEffect(() => { setCurrentPage(1); }, [subjectFilter, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-sm shadow-lg max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-accent">
          <div>
            <h3 className="text-sm font-semibold text-primary">상담 필요 학생 ({filteredStudents.length}명)</h3>
            <p className="text-xxs text-primary/70">선택 기간 내 상담 미완료</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-primary/10 rounded">
            <X className="w-4 h-4 text-primary" />
          </button>
        </div>

        {/* 필터 영역 (관리 권한이 있을 때만 표시) */}
        {!hasPlaceholderData && (
          <div className="px-4 py-2 border-b border-primary/10 bg-primary/5 flex items-center gap-2">
            {/* 과목 필터 */}
            <div className="flex bg-white rounded-sm p-0.5 border border-primary/10">
              <button
                onClick={() => setSubjectFilter('all')}
                className={`px-2 py-0.5 text-xxs font-medium rounded transition-colors ${
                  subjectFilter === 'all' ? 'bg-primary text-white' : 'text-primary-700 hover:bg-primary/10'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setSubjectFilter('math')}
                className={`px-2 py-0.5 text-xxs font-medium rounded transition-colors ${
                  subjectFilter === 'math' ? SUBJECT_COLORS.math.badge : 'text-primary-700 hover:bg-primary/10'
                }`}
              >
                수학
              </button>
              <button
                onClick={() => setSubjectFilter('english')}
                className={`px-2 py-0.5 text-xxs font-medium rounded transition-colors ${
                  subjectFilter === 'english' ? SUBJECT_COLORS.english.badge : 'text-primary-700 hover:bg-primary/10'
                }`}
              >
                영어
              </button>
            </div>

            {/* 이름 검색 */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-primary-700/50" />
              <input
                type="text"
                placeholder="이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-6 pr-2 py-1 text-xs border border-primary/10 rounded-sm focus:outline-none focus:border-accent bg-white"
              />
            </div>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {hasPlaceholderData ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-accent mx-auto mb-3" />
              <p className="text-base font-medium text-primary mb-1">
                본인 담당 상담 필요: {students.length}건
              </p>
              <p className="text-xs text-primary-700">
                전체 목록을 보려면 관리자 권한이 필요합니다
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="w-10 h-10 text-primary-700/30 mx-auto mb-2" />
              <p className="text-sm text-primary-700">
                {students.length === 0 ? '모든 학생이 상담을 완료했습니다!' : '검색 결과가 없습니다'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>이름</th>
                  <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>과목</th>
                  <th className="px-4 py-1.5 text-right text-xxs font-medium" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>최근 상담</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedStudents.map((student, idx) => (
                  <tr
                    key={`${student.studentId}-${student.subject}-${idx}`}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}
                  >
                    <td className="px-4 py-1.5 text-xs font-medium" style={{ color: 'rgb(8, 20, 41)' /* primary */ }}>{student.studentName}</td>
                    <td className="px-2 py-1.5">
                      <span className={`text-xxs px-1.5 py-0.5 rounded-sm font-medium ${
                        student.subject === 'math'
                          ? SUBJECT_COLORS.math.badge
                          : SUBJECT_COLORS.english.badge
                      }`}>
                        {student.subject === 'math' ? '수학' : '영어'}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right text-xxs" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                      {student.lastConsultationDate
                        ? `${student.lastConsultationDate} (${getDaysSince(student.lastConsultationDate)}일 전)`
                        : '상담 기록 없음'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filteredStudents.length > 0 && !hasPlaceholderData && (
          <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: 'white', borderTop: '1px solid rgba(8, 20, 41, 0.08)' /* primary with opacity */ }}>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>페이지당</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-2 py-0.5 text-xs rounded-sm border transition-all"
                style={{ borderColor: 'rgba(8, 20, 41, 0.2)' /* primary with opacity */, color: 'rgb(8, 20, 41)' /* primary */, backgroundColor: 'white' }}
              >
                <option value={10}>10개</option>
                <option value={20}>20개</option>
                <option value={50}>50개</option>
              </select>
              <span className="text-xxs" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredStudents.length)} / 총 {filteredStudents.length}개
              </span>
            </div>
            <nav className="flex items-center gap-1" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-1.5 py-0.5 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
              >이전</button>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (safePage <= 3) pageNum = i + 1;
                  else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = safePage - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-5 h-5 rounded-full text-xxs font-bold transition-colors ${
                        safePage === pageNum ? 'text-primary' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      style={{ backgroundColor: safePage === pageNum ? '#fdb813' : 'transparent' }}
                    >{pageNum}</button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-1.5 py-0.5 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
              >다음</button>
            </nav>
          </div>
        )}

        <div className="px-4 py-2.5 border-t" style={{ backgroundColor: 'rgba(8, 20, 41, 0.05)', borderColor: 'rgba(8, 20, 41, 0.1)' }}>
          <button
            onClick={onClose}
            className="w-full px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-sm hover:bg-primary/90"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultationDashboard;
