/**
 * 오늘 attendance_records 셀 집계 (대시보드 KPI fallback 용).
 *
 * daily_attendance 가 비어있는 환경에서도 출석부(attendance_records)에
 * 기록된 출석/지각/결석을 KPI 에 표시하기 위한 read-only 쿼리.
 *
 * 셀 키 형식: "{className}::{YYYY-MM-DD}" 또는 "{YYYY-MM-DD}".
 * 값: 1=출석 / 2=지각 / 0=결석.
 */
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COLLECTION = 'attendance_records';

export interface TodayAttendanceSummary {
    presentCount: number;  // 출석 + 지각
    lateCount: number;
    absentCount: number;
    totalCount: number;    // 출석 + 지각 + 결석 (값이 있는 셀만)
    rate: number;          // 0~100
    rawCells: { studentId: string; className: string; status: number }[];
}

const empty: TodayAttendanceSummary = {
    presentCount: 0, lateCount: 0, absentCount: 0, totalCount: 0, rate: 0, rawCells: [],
};

export function useTodayAttendanceFromRecords(today: string, enabled: boolean = true) {
    const yearMonth = today.slice(0, 7); // "YYYY-MM"

    return useQuery<TodayAttendanceSummary>({
        queryKey: ['todayAttendanceFromRecords', today],
        enabled: enabled && !!today,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        queryFn: async () => {
            if (!today) return empty;

            // attendance_records 는 학생당 1문서/월 형식 ({studentId}_{yearMonth})
            // 해당 월 문서만 가져오기 위해 yearMonth 필터 (없는 경우 전체 → 클라이언트 필터 폴백)
            let snapshot;
            try {
                const q = query(collection(db, COLLECTION), where('yearMonth', '==', yearMonth));
                snapshot = await getDocs(q);
            } catch {
                // yearMonth 필드 인덱스 없거나 쓰지 않는 경우 전체 가져와 필터
                snapshot = await getDocs(collection(db, COLLECTION));
            }

            let present = 0, late = 0, absent = 0;
            const cells: { studentId: string; className: string; status: number }[] = [];

            snapshot.docs.forEach((d) => {
                const data = d.data();
                if (data.yearMonth && data.yearMonth !== yearMonth) return;
                const att = data.attendance || {};
                const studentId = data.studentId || d.id.split('_').slice(0, -1).join('_') || d.id;
                Object.entries(att).forEach(([key, value]) => {
                    // 키가 today 로 끝나는지 (composite "className::YYYY-MM-DD" 또는 단순 "YYYY-MM-DD")
                    const keyStr = String(key);
                    const matches = keyStr === today || keyStr.endsWith(`::${today}`);
                    if (!matches) return;

                    const status = typeof value === 'number' ? value : Number(value);
                    if (status === 0) absent++;
                    else if (status === 2) late++;
                    else if (status === 1) present++;
                    else return;

                    const className = keyStr.includes('::') ? keyStr.split('::')[0] : (data.className || '');
                    cells.push({ studentId, className, status });
                });
            });

            const total = present + late + absent;
            const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

            return { presentCount: present + late, lateCount: late, absentCount: absent, totalCount: total, rate, rawCells: cells };
        },
    });
}

export default useTodayAttendanceFromRecords;
