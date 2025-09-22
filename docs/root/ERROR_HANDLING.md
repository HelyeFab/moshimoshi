# Error Handling System

## Overview
The Moshimoshi application uses a comprehensive error handling system that provides user-friendly messages while maintaining technical details for debugging.

## Features

### 1. User-Friendly Error Messages
- Technical error codes are automatically translated to helpful messages
- Firebase auth errors are converted to actionable guidance
- Network errors provide clear connectivity feedback
- Validation errors give specific instructions

### 2. Theme-Aware Error Display
- Error messages adapt to light/dark themes
- Consistent styling across all error displays
- Visual hierarchy with icons and borders
- Smooth transitions between themes

### 3. Error Type Detection
- Automatically determines if error is warning or critical
- Different toast durations based on severity
- Color-coded feedback (red for errors, orange for warnings)

## Error Message Mapping

### Firebase Authentication Errors
| Technical Error | User-Friendly Message |
|----------------|----------------------|
| `auth/popup-closed-by-user` | Sign-in cancelled. Please try again when you're ready. |
| `auth/network-request-failed` | Connection issue. Please check your internet and try again. |
| `auth/too-many-requests` | Too many attempts. Please wait a moment and try again. |
| `auth/user-not-found` | No account found with this email. Please check or sign up. |
| `auth/wrong-password` | Incorrect password. Please try again. |
| `auth/email-already-in-use` | This email is already registered. Please sign in instead. |

### Validation Errors
| Technical Error | User-Friendly Message |
|----------------|----------------------|
| `VALIDATION_ERROR` | Please check your information and try again. |
| `Invalid input data` | Please check your information and try again. |

### Network Errors
| Technical Error | User-Friendly Message |
|----------------|----------------------|
| `NETWORK_ERROR` | Connection issue. Please check your internet. |
| `TIMEOUT` | Request timed out. Please try again. |
| `OFFLINE` | You appear to be offline. Please check your connection. |

## Usage

### Using the Error Toast Hook
```typescript
import { useErrorToast } from '@/hooks/useErrorToast';

function MyComponent() {
  const { showError } = useErrorToast();
  
  const handleAction = async () => {
    try {
      // Your code here
    } catch (error) {
      // Automatically shows user-friendly message
      showError(error);
    }
  };
}
```

### Direct Error Message Utility
```typescript
import { getUserFriendlyErrorMessage } from '@/utils/errorMessages';

const friendlyMessage = getUserFriendlyErrorMessage(error);
```

### Error Display Components

#### In Forms (Theme-Aware)
```tsx
{error && (
  <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg mb-4 flex items-start gap-2">
    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="text-sm">{error}</span>
  </div>
)}
```

## Examples

### Before (Technical)
```
Firebase: Error (auth/popup-closed-by-user).
Invalid input data
NETWORK_ERROR
auth/email-already-in-use
```

### After (User-Friendly)
```
Sign-in cancelled. Please try again when you're ready.
Please check your information and try again.
Connection issue. Please check your internet.
This email is already registered. Please sign in instead.
```

## Best Practices

1. **Always use the error utilities** - Don't display raw error messages
2. **Log original errors** - Keep technical details in console for debugging
3. **Provide actionable guidance** - Tell users what they can do
4. **Match theme context** - Ensure error displays work in both light/dark modes
5. **Test error scenarios** - Verify all error paths show appropriate messages

## Testing Error Messages

Visit `/showcase` to test various error scenarios:
- Firebase authentication errors
- Validation errors
- Network errors
- Different error severities

## Adding New Error Messages

To add new error mappings:

1. Edit `/src/utils/errorMessages.ts`
2. Add the error code and message to `errorMessageMap`
3. Test the new mapping in the showcase page

Example:
```typescript
const errorMessageMap: Record<ErrorCode, UserMessage> = {
  // ... existing mappings
  'new-error-code': 'Your user-friendly message here.',
};
```