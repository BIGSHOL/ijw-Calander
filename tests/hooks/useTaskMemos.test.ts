import { vi } from 'vitest';

// useTaskMemos는 firebase/auth 등 무거운 모듈을 임포트하므로
// OOM을 방지하기 위해 mock을 최소화합니다.

vi.mock('firebase/auth', () => ({ User: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
}));
vi.mock('../../firebaseConfig', () => ({ db: {} }));
vi.mock('../../utils/firebaseCleanup', () => ({
  listenerRegistry: {
    register: vi.fn((_name: string, unsub: any) => unsub),
  },
}));

describe('useTaskMemos (module load)', () => {
  it('모듈 임포트 가능', async () => {
    const mod = await import('../../hooks/useTaskMemos');
    expect(mod.useTaskMemos).toBeDefined();
    expect(typeof mod.useTaskMemos).toBe('function');
  });
});
