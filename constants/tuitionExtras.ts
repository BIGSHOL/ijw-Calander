import { TuitionExtraItem, TuitionDiscountItem } from '../types/tuition';
import { TEXTBOOK_CATALOG, TextbookCatalogItem } from '../data/textbookCatalog';

// 비교재 서비스 항목
export const TUITION_SERVICE_EXTRAS: TuitionExtraItem[] = [
  { id: 't1', category: 'test', name: '레벨 테스트 비용', defaultPrice: 20000 },
  { id: 's1', category: 'system', name: '시스템 사용료', defaultPrice: 30000 },
  { id: 'v1', category: 'bus', name: '셔틀버스비', defaultPrice: 20000 },
  { id: 'c1', category: 'care', name: '스터디케어', defaultPrice: 50000 },
];

// EiE 교재 (교재 카탈로그에 없는 항목)
export const TUITION_EIE_TEXTBOOKS: TuitionExtraItem[] = [
  { id: 'tb_eie_1', category: 'textbook', name: '[EiE] PHONICS', defaultPrice: 40000 },
  { id: 'tb_eie_2', category: 'textbook', name: '[EiE] ROOKIES (PL)', defaultPrice: 40000 },
  { id: 'tb_eie_3', category: 'textbook', name: "[EiE] ROOKIES (LET'S)", defaultPrice: 44000 },
  { id: 'tb_eie_4', category: 'textbook', name: '[EiE] LEADERS', defaultPrice: 44000 },
];

// 카탈로그에 없는 특수 교재
const TUITION_SPECIAL_TEXTBOOKS: TuitionExtraItem[] = [
  { id: 'tb_math_mid_1', category: 'textbook', name: '[중등수학] 인재원 내신대비교재', defaultPrice: 12000 },
];

// 교재 카탈로그 → TuitionExtraItem 변환 (교재 관리 연동)
export const catalogToExtraItem = (item: TextbookCatalogItem, index: number): TuitionExtraItem => {
  // 영어 교재는 이름에 이미 [EiE] 접두사 포함
  if (item.subject === '영어') {
    return {
      id: `tb_catalog_${index}`,
      category: 'textbook',
      name: item.name,
      defaultPrice: item.price,
    };
  }
  const prefix = item.category === 'elementary' ? '초등수학'
    : item.category === 'middle' ? '중등수학' : '고등수학';
  return {
    id: `tb_catalog_${index}`,
    category: 'textbook',
    name: `[${prefix}] ${item.name}`,
    defaultPrice: item.price,
  };
};

// 전체 교재+기타 항목 (Firestore 카탈로그 우선, 없으면 정적 폴백)
export const buildAllExtras = (catalog?: TextbookCatalogItem[]): TuitionExtraItem[] => {
  const source = catalog || TEXTBOOK_CATALOG;
  const catalogExtras = source.map(catalogToExtraItem);
  return [
    ...TUITION_SERVICE_EXTRAS,
    ...TUITION_SPECIAL_TEXTBOOKS,
    ...catalogExtras,
  ];
};

// 할인 항목
export const TUITION_DISCOUNTS: TuitionDiscountItem[] = [
  { id: 'd1', name: '형제 할인', amount: 10000 },
  { id: 'd2', name: '레벨 테스트 비용 차감', amount: 20000 },
  { id: 'd3', name: '동시수강 할인', amount: 10000 },
];

// 카테고리 라벨
export const TUITION_EXTRA_CATEGORY_LABELS: Record<string, string> = {
  textbook: '교재',
  test: '테스트',
  bus: '차량',
  system: '시스템',
  care: '케어',
  other: '기타',
};
