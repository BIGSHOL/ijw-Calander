import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await supabase.from('reports').select('*').limit(1);
if (error) { console.error(error); process.exit(1); }
if (data.length === 0) { console.log('No rows.'); process.exit(0); }
console.log('reports 테이블 모든 컬럼:');
Object.keys(data[0]).sort().forEach(k => console.log('  -', k));
console.log('\n첫 row 샘플 (값):');
console.log(JSON.stringify(data[0], null, 2));
process.exit(0);
