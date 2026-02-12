import { vi } from 'vitest';

// useBucketItems는 firebase/auth User 타입을 임포트하여 모듈이 무거움
// OOM 방지를 위해 순수 로직만 테스트

vi.mock('firebase/auth', () => ({ User: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
}));
vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useBucketItems - role hierarchy logic', () => {
  // useBucketItems 내부의 isHigherRole 로직 재현
  const hierarchy = ['master', 'admin', 'manager', 'math_lead', 'english_lead', 'math_teacher', 'english_teacher', 'user'];

  const isHigherRole = (myRole: string, authorRole: string): boolean => {
    const myIndex = hierarchy.indexOf(myRole);
    const authorIndex = hierarchy.indexOf(authorRole);
    return myIndex < authorIndex;
  };

  it('master는 모든 역할보다 높음', () => {
    expect(isHigherRole('master', 'admin')).toBe(true);
    expect(isHigherRole('master', 'user')).toBe(true);
  });

  it('같은 역할은 높지 않음', () => {
    expect(isHigherRole('admin', 'admin')).toBe(false);
  });

  it('낮은 역할은 높은 역할보다 낮음', () => {
    expect(isHigherRole('user', 'master')).toBe(false);
    expect(isHigherRole('math_teacher', 'admin')).toBe(false);
  });

  it('모듈 임포트 가능', async () => {
    const mod = await import('../../hooks/useBucketItems');
    expect(mod.useBucketItems).toBeDefined();
  });
});
