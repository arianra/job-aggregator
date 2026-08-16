import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

/**
 * Tiny external store for the top-bar header slot.
 * The Resume Studio (a route child) sets header content here; the global TopBar
 * (an ancestor) reads it and renders it left of the theme dropdown. Kept
 * dependency-free so both can import it without a provider tree change.
 */

let header: ReactNode = null
const listeners = new Set<() => void>()

export function setTopBarHeader(node: ReactNode) {
  if (header === node) return
  header = node
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot(): ReactNode {
  return header
}

export function useTopBarHeader(): ReactNode {
  return useSyncExternalStore(subscribe, getSnapshot)
}