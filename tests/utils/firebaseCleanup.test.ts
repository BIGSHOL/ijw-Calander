import { vi } from 'vitest';
import { listenerRegistry } from '../../utils/firebaseCleanup';

describe('firebaseCleanup', () => {
  describe('ListenerRegistry', () => {
    beforeEach(() => {
      listenerRegistry.cleanupAll();
    });

    it('리스너 등록 시 stats에 반영', () => {
      const unsub = vi.fn();
      listenerRegistry.register('TestComponent', unsub);

      const stats = listenerRegistry.getStats();
      expect(stats.totalListeners).toBe(1);
      expect(stats.byComponent['TestComponent']).toBe(1);
    });

    it('같은 컴포넌트 여러 리스너 등록', () => {
      listenerRegistry.register('Comp', vi.fn());
      listenerRegistry.register('Comp', vi.fn());
      listenerRegistry.register('Comp', vi.fn());

      const stats = listenerRegistry.getStats();
      expect(stats.totalListeners).toBe(3);
      expect(stats.byComponent['Comp']).toBe(3);
    });

    it('cleanup 함수 호출 시 리스너 해제', () => {
      const unsub = vi.fn();
      const cleanup = listenerRegistry.register('TestComponent', unsub);

      cleanup();
      expect(unsub).toHaveBeenCalledTimes(1);
      expect(listenerRegistry.getStats().totalListeners).toBe(0);
    });

    it('cleanup 후 컴포넌트 카운트 감소', () => {
      const cleanup1 = listenerRegistry.register('Comp', vi.fn());
      listenerRegistry.register('Comp', vi.fn());

      cleanup1();
      expect(listenerRegistry.getStats().byComponent['Comp']).toBe(1);
    });

    it('cleanupAll은 모든 리스너 해제', () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      listenerRegistry.register('A', unsub1);
      listenerRegistry.register('B', unsub2);

      listenerRegistry.cleanupAll();

      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
      expect(listenerRegistry.getStats().totalListeners).toBe(0);
    });

    it('이미 cleanup된 리스너 재호출 시 무시', () => {
      const unsub = vi.fn();
      const cleanup = listenerRegistry.register('Test', unsub);

      cleanup();
      cleanup(); // 두 번째 호출
      expect(unsub).toHaveBeenCalledTimes(1);
    });
  });
});