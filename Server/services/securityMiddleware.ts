// securityMiddleware.ts - Security utilities and middleware for API protection

import { Request, Response, NextFunction } from 'express';

/**
 * Security Configuration
 * NOTE: Rate limits for images and chats will be controlled by admin accounts in the future
 * These are temporary defaults and can be overridden or disabled
 */
export const SECURITY_CONFIG = {
  // Rate limiting (temporary - will be admin-controlled)
  MAX_REQUESTS_PER_MINUTE: 1000, // Increased from 60 - will be admin-controlled
  MAX_IMAGE_REQUESTS_PER_HOUR: 1000, // Increased from 20 - will be admin-controlled
  ENABLE_RATE_LIMITING: false, // Disabled by default - will be admin-controlled
  MAX_CHAT_LENGTH: 50000, // characters
  MAX_PROMPT_LENGTH: 10000,
  
  // Input validation
  ALLOWED_USER_ID_PATTERN: /^[a-zA-Z0-9_-]{1,128}$/,
  ALLOWED_CHAT_ID_PATTERN: /^[a-zA-Z0-9_-]{1,128}$/,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  
  // Sensitive patterns to block
  SENSITIVE_PATTERNS: [
    /serviceAccountKey/i,
    /private.*key/i,
    /api.*key/i,
    /secret/i,
    /password/i,
    /token/i
  ]
};

/**
 * Rate limiting store
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private imageRequests: Map<string, { count: number; resetTime: number }> = new Map();

  checkRateLimit(userId: string, type: 'general' | 'image' = 'general'): boolean {
    // Rate limiting disabled - will be controlled by admin accounts
    if (!SECURITY_CONFIG.ENABLE_RATE_LIMITING) {
      return true;
    }
    
    const now = Date.now();
    const store = type === 'image' ? this.imageRequests : this.requests;
    const limit = type === 'image' ? SECURITY_CONFIG.MAX_IMAGE_REQUESTS_PER_HOUR : SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE;
    const window = type === 'image' ? 60 * 60 * 1000 : 60 * 1000;

    const userRecord = store.get(userId);

    if (!userRecord || now > userRecord.resetTime) {
      // Create new window
      store.set(userId, { count: 1, resetTime: now + window });
      return true;
    }

    if (userRecord.count >= limit) {
      return false; // Rate limit exceeded
    }

    userRecord.count++;
    return true;
  }

  getRemainingRequests(userId: string, type: 'general' | 'image' = 'general'): number {
    const store = type === 'image' ? this.imageRequests : this.requests;
    const limit = type === 'image' ? SECURITY_CONFIG.MAX_IMAGE_REQUESTS_PER_HOUR : SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE;
    const userRecord = store.get(userId);
    
    if (!userRecord || Date.now() > userRecord.resetTime) {
      return limit;
    }
    
    return Math.max(0, limit - userRecord.count);
  }

  // Cleanup old entries periodically
  cleanup(): void {
    const now = Date.now();
    
    for (const [userId, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(userId);
      }
    }
    
    for (const [userId, record] of this.imageRequests.entries()) {
      if (now > record.resetTime) {
        this.imageRequests.delete(userId);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Cleanup every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

/**
 * Input Validation Utilities
 */
export class SecurityValidator {
  /**
   * Validate userId format
   */
  static validateUserId(userId: string): { valid: boolean; error?: string } {
    if (!userId || typeof userId !== 'string') {
      return { valid: false, error: 'userId must be a non-empty string' };
    }

    if (!SECURITY_CONFIG.ALLOWED_USER_ID_PATTERN.test(userId)) {
      return { valid: false, error: 'userId contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Validate chatId format
   */
  static validateChatId(chatId: string): { valid: boolean; error?: string } {
    if (!chatId || typeof chatId !== 'string') {
      return { valid: false, error: 'chatId must be a non-empty string' };
    }

    if (!SECURITY_CONFIG.ALLOWED_CHAT_ID_PATTERN.test(chatId)) {
      return { valid: false, error: 'chatId contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Validate prompt length
   */
  static validatePrompt(prompt: string): { valid: boolean; error?: string } {
    if (!prompt || typeof prompt !== 'string') {
      return { valid: false, error: 'prompt must be a non-empty string' };
    }

    if (prompt.length > SECURITY_CONFIG.MAX_PROMPT_LENGTH) {
      return { valid: false, error: `prompt exceeds maximum length of ${SECURITY_CONFIG.MAX_PROMPT_LENGTH} characters` };
    }

    // Check for sensitive patterns
    for (const pattern of SECURITY_CONFIG.SENSITIVE_PATTERNS) {
      if (pattern.test(prompt)) {
        console.warn(`⚠️ Blocked prompt containing sensitive pattern: ${pattern}`);
        return { valid: false, error: 'prompt contains potentially sensitive information' };
      }
    }

    return { valid: true };
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    // Remove potential script tags and dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  }

  /**
   * Validate base64 image data
   */
  static validateBase64Image(base64: string): { valid: boolean; error?: string } {
    if (!base64 || typeof base64 !== 'string') {
      return { valid: false, error: 'base64 data must be a non-empty string' };
    }

    // Check if it's valid base64
    const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
    if (!base64Pattern.test(base64)) {
      return { valid: false, error: 'invalid base64 format' };
    }

    // Estimate size (base64 is ~4/3 of original size)
    const estimatedSize = (base64.length * 3) / 4;
    if (estimatedSize > SECURITY_CONFIG.MAX_FILE_SIZE) {
      return { valid: false, error: `image size exceeds maximum of ${SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB` };
    }

    return { valid: true };
  }

  /**
   * Validate array of chatIds
   */
  static validateChatIds(chatIds: any): { valid: boolean; error?: string } {
    if (!Array.isArray(chatIds)) {
      return { valid: false, error: 'chatIds must be an array' };
    }

    if (chatIds.length === 0) {
      return { valid: false, error: 'chatIds array cannot be empty' };
    }

    if (chatIds.length > 100) {
      return { valid: false, error: 'too many chatIds (max 100)' };
    }

    for (const chatId of chatIds) {
      const validation = this.validateChatId(chatId);
      if (!validation.valid) {
        return { valid: false, error: `invalid chatId in array: ${validation.error}` };
      }
    }

    return { valid: true };
  }
}

/**
 * Middleware: Rate limiting
 */
export function rateLimitMiddleware(type: 'general' | 'image' = 'general') {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.body?.userId || req.query?.userId || req.params?.userId || 'anonymous';

    if (!rateLimiter.checkRateLimit(userId as string, type)) {
      const remaining = rateLimiter.getRemainingRequests(userId as string, type);
      const limit = type === 'image' 
        ? SECURITY_CONFIG.MAX_IMAGE_REQUESTS_PER_HOUR 
        : SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE;

      console.warn(`⚠️ Rate limit exceeded for user ${userId} (type: ${type})`);
      
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        details: {
          limit,
          remaining,
          type: type === 'image' ? 'per hour' : 'per minute'
        }
      });
    }

    next();
  };
}

/**
 * Middleware: Validate userId
 */
export function validateUserIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.body?.userId || req.query?.userId || req.params?.userId;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required'
    });
  }

  const validation = SecurityValidator.validateUserId(userId as string);
  if (!validation.valid) {
    console.warn(`⚠️ Invalid userId: ${userId}`);
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }

  next();
}

/**
 * Middleware: Sanitize request body
 */
export function sanitizeBodyMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    // Sanitize string fields
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = SecurityValidator.sanitizeInput(req.body[key]);
      }
    }
  }

  next();
}

/**
 * Security Headers Middleware
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection (legacy but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  );

  next();
}

/**
 * Log security events
 */
export function logSecurityEvent(event: string, details: any): void {
  console.log(`🔒 [SECURITY] ${event}:`, JSON.stringify(details, null, 2));
}
