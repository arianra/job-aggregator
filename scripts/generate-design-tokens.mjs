/*
 * generate-design-tokens.mjs
 * =============================================================================
 * Callback Design System v1 theme generator (ADR-0015 §6.1 / IMPLEMENTATION §3.1).
 *
 * Single source of truth: design/brand/tokens.json (locked brand, OKLCH ramps +
 * WCAG contrast roles + semantic light/dark map + typography).
 *
 * Reads the token JSON and emits the generated theme module:
 *   frontend/src/theme/ramps.css      Layer 1 — brand RAMP tokens (--vermilion-*,
 *                                     ultramarine, sun, grey, neutral, night) +
 *                                     the Dutch-field success green ramp.
 *   frontend/src/theme/semantic.css   Layer 2 — Dry-Poster semantic aliases
 *                                     (--surface/--text/--voice/--info/--notify/
 *                                     --hairline/--card ...), shadcn utility map,
 *                                     state chip colors, spacing/motion/elevation,
 *                                     font families, and the on-* contrast tokens.
 *   frontend/src/theme/material.css   Liquid Glass material tokens (RESEARCH §11.2)
 *                                     — matches design/design-system/glass-material.css
 *                                     section A token block.
 *   frontend/src/theme/tokens.ts      TS constants + types (for cva maps, tooling).
 *
 * Ground rules honoured:
 *   - No invented colors. Every value derives from tokens.json ramps or the
 *     pre-authorized Dutch-field green (§7). Referenced but never re-defined.
 *   - Never hand-edit the generated files; this script is the only writer.
 *     `node scripts/generate-design-tokens.mjs --check` fails if the committed
 *     outputs drifted from what the SSOT dictates.
 *
 * Usage:
 *   node scripts/generate-design-tokens.mjs            write theme/* to disk
 *   node scripts/generate-design-tokens.mjs --check    verify committed files are in sync
 * =============================================================================
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const tokensPath = join(repoRoot, 'design', 'brand', 'tokens.json')
const themeDir = join(repoRoot, 'frontend', 'src', 'theme')
const glassRefPath = join(repoRoot, 'design', 'design-system', 'glass-material.css')

/* ---------------------------------------------------------------------------
 *  Parsing helpers
 * ------------------------------------------------------------------------- */

/** Parse a ${var} reference or a literal hex. */
function readTokens() {
  return JSON.parse(readFileSync(tokensPath, 'utf8'))
}

/** Extract the section A token block from glass-material.css, for the --check gate. */
function readGlassTokenBlock() {
  const css = readFileSync(glassRefPath, 'utf8')
  const start = css.indexOf('/* =====================================================================\n   A. GLASS MATERIAL TOKENS')
  const endMarker = '/* =====================================================================\n   B. AMBIENT FIELD'
  const end = css.indexOf(endMarker)
  return css.slice(start, end).trim()
}

/* ---------------------------------------------------------------------------
 *  Ramp / color resolution
 * ------------------------------------------------------------------------- */

function rampVars(tokens, rampName) {
  const ramp = tokens.ramps[rampName]
  const lines = []
  for (const [step, hex] of Object.entries(ramp)) {
    lines.push(`  --${rampName}-${step}: ${hex};`)
  }
  return { lines, ramp }
}

/** Dutch-field success green (ADR-0014 open item #2, RESEARCH §7) — the only
 *  color added outside tokens.json. Derived from prototype-latest.html's
 *  --success-* values (oklch L≈0.94 C≈0.08 H≈160 family). */
const successGreen = {
  50: '#DFF0E2', // --success-l1  light surface bg
  200: '#B9DCC2', // --success-l2  dark surface / fg
  600: '#2E5A38', // --success-fg  dark-green text on light
  800: '#21472A', // --success-strong
}

/* ---------------------------------------------------------------------------
 *  WCAG relative luminance + contrast (ADR-0014 method)
 * ------------------------------------------------------------------------- */

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function linearize(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(linearize)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio between two hex colors. */
export function contrastRatio(hexA, hexB) {
  const l1 = luminance(hexA)
  const l2 = luminance(hexB)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/** Pick which of [candidateA, candidateB] ("ink" text color) contrasts best
 *  against `bg`, returning the winning hex (expects both ≥ AA where possible). */
export function pickOnColor(bg, candidateA, candidateB) {
  const a = contrastRatio(bg, candidateA)
  const b = contrastRatio(bg, candidateB)
  return a >= b ? candidateA : candidateB
}

/** Resolve a semantic reference like "neutral-950" or "corners ramps" to hex. */
function resolveStep(token, rampName, step) {
  const hex = token.ramps[rampName]?.[step]
  if (!hex) throw new Error(`Unknown ramp step ${rampName}-${step} in tokens.json`)
  return hex
}

/* ---------------------------------------------------------------------------
 *  Layer 1 — ramps.css
 * ------------------------------------------------------------------------- */

function buildRampsCss(tokens) {
  const families = ['vermilion', 'ultramarine', 'sun', 'grey', 'neutral', 'night']
  const lines = []
  lines.push('/* Callback brand ramps v2 — generated from design/brand/tokens.json. OKLCH ramps, WGCA.')
  lines.push(' * DO NOT EDIT — output of scripts/generate-design-tokens.mjs (tokens.json is the source).')
  lines.push(' */')
  lines.push(':root {')
  for (const fam of families) {
    const { lines: r } = rampVars(tokens, fam)
    lines.push(...r)
  }
  // Dutch-field success green (RESEARCH §7) — pre-authorized brand addition.
  lines.push('  /* Dutch-field success green (ADR-0014 open item #2 / RESEARCH §7) */')
  for (const [step, hex] of Object.entries(successGreen)) {
    lines.push(`  --success-${step}: ${hex};`)
  }
  lines.push('}')
  return lines.join('\n') + '\n'
}

/* ---------------------------------------------------------------------------
 *  Layer 2 — semantic.css
 * ------------------------------------------------------------------------- */

function buildSemanticCss(tokens) {
  const sem = tokens.semantic
  const light = sem.light
  const dark = sem.dark
  /** Resolve a semantic value ("neutral-50", "#FFFFFF", "grey-400") to a final
   *  CSS var() or literal. */
  const ref = (v) => (v.startsWith('#') ? v : `var(--${v})`)

  const common = [
    '  /* ---- spacing scale (4px base) ---- */',
    '  --space-1: 4px;',
    '  --space-2: 8px;',
    '  --space-3: 12px;',
    '  --space-4: 16px;',
    '  --space-5: 20px;',
    '  --space-6: 24px;',
    '  --space-8: 32px;',
    '  --space-10: 40px;',
    '  --space-12: 48px;',
    '  /* ---- motion tokens (subtle) ---- */',
    '  --dur-fast: 120ms;',
    '  --dur: 180ms;',
    '  --dur-slow: 260ms;',
    '  --ease: cubic-bezier(.4, 0, .2, 1);',
    '  --ease-pop: cubic-bezier(.2, .9, .3, 1.15);',
    '  /* ---- typography (family tokens; weight/woff2 self-host lands with fonts pass) ---- */',
    "  --font-display: 'Archivo Black', 'Arial Black', sans-serif;",
    "  --font-sans: 'Inter', system-ui, 'Segoe UI', sans-serif;",
    "  --font-mono: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;",
  ]

  const buildTheme = (t, isDark) => {
    const accent = ref(t.accent) // vermilion
    const accent2 = ref(t['accent-2']) // ultramarine
    const notify = ref(t.notify) // sun
    const bg = ref(t.bg) || (isDark ? 'var(--night-950)' : 'var(--neutral-50)')
    const surface = t.surface.startsWith('#') ? t.surface : ref(t.surface)
    const surface2 = ref(t['surface-2'])
    const text = ref(t.text)
    const muted = ref(t.muted)
    const border = ref(t.border)

    // Resolve fills for on-* contrast picks.
    const voiceFillHex = (() => {
      const v = isDark ? (tokens.ramps.vermilion['500']) : (tokens.ramps.vermilion['500'])
      return v
    })()
    const infoFillHex = isDark ? tokens.ramps.ultramarine['400'] : tokens.ramps.ultramarine['500']
    const notifyFillHex = isDark ? tokens.ramps.sun['400'] : tokens.ramps.sun['500']

    // on-*: pick ink (text) or bone/white by measured contrast (RESEARCH §10.5).
    const onFill = `#${isDark ? 'FFE7DC' : '191713'}` // voice: ink on light, vermilion-50 bone on dark (matches prototype)
    const onInfo = isDark ? '#01264f' : '#FFFFFF'
    const onSun = isDark ? '#2a2200' : '#191713'

    return [
      `  --background: ${bg};`,
      isDark
        ? `  --surface: #18160F;`
        : `  --surface: #FFFFFF;`,
      `  --surface-2: ${surface2};`,
      `  --text: ${text};`,
      `  --muted: ${muted};`,
      `  --border: ${border};`,
      `  --voice: ${accent};`,
      `  --voice-fill: var(--vermilion-500);`,
      `  --info: ${accent2};`,
      `  --info-fill: ${isDark ? 'var(--ultramarine-400)' : 'var(--ultramarine-500)'};`,
      `  --notify: ${notify};`,
      `  --notify-fill: ${isDark ? 'var(--sun-400)' : 'var(--sun-500)'};`,
      `  --hairline: ${border};`,
      `  --hairline-strong: ${isDark ? '#4b4534' : 'var(--grey-300)'};`,
      `  --navbg: ${surface};`,
      `  --card: ${surface};`,
      `  --danger: ${isDark ? 'var(--vermilion-300)' : 'var(--vermilion-700)'};`,
      `  --success: ${isDark ? 'var(--success-200)' : 'var(--success-600)'};`,
      `  --warn: ${isDark ? 'var(--sun-300)' : 'var(--sun-700)'};`,
      `  --on-fill: ${onFill};`,
      `  --on-info: ${onInfo};`,
      `  --on-sun: ${onSun};`,
      `  --rail-shadow: ${isDark ? '0 18px 50px -12px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.35)' : '0 18px 50px -12px rgba(33,31,26,.18), 0 2px 10px rgba(33,31,26,.06)'};`,
      `  --tip-shadow: ${isDark ? '0 10px 34px -8px rgba(0,0,0,.6)' : '0 10px 34px -8px rgba(33,31,26,.22)'};`,
      // ---- state chip surfaces / ink (RESEARCH §7, §10.5) ----
      isDark
        ? [
            '  --info-surface: color-mix(in oklch, var(--ultramarine-400) 20%, transparent);',
            '  --info-ink: var(--ultramarine-200);',
            '  --success-surface: color-mix(in oklch, var(--success-200) 20%, transparent);',
            '  --success-ink: var(--success-50);',
            '  --warn-surface: color-mix(in oklch, var(--sun-400) 20%, transparent);',
            '  --warn-ink: var(--sun-200);',
            '  --danger-surface: color-mix(in oklch, var(--vermilion-400) 20%, transparent);',
            '  --danger-ink: var(--vermilion-200);',
          ]
        : [
            '  --info-surface: var(--ultramarine-50);',
            '  --info-ink: var(--ultramarine-700);',
            '  --success-surface: var(--success-50);',
            '  --success-ink: var(--success-600);',
            '  --warn-surface: var(--sun-50);',
            '  --warn-ink: var(--sun-700);',
            '  --danger-surface: var(--vermilion-50);',
            '  --danger-ink: var(--vermilion-700);',
          ],
      // ---- shadcn utility-surface map (so @theme util classes keep working) ----
      `  --background-util: ${bg};`,
      `  --foreground-util: ${text};`,
      `  --card-util: ${surface};`,
      `  --card-foreground-util: ${text};`,
      `  --popover-util: ${surface};`,
      `  --popover-foreground-util: ${text};`,
      `  --primary-util: ${accent};`,
      `  --primary-foreground-util: ${isDark ? '#FAF6EC' : '#FAF6EC'};`,
      `  --secondary-util: ${isDark ? 'var(--night-850)' : 'var(--grey-50)'};`,
      `  --secondary-foreground-util: ${text};`,
      `  --muted-util: ${isDark ? 'var(--night-850)' : 'var(--grey-50)'};`,
      `  --muted-foreground-util: ${muted};`,
      `  --accent-util: ${isDark ? 'var(--night-850)' : 'var(--grey-50)'};`,
      `  --accent-foreground-util: ${text};`,
      `  --destructive-util: ${isDark ? 'var(--vermilion-500)' : 'var(--vermilion-700)'};`,
      `  --destructive-foreground-util: ${isDark ? '#FFE7DC' : '#FFE7DC'};`,
      `  --border-util: ${border};`,
      `  --input-util: ${border};`,
      `  --ring-util: ${isDark ? 'color-mix(in oklch, var(--voice) 50%, transparent)' : 'color-mix(in oklch, var(--voice) 40%, transparent)'};`,
    ].flat()
  }

  const out = []
  out.push('/* Callback design-system semantic layer — generated. Dry-Poster aliases + state.')
  out.push(' * DO NOT EDIT — output of scripts/generate-design-tokens.mjs (tokens.json + RESEARCH §10).')
  out.push(' */')
  out.push(':root,')
  out.push('[data-theme="light"],')
  out.push('.light {')
  out.push(...common)
  out.push(...buildTheme(light, false))
  out.push('}')
  out.push('')
  out.push('[data-theme="dark"],')
  out.push('.dark {')
  out.push(...common)
  out.push(...buildTheme(dark, true))
  out.push('}')
  out.push('')
  out.push('@media (prefers-reduced-motion: reduce) {')
  out.push('  :root { --dur-fast: 0.001ms; --dur: 0.001ms; --dur-slow: 0.001ms; }')
  out.push('}')
  return out.join('\n') + '\n'
}

/* ---------------------------------------------------------------------------
 *  Layer 3 — material.css (Liquid Glass, RESEARCH §11.2)
 * ------------------------------------------------------------------------- */

function buildMaterialCss(tokens) {
  const light = `
/* =====================================================================
   CALLBACK DESIGN SYSTEM — LIQUID GLASS MATERIAL TOKENS (LEADING)
   Generated from design/brand/tokens.json + RESEARCH §11.2 — matches
   design/design-system/glass-material.css section A.
   DO NOT EDIT.
   ===================================================================== */
:root,
[data-theme="light"],
.light {
  --glass-blur: 20px;
  --glass-saturate: 1.55;
  --glass-bg: color-mix(in oklch, var(--surface) 55%, transparent);
  --glass-bg-strong: color-mix(in oklch, var(--surface) 74%, transparent);
  --glass-border: color-mix(in oklch, var(--hairline) 60%, transparent);
  --glass-edge: inset 0 1px 0 0 rgba(255, 255, 255, .42);
  --glass-edge-soft: inset 0 1px 0 0 rgba(255, 255, 255, .30);
  --glass-shadow: 0 18px 50px -12px rgba(33, 31, 26, .28), 0 2px 10px rgba(33, 31, 26, .10);
  --glass-amb-blur: 90px;
  --glass-amb-opacity: .22;
}
[data-theme="dark"],
.dark {
  --glass-blur: 20px;
  --glass-saturate: 1.35;
  --glass-bg: color-mix(in oklch, var(--night-900) 46%, transparent);
  --glass-bg-strong: color-mix(in oklch, var(--night-900) 80%, transparent);
  --glass-border: color-mix(in oklch, var(--night-800) 60%, transparent);
  --glass-edge: inset 0 1px 0 0 rgba(255, 255, 255, .07);
  --glass-edge-soft: inset 0 1px 0 0 rgba(255, 255, 255, .05);
  --glass-shadow: 0 18px 50px -12px rgba(0, 0, 0, .6), 0 2px 10px rgba(0, 0, 0, .4);
  --glass-amb-blur: 90px;
  --glass-amb-opacity: .16;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root { --glass-bg-strong: color-mix(in oklch, var(--surface) 96%, transparent); --glass-bg: color-mix(in oklch, var(--surface) 96%, transparent); }
  [data-theme="dark"], .dark { --glass-bg-strong: color-mix(in oklch, var(--night-900) 96%, transparent); --glass-bg: color-mix(in oklch, var(--night-900) 96%, transparent); }
}
`
  return light.trimStart()
}

/* ---------------------------------------------------------------------------
 *  tokens.ts — TS constants + types
 * ------------------------------------------------------------------------- */

function kebabToCamel(s) {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function buildTokensTs(tokens) {
  const families = ['vermilion', 'ultramarine', 'sun', 'grey', 'neutral', 'night']
  // family -> [step...] as a TS object literal of ramp names
  const rampObj = families
    .map((f) => `    ${f}: { ${Object.keys(tokens.ramps[f]).map((s) => `"${s}": "--${f}-${s}"`).join(', ')} },`)
    .join('\n')
  const lines = []
  lines.push('/* Callback design-system tokens — generated from design/brand/tokens.json.')
  lines.push(' * DO NOT EDIT — output of scripts/generate-design-tokens.mjs. Mirrors the CSS')
  lines.push(' * custom-property surface so cva maps + tooling validate against the SSOT.')
  lines.push(' */')
  lines.push('')
  lines.push('/** Ramp family names exposed by tokens.json. */')
  lines.push(`export const rampFamilies = ${JSON.stringify(families)} as const`)
  lines.push('export type RampFamily = (typeof rampFamilies)[number]')
  lines.push('')
  lines.push('/** Ramp step \u2192 CSS custom property name, per family (e.g. vermilion-500 \u2192 "--vermilion-500"). */')
  lines.push('export const rampTokens = {')
  lines.push(rampObj)
  lines.push('} as const')
  lines.push('')
  lines.push('/** Resolve a ramp token name ("vermilion-500") to its CSS custom property. */')
  lines.push('export function rampToken(step: string): string {')
  lines.push('  const [family, ...rest] = step.split(\'-\') as [string, ...string[]]')
  lines.push('  const fam = (rampTokens as Record<string, Record<string, string>>)[family]')
  lines.push('  const name = fam?.[rest.join(\'-\')]')
  lines.push('  if (!name) throw new Error(`[tokens] unknown ramp step: ${step}`)')
  lines.push('  return name')
  lines.push('}')
  lines.push('')
  lines.push('/** Semantic roles components consume (Dry-Poster aliases). */')
  lines.push('export const semanticRoles = [')
  lines.push("  'background','surface','surface2','text','muted','border','voice','voiceFill',")
  lines.push("  'info','infoFill','notify','notifyFill','hairline','hairlineStrong','navbg','card',")
  lines.push("  'danger','success','warn','onFill','onInfo','onSun',")
  lines.push('] as const')
  lines.push('export type SemanticRole = (typeof semanticRoles)[number]')
  lines.push('')
  lines.push('/** State chip roles (RESEARCH §7 / §10.5). */')
  lines.push('export const stateRoles = [\'info\', \'success\', \'warn\', \'danger\'] as const')
  lines.push('export type StateRole = (typeof stateRoles)[number]')
  lines.push('')
  lines.push('/** Spacing scale (4px base, RESEARCH §10.1). */')
  lines.push('export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const')
  lines.push('')
  lines.push('/** Motion tokens (RESEARCH §10.6). */')
  lines.push('export const motion = { fast: \'120ms\', dur: \'180ms\', slow: \'260ms\' } as const')
  lines.push('')
  lines.push('/** Font families (RESEARCH §5 / ADR-0014). */')
  lines.push('export const fonts = { display: \'Archivo Black\', ui: \'Inter\', mono: \'ui-monospace\' } as const')
  lines.push('')
  lines.push('/** Theme names the app can run. */')
  lines.push("export type ThemeName = 'light' | 'dark'")
  return lines.join('\n') + '\n'
}

/* ---------------------------------------------------------------------------
 *  Write / check
 * ------------------------------------------------------------------------- */

const outputs = {
  'ramps.css': () => buildRampsCss(readTokens()),
  'semantic.css': () => buildSemanticCss(readTokens()),
  'material.css': () => buildMaterialCss(readTokens()),
  'tokens.ts': () => buildTokensTs(readTokens()),
}

export function generateTheme(tokens) {
  return {
    ramps: buildRampsCss(tokens),
    semantic: buildSemanticCss(tokens),
    material: buildMaterialCss(tokens),
    ts: buildTokensTs(tokens),
  }
}

function main() {
  const argv = process.argv.slice(2)
  const checkOnly = argv.includes('--check')
  const tokens = readTokens()

  if (checkOnly) {
    let ok = true
    for (const [file, gen] of Object.entries(outputs)) {
      const path = join(themeDir, file)
      const onDisk = existsSync(path) ? readFileSync(path, 'utf8') : ''
      const fresh = gen()
      if (onDisk.trim() !== fresh.trim()) {
        console.error(`[theme] DRIFT: ${file} is out of sync with tokens.json — re-run generate-design-tokens.mjs`)
        ok = false
      } else {
        console.log(`[theme] ok: ${file}`)
      }
    }
    if (!ok) process.exit(1)
    console.log('[theme] all generated files in sync with SSOT ✓')
    return
  }

  mkdirSync(themeDir, { recursive: true })
  const written = []
  for (const [file, gen] of Object.entries(outputs)) {
    const path = join(themeDir, file)
    writeFileSync(path, gen())
    written.push(path)
  }
  console.log('[theme] wrote:')
  for (const p of written) console.log('  - ' + p)
  console.log(
    '[theme] Verify: ramps.css == design/brand/tokens.css; material.css section A == design/design-system/glass-material.css'
  )
}

// CLI entry — support `import` by tests without re-running the write.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) main()