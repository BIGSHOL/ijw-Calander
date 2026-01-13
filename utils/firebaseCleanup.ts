/**
 * Firebase Listener Cleanup Utilities
 * Addresses Issue #41: Firebase listener cleanup
 * 
 * Helps ensure all Firebase listeners are properly cleaned up
 */

import { Unsubscribe } from 'firebase/firestore';

/**
 * Registry to track active listeners for debugging
 */
class ListenerRegistry {
  private listeners: Map<string, Unsubscribe> = new Map();
  private componentCounts: Map<string, number> = new Map();

  register(componentName: string, unsubscribe: Unsubscribe): () => void {
    const id = `${componentName}_${Date.now()}_${Math.random()}`;
    this.listeners.set(id, unsubscribe);
    
    // Track component counts
    const count = this.componentCounts.get(componentName) || 0;
    this.componentCounts.set(componentName, count + 1);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Firebase] Listener registered: ${componentName} (total: ${count + 1})`);
    }

    // Return cleanup function
    return () => {
      const unsub = this.listeners.get(id);
      if (unsub) {
        unsub();
        this.listeners.delete(id);
        
        const newCount = (this.componentCounts.get(componentName) || 1) - 1;
        this.componentCounts.set(componentName, newCount);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Firebase] Listener unregistered: ${componentName} (remaining: ${newCount})`);
        }
      }
    };
  }

  getStats() {
    return {
      totalListeners: this.listeners.size,
      byComponent: Object.fromEntries(this.componentCounts),
    };
  }

  cleanupAll() {
    this.listeners.forEach(unsub => unsub());
    this.listeners.clear();
    this.componentCounts.clear();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Firebase] All listeners cleaned up');
    }
  }
}

export const listenerRegistry = new ListenerRegistry();

// Development helper - expose to window
if (process.env.NODE_ENV === 'development') {
  (window as any).firebaseListeners = {
    stats: () => listenerRegistry.getStats(),
    cleanup: () => listenerRegistry.cleanupAll(),
  };
}