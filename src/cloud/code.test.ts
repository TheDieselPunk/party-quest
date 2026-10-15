import { describe, it, expect } from 'vitest'
import { CODE_WORDS, generateCode, normalizeCode, looksLikeCode } from './code'

describe('secret codes', () => {
  it('uses 256 distinct, lowercase, letters-only words', () => {
    expect(CODE_WORDS).toHaveLength(256)
    expect(new Set(CODE_WORDS).size).toBe(256)
    for (const w of CODE_WORDS) expect(w).toMatch(/^[a-z]+$/)
  })

  it('generates three words + four digits', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode()
      expect(code).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{4}$/)
      expect(looksLikeCode(code)).toBe(true)
      expect(normalizeCode(code)).toBe(code)
    }
  })

  it('matches regardless of case, spaces, or punctuation', () => {
    expect(normalizeCode('  Ember Griffin  Lantern 4271 ')).toBe('ember-griffin-lantern-4271')
    expect(normalizeCode('EMBER_griffin.lantern–4271')).toBe('ember-griffin-lantern-4271')
  })

  it('rejects obviously partial codes', () => {
    expect(looksLikeCode('ember')).toBe(false)
    expect(looksLikeCode('ember-griffin')).toBe(false)
  })
})
