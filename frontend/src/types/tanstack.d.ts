import '@tanstack/react-query'

/**
 * Typed `meta` for queries and mutations — the opt-out flags for the
 * global toast policy configured in App.tsx.
 */
declare module '@tanstack/react-query' {
  interface QueryMeta {
    /**
     * Set false to suppress the global error toast for this query
     * (e.g. the owning component renders a persistent inline error state
     * with its own Retry button, or the query is a silent background poll).
     */
    toastOnError?: boolean
  }

  interface MutationMeta {
    /** Set false to suppress the global error toast for this mutation. */
    toastOnError?: boolean
  }
}
