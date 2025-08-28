import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosClient from '../../helpers/axiosClient';

// Mock MSAL
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn(() => ({
    initialize: vi.fn(),
    getAllAccounts: vi.fn(() => []),
    acquireTokenSilent: vi.fn(),
    acquireTokenRedirect: vi.fn()
  })),
  InteractionRequiredAuthError: class InteractionRequiredAuthError extends Error {
    constructor(message) {
      super(message);
      this.name = 'InteractionRequiredAuthError';
    }
  }
}));

// Mock authConfig
vi.mock('../../auth/authConfig', () => ({
  msalConfig: {
    auth: {
      clientId: 'test-client-id',
      authority: 'https://login.microsoftonline.com/test-tenant-id'
    },
    cache: {
      cacheLocation: 'localStorage'
    }
  }
}));

// Mock errorHandlingService
vi.mock('../../errorHandling/ErrorHandlingService', () => ({
  errorHandlingService: {
    handleError: vi.fn()
  }
}));

describe('axiosClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be an axios instance', () => {
    expect(axiosClient).toBeDefined();
    expect(typeof axiosClient.get).toBe('function');
    expect(typeof axiosClient.post).toBe('function');
    expect(typeof axiosClient.delete).toBe('function');
  });

  it('should have default headers configured', () => {
    expect(axiosClient.defaults.headers['Content-Type']).toBe('application/json');
    expect(axiosClient.defaults.headers['X-ApplicationId']).toBe('820e077d-4c13-45b8-b092-4599d78d45ec');
    expect(axiosClient.defaults.headers['X-RequestedLanguage']).toBe('EN');
    expect(axiosClient.defaults.headers['API-Version']).toBe('1');
  });

  it('should have a 30 second timeout configured', () => {
    expect(axiosClient.defaults.timeout).toBe(30000);
  });

  it('should have request and response interceptors', () => {
    expect(axiosClient.interceptors.request.handlers.length).toBeGreaterThan(0);
    expect(axiosClient.interceptors.response.handlers.length).toBeGreaterThan(0);
  });
});