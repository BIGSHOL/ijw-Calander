import { TuitionCourse, TuitionSubjectType } from '../types/tuition';

export const TUITION_COURSES: TuitionCourse[] = [
  // --- 수학 (회당 단가) ---
  { id: 'm1', category: TuitionSubjectType.MATH, name: '초등M 개별심화', days: '', defaultPrice: 21250 },
  { id: 'm2', category: TuitionSubjectType.MATH, name: '초등M 정규반 (3T2H)', days: '', defaultPrice: 21250 },
  { id: 'm3', category: TuitionSubjectType.MATH, name: '초등M 정규반 (2T2H)', days: '', defaultPrice: 22500 },
  { id: 'm4', category: TuitionSubjectType.MATH, name: '초등M 개별진도반 (3T2H)', days: '', defaultPrice: 21250 },
  { id: 'm5', category: TuitionSubjectType.MATH, name: '중등M 정규반 (3T2H)', days: '', defaultPrice: 24000 },
  { id: 'm6', category: TuitionSubjectType.MATH, name: '중등M 특별반 (3T2H)', days: '', defaultPrice: 25000 },
  { id: 'm7', category: TuitionSubjectType.MATH, name: '중등M 특별반 (2T3H)', days: '', defaultPrice: 37500 },
  { id: 'm8', category: TuitionSubjectType.MATH, name: '중등 내신대비반 (3T2H)', days: '', defaultPrice: 24000 },
  { id: 'm9', category: TuitionSubjectType.MATH, name: '중등 현행심화반 (3T2H)', days: '', defaultPrice: 24000 },
  { id: 'm10', category: TuitionSubjectType.MATH, name: '고등M 정규반 (3T2H)', days: '', defaultPrice: 27250 },
  { id: 'm11', category: TuitionSubjectType.MATH, name: '고등M 정규반 (2T3H)', days: '', defaultPrice: 40875 },
  { id: 'm12', category: TuitionSubjectType.MATH, name: '고등M 선택과목반 (3T2H)', days: '', defaultPrice: 31250 },
  { id: 'm13', category: TuitionSubjectType.MATH, name: '중등M_PrideS반 (2T3H)', days: '', defaultPrice: 36000 },
  { id: 'm14', category: TuitionSubjectType.MATH, name: '고등M_PrideS반 (2T3H)', days: '', defaultPrice: 40875 },
  { id: 'm15', category: TuitionSubjectType.MATH, name: '초등M_메디컬반 (2T2H)', days: '', defaultPrice: 22500 },
  { id: 'm16', category: TuitionSubjectType.MATH, name: '중등M_메디컬반 (2T3H)', days: '', defaultPrice: 37500 },
  { id: 'm17', category: TuitionSubjectType.MATH, name: '고등M_메디컬반 (2T3H)', days: '', defaultPrice: 43750 },
  { id: 'm18', category: TuitionSubjectType.MATH, name: '수능반 (2T3H)', days: '', defaultPrice: 37500 },

  // --- EIE (월 단가) ---
  { id: 'e1', category: TuitionSubjectType.ENGLISH, name: 'Dr.Phonics', days: '', defaultPrice: 270000 },
  { id: 'e2', category: TuitionSubjectType.ENGLISH, name: 'Pre Let\'s', days: '', defaultPrice: 270000 },
  { id: 'e3', category: TuitionSubjectType.ENGLISH, name: 'Ready To Talk', days: '', defaultPrice: 270000 },
  { id: 'e4', category: TuitionSubjectType.ENGLISH, name: 'Let\'s Talk', days: '', defaultPrice: 270000 },
  { id: 'e5', category: TuitionSubjectType.ENGLISH, name: 'Ready To Speak', days: '', defaultPrice: 270000 },
  { id: 'e6', category: TuitionSubjectType.ENGLISH, name: 'Let\'s Speak', days: '', defaultPrice: 270000 },
  { id: 'e7', category: TuitionSubjectType.ENGLISH, name: 'Let\'s Express', days: '', defaultPrice: 270000 },
  { id: 'e8', category: TuitionSubjectType.ENGLISH, name: 'Kopi Wang', days: '', defaultPrice: 270000 },
  { id: 'e9', category: TuitionSubjectType.ENGLISH, name: 'Pre Junior', days: '', defaultPrice: 270000 },
  { id: 'e10', category: TuitionSubjectType.ENGLISH, name: 'Junior Plus', days: '', defaultPrice: 270000 },
  { id: 'e11', category: TuitionSubjectType.ENGLISH, name: 'Senior Plus', days: '', defaultPrice: 270000 },
  { id: 'e12', category: TuitionSubjectType.ENGLISH, name: 'Middle School English Course', days: '', defaultPrice: 270000 },

  // --- 영어 (회당 단가) ---
  { id: 'es1', category: TuitionSubjectType.ENGLISH_SUB, name: '중등E_초등브릿지 (3T2H)', days: '', defaultPrice: 24000 },
  { id: 'es2', category: TuitionSubjectType.ENGLISH_SUB, name: '중등E_초5메디컬 (3T2H)', days: '', defaultPrice: 24000 },
  { id: 'es3', category: TuitionSubjectType.ENGLISH_SUB, name: '중등E_초6브릿지SKY (3T2H)', days: '', defaultPrice: 24000 },
  { id: 'es4', category: TuitionSubjectType.ENGLISH_SUB, name: '중고E_초6메디컬 (2T3H)', days: '', defaultPrice: 37500 },
  { id: 'es5', category: TuitionSubjectType.ENGLISH_SUB, name: '중등E_정규 (3T2H)', days: '', defaultPrice: 24000 },
  { id: 'es6', category: TuitionSubjectType.ENGLISH_SUB, name: '중등E_정규 (2T3H)', days: '', defaultPrice: 36000 },
  { id: 'es7', category: TuitionSubjectType.ENGLISH_SUB, name: '중등E_정규 TOP (3T2H)', days: '', defaultPrice: 25000 },
  { id: 'es8', category: TuitionSubjectType.ENGLISH_SUB, name: '중등E_정규 TOP (2T3H)', days: '', defaultPrice: 37500 },
  { id: 'es9', category: TuitionSubjectType.ENGLISH_SUB, name: '중등E_TOP (3T2H)', days: '', defaultPrice: 24000 },
  { id: 'es10', category: TuitionSubjectType.ENGLISH_SUB, name: '고등E_중등메디컬 (3T2H)', days: '', defaultPrice: 27250 },
  { id: 'es11', category: TuitionSubjectType.ENGLISH_SUB, name: '고등E_정규 (2T3H)', days: '', defaultPrice: 40875 },

  // --- 국어 (회당 단가) ---
  { id: 'k1', category: TuitionSubjectType.KOREAN, name: '중등국어 (비재원생)', days: '', defaultPrice: 31250 },
  { id: 'k2', category: TuitionSubjectType.KOREAN, name: '중등국어 (재원생)', days: '', defaultPrice: 25000 },
];
