import { useEffect, useRef } from 'react'

/**
 * LiquidGlassMaterial — runtime for the Liquid Glass LEADING surface (ADR-0015
 * s6.4 / RESEARCH §11 / glass-material.css §B + §C).
 *
 * Renders two fixed, pointer-transparent layers once per app:
 *  - ambient field  : three heavily-blurred brand blobs drifting slowly behind
 *                     content — this is what the glass refracts.
 *  - pointer sheen  : a faint radial light trailing the cursor (--px/--py), so
 *                     floating chrome "reacts to movement with specular light".
 *
 * Both are gated by prefers-reduced-motion (drift halts, sheen hidden).
 * The theme already drives colour (--vermilion-200 heat light / cool neutral
 * dark) and opacity from material.css tokens — no invented colors here.
 */
export function LiquidGlassMaterial() {
  const sheenRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sheen = sheenRef.current
    if (!sheen) return
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const onMove = (e: MouseEvent) => {
      sheen.style.setProperty('--px', `${e.clientX}px`)
      sheen.style.setProperty('--py', `${e.clientY}px`)
      sheen.classList.add('on')
    }
    const onLeave = () => sheen.classList.remove('on')

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <>
      {/* Ambient field: present in the DOM so glass has colour-from-context. */}
      <div className="material-ambient" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      {/* Pointer sheen: fixed light trailing the cursor. */}
      <div ref={sheenRef} className="material-sheen" aria-hidden="true" />
    </>
  )
}