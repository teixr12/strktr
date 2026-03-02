'use client'

import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'

/* -------------------------------------------------------------------------- */
/*  FormField — wrapper with label + error display                            */
/* -------------------------------------------------------------------------- */

interface FormFieldProps {
  /** Optional label text displayed above the input */
  label?: string
  /** react-hook-form FieldError object */
  error?: FieldError
  /** Show red asterisk after label */
  required?: boolean
  /** Input element(s) to render */
  children: React.ReactNode
  /** Additional className for the wrapper div */
  className?: string
}

export function FormField({
  label,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p
          className="mt-1 text-xs text-red-500 animate-slide-up"
          role="alert"
        >
          {error.message}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  FormInput — styled input with error-state border                          */
/* -------------------------------------------------------------------------- */

interface FormInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  /** Register return from react-hook-form */
  registration?: UseFormRegisterReturn
  /** Whether this field has an error (changes border color) */
  hasError?: boolean
  /** Additional className */
  className?: string
}

export function FormInput({
  registration,
  hasError,
  className,
  ...props
}: FormInputProps) {
  return (
    <input
      {...registration}
      {...props}
      className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-xl text-sm focus:outline-none focus:ring-2 dark:text-white transition-colors ${
        hasError
          ? 'border-red-300 focus:ring-red-400/50 dark:border-red-700'
          : 'border-gray-200 focus:ring-sand-400 dark:border-gray-700'
      } ${className || ''}`}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  FormTextarea — styled textarea with error-state border                    */
/* -------------------------------------------------------------------------- */

interface FormTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  /** Register return from react-hook-form */
  registration?: UseFormRegisterReturn
  /** Whether this field has an error */
  hasError?: boolean
  /** Additional className */
  className?: string
}

export function FormTextarea({
  registration,
  hasError,
  className,
  ...props
}: FormTextareaProps) {
  return (
    <textarea
      {...registration}
      {...props}
      className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-xl text-sm focus:outline-none focus:ring-2 dark:text-white transition-colors resize-none ${
        hasError
          ? 'border-red-300 focus:ring-red-400/50 dark:border-red-700'
          : 'border-gray-200 focus:ring-sand-400 dark:border-gray-700'
      } ${className || ''}`}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  FormSelect — styled select with error-state border                        */
/* -------------------------------------------------------------------------- */

interface FormSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  /** Register return from react-hook-form */
  registration?: UseFormRegisterReturn
  /** Whether this field has an error */
  hasError?: boolean
  /** Additional className */
  className?: string
}

export function FormSelect({
  registration,
  hasError,
  className,
  children,
  ...props
}: FormSelectProps) {
  return (
    <select
      {...registration}
      {...props}
      className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-xl text-sm focus:outline-none focus:ring-2 dark:text-white transition-colors ${
        hasError
          ? 'border-red-300 focus:ring-red-400/50 dark:border-red-700'
          : 'border-gray-200 focus:ring-sand-400 dark:border-gray-700'
      } ${className || ''}`}
    >
      {children}
    </select>
  )
}
