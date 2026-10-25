import { describe, expect, it } from 'vitest'
import { cumulativePoints, linearBuckets, logBuckets } from './sizeDistribution'

describe('linearBuckets', () => {
  it('returns nothing for no values', () => {
    expect(linearBuckets([])).toEqual([])
  })

  it('puts a single repeated value into one bucket', () => {
    expect(linearBuckets([5, 5, 5])).toEqual([{ start: 5, end: 5, count: 3, customersTotal: 15 }])
  })

  it('buckets a small range at width 1, one bucket per integer', () => {
    expect(linearBuckets([1, 1, 2, 3, 3, 3])).toEqual([
      { start: 1, end: 1, count: 2, customersTotal: 2 },
      { start: 2, end: 2, count: 1, customersTotal: 2 },
      { start: 3, end: 3, count: 3, customersTotal: 9 },
    ])
  })

  it('never produces more buckets than distinct integers in range, even under maxBuckets', () => {
    // range is 1..3 (3 integers) but maxBuckets allows up to 50 - should
    // still cap at 3 buckets rather than padding with guaranteed-empty ones.
    expect(linearBuckets([1, 2, 3], 50)).toHaveLength(3)
  })

  it('caps bucket count at maxBuckets for a wide range', () => {
    const values = Array.from({ length: 101 }, (_, i) => i) // 0..100
    const buckets = linearBuckets(values, 10)
    expect(buckets.length).toBeLessThanOrEqual(10)
    expect(buckets[0]).toEqual({ start: 0, end: 10, count: 11, customersTotal: 55 })
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(values.length)
  })

  it('every value falls in exactly one bucket, and counts/totals sum to the input', () => {
    const values = [1, 2, 5, 5, 9, 20, 20, 20, 50]
    const buckets = linearBuckets(values, 5)
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(values.length)
    expect(buckets.reduce((sum, b) => sum + b.customersTotal, 0)).toBe(values.reduce((a, b) => a + b, 0))
    for (const bucket of buckets) {
      expect(bucket.start).toBeLessThanOrEqual(bucket.end)
    }
  })

  it('the last bucket absorbs a range that does not divide evenly by the width', () => {
    // range 1..10 (10 integers) into 3 buckets -> width ceil(10/3) = 4, so
    // buckets are [1,4], [5,8], [9,10] - the last is narrower, not overflowing.
    expect(linearBuckets([1, 4, 5, 8, 9, 10], 3)).toEqual([
      { start: 1, end: 4, count: 2, customersTotal: 5 },
      { start: 5, end: 8, count: 2, customersTotal: 13 },
      { start: 9, end: 10, count: 2, customersTotal: 19 },
    ])
  })
})

describe('logBuckets', () => {
  it('returns nothing for no values', () => {
    expect(logBuckets([])).toEqual([])
  })

  it('matches linearBuckets when the range has no more integers than maxBuckets', () => {
    const values = [1, 2, 2, 7, 30]
    expect(logBuckets(values, 50)).toEqual(linearBuckets(values, 50))
  })

  it('fills exactly maxBuckets contiguous buckets for a wide range', () => {
    const values = [1, 2, 3, 10, 100, 1000, 3276]
    const buckets = logBuckets(values, 50)
    expect(buckets).toHaveLength(50)
    expect(buckets[0].start).toBe(1)
    expect(buckets.at(-1)!.end).toBe(3276)
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].start).toBe(buckets[i - 1].end + 1)
    }
  })

  it('widths never shrink from one bucket to the next', () => {
    const buckets = logBuckets([1, 5000], 30)
    const widths = buckets.map((b) => b.end - b.start + 1)
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1])
    }
  })

  it('every value falls in exactly one bucket, and counts/totals sum to the input', () => {
    const values = [1, 1, 2, 5, 9, 20, 20, 64, 65, 300, 2500]
    const buckets = logBuckets(values, 10)
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(values.length)
    expect(buckets.reduce((sum, b) => sum + b.customersTotal, 0)).toBe(values.reduce((a, b) => a + b, 0))
    for (const value of values) {
      const bucket = buckets.find((b) => b.start <= value && value <= b.end)!
      expect(bucket.count).toBeGreaterThan(0)
    }
  })
})

describe('cumulativePoints', () => {
  it('returns nothing for no values', () => {
    expect(cumulativePoints([])).toEqual([])
  })

  it('gives one point per distinct value, accumulating counts and totals in order', () => {
    expect(cumulativePoints([5, 1, 3, 1])).toEqual([
      { value: 1, count: 2, customersTotal: 2 },
      { value: 3, count: 3, customersTotal: 5 },
      { value: 5, count: 4, customersTotal: 10 },
    ])
  })

  it('does not reorder its input', () => {
    const values = [3, 1, 2]
    cumulativePoints(values)
    expect(values).toEqual([3, 1, 2])
  })
})
