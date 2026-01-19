import React, { useState, useMemo } from 'react';
import { Calendar, RefreshCw, FileText, Users, UserCheck, AlertTriangle, X, ChevronRight, AlertCircle, Search } from 'lucide-react';
import { useConsultationStats, getDateRangeFromPreset, DatePreset, StaffSubjectStat, StudentNeedingConsultation } from '../../hooks/useConsultationStats';
import { useStaff } from '../../hooks/useStaff';
import CounselingOverview from './CounselingOverview';
import CategoryStats from './CategoryStats';
import StaffSubjectStats from './StaffSubjectStats';

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
}

const ConsultationDashboard: React.FC<ConsultationDashboardProps> = ({
  dateRange: externalDateRange,
  onDateRangeChange,
}) => {
  const [internalDatePreset, setInternalDatePreset] = useState<DatePreset>('thisMonth');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showNeedingConsultationModal, setShowNeedingConsultationModal] = useState(false);

  // 외부 dateRange가 있으면 사용, 없으면 내부 preset 사용
  const dateRange = externalDateRange || getDateRangeFromPreset(internalDatePreset);
  const { staff } = useStaff();
  const { stats, loading, refetch } = useConsultationStats(
    { dateRange },
    staff
  );

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
  // 과목별 카운트 기준: (총 과목 수강 건수 - 상담 필요 항목 수) / 총 과목 수강 건수 * 100
  // 예: 수학+영어 동시 수강생 10명 = 총 20건, 상담 필요 5건 → (20-5)/20 = 75%
  const totalSubjectEnrollments = thisMonthStats?.totalSubjectEnrollments || 0;
  const needingConsultationCount = thisMonthStats?.studentsNeedingConsultation?.length || 0;
  const consultedSubjectCount = Math.max(0, totalSubjectEnrollments - needingConsultationCount);
  const percentage = totalSubjectEnrollments > 0
    ? Math.round((consultedSubjectCount / totalSubjectEnrollments) * 100)
    : 0;

  // 상담 완료율 제목: yy.mm월 상담 완료율
  const now = new Date();
  const completionRateTitle = `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth() + 1).padStart(2, '0')}월 상담 완료율`;

  return (
    <div className="space-y-3 w-full">
      {/* 헤더 - 한 줄에 모든 요소 배치 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-[#081429]">상담 대시보드</h1>
          <div className="flex items-center gap-1.5 text-xs text-[#373d41]">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateRange.start} ~ {dateRange.end}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-1.5 bg-white border border-[#081429]/20 rounded-lg hover:bg-[#081429]/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#081429] ${loading ? 'animate-spin' : ''}`} />
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
          className={`bg-white rounded-xl border p-3 cursor-pointer transition-all hover:shadow-md ${
            stats.studentsNeedingConsultation.length > 0 ? 'border-[#fdb813] bg-[#fdb813]/5' : 'border-[#081429]/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              stats.studentsNeedingConsultation.length > 0 ? 'bg-[#fdb813]/20' : 'bg-[#373d41]/10'
            }`}>
              <AlertCircle className={`w-4 h-4 ${stats.studentsNeedingConsultation.length > 0 ? 'text-[#fdb813]' : 'text-[#373d41]/50'}`} />
            </div>
            <div>
              <div className={`text-lg font-bold ${stats.studentsNeedingConsultation.length > 0 ? 'text-[#fdb813]' : 'text-[#081429]'}`}>
                {stats.studentsNeedingConsultation.length}명
              </div>
              <div className="text-[10px] text-[#373d41]">상담 필요</div>
            </div>
          </div>
        </div>

        {/* 상담 완료율 - 항상 이번 달 기준 */}
        <div className="bg-white rounded-xl border border-[#081429]/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[#373d41]">{completionRateTitle}</span>
            <span className="text-sm font-bold text-[#081429]">{percentage}%</span>
          </div>
          <div className="h-2 bg-[#081429]/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${percentage >= 100 ? 'bg-[#fdb813]' : 'bg-[#081429]'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-[#373d41]">
            <span>{consultedSubjectCount}건 완료</span>
            <span>총 {totalSubjectEnrollments}건</span>
          </div>
        </div>
      </div>

      {/* 하단: 차트 + 카테고리 + 선생님별 */}
      <div className="grid grid-cols-12 gap-3">
        {/* 일별 차트 - 더 넓게 */}
        <div className="col-span-6 bg-white rounded-xl border border-[#081429]/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#081429]">일별 상담 현황</h3>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-[#081429] rounded-full" />
                <span className="text-[#373d41]">학부모</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-[#fdb813] rounded-full" />
                <span className="text-[#373d41]">학생</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-[#f59e0b] rounded-full border border-[#f59e0b]" />
                <span className="text-[#373d41]">총합</span>
              </div>
            </div>
          </div>
          <div className="h-[260px]">
            <CounselingOverview data={stats.dailyStats} loading={loading} minimal />
          </div>
        </div>

        {/* 카테고리별 분포 */}
        <div className="col-span-3 bg-white rounded-xl border border-[#081429]/10 p-4">
          <h3 className="text-sm font-semibold text-[#081429] mb-3">카테고리별 분포</h3>
          <CategoryStats
            stats={stats.categoryStats}
            totalCount={stats.totalConsultations}
            loading={loading}
            minimal
          />
        </div>

        {/* 선생님별 상담 */}
        <div
          className="col-span-3 bg-white rounded-xl border border-[#081429]/10 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowStaffModal(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#081429]">선생님별 상담</h3>
            <ChevronRight className="w-4 h-4 text-[#373d41]" />
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
    primary: { bg: 'bg-[#081429]/10', icon: 'text-[#081429]' },
    accent: { bg: 'bg-[#fdb813]/20', icon: 'text-[#fdb813]' },
    secondary: { bg: 'bg-[#373d41]/10', icon: 'text-[#373d41]' },
    warning: { bg: 'bg-[#fdb813]/20', icon: 'text-[#fdb813]' },
    muted: { bg: 'bg-[#373d41]/10', icon: 'text-[#373d41]/50' },
  };
  const colors = colorMap[color];

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#081429]/10 p-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#081429]/5 rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-5 bg-[#081429]/5 rounded w-10 animate-pulse" />
            <div className="h-3 bg-[#081429]/5 rounded w-8 mt-1 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#081429]/10 p-2.5 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 ${colors.bg} rounded-lg flex items-center justify-center`}>
          <div className={colors.icon}>{icon}</div>
        </div>
        <div>
          <div className="text-base font-bold text-[#081429]">{value}</div>
          <div className="text-[10px] text-[#373d41]">{label}</div>
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
      <div className="absolute inset-0 bg-[#081429]/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-xs w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#081429]/10 bg-[#081429]">
          <span className="text-sm font-semibold text-white">선생님별 상담</span>
          <button onClick={onClose} className="p-0.5 hover:bg-white/20 rounded">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {stats.length === 0 ? (
            <div className="text-center text-[#373d41] py-4 text-xs">기록 없음</div>
          ) : (
            <div className="divide-y divide-[#081429]/5">
              {stats.map((staff, idx) => {
                const hasMath = staff.mathTotal > 0;
                const hasEnglish = staff.englishTotal > 0;
                const totalPercentage = staff.totalNeeded > 0
                  ? Math.round((staff.totalCount / staff.totalNeeded) * 100)
                  : 0;

                return (
                  <div key={staff.id} className={`px-3 py-2 ${idx === 0 ? 'bg-[#fdb813]/20' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          idx === 0 ? 'bg-[#fdb813] text-[#081429]' :
                          idx === 1 ? 'bg-[#373d41]/20 text-[#373d41]' :
                          idx === 2 ? 'bg-[#373d41]/10 text-[#373d41]' :
                          'bg-[#081429]/5 text-[#373d41]'
                        }`}>{idx + 1}</span>
                        <span className="text-sm font-medium text-[#081429]">{staff.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-[#081429]">{staff.totalCount}</span>
                        <span className="text-[10px] text-[#373d41]">/ {staff.totalNeeded}</span>
                        <span className="text-[10px] text-[#fdb813] font-bold ml-1">({totalPercentage}%)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] ml-7">
                      {hasMath && (
                        <span className="text-blue-600">
                          수학 {staff.mathCount}/{staff.mathTotal}
                        </span>
                      )}
                      {hasMath && hasEnglish && <span className="text-gray-300">|</span>}
                      {hasEnglish && (
                        <span className="text-emerald-600">
                          영어 {staff.englishCount}/{staff.englishTotal}
                        </span>
                      )}
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
}

const NeedingConsultationModal: React.FC<NeedingConsultationModalProps> = ({ students, onClose }) => {
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#081429]/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#081429]/10 bg-[#fdb813]">
          <div>
            <h3 className="text-sm font-semibold text-[#081429]">상담 필요 학생 ({filteredStudents.length}명)</h3>
            <p className="text-[10px] text-[#081429]/70">선택 기간 내 상담 미완료</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#081429]/10 rounded">
            <X className="w-4 h-4 text-[#081429]" />
          </button>
        </div>

        {/* 필터 영역 */}
        <div className="px-4 py-2 border-b border-[#081429]/10 bg-[#081429]/5 flex items-center gap-2">
          {/* 과목 필터 */}
          <div className="flex bg-white rounded-md p-0.5 border border-[#081429]/10">
            <button
              onClick={() => setSubjectFilter('all')}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                subjectFilter === 'all' ? 'bg-[#081429] text-white' : 'text-[#373d41] hover:bg-[#081429]/10'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setSubjectFilter('math')}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                subjectFilter === 'math' ? 'bg-[#081429] text-white' : 'text-[#373d41] hover:bg-[#081429]/10'
              }`}
            >
              수학
            </button>
            <button
              onClick={() => setSubjectFilter('english')}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                subjectFilter === 'english' ? 'bg-[#fdb813] text-[#081429]' : 'text-[#373d41] hover:bg-[#081429]/10'
              }`}
            >
              영어
            </button>
          </div>

          {/* 이름 검색 */}
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#373d41]/50" />
            <input
              type="text"
              placeholder="이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-6 pr-2 py-1 text-xs border border-[#081429]/10 rounded-md focus:outline-none focus:border-[#fdb813] bg-white"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="w-10 h-10 text-[#373d41]/30 mx-auto mb-2" />
              <p className="text-sm text-[#373d41]">
                {students.length === 0 ? '모든 학생이 상담을 완료했습니다!' : '검색 결과가 없습니다'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#081429]/5">
              {filteredStudents.map((student, idx) => (
                <div key={`${student.studentId}-${student.subject}-${idx}`} className="px-4 py-2 hover:bg-[#081429]/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#081429] min-w-[60px]">{student.studentName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      student.subject === 'math'
                        ? 'bg-[#081429]/10 text-[#081429]'
                        : 'bg-[#fdb813]/30 text-[#081429]'
                    }`}>
                      {student.subject === 'math' ? '수학' : '영어'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#373d41]">
                    {student.lastConsultationDate
                      ? `최근: ${student.lastConsultationDate} (${getDaysSince(student.lastConsultationDate)}일 전)`
                      : '상담 기록 없음'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-2.5 bg-[#081429]/5 border-t border-[#081429]/10">
          <button
            onClick={onClose}
            className="w-full px-3 py-1.5 bg-[#081429] text-white text-sm font-medium rounded-lg hover:bg-[#081429]/90"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultationDashboard;
