import { describe, it, expect } from 'vitest'
import { needsThumb } from './thumb'
import { classifySignInError } from '../data/repo'

describe('needsThumb', () => {
  it('flags rows that have photos but no thumb yet', () => {
    expect(needsThumb({ thumb: null, photoCount: 2 })).toBe(true)
    expect(needsThumb({ thumb: '', photoCount: 1 })).toBe(true)
  })
  it('leaves rows without photos and rows already thumbed alone', () => {
    expect(needsThumb({ thumb: null, photoCount: 0 })).toBe(false)
    expect(needsThumb({ thumb: 'data:image/jpeg;base64,x', photoCount: 3 })).toBe(false)
  })
})

describe('classifySignInError', () => {
  it('treats a rejected credential as a wrong password', () => {
    expect(classifySignInError({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' })).toEqual({
      ok: false,
      reason: 'bad_password',
    })
    expect(classifySignInError({ status: 400, message: 'Invalid login credentials' })).toEqual({
      ok: false,
      reason: 'bad_password',
    })
  })
  it('reports anything else as the service being unavailable, with the reason', () => {
    const quota = 'Service for this project is restricted due to the following violations: exceed_egress_quota.'
    expect(classifySignInError({ status: 402, message: quota })).toEqual({ ok: false, reason: 'unavailable', message: quota })
    expect(classifySignInError({ message: 'Failed to fetch' })).toEqual({ ok: false, reason: 'unavailable', message: 'Failed to fetch' })
  })
})
