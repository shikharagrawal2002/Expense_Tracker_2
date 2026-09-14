import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCompactCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

/** Harmonious categorical palette (mirrors --color-chart-* tokens) for charts
 *  with many series, so adjacent slices/bars are always visually distinct. */
export const CHART_PALETTE = [
  '#f59e0b',
  '#0ea5e9',
  '#10b981',
  '#a855f7',
  '#f43f5e',
  '#6366f1',
  '#14b8a6',
  '#ec4899',
]
