import { PREDEFINED_CELL_COLORS } from '../../components/Attendance/components/cellColors';

describe('PREDEFINED_CELL_COLORS', () => {
  it('10개 색상 팔레트 정의', () => {
    expect(PREDEFINED_CELL_COLORS).toHaveLength(10);
  });

  it('각 색상에 key, label, color, hex 필드 존재', () => {
    for (const c of PREDEFINED_CELL_COLORS) {
      expect(c.key).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.color).toMatch(/^bg-/);
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('기본 색상은 orange', () => {
    expect(PREDEFINED_CELL_COLORS[0].key).toBe('orange');
    expect(PREDEFINED_CELL_COLORS[0].label).toContain('기본');
  });

  it('고유한 key 값', () => {
    const keys = PREDEFINED_CELL_COLORS.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
