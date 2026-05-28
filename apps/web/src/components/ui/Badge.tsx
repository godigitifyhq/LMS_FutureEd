import { cn } from '@/lib/utils'

type Variant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-50 text-primary border-primary-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
}

type Props = {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'gray', children, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  )
}