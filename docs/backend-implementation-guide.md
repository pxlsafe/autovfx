# Backend Implementation Guide for AutoVFX Licensing

This guide explains how to implement the backend licensing system for AutoVFX, based on the Apstle Subscriptions integration architecture.

## Quick Start

1. **Set up your backend infrastructure** (Node.js + PostgreSQL + Redis recommended)
2. **Configure Apstle Subscriptions** and Shopify webhooks  
3. **Implement the API endpoints** listed below
4. **Configure the CEP extension** to point to your backend
5. **Test the complete flow** with test subscription purchases

## Required API Endpoints

Based on the license configuration in `config/config.json`, implement these endpoints:

### Authentication
- `POST /v1/auth` - Authenticate user (email/password or magic link)
- `GET /v1/me` - Get current user info with subscription and credits

### Credit Management  
- `GET /v1/credits` - Get current credit balance and cycle info
- `POST /v1/jobs` - Reserve credits for video generation
- `GET /v1/jobs/:taskId` - Get job status and credit usage

### Apstle/Shopify Integration
- `POST /v1/webhooks/shopify` - Handle Shopify webhooks (orders/paid, etc.)
- `POST /v1/portal-link` - Generate Apstle customer portal link
- `POST /v1/checkout/topup` - Generate Shopify checkout link for top-ups
- `POST /v1/checkout/subscription` - Generate Apstle subscription checkout link

## Database Schema

Implement the database schema from `license_README.md`:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    shopify_customer_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table  
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    apstle_contract_id TEXT UNIQUE NOT NULL,
    selling_plan_id TEXT NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit ledger (append-only)
CREATE TABLE credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    delta INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    reason TEXT,
    ext_ref JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit balance (cached)
CREATE TABLE credit_balance (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job reservations
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    task_id TEXT NOT NULL,
    reserved_credits INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery tracking
CREATE TABLE webhook_deliveries (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Sample Implementation (Node.js + Express)

### 1. Project Setup

```bash
mkdir autovfx-backend
cd autovfx-backend
npm init -y

# Core dependencies
npm install express cors helmet morgan
npm install pg redis jsonwebtoken bcrypt
npm install @lemonsqueezy/lemonsqueezy.js
npm install nodemailer uuid crypto

# Development dependencies  
npm install --save-dev nodemon dotenv
```

### 2. Main Server (server.js)

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const creditRoutes = require('./routes/credits');
const jobRoutes = require('./routes/jobs');
const webhookRoutes = require('./routes/webhooks');
const portalRoutes = require('./routes/portal');

const app = express();

// Security & middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));
app.use(morgan('combined'));

// Body parsing
app.use('/v1/webhooks', express.raw({ type: 'application/json' })); // Raw body for webhooks
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/credits', creditRoutes);
app.use('/v1/jobs', jobRoutes);
app.use('/v1/webhooks', webhookRoutes);
app.use('/v1/portal-link', portalRoutes);
app.use('/v1/checkout', portalRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 AutoVFX Licensing API running on port ${PORT}`);
});
```

### 3. Authentication Route (routes/auth.js)

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../lib/database');
const sendMagicLink = require('../lib/email');

const router = express.Router();

// POST /v1/auth - Authenticate user
router.post('/', async (req, res) => {
    try {
        const { email, password, magicLink } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Find or create user
        let user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (user.rows.length === 0) {
            // Create new user
            user = await db.query(
                'INSERT INTO users (email) VALUES ($1) RETURNING *',
                [email]
            );
        }
        
        user = user.rows[0];

        if (magicLink) {
            // Send magic link
            await sendMagicLink(email);
            return res.json({ message: 'Magic link sent to your email' });
        }

        if (password) {
            // Password authentication (implement your password logic)
            // For demo, we'll just create a token
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

module.exports = router;
```

### 4. Credits Route (routes/credits.js)

```javascript
const express = require('express');
const db = require('../lib/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /v1/credits - Get current balance and cycle
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get current balance
        const balanceResult = await db.query(
            'SELECT balance FROM credit_balance WHERE user_id = $1',
            [userId]
        );

        // Get current subscription cycle
        const subscriptionResult = await db.query(`
            SELECT current_period_start, current_period_end 
            FROM subscriptions 
            WHERE user_id = $1 AND status = 'active'
            ORDER BY created_at DESC 
            LIMIT 1
        `, [userId]);

        const balance = balanceResult.rows[0]?.balance || 0;
        const cycle = subscriptionResult.rows[0] || null;

        res.json({
            balance,
            cycle: cycle ? {
                start: cycle.current_period_start,
                end: cycle.current_period_end
            } : null
        });

    } catch (error) {
        console.error('Credits error:', error);
        res.status(500).json({ error: 'Failed to get credits' });
    }
});

module.exports = router;
```

### 5. Jobs Route (routes/jobs.js)

```javascript
const express = require('express');
const db = require('../lib/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /v1/jobs - Reserve credits for generation
router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { requestedSeconds } = req.body;

        if (!requestedSeconds || requestedSeconds <= 0) {
            return res.status(400).json({ error: 'Valid requestedSeconds required' });
        }

        // Calculate credits needed (1 credit = 5 seconds)
        const creditsNeeded = Math.ceil(requestedSeconds / 5);

        // Start transaction
        await db.query('BEGIN');

        try {
            // Lock user's balance
            const balanceResult = await db.query(
                'SELECT balance FROM credit_balance WHERE user_id = $1 FOR UPDATE',
                [userId]
            );

            const currentBalance = balanceResult.rows[0]?.balance || 0;

            if (currentBalance < creditsNeeded) {
                await db.query('ROLLBACK');
                return res.status(402).json({
                    error: 'INSUFFICIENT_CREDITS',
                    needed: creditsNeeded,
                    current: currentBalance
                });
            }

            // Create task ID
            const taskId = `task_${Date.now()}_${userId}`;

            // Debit credits
            await db.query(`
                INSERT INTO credit_ledger (user_id, delta, event_type, reason, ext_ref)
                VALUES ($1, $2, 'DEBIT_JOB_RESERVE', 'Video generation', $3)
            `, [userId, -creditsNeeded, { taskId, requestedSeconds }]);

            // Update balance
            await db.query(`
                UPDATE credit_balance 
                SET balance = balance - $1, updated_at = NOW()
                WHERE user_id = $2
            `, [creditsNeeded, userId]);

            // Create reservation
            await db.query(`
                INSERT INTO reservations (user_id, task_id, reserved_credits)
                VALUES ($1, $2, $3)
            `, [userId, taskId, creditsNeeded]);

            await db.query('COMMIT');

            res.json({
                taskId,
                reservedCredits: creditsNeeded
            });

        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Job reservation error:', error);
        res.status(500).json({ error: 'Failed to reserve credits' });
    }
});

// GET /v1/jobs/:taskId - Get job status
router.get('/:taskId', requireAuth, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.userId;

        const reservation = await db.query(`
            SELECT * FROM reservations 
            WHERE task_id = $1 AND user_id = $2
        `, [taskId, userId]);

        if (reservation.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // TODO: Implement actual job status checking with Runway API
        // For now, return the reservation status
        const job = reservation.rows[0];

        res.json({
            taskId,
            status: job.status,
            reservedCredits: job.reserved_credits
            // Add actualSeconds, usedCredits, refundCredits when job completes
        });

    } catch (error) {
        console.error('Job status error:', error);
        res.status(500).json({ error: 'Failed to get job status' });
    }
});

module.exports = router;
```

### 6. LemonSqueezy Webhooks (routes/webhooks.js)

```javascript
const express = require('express');
const crypto = require('crypto');
const db = require('../lib/database');

const router = express.Router();

// Verify LemonSqueezy webhook signature
function verifySignature(body, signature) {
    const secret = process.env.LEMON_SIGNING_SECRET;
    const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    
    return `sha256=${computedSignature}` === signature;
}

// POST /v1/webhooks/shopify
router.post('/shopify', async (req, res) => {
    try {
        const signature = req.headers['x-signature'];
        const body = req.body;

        // Verify Shopify webhook signature
        if (!verifyShopifySignature(body, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const event = JSON.parse(body.toString());
        const eventId = event.id;

        // Check if already processed
        const existing = await db.query(
            'SELECT id FROM webhook_deliveries WHERE id = $1',
            [eventId]
        );

        if (existing.rows.length > 0) {
            return res.status(200).json({ message: 'Already processed' });
        }

        // Mark as processing
        await db.query(`
            INSERT INTO webhook_deliveries (id, event_type, status)
            VALUES ($1, $2, 'processing')
        `, [eventId, req.headers['x-shopify-topic']]);

        // Process the event based on webhook topic
        switch (req.headers['x-shopify-topic']) {
            case 'orders/paid':
                await handleOrderPaid(event);
                break;

            case 'orders/create':
                await handleOrderCreate(event);
                break;

            // Add other webhook handlers as needed
            default:
                console.log('Unhandled webhook event:', req.headers['x-shopify-topic']);
        }

        // Mark as processed
        await db.query(`
            UPDATE webhook_deliveries 
            SET status = 'processed', processed_at = NOW()
            WHERE id = $1
        `, [eventId]);

        res.status(200).json({ message: 'Processed' });

    } catch (error) {
        console.error('Webhook error:', error);
        
        // Mark as failed
        if (eventId) {
            await db.query(`
                UPDATE webhook_deliveries 
                SET status = 'failed', error_message = $1
                WHERE id = $2
            `, [error.message, eventId]);
        }

        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

async function handleOrderPaid(orderData) {
    // Find user by customer ID
    const userResult = await db.query(
        'SELECT id FROM users WHERE shopify_customer_id = $1',
        [orderData.customer.id.toString()]
    );

    if (userResult.rows.length === 0) {
        throw new Error('User not found for customer ID');
    }

    const userId = userResult.rows[0].id;

    // Check if this is a subscription order or top-up order
    const isSubscriptionOrder = orderData.line_items.some(item => 
        item.selling_plan_allocation !== null
    );
    
    const isTopupOrder = orderData.line_items.some(item => 
        process.env.TOPUP_SKU_1000 === item.sku || 
        process.env.TOPUP_SKU_2000 === item.sku
    );

    if (isSubscriptionOrder) {
        // Handle subscription renewal - reset credits
        const sellingPlanId = orderData.line_items.find(item => 
            item.selling_plan_allocation !== null
        ).selling_plan_allocation.selling_plan.id;

        // Determine credits based on selling plan
        const sellingPlanCredits = {
            [process.env.SELLING_PLAN_TIER1]: 1000,
            [process.env.SELLING_PLAN_TIER2]: 2500,
            [process.env.SELLING_PLAN_TIER3]: 8000,
        };

        const credits = sellingPlanCredits[sellingPlanId.toString()] || 1000;

    await db.query('BEGIN');

    try {
        // Upsert subscription
        await db.query(`
            INSERT INTO subscriptions (
                user_id, ls_subscription_id, ls_variant_id,
                current_period_start, current_period_end, status
            ) VALUES ($1, $2, $3, $4, $5, 'active')
            ON CONFLICT (ls_subscription_id) DO UPDATE SET
                current_period_start = $4,
                current_period_end = $5,
                status = 'active',
                updated_at = NOW()
        `, [
            userId,
            subscriptionData.id,
            subscriptionData.attributes.variant_id,
            subscriptionData.attributes.current_period_start,
            subscriptionData.attributes.current_period_end
        ]);

        // Add base credits
        await db.query(`
            INSERT INTO credit_ledger (user_id, delta, event_type, reason, ext_ref)
            VALUES ($1, $2, 'CREDIT_BASE_RESET', 'Monthly subscription reset', $3)
        `, [userId, credits, { subscriptionId: subscriptionData.id }]);

        // Update balance
        await db.query(`
            INSERT INTO credit_balance (user_id, balance)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET
                balance = $2,
                updated_at = NOW()
        `, [userId, credits]);

        await db.query('COMMIT');

    } catch (error) {
        await db.query('ROLLBACK');
        throw error;
    }
}

async function handleOrderCreated(orderData) {
    // Handle top-up purchases
    // Implementation similar to subscription handler
    // Check order items for top-up products and add credits accordingly
}

module.exports = router;
```

## Configuration Steps

### 1. Update CEP Extension Config

Update your `config/config.json` to point to your backend:

```json
{
  "licensing": {
    "enabled": true,
    "backend": {
      "baseUrl": "https://your-backend-api.com/v1",
      "endpoints": {
        "auth": "/auth",
        "me": "/me",
        "credits": "/credits",
        "jobs": "/jobs",
        "webhooks": "/webhooks/lemonsqueezy",
        "portal": "/portal-link",
        "checkout": "/checkout/topup"
      }
    }
  }
}
```

### 2. Configure LemonSqueezy

1. **Create Products:**
   - Main subscription product with 3 variants (Tier 1, 2, 3)
   - Two top-up products (1000 credits, 2000 credits)

2. **Set up Webhooks:**
   - Point to `https://your-backend-api.com/v1/webhooks/lemonsqueezy`
   - Subscribe to: `subscription_payment_success`, `order_created`, etc.

3. **Get IDs:**
   - Store all product/variant IDs in your environment variables

### 3. Deploy Backend

Deploy your backend to a service like:
- **Vercel/Netlify** (for serverless)
- **Railway/Render** (for full-stack apps)  
- **AWS/Google Cloud** (for enterprise)

Make sure to:
- Set all environment variables
- Configure database and Redis
- Test webhook endpoints
- Enable HTTPS

## Testing

1. **Test Authentication:**
   ```bash
   curl -X POST https://your-api.com/v1/auth \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

2. **Test Credit Check:**
   ```bash
   curl https://your-api.com/v1/credits \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. **Test Credit Reservation:**
   ```bash
   curl -X POST https://your-api.com/v1/jobs \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"requestedSeconds": 10}'
   ```

4. **Test Webhooks:**
   Use LemonSqueezy's webhook testing tools or ngrok for local testing.

## Security Considerations

1. **Always verify webhook signatures**
2. **Use HTTPS everywhere**
3. **Implement rate limiting**
4. **Validate all input data**
5. **Use transactions for credit operations**
6. **Store sensitive data in environment variables**
7. **Implement proper error handling**

## Monitoring

Consider adding:
- **Logging** (structured logs with request IDs)
- **Error tracking** (Sentry, Bugsnag)
- **Metrics** (Datadog, New Relic)
- **Health checks** (for uptime monitoring)
- **Database monitoring** (connection pools, query performance)

This implementation provides a solid foundation for the AutoVFX licensing system. Customize it based on your specific requirements and infrastructure preferences. 