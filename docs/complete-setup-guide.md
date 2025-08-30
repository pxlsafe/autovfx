# Complete Apstle + Shopify Integration Setup Guide

This guide walks you through the complete setup process to get your AutoVFX extension working with Apstle Subscriptions and Shopify.

## Prerequisites ✅

- [x] Shopify store: `6134fe-1d.myshopify.com`
- [x] Apstle API key: `V8v5lUCT7EdIdgb5h93QJJXYgHwdXS1H`
- [x] Apstle API base: `https://subscription-admin.appstle.com/api/external/v2`
- [ ] Backend server to handle webhooks
- [ ] Domain/URL for webhook endpoints

## Step 1: Shopify Webhook Setup 🔗

### 1.1 Access Shopify Admin
1. Go to your Shopify admin: `https://6134fe-1d.myshopify.com/admin`
2. Navigate to **Settings** → **Notifications**
3. Scroll down to **Webhooks** section

### 1.2 Create Webhooks
You need to create these webhooks:

#### Webhook 1: orders/paid (Primary)
```
Event: Order payment
Format: JSON
URL: https://your-backend-domain.com/v1/webhooks/shopify
```

#### Webhook 2: orders/create (Optional backup)
```
Event: Order creation  
Format: JSON
URL: https://your-backend-domain.com/v1/webhooks/shopify
```

### 1.3 Get Webhook Secret
1. After creating the webhook, Shopify will show you a **Signing secret**
2. Copy this secret - you'll need it for `SHOPIFY_WEBHOOK_SECRET`
3. It looks like: `sha256=abc123...`

### 1.4 Alternative: Use Shopify CLI (Advanced)
```bash
# Install Shopify CLI
npm install -g @shopify/cli @shopify/theme

# Create webhook
shopify app generate webhook --type=orders/paid
```

## Step 2: Apstle Subscriptions Setup 📋

### 2.1 Access Apstle Dashboard
1. Go to your Shopify admin
2. Navigate to **Apps** → **Apstle Subscriptions**
3. Or visit: `https://subscription-admin.appstle.com`

### 2.2 Create Selling Plan Groups
Create 3 selling plan groups for your tiers:

#### Tier 1 - Creator ($49/month)
```
Name: AutoVFX Creator
Price: $49.00
Billing Interval: 1 month
Credits: 1000 (for your reference)
```

#### Tier 2 - Studio ($79/month)  
```
Name: AutoVFX Studio
Price: $79.00
Billing Interval: 1 month
Credits: 2500 (for your reference)
```

#### Tier 3 - Pro ($199/month)
```
Name: AutoVFX Pro  
Price: $199.00
Billing Interval: 1 month
Credits: 8000 (for your reference)
```

### 2.3 Get Selling Plan IDs
After creating the selling plans:
1. Go to **Selling Plans** in Apstle dashboard
2. Copy the **Selling Plan ID** for each tier
3. Update your config with these IDs:

```bash
SELLING_PLAN_TIER1=12345  # Replace with actual ID
SELLING_PLAN_TIER2=12346  # Replace with actual ID  
SELLING_PLAN_TIER3=12347  # Replace with actual ID
```

## Step 3: Shopify Products Setup 🛍️

### 3.1 Create Top-up Products
In Shopify admin (**Products** → **All products** → **Add product**):

#### Product 1: Credit Top-up 1000
```
Title: AutoVFX Credits - 1000 Pack
Price: $30.00
SKU: AUTOVFX-TOPUP-1000
Product type: Digital
Inventory: Don't track quantity
```

#### Product 2: Credit Top-up 2000
```
Title: AutoVFX Credits - 2000 Pack  
Price: $50.00
SKU: AUTOVFX-TOPUP-2000
Product type: Digital
Inventory: Don't track quantity
```

### 3.2 Update Configuration
Update your environment with the SKUs:
```bash
TOPUP_SKU_1000=AUTOVFX-TOPUP-1000
TOPUP_SKU_2000=AUTOVFX-TOPUP-2000
```

## Step 4: Backend Implementation 🖥️

### 4.1 Environment Variables
Create a `.env` file with all the variables from `backend-env.example`:

```bash
# Copy the example and fill in your values
cp config/backend-env.example .env

# Edit .env with your actual values:
APSTLE_API_BASE=https://subscription-admin.appstle.com/api/external/v2
APSTLE_API_KEY=V8v5lUCT7EdIdgb5h93QJJXYgHwdXS1H
SHOPIFY_STORE_URL=6134fe-1d.myshopify.com
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret-from-shopify
SELLING_PLAN_TIER1=your-actual-selling-plan-id-1
SELLING_PLAN_TIER2=your-actual-selling-plan-id-2
SELLING_PLAN_TIER3=your-actual-selling-plan-id-3
TOPUP_SKU_1000=AUTOVFX-TOPUP-1000
TOPUP_SKU_2000=AUTOVFX-TOPUP-2000
```

### 4.2 Shopify Webhook Handler
Create this endpoint in your backend:

```javascript
// /v1/webhooks/shopify
const crypto = require('crypto');

function verifyShopifyWebhook(body, signature) {
    const hmac = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET);
    const computedSignature = hmac.update(body, 'utf8').digest('base64');
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(computedSignature, 'base64')
    );
}

app.post('/v1/webhooks/shopify', express.raw({type: 'application/json'}), async (req, res) => {
    const signature = req.headers['x-shopify-hmac-sha256'];
    const topic = req.headers['x-shopify-topic'];
    
    // Verify webhook signature
    if (!verifyShopifyWebhook(req.body, signature)) {
        return res.status(401).send('Unauthorized');
    }
    
    const order = JSON.parse(req.body);
    console.log(`Received webhook: ${topic} for order ${order.id}`);
    
    try {
        switch (topic) {
            case 'orders/paid':
                await handleOrderPaid(order);
                break;
            case 'orders/create':
                await handleOrderCreate(order);
                break;
            default:
                console.log('Unhandled webhook topic:', topic);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Error processing webhook');
    }
});

async function handleOrderPaid(order) {
    const customerId = order.customer.id.toString();
    
    // Check if subscription order
    const subscriptionItem = order.line_items.find(item => 
        item.selling_plan_allocation !== null
    );
    
    if (subscriptionItem) {
        // Subscription renewal - reset credits
        const sellingPlanId = subscriptionItem.selling_plan_allocation.selling_plan.id.toString();
        const credits = getCreditsForSellingPlan(sellingPlanId);
        
        console.log(`Subscription renewal: ${sellingPlanId} → ${credits} credits`);
        await resetCreditsForCustomer(customerId, credits, {
            orderId: order.id,
            sellingPlanId: sellingPlanId
        });
    }
    
    // Check for top-up products
    const topupItem = order.line_items.find(item => 
        item.sku === process.env.TOPUP_SKU_1000 || 
        item.sku === process.env.TOPUP_SKU_2000
    );
    
    if (topupItem) {
        // Top-up purchase - add credits immediately
        const credits = getCreditsForTopupSku(topupItem.sku);
        
        console.log(`Top-up purchase: ${topupItem.sku} → ${credits} credits`);
        await addCreditsForCustomer(customerId, credits, {
            orderId: order.id,
            sku: topupItem.sku
        });
    }
}

function getCreditsForSellingPlan(sellingPlanId) {
    const planCredits = {
        [process.env.SELLING_PLAN_TIER1]: 1000,
        [process.env.SELLING_PLAN_TIER2]: 2500,
        [process.env.SELLING_PLAN_TIER3]: 8000,
    };
    return planCredits[sellingPlanId] || 1000;
}

function getCreditsForTopupSku(sku) {
    const skuCredits = {
        [process.env.TOPUP_SKU_1000]: 1000,
        [process.env.TOPUP_SKU_2000]: 2000,
    };
    return skuCredits[sku] || 0;
}
```

### 4.3 Apstle API Integration
Add these functions for Apstle integration:

```javascript
// Apstle API helper
async function callApstle(endpoint, options = {}) {
    const response = await fetch(`${process.env.APSTLE_API_BASE}${endpoint}`, {
        headers: {
            'X-Apstle-Api-Key': process.env.APSTLE_API_KEY,
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    
    if (!response.ok) {
        throw new Error(`Apstle API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
}

// Generate customer portal link
app.post('/v1/portal-link', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const data = await callApstle(`/manage-subscription-link/${user.shopify_customer_id}`);
        res.json({ url: data.url });
    } catch (error) {
        console.error('Portal link error:', error);
        res.status(500).json({ error: 'Failed to generate portal link' });
    }
});

// Create subscription checkout
app.post('/v1/checkout/subscription', async (req, res) => {
    try {
        const { sellingPlanId } = req.body;
        
        // Create Shopify checkout with selling plan
        const checkout = await createShopifyCheckout({
            line_items: [{
                variant_id: getVariantIdForSellingPlan(sellingPlanId),
                quantity: 1,
                selling_plan: sellingPlanId
            }]
        });
        
        res.json({ checkoutUrl: checkout.web_url });
    } catch (error) {
        console.error('Checkout creation error:', error);
        res.status(500).json({ error: 'Failed to create checkout' });
    }
});
```

## Step 5: Testing & Validation 🧪

### 5.1 Test Webhook Reception
1. Use a tool like **ngrok** to expose your local backend:
   ```bash
   ngrok http 3000
   ```
2. Update your Shopify webhook URL to the ngrok URL
3. Create a test order and verify webhook is received

### 5.2 Test Subscription Flow
1. Create a test subscription via Apstle
2. Complete payment to trigger `orders/paid` webhook
3. Verify credits are reset in your database
4. Check logs for proper webhook processing

### 5.3 Test Top-up Flow
1. Purchase a top-up product
2. Verify `orders/paid` webhook is triggered
3. Confirm credits are added immediately
4. Test different top-up amounts

### 5.4 Test Customer Portal
1. Generate a portal link via your API
2. Verify the link opens Apstle customer portal
3. Test subscription management functions

## Step 6: Production Deployment 🚀

### 6.1 Deploy Backend
1. Deploy your backend to production (Heroku, AWS, etc.)
2. Set all environment variables in production
3. Update Shopify webhook URLs to production endpoints

### 6.2 Update Frontend Config
1. Update `config/config.json` with production backend URL
2. Test the complete flow end-to-end

### 6.3 Monitor & Debug
1. Set up logging for webhook events
2. Monitor Apstle API calls
3. Track credit transactions in your database

## Troubleshooting 🔧

### Common Issues:

**Webhook not received:**
- Check webhook URL is accessible
- Verify Shopify webhook secret
- Check firewall/security settings

**Credits not resetting:**
- Verify selling plan IDs match
- Check webhook signature verification
- Review database transaction logs

**Portal link fails:**
- Verify Apstle API key is correct
- Check customer ID mapping
- Test API endpoint directly

**Top-ups not working:**
- Verify SKU matching logic
- Check product configuration
- Test with different products

## Next Steps 📋

- [ ] Set up Shopify webhooks
- [ ] Get selling plan IDs from Apstle
- [ ] Create top-up products with SKUs
- [ ] Implement backend webhook handler
- [ ] Test subscription and top-up flows
- [ ] Deploy to production
- [ ] Monitor and optimize

Your AutoVFX extension is now ready for full Apstle + Shopify integration! 🎉
