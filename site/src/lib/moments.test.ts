import { describe, expect, it } from 'vitest'
import { easternWallClockMs, formatMoment, nearestMomentIndex, type Moment } from './moments'

function moment(commitId: number, chartMs: number): Moment {
  return { commitId, at: new Date(chartMs), chartMs }
}

describe('easternWallClockMs', () => {
  // Read back with local getters - that's how Chart.js reads the naive
  // heartbeat timestamps, so these hold in any test-runner timezone.
  it('reads an instant as Eastern daylight time in summer', () => {
    const local = new Date(easternWallClockMs(new Date('2026-09-20T20:08:11Z')))
    expect([local.getFullYear(), local.getMonth(), local.getDate()]).toEqual([2026, 8, 20])
    expect([local.getHours(), local.getMinutes(), local.getSeconds()]).toEqual([16, 8, 11])
  })

  it('reads an instant as Eastern standard time in winter', () => {
    const local = new Date(easternWallClockMs(new Date('2026-01-15T17:00:00Z')))
    expect([local.getDate(), local.getHours()]).toEqual([15, 12])
  })

  it('rolls back across midnight', () => {
    const local = new Date(easternWallClockMs(new Date('2026-09-17T00:05:00Z')))
    expect([local.getDate(), local.getHours(), local.getMinutes()]).toEqual([16, 20, 5])
  })
})

describe('nearestMomentIndex', () => {
  const moments = [moment(1, 100), moment(2, 200), moment(3, 400)]

  it('picks the closest moment', () => {
    expect(nearestMomentIndex(moments, 140)).toBe(0)
    expect(nearestMomentIndex(moments, 160)).toBe(1)
    expect(nearestMomentIndex(moments, 350)).toBe(2)
  })

  it('clamps to the ends', () => {
    expect(nearestMomentIndex(moments, -5000)).toBe(0)
    expect(nearestMomentIndex(moments, 5000)).toBe(2)
  })

  it('prefers the earlier moment on an exact tie', () => {
    expect(nearestMomentIndex(moments, 300)).toBe(1)
  })

  it('handles a single moment', () => {
    expect(nearestMomentIndex([moment(1, 100)], 999)).toBe(0)
  })
})

describe('formatMoment', () => {
  it('formats in Eastern time with the zone abbreviation', () => {
    const at = new Date('2026-09-17T00:05:00Z')
    expect(formatMoment({ commitId: 1, at, chartMs: 0 })).toBe('Sep 16, 2026, 8:05 PM EDT')
  })
})
