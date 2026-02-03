import React from 'react';

/**
 * Standardized Textarea Component
 * Addresses Issue #27, #28: Form accessibility
 */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
  fullWidth?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helpText,
      fullWidth = false,
      resize = 'vertical',
      required,
      disabled,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${textareaId}-error`;
    const helpId = `${textareaId}-help`;

    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    const baseClasses = `
      block rounded-sm border transition-all px-4 py-2 text-base
      focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50
      ${fullWidth ? 'w-full' : ''}
      ${error ? 'border-error focus:border-error focus:ring-error' : 'border-gray-300 focus:border-accent'}
      ${resizeClasses[resize]}
      ${className}
    `;

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {required && <span className="text-error ml-1" aria-label="필수">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          className={baseClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={`${error ? errorId : ''} ${helpText ? helpId : ''}`.trim() || undefined}
          aria-required={required}
          disabled={disabled}
          required={required}
          {...props}
        />

        {error && (
          <p
            id={errorId}
            className="mt-1 text-sm text-error"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}

        {helpText && !error && (
          <p
            id={helpId}
            className="mt-1 text-sm text-gray-500"
          >
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
