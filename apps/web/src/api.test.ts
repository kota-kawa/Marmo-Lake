import { describe, expect, it } from 'vitest'
import { APIError } from './api'

describe('APIError', () => {
  it('keeps status and message', () => {
    const error = new APIError(422, '入力を確認してください')
    expect(error.status).toBe(422)
    expect(error.message).toBe('入力を確認してください')
  })
})

