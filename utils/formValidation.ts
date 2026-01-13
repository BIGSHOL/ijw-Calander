/**
 * Form Validation Utilities
 * Addresses: Form validation standardization (Critical Issue)
 * 
 * Provides reusable validation rules and helpers for forms
 */

export type ValidationRule<T = any> = (value: T) => string | null;

export interface ValidationRules<T> {
  [key: string]: ValidationRule<T[keyof T]>[];
}

export interface ValidationErrors {
  [key: string]: string;
}

// Common validation rules
export const required = (message = '필수 입력 항목입니다'): ValidationRule => {
  return (value) => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return message;
    }
    return null;
  };
};

export const minLength = (length: number, message?: string): ValidationRule<string> => {
  return (value) => {
    if (value && value.length < length) {
      return message || `최소 ${length}자 이상 입력해주세요`;
    }
    return null;
  };
};

export const maxLength = (length: number, message?: string): ValidationRule<string> => {
  return (value) => {
    if (value && value.length > length) {
      return message || `최대 ${length}자까지 입력 가능합니다`;
    }
    return null;
  };
};

export const email = (message = '올바른 이메일 주소를 입력해주세요'): ValidationRule<string> => {
  return (value) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return message;
    }
    return null;
  };
};

export const phone = (message = '올바른 전화번호를 입력해주세요'): ValidationRule<string> => {
  return (value) => {
    if (value && !/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(value.replace(/-/g, ''))) {
      return message;
    }
    return null;
  };
};

export const pattern = (regex: RegExp, message: string): ValidationRule<string> => {
  return (value) => {
    if (value && !regex.test(value)) {
      return message;
    }
    return null;
  };
};

export const min = (minValue: number, message?: string): ValidationRule<number> => {
  return (value) => {
    if (value != null && value < minValue) {
      return message || `${minValue} 이상의 값을 입력해주세요`;
    }
    return null;
  };
};

export const max = (maxValue: number, message?: string): ValidationRule<number> => {
  return (value) => {
    if (value != null && value > maxValue) {
      return message || `${maxValue} 이하의 값을 입력해주세요`;
    }
    return null;
  };
};

export const url = (message = '올바른 URL을 입력해주세요'): ValidationRule<string> => {
  return (value) => {
    if (value) {
      try {
        new URL(value);
      } catch {
        return message;
      }
    }
    return null;
  };
};

export const match = (fieldName: string, getFieldValue: (name: string) => any, message?: string): ValidationRule => {
  return (value) => {
    const otherValue = getFieldValue(fieldName);
    if (value !== otherValue) {
      return message || '값이 일치하지 않습니다';
    }
    return null;
  };
};

export const custom = <T>(fn: (value: T) => boolean, message: string): ValidationRule<T> => {
  return (value) => {
    if (!fn(value)) {
      return message;
    }
    return null;
  };
};

// Validation helper
export const validate = <T extends object>(
  values: T,
  rules: ValidationRules<T>
): ValidationErrors => {
  const errors: ValidationErrors = {};

  Object.keys(rules).forEach((fieldName) => {
    const fieldRules = rules[fieldName];
    const fieldValue = values[fieldName as keyof T];

    for (const rule of fieldRules) {
      const error = rule(fieldValue);
      if (error) {
        errors[fieldName] = error;
        break; // Stop at first error for this field
      }
    }
  });

  return errors;
};

// Check if form has errors
export const hasErrors = (errors: ValidationErrors): boolean => {
  return Object.keys(errors).length > 0;
};

// Get first error message
export const getFirstError = (errors: ValidationErrors): string | null => {
  const keys = Object.keys(errors);
  return keys.length > 0 ? errors[keys[0]] : null;
};