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

  // Calendar
  CALENDAR_VIEW_MODE: 'ijw_calendar_view_mode',
  CALENDAR_VIEW_COLUMNS: 'ijw_calendar_view_columns',

  // Timetable
  TIMETABLE_VIEW_SETTINGS: 'ijw_timetable_view_settings',

  // Consultation
  CONSULTATION_VIEW_MODE: 'ijw_consultation_view_mode',
  CONSULTATION_PAGE_SIZE: 'ijw_consultation_page_size',
  CONSULTATION_DATE_PRESET: 'ijw_consultation_date_preset',
  CONSULTATION_TABLE_COLUMNS: 'ijw_consultation_table_columns',

  // Role Management
  ROLE_MANAGEMENT_EXPANDED: 'ijw_role_management_expanded',

  // Calendar Tags
  RECENT_HASHTAGS: 'ijw_recent_hashtags',

  // English Timetable Display (personal/local)
  ENGLISH_DISPLAY_OPTIONS: 'ijw_english_display_options',
  ENGLISH_HIDDEN_TEACHERS: 'ijw_english_hidden_teachers',
  ENGLISH_HIDDEN_LEGEND_TEACHERS: 'ijw_english_hidden_legend_teachers',

  // Math Timetable Display (personal/local)
  MATH_DISPLAY_OPTIONS: 'ijw_math_display_options',
  MATH_HIDDEN_TEACHERS: 'ijw_math_hidden_teachers',

  // Dynamic keys (functions)
  attendanceGroupOrder: (staffId: string, subject: string) =>
    `ijw_attendance_group_order_${subject}_${staffId}`,
  attendanceCollapsedGroups: (staffId: string, subject: string) =>
    `ijw_attendance_collapsed_groups_${subject}_${staffId}`,
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