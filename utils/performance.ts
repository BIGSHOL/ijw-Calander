/**
 * Performance Monitoring Utilities
 * Addresses Issue #16, #40: Performance optimization
 * 
 * Provides performance monitoring and debugging helpers
 */

/**
 * Measure component render time
 */
export function measureRender(componentName: string, fn: () => void) {
  if (process.env.NODE_ENV !== 'development') {
    fn();
    return;
  }

  const start = performance.now();
  fn();
  const end = performance.now();
  const duration = end - start;

  if (duration > 16) { // Longer than 1 frame (60fps)
    console.warn(`[Performance] ${componentName} render took ${duration.toFixed(2)}ms`);
  }
}

/**
 * Debounce function for expensive operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for scroll/resize handlers
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Measure async operation time
 */
export async function measureAsync<T>(
  operationName: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const end = performance.now();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${operationName} took ${(end - start).toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const end = performance.now();
    console.error(`[Performance] ${operationName} failed after ${(end - start).toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * Log bundle size info (development only)
 */
export function logBundleInfo() {
  if (process.env.NODE_ENV !== 'development') return;

  if ('performance' in window && 'getEntriesByType' in performance) {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    const scripts = resources.filter(r => r.initiatorType === 'script');
    const totalSize = scripts.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    
    console.log(`[Bundle] Total JS size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`[Bundle] Script count: ${scripts.length}`);
    
    // Log largest scripts
    const sorted = scripts
      .map(r => ({ name: r.name.split('/').pop(), size: r.transferSize || 0 }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    console.table(sorted);
  }
}