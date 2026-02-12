import { getCategoryById, getCategoryStyle, GanttCategory } from '../../hooks/useGanttCategories';

const categories: GanttCategory[] = [
  { id: 'planning', label: '기획', backgroundColor: '#dbeafe', textColor: '#1d4ed8', order: 0 },
  { id: 'development', label: '개발', backgroundColor: '#f3e8ff', textColor: '#7e22ce', order: 1 },
];

describe('useGanttCategories 헬퍼', () => {
  describe('getCategoryById', () => {
    it('ID로 카테고리 조회', () => {
      const result = getCategoryById(categories, 'planning');
      expect(result).toBeDefined();
      expect(result!.label).toBe('기획');
    });

    it('없는 ID는 undefined 반환', () => {
      expect(getCategoryById(categories, 'nonexistent')).toBeUndefined();
    });

    it('빈 배열에서 조회', () => {
      expect(getCategoryById([], 'planning')).toBeUndefined();
    });
  });

  describe('getCategoryStyle', () => {
    it('카테고리가 있으면 해당 스타일 반환', () => {
      const style = getCategoryStyle(categories[0]);
      expect(style.backgroundColor).toBe('#dbeafe');
      expect(style.color).toBe('#1d4ed8');
    });

    it('undefined이면 기본 스타일 반환', () => {
      const style = getCategoryStyle(undefined);
      expect(style.backgroundColor).toBe('#f3f4f6');
      expect(style.color).toBe('#374151');
    });
  });
});
