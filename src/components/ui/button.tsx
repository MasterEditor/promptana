 'use client';

import * as React from 'react';
import { cn } from './utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg';
};

const sizeClasses = {
  default: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-xs',
  lg: 'px-6 py-3 text-base',
};

const variantClasses = {
  default: 'bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900',
  ghost: 'bg-transparent text-zinc-900 dark:text-zinc-50',
  outline: 'bg-transparent border border-zinc-300 text-zinc-900 dark:border-zinc-700 dark:text-zinc-50',
};

export const buttonVariants = (variant: ButtonProps['variant'] = 'default', size: ButtonProps['size'] = 'default') =>
  cn(
    variantClasses[variant ?? 'default'],
    'inline-flex items-center justify-center rounded-md font-medium transition-colors',
    sizeClasses[size ?? 'default']
  );

export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps & { className?: string }): React.JSX.Element {
  return <button className={cn(buttonVariants(variant, size), className)} {...props} />;
}





