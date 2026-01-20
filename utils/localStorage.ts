/**
 * LocalStorage Keys and Utilities
 * Addresses Issue #57: Inconsistent localStorage usage
 * 
 * Provides type-safe localStorage access with consistent key naming
 */

// LocalStorage Keys - Centralized definition
export const STORAGE_KEYS = {
  // User Preferences
  DEPT_HIDDEN_IDS: 'ijw_dept_hidden_ids',
  DARK_MODE: 'ijw_dark_mode',
  DEFAULT_VIEW_MODE: 'ijw_default_view_mode',
  DEFAULT_MAIN_TAB: 'ijw_default_main_tab',

  // Guide/Tutorial Flags
  ENGLISH_TIMETABLE_GUIDE_SHOWN: 'ijw_english_timetable_guide_shown',

  // Data Storage
  TUITION_HISTORY: 'ijw_tuition_history',
  TUITION_ENTRIES: 'ijw_tuition_entries',

  // Dynamic keys (functions)
  attendanceGroupOrder: (teacherId: string, subject: string) =>
    `ijw_attendance_group_order_${subject}_${teacherId}`,
  attendanceCollapsedGroups: (teacherId: string, subject: string) =>
    `ijw_attendance_collapsed_groups_${subject}_${teacherId}`,
} as const;

// Type-safe localStorage utilities
export const storage = {
  // String values
  getString: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return null;
    }
  },

  setString: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  },

  // Boolean values
  getBoolean: (key: string, defaultValue = false): boolean => {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return defaultValue;
      return value === 'true';
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  },

  setBoolean: (key: string, value: boolean): void => {
    try {
      localStorage.setItem(key, String(value));
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  },

  // JSON values
  getJSON: <T>(key: string, defaultValue: T): T => {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return defaultValue;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Error parsing ${key} from localStorage:`, error);
      return defaultValue;
    }
  },

  setJSON: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  },

  // Remove
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
    }
  },

  // Clear all app-specific keys
  clearAll: (): void => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('ijw_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  },
};