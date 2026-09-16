import { describe, expect, it } from 'vitest'
import { bucketNamesFor, parseBreakpoints } from './sizeBuckets'

describe('parseBreakpoints', () => {
  it('parses comma/whitespace-delimited whole numbers, sorted ascending', () => {
    expect(parseBreakpoints('50, 10 200')).toEqual({ ok: true, breakpoints: [10, 50, 200] })
  })

  it('collapses runs of delimiters instead of producing empty tokens', () => {
    expect(parseBreakpoints('10,,50,  200')).toEqual({ ok: true, breakpoints: [10, 50, 200] })
  })

  it('rejects empty input', () => {
    expect(parseBreakpoints('   ')).toEqual({ ok: false, error: 'Enter at least one number.' })
  })

  it('rejects duplicate values', () => {
    expect(parseBreakpoints('10, 10')).toEqual({ ok: false, error: '"10" is listed more than once.' })
  })

  it('rejects zero and negative-looking input', () => {
    expect(parseBreakpoints('0')).toEqual({ ok: false, error: 'Numbers must be greater than zero.' })
  })

  it('rejects non-numeric tokens', () => {
    expect(parseBreakpoints('abc')).toEqual({ ok: false, error: '"abc" isn\'t a whole number.' })
  })

  describe('"k" suffix', () => {
    it('scales a plain integer by 1000', () => {
      expect(parseBreakpoints('10k')).toEqual({ ok: true, breakpoints: [10000] })
    })

    it('scales a decimal amount by 1000', () => {
      expect(parseBreakpoints('1.5k')).toEqual({ ok: true, breakpoints: [1500] })
    })

    it('treats a trailing dot with no digits as the whole number', () => {
      expect(parseBreakpoints('1.k')).toEqual({ ok: true, breakpoints: [1000] })
    })

    it('allows a leading dot with no integer part', () => {
      expect(parseBreakpoints('.5k')).toEqual({ ok: true, breakpoints: [500] })
    })

    it('is not sensitive to float rounding for repeating decimals', () => {
      expect(parseBreakpoints('1.1k')).toEqual({ ok: true, breakpoints: [1100] })
    })

    it('rejects a fractional part that would produce a non-whole result', () => {
      expect(parseBreakpoints('1.2345k')).toEqual({
        ok: false,
        error: '"1.2345k" has too many digits after the decimal point - use at most 3 before "k".',
      })
    })

    it('rejects a bare "k" with no digits', () => {
      expect(parseBreakpoints('k')).toEqual({
        ok: false,
        error: '"k" isn\'t a valid "k" number - try a form like "10k" or "1.5k".',
      })
    })

    it('rejects a bare decimal point with "k" and no digits', () => {
      expect(parseBreakpoints('.k')).toEqual({
        ok: false,
        error: '".k" isn\'t a valid "k" number - try a form like "10k" or "1.5k".',
      })
    })

    it('rejects "k" in a non-terminal position', () => {
      expect(parseBreakpoints('1k5')).toEqual({
        ok: false,
        error: '"1k5" isn\'t a valid "k" number - try a form like "10k" or "1.5k".',
      })
    })

    it('rejects a "k" value that scales to zero', () => {
      expect(parseBreakpoints('0k')).toEqual({ ok: false, error: 'Numbers must be greater than zero.' })
    })

    it('parses a mix of plain and "k"-suffixed tokens', () => {
      expect(parseBreakpoints('10, 50k, 200')).toEqual({ ok: true, breakpoints: [10, 200, 50000] })
    })
  })
})

describe('bucketNamesFor', () => {
  it('names each breakpoint "le<n>" and leaves the last bucket open-ended as "gt<n>"', () => {
    expect(bucketNamesFor([10, 50, 200])).toEqual(['le10', 'le50', 'le200', 'gt200'])
  })

  it('handles a single breakpoint', () => {
    expect(bucketNamesFor([10])).toEqual(['le10', 'gt10'])
  })
})
