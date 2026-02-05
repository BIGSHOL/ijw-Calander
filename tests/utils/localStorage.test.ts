import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STORAGE_KEYS, storage } from '../../utils/localStorage';

describe('localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('STORAGE_KEYS', () => {
    it('모든 키가 ijw_ 접두사로 시작해야 함', () => {
      const keys = Object.values(STORAGE_KEYS).filter(v => typeof v === 'string');
      keys.forEach(key => {
        expect(key).toMatch(/^ijw_/);
      });
    });

    it('동적 키 함수가 올바른 키를 생성해야 함', () => {
      expect(STORAGE_KEYS.resourceSubCategoryOrder('math')).toBe(
        'ijw_resource_sub_category_order_math'
      );
      expect(STORAGE_KEYS.attendanceGroupOrder('staff1', 'english')).toBe(
        'ijw_attendance_group_order_english_staff1'
      );
      expect(STORAGE_KEYS.attendanceCollapsedGroups('staff2', 'math')).toBe(
        'ijw_attendance_collapsed_groups_math_staff2'
      );
      expect(STORAGE_KEYS.attendanceHiddenDates('staff3', 'science')).toBe(
        'ijw_attendance_hidden_dates_science_staff3'
      );
    });
  });

  describe('storage.getString', () => {
    it('저장된 문자열을 읽어야 함', () => {
      localStorage.setItem('test_key', 'test_value');
      expect(storage.getString('test_key')).toBe('test_value');
    });

    it('존재하지 않는 키는 null을 반환해야 함', () => {
      expect(storage.getString('nonexistent')).toBeNull();
    });

    it('에러 발생 시 null을 반환하고 에러를 로깅해야 함', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      const result = storage.getString('error_key');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      localStorage.getItem = originalGetItem;
      consoleSpy.mockRestore();
    });
  });

  describe('storage.setString', () => {
    it('문자열을 저장해야 함', () => {
      storage.setString('test_key', 'test_value');
      expect(localStorage.getItem('test_key')).toBe('test_value');
    });

    it('에러 발생 시 에러를 로깅해야 함', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      storage.setString('error_key', 'value');

      expect(consoleSpy).toHaveBeenCalled();

      localStorage.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });
  });

  describe('storage.getBoolean', () => {
    it('true 값을 읽어야 함', () => {
      localStorage.setItem('bool_key', 'true');
      expect(storage.getBoolean('bool_key')).toBe(true);
    });

    it('false 값을 읽어야 함', () => {
      localStorage.setItem('bool_key', 'false');
      expect(storage.getBoolean('bool_key')).toBe(false);
    });

    it('존재하지 않는 키는 기본값을 반환해야 함', () => {
      expect(storage.getBoolean('nonexistent')).toBe(false);
      expect(storage.getBoolean('nonexistent', true)).toBe(true);
    });

    it('에러 발생 시 기본값을 반환해야 함', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      const result = storage.getBoolean('error_key', true);

      expect(result).toBe(true);

      localStorage.getItem = originalGetItem;
      consoleSpy.mockRestore();
    });
  });

  describe('storage.setBoolean', () => {
    it('boolean을 문자열로 저장해야 함', () => {
      storage.setBoolean('bool_key', true);
      expect(localStorage.getItem('bool_key')).toBe('true');

      storage.setBoolean('bool_key', false);
      expect(localStorage.getItem('bool_key')).toBe('false');
    });
  });

  describe('storage.getJSON', () => {
    it('JSON 객체를 파싱해야 함', () => {
      const obj = { name: '테스트', value: 123 };
      localStorage.setItem('json_key', JSON.stringify(obj));

      const result = storage.getJSON('json_key', {});
      expect(result).toEqual(obj);
    });

    it('배열을 파싱해야 함', () => {
      const arr = [1, 2, 3, 4, 5];
      localStorage.setItem('array_key', JSON.stringify(arr));

      const result = storage.getJSON('array_key', []);
      expect(result).toEqual(arr);
    });

    it('존재하지 않는 키는 기본값을 반환해야 함', () => {
      const defaultValue = { default: true };
      const result = storage.getJSON('nonexistent', defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('잘못된 JSON은 기본값을 반환해야 함', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('invalid_json', 'not a json');

      const result = storage.getJSON('invalid_json', { error: true });

      expect(result).toEqual({ error: true });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('storage.setJSON', () => {
    it('객체를 JSON으로 저장해야 함', () => {
      const obj = { name: '테스트', value: 123 };
      storage.setJSON('json_key', obj);

      const stored = localStorage.getItem('json_key');
      expect(JSON.parse(stored!)).toEqual(obj);
    });

    it('배열을 JSON으로 저장해야 함', () => {
      const arr = [1, 2, 3];
      storage.setJSON('array_key', arr);

      const stored = localStorage.getItem('array_key');
      expect(JSON.parse(stored!)).toEqual(arr);
    });
  });

  describe('storage.remove', () => {
    it('키를 삭제해야 함', () => {
      localStorage.setItem('remove_key', 'value');
      expect(localStorage.getItem('remove_key')).toBe('value');

      storage.remove('remove_key');
      expect(localStorage.getItem('remove_key')).toBeNull();
    });

    it('존재하지 않는 키를 삭제해도 에러가 발생하지 않아야 함', () => {
      expect(() => storage.remove('nonexistent')).not.toThrow();
    });
  });

  describe('storage.clearAll', () => {
    it('ijw_ 접두사 키만 삭제해야 함', () => {
      localStorage.setItem('ijw_key1', 'value1');
      localStorage.setItem('ijw_key2', 'value2');
      localStorage.setItem('other_key', 'other_value');

      storage.clearAll();

      expect(localStorage.getItem('ijw_key1')).toBeNull();
      expect(localStorage.getItem('ijw_key2')).toBeNull();
      expect(localStorage.getItem('other_key')).toBe('other_value');
    });

    it('빈 localStorage도 처리해야 함', () => {
      expect(() => storage.clearAll()).not.toThrow();
    });

    it('에러 발생 시 에러를 로깅해야 함', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // keys()를 사용하는 Object.keys(localStorage) mock
      const originalKeys = Object.keys;
      Object.keys = vi.fn(() => {
        throw new Error('Keys error');
      });

      storage.clearAll();

      expect(consoleSpy).toHaveBeenCalled();

      Object.keys = originalKeys;
      consoleSpy.mockRestore();
    });
  });
});
