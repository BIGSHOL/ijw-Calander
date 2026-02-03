// components/DailyAttendance/AttendanceStats.tsx
// Component for displaying attendance statistics and charts
import React, { useMemo } from 'react';
import {
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  PieChart
} from 'lucide-react';
import {
  DailyAttendanceRecord,
  AttendanceStatus,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS
} from '../../types';

interface AttendanceStatsProps {
  date: string;
  records: DailyAttendanceRecord[];
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: typeof Users;
  color: string;
  subtext?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subtext }) => (
  <div className="bg-white rounded-sm p-6 shadow-sm border border-gray-200">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
        {subtext && <p className="text-sm text-gray-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-sm ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
  </div>
);

const AttendanceStats: React.FC<AttendanceStatsProps> = ({ date, records }) => {
  // Calculate statistics
  const stats = useMemo(() => {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const earlyLeave = records.filter(r => r.status === 'early_leave').length;
    const excused = records.filter(r => r.status === 'excused').length;

    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return {
      total,
      present,
      late,
      absent,
      earlyLeave,
      excused,
      attendanceRate,
    };
  }, [records]);

  // Group by class
  const statsByClass = useMemo(() => {
    const grouped = new Map<string, {
      className: string;
      total: number;
      present: number;
      late: number;
      absent: number;
      attendanceRate: number;
    }>();

    records.forEach(record => {
      if (!grouped.has(record.classId)) {
        grouped.set(record.classId, {
          className: record.className,
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          attendanceRate: 0,
        });
      }

      const classStats = grouped.get(record.classId)!;
      classStats.total++;
      if (record.status === 'present') classStats.present++;
      if (record.status === 'late') classStats.late++;
      if (record.status === 'absent') classStats.absent++;
    });

    // Calculate attendance rate for each class
    grouped.forEach((value) => {
      value.attendanceRate = value.total > 0
        ? Math.round(((value.present + value.late) / value.total) * 100)
        : 0;
    });

    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }, [records]);

  // Status distribution for visualization
  const statusDistribution: Array<{ status: AttendanceStatus; count: number; percentage: number }> = useMemo(() => {
    const total = records.length;
    const statuses: AttendanceStatus[] = ['present', 'late', 'absent', 'early_leave', 'excused'];

    return statuses.map(status => {
      const count = records.filter(r => r.status === status).length;
      return {
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <PieChart className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">통계를 표시할 데이터가 없습니다</p>
        <p className="text-sm mt-1">선택한 날짜에 출결 기록이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="전체 학생"
          value={stats.total}
          icon={Users}
          color="text-gray-600"
          subtext="명"
        />
        <StatCard
          title="출석률"
          value={`${stats.attendanceRate}%`}
          icon={TrendingUp}
          color="text-emerald-600"
          subtext={`${stats.present + stats.late}/${stats.total}명 출석`}
        />
        <StatCard
          title="지각"
          value={stats.late}
          icon={Clock}
          color="text-amber-600"
          subtext="명"
        />
        <StatCard
          title="결석"
          value={stats.absent + stats.excused}
          icon={AlertTriangle}
          color="text-red-600"
          subtext={`결석 ${stats.absent}명 + 사유결석 ${stats.excused}명`}
        />
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-sm p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">출결 현황</h3>

        {/* Progress Bar */}
        <div className="h-8 rounded-sm overflow-hidden flex bg-gray-100">
          {statusDistribution.map(({ status, count, percentage }) => {
            if (count === 0) return null;
            const colors = ATTENDANCE_STATUS_COLORS[status];
            const bgColor = colors.bg.replace('bg-', '').replace('-100', '-500');

            return (
              <div
                key={status}
                className={`h-full bg-${bgColor} transition-all relative group`}
                style={{ width: `${percentage}%` }}
                title={`${ATTENDANCE_STATUS_LABELS[status]}: ${count}명 (${percentage}%)`}
              >
                {percentage >= 10 && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    {percentage}%
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4">
          {statusDistribution.map(({ status, count, percentage }) => {
            const colors = ATTENDANCE_STATUS_COLORS[status];
            return (
              <div key={status} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-sm ${colors.bg}`} />
                <span className="text-sm text-gray-600">
                  {ATTENDANCE_STATUS_LABELS[status]}: {count}명 ({percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats by Class */}
      <div className="bg-white rounded-sm p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">수업별 출결 현황</h3>

        <div className="space-y-4">
          {statsByClass.map((classData) => (
            <div key={classData.className} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{classData.className}</span>
                <span className="text-sm text-gray-500">{classData.total}명</span>
              </div>

              {/* Mini Progress Bar */}
              <div className="h-2 rounded-sm overflow-hidden flex bg-gray-100">
                {classData.present > 0 && (
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${(classData.present / classData.total) * 100}%` }}
                  />
                )}
                {classData.late > 0 && (
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${(classData.late / classData.total) * 100}%` }}
                  />
                )}
                {classData.absent > 0 && (
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${(classData.absent / classData.total) * 100}%` }}
                  />
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  출석 {classData.present}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  지각 {classData.late}
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  결석 {classData.absent}
                </span>
                <span className="ml-auto font-medium text-gray-700">
                  출석률 {classData.attendanceRate}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AttendanceStats;
