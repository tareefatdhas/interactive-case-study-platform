import React, { useId } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-[#313950]"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            'flex h-11 w-full rounded-xl border border-[#d7dae5] bg-white px-3.5 py-2 text-sm text-[#101a38] ring-offset-white transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#9298a5] focus:border-[#5146e5] focus:outline-none focus:ring-2 focus:ring-[#dcd8ff] disabled:cursor-not-allowed disabled:bg-[#f8f7fb] disabled:opacity-70',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-200',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-sm text-[#697087]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
