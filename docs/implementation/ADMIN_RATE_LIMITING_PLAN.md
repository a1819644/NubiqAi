# 🎛️ Admin-Controlled Rate Limiting System

## Current Status

Rate limiting is currently **DISABLED** to allow full functionality during development. The hardcoded limits have been removed and replaced with:

- `ENABLE_RATE_LIMITING: false` - Rate limiting is turned off
- `MAX_IMAGE_REQUESTS_PER_HOUR: 1000` - High default (effectively unlimited)
- `MAX_REQUESTS_PER_MINUTE: 1000` - High default (effectively unlimited)

## Future Implementation Plan

### Overview
Instead of hardcoded rate limits, implement a flexible admin dashboard system where administrators can:
- Set per-user rate limits
- Define tier-based limits (free, pro, enterprise)
- Monitor usage in real-time
- Adjust limits dynamically without code changes

### Database Schema (Future)

```typescript
// User tier configuration
interface UserTier {
  userId: string;
  tier: 'free' | 'pro' | 'enterprise' | 'custom';
  limits: {
    imagesPerHour: number;
    imagesPerDay: number;
    chatsPerDay: number;
    apiRequestsPerMinute: number;
    maxChatLength: number;
    maxMemoryStorage: number; // MB
  };
  features: {
    imageGeneration: boolean;
    imageEditing: boolean;
    documentProcessing: boolean;
    prioritySupport: boolean;
    customModels: boolean;
  };
  validUntil?: Date; // For subscription expiry
}

// Example tier presets
const TIER_PRESETS = {
  free: {
    imagesPerHour: 10,
    imagesPerDay: 50,
    chatsPerDay: 100,
    apiRequestsPerMinute: 20,
    maxChatLength: 10000,
    maxMemoryStorage: 100 // MB
  },
  pro: {
    imagesPerHour: 50,
    imagesPerDay: 500,
    chatsPerDay: 1000,
    apiRequestsPerMinute: 100,
    maxChatLength: 50000,
    maxMemoryStorage: 1000 // 1GB
  },
  enterprise: {
    imagesPerHour: -1, // unlimited
    imagesPerDay: -1,
    chatsPerDay: -1,
    apiRequestsPerMinute: 500,
    maxChatLength: 100000,
    maxMemoryStorage: 10000 // 10GB
  }
};
```

### Implementation Steps

#### Phase 1: Database Setup (Firestore)
```typescript
// Server/services/userTierService.ts

import { getFirestore } from 'firebase-admin/firestore';

export class UserTierService {
  private db = getFirestore();
  
  async getUserTier(userId: string): Promise<UserTier> {
    const doc = await this.db.collection('userTiers').doc(userId).get();
    
    if (!doc.exists) {
      // Return default free tier
      return {
        userId,
        tier: 'free',
        limits: TIER_PRESETS.free,
        features: {
          imageGeneration: true,
          imageEditing: false,
          documentProcessing: true,
          prioritySupport: false,
          customModels: false
        }
      };
    }
    
    return doc.data() as UserTier;
  }
  
  async setUserTier(userId: string, tier: UserTier): Promise<void> {
    await this.db.collection('userTiers').doc(userId).set(tier);
  }
  
  async updateUserLimits(userId: string, limits: Partial<UserTier['limits']>): Promise<void> {
    await this.db.collection('userTiers').doc(userId).update({ limits });
  }
}
```

#### Phase 2: Enhanced Rate Limiter
```typescript
// Server/services/advancedRateLimiter.ts

import { UserTierService } from './userTierService';

export class AdvancedRateLimiter {
  private tierService = new UserTierService();
  private usageCache = new Map<string, UserUsage>();
  
  async checkLimit(userId: string, action: 'image' | 'api' | 'chat'): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    tier: string;
  }> {
    // Get user's tier and limits
    const userTier = await this.tierService.getUserTier(userId);
    
    // Get current usage from cache or database
    const usage = await this.getUserUsage(userId);
    
    // Check specific limit based on action
    switch (action) {
      case 'image':
        const imageLimit = userTier.limits.imagesPerHour;
        if (imageLimit === -1) return { allowed: true, remaining: -1, resetTime: 0, tier: userTier.tier };
        
        const hourlyImages = usage.imagesLastHour || 0;
        if (hourlyImages >= imageLimit) {
          return { 
            allowed: false, 
            remaining: 0, 
            resetTime: this.getNextHourReset(),
            tier: userTier.tier
          };
        }
        
        // Increment usage
        await this.incrementUsage(userId, 'imagesLastHour');
        return { 
          allowed: true, 
          remaining: imageLimit - hourlyImages - 1,
          resetTime: this.getNextHourReset(),
          tier: userTier.tier
        };
        
      case 'api':
        const apiLimit = userTier.limits.apiRequestsPerMinute;
        const minuteRequests = usage.apiRequestsLastMinute || 0;
        
        if (minuteRequests >= apiLimit) {
          return { 
            allowed: false, 
            remaining: 0,
            resetTime: this.getNextMinuteReset(),
            tier: userTier.tier
          };
        }
        
        await this.incrementUsage(userId, 'apiRequestsLastMinute');
        return { 
          allowed: true, 
          remaining: apiLimit - minuteRequests - 1,
          resetTime: this.getNextMinuteReset(),
          tier: userTier.tier
        };
        
      // ... similar for 'chat'
    }
  }
  
  private async getUserUsage(userId: string): Promise<UserUsage> {
    // Check cache first
    if (this.usageCache.has(userId)) {
      return this.usageCache.get(userId)!;
    }
    
    // Load from Firestore
    const db = getFirestore();
    const doc = await db.collection('userUsage').doc(userId).get();
    const usage = doc.exists ? doc.data() as UserUsage : this.getDefaultUsage();
    
    this.usageCache.set(userId, usage);
    return usage;
  }
  
  private async incrementUsage(userId: string, field: keyof UserUsage): Promise<void> {
    // Update cache
    const usage = this.usageCache.get(userId) || this.getDefaultUsage();
    usage[field] = (usage[field] || 0) + 1;
    this.usageCache.set(userId, usage);
    
    // Update Firestore (batch for efficiency)
    const db = getFirestore();
    await db.collection('userUsage').doc(userId).set({ [field]: usage[field] }, { merge: true });
  }
  
  private getNextHourReset(): number {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    return next.getTime();
  }
  
  private getNextMinuteReset(): number {
    const now = Date.now();
    return now + (60000 - (now % 60000));
  }
}
```

#### Phase 3: Admin Dashboard API
```typescript
// Server/index.ts - Admin endpoints

/**
 * Admin: Get all users with their tiers and usage
 * Requires admin authentication
 */
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  const tierService = new UserTierService();
  const users = await tierService.getAllUsers();
  res.json({ success: true, users });
});

/**
 * Admin: Update user tier
 */
app.post('/api/admin/users/:userId/tier', authenticateAdmin, async (req, res) => {
  const { userId } = req.params;
  const { tier, customLimits } = req.body;
  
  const tierService = new UserTierService();
  
  if (tier === 'custom' && customLimits) {
    await tierService.setUserTier(userId, {
      userId,
      tier: 'custom',
      limits: customLimits,
      features: req.body.features
    });
  } else {
    await tierService.setUserTier(userId, {
      userId,
      tier,
      limits: TIER_PRESETS[tier],
      features: getDefaultFeatures(tier)
    });
  }
  
  res.json({ success: true, message: 'User tier updated' });
});

/**
 * Admin: Get real-time usage statistics
 */
app.get('/api/admin/usage/realtime', authenticateAdmin, async (req, res) => {
  const usageService = new UsageAnalyticsService();
  const stats = await usageService.getRealtimeStats();
  
  res.json({
    success: true,
    stats: {
      activeUsers: stats.activeUsers,
      imagesGeneratedToday: stats.imagesGeneratedToday,
      apiCallsLastHour: stats.apiCallsLastHour,
      storageUsed: stats.storageUsed,
      topUsers: stats.topUsers
    }
  });
});
```

#### Phase 4: Frontend Admin Dashboard

```typescript
// src/components/AdminDashboard.tsx

export function AdminDashboard() {
  const [users, setUsers] = useState<UserTier[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserTier | null>(null);
  
  return (
    <div className="admin-dashboard">
      <h1>User Management</h1>
      
      {/* User list with tier badges */}
      <UserTable users={users} onSelect={setSelectedUser} />
      
      {/* Tier editor modal */}
      {selectedUser && (
        <TierEditorModal
          user={selectedUser}
          onSave={async (tier) => {
            await updateUserTier(selectedUser.userId, tier);
            // Refresh list
          }}
          onClose={() => setSelectedUser(null)}
        />
      )}
      
      {/* Real-time usage charts */}
      <UsageCharts />
      
      {/* Quick tier presets */}
      <TierPresets 
        onApply={(userId, preset) => applyPreset(userId, preset)}
      />
    </div>
  );
}

function TierEditorModal({ user, onSave, onClose }: Props) {
  const [limits, setLimits] = useState(user.limits);
  
  return (
    <Modal onClose={onClose}>
      <h2>Edit Limits for {user.userId}</h2>
      
      <label>
        Images per hour
        <input 
          type="number" 
          value={limits.imagesPerHour}
          onChange={(e) => setLimits({ ...limits, imagesPerHour: parseInt(e.target.value) })}
        />
      </label>
      
      <label>
        Images per day
        <input 
          type="number" 
          value={limits.imagesPerDay}
          onChange={(e) => setLimits({ ...limits, imagesPerDay: parseInt(e.target.value) })}
        />
      </label>
      
      <label>
        API requests per minute
        <input 
          type="number" 
          value={limits.apiRequestsPerMinute}
          onChange={(e) => setLimits({ ...limits, apiRequestsPerMinute: parseInt(e.target.value) })}
        />
      </label>
      
      {/* More limit controls... */}
      
      <button onClick={() => onSave({ ...user, limits })}>
        Save Changes
      </button>
    </Modal>
  );
}
```

### Migration Plan

#### Step 1: Enable for Development (Current)
- ✅ Rate limiting disabled
- ✅ High default limits (1000/hour)
- ✅ Full functionality available

#### Step 2: Create Database Schema
- [ ] Set up Firestore collections: `userTiers`, `userUsage`
- [ ] Define tier presets (free, pro, enterprise)
- [ ] Create migration script for existing users

#### Step 3: Implement Backend Services
- [ ] Create `UserTierService` for tier management
- [ ] Create `AdvancedRateLimiter` with database integration
- [ ] Add admin API endpoints for tier management
- [ ] Add usage tracking and analytics

#### Step 4: Build Admin Dashboard
- [ ] Create admin authentication
- [ ] Build user management UI
- [ ] Add tier editor component
- [ ] Implement usage analytics dashboard
- [ ] Add real-time monitoring

#### Step 5: Enable Rate Limiting
- [ ] Set `ENABLE_RATE_LIMITING: true` in config
- [ ] Assign default "free" tier to all existing users
- [ ] Test rate limiting with different tiers
- [ ] Monitor and adjust limits based on usage patterns

#### Step 6: Monetization (Optional)
- [ ] Integrate payment system (Stripe)
- [ ] Auto-upgrade on successful payment
- [ ] Handle subscription renewals
- [ ] Implement usage notifications (80%, 90%, 100%)

### Configuration Examples

#### Development Environment
```typescript
// .env.development
ENABLE_RATE_LIMITING=false
DEFAULT_TIER=enterprise
ADMIN_EMAILS=admin@example.com,dev@example.com
```

#### Production Environment
```typescript
// .env.production
ENABLE_RATE_LIMITING=true
DEFAULT_TIER=free
ADMIN_EMAILS=admin@nubiqai.com
STRIPE_API_KEY=sk_live_...
```

### Usage Notification System

```typescript
// Notify users when approaching limits
async function checkAndNotifyUsage(userId: string) {
  const tier = await tierService.getUserTier(userId);
  const usage = await usageService.getUserUsage(userId);
  
  const imageUsagePercent = (usage.imagesLastHour / tier.limits.imagesPerHour) * 100;
  
  if (imageUsagePercent >= 80 && imageUsagePercent < 90) {
    await sendNotification(userId, {
      type: 'warning',
      message: `You've used ${imageUsagePercent.toFixed(0)}% of your hourly image limit. Consider upgrading to Pro for more capacity!`
    });
  } else if (imageUsagePercent >= 100) {
    await sendNotification(userId, {
      type: 'error',
      message: `You've reached your hourly limit. Upgrade to continue generating images.`
    });
  }
}
```

### API Response Changes

When rate limit is reached, return detailed info:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "details": {
    "tier": "free",
    "limit": 10,
    "used": 10,
    "remaining": 0,
    "resetTime": 1640995200000,
    "upgradeUrl": "/upgrade"
  }
}
```

### Benefits of Admin-Controlled System

1. **Flexibility**: Change limits without deploying code
2. **Personalization**: Custom limits for VIP users
3. **Monetization**: Easy tier-based pricing
4. **Testing**: Quickly adjust limits to test user behavior
5. **Support**: Give temporary limit increases for support cases
6. **Analytics**: Track usage patterns to optimize limits
7. **Scalability**: Handle different user types (free, paid, enterprise)

---

**Current Status**: Rate limiting DISABLED, awaiting admin system implementation
**Next Step**: Design Firestore schema for userTiers and userUsage
**Timeline**: To be determined based on business requirements
**Priority**: Medium (not blocking development, but important for production)
