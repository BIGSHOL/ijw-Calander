import {
  required,
  minLength,
  maxLength,
  email,
  phone,
  pattern,
  min,
  max,
  url,
  match,
  custom,
  validate,
  hasErrors,
  getFirstError,
} from '../../utils/formValidation';

describe('formValidation', () => {
  describe('required', () => {
    const rule = required();

    it('should return error for null', () => {
      expect(rule(null)).toBe('필수 입력 항목입니다');
    });

    it('should return error for undefined', () => {
      expect(rule(undefined)).toBe('필수 입력 항목입니다');
    });

    it('should return error for empty string', () => {
      expect(rule('')).toBe('필수 입력 항목입니다');
    });

    it('should return error for empty array', () => {
      expect(rule([])).toBe('필수 입력 항목입니다');
    });

    it('should return null for valid values', () => {
      expect(rule('hello')).toBeNull();
      expect(rule(0)).toBeNull();
      expect(rule(false)).toBeNull();
      expect(rule([1])).toBeNull();
    });

    it('should use custom message', () => {
      const customRule = required('이름을 입력하세요');
      expect(customRule('')).toBe('이름을 입력하세요');
    });
  });

  describe('minLength', () => {
    const rule = minLength(3);

    it('should return error for short strings', () => {
      expect(rule('ab')).toBe('최소 3자 이상 입력해주세요');
    });

    it('should return null for exact length', () => {
      expect(rule('abc')).toBeNull();
    });

    it('should return null for longer strings', () => {
      expect(rule('abcdef')).toBeNull();
    });

    it('should return null for empty/falsy values (not required)', () => {
      expect(rule('')).toBeNull();
    });

    it('should use custom message', () => {
      const customRule = minLength(5, '5글자 이상');
      expect(customRule('abc')).toBe('5글자 이상');
    });
  });

  describe('maxLength', () => {
    const rule = maxLength(5);

    it('should return error for long strings', () => {
      expect(rule('abcdef')).toBe('최대 5자까지 입력 가능합니다');
    });

    it('should return null for exact length', () => {
      expect(rule('abcde')).toBeNull();
    });

    it('should return null for shorter strings', () => {
      expect(rule('abc')).toBeNull();
    });

    it('should return null for empty/falsy values', () => {
      expect(rule('')).toBeNull();
    });

    it('should use custom message', () => {
      const customRule = maxLength(3, '3자 제한');
      expect(customRule('abcde')).toBe('3자 제한');
    });
  });

  describe('email', () => {
    const rule = email();

    it('should return null for valid emails', () => {
      expect(rule('test@example.com')).toBeNull();
      expect(rule('user.name@domain.co.kr')).toBeNull();
    });

    it('should return error for invalid emails', () => {
      expect(rule('invalid')).toBe('올바른 이메일 주소를 입력해주세요');
      expect(rule('no@domain')).toBe('올바른 이메일 주소를 입력해주세요');
      expect(rule('@domain.com')).toBe('올바른 이메일 주소를 입력해주세요');
    });

    it('should return null for empty value (not required)', () => {
      expect(rule('')).toBeNull();
    });

    it('should use custom message', () => {
      const customRule = email('이메일 형식 오류');
      expect(customRule('bad')).toBe('이메일 형식 오류');
    });
  });

  describe('phone', () => {
    const rule = phone();

    it('should return null for valid phone numbers', () => {
      expect(rule('01012345678')).toBeNull();
      expect(rule('010-1234-5678')).toBeNull();
      expect(rule('01112345678')).toBeNull();
    });

    it('should return error for invalid phone numbers', () => {
      expect(rule('12345')).toBe('올바른 전화번호를 입력해주세요');
      expect(rule('02-123-4567')).toBe('올바른 전화번호를 입력해주세요');
    });

    it('should return null for empty value (not required)', () => {
      expect(rule('')).toBeNull();
    });
  });

  describe('pattern', () => {
    const rule = pattern(/^[A-Z]+$/, '대문자만 입력 가능합니다');

    it('should return null for matching pattern', () => {
      expect(rule('ABC')).toBeNull();
    });

    it('should return error for non-matching pattern', () => {
      expect(rule('abc')).toBe('대문자만 입력 가능합니다');
    });

    it('should return null for empty value', () => {
      expect(rule('')).toBeNull();
    });
  });

  describe('min', () => {
    const rule = min(10);

    it('should return error for values below minimum', () => {
      expect(rule(5)).toBe('10 이상의 값을 입력해주세요');
    });

    it('should return null for exact minimum', () => {
      expect(rule(10)).toBeNull();
    });

    it('should return null for values above minimum', () => {
      expect(rule(15)).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(rule(null as any)).toBeNull();
      expect(rule(undefined as any)).toBeNull();
    });

    it('should use custom message', () => {
      const customRule = min(0, '양수 입력');
      expect(customRule(-1)).toBe('양수 입력');
    });
  });

  describe('max', () => {
    const rule = max(100);

    it('should return error for values above maximum', () => {
      expect(rule(150)).toBe('100 이하의 값을 입력해주세요');
    });

    it('should return null for exact maximum', () => {
      expect(rule(100)).toBeNull();
    });

    it('should return null for values below maximum', () => {
      expect(rule(50)).toBeNull();
    });

    it('should use custom message', () => {
      const customRule = max(10, '10점 이하');
      expect(customRule(11)).toBe('10점 이하');
    });
  });

  describe('url', () => {
    const rule = url();

    it('should return null for valid URLs', () => {
      expect(rule('https://example.com')).toBeNull();
      expect(rule('http://localhost:3000')).toBeNull();
    });

    it('should return error for invalid URLs', () => {
      expect(rule('not-a-url')).toBe('올바른 URL을 입력해주세요');
      expect(rule('://missing')).toBe('올바른 URL을 입력해주세요');
    });

    it('should return null for empty value', () => {
      expect(rule('')).toBeNull();
    });
  });

  describe('match', () => {
    it('should return null when values match', () => {
      const rule = match('password', () => 'secret123');
      expect(rule('secret123')).toBeNull();
    });

    it('should return error when values differ', () => {
      const rule = match('password', () => 'secret123');
      expect(rule('different')).toBe('값이 일치하지 않습니다');
    });

    it('should use custom message', () => {
      const rule = match('password', () => 'secret123', '비밀번호 불일치');
      expect(rule('wrong')).toBe('비밀번호 불일치');
    });
  });

  describe('custom', () => {
    it('should return null when custom function passes', () => {
      const rule = custom((v: number) => v % 2 === 0, '짝수만 가능');
      expect(rule(4)).toBeNull();
    });

    it('should return error when custom function fails', () => {
      const rule = custom((v: number) => v % 2 === 0, '짝수만 가능');
      expect(rule(3)).toBe('짝수만 가능');
    });
  });

  describe('validate', () => {
    it('should return empty errors for valid data', () => {
      const values = { name: '김철수', email: 'test@example.com' };
      const rules = {
        name: [required()],
        email: [required(), email()],
      };

      const errors = validate(values, rules);
      expect(errors).toEqual({});
    });

    it('should return errors for invalid data', () => {
      const values = { name: '', email: 'invalid' };
      const rules = {
        name: [required()],
        email: [required(), email()],
      };

      const errors = validate(values, rules);
      expect(errors.name).toBe('필수 입력 항목입니다');
      expect(errors.email).toBe('올바른 이메일 주소를 입력해주세요');
    });

    it('should stop at first error per field', () => {
      const values = { name: '' };
      const rules = {
        name: [required(), minLength(3)],
      };

      const errors = validate(values, rules);
      expect(errors.name).toBe('필수 입력 항목입니다');
    });
  });

  describe('hasErrors', () => {
    it('should return true when errors exist', () => {
      expect(hasErrors({ name: '에러' })).toBe(true);
    });

    it('should return false when no errors', () => {
      expect(hasErrors({})).toBe(false);
    });
  });

  describe('getFirstError', () => {
    it('should return first error message', () => {
      expect(getFirstError({ name: '이름 필수', email: '이메일 필수' })).toBe('이름 필수');
    });

    it('should return null when no errors', () => {
      expect(getFirstError({})).toBeNull();
    });
  });
});
