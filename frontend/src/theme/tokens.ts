/* Callback design-system tokens — generated from design/brand/tokens.json.
 * DO NOT EDIT — output of scripts/generate-design-tokens.mjs. Mirrors the CSS
 * custom-property surface so cva maps + tooling validate against the SSOT.
 */

/** Ramp family names exposed by tokens.json. */
export const rampFamilies = ["vermilion","ultramarine","sun","grey","neutral","night"] as const
export type RampFamily = (typeof rampFamilies)[number]

/** Ramp step → CSS custom property name, per family (e.g. vermilion-500 → "--vermilion-500"). */
export const rampTokens = {
    vermilion: { "50": "--vermilion-50", "100": "--vermilion-100", "200": "--vermilion-200", "300": "--vermilion-300", "400": "--vermilion-400", "500": "--vermilion-500", "600": "--vermilion-600", "700": "--vermilion-700", "800": "--vermilion-800", "900": "--vermilion-900", "950": "--vermilion-950" },
    ultramarine: { "50": "--ultramarine-50", "100": "--ultramarine-100", "200": "--ultramarine-200", "300": "--ultramarine-300", "400": "--ultramarine-400", "500": "--ultramarine-500", "600": "--ultramarine-600", "700": "--ultramarine-700", "800": "--ultramarine-800", "900": "--ultramarine-900", "950": "--ultramarine-950" },
    sun: { "50": "--sun-50", "100": "--sun-100", "200": "--sun-200", "300": "--sun-300", "400": "--sun-400", "500": "--sun-500", "600": "--sun-600", "700": "--sun-700", "800": "--sun-800", "900": "--sun-900", "950": "--sun-950" },
    grey: { "50": "--grey-50", "100": "--grey-100", "200": "--grey-200", "300": "--grey-300", "400": "--grey-400", "500": "--grey-500", "600": "--grey-600", "700": "--grey-700", "800": "--grey-800", "900": "--grey-900", "950": "--grey-950" },
    neutral: { "50": "--neutral-50", "100": "--neutral-100", "200": "--neutral-200", "300": "--neutral-300", "400": "--neutral-400", "500": "--neutral-500", "600": "--neutral-600", "700": "--neutral-700", "800": "--neutral-800", "900": "--neutral-900", "950": "--neutral-950" },
    night: { "800": "--night-800", "850": "--night-850", "900": "--night-900", "950": "--night-950" },
} as const

/** Resolve a ramp token name ("vermilion-500") to its CSS custom property. */
export function rampToken(step: string): string {
  const [family, ...rest] = step.split('-') as [string, ...string[]]
  const fam = (rampTokens as Record<string, Record<string, string>>)[family]
  const name = fam?.[rest.join('-')]
  if (!name) throw new Error(`[tokens] unknown ramp step: ${step}`)
  return name
}

/** Semantic roles components consume (Dry-Poster aliases). */
export const semanticRoles = [
  'background','surface','surface2','text','muted','border','voice','voiceFill',
  'info','infoFill','notify','notifyFill','hairline','hairlineStrong','navbg','card',
  'danger','success','warn','onFill','onInfo','onSun',
] as const
export type SemanticRole = (typeof semanticRoles)[number]

/** State chip roles (RESEARCH §7 / §10.5). */
export const stateRoles = ['info', 'success', 'warn', 'danger'] as const
export type StateRole = (typeof stateRoles)[number]

/** Spacing scale (4px base, RESEARCH §10.1). */
export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const

/** Motion tokens (RESEARCH §10.6). */
export const motion = { fast: '120ms', dur: '180ms', slow: '260ms' } as const

/** Font families (RESEARCH §5 / ADR-0014). */
export const fonts = { display: 'Archivo Black', ui: 'Inter', mono: 'ui-monospace' } as const

/** Theme names the app can run. */
export type ThemeName = 'light' | 'dark'
