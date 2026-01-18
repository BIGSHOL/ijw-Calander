import React, { useState } from 'react';
import { Calendar, RefreshCw, FileText, Users, UserCheck, AlertTriangle, X, ChevronRight, AlertCircle } from 'lucide-react';
import { useConsultationStats, getDateRangeFromPreset, DatePreset, DEFAULT_MONTHLY_TARGET, StaffSubjectStat, StudentNeedingConsultation } from '../../hooks/useConsultationStats';
import { useStaff } from '../../hooks/useStaff';
import CounselingOverview from './CounselingOverview';
import CategoryStats from './CategoryStats';
import StaffSubjectStats from './StaffSubjectStats';

/**
 * 학원 브랜드 색상
 * - 곤색: #081429
 * - 노란색: #fdb813
 * - 회색: #373d41
 */

const ConsultationDashboard: React.FC = () => {
  const [datePreset, setDatePreset] = useState<DatePreset>('thisMonth');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showNeedingConsultationModal, setShowNeedingConsultationModal] = useState(false);

  const dateRange = getDateRangeFromPreset(datePreset);
  const { staff } = useStaff();
  const { stats, loading, refetch } = useConsultationStats(
    { dateRange },
    staff
  );

  const percentage = Math.min(100, Math.round((stats.totalConsultations / DEFAULT_MONTHLY_TARGET) * 100));

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
          <div className="flex bg-[#081429]/5 rounded-lg p-0.5">
            {(['thisWeek', 'thisMonth', 'lastMonth', 'last3Months'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  datePreset === preset
                    ? 'bg-[#081429] text-white'
                    : 'text-[#373d41] hover:text-[#081429]'
                }`}
              >
                {preset === 'thisWeek' ? '이번 주' :
                 preset === 'thisMonth' ? '이번 달' :
                 preset === 'lastMonth' ? '지난 달' : '3개월'}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-1.5 bg-white border border-[#081429]/20 rounded-lg hover:bg-[#081429]/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#081429] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 - 3열 그리드로 모든 요소 배치 */}
      <div className="grid grid-cols-12 gap-3">
        {/* 왼쪽: 요약 카드 5개 (2행 배치) + 카테고리 */}
        <div className="col-span-3 space-y-3">
          {/* 요약 카드 그리드 */}
          <div className="grid grid-cols-2 gap-2">
            <MiniCard icon={<FileText className="w-4 h-4" />} label="총 상담" value={stats.totalConsultations} loading={loading} color="primary" />
            <MiniCard icon={<Users className="w-4 h-4" />} label="학부모" value={stats.parentConsultations} loading={loading} color="accent" />
            <MiniCard icon={<UserCheck className="w-4 h-4" />} label="학생" value={stats.studentConsultations} loading={loading} color="secondary" />
            <MiniCard icon={<AlertTriangle className="w-4 h-4" />} label="후속필요" value={stats.followUpNeeded} loading={loading} color={stats.followUpNeeded > 0 ? 'warning' : 'muted'} />
          </div>

          {/* 상담 필요 카드 */}
          <div
            onClick={() => setShowNeedingConsultationModal(true)}
            className={`bg-white rounded-xl border p-3 cursor-pointer transition-all hover:shadow-md ${
              stats.studentsNeedingConsultation.length > 0 ? 'border-[#fdb813] bg-[#fdb813]/5' : 'border-[#081429]/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${stats.studentsNeedingConsultation.length > 0 ? 'text-[#fdb813]' : 'text-[#373d41]/50'}`} />
                <span className="text-xs text-[#373d41]">상담 필요</span>
              </div>
              <span className={`text-lg font-bold ${stats.studentsNeedingConsultation.length > 0 ? 'text-[#fdb813]' : 'text-[#081429]'}`}>
                {stats.studentsNeedingConsultation.length}명
              </span>
            </div>
          </div>

          {/* 목표 달성률 */}
          <div className="bg-white rounded-xl border border-[#081429]/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#373d41]">목표 달성률</span>
              <span className="text-sm font-bold text-[#081429]">{percentage}%</span>
            </div>
            <div className="h-2 bg-[#081429]/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${percentage >= 100 ? 'bg-[#fdb813]' : 'bg-[#081429]'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-[#373d41]">
              <span>{stats.totalConsultations}건</span>
              <span>목표 {DEFAULT_MONTHLY_TARGET}건</span>
            </div>
          </div>

          {/* 카테고리별 분포 */}
          <div className="bg-white rounded-xl border border-[#081429]/10 p-3">
            <h3 className="text-xs font-semibold text-[#081429] mb-2">카테고리별 분포</h3>
            <CategoryStats
              stats={stats.categoryStats}
              totalCount={stats.totalConsultations}
              loading={loading}
              minimal
            />
          </div>
        </div>

        {/* 중앙: 일별 차트 */}
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
          <div className="h-[280px]">
            <CounselingOverview data={stats.dailyStats} loading={loading} minimal />
          </div>
        </div>

        {/* 오른쪽: 선생님별 상담 */}
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
        <div className="max-h-64 overflow-y-auto">
          {stats.length === 0 ? (
            <div className="text-center text-[#373d41] py-4 text-xs">기록 없음</div>
          ) : (
            <div className="divide-y divide-[#081429]/5">
              {stats.map((staff, idx) => (
                <div key={staff.id} className={`flex items-center justify-between px-3 py-1.5 ${idx === 0 ? 'bg-[#fdb813]/20' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      idx === 0 ? 'bg-[#fdb813] text-[#081429]' :
                      idx === 1 ? 'bg-[#373d41]/20 text-[#373d41]' :
                      idx === 2 ? 'bg-[#373d41]/10 text-[#373d41]' :
                      'bg-[#081429]/5 text-[#373d41]'
                    }`}>{idx + 1}</span>
                    <span className="text-xs text-[#081429]">{staff.name}</span>
                  </div>
                  <span className="text-sm font-bold text-[#081429]">{staff.totalCount}</span>
                </div>
              ))}
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#081429]/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#081429]/10 bg-[#fdb813]">
          <div>
            <h3 className="text-sm font-semibold text-[#081429]">상담 필요 학생 ({students.length}명)</h3>
            <p className="text-[10px] text-[#081429]/70">이번 달 과목별 상담 미완료</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#081429]/10 rounded">
            <X className="w-4 h-4 text-[#081429]" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {students.length === 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="w-10 h-10 text-[#373d41]/30 mx-auto mb-2" />
              <p className="text-sm text-[#373d41]">모든 학생이 상담을 완료했습니다!</p>
            </div>
          ) : (
            <div className="divide-y divide-[#081429]/5">
              {students.map((student) => (
                <div key={student.studentId} className="px-4 py-2.5 hover:bg-[#081429]/5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#081429]">{student.studentName}</span>
                    {student.enrolledSubjects.map((subject) => (
                      <span
                        key={subject}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          subject === 'math' ? 'bg-[#081429]/10 text-[#081429]' : 'bg-[#fdb813]/30 text-[#081429]'
                        }`}
                      >
                        {subject === 'math' ? '수학' : '영어'}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-[#373d41] mt-0.5">
                    선택 기간 내 상담 기록 없음
                  </div>
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
