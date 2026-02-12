import { vi } from 'vitest';
import { debounce, throttle, measureAsync } from '../../utils/performance';

describe('performance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('지정 시간 후에만 함수 실행', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('연속 호출 시 마지막 호출만 실행', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('a');
      debounced('b');
      debounced('c');

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('c');
    });

    it('대기 시간 내 재호출 시 타이머 리셋', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('첫 호출은 즉시 실행', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('제한 시간 내 재호출 무시', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('제한 시간 후 다시 실행 가능', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      vi.advanceTimersByTime(100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('measureAsync', () => {
    it('비동기 함수 결과를 반환', async () => {
      vi.useRealTimers();
      const result = await measureAsync('test', async () => 42);
      expect(result).toBe(42);
    });

    it('에러 발생 시 재throw', async () => {
      vi.useRealTimers();
      await expect(
        measureAsync('test', async () => {
          throw new Error('fail');
        })
      ).rejects.toThrow('fail');
    });
  });
});