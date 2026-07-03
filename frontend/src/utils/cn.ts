import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge de classes Tailwind sem conflito. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
