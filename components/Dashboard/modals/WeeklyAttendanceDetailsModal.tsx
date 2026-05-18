/**
 * 주간 출석 추이 KPI 근거 데이터 모달
 * - 요일별 탭 (월~일) 형식으로 한 번에 한 요일만 표시
 * - 데이터 소스: daily_attendance (1순위) → attendance_records 셀 집계 (2순위)
 * - 학생 명단: 이름/반/상태 (출석/지각/결석)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { UnifiedStudent } from '../../../types/student';
import type { DailyAttendanceRecord } from '../../../types/attendance';
import type { DayAttendanceSummary } from '../../../hooks/useWeeklyAttendanceFromRecords';

interface CellEntry {
  studentId: string;
  studentName: string;
  className: string;
  status: 'present' | 'late' | 'absent';
}

interface WeeklyAttendanceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 7일치 날짜 (YYYY-MM-DD, 오래된 → 최신 순) */
  dates: string[];
  /** daily_attendance 7일치 raw 데이터 (index=날짜 순서) */
  weeklyDaily: DailyAttendanceRecord[][];
  /** attendance_records fallback (date → summary) */
  weeklyFromRecords: Record<string, DayAttendanceSummary>;
  /** 학생 정보 (이름 매칭용) */
  students: UnifiedStudent[];
  /** 요약 (day 한글 라벨 + rate + source) */
  weeklySummary: { day: string; rate: number; source: 'daily' | 'records' | 'empty' }[];
}

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

const statusToKo: Record<string, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
};
const statusBadge: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700',
  late: 'bg-amber-100 text-amber-700',
  absent: 'bg-red-100 text-red-700',
};

// attendance_records 의 셀에서 학생 정보까지 펼치기
function buildCellEntriesFromRecords(
  date: string,
  students: UnifiedStudent[]
): CellEntry[] | null {
  // 본 모달은 records 의 rawCells 를 받지 않으므로 students 매칭 불가.
  // (Hook 확장 전 단계 — fallback 일 때 학생명단 미제공)
  void date; void students;
  return null;
}

const WeeklyAttendanceDetailsModal: React.FC<WeeklyAttendanceDetailsModalProps> = ({
  isOpen,
  onClose,
  dates,
  weeklyDaily,
  weeklyFromRecords,
  students,
  weeklySummary,
}) => {
  // 현재 선택된 날짜 인덱스 (기본: 가장 최근 = 마지막 인덱스)
  const [selectedIdx, setSelectedIdx] = useState(dates.length - 1);

  useEffect(() => {
    if (isOpen) setSelectedIdx(dates.length - 1);
  }, [isOpen, dates.length]);

  const selectedDate = dates[selectedIdx] || '';

  // 선택된 날짜의 학생별 출석 정보
  const { entries, dataSource, counts } = useMemo(() => {
    const daily = weeklyDaily[selectedIdx] || [];
    let entries: CellEntry[] = [];
    let dataSource: 'daily' | 'records' | 'empty' = 'empty';

    if (daily.length > 0) {
      dataSource = 'daily';
      entries = daily
        .map((r): CellEntry => ({
          studentId: r.studentId || '',
          studentName: r.studentName || r.studentId || '(이름없음)',
          className: r.className || '',
          status: (r.status === 'late' ? 'late' : r.status === 'absent' ? 'absent' : 'present') as
            | 'present'
            | 'late'
            | 'absent',
        }))
        .sort((a, b) => {
          const order: Record<string, number> = { absent: 0, late: 1, present: 2 };
          const o = order[a.status] - order[b.status];
          if (o !== 0) return o;
          return a.studentName.localeCompare(b.studentName);
        });
    } else {
      const rec = weeklyFromRecords[selectedDate];
      if (rec && rec.totalCount > 0) {
        dataSource = 'records';
        const fromRecords = buildCellEntriesFromRecords(selectedDate, students);
        entries = fromRecords || [];
      }
    }

    const counts = {
      present: entries.filter(e => e.status === 'present').length,
      late: entries.filter(e => e.status === 'late').length,
      absent: entries.filter(e => e.status === 'absent').length,
    };
    return { entries, dataSource, counts };
  }, [selectedIdx, weeklyDaily, weeklyFromRecords, selectedDate, students]);

  // records fallback 일 때 hook 에서 받은 totalCount 로 카운트 보완
  const recordsSummary = weeklyFromRecords[selectedDate];
  const displayCounts =
    dataSource === 'daily'
      ? counts
      : dataSource === 'records' && recordsSummary
      ? {
          present: recordsSummary.presentCount - recordsSummary.lateCount,
          late: recordsSummary.lateCount,
          absent: recordsSummary.absentCount,
        }
      : { present: 0, late: 0, absent: 0 };

  const totalForDay = displayCounts.present + displayCounts.late + displayCounts.absent;
  const rateForDay =
    totalForDay > 0
      ? Math.round(((displayCounts.present + displayCounts.late) / totalForDay) * 100)
      : 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[8vh] bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[860px] max-w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-emerald-50">
          <div className="flex items-center gap-2">
            <span className="text-emerald-700 text-lg">📈</span>
            <h2 className="font-bold text-sm text-emerald-900">주간 출석 추이 — 근거 데이터</h2>
            <span className="text-xs text-emerald-600">{dates[0]} ~ {dates[dates.length - 1]}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-emerald-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* 요일 탭 */}
        <div className="px-3 pt-2 border-b bg-gray-50">
          <div className="flex gap-1">
            {dates.map((d, idx) => {
              const dt = new Date(d);
              const dayKo = DAY_NAMES_KO[dt.getDay()];
              const summary = weeklySummary[idx];
              const isSelected = idx === selectedIdx;
              const noData = summary?.source === 'empty';
              return (
                <button
                  key={d}
                  onClick={() => setSelectedIdx(idx)}
                  className={`flex-1 px-2 py-2 rounded-t text-xs transition-colors ${
                    isSelected
                      ? 'bg-white border-x border-t border-gray-200 text-gray-900 font-bold'
                      : 'bg-transparent text-gray-500 hover:bg-white/60'
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-[11px] ${noData ? 'text-gray-300' : ''}`}>{d.slice(5)}</span>
                    <span className={`text-sm ${noData ? 'text-gray-300' : ''}`}>{dayKo}</span>
                    <span
                      className={`text-[10px] font-bold ${
                        noData
                          ? 'text-gray-300'
                          : summary && summary.rate >= 90
                          ? 'text-emerald-600'
                          : summary && summary.rate >= 80
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {noData ? '-' : `${summary?.rate ?? 0}%`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 선택된 날짜 요약 */}
        <div className="px-5 py-3 border-b bg-white">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-gray-500 text-xs">{selectedDate}</span>
            <span className="text-2xl font-bold text-gray-800">{rateForDay}%</span>
            <span className="text-xs text-gray-500">출석률</span>
            <span className="ml-3 text-xs text-emerald-600">출석 <b>{displayCounts.present}</b></span>
            <span className="text-xs text-amber-600">지각 <b>{displayCounts.late}</b></span>
            <span className="text-xs text-red-600">결석 <b>{displayCounts.absent}</b></span>
            <span className="text-xs text-gray-400 ml-auto">
              {dataSource === 'daily'
                ? '데이터 소스: daily_attendance'
                : dataSource === 'records'
                ? '데이터 소스: attendance_records (셀 집계)'
                : '데이터 없음'}
            </span>
          </div>
        </div>

        {/* 학생 명단 */}
        <div className="flex-1 overflow-auto">
          {dataSource === 'empty' ? (
            <div className="text-center py-12 text-gray-400 text-sm">이 날짜에는 출석 기록이 없습니다.</div>
          ) : dataSource === 'records' && entries.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              출석부 셀 집계 결과만 제공됩니다 (총 {totalForDay}건).<br />
              <span className="text-xs text-gray-400">학생별 상세는 출석부 탭에서 확인할 수 있습니다.</span>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <tr className="text-gray-500">
                  <th className="px-3 py-2 text-left font-medium w-16">상태</th>
                  <th className="px-3 py-2 text-left font-medium">학생</th>
                  <th className="px-3 py-2 text-left font-medium">반</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={`${e.studentId}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${statusBadge[e.status]}`}>
                        {statusToKo[e.status]}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-medium text-gray-900">{e.studentName}</td>
                    <td className="px-3 py-1.5 text-gray-600">{e.className || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-2 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyAttendanceDetailsModal;