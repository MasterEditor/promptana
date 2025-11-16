 'use client';

import * as React from 'react';
import { cn } from './utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost';
};

export const buttonVariants = (variant: ButtonProps['variant'] = 'default') =>
  cn(
    variant === 'ghost' ? 'bg-transparent text-zinc-900 dark:text-zinc-50' : 'bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900',
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors'
  );

export function Button({ className, variant = 'default', ...props }: ButtonProps & { className?: string }): React.JSX.Element {
  return <button className={cn(buttonVariants(variant), className)} {...props} />;
}





