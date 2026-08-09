import React from 'react';
import { cn } from '@/lib/utils';
import { LoaderCircle } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-[#5146e5] text-white hover:bg-[#4137c7] focus:ring-[#5146e5]',
      secondary: 'bg-[#101a38] text-white hover:bg-[#26314f] focus:ring-[#101a38]',
      outline: 'border border-[#e3e5ed] bg-white text-[#313950] hover:bg-[#f8f7fb] focus:ring-[#5146e5]',
      ghost: 'text-[#697087] hover:bg-[#f0efff] hover:text-[#4137c7] focus:ring-[#5146e5]',
      destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    };

    return (
      <button
        className={cn(
          'inline-flex min-h-10 items-center justify-center rounded-[10px] font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#fffefa] disabled:cursor-not-allowed disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading && (
          <LoaderCircle className="-ml-1 mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
