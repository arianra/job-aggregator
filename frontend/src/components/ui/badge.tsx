import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-[var(--voice-fill)] text-[var(--on-fill)] [a]:hover:bg-[var(--voice-fill)]/80',
        secondary: 'bg-[var(--surface-2)] text-[var(--text)] [a]:hover:bg-[var(--grey-200)]',
        destructive:
          'bg-[var(--danger-surface)] text-[var(--danger-ink)] focus-visible:ring-destructive/20 dark:bg-[var(--danger-surface)] dark:focus-visible:ring-destructive/40 [a]:hover:bg-[var(--danger-surface)]',
        outline: 'border-[var(--hairline)] text-[var(--text)] [a]:hover:bg-[var(--surface-2)]',
        ghost: 'text-[var(--muted)] hover:bg-[var(--surface-2)] dark:hover:bg-muted/50',
        link: 'text-[var(--voice)] underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
