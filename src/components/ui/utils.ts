import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

export function cn(...inputs: Array<any>) {
  return twMerge(clsx(...inputs));
}