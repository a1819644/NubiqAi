# 🔐 Authentication Implementation Guide

## ⚠️ CRITICAL: Authentication is Required Before Production

Currently, the server **trusts userId from the request body**. This is a **CRITICAL SECURITY VULNERABILITY** that must be fixed before production deployment.

## The Problem

```typescript
// ❌ CURRENT (INSECURE):
app.post('/api/ask-ai', rateLimitMiddleware('general'), async (req, res) => {
  const { userId, prompt } = req.body; // User can fake any userId!
  
  // What if malicious user sends:
  // { userId: "someoneElse@example.com", prompt: "..." }
  // They could access another user's data!
});
```

## The Solution: Firebase Authentication Middleware

### Step 1: Create Authentication Middleware

Create file: `Server/services/authMiddleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';

/**
 * Extend Express Request to include authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

/**
 * Security event logger
 */
function logAuthEvent(event: string, context: any = {}) {
  console.warn(`🔒 [AUTH] ${event}`, {
    timestamp: new Date().toISOString(),
    ...context
  });
}

/**
 * Verify Firebase ID token and attach user to request
 * 
 * Frontend must send Authorization header:
 * Authorization: Bearer <firebase-id-token>
 */
export async function authenticateUser(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logAuthEvent('Missing or invalid Authorization header', { 
        path: req.path,
        ip: req.ip 
      });
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required. Please provide a valid token.' 
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      logAuthEvent('Empty token', { path: req.path });
      return res.status(401).json({ 
        success: false,
        error: 'Authentication token is empty' 
      });
    }

    // Verify token with Firebase Admin SDK
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    // Attach verified user to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };
    
    console.log(`✅ Authenticated user: ${req.user.uid}`);
    next();
    
  } catch (error: any) {
    logAuthEvent('Token verification failed', { 
      error: error.message,
      path: req.path 
    });
    
    // Handle expired tokens
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false,
        error: 'Token expired. Please sign in again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Handle invalid tokens
    return res.status(403).json({ 
      success: false,
      error: 'Invalid authentication token',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Optional: Verify that the authenticated user matches the requested userId
 * Use this for endpoints that explicitly work with userId
 */
export function verifyUserOwnership(req: Request, res: Response, next: NextFunction) {
  const requestedUserId = req.body.userId || req.query.userId || req.params.userId;
  
  if (!requestedUserId) {
    // If no userId in request, use authenticated user's ID
    return next();
  }
  
  if (requestedUserId !== req.user?.uid) {
    logAuthEvent('User ownership violation', {
      authenticatedUser: req.user?.uid,
      requestedUser: requestedUserId,
      path: req.path
    });
    
    return res.status(403).json({
      success: false,
      error: 'You do not have permission to access this resource'
    });
  }
  
  next();
}
```

### Step 2: Update Server Index

```typescript
// Server/index.ts

// Add imports at top
import { authenticateUser, verifyUserOwnership } from './services/authMiddleware';

// Apply to all protected endpoints
app.post('/api/ask-ai', 
  authenticateUser,        // 1️⃣ Verify Firebase token
  verifyUserOwnership,     // 2️⃣ Check userId matches token
  rateLimitMiddleware('general'), // 3️⃣ Rate limiting
  async (req, res) => {
    // Now use req.user.uid instead of req.body.userId
    const userId = req.user!.uid; // Verified and safe!
    const { prompt, chatId, type } = req.body;
    
    // Your existing code...
  }
);

app.post('/api/end-chat',
  authenticateUser,
  verifyUserOwnership,
  rateLimitMiddleware('general'),
  async (req, res) => {
    const userId = req.user!.uid;
    const { chatId } = req.body;
    // ...
  }
);

// Apply to ALL user-specific endpoints:
// - /api/save-all-chats
// - /api/store-memory
// - /api/search-memory
// - /api/set-user-profile
// - /api/get-user-profile/:userId
// - /api/chats
// - /api/process-document (if storing with userId)
// - /api/edit-image (if storing with userId)
```

### Step 3: Update Frontend API Calls

```typescript
// src/services/api.ts

import { auth } from '../config/firebase';

async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return await user.getIdToken();
}

export async function askAI(
  prompt: string,
  chatId: string,
  userId: string, // Still include for backwards compat, but server will use token
  type: 'text' | 'image' = 'text'
) {
  const token = await getAuthToken(); // Get fresh token
  
  const response = await fetch(`${API_URL}/api/ask-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`, // Add auth header
    },
    body: JSON.stringify({
      prompt,
      chatId,
      userId, // Server will verify this matches token
      type
    }),
  });

  // Handle 401 (expired token)
  if (response.status === 401) {
    const errorData = await response.json();
    if (errorData.code === 'TOKEN_EXPIRED') {
      // Force token refresh
      await auth.currentUser?.getIdToken(true);
      // Retry request...
    }
  }

  return response.json();
}

// Update ALL API methods to include Authorization header
export async function endChat(userId: string, chatId: string, force?: boolean) {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_URL}/api/end-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, chatId, force }),
  });

  return response.json();
}

// ... update all other API methods
```

### Step 4: Token Refresh Strategy

```typescript
// src/services/auth.ts

import { auth } from '../config/firebase';

/**
 * Automatically refresh tokens before they expire
 * Firebase tokens expire after 1 hour
 */
export function setupTokenRefresh() {
  auth.onIdTokenChanged(async (user) => {
    if (user) {
      // Get fresh token every 55 minutes (before 1hr expiry)
      setInterval(async () => {
        try {
          await user.getIdToken(true); // Force refresh
          console.log('🔄 Token refreshed');
        } catch (error) {
          console.error('❌ Token refresh failed:', error);
        }
      }, 55 * 60 * 1000); // 55 minutes
    }
  });
}

// Call in main.tsx or App.tsx
setupTokenRefresh();
```

## Security Benefits

### Before (Insecure)
```typescript
// Client sends:
{ userId: "malicious_user", prompt: "hack the system" }

// Server trusts it:
const { userId } = req.body; // ❌ Could be ANYONE's userId
```

### After (Secure)
```typescript
// Client sends:
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...
{ userId: "user123", prompt: "legitimate request" }

// Server verifies:
const decodedToken = await admin.auth().verifyIdToken(token);
// decodedToken.uid === "user123" ✅ Cryptographically verified

// Then checks:
if (req.body.userId !== decodedToken.uid) {
  return 403; // ❌ Cannot fake another user's ID
}
```

## Testing Authentication

### Test Valid Token
```bash
# Get token from Firebase (use your actual token)
TOKEN="your-firebase-id-token-here"

curl -X POST http://localhost:8000/api/ask-ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt":"test","userId":"your-user-id","chatId":"chat123"}'
```

### Test Missing Token
```bash
# Should return 401
curl -X POST http://localhost:8000/api/ask-ai \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","userId":"any-user-id"}'
```

### Test Invalid Token
```bash
# Should return 403
curl -X POST http://localhost:8000/api/ask-ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token-123" \
  -d '{"prompt":"test","userId":"any-user-id"}'
```

### Test User Ownership Violation
```bash
# User A's token trying to access User B's data
# Should return 403
curl -X POST http://localhost:8000/api/ask-ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -d '{"prompt":"test","userId":"user_b_id","chatId":"chat123"}'
```

## Deployment Checklist

- [ ] Create `authMiddleware.ts` with `authenticateUser` and `verifyUserOwnership`
- [ ] Add auth imports to `Server/index.ts`
- [ ] Apply `authenticateUser` middleware to ALL user-specific endpoints (20+ endpoints)
- [ ] Apply `verifyUserOwnership` to endpoints that include userId
- [ ] Update frontend API calls to include `Authorization` header
- [ ] Implement token refresh strategy
- [ ] Test all endpoints with valid/invalid/missing tokens
- [ ] Test user ownership violations
- [ ] Update API documentation with authentication requirements
- [ ] Add token expiry handling in frontend error boundaries

## Error Handling

### Frontend Token Error Handler
```typescript
// src/utils/apiErrorHandler.ts

export async function handleApiError(error: Response) {
  if (error.status === 401) {
    const data = await error.json();
    
    if (data.code === 'TOKEN_EXPIRED') {
      // Refresh token and retry
      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true);
        // Retry the failed request
        return 'RETRY';
      } else {
        // User not logged in - redirect to sign in
        window.location.href = '/signin';
        return 'REDIRECT';
      }
    }
  }
  
  if (error.status === 403) {
    // Permission denied
    alert('You do not have permission to perform this action');
    return 'FORBIDDEN';
  }
  
  return 'ERROR';
}
```

## Performance Considerations

- **Token Verification:** ~50-100ms per request (Firebase Admin SDK caches public keys)
- **Token Refresh:** Happens automatically every 55 minutes (user won't notice)
- **Network Overhead:** JWT token adds ~1-2KB to each request header

## Alternative: Session-Based Auth

If Firebase Auth overhead is too high, consider session-based authentication:

```typescript
// After Firebase token verification, create a session
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Login endpoint verifies Firebase token once, then creates session
app.post('/api/login', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  
  req.session.userId = decodedToken.uid;
  res.json({ success: true });
});

// Then use session for subsequent requests (faster)
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = { uid: req.session.userId };
  next();
}
```

## Next Steps

1. **Create authMiddleware.ts** (30 minutes)
2. **Update Server/index.ts with auth middleware** (1 hour)
3. **Update frontend API calls** (1-2 hours)
4. **Test authentication flow** (1 hour)
5. **Deploy to staging environment** 
6. **Load test with authentication** 
7. **Deploy to production** ✅

---

**Priority:** 🔴 **CRITICAL** - Must complete before production deployment
**Estimated Time:** 3-4 hours
**Security Impact:** Prevents unauthorized access to all user data
