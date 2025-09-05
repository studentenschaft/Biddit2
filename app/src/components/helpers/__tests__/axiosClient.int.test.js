import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient } from '../axiosClient'
import { server } from '../../../../tests/msw/server.js'
import { http, HttpResponse } from 'msw'

// Mock tokenService functions
vi.mock('../../auth/tokenService', () => ({
  getRefreshToken: vi.fn(),
  handleAuthFailure: vi.fn(),
}))

// Bring mocked fns into scope
import { getRefreshToken, handleAuthFailure } from '../../auth/tokenService'

describe('ApiClient interceptors (integration via MSW)', () => {
  let client

  beforeEach(() => {
    client = new ApiClient()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // reset handlers between tests
  })

  it('adds default headers and Authorization header on GET', async () => {
    server.use(
      http.get('http://test.local/default-headers', ({ request }) => {
        const headers = request.headers
        expect(headers.get('X-ApplicationId')).toBe('820e077d-4c13-45b8-b092-4599d78d45ec')
        expect(headers.get('X-RequestedLanguage')).toBe('EN')
        expect(headers.get('API-Version')).toBe('1')
        // NOTE: Some adapters omit Content-Type for GET; do not assert it here
        expect(headers.get('Authorization')).toBe('Bearer TOKEN')
        return HttpResponse.json({ ok: true })
      })
    )

    const res = await client.get('http://test.local/default-headers', 'TOKEN')
    expect(res.status).toBe(200)
    expect(res.data).toEqual({ ok: true })
  })

  it('refreshes token once on 401 and retries the request', async () => {
    let call = 0
    server.use(
      http.get('http://test.local/refresh-flow', ({ request }) => {
        call += 1
        if (call === 1) {
          return new HttpResponse(null, { status: 401 })
        }
        // On retry, ensure refreshed token header used
        expect(request.headers.get('Authorization')).toBe('Bearer REFRESHED')
        return HttpResponse.json({ ok: true })
      })
    )

    getRefreshToken.mockResolvedValue('REFRESHED')

    const api = new ApiClient()
    const res = await api.get('http://test.local/refresh-flow', 'STALE')
    expect(res.status).toBe(200)
    expect(res.data).toEqual({ ok: true })
    expect(getRefreshToken).toHaveBeenCalledTimes(1)
    expect(handleAuthFailure).not.toHaveBeenCalled()
  })

  it('calls handleAuthFailure when refresh throws and propagates error', async () => {
    server.use(
      http.get('http://test.local/fail-refresh', () => new HttpResponse(null, { status: 401 }))
    )

    getRefreshToken.mockRejectedValue(new Error('refresh failed'))

    const api = new ApiClient()
    await expect(api.get('http://test.local/fail-refresh', 'ANY'))
      .rejects.toBeTruthy()

    expect(getRefreshToken).toHaveBeenCalledTimes(1)
    expect(handleAuthFailure).toHaveBeenCalledTimes(1)
  })
})
