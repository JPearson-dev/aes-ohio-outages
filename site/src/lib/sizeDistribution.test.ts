import { describe, expect, it } from 'vitest'
import { linearBuckets } from './sizeDistribution'

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
