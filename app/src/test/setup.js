import '@testing-library/jest-dom'

// MSW test server setup (no-op if handlers are empty)
import { server } from '../../tests/msw/server.js'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
