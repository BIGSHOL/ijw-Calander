/**
 * Edutrix reports 의 study_attitude / homework_today / notes / exam_info / assignment_score
 * 채움 현황 통계 (해당 월).
 *
 * 실행: node scripts/inspect-edutrix-attitude.mjs [YYYY-MM]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const ym = process.argv[2] || (() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
})();
const start = `${ym}-01`;
const [y, m] = ym.split('-').map(Number);
const lastDay = new Date(y, m, 0).getDate();
const end = `${ym}-${String(lastDay).padStart(2, '0')}`;

console.log(`\n========== Edutrix reports 채움 현황 (${ym}) ==========\n`);

let all = [], from = 0;
while (true) {
    const { data, error } = await supabase.from('reports')
        .select('id, date, student_id, study_attitude, homework_today, notes, exam_info, assignment_score, students!inner(name), classes(name)')
        .gte('date', start).lte('date', end)
        .range(from, from + 999);
    if (error) { console.error(error); process.exit(1); }
    const got = data || [];
    all = all.concat(got);
    if (got.length < 1000) break;
    from += 1000;
}
console.log(`전체 보고서: ${all.length}건\n`);

const isFilled = (v) => v !== null && v !== undefined && String(v).trim() !== '';

const stats = {
    study_attitude: 0,
    homework_today: 0,
    notes: 0,
    exam_info: 0,
    assignment_score: 0,
};
const uniqValues = {
    study_attitude: new Map(),
};

for (const r of all) {
    for (const k of Object.keys(stats)) {
        if (isFilled(r[k])) stats[k]++;
    }
    if (isFilled(r.study_attitude)) {
        const v = String(r.study_attitude).trim();
        uniqValues.study_attitude.set(v, (uniqValues.study_attitude.get(v) || 0) + 1);
    }
}

console.log('필드별 채움 비율:');
console.table(
    Object.fromEntries(Object.entries(stats).map(([k, v]) => [
        k, { 채움: v, 빈칸: all.length - v, '비율%': (v / all.length * 100).toFixed(1) },
    ]))
);

console.log('\nstudy_attitude 값 종류 (Top 10):');
const sorted = [...uniqValues.study_attitude.entries()].sort((a, b) => b[1] - a[1]);
console.table(sorted.slice(0, 10).map(([v, c]) => ({ value: v, count: c })));

console.log('\n샘플 (study_attitude 채워진 첫 5건):');
all.filter(r => isFilled(r.study_attitude)).slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.date} | ${r.students?.name} | 태도="${r.study_attitude}" | 과제=${r.homework_today || '-'} | 시험=${r.exam_info || '-'}`);
});

console.log('\n========== 완료 ==========');
process.exit(0);