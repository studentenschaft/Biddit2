# Custom Axios Client - 401 Error Handling

This document explains the implementation of graceful 401 error handling for API calls to SHSG and UNISG services.

## Problem

Previously, when authentication tokens expired, API calls would fail with 401 errors and only show error toasts to users. This created a poor user experience, especially for long-running sessions where tokens naturally expire.

## Solution

A custom axios client (`axiosClient.js`) that automatically:
1. Detects 401 unauthorized responses
2. Attempts to refresh the authentication token silently using MSAL
3. Retries the original request with the new token
4. Falls back to redirecting to login if token refresh fails

## Implementation Details

### Custom Axios Instance

The `axiosClient` is pre-configured with:
- 30-second timeout
- Default headers required for SHSG/UNISG APIs
- Request and response interceptors

### Request Interceptor

- Maintains compatibility with existing code that manually sets Authorization headers
- Logs when requests don't have auth tokens (for debugging)

### Response Interceptor

- Intercepts 401 responses before they reach application code
- Attempts silent token refresh using MSAL `acquireTokenSilent()`
- If successful, retries the original request with the new token
- If refresh requires user interaction, redirects to login page
- For all other errors, uses existing error handling service

### Token Refresh Logic

```javascript
const refreshToken = async () => {
  const account = msalInstance.getAllAccounts()[0];
  const response = await msalInstance.acquireTokenSilent({
    account,
    scopes: ["https://integration.unisg.ch/api/user_impersonation"],
  });
  return response.accessToken;
};
```

## Usage

All existing API calls automatically benefit from 401 handling:

```javascript
// Before - direct axios usage
import axios from "axios";
const response = await axios.get("https://api.shsg.ch/study-plans", {
  headers: { Authorization: `Bearer ${token}` }
});

// After - using custom client (automatic 401 handling)
import axiosClient from "./axiosClient";
const response = await axiosClient.get("https://api.shsg.ch/study-plans", {
  headers: { Authorization: `Bearer ${token}` }
});
```

## Files Updated

- **NEW**: `axiosClient.js` - Custom axios instance with interceptors
- **UPDATED**: All helper files that make API calls:
  - `api.js`
  - `useCourseInfoData.js`
  - `useEnrolledCoursesData.js`
  - `useCourseRatingsData.js`
  - `useStudyPlanDataSimplified.js`

## Testing

Unit tests verify:
- Axios client configuration
- Default headers and timeout
- Interceptor registration

## Benefits

1. **Seamless User Experience**: Users no longer see 401 errors for expired tokens
2. **Automatic Recovery**: Sessions can continue without manual re-login
3. **Backward Compatibility**: All existing code patterns continue to work
4. **Centralized Logic**: 401 handling logic is in one place, easy to maintain
5. **Graceful Degradation**: Falls back to login redirect when needed

## Error Flow

```
API Request with Expired Token
         ↓
    401 Response
         ↓
   Response Interceptor
         ↓
    Try Token Refresh
         ↓ 
   ✓ Success          ✗ Failed
         ↓                ↓
   Retry Request    Redirect to Login
         ↓
   Return Success
```

This implementation ensures that users have a smooth experience even when tokens expire, significantly improving the application's usability for long-running sessions.