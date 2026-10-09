/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { brand } from './brand'

describe('brand config', () => {
  it('has a name, and the full name joins the name and the place', () => {
    expect(brand.name.trim().length).toBeGreaterThan(0)
    expect(brand.fullName).toBe('Gully League Trivandrum')
  })
  it('uses the same color as the Tailwind --color-brand in index.css (both must be edited together)', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    const match = css.match(/--color-brand:\s*(#[0-9a-fA-F]{3,8})\s*;/)
    expect(match, 'index.css must define --color-brand').not.toBeNull()
    expect(match![1].toLowerCase()).toBe(brand.themeColor.toLowerCase())
  })
  it('has a parent community and a tagline that mentions it', () => {
    expect(brand.parent.name.length).toBeGreaterThan(0)
    expect(brand.tagline).toContain(brand.parent.name)
    if (brand.parent.logoSrc) expect(brand.parent.logoSrc.startsWith('/')).toBe(true)
  })
  it('has a valid Instagram link when a handle is set', () => {
    if (brand.instagram.handle) expect(brand.instagram.url).toBe(`https://www.instagram.com/${brand.instagram.handle}/`)
  })
  it('logoSrc, when set, is an absolute path to a file served from /public', () => {
    if (brand.logoSrc) expect(brand.logoSrc.startsWith('/')).toBe(true)
  })
})
