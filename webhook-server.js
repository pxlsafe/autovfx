require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
let pgPool = null;
const app = express();

// In-memory demo store (persisted to disk). Replace with DB in production.
const usersByEmail = new Map(); // email -> { balance, planId, planName, cycleEnd, shopifyCustomerId }
const tokens = new Map(); // token -> email (not persisted)
const processedWebhookIds = new Set();

// Simple JSON persistence
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
let saveTimer = null;

async function initDatabaseIfConfigured() {
    if (!process.env.DATABASE_URL) return false;
    try {
        const { Pool } = require('pg');
        pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                balance INTEGER NOT NULL DEFAULT 0,
                plan_id TEXT,
                plan_name TEXT,
                cycle_end TIMESTAMPTZ,
                shopify_customer_id TEXT
            );
        `);
        console.log('🗄️  Postgres connected');
        // Load users into memory cache
        const { rows } = await pgPool.query('SELECT email, balance, plan_id, plan_name, cycle_end, shopify_customer_id FROM users');
        rows.forEach(r => usersByEmail.set(r.email, {
            balance: r.balance,
            planId: r.plan_id || 'none',
            planName: r.plan_name || 'none',
            cycleEnd: r.cycle_end || null,
            shopifyCustomerId: r.shopify_customer_id || null
        }));
        console.log(`💾 Loaded ${rows.length} users from Postgres`);
        return true;
    } catch (e) {
        console.warn('⚠️  Failed to init Postgres:', e.message);
        pgPool = null;
        return false;
    }
}

function loadStoreFromDisk() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const json = JSON.parse(raw || '{}');
            const users = json.users || {};
            Object.keys(users).forEach(email => usersByEmail.set(email, users[email]));
            console.log(`💾 Loaded ${usersByEmail.size} users from disk`);
        } else {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
        }
    } catch (e) {
        console.warn('⚠️  Failed to load store.json:', e.message);
    }
}

function scheduleSave() {
    if (pgPool) {
        // Write-through: upsert all changed users individually would be ideal; for simplicity, upsert all current user
        // To keep it simple and safe, this helper will be used right after a single-user change.
        return; // no-op; use upsertUserToDb directly where changes happen
    }
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            const users = {};
            for (const [email, data] of usersByEmail.entries()) users[email] = data;
            fs.writeFileSync(DATA_FILE, JSON.stringify({ users }, null, 2));
        } catch (e) {
            console.warn('⚠️  Failed to save store.json:', e.message);
        }
    }, 250);
}
async function upsertUserToDb(email) {
    if (!pgPool) return;
    const u = usersByEmail.get(email);
    if (!u) return;
    try {
        await pgPool.query(`
            INSERT INTO users (email, balance, plan_id, plan_name, cycle_end, shopify_customer_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO UPDATE SET
                balance = EXCLUDED.balance,
                plan_id = EXCLUDED.plan_id,
                plan_name = EXCLUDED.plan_name,
                cycle_end = EXCLUDED.cycle_end,
                shopify_customer_id = EXCLUDED.shopify_customer_id;
        `, [email, u.balance || 0, u.planId || null, u.planName || null, u.cycleEnd || null, u.shopifyCustomerId || null]);
    } catch (e) {
        console.warn('⚠️  Failed to upsert user:', email, e.message);
    }
}

(async () => {
    const usingDb = await initDatabaseIfConfigured();
    if (!usingDb) loadStoreFromDisk();
})();

// Middleware to capture raw body for webhook verification
app.use('/v1/webhooks/shopify', express.raw({ type: 'application/json' }));
app.use(express.json());

// Basic rate limiting (per IP)
const rateMap = new Map();
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const MAX_REQ = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);
app.use((req, res, next) => {
    const now = Date.now();
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'local';
    let entry = rateMap.get(ip) || { count: 0, reset: now + WINDOW_MS };
    if (now > entry.reset) entry = { count: 0, reset: now + WINDOW_MS };
    entry.count += 1;
    rateMap.set(ip, entry);
    if (entry.count > MAX_REQ) return res.status(429).json({ error: 'Too many requests' });
    next();
});

// CORS: allow all origins for CEP compatibility (panels use file:// or no origin)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, ngrok-skip-browser-warning');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Test endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'AutoVFX Webhook Server Running',
        timestamp: new Date().toISOString()
    });
});

// Shopify webhook handler
app.post('/v1/webhooks/shopify', (req, res) => {
    const topic = req.headers['x-shopify-topic'];
    const signature = req.headers['x-shopify-hmac-sha256'];
    const webhookId = req.headers['x-shopify-webhook-id'];
    const shop = req.headers['x-shopify-shop-domain'];
    
    console.log('\n🔔 WEBHOOK RECEIVED:');
    console.log(`📋 Topic: ${topic}`);
    console.log(`🏪 Shop: ${shop}`);
    console.log(`🔐 Signature: ${signature ? 'Present' : 'Missing'}`);
    console.log(`📦 Body size: ${req.body.length} bytes`);

    // Idempotency
    if (webhookId && processedWebhookIds.has(webhookId)) {
        console.log('🟡 Duplicate webhook ignored:', webhookId);
        return res.status(200).json({ duplicate: true });
    }

    // Verify HMAC if secret provided
    try {
        if (process.env.SHOPIFY_WEBHOOK_SECRET) {
            const hmac = crypto
                .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
                .update(req.body, 'utf8')
                .digest('base64');
            if (hmac !== signature) {
                console.log('❌ HMAC verification failed');
                return res.status(401).send('Invalid signature');
            }
        } else {
            console.log('ℹ️ No SHOPIFY_WEBHOOK_SECRET set; skipping HMAC check (dev mode).');
        }
    } catch (e) {
        console.log('❌ HMAC verification error:', e.message);
        return res.status(400).send('Bad request');
    }
    
    try {
        const order = JSON.parse(req.body);
        console.log(`\n📄 Order Details:`);
        console.log(`- Order ID: ${order.id}`);
        console.log(`- Customer: ${order.customer?.email || 'No customer'}`);
        console.log(`- Total: ${order.total_price} ${order.currency}`);
        console.log(`- Items: ${order.line_items?.length || 0}`);
        
        // Check for subscription items
        const subscriptionItems = order.line_items?.filter(item => 
            item.selling_plan_allocation !== null
        ) || [];
        
        // Check for top-up items
        const topupItems = order.line_items?.filter(item => 
            item.sku && (item.sku.includes('TOPUP') || item.sku.includes('CREDIT'))
        ) || [];
        
        // Check for AutoVFX subscription items (temporary detection)
        const autovfxItems = order.line_items?.filter(item => 
            item.sku && item.sku.includes('AUTOVFX')
        ) || [];
        
        if (subscriptionItems.length > 0) {
            console.log(`\n🔄 SUBSCRIPTION ITEMS FOUND:`);
            subscriptionItems.forEach(item => {
                console.log(`- ${item.title}`);
                console.log(`  Selling Plan ID: ${item.selling_plan_allocation?.selling_plan?.id}`);
                console.log(`  Price: ${item.price}`);
            });

            // Minimal credit grant by selling plan
            const email = order.customer?.email;
            const customerId = String(order.customer?.id || '');
            const planId = String(subscriptionItems[0]?.selling_plan_allocation?.selling_plan?.id || '');
            // Runway pricing: 15 credits per second
            // $10 = 40 videos x 5sec = 200sec = 3000 credits
            // $25 = 100 videos x 5sec = 500sec = 7500 credits  
            // $80 = 320 videos x 5sec = 1600sec = 24000 credits
            const planCredits = {
                [process.env.SELLING_PLAN_TIER1 || '690384601430']: 3000,  // $49 plan → $10 runway cost
                [process.env.SELLING_PLAN_TIER2 || '690385518934']: 7500,  // $79 plan → $25 runway cost
                [process.env.SELLING_PLAN_TIER3 || '690385551702']: 24000, // $199 plan → $80 runway cost
            };
            const credits = planCredits[planId] || 1000;
            if (email) {
                const prev = usersByEmail.get(email) || {
                    balance: 0,
                    planId: planId,
                    planName: planId,
                    cycleEnd: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
                    shopifyCustomerId: customerId
                };
                const cycleEnd = new Date(Date.now() + 30*24*60*60*1000).toISOString();
                usersByEmail.set(email, {
                    balance: (prev.balance || 0) + credits,
                    planId,
                    planName: planId,
                    cycleEnd,
                    shopifyCustomerId: customerId
                });
                console.log(`💰 Granted ${credits} credits to ${email} (plan ${planId}). New balance: ${usersByEmail.get(email).balance}`);
                if (pgPool) upsertUserToDb(email); else scheduleSave();
            }
        }
        
        if (topupItems.length > 0) {
            console.log(`\n💰 TOP-UP ITEMS FOUND:`);
            topupItems.forEach(item => {
                console.log(`- ${item.title}`);
                console.log(`  SKU: ${item.sku}`);
                console.log(`  Price: ${item.price}`);
            });
        }
        
        if (autovfxItems.length > 0) {
            console.log(`\n🎯 AUTOVFX SUBSCRIPTION ITEMS:`);
            autovfxItems.forEach(item => {
                console.log(`- ${item.title}`);
                console.log(`  SKU: ${item.sku}`);
                console.log(`  Price: ${item.price}`);
            });
            
            // TODO: In production, this would create user and grant credits
            console.log(`\n📧 WOULD CREATE USER:`);
            console.log(`- Email: ${order.customer?.email}`);
            console.log(`- Shopify ID: ${order.customer?.id}`);
            console.log(`- Credits: ${getCreditsForSku(autovfxItems[0].sku)}`);
        }
        
        if (subscriptionItems.length === 0 && topupItems.length === 0 && autovfxItems.length === 0) {
            console.log(`\n ℹ️  No subscription or top-up items found`);
        }
        
    } catch (error) {
        console.error('❌ Error parsing webhook body:', error.message);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    if (webhookId) processedWebhookIds.add(webhookId);
    res.status(200).json({ 
        received: true, 
        topic: topic,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Helper function to get credits for SKU
function getCreditsForSku(sku) {
    const skuCredits = {
        'AUTOVFX-CREATOR': 1000,
        'AUTOVFX-STUDIO': 2500, 
        'AUTOVFX-PRO': 8000
    };
    return skuCredits[sku] || 1000;
}

// --- Minimal auth + credit endpoints for the panel ---
app.use(express.json());

// Minimal JWT (HS256)
function base64url(input) {
    return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signToken(payload, expiresInSec = 7 * 24 * 3600) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const body = { ...payload, exp };
    const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev-secret').update(unsigned).digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${unsigned}.${sig}`;
}
function verifyToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev-secret').update(`${h}.${p}`).digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (s !== expected) return null;
    try {
        const payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
        return payload;
    } catch (_) {
        return null;
    }
}

// POST /v1/auth { email }
app.post('/v1/auth', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email required', message: 'Email required' });

    let user = usersByEmail.get(email);

    // Auto-create user on first sign-in with zero credits (activates after purchase)
    if (!user) {
        user = {
            balance: 0,
            planId: 'none',
            planName: 'none',
            cycleEnd: null,
            shopifyCustomerId: null
        };
        usersByEmail.set(email, user);
        console.log(`👤 Created new user record for ${email} (0 credits, pending subscription).`);
        if (pgPool) upsertUserToDb(email); else scheduleSave();
    }

    const expires = Number((process.env.JWT_EXPIRES_IN || '').replace('d', '')) || 7;
    const token = signToken({ email }, expires * 24 * 3600);

    return res.json({
        token,
        user: { email },
        subscription: { status: user.planId === 'none' ? 'none' : 'active', selling_plan_id: user.planId },
        balance: user.balance,
        cycle: { end: user.cycleEnd },
        needsSubscription: user.planId === 'none'
    });
});

function requireAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = verifyToken(token);
    if (!payload?.email) return res.status(401).json({ error: 'Unauthorized' });
    req.email = String(payload.email).toLowerCase();
    next();
}

// GET /v1/me
app.get('/v1/me', requireAuth, (req, res) => {
    const user = usersByEmail.get(req.email) || { balance: 0 };
    res.json({ user: { email: req.email }, balance: user.balance, subscription: { status: 'active', selling_plan_id: user.planId }, cycle: { end: user.cycleEnd } });
});

// GET /v1/credits
app.get('/v1/credits', requireAuth, async (req, res) => {
    try {
        let user = usersByEmail.get(req.email) || { balance: 0 };
        
        // If Postgres is available, get fresh data
        if (pgPool) {
            const result = await pgPool.query('SELECT balance, cycle_end FROM users WHERE email = $1', [req.email]);
            if (result.rows.length > 0) {
                const dbUser = result.rows[0];
                user = { balance: dbUser.balance || 0, cycleEnd: dbUser.cycle_end };
                // Update memory cache
                usersByEmail.set(req.email, { ...usersByEmail.get(req.email), ...user });
            }
        }
        
        res.json({ balance: user.balance, cycle: { end: user.cycleEnd } });
    } catch (error) {
        console.error('Credits error:', error);
        const user = usersByEmail.get(req.email) || { balance: 0 };
        res.json({ balance: user.balance, cycle: { end: user.cycleEnd } });
    }
});

// POST /v1/jobs { requestedSeconds }
app.post('/v1/jobs', requireAuth, (req, res) => {
    const requestedSeconds = Math.max(0, Number(req.body?.requestedSeconds || 0));
    const creditsPerSecond = Number(process.env.CREDITS_PER_SECOND || 15);
    // Bill to nearest whole second (minimum 1s) to match UX expectation (e.g., 3.10s -> 3s)
    const billableSeconds = Math.max(1, Math.round(requestedSeconds));
    const needed = billableSeconds * creditsPerSecond;
    console.log(`\n🧮 Credit reservation: requestedSeconds=${requestedSeconds.toFixed(3)}s, billableSeconds=${billableSeconds}s, creditsPerSecond=${creditsPerSecond}, needed=${needed}`);
    const user = usersByEmail.get(req.email) || { balance: 0 };
    if (user.balance < needed) return res.status(402).json({ error: 'Insufficient credits', needed, balance: user.balance });
    user.balance -= needed;
    usersByEmail.set(req.email, user);
    if (pgPool) upsertUserToDb(req.email); else scheduleSave();
    res.json({ taskId: `task_${Date.now()}`, reservedCredits: needed });
});

// POST /v1/portal-link -> returns Apstle manage link
app.post('/v1/portal-link', requireAuth, async (req, res) => {
    try {
        const user = usersByEmail.get(req.email);
        if (!user || !user.shopifyCustomerId) {
            return res.status(400).json({ error: 'Missing customer ID. Make a first purchase to link your account.' });
        }
        const base = process.env.APSTLE_API_BASE || 'https://subscription-admin.appstle.com/api/external/v2';
        const key = process.env.APSTLE_API_KEY || '';
        const resp = await fetch(`${base}/manage-subscription-link/${user.shopifyCustomerId}`, {
            headers: { 'X-Apstle-Api-Key': key }
        });
        if (!resp.ok) {
            const txt = await resp.text().catch(()=> '');
            return res.status(500).json({ error: 'Failed to fetch portal link', detail: txt });
        }
        const data = await resp.json().catch(()=>({}));
        return res.json({ url: data.url || data.manage_url || data.link || null });
    } catch (e) {
        return res.status(500).json({ error: 'Portal link error', detail: String(e) });
    }
});

// --- DEV UTILS: simulate Shopify orders/paid to grant credits ---
// Enabled only when NODE_ENV !== 'production'
// POST /v1/dev/mock-orders-paid { email, sellingPlanId?, sku? }
if (process.env.NODE_ENV !== 'production') app.post('/v1/dev/mock-orders-paid', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const sellingPlanId = req.body?.sellingPlanId ? String(req.body.sellingPlanId) : null;
    const sku = req.body?.sku ? String(req.body.sku) : null;
    if (!email) return res.status(400).json({ error: 'Email required' });

    let credits = 0;
    if (sellingPlanId) {
        const planCredits = {
            [process.env.SELLING_PLAN_TIER1 || '690384601430']: 3000,
            [process.env.SELLING_PLAN_TIER2 || '690385518934']: 7500,
            [process.env.SELLING_PLAN_TIER3 || '690385551702']: 24000,
        };
        credits = planCredits[sellingPlanId] || 1000;
    } else if (sku) {
        credits = getCreditsForSku(sku);
    } else {
        return res.status(400).json({ error: 'Provide sellingPlanId or sku' });
    }

    const prev = usersByEmail.get(email) || { balance: 0, planId: 'none', planName: 'none', cycleEnd: null, shopifyCustomerId: null };
    const cycleEnd = new Date(Date.now() + 30*24*60*60*1000).toISOString();
    const planId = sellingPlanId || prev.planId || 'none';
    usersByEmail.set(email, {
        balance: (prev.balance || 0) + credits,
        planId,
        planName: planId,
        cycleEnd,
        shopifyCustomerId: prev.shopifyCustomerId
    });
    if (pgPool) upsertUserToDb(email); else scheduleSave();
    return res.json({ email, granted: credits, balance: usersByEmail.get(email).balance, cycleEnd });
});

// POST /v1/checkout/topup { pack }
app.post('/v1/checkout/topup', requireAuth, (req, res) => {
    const pack = String(req.body?.pack || 'credits_1000');
    const urls = {
        credits_1000: 'https://6134fe-1d.myshopify.com/cart/add?sku=AUTOVFX-TOPUP-1000',
        credits_2000: 'https://6134fe-1d.myshopify.com/cart/add?sku=AUTOVFX-TOPUP-2000'
    };
    const url = urls[pack] || urls.credits_1000;
    res.json({ url });
});

// Export app for serverless platforms (Vercel) and start locally only if RUN_LOCAL=true
module.exports = app;

if (process.env.RUN_LOCAL === 'true') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`\n🚀 AutoVFX Webhook Server started!`);
        console.log(`📍 Local: http://localhost:${PORT}`);
        console.log(`\n⏳ Waiting for webhooks...\n`);
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down webhook server...');
    process.exit(0);
});


