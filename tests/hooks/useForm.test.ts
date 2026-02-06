import { renderHook, act, waitFor } from '@testing-library/react';
import { useForm } from '../../hooks/useForm';
import { validate, hasErrors, ValidationErrors, ValidationRules } from '../../utils/formValidation';

// Mock formValidation module
vi.mock('../../utils/formValidation', () => ({
  validate: vi.fn(),
  hasErrors: vi.fn(),
  ValidationErrors: {},
  ValidationRules: {},
}));

const mockedValidate = vi.mocked(validate);
const mockedHasErrors = vi.mocked(hasErrors);

interface TestFormValues {
  username: string;
  email: string;
  age: number;
}

describe('useForm Hook', () => {
  const initialValues: TestFormValues = {
    username: '',
    email: '',
    age: 0,
  };

  const mockValidationRules: ValidationRules<TestFormValues> = {
    username: [
      (value) => (!value ? '사용자 이름은 필수입니다' : null),
      (value) => (value.length < 3 ? '최소 3자 이상이어야 합니다' : null),
    ],
    email: [
      (value) => (!value ? '이메일은 필수입니다' : null),
      (value) => (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '올바른 이메일 형식이 아닙니다' : null),
    ],
    age: [
      (value) => (value < 0 ? '나이는 0 이상이어야 합니다' : null),
      (value) => (value > 150 ? '유효하지 않은 나이입니다' : null),
    ],
  };

  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockedValidate.mockReturnValue({});
    mockedHasErrors.mockImplementation((errors: ValidationErrors) => Object.keys(errors).length > 0);
  });

  describe('초기화', () => {
    it('초기값으로 올바르게 초기화된다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      expect(result.current.values).toEqual(initialValues);
      expect(result.current.errors).toEqual({});
      expect(result.current.touched).toEqual({});
      expect(result.current.isSubmitting).toBe(false);
    });

    it('validationRules 없이도 동작한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      expect(result.current.values).toEqual(initialValues);
    });
  });

  describe('handleChange', () => {
    it('값을 업데이트한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.handleChange('username', 'john_doe');
      });

      expect(result.current.values.username).toBe('john_doe');
    });

    it('여러 필드를 독립적으로 업데이트한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.handleChange('username', 'john');
      });

      act(() => {
        result.current.handleChange('email', 'john@example.com');
      });

      act(() => {
        result.current.handleChange('age', 25);
      });

      expect(result.current.values).toEqual({
        username: 'john',
        email: 'john@example.com',
        age: 25,
      });
    });

    it('validateOnChange가 true이고 필드가 touched인 경우 검증을 실행한다', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
          validateOnChange: true,
        })
      );

      // 먼저 필드를 touched 상태로 만듦
      act(() => {
        result.current.handleBlur('username');
      });

      // 값 변경
      act(() => {
        result.current.handleChange('username', 'jo');
      });

      // setTimeout으로 인해 약간의 대기 필요
      await waitFor(() => {
        expect(result.current.errors.username).toBe('사용자 이름은 필수입니다');
      });
    });

    it('validateOnChange가 false인 경우 검증하지 않는다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
          validateOnChange: false,
        })
      );

      act(() => {
        result.current.handleChange('username', 'jo');
      });

      expect(result.current.errors).toEqual({});
    });
  });

  describe('handleBlur', () => {
    it('필드를 touched 상태로 표시한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.handleBlur('username');
      });

      expect(result.current.touched.username).toBe(true);
    });

    it('validateOnBlur가 true인 경우 필드를 검증한다 (기본값)', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.handleBlur('username');
      });

      expect(result.current.touched.username).toBe(true);
      expect(result.current.errors.username).toBe('사용자 이름은 필수입니다');
    });

    it('validateOnBlur가 false인 경우 검증하지 않는다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
          validateOnBlur: false,
        })
      );

      act(() => {
        result.current.handleBlur('username');
      });

      expect(result.current.touched.username).toBe(true);
      expect(result.current.errors).toEqual({});
    });
  });

  describe('handleSubmit', () => {
    it('유효한 폼인 경우 onSubmit을 호출한다', async () => {
      mockedValidate.mockReturnValue({});
      mockedHasErrors.mockReturnValue(false);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockedValidate).toHaveBeenCalledWith(initialValues, mockValidationRules);
      expect(mockOnSubmit).toHaveBeenCalledWith(initialValues);
    });

    it('유효하지 않은 폼인 경우 onSubmit을 호출하지 않는다', async () => {
      const validationErrors = {
        username: '사용자 이름은 필수입니다',
        email: '이메일은 필수입니다',
      };
      mockedValidate.mockReturnValue(validationErrors);
      mockedHasErrors.mockReturnValue(true);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockedValidate).toHaveBeenCalled();
      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.errors).toEqual(validationErrors);
    });

    it('제출 시 모든 필드를 touched로 표시한다', async () => {
      mockedValidate.mockReturnValue({});
      mockedHasErrors.mockReturnValue(false);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      expect(result.current.touched.username).toBe(true);
      expect(result.current.touched.email).toBe(true);
      expect(result.current.touched.age).toBe(true);
    });

    it('제출 중 에러가 발생해도 처리한다', async () => {
      mockedValidate.mockReturnValue({});
      mockedHasErrors.mockReturnValue(false);

      const errorMessage = 'Submit error';
      mockOnSubmit.mockRejectedValue(new Error(errorMessage));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Form submission error:', expect.any(Error));
      expect(result.current.isSubmitting).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('비동기 onSubmit을 처리한다', async () => {
      mockedValidate.mockReturnValue({});
      mockedHasErrors.mockReturnValue(false);

      const asyncOnSubmit = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: asyncOnSubmit,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      expect(asyncOnSubmit).toHaveBeenCalled();
    });
  });

  describe('setFieldValue', () => {
    it('특정 필드의 값을 직접 설정한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.setFieldValue('email', 'test@example.com');
      });

      expect(result.current.values.email).toBe('test@example.com');
      expect(result.current.values.username).toBe('');
    });

    it('여러 필드를 순차적으로 설정할 수 있다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.setFieldValue('username', 'john_doe');
        result.current.setFieldValue('email', 'john@example.com');
        result.current.setFieldValue('age', 30);
      });

      expect(result.current.values).toEqual({
        username: 'john_doe',
        email: 'john@example.com',
        age: 30,
      });
    });
  });

  describe('setFieldError', () => {
    it('특정 필드에 에러를 설정한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.setFieldError('username', '이미 사용 중인 사용자명입니다');
      });

      expect(result.current.errors.username).toBe('이미 사용 중인 사용자명입니다');
    });

    it('여러 필드에 에러를 설정할 수 있다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.setFieldError('username', '사용자명 에러');
        result.current.setFieldError('email', '이메일 에러');
      });

      expect(result.current.errors).toEqual({
        username: '사용자명 에러',
        email: '이메일 에러',
      });
    });
  });

  describe('setErrors', () => {
    it('여러 에러를 한번에 설정한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      const errors = {
        username: '사용자명 에러',
        email: '이메일 에러',
        age: '나이 에러',
      };

      act(() => {
        result.current.setErrors(errors);
      });

      expect(result.current.errors).toEqual(errors);
    });
  });

  describe('resetForm', () => {
    it('모든 상태를 초기값으로 리셋한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      // 값 변경
      act(() => {
        result.current.handleChange('username', 'john_doe');
        result.current.handleChange('email', 'john@example.com');
        result.current.handleBlur('username');
        result.current.setFieldError('email', '에러 메시지');
      });

      // 리셋 전 상태 확인
      expect(result.current.values.username).toBe('john_doe');
      expect(result.current.touched.username).toBe(true);
      expect(result.current.errors.email).toBe('에러 메시지');

      // 리셋
      act(() => {
        result.current.resetForm();
      });

      // 리셋 후 상태 확인
      expect(result.current.values).toEqual(initialValues);
      expect(result.current.errors).toEqual({});
      expect(result.current.touched).toEqual({});
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('isSubmitting', () => {
    it('제출 중 상태를 추적한다', async () => {
      mockedValidate.mockReturnValue({});
      mockedHasErrors.mockReturnValue(false);

      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });

      const delayedOnSubmit = vi.fn().mockReturnValue(submitPromise);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: delayedOnSubmit,
        })
      );

      expect(result.current.isSubmitting).toBe(false);

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      // 제출 시작
      act(() => {
        result.current.handleSubmit(mockEvent);
      });

      // 제출 중 확인
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      // 제출 완료
      await act(async () => {
        resolveSubmit!();
        await submitPromise;
      });

      // 제출 완료 후 확인
      expect(result.current.isSubmitting).toBe(false);
    });

    it('제출 실패 시에도 isSubmitting을 false로 변경한다', async () => {
      mockedValidate.mockReturnValue({});
      mockedHasErrors.mockReturnValue(false);

      const failingOnSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: failingOnSubmit,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      expect(result.current.isSubmitting).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('validateField', () => {
    it('특정 필드를 수동으로 검증한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.validateField('username');
      });

      expect(result.current.errors.username).toBe('사용자 이름은 필수입니다');
    });

    it('유효한 필드 검증 시 에러를 제거한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { ...initialValues, username: 'john_doe' },
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      // 먼저 에러 설정
      act(() => {
        result.current.setFieldError('username', '에러 메시지');
      });

      expect(result.current.errors.username).toBe('에러 메시지');

      // 검증 실행
      act(() => {
        result.current.validateField('username');
      });

      // 에러 제거 확인
      expect(result.current.errors.username).toBeUndefined();
    });

    it('validationRules가 없는 필드는 검증하지 않는다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { ...initialValues, extraField: 'test' } as any,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.validateField('extraField' as keyof TestFormValues);
      });

      expect(result.current.errors.extraField).toBeUndefined();
    });

    it('첫 번째 에러에서 검증을 중단한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.validateField('username');
      });

      // 첫 번째 검증 규칙의 에러만 설정됨
      expect(result.current.errors.username).toBe('사용자 이름은 필수입니다');
    });
  });

  describe('validateForm', () => {
    it('전체 폼을 검증하고 유효성 여부를 반환한다', () => {
      const validationErrors = {
        username: '사용자 이름은 필수입니다',
        email: '이메일은 필수입니다',
      };
      mockedValidate.mockReturnValue(validationErrors);
      mockedHasErrors.mockReturnValue(true);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm();
      });

      expect(isValid!).toBe(false);
      expect(mockedValidate).toHaveBeenCalledWith(initialValues, mockValidationRules);
      expect(result.current.errors).toEqual(validationErrors);
    });

    it('유효한 폼인 경우 true를 반환한다', () => {
      mockedValidate.mockReturnValue({});
      mockedHasErrors.mockReturnValue(false);

      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            username: 'john_doe',
            email: 'john@example.com',
            age: 25,
          },
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateForm();
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors).toEqual({});
    });

    it('값이 변경될 때마다 최신 값으로 검증한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.handleChange('username', 'john_doe');
      });

      act(() => {
        result.current.validateForm();
      });

      expect(mockedValidate).toHaveBeenCalledWith(
        { ...initialValues, username: 'john_doe' },
        mockValidationRules
      );
    });
  });

  describe('통합 시나리오', () => {
    it('전체 폼 플로우가 올바르게 동작한다', async () => {
      mockedValidate.mockReturnValue({});
      mockedHasErrors.mockReturnValue(false);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
          validateOnBlur: true,
        })
      );

      // 1. 값 입력
      act(() => {
        result.current.handleChange('username', 'john_doe');
        result.current.handleChange('email', 'john@example.com');
        result.current.handleChange('age', 25);
      });

      // 2. 블러 처리
      act(() => {
        result.current.handleBlur('username');
        result.current.handleBlur('email');
      });

      // 3. 제출
      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      // 4. 검증
      expect(mockOnSubmit).toHaveBeenCalledWith({
        username: 'john_doe',
        email: 'john@example.com',
        age: 25,
      });
      expect(result.current.touched.username).toBe(true);
      expect(result.current.touched.email).toBe(true);
      expect(result.current.touched.age).toBe(true);
    });

    it('검증 실패 시 폼 제출이 차단된다', async () => {
      const validationErrors = {
        username: '사용자 이름은 필수입니다',
      };
      mockedValidate.mockReturnValue(validationErrors);
      mockedHasErrors.mockReturnValue(true);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.errors).toEqual(validationErrors);
    });

    it('폼 리셋 후 재사용 가능하다', async () => {
      mockedValidate.mockReturnValue({});
      mockedHasErrors.mockReturnValue(false);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      // 첫 번째 제출
      act(() => {
        result.current.handleChange('username', 'john');
        result.current.handleChange('email', 'john@example.com');
      });

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);

      // 리셋
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.values).toEqual(initialValues);

      // 두 번째 제출
      act(() => {
        result.current.handleChange('username', 'jane');
        result.current.handleChange('email', 'jane@example.com');
      });

      await act(async () => {
        result.current.handleSubmit(mockEvent);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(2);
      expect(mockOnSubmit).toHaveBeenLastCalledWith({
        username: 'jane',
        email: 'jane@example.com',
        age: 0,
      });
    });
  });

  describe('엣지 케이스', () => {
    it('빈 초기값으로 동작한다', () => {
      const emptyInitialValues = {} as TestFormValues;

      const { result } = renderHook(() =>
        useForm({
          initialValues: emptyInitialValues,
          onSubmit: mockOnSubmit,
        })
      );

      expect(result.current.values).toEqual({});
    });

    it('null/undefined 값을 처리한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.handleChange('username', null);
      });

      expect(result.current.values.username).toBe(null);

      act(() => {
        result.current.handleChange('email', undefined);
      });

      expect(result.current.values.email).toBe(undefined);
    });

    it('복잡한 객체 타입도 처리한다', () => {
      interface ComplexForm {
        user: {
          name: string;
          email: string;
        };
        tags: string[];
      }

      const complexInitialValues: ComplexForm = {
        user: { name: '', email: '' },
        tags: [],
      };

      const { result } = renderHook(() =>
        useForm({
          initialValues: complexInitialValues,
          onSubmit: vi.fn(),
        })
      );

      act(() => {
        result.current.handleChange('user', { name: 'John', email: 'john@example.com' });
      });

      expect(result.current.values.user).toEqual({ name: 'John', email: 'john@example.com' });

      act(() => {
        result.current.handleChange('tags', ['react', 'typescript']);
      });

      expect(result.current.values.tags).toEqual(['react', 'typescript']);
    });

    it('동일한 필드에 대한 연속적인 변경을 처리한다', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.handleChange('username', 'a');
        result.current.handleChange('username', 'ab');
        result.current.handleChange('username', 'abc');
      });

      expect(result.current.values.username).toBe('abc');
    });
  });
});
