/**
 * Everything that makes this app look like *your* club. (Gully League / Trivandrum.) Change it here; nothing else is hardcoded.
 *
 * Also used at build time by vite.config.ts for the browser tab title and theme color, so keep this file
 * free of imports and browser APIs.
 *
 * To rebrand:
 *   1. name / tagline: edit below.
 *   2. logo: put your file in /public (for example public/logo.svg or public/logo.png) and set `logoSrc` to '/logo.svg'.
 *      Square, at least 256x256 px (or an SVG) looks best. Leave `logoSrc` as null to show the emoji instead.
 *   3. favicon (browser tab icon): replace public/favicon-32.png, public/apple-touch-icon.png (180px) and public/icon-192.png, which are linked from index.html.
 *   4. color: change `themeColor` here AND `--color-brand` in src/index.css to the same hex value (a test checks they match).
 */
const name = 'Gully League'
const subtitle = 'Trivandrum'
const parentName = 'Playfest'
const taglineLead = 'A Cricket Community under'

export const brand = {
  /** Main name, shown large. */
  name,
  /** Shown small underneath the name (the place). Empty string to hide. */
  subtitle,
  /** Both together: used for the browser tab title. */
  fullName: `${name} ${subtitle}`.trim(),
  /** Optional line under the name on the login pages. With a parent logo it reads "<taglineLead> [logo]". */
  tagline: `${taglineLead} ${parentName}`,
  taglineLead,
  /** The parent community this one belongs to. Set logoSrc to null to show the name as text instead. */
  parent: { name: parentName, logoSrc: '/playfest.png' as string | null },
  /** e.g. '/logo.svg'. Null = show `emoji` instead. */
  logoSrc: '/logo.png' as string | null,
  /** Fallback when there is no logo. */
  emoji: '🏏',
  /** Browser UI color on phones. Keep equal to --color-brand in src/index.css. */
  themeColor: '#0e773d',
}
