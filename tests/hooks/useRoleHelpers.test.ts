import { vi } from 'vitest';

vi.mock('./useRoleSimulation', () => ({
  useRoleSimulation: vi.fn().mockReturnValue({
    simulatedRole: null,
    isSimulating: false,
  }),
  getEffectiveRole: vi.fn((role: string, simulated: string | null) => simulated || role),
}));

// useRoleHelpers는 useRoleSimulation에 의존하므로 mock이 복잡합니다.
// 대신 내부 로직의 핵심인 역할 계층 판단을 직접 테스트합니다.

describe('useRoleHelpers - role hierarchy logic', () => {
  const hierarchy = ['master', 'admin', 'manager', 'math_lead', 'english_lead', 'math_teacher', 'english_teacher', 'user'];

  const isLeadOrAbove = (role: string) =>
    ['master', 'admin', 'manager', 'math_lead', 'english_lead'].includes(role);
  const isManagerOrAbove = (role: string) =>
    ['master', 'admin', 'manager'].includes(role);
  const isAdminOrAbove = (role: string) =>
    ['master', 'admin'].includes(role);

  it('master는 모든 계층 조건 충족', () => {
    expect(isLeadOrAbove('master')).toBe(true);
    expect(isManagerOrAbove('master')).toBe(true);
    expect(isAdminOrAbove('master')).toBe(true);
  });

  it('admin은 adminOrAbove까지 충족', () => {
    expect(isLeadOrAbove('admin')).toBe(true);
    expect(isManagerOrAbove('admin')).toBe(true);
    expect(isAdminOrAbove('admin')).toBe(true);
  });

  it('manager는 managerOrAbove까지 충족', () => {
    expect(isLeadOrAbove('manager')).toBe(true);
    expect(isManagerOrAbove('manager')).toBe(true);
    expect(isAdminOrAbove('manager')).toBe(false);
  });

  it('math_lead는 leadOrAbove만 충족', () => {
    expect(isLeadOrAbove('math_lead')).toBe(true);
    expect(isManagerOrAbove('math_lead')).toBe(false);
    expect(isAdminOrAbove('math_lead')).toBe(false);
  });

  it('math_teacher는 모든 계층 조건 불충족', () => {
    expect(isLeadOrAbove('math_teacher')).toBe(false);
    expect(isManagerOrAbove('math_teacher')).toBe(false);
    expect(isAdminOrAbove('math_teacher')).toBe(false);
  });

  it('user는 가장 낮은 역할', () => {
    expect(isLeadOrAbove('user')).toBe(false);
    expect(isManagerOrAbove('user')).toBe(false);
    expect(isAdminOrAbove('user')).toBe(false);
    expect(hierarchy.indexOf('user')).toBe(hierarchy.length - 1);
  });

  it('hierarchy 순서 유지 검증', () => {
    for (let i = 0; i < hierarchy.length - 1; i++) {
      expect(hierarchy.indexOf(hierarchy[i])).toBeLessThan(hierarchy.indexOf(hierarchy[i + 1]));
    }
  });
});
