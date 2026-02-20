import { renderHook, act } from '@testing-library/react';
import { useVersionCheck } from '../../hooks/useVersionCheck';

// Mock __APP_VERSION__ global
vi.stubGlobal('__APP_VERSION__', '1.0.0');

describe('useVersionCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return expected properties', () => {
    const { result } = renderHook(() => useVersionCheck());

    expect(result.current).toHaveProperty('hasUpdate');
    expect(result.current).toHaveProperty('reload');
    expect(typeof result.current.reload).toBe('function');
  });

  it('should start with hasUpdate as false', () => {
    const { result } = renderHook(() => useVersionCheck());

    expect(result.current.hasUpdate).toBe(false);
  });

  it('should detect update when version differs', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0' }),
    } as Response);

    const { result } = renderHook(() => useVersionCheck());

    // Advance past the initial 10s delay
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.hasUpdate).toBe(true);
  });

  it('should not detect update when version matches', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    } as Response);

    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.hasUpdate).toBe(false);
  });

  it('should handle fetch errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    // Should not throw; hasUpdate remains false
    expect(result.current.hasUpdate).toBe(false);
  });

  it('should skip version check in dev mode', async () => {
    vi.stubGlobal('__APP_VERSION__', 'dev');

    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.hasUpdate).toBe(false);

    // Restore
    vi.stubGlobal('__APP_VERSION__', '1.0.0');
  });
});
