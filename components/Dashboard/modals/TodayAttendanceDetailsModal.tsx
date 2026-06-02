/**
 * 오늘 출석률 KPI 근거 데이터 모달
 * - 임의 날짜 선택 (input date) 으로 과거 출석률 검증 가능
 * - 최근 30일 출석률 추이 리스트
 * - 데이터 소스: daily_attendance (1순위) → attendance_records 셀 집계 (2순위)
 * - 선택된 날짜의 학생 명단 (daily_attendance 사용 가능 시)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useDailyAttendanceByRange } from '../../../hooks/useDailyAttendance';
import { useWeeklyAttendanceFromRecords } from '../../../hooks/useWeeklyAttendanceFromRecords';
import { format, subDays } from 'date-fns';

interface TodayAttendanceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 기본 선택 날짜 (보통 '오늘') */
  defaultDate: string;
}

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];
const RANGE_DAYS = 30;

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

const TodayAttendanceDetailsModal: React.FC<TodayAttendanceDetailsModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
}) => {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  useEffect(() => {
    if (isOpen) setSelectedDate(defaultDate);
  }, [isOpen, defaultDate]);

  // 30일치 날짜 (오래된 → 최신)
  const range = useMemo(() => {
    const now = new Date(defaultDate);
    const dates: string[] = [];
    for (let i = RANGE_DAYS - 1; i >= 0; i--) {
      dates.push(format(subDays(now, i), 'yyyy-MM-dd'));
    }
    return dates;
  }, [defaultDate]);

  // 30일치 daily_attendance 일괄 fetch (모달 열렸을 때만)
  const { data: dailyRange = {}, isLoading: dailyLoading } = useDailyAttendanceByRange(
    range[0],
    range[range.length - 1],
    isOpen
  );

  // attendance_records fallback (30일치, 1~2 쿼리)
  const { data: recordsRange = {}, isLoading: recordsLoading } = useWeeklyAttendanceFromRecords(
    range,
    isOpen
  );

  // 일자별 요약 (rate, source, 카운트)
  const dailySummaries = useMemo(() => {
    return range.map(d => {
      const daily = dailyRange[d] || [];
      if (daily.length > 0) {
        const present = daily.filter(a => a.status === 'present' || a.status === 'late').length;
        const late = daily.filter(a => a.status === 'late').length;
        const absent = daily.filter(a => a.status === 'absent').length;
        return {
          date: d,
          rate: daily.length > 0 ? Math.round((present / daily.length) * 100) : 0,
          present: present - late,
          late,
          absent,
          total: daily.length,
          source: 'daily' as const,
        };
      }
      const rec = recordsRange[d];
      if (rec && rec.totalCount > 0) {
        return {
          date: d,
          rate: rec.rate,
          present: rec.presentCount - rec.lateCount,
          late: rec.lateCount,
          absent: rec.absentCount,
          total: rec.totalCount,
          source: 'records' as const,
        };
      }
      return { date: d, rate: 0, present: 0, late: 0, absent: 0, total: 0, source: 'empty' as const };
    });
  }, [range, dailyRange, recordsRange]);

  // 선택일 요약 + 학생 명단
  const selectedSummary = dailySummaries.find(s => s.date === selectedDate);
  const selectedDailyRecords = dailyRange[selectedDate] || [];

  const selectedEntries = useMemo(() => {
    if (!selectedSummary || selectedSummary.source !== 'daily') return [];
    return selectedDailyRecords
      .map(r => ({
        studentId: r.studentId || '',
        studentName: r.studentName || r.studentId || '(이름없음)',
        className: r.className || '',
        status: (r.status === 'late' ? 'late' : r.status === 'absent' ? 'absent' : 'present') as
          | 'present' | 'late' | 'absent',
      }))
      .sort((a, b) => {
        const order: Record<string, number> = { absent: 0, late: 1, present: 2 };
        const o = order[a.status] - order[b.status];
        if (o !== 0) return o;
        return a.studentName.localeCompare(b.studentName);
      });
  }, [selectedSummary, selectedDailyRecords]);

  // 추이 평균 (데이터 있는 날만)
  const trendAverage = useMemo(() => {
    const valid = dailySummaries.filter(s => s.source !== 'empty');
    if (valid.length === 0) return null;
    const avg = Math.round(valid.reduce((s, d) => s + d.rate, 0) / valid.length);
    return { avg, count: valid.length };
  }, [dailySummaries]);

  const isLoading = dailyLoading || recordsLoading;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[8vh] bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[920px] max-w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-emerald-50">
          <div className="flex items-center gap-2">
            <span className="text-emerald-700 text-lg">✅</span>
            <h2 className="font-bold text-sm text-emerald-900">출석률 — 근거 데이터 (날짜별 검증)</h2>
            <span className="text-xs text-emerald-600">{range[0]} ~ {range[range.length - 1]}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-emerald-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* 날짜 선택 + 선택일 요약 */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-black font-medium">날짜 선택</label>
            <input
              type="date"
              value={selectedDate}
              min={range[0]}
              max={range[range.length - 1]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs"
            />
            {selectedSummary && (
              <>
                <span className="text-black text-xs">|</span>
                <span className="text-black text-xs">
                  {selectedSummary.date} ({DAY_NAMES_KO[new Date(selectedSummary.date).getDay()]})
                </span>
                <span className="text-2xl font-bold text-emerald-700">{selectedSummary.rate}%</span>
                <span className="text-xs text-emerald-600">출석 <b>{selectedSummary.present}</b></span>
                <span className="text-xs text-amber-600">지각 <b>{selectedSummary.late}</b></span>
                <span className="text-xs text-red-600">결석 <b>{selectedSummary.absent}</b></span>
                <span className="text-xs text-black">총 <b>{selectedSummary.total}</b>건</span>
                <span className="text-xs text-black ml-auto">
                  {selectedSummary.source === 'daily'
                    ? 'daily_attendance'
                    : selectedSummary.source === 'records'
                    ? 'attendance_records'
                    : '데이터 없음'}
                </span>
              </>
            )}
          </div>
          {trendAverage && (
            <div className="text-xs text-black mt-1.5">
              최근 30일 평균: <b className="text-emerald-700">{trendAverage.avg}%</b> ({trendAverage.count}일 기준)
            </div>
          )}
        </div>

        {/* 본문: 좌(추이 리스트) | 우(학생 명단) */}
        <div className="flex-1 overflow-hidden flex">
          {/* 좌: 30일 추이 */}
          <div className="w-[360px] border-r overflow-auto">
            <div className="sticky top-0 bg-white border-b px-3 py-2 z-10 shadow-sm">
              <h3 className="font-bold text-xs text-black">최근 30일 추이</h3>
            </div>
            {isLoading ? (
              <div className="text-center py-12 text-xs text-black">로딩 중...</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {[...dailySummaries].reverse().map(s => {
                  const dt = new Date(s.date);
                  const dayKo = DAY_NAMES_KO[dt.getDay()];
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  const isSelected = s.date === selectedDate;
                  const isEmpty = s.source === 'empty';
                  // 짧은 날짜 (MM-DD) — 모달 헤더에 연도 이미 표기됨
                  const shortDate = s.date.slice(5);
                  return (
                    <button
                      key={s.date}
                      onClick={() => setSelectedDate(s.date)}
                      className={`w-full px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-emerald-50 transition-colors ${
                        isSelected ? 'bg-emerald-100 border-l-4 border-emerald-500' : 'border-l-4 border-transparent'
                      }`}
                    >
                      <span className="font-mono text-black w-[44px] text-left flex-shrink-0">{shortDate}</span>
                      <span className={`w-5 text-center flex-shrink-0 ${isWeekend ? 'text-red-400' : 'text-black'}`}>{dayKo}</span>
                      {/* 막대 */}
                      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden relative min-w-[80px]">
                        {!isEmpty && (
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                            style={{ width: `${s.rate}%` }}
                          />
                        )}
                        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${
                          isEmpty ? 'text-black' : s.rate >= 50 ? 'text-white' : 'text-black'
                        }`}>
                          {isEmpty ? '데이터 없음' : `${s.rate}%`}
                        </span>
                      </div>
                      <span className={`text-xs font-mono w-12 text-right flex-shrink-0 ${isEmpty ? 'text-black' : 'text-black'}`}>
                        {isEmpty ? '' : `${s.present + s.late}/${s.total}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 우: 선택일 학생 명단 또는 카운트 시각화 */}
          <div className="flex-1 overflow-auto">
            <div className="sticky top-0 bg-white border-b px-3 py-2 z-10 shadow-sm flex items-center justify-between">
              <h3 className="font-bold text-xs text-black">
                {selectedDate} 상세
              </h3>
              {selectedSummary && selectedSummary.source !== 'empty' && (
                <span className="text-xs text-black">{selectedSummary.total}건</span>
              )}
            </div>
            {selectedSummary?.source === 'empty' ? (
              <div className="text-center py-16 text-black text-xs">
                <div className="text-2xl mb-2">📭</div>
                이 날짜에는 출석 기록이 없습니다.
              </div>
            ) : selectedSummary?.source === 'records' ? (
              <div className="px-5 py-6">
                {/* 카운트 시각화 (records 폴백 — 학생 명단 불가) */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-center">
                    <div className="text-xs text-emerald-700 font-medium">출석</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">{selectedSummary.present}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
                    <div className="text-xs text-amber-700 font-medium">지각</div>
                    <div className="text-2xl font-bold text-amber-700 mt-1">{selectedSummary.late}</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
                    <div className="text-xs text-red-700 font-medium">결석</div>
                    <div className="text-2xl font-bold text-red-700 mt-1">{selectedSummary.absent}</div>
                  </div>
                </div>
                {/* 비율 막대 (가로 누적) */}
                <div className="mb-3">
                  <div className="text-xs text-black mb-1 flex justify-between">
                    <span>비율 분포</span>
                    <span>총 {selectedSummary.total}건</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded overflow-hidden flex">
                    {selectedSummary.present > 0 && (
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${(selectedSummary.present / selectedSummary.total) * 100}%` }}
                        title={`출석 ${selectedSummary.present}`}
                      />
                    )}
                    {selectedSummary.late > 0 && (
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${(selectedSummary.late / selectedSummary.total) * 100}%` }}
                        title={`지각 ${selectedSummary.late}`}
                      />
                    )}
                    {selectedSummary.absent > 0 && (
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${(selectedSummary.absent / selectedSummary.total) * 100}%` }}
                        title={`결석 ${selectedSummary.absent}`}
                      />
                    )}
                  </div>
                </div>
                <div className="text-xs text-black text-center mt-4">
                  출석부 셀 집계 결과 · 학생별 상세는 출석부 탭에서 확인
                </div>
              </div>
            ) : selectedEntries.length === 0 ? (
              <div className="text-center py-12 text-black text-xs">로딩 중이거나 데이터가 없습니다.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-9 bg-white border-b border-gray-200 z-[5]">
                  <tr className="text-black">
                    <th className="px-3 py-1.5 text-left font-medium w-14">상태</th>
                    <th className="px-3 py-1.5 text-left font-medium">학생</th>
                    <th className="px-3 py-1.5 text-left font-medium">반</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEntries.map((e, i) => (
                    <tr key={`${e.studentId}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold whitespace-nowrap ${statusBadge[e.status]}`}>
                          {statusToKo[e.status]}
                        </span>
                      </td>
                      <td className="px-3 py-1 font-medium text-black">{e.studentName}</td>
                      <td className="px-3 py-1 text-black">{e.className || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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

export default TodayAttendanceDetailsModal;
