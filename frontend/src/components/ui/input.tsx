import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-[var(--border-util)] bg-[color-mix(in_oklch,var(--surface)_52%,transparent)] px-2.5 py-1 text-base text-[var(--text)] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--muted)] focus-visible:border-[var(--voice)] focus-visible:ring-3 focus-visible:ring-[var(--voice)]/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--danger)] aria-invalid:ring-3 aria-invalid:ring-[var(--danger)]/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 [-webkit-backdrop-filter:blur(8px)_saturate(1.2)] [backdrop-filter:blur(8px)_saturate(1.2)] focus-visible:[-webkit-backdrop-filter:blur(8px)_saturate(1.2)] focus-visible:[backdrop-filter:blur(8px)_saturate(1.2)]',
        className
      )}
      {...props}
    />
  )
}

export { Input }
