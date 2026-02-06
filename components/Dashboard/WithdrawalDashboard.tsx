import React, { useState, useMemo } from 'react';
import {
  Calendar,
  RefreshCw,
  UserMinus,
  LogOut,
  BookX,
  Phone,
  X,
  ChevronRight,
  TrendingDown,
  Users,
} from 'lucide-react';
import {
  useWithdrawalStats,
  IncompleteConsultation,
  StaffWithdrawalStat,
} from '../../hooks/useWithdrawalStats';
import { useStaff } from '../../hooks/useStaff';
import { usePermissions } from '../../hooks/usePermissions';
import { UserProfile } from '../../types';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  BarChart,
  PieChart,
  Pie,
} from 'recharts';
import { WITHDRAWAL_REASON_LABEL, SUBJECT_LABEL, SUBJECT_COLOR } from '../../constants/withdrawal';

interface WithdrawalDashboardProps {
  currentUser?: UserProfile | null;
}

const WithdrawalDashboard: React.FC<WithdrawalDashboardProps> = ({
  currentUser,
}) => {
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);

  const { hasPermission } = usePermissions(currentUser || null);
  const isMasterOrAdmin = currentUser?.role === 'master' || currentUser?.role === 'admin';
  const canManage = isMasterOrAdmin || hasPermission('withdrawal.edit');

  const { staff } = useStaff();
  const { stats, loading, refetch } = useWithdrawalStats(undefined, staff);

  // 현재 날짜 정보
  const now = new Date();
  const currentMonthLabel = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 차트 색상
  const COLORS = {
    withdrawn: '#ef4444',    // red-500
    subjectEnded: '#f97316', // orange-500
    total: '#fdb813',        // accent
    primary: '#081429',
  };

  // 사유별 차트 색상
  const REASON_COLORS = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#6b7280', // gray-500
  ];

  // 과목별 차트 색상
  const SUBJECT_CHART_COLORS: Record<string, string> = {
    math: '#3b82f6',
    english: '#10b981',
    korean: '#8b5cf6',
    science: '#f97316',
    other: '#6b7280',
  };

  return (
    <div className="space-y-3 w-full p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-primary flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            퇴원 통계
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-primary-700">
            <Calendar className="w-3.5 h-3.5" />
            <span>최근 12개월</span>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={loading}
          className="p-1.5 bg-white border border-primary/20 rounded-sm hover:bg-primary/5 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-primary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 상단: 요약 카드 6개 */}
      <div className="grid grid-cols-6 gap-3">
        <MiniCard
          icon={<UserMinus className="w-4 h-4" />}
          label="전체 퇴원"
          value={stats.totalWithdrawals}
          loading={loading}
          color="primary"
        />
        <MiniCard
          icon={<Calendar className="w-4 h-4" />}
          label={`${currentMonthLabel}월`}
          value={stats.thisMonthWithdrawals}
          loading={loading}
          color={stats.thisMonthWithdrawals > 0 ? 'warning' : 'muted'}
        />
        <MiniCard
          icon={<LogOut className="w-4 h-4" />}
          label="완전 퇴원"
          value={stats.withdrawnCount}
          loading={loading}
          color="warning"
        />
        <MiniCard
          icon={<BookX className="w-4 h-4" />}
          label="수강종료"
          value={stats.subjectEndedCount}
          loading={loading}
          color="secondary"
        />

        {/* 상담 미완료 카드 */}
        <div
          onClick={() => setShowIncompleteModal(true)}
          className={`bg-white rounded-sm border p-3 cursor-pointer transition-all hover:shadow-md ${
            stats.incompleteConsultations.length > 0 ? 'border-accent bg-accent/5' : 'border-primary/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
              stats.incompleteConsultations.length > 0 ? 'bg-accent/20' : 'bg-primary-700/10'
            }`}>
              <Phone className={`w-4 h-4 ${stats.incompleteConsultations.length > 0 ? 'text-accent' : 'text-primary-700/50'}`} />
            </div>
            <div>
              <div className={`text-lg font-bold ${stats.incompleteConsultations.length > 0 ? 'text-accent' : 'text-primary'}`}>
                {stats.incompleteConsultations.length}명
              </div>
              <div className="text-xxs text-primary-700">상담 미완료</div>
            </div>
          </div>
        </div>

        {/* 상담 완료율 */}
        <div className="bg-white rounded-sm border border-primary/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-primary-700">상담 완료율</span>
            <span className="text-sm font-bold text-primary">{stats.consultationCompleteRate}%</span>
          </div>
          <div className="h-2 bg-primary/10 rounded-sm overflow-hidden">
            <div
              className={`h-full rounded-sm transition-all duration-500 ${
                stats.consultationCompleteRate >= 100 ? 'bg-green-500' : 'bg-primary'
              }`}
              style={{ width: `${stats.consultationCompleteRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xxs text-primary-700">
            <span>퇴원생 상담 체크</span>
            <span>{stats.withdrawnCount}명</span>
          </div>
        </div>
      </div>

      {/* 하단: 차트 영역 */}
      <div className="grid grid-cols-12 gap-3">
        {/* 월별 추이 차트 */}
        <div className="col-span-5 bg-white rounded-sm border border-primary/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary">월별 퇴원 추이</h3>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
                <span className="text-primary-700">퇴원</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-orange-500 rounded-sm" />
                <span className="text-primary-700">수강종료</span>
              </div>
            </div>
          </div>
          <div className="h-[260px]" style={{ minWidth: 0 }}>
            {loading ? (
              <div className="w-full h-full bg-primary/5 animate-pulse rounded-sm" />
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={stats.monthlyStats} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [
                      `${value}명`,
                      name === 'withdrawnCount' ? '퇴원' : name === 'subjectEndedCount' ? '수강종료' : '합계',
                    ]}
                  />
                  <Bar dataKey="withdrawnCount" stackId="a" fill={COLORS.withdrawn} name="퇴원" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="subjectEndedCount" stackId="a" fill={COLORS.subjectEnded} name="수강종료" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="total" stroke={COLORS.total} strokeWidth={2} dot={{ r: 3 }} name="합계" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 과목별 퇴원 분포 - Donut Chart */}
        <div className="col-span-3 bg-white rounded-sm border border-primary/10 p-4">
          <h3 className="text-sm font-semibold text-primary mb-3">과목별 퇴원 분포</h3>
          <div className="h-[260px] flex flex-col">
            {loading ? (
              <div className="w-full h-full bg-primary/5 animate-pulse rounded-sm" />
            ) : stats.subjectStats.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-primary-700">
                데이터 없음
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0" style={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie
                        data={stats.subjectStats.map(s => ({ name: s.label, value: s.count, subject: s.subject }))}
                        cx="50%"
                        cy="45%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {stats.subjectStats.map((entry, index) => (
                          <Cell
                            key={`subject-${index}`}
                            fill={SUBJECT_CHART_COLORS[entry.subject] || '#6b7280'}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number, name: string) => [`${value}명`, name]}
                        itemStyle={{ color: '#374151' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                  {stats.subjectStats.map((entry) => (
                    <div key={entry.subject} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: SUBJECT_CHART_COLORS[entry.subject] || '#6b7280' }}
                      />
                      <span className="text-primary-700">
                        {entry.label} {entry.count}명 ({entry.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 우측 컬럼: 사유별 + 강사별 */}
        <div className="col-span-4 flex flex-col gap-3">
          {/* 사유별 분포 */}
          <div className="bg-white rounded-sm border border-primary/10 p-4 flex-1">
            <h3 className="text-sm font-semibold text-primary mb-2">퇴원 사유별 분포</h3>
            {loading ? (
              <div className="w-full h-20 bg-primary/5 animate-pulse rounded-sm" />
            ) : stats.reasonStats.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm text-primary-700">
                데이터 없음
              </div>
            ) : (
              <div className="space-y-1.5">
                {stats.reasonStats.map((item, idx) => (
                  <div key={item.reason} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: REASON_COLORS[idx % REASON_COLORS.length] }}
                    />
                    <span className="text-xs text-primary-700 w-20 truncate">{item.label}</span>
                    <div className="flex-1 h-3.5 bg-gray-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm transition-all"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: REASON_COLORS[idx % REASON_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-primary w-12 text-right">
                      {item.count}명 ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 강사별 퇴원 통계 */}
          <div
            className="bg-white rounded-sm border border-primary/10 p-4 flex-1 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setShowStaffModal(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Users className="w-4 h-4" />
                강사별 퇴원 통계
              </h3>
              <ChevronRight className="w-4 h-4 text-primary-700" />
            </div>
            {loading ? (
              <div className="w-full h-20 bg-primary/5 animate-pulse rounded-sm" />
            ) : stats.staffStats.length === 0 ? (
              <div className="text-sm text-primary-700 py-2">데이터 없음</div>
            ) : (
              <div className="space-y-1.5">
                {stats.staffStats.slice(0, 5).map((staff, idx) => (
                  <div
                    key={staff.staffId}
                    className={`flex items-center gap-2 p-1.5 rounded-sm ${
                      idx === 0 ? 'bg-red-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      idx === 0 ? 'bg-red-100 text-red-600' :
                      idx === 1 ? 'bg-orange-100 text-orange-600' :
                      idx === 2 ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className="text-xs font-medium text-primary flex-1 truncate">{staff.staffName}</span>
                    <div className="flex items-center gap-1">
                      {staff.mathCount > 0 && (
                        <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                          수 {staff.mathCount}
                        </span>
                      )}
                      {staff.englishCount > 0 && (
                        <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">
                          영 {staff.englishCount}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-primary shrink-0">{staff.totalCount}명</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모달들 */}
      {showIncompleteModal && (
        <IncompleteConsultationModal
          consultations={stats.incompleteConsultations}
          onClose={() => setShowIncompleteModal(false)}
        />
      )}
      {showStaffModal && (
        <StaffStatsModal
          stats={stats.staffStats}
          onClose={() => setShowStaffModal(false)}
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
    warning: { bg: 'bg-red-100', icon: 'text-red-500' },
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

// 상담 미완료 모달
interface IncompleteConsultationModalProps {
  consultations: IncompleteConsultation[];
  onClose: () => void;
}

const PENDING_LABELS: Record<string, string> = {
  adminCalled: '관리자 통화',
  teacherCalled: '담임 통화',
  studentTalked: '학생 상담',
};

const IncompleteConsultationModal: React.FC<IncompleteConsultationModalProps> = ({
  consultations,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-primary/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-sm shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10 bg-primary">
          <h2 className="text-lg font-bold text-white">상담 미완료 퇴원생</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-sm transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {consultations.length === 0 ? (
            <div className="text-center text-primary-700 py-8 text-sm">
              모든 퇴원생 상담이 완료되었습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {consultations.map((item) => (
                <div
                  key={item.studentId}
                  className="flex items-center justify-between p-3 rounded-sm border border-gray-200 hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium text-primary">{item.studentName}</div>
                    <div className="text-xs text-primary-700">
                      {item.type === 'withdrawn' ? '퇴원' : '수강종료'} | {item.withdrawalDate}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.pendingItems.map((pending) => (
                      <span
                        key={pending}
                        className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded"
                      >
                        {PENDING_LABELS[pending]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 강사별 통계 모달
interface StaffStatsModalProps {
  stats: StaffWithdrawalStat[];
  onClose: () => void;
}

const StaffStatsModal: React.FC<StaffStatsModalProps> = ({ stats, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-primary/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-sm shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10 bg-primary">
          <h2 className="text-lg font-bold text-white">강사별 퇴원 통계</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-sm transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {stats.length === 0 ? (
            <div className="text-center text-primary-700 py-8 text-sm">데이터 없음</div>
          ) : (
            <div className="space-y-3">
              {stats.map((staff, idx) => (
                <div
                  key={staff.staffId}
                  className={`flex items-center gap-4 p-3 rounded-sm transition-colors ${
                    idx === 0 ? 'bg-red-50 border border-red-200' :
                    idx === 1 ? 'bg-orange-50 border border-orange-200' :
                    idx === 2 ? 'bg-amber-50 border border-amber-200' :
                    'bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-sm flex items-center justify-center text-sm font-bold ${
                    idx === 0 ? 'bg-red-100 text-red-700' :
                    idx === 1 ? 'bg-orange-100 text-orange-600' :
                    idx === 2 ? 'bg-amber-100 text-amber-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-gray-900 mb-1">
                      {staff.staffName}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {staff.mathCount > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          수학 {staff.mathCount}명
                        </span>
                      )}
                      {staff.englishCount > 0 && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
                          영어 {staff.englishCount}명
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-bold text-red-600">{staff.totalCount}</div>
                    <div className="text-xs text-primary-700">퇴원/종료</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WithdrawalDashboard;
