import { useState, useCallback, FormEvent } from 'react';
import { validate, ValidationRules, ValidationErrors, hasErrors } from '../utils/formValidation';

/**
 * useForm Hook
 * Simplifies form state management and validation
 * 
 * @example
 * const { values, errors, handleChange, handleSubmit } = useForm({
 *   initialValues: { email: '', password: '' },
 *   validationRules: {
 *     email: [required(), email()],
 *     password: [required(), minLength(8)]
 *   },
 *   onSubmit: async (values) => { ... }
 * });
 */

interface UseFormOptions<T extends object> {
  initialValues: T;
  validationRules?: ValidationRules<T>;
  onSubmit: (values: T) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

interface UseFormReturn<T extends object> {
  values: T;
  errors: ValidationErrors;
  touched: Record<keyof T, boolean>;
  isSubmitting: boolean;
  handleChange: (name: keyof T, value: any) => void;
  handleBlur: (name: keyof T) => void;
  handleSubmit: (e: FormEvent) => void;
  setFieldValue: (name: keyof T, value: any) => void;
  setFieldError: (name: keyof T, error: string) => void;
  setErrors: (errors: ValidationErrors) => void;
  resetForm: () => void;
  validateField: (name: keyof T) => void;
  validateForm: () => boolean;
}

export function useForm<T extends object>({
  initialValues,
  validationRules = {},
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback((name: keyof T) => {
    if (validationRules[name as string]) {
      const fieldRules = validationRules[name as string];
      const fieldValue = values[name];
      
      for (const rule of fieldRules) {
        const error = rule(fieldValue);
        if (error) {
          setErrors(prev => ({ ...prev, [name]: error }));
          return;
        }
      }
      
      // Clear error if validation passes
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as string];
        return newErrors;
      });
    }
  }, [values, validationRules]);

  const validateForm = useCallback((): boolean => {
    const validationErrors = validate(values, validationRules);
    setErrors(validationErrors);
    return !hasErrors(validationErrors);
  }, [values, validationRules]);

  const handleChange = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    if (validateOnChange && touched[name]) {
      // Validate after state update
      setTimeout(() => validateField(name), 0);
    }
  }, [validateOnChange, touched, validateField]);

  const handleBlur = useCallback((name: keyof T) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    
    if (validateOnBlur) {
      validateField(name);
    }
  }, [validateOnBlur, validateField]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allTouched = Object.keys(initialValues).reduce((acc, key) => {
      acc[key as keyof T] = true;
      return acc;
    }, {} as Record<keyof T, boolean>);
    setTouched(allTouched);
    
    // Validate form
    const isValid = validateForm();
    
    if (!isValid) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, initialValues, validateForm, onSubmit]);

  const setFieldValue = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const setFieldError = useCallback((name: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({} as Record<keyof T, boolean>);
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    setErrors,
    resetForm,
    validateField,
    validateForm,
  };
}