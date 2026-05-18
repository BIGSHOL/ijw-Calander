/**
 * 주간 attendance_records 셀 집계 (대시보드 주간 출석 추이 fallback 용).
 *
 * daily_attendance 가 비어있는 환경에서도 출석부(attendance_records)에
 * 기록된 출석/지각/결석을 일자별 집계로 제공.
 *
 * 셀 키 형식: "{className}::{YYYY-MM-DD}" 또는 "{YYYY-MM-DD}".
 * 값: 1=출석 / 2=지각 / 0=결석.
 */
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COLLECTION = 'attendance_records';

export interface DayAttendanceSummary {
    date: string;            // YYYY-MM-DD
    presentCount: number;    // 출석 + 지각
    lateCount: number;
    absentCount: number;
    totalCount: number;      // 출석 + 지각 + 결석
    rate: number;            // 0~100
}

export function useWeeklyAttendanceFromRecords(dates: string[], enabled: boolean = true) {
    // 주에 걸친 yearMonth 셋
    const yearMonths = Array.from(new Set(dates.map(d => d.slice(0, 7)))).sort();
    const queryKey = ['weeklyAttendanceFromRecords', dates.join(',')];

    return useQuery<Record<string, DayAttendanceSummary>>({
        queryKey,
        enabled: enabled && dates.length > 0,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        queryFn: async () => {
            const empty: Record<string, DayAttendanceSummary> = {};
            dates.forEach(d => {
                empty[d] = { date: d, presentCount: 0, lateCount: 0, absentCount: 0, totalCount: 0, rate: 0 };
            });
            if (dates.length === 0) return empty;

            // yearMonth 필터로 가져오기 (월이 1개면 단일 쿼리, 2개면 양쪽)
            const docs: any[] = [];
            try {
                if (yearMonths.length === 1) {
                    const snap = await getDocs(query(collection(db, COLLECTION), where('yearMonth', '==', yearMonths[0])));
                    docs.push(...snap.docs);
                } else {
                    const snaps = await Promise.all(
                        yearMonths.map(ym => getDocs(query(collection(db, COLLECTION), where('yearMonth', '==', ym))))
                    );
                    snaps.forEach(s => docs.push(...s.docs));
                }
            } catch {
                // yearMonth 인덱스 없거나 필드 미사용 시 전체 fetch 후 클라 필터
                const snap = await getDocs(collection(db, COLLECTION));
                docs.push(...snap.docs);
            }

            // 일자별 카운터
            const counters: Record<string, { present: number; late: number; absent: number }> = {};
            dates.forEach(d => { counters[d] = { present: 0, late: 0, absent: 0 }; });

            const dateSet = new Set(dates);

            // [진단] 키 형식 샘플 + 매칭/비매칭 통계
            const keyFormatSamples = new Set<string>();
            let totalCells = 0;
            let matchedCells = 0;
            const unmatchedDateSamples = new Set<string>();

            docs.forEach((d) => {
                const data = d.data();
                if (data.yearMonth && !yearMonths.includes(data.yearMonth)) return;
                const att = data.attendance || {};
                Object.entries(att).forEach(([key, value]) => {
                    const keyStr = String(key);
                    totalCells++;
                    // 셀 키에서 날짜 추출
                    const dateStr = keyStr.includes('::') ? keyStr.split('::')[1] : keyStr;

                    // 키 형식 샘플 수집 (앞 10개만)
                    if (keyFormatSamples.size < 10) keyFormatSamples.add(keyStr);

                    if (!dateSet.has(dateStr)) {
                        if (unmatchedDateSamples.size < 20) unmatchedDateSamples.add(dateStr);
                        return;
                    }
                    matchedCells++;

                    const status = typeof value === 'number' ? value : Number(value);
                    const bucket = counters[dateStr];
                    if (!bucket) return;
                    if (status === 0) bucket.absent++;
                    else if (status === 2) bucket.late++;
                    else if (status === 1) bucket.present++;
                });
            });

            // [진단 로그] 점검 완료 후 제거 예정
            // eslint-disable-next-line no-console
            console.log('[주간출석records진단]', {
                요청날짜: dates,
                yearMonths,
                attendance_records_문서수: docs.length,
                총_셀수: totalCells,
                매칭된_셀수: matchedCells,
                매칭_제외된_셀_날짜샘플: Array.from(unmatchedDateSamples).slice(0, 20),
                키_형식_샘플: Array.from(keyFormatSamples),
                일자별_카운터: counters,
            });

            const result: Record<string, DayAttendanceSummary> = {};
            dates.forEach(d => {
                const c = counters[d];
                const total = c.present + c.late + c.absent;
                const rate = total > 0 ? Math.round(((c.present + c.late) / total) * 100) : 0;
                result[d] = {
                    date: d,
                    presentCount: c.present + c.late,
                    lateCount: c.late,
                    absentCount: c.absent,
                    totalCount: total,
                    rate,
                };
            });
            return result;
        },
    });
}

export default useWeeklyAttendanceFromRecords;