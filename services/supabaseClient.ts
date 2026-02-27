import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
}

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null as any;

/** Edutrix 보고서 타입 */
export interface EdutrixReport {
    id: string;
    date: string;
    student_id: string;
    class_id: string | null;
    writer_id: string | null;
    lateness: boolean | string | null;
    notes: string | null;
    created_at: string;
    /** 과제 점수 (0, 50, 90, 100 등) - 0이면 미제출 */
    assignment_score: string | null;
    /** 수업태도 */
    study_attitude: string | null;
    /** 시험 정보 */
    exam_info: string | null;
    // joined fields
    student_name?: string;
    class_name?: string;
    /** 클래스명에서 추출한 선생님 이름 (첫 번째 토큰) */
    teacher_name?: string;
}

/**
 * Edutrix 클래스명에서 선생님 이름을 추출합니다.
 * 형식: "선생님이름_요일_교시" 또는 "선생님이름 요일 교시"
 * 예: "김은정_월_3교시" → "김은정"
 *
 * 예외 매핑: 김정은 → 김은정
 */
const TEACHER_NAME_EXCEPTIONS: Record<string, string> = {
    '김정은': '김은정',
};

export function extractTeacherFromClassName(className: string | null): string | null {
    if (!className) return null;
    const tokens = className.split(/[\s_]+/);
    const rawName = tokens[0] || '';
    if (!rawName) return null;
    return TEACHER_NAME_EXCEPTIONS[rawName] || rawName;
}

/**
 * 특정 날짜의 보고서 목록을 조회합니다.
 */
export async function fetchReportsByDate(date: string): Promise<EdutrixReport[]> {
    const { data, error } = await supabase
        .from('reports')
        .select(`
            id,
            date,
            student_id,
            class_id,
            writer_id,
            lateness,
            notes,
            created_at,
            students!inner(name),
            classes(name)
        `)
        .eq('date', date);

    if (error) {
        console.error('[Supabase] 보고서 조회 실패:', error);
        throw error;
    }

    return (data || []).map((row: any) => {
        const className = row.classes?.name || null;
        return {
            id: row.id,
            date: row.date,
            student_id: row.student_id,
            class_id: row.class_id,
            writer_id: row.writer_id,
            lateness: row.lateness,
            notes: row.notes,
            created_at: row.created_at,
            student_name: row.students?.name || null,
            class_name: className,
            teacher_name: extractTeacherFromClassName(className),
        };
    });
}

/**
 * 특정 월의 모든 보고서를 조회합니다.
 * @param yearMonth - "YYYY-MM" 형식 (예: "2026-02")
 */
export async function fetchReportsByMonth(yearMonth: string): Promise<EdutrixReport[]> {
    const startDate = `${yearMonth}-01`;
    const [year, month] = yearMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    console.log(`[Supabase] 월별 보고서 조회 시작: ${yearMonth} (${startDate} ~ ${endDate})`);

    // Supabase 기본 1000건 제한을 우회하기 위해 페이지네이션 사용
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('reports')
            .select(`
                id,
                date,
                student_id,
                class_id,
                writer_id,
                lateness,
                notes,
                assignment_score,
                study_attitude,
                exam_info,
                created_at,
                students!inner(name),
                classes(name)
            `)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error('[Supabase] 월별 보고서 조회 실패:', error);
            throw error;
        }

        const fetched = data || [];
        allData = allData.concat(fetched);
        console.log(`[Supabase] 페이지 ${Math.floor(from / PAGE_SIZE) + 1}: ${fetched.length}건 (누적 ${allData.length}건)`);

        if (fetched.length < PAGE_SIZE) {
            hasMore = false;
        } else {
            from += PAGE_SIZE;
        }
    }

    console.log(`[Supabase] 총 조회 결과: ${allData.length}건`);

    if (allData.length === 0) {
        console.warn('[Supabase] 0건 반환 — RLS 정책이 anon 접근을 차단하고 있을 수 있습니다.');
    }

    const mapped = allData.map((row: any) => {
        const className = row.classes?.name || null;
        return {
            id: row.id,
            date: row.date,
            student_id: row.student_id,
            class_id: row.class_id,
            writer_id: row.writer_id,
            lateness: row.lateness,
            notes: row.notes,
            assignment_score: row.assignment_score || null,
            study_attitude: row.study_attitude || null,
            exam_info: row.exam_info || null,
            created_at: row.created_at,
            student_name: row.students?.name || null,
            class_name: className,
            teacher_name: extractTeacherFromClassName(className),
        };
    });

    if (mapped.length > 0) {
        const uniqueStudents = [...new Set(mapped.map(r => r.student_name).filter(Boolean))];
        const uniqueTeachers = [...new Set(mapped.map(r => r.teacher_name).filter(Boolean))];
        console.log(`[Supabase] 고유 학생 ${uniqueStudents.length}명: ${uniqueStudents.join(', ')}`);
        console.log(`[Supabase] 고유 선생님 ${uniqueTeachers.length}명: ${uniqueTeachers.join(', ')}`);
    }

    return mapped;
}

/**
 * 보고서의 lateness 필드를 출석 numeric 값으로 변환합니다.
 * IJW 출석 시스템: 0=결석, 1=출석, 2=지각
 */
export function mapReportToAttendanceValue(lateness: boolean | string | null): number | null {
    if (lateness === null || lateness === undefined) return null;

    if (typeof lateness === 'string') {
        switch (lateness) {
            case '출석': return 1;
            case '지각': return 2;
            case '결석': return 0;
            default: return 1;
        }
    }

    if (typeof lateness === 'boolean') {
        return lateness ? 2 : 1;
    }

    return null;
}
