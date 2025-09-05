import { setupServer } from 'msw/node'
import { handlers } from './handlers/index.js'

export const server = setupServer(...handlers)

