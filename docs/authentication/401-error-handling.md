# Graceful 401 Error Handling for API Calls

This implementation provides automatic token refresh on 401 errors for all API calls in the Biddit2 application.

## Architecture Overview

### Files Created/Modified

1. **`axiosClient.js`** - Custom axios client with interceptors
2. **`tokenService.js`** - Token refresh and authentication failure handling
3. **`api.js`** - Updated to use custom axios client
4. **All API files in `recoil/`** - Updated to use custom axios client
5. **`CourseInfo.jsx`** - Updated to use custom axios client

### How It Works

#### 1. Custom Axios Client (`axiosClient.js`)

- Creates an axios instance with default headers for SHSG API
- **Request Interceptor**: Automatically adds default headers (X-ApplicationId, X-RequestedLanguage, API-Version)
- **Response Interceptor**: Catches 401 errors and attempts token refresh
- Provides methods: `get()`, `post()`, `put()`, `delete()` with automatic token handling

#### 2. Token Service (`tokenService.js`)

- **`getRefreshToken()`**: Uses MSAL to silently refresh tokens
- **`handleAuthFailure()`**: Handles authentication failures by clearing cache and redirecting

#### 3. Automatic 401 Handling Process

1. API call is made with current token
2. If response is 401 (Unauthorized):
   - Mark request as retry attempt
   - Call `getRefreshToken()` to get new token
   - Update Authorization header with new token
   - Retry original request
3. If token refresh fails:
   - Clear local storage
   - Redirect to login page

#### 4. Benefits

- **Seamless User Experience**: Users don't see 401 errors for expired tokens
- **Automatic Recovery**: Token refresh happens transparently
- **Centralized Error Handling**: All API calls use the same error handling logic
- **Consistent Headers**: Default headers are applied automatically
- **Reduced Code Duplication**: No need to manually add headers in every API call

### Usage Examples

#### Before (Direct axios usage):

```javascript
const response = await axios.get("https://api.shsg.ch/endpoint", {
  headers: {
    "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
    "X-RequestedLanguage": "EN",
    "API-Version": "1",
    Authorization: `Bearer ${token}`,
  },
});
```

#### After (Using apiClient):

```javascript
const response = await apiClient.get("https://api.shsg.ch/endpoint", token);
```

### Migration Summary

All direct `axios` imports and usage have been replaced with the custom `apiClient`:

- ✅ `api.js` - 6 functions updated
- ✅ `ApiCurrentEnrollments.jsx` - 1 function updated
- ✅ `ApiScorecardEnrollments.jsx` - 1 function updated
- ✅ `ApiScorecardDetails.jsx` - 1 function updated
- ✅ `ApiCustomGrades.jsx` - 3 functions updated
- ✅ `CourseInfo.jsx` - 4 functions updated

### Error Handling Flow

1. **Network/Other Errors**: Handled by existing `errorHandlingService`
2. **401 Errors**: Automatically attempt token refresh
3. **Token Refresh Success**: Retry original request
4. **Token Refresh Failure**: Clear auth state and redirect to login

### Testing Considerations

To test the 401 handling:

1. **Simulate expired token**: Manually set an invalid token
2. **Network simulation**: Use browser dev tools to throttle/block requests
3. **Integration tests**: Verify that token refresh works end-to-end

### Future Enhancements

- Add retry logic for other transient errors (502, 503, 504)
- Implement request queuing during token refresh
- Add metrics/logging for authentication events
- Consider implementing exponential backoff for retries
